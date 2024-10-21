import { CodePipelineClient, ListPipelinesCommand, GetPipelineCommand } from "@aws-sdk/client-codepipeline";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let codePipelineClient: CodePipelineClient;

async function getCodePipelineClient() {
  if (!codePipelineClient) {
    codePipelineClient = await createAwsClient(CodePipelineClient);
  }
  return codePipelineClient;
}

async function listCodePipelineResources(startDate?: Date, endDate?: Date) {
    console.log("CodePipeline 조회 간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreatePipeline",
        "AWS::CodePipeline::Pipeline"
      );
      console.log("가져온 CodePipeline 이벤트 수:", events.length);
  
      const currentPipelines = await retryWithBackoff(() => getCurrentCodePipelines(), 'CodePipeline');
      console.log("현재 CodePipeline 파이프라인 수:", currentPipelines.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const pipelineName = cloudTrailEvent.requestParameters.pipeline.name;
        const currentPipeline = currentPipelines.find((pipeline: any) => pipeline.name === pipelineName);
  
        return {
          id: pipelineName,
          name: pipelineName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentPipeline ? currentPipeline.pipelineState : '삭제됨',
        };
      });
    } catch (error) {
      console.error("CodePipeline 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentCodePipelines() {
    const listCommand = new ListPipelinesCommand({});
    const client = await getCodePipelineClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'CodePipeline');
    const pipelines = await Promise.all(listResponse.pipelines.map(async (pipeline: any) => {
      const getCommand = new GetPipelineCommand({ name: pipeline.name });
      const getResponse = await retryWithBackoff(() => client.send(getCommand), 'CodePipeline');
      return getResponse.pipeline;
    }));
    return pipelines;
  }

  export { listCodePipelineResources };