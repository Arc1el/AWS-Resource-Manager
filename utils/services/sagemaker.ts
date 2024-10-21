import { SageMakerClient, ListNotebookInstancesCommand } from "@aws-sdk/client-sagemaker";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const sageMakerClient = new SageMakerClient({ region });


async function listSageMakerResources(startDate?: Date, endDate?: Date) {
    console.log("SageMaker 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateNotebookInstance",
        "AWS::SageMaker::NotebookInstance"
      );
      console.log("가져온 SageMaker 이벤트 수:", events.length);
  
      const currentInstances = await retryWithBackoff(() => getCurrentSageMakerInstances(), 'SageMaker');
      console.log("현재 SageMaker 인스턴스 :", currentInstances.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const notebookInstanceName = cloudTrailEvent.requestParameters.notebookInstanceName;
        const currentInstance = currentInstances.find((instance: any) => instance.NotebookInstanceName === notebookInstanceName);
  
        return {
          id: notebookInstanceName,
          name: notebookInstanceName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentInstance ? currentInstance.NotebookInstanceStatus : '제됨',
        };
      });
    } catch (error) {
      console.error("SageMaker 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentSageMakerInstances() {
    const command = new ListNotebookInstancesCommand({});
    const response = await retryWithBackoff(() => sageMakerClient.send(command), 'SageMaker');
    return response.NotebookInstances;
  }
  
  export { listSageMakerResources };