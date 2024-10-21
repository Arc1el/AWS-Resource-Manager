import { IoTClient, ListThingsCommand, DescribeThingCommand } from "@aws-sdk/client-iot";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let iotClient: IoTClient;

async function getIoTClient() {
    if (!iotClient) {
        iotClient = new IoTClient({ region });
    }
    return iotClient;
}

async function listIoTThingResources(startDate?: Date, endDate?: Date) {
    console.log("IoT Thing 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateThing",
        "AWS::IoT::Thing"
      );
      console.log("가져온 IoT Thing 이벤트 수:", events.length);
  
      const currentThings = await retryWithBackoff(() => getCurrentIoTThings(), 'IoT');
      console.log("현재 IoT Thing 수:", currentThings.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const thingName = cloudTrailEvent.responseElements.thingName;
        const currentThing = currentThings.find((thing: any) => thing.thingName === thingName);
  
        return {
          id: thingName,
          name: thingName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentThing ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("IoT Thing 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentIoTThings() {
    const client = await getIoTClient();
    const command = new ListThingsCommand({});
    const response = await retryWithBackoff(() => client.send(command), 'IoT');
    const things = await Promise.all(response.things.map(async (thing: any) => {
      const describeCommand = new DescribeThingCommand({ thingName: thing.thingName });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'IoT');
      return describeResponse;
    }));
    return things;
  }

  export { listIoTThingResources };