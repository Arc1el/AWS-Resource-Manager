import { LambdaClient, ListFunctionsCommand, GetFunctionCommand } from "@aws-sdk/client-lambda";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const lambdaClient = new LambdaClient({ region });

async function listLambdaFunctionResources(startDate?: Date, endDate?: Date) {
    console.log("Lambda Function 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateFunction20150331",
        "AWS::Lambda::Function"
      );
      console.log("가져온 Lambda Function 이벤트 수:", events.length);
  
      const currentFunctions = await retryWithBackoff(() => getCurrentLambdaFunctions(), 'Lambda');
      console.log("현재 Lambda Function 수:", currentFunctions.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const functionName = cloudTrailEvent.requestParameters.functionName;
        const currentFunction = currentFunctions.find((func: any) => func.FunctionName === functionName);
  
        return {
          id: functionName,
          name: functionName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentFunction ? currentFunction.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Lambda Function 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentLambdaFunctions() {
    const listCommand = new ListFunctionsCommand({});
    const listResponse = await retryWithBackoff(() => lambdaClient.send(listCommand), 'Lambda');
    const functions = await Promise.all(listResponse.Functions.map(async (func: any) => {
      const getCommand = new GetFunctionCommand({ FunctionName: func.FunctionName });
      const getResponse = await retryWithBackoff(() => lambdaClient.send(getCommand), 'Lambda');
      return getResponse.Configuration;
    }));
    return functions;
  }

  export { listLambdaFunctionResources };