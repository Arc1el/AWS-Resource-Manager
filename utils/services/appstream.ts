import { AppStreamClient, DescribeFleetsCommand } from "@aws-sdk/client-appstream";

import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const appStreamClient = new AppStreamClient({ region: process.env.AWS_REGION });

async function listAppStreamResources(startDate?: Date, endDate?: Date) {
    console.log("AppStream 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateFleet",
        "AWS::AppStream::Fleet"
      );
      console.log("가져온 AppStream 이벤트 수:", events.length);
  
      const currentFleets = await retryWithBackoff(() => getCurrentAppStreamFleets(), 'AppStream');
      console.log("현재 AppStream Fleet 수:", currentFleets.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const fleetName = cloudTrailEvent.requestParameters.name;
        const currentFleet = currentFleets.find((fleet: any) => fleet.Name === fleetName);
  
        return {
          id: fleetName,
          name: fleetName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentFleet ? currentFleet.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("AppStream 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentAppStreamFleets() {
    const command = new DescribeFleetsCommand({});
    const response = await retryWithBackoff(() => appStreamClient.send(command), 'AppStream');
    return response.Fleets || [];
  }

  export { listAppStreamResources };