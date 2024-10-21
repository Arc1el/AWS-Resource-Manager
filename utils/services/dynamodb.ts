import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const dynamoDBClient = new DynamoDBClient({ region });

async function listDynamoDBResources(startDate?: Date, endDate?: Date) {
    console.log("DynamoDB 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateTable",
        "AWS::DynamoDB::Table"
      );
      console.log("가져온 DynamoDB 이벤트 수:", events.length);
  
      const currentTables = await retryWithBackoff(() => getCurrentDynamoDBTables(), 'DynamoDB');
      console.log("현재 DynamoDB 테이블 수:", currentTables.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const tableName = cloudTrailEvent.requestParameters.tableName;
        const currentTable = currentTables.find((table: any) => table.TableName === tableName);
  
        return {
          id: tableName,
          name: tableName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentTable ? currentTable.TableStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("DynamoDB 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentDynamoDBTables() {
    const listCommand = new ListTablesCommand({});
    const listResponse = await retryWithBackoff(() => dynamoDBClient.send(listCommand), 'DynamoDB');
    const tables = await Promise.all(listResponse.TableNames.map(async (tableName: any) => {
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const describeResponse = await retryWithBackoff(() => dynamoDBClient.send(describeCommand), 'DynamoDB');
      return describeResponse.Table;
    }));
    return tables;
  }

  export { listDynamoDBResources };