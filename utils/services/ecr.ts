import { ECRClient, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let ecrClient: ECRClient;

async function getECRClient() {
    if (!ecrClient) {
        ecrClient = new ECRClient({ region });
    }
    return ecrClient;
}

async function listECRResources(startDate?: Date, endDate?: Date) {
    console.log("ECR 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate || new Date(0),
        endDate || new Date(),
        "CreateRepository",
        "AWS::ECR::Repository"
      );
      console.log("가져온 ECR 이벤트 수:", events.length);
  
      const currentRepositories = await retryWithBackoff(() => getCurrentECRRepositories(), 'ECR');
      console.log("현재 ECR 리포지토리 수:", currentRepositories.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const repositoryName = cloudTrailEvent.responseElements.repository.repositoryName;
        const currentRepository = currentRepositories.find((repo: any) => repo.repositoryName === repositoryName);
  
        return {
          id: repositoryName,
          name: repositoryName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentRepository ? 'ACTIVE' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("ECR 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentECRRepositories() {
    const command = new DescribeRepositoriesCommand({});
    const client = await getECRClient();
    const response = await retryWithBackoff(() => client.send(command), 'ECR');
    return response.repositories;
  }

  export { listECRResources };