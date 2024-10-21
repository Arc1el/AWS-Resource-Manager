import { FirehoseClient, ListDeliveryStreamsCommand, DescribeDeliveryStreamCommand } from "@aws-sdk/client-firehose";

import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let firehoseClient: FirehoseClient;

async function getFirehoseClient() {
    if (!firehoseClient) {
        firehoseClient = new FirehoseClient({ region });
    }
    return firehoseClient;
}

async function listFirehoseResources(startDate?: Date, endDate?: Date) {
    console.log("Kinesis Firehose Delivery Stream 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateDeliveryStream",
        "AWS::KinesisFirehose::DeliveryStream"
      );
      console.log("가져온 Kinesis Firehose Delivery Stream 이벤트 수:", events.length);
  
      const currentStreams = await retryWithBackoff(() => getCurrentFirehoseStreams(), 'Firehose');
      console.log("현재 Kinesis Firehose Delivery Stream 수:", currentStreams.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const streamName = cloudTrailEvent.responseElements.deliveryStreamName;
        const currentStream = currentStreams.find((stream: any) => stream.DeliveryStreamName === streamName);
  
        return {
          id: streamName,
          name: streamName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentStream ? currentStream.DeliveryStreamStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Kinesis Firehose Delivery Stream 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentFirehoseStreams() {
    const client = await getFirehoseClient();
    const listCommand = new ListDeliveryStreamsCommand({});
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'Firehose');
    const streams = await Promise.all(listResponse.DeliveryStreamNames.map(async (streamName: any) => {
      const describeCommand = new DescribeDeliveryStreamCommand({ DeliveryStreamName: streamName });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'Firehose');
      return describeResponse.DeliveryStreamDescription;
    }));
    return streams;
  }

  export { listFirehoseResources };