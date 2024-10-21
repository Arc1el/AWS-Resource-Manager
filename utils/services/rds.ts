import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const rdsClient = new RDSClient({ region });


async function getRDSCreationEvents(startDate: Date, endDate: Date) {
    return getResourceCreationEvents(startDate, endDate, "CreateDBInstance", "AWS::RDS::DBInstance");
  }
  
  async function listRDSResources(startDate?: Date, endDate?: Date) {
    console.log("RDS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const [currentInstances, creationEventsResult] = await Promise.all([
        retryWithBackoff(() => getRDSInstances(), 'RDS'),
        getRDSCreationEvents(startDate, endDate)
      ]);

      console.log("현재 RDS 인스턴스:", currentInstances);
      console.log("RDS 생성 이벤트:", creationEventsResult);

      const rdsResources = creationEventsResult.events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const instanceId = cloudTrailEvent.requestParameters.dBInstanceIdentifier;
        const currentInstance = currentInstances.find((instance: any) => instance.DBInstanceIdentifier === instanceId);

        const resource = {
          id: instanceId,
          name: currentInstance?.DBName || instanceId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn || cloudTrailEvent.userIdentity.principalId,
          state: currentInstance ? currentInstance.DBInstanceStatus : '삭제됨',
        };

        console.log("생성된 RDS 리소스:", resource);
        return resource;
      });

      console.log("최종 RDS 리소스:", rdsResources);
      return rdsResources;
    } catch (error) {
      console.error("RDS 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getRDSInstances() {
    const command = new DescribeDBInstancesCommand({});
    const response = await retryWithBackoff(() => rdsClient.send(command), 'RDS');
    return response.DBInstances;
  }

  export { listRDSResources };
