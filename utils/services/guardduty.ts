import { GuardDutyClient, ListDetectorsCommand, GetDetectorCommand } from "@aws-sdk/client-guardduty";
import { createAwsClient,   getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let guardDutyClient: GuardDutyClient;

async function getGuardDutyClient() {
    if (!guardDutyClient) {
        guardDutyClient = new GuardDutyClient({ region });
    }
    return guardDutyClient;
}

async function listGuardDutyResources(startDate?: Date, endDate?: Date) {
    console.log("GuardDuty 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateDetector",
        "AWS::GuardDuty::Detector"
      );
      console.log("가져온 GuardDuty 이벤트 수:", events.length);
  
      const currentDetectors = await retryWithBackoff(() => getCurrentGuardDutyDetectors(), 'GuardDuty');
      console.log("현재 GuardDuty 디텍터 수:", currentDetectors.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const detectorId = cloudTrailEvent.responseElements.detectorId;
        const currentDetector = currentDetectors.find((detector: any) => detector.DetectorId === detectorId);
  
        return {
          id: detectorId,
          name: detectorId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentDetector ? currentDetector.Status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("GuardDuty 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentGuardDutyDetectors() {
    const listCommand = new ListDetectorsCommand({});
    const client = await getGuardDutyClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'GuardDuty');
    const detectors = await Promise.all(listResponse.DetectorIds.map(async (detectorId: any) => {
      const getCommand = new GetDetectorCommand({ DetectorId: detectorId });
      const getResponse = await retryWithBackoff(() => client.send(getCommand), 'GuardDuty');
      return { DetectorId: detectorId, ...getResponse };
    }));
    return detectors;
  }

  export { listGuardDutyResources };