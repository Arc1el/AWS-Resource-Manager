import { ConnectClient, ListInstancesCommand, DescribeInstanceCommand } from "@aws-sdk/client-connect";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let connectClient: ConnectClient;

async function getConnectClient() {
  if (!connectClient) {
    connectClient = await createAwsClient(ConnectClient);
  }
  return connectClient;
}

async function listConnectResources(startDate?: Date, endDate?: Date) {
    console.log("Connect 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateInstance",
        "AWS::Connect::Instance"
      );
      console.log("가져온 Connect 이벤트 수:", events.length);
  
      const currentInstances = await retryWithBackoff(() => getCurrentConnectInstances(), 'Connect');
      console.log("현재 Connect 인스턴스 수:", currentInstances.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const instanceId = cloudTrailEvent.responseElements.id;
        const currentInstance = currentInstances.find((instance: any) => instance.Id === instanceId);
  
        return {
          id: instanceId,
          name: currentInstance ? currentInstance.InstanceAlias : instanceId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentInstance ? currentInstance.InstanceStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Connect 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentConnectInstances() {
    const listCommand = new ListInstancesCommand({});
    const client = await getConnectClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'Connect');
    const instances = await Promise.all(listResponse.InstanceSummaryList.map(async (instance: any) => {
      const describeCommand = new DescribeInstanceCommand({ InstanceId: instance.Id });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'Connect');
      return describeResponse.Instance;
    }));
    return instances;
  }

  export { listConnectResources };