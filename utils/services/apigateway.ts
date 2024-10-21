import { APIGatewayClient, GetRestApisCommand } from "@aws-sdk/client-api-gateway";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let apiGatewayClient: APIGatewayClient;

async function getApiGatewayClient() {
  if (!apiGatewayClient) {
    apiGatewayClient = await createAwsClient(APIGatewayClient);
  }
  return apiGatewayClient;
}

async function listApiGatewayResources(startDate?: Date, endDate?: Date) {
    console.log("API Gateway 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateRestApi",
        "AWS::ApiGateway::RestApi"
      );
      console.log("가져온 API Gateway 이벤트 수:", events.length);
  
      const currentApis = await retryWithBackoff(() => getCurrentApiGatewayApis(), 'API Gateway');
      console.log("현재 API Gateway API 수:", currentApis.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const apiId = cloudTrailEvent.responseElements.id;
        const currentApi = currentApis.find((api: any) => api.id === apiId);
  
        return {
          id: apiId,
          name: cloudTrailEvent.responseElements.name,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentApi ? 'ACTIVE' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("API Gateway 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentApiGatewayApis() {
    const command = new GetRestApisCommand({});
    const client = await getApiGatewayClient();
    const response = await retryWithBackoff(() => client.send(command), 'API Gateway');
    return response.items;
  }

  export { listApiGatewayResources };
