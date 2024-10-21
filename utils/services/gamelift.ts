import { GameLiftClient, DescribeFleetAttributesCommand, ListFleetsCommand } from "@aws-sdk/client-gamelift";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let gameLiftClient: GameLiftClient;

async function getGameLiftClient() {
    if (!gameLiftClient) {
        gameLiftClient = new GameLiftClient({ region });
    }
    return gameLiftClient;
}

async function listGameLiftResources(startDate?: Date, endDate?: Date) {
    console.log("GameLift 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateFleet",
        "AWS::GameLift::Fleet"
      );
      console.log("가져온 GameLift 이벤트 수:", events.length);
  
      const currentFleets = await retryWithBackoff(() => getCurrentGameLiftFleets(), 'GameLift');
      console.log("현재 GameLift Fleet 수:", currentFleets.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const fleetId = cloudTrailEvent.responseElements.fleetAttributes.fleetId;
        const currentFleet = currentFleets.find((fleet: any) => fleet.FleetId === fleetId);
  
        return {
          id: fleetId,
          name: currentFleet ? currentFleet.Name : fleetId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentFleet ? currentFleet.Status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("GameLift 리소스 조회 오류:", error);
      return []; // 오류 발생 시 빈 배열 반환
    }
  }
  
  async function getCurrentGameLiftFleets() {
    const listCommand = new ListFleetsCommand({});
    const client = await getGameLiftClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'GameLift'  );
    
    if (!listResponse.FleetIds || listResponse.FleetIds.length === 0) {
      console.log("GameLift Fleet이 없습니다.");
      return [];
    }
  
    const describeCommand = new DescribeFleetAttributesCommand({ FleetIds: listResponse.FleetIds });
    const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'GameLift');
    return describeResponse.FleetAttributes || [];
  }

  export { listGameLiftResources };