import { CodeBuildClient, ListProjectsCommand, BatchGetProjectsCommand } from "@aws-sdk/client-codebuild";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let codeBuildClient: CodeBuildClient;

async function getCodeBuildClient() {
  if (!codeBuildClient) {
    codeBuildClient = await createAwsClient(CodeBuildClient);
  }
  return codeBuildClient;
}

async function listCodeBuildResources(startDate?: Date, endDate?: Date) {
    console.log("CodeBuild 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateProject",
        "AWS::CodeBuild::Project"
      );
      console.log("가져온 CodeBuild 이벤트 수:", events.length);
  
      const currentProjects = await retryWithBackoff(() => getCurrentCodeBuildProjects(), 'CodeBuild');
      console.log("현재 CodeBuild 프로젝트 수:", currentProjects.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const projectName = cloudTrailEvent.responseElements.project.name;
        const currentProject = currentProjects.find((project: any) => project.name === projectName);
  
        return {
          id: projectName,
          name: projectName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn || cloudTrailEvent.userIdentity.principalId,
          state: currentProject ? currentProject.currentPhase : '삭제됨',
        };
      });
    } catch (error) {
      console.error("CodeBuild 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentCodeBuildProjects() {
    const listCommand = new ListProjectsCommand({});
    const client = await getCodeBuildClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'CodeBuild');
    const batchGetCommand = new BatchGetProjectsCommand({ names: listResponse.projects });
    const batchGetResponse = await retryWithBackoff(() => client.send(batchGetCommand), 'CodeBuild');
    return batchGetResponse.projects;
  }

  export { listCodeBuildResources };