import { CodeDeployClient, ListApplicationsCommand, GetApplicationCommand } from "@aws-sdk/client-codedeploy";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let codeDeployClient: CodeDeployClient;

async function getCodeDeployClient() {
  if (!codeDeployClient) {
    codeDeployClient = await createAwsClient(CodeDeployClient);
  }
  return codeDeployClient;
}

async function listCodeDeployResources(startDate?: Date, endDate?: Date) {
    console.log("CodeDeploy 조회 기간:", startDate, "~", endDate);

    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateApplication",
        "AWS::CodeDeploy::Application"
      );
      console.log("가져온 CodeDeploy 이벤트 수:", events.length);
  
      const currentApplications = await retryWithBackoff(() => getCurrentCodeDeployApplications(), 'CodeDeploy' );
      console.log("현재 CodeDeploy 애플리케이션 수:", currentApplications.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const applicationName = cloudTrailEvent.requestParameters.applicationName;
        const currentApplication = currentApplications.find((app: any) => app.applicationName === applicationName);
  
        return {
          id: applicationName,
          name: applicationName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentApplication ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("CodeDeploy 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentCodeDeployApplications() {
    const listCommand = new ListApplicationsCommand({});
    const client = await getCodeDeployClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'CodeDeploy');
    const applications = await Promise.all(listResponse.applications.map(async (appName: any) => {
      const getCommand = new GetApplicationCommand({ applicationName: appName });
      const getResponse = await retryWithBackoff(() => client.send(getCommand), 'CodeDeploy');
      return getResponse.application;
    }));
    return applications;
  }

  export { listCodeDeployResources };