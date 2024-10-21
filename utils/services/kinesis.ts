import { KinesisClient, ListStreamsCommand, DescribeStreamCommand } from "@aws-sdk/client-kinesis";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let kinesisClient: KinesisClient;

async function getKinesisClient() {
    if (!kinesisClient) {
        kinesisClient = new KinesisClient({ region });
    }
    return kinesisClient;
}

async function listKinesisResources(startDate?: Date, endDate?: Date) {
    console.log("Kinesis 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateStream",
        "AWS::Kinesis::Stream"
      );
      console.log("가져온 Kinesis 이벤트 수:", events.length);
  
      const currentStreams = await retryWithBackoff(() => getCurrentKinesisStreams(), 'Kinesis');
      console.log("현재 Kinesis 스트림 수:", currentStreams.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const streamName = cloudTrailEvent.requestParameters.streamName;
        const currentStream = currentStreams.find((stream: any) => stream.StreamName === streamName);
  
        return {
          id: streamName,
          name: streamName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentStream ? currentStream.StreamStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Kinesis 리소스 조회 오류:", error);
      throw error;
    }
  }

  async function getCurrentKinesisStreams() {
    const client = await getKinesisClient();
    const listCommand = new ListStreamsCommand({});
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'Kinesis');
    const streams = await Promise.all(listResponse.StreamNames.map(async (streamName: any) => {
      const describeCommand = new DescribeStreamCommand({ StreamName: streamName });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'Kinesis');
      return describeResponse.StreamDescription;
    }));
    return streams;
  }


  export { listKinesisResources };