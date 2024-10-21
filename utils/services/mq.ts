import { MqClient, ListBrokersCommand, DescribeBrokerCommand } from "@aws-sdk/client-mq";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let mqClient: MqClient;

async function getMqClient() {
    if (!mqClient) {
        mqClient = new MqClient({ region });
    }
    return mqClient;
}

async function listAmazonMQResources(startDate?: Date, endDate?: Date) {
    console.log("AmazonMQ 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateBroker",
        "AWS::AmazonMQ::Broker"
      );
      console.log("가져온 AmazonMQ 이벤트 수:", events.length);
  
      const currentBrokers = await retryWithBackoff(() => getCurrentAmazonMQBrokers(), 'AmazonMQ');
      console.log("현재 AmazonMQ 브로커 수:", currentBrokers.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const brokerId = cloudTrailEvent.responseElements.brokerId;
        const currentBroker = currentBrokers.find((broker: any) => broker.BrokerId === brokerId);
  
        return {
          id: brokerId,
          name: currentBroker ? currentBroker.BrokerName : brokerId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentBroker ? currentBroker.BrokerState : '삭제됨',
        };
      });
    } catch (error) {
      console.error("AmazonMQ 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentAmazonMQBrokers() {
    const client = await getMqClient();
    const listCommand = new ListBrokersCommand({});
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'AmazonMQ');
    const brokers = await Promise.all(listResponse.BrokerSummaries.map(async (broker: any) => {
      const describeCommand = new DescribeBrokerCommand({ BrokerId: broker.BrokerId });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'AmazonMQ');
      return describeResponse;
    }));
    return brokers;
  }

  export { listAmazonMQResources };