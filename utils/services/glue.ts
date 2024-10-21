import { GlueClient, ListJobsCommand, GetJobCommand } from "@aws-sdk/client-glue";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const glueClient = new GlueClient({ region });

async function listGlueResources(startDate?: Date, endDate?: Date) {
    console.log("Glue Job 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateJob",
        "AWS::Glue::Job"
      );
      console.log("가져온 Glue Job 이벤트 수:", events.length);
  
      const currentJobs = await retryWithBackoff(() => getCurrentGlueJobs(), 'Glue');
      console.log("현재 Glue Job 수:", currentJobs.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const jobName = cloudTrailEvent.requestParameters.name;
        const currentJob = currentJobs.find((job: any) => job.Name === jobName);
  
        return {
          id: jobName,
          name: jobName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentJob ? 'READY' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Glue Job 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentGlueJobs() {
    const command = new ListJobsCommand({});
    const response = await retryWithBackoff(() => glueClient.send(command), 'Glue');
    const jobDetails = await Promise.all(response.JobNames.map(async (jobName: any) => {
      const getJobCommand = new GetJobCommand({ JobName: jobName });
      const jobResponse = await retryWithBackoff(() => glueClient.send(getJobCommand), 'Glue');
      return jobResponse.Job;
    }));
    return jobDetails;
  }

  export { listGlueResources };