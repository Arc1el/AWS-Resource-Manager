import { AthenaClient, ListWorkGroupsCommand, GetWorkGroupCommand } from "@aws-sdk/client-athena";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const athenaClient = new AthenaClient({ region });

async function listAthenaResources(startDate?: Date, endDate?: Date) {
    console.log("Athena WorkGroup 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }

    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateWorkGroup",
        "AWS::Athena::WorkGroup"
      );
      console.log("가져온 Athena WorkGroup 이벤트 수:", events.length);
  
      const currentWorkGroups = await retryWithBackoff(() => getCurrentAthenaWorkGroups(), 'Athena');
      console.log("현재 Athena WorkGroup 수:", currentWorkGroups.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const workGroupName = cloudTrailEvent.responseElements.workGroup.name;
        const currentWorkGroup = currentWorkGroups.find((wg: any) => wg.Name === workGroupName);
  
        return {
          id: workGroupName,
          name: workGroupName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentWorkGroup ? currentWorkGroup.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Athena WorkGroup 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentAthenaWorkGroups() {
    const listCommand = new ListWorkGroupsCommand({});
    const listResponse = await retryWithBackoff(() => athenaClient.send(listCommand), 'Athena');
    const workGroups = await Promise.all(listResponse.WorkGroups.map(async (workGroup: any) => {
      const getCommand = new GetWorkGroupCommand({ WorkGroup: workGroup.Name });
      const getResponse = await retryWithBackoff(() => athenaClient.send(getCommand), 'Athena');
      return getResponse.WorkGroup;
    }));
    return workGroups;
  }

  export { listAthenaResources };