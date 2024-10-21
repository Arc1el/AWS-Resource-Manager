import { SQSClient, ListQueuesCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";

import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let sqsClient: SQSClient;

async function getSQSClient() {
    if (!sqsClient) {
        sqsClient = new SQSClient({ region });
    }
    return sqsClient;
}

async function listSQSResources(startDate?: Date, endDate?: Date) {
    console.log("SQS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateQueue",
        "AWS::SQS::Queue"
      );
      console.log("가져온 SQS 이벤트 수:", events.length);
  
      const currentQueues = await retryWithBackoff(() => getCurrentSQSQueues(), 'SQS');
      console.log("현재 SQS 큐 수:", currentQueues.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const queueUrl = cloudTrailEvent.responseElements?.queueUrl;
        if (!queueUrl) {
          console.log("큐 URL을 찾을 수 없습니다:", cloudTrailEvent);
          return null;
        }
        const queueName = queueUrl.split('/').pop();
        const currentQueue = currentQueues.find((queue: any) => queue.QueueUrl === queueUrl);
  
        return {
          id: queueUrl,
          name: queueName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentQueue ? 'Active' : '삭제됨',
        };
      }).filter(Boolean); // null 값 제거
    } catch (error) {
      console.error("SQS 리소스 조회 오류:", error);
      return []; // 오류 발생 시 빈 배열 반환
    }
  }
  
  async function getCurrentSQSQueues() {
    const client = await getSQSClient();
    const listCommand = new ListQueuesCommand({});
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'SQS');
    
    if (!listResponse.QueueUrls || listResponse.QueueUrls.length === 0) {
      console.log("SQS 큐가 없습니다.");
      return [];
    }
  
    const queues = await Promise.all(listResponse.QueueUrls.map(async (queueUrl: any) => {
      const getAttributesCommand = new GetQueueAttributesCommand({ 
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      });
      const attributesResponse = await retryWithBackoff(() => client.send(getAttributesCommand), 'SQS');
      return { QueueUrl: queueUrl, ...attributesResponse.Attributes };
    }));
    return queues;
  }

  export { listSQSResources };