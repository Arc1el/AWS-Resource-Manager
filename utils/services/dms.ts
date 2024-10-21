import { DatabaseMigrationServiceClient, DescribeReplicationInstancesCommand } from "@aws-sdk/client-database-migration-service";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let dmsClient: DatabaseMigrationServiceClient;

async function getDMSClient() {
  if (!dmsClient) {
    dmsClient = await createAwsClient(DatabaseMigrationServiceClient);
  }
  return dmsClient;
}

async function listDMSResources(startDate?: Date, endDate?: Date) {
    console.log("DMS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateReplicationInstance",
        "AWS::DMS::ReplicationInstance"
      );
      console.log("가져온 DMS 이벤트 수:", events.length);
  
      const currentInstances = await retryWithBackoff(() => getCurrentDMSInstances(), 'DMS' );
      console.log("현재 DMS 복제 인스턴스 수:", currentInstances.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const instanceId = cloudTrailEvent.requestParameters.replicationInstanceIdentifier;
        const currentInstance = currentInstances.find((instance: any) => instance.ReplicationInstanceIdentifier === instanceId);
  
        return {
          id: instanceId,
          name: instanceId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentInstance ? currentInstance.ReplicationInstanceStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("DMS 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentDMSInstances() {
    const command = new DescribeReplicationInstancesCommand({});
    const client = await getDMSClient();
    const response = await retryWithBackoff(() => client.send(command), 'DMS');
    return response.ReplicationInstances;
  }

  export { listDMSResources };