import { PinpointClient, GetAppsCommand } from "@aws-sdk/client-pinpoint";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let pinpointClient: PinpointClient;

async function getPinpointClient() {
    if (!pinpointClient) {
        pinpointClient = new PinpointClient({ region });
    }
    return pinpointClient;
}

async function listPinpointResources(startDate?: Date, endDate?: Date) {
    console.log("Pinpoint 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateApp",
        "AWS::Pinpoint::App"
      );
      console.log("가져온 Pinpoint 이벤트 수:", events.length);
  
      const currentApps = await retryWithBackoff(() => getCurrentPinpointApps(), 'Pinpoint');
      console.log("현재 Pinpoint 앱 수:", currentApps.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const applicationId = cloudTrailEvent.responseElements.applicationId;
        const currentApp = currentApps.find((app: any) => app.Id === applicationId);
  
        return {
          id: applicationId,
          name: currentApp ? currentApp.Name : applicationId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentApp ? 'ACTIVE' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Pinpoint 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentPinpointApps() {
    const client = await getPinpointClient();
    const command = new GetAppsCommand({});
    const response = await retryWithBackoff(() => client.send(command), 'Pinpoint');
    return response.ApplicationsResponse.Item;
  }

  export { listPinpointResources };