import { ElasticBeanstalkClient, DescribeApplicationsCommand } from "@aws-sdk/client-elastic-beanstalk";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let elasticBeanstalkClient: ElasticBeanstalkClient;

async function getElasticBeanstalkClient() {
  if (!elasticBeanstalkClient) {
    elasticBeanstalkClient = await createAwsClient(ElasticBeanstalkClient);
  }
  return elasticBeanstalkClient;
}

async function listElasticBeanstalkApplicationResources(startDate?: Date, endDate?: Date) {
    console.log("Elastic Beanstalk Application 조회 기간:", startDate, "~", endDate);

    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateApplication",
        "AWS::ElasticBeanstalk::Application"
      );
      console.log("가져온 Elastic Beanstalk Application 이벤트 수:", events.length);
  
      const currentApplications = await retryWithBackoff(() => getCurrentElasticBeanstalkApplications(), 'Elastic Beanstalk');
      console.log("현재 Elastic Beanstalk Application 수:", currentApplications.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const applicationName = cloudTrailEvent.requestParameters.applicationName;
        const currentApplication = currentApplications.find((app: any) => app.ApplicationName === applicationName);
  
        return {
          id: applicationName,
          name: applicationName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentApplication ? 'Available' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Elastic Beanstalk Application 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentElasticBeanstalkApplications() {
    const command = new DescribeApplicationsCommand({});
    const client = await getElasticBeanstalkClient();
    const response = await retryWithBackoff(() => client.send(command), 'Elastic Beanstalk');
    return response.Applications;
  }

  export { listElasticBeanstalkApplicationResources };