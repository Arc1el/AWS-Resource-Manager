import { DirectConnectClient, DescribeConnectionsCommand } from "@aws-sdk/client-direct-connect";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const directConnectClient = new DirectConnectClient({ region });

async function listDirectConnectResources(startDate?: Date, endDate?: Date) {
    console.log("Direct Connect 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateConnection",
        "AWS::DirectConnect::Connection"
      );
      console.log("가져온 Direct Connect 이벤트 수:", events.length);
  
      const currentConnections = await retryWithBackoff(() => getCurrentDirectConnectConnections(), 'Direct Connect'  );
      console.log("현재 Direct Connect 연결 수:", currentConnections.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const connectionId = cloudTrailEvent.responseElements.connectionId;
        const currentConnection = currentConnections.find((conn: any) => conn.connectionId === connectionId);
  
        return {
          id: connectionId,
          name: currentConnection ? currentConnection.connectionName : connectionId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentConnection ? currentConnection.connectionState : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Direct Connect 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentDirectConnectConnections() {
    const command = new DescribeConnectionsCommand({});
    const response = await retryWithBackoff(() => directConnectClient.send(command), 'Direct Connect');
    return response.connections;
  }

  export { listDirectConnectResources };