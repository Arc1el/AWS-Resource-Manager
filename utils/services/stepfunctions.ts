import { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand } from "@aws-sdk/client-sfn";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

async function listStepFunctionsResources(startDate?: Date, endDate?: Date) {
    console.log("Step Functions 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateStateMachine",
        "AWS::StepFunctions::StateMachine"
      );
      console.log("가져온 Step Functions 이벤트 수:", events.length);
  
      const currentStateMachines = await retryWithBackoff(() => getCurrentStepFunctionsStateMachines(), 'StepFunctions');
      console.log("현재 Step Functions State Machine 수:", currentStateMachines.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const stateMachineArn = cloudTrailEvent.responseElements.stateMachineArn;
        const currentStateMachine = currentStateMachines.find((sm: any) => sm.stateMachineArn === stateMachineArn);
  
        return {
          id: stateMachineArn,
          name: currentStateMachine ? currentStateMachine.name : stateMachineArn.split(':').pop(),
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentStateMachine ? 'ACTIVE' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Step Functions 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentStepFunctionsStateMachines() {
    const command = new ListStateMachinesCommand({});
    const response = await retryWithBackoff(() => sfnClient.send(command), 'StepFunctions');
    const stateMachines = await Promise.all(response.stateMachines.map(async (sm: any) => {
      const describeCommand = new DescribeStateMachineCommand({ stateMachineArn: sm.stateMachineArn });
      const describeResponse = await retryWithBackoff(() => sfnClient.send(describeCommand), 'StepFunctions');
      return describeResponse;
    }));
    return stateMachines;
  }

  export { listStepFunctionsResources };