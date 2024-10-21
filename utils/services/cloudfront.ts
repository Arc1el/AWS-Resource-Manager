import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const cloudFrontClient = new CloudFrontClient({ region });

async function listCloudFrontResources(startDate?: Date, endDate?: Date) {
    console.log("CloudFront 조회 기간:", startDate, "~", endDate);

    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateDistribution",
        "AWS::CloudFront::Distribution"
      );
      console.log("가져온 CloudFront 이벤트 수:", events.length);
  
      const currentDistributions = await retryWithBackoff(() => getCurrentCloudFrontDistributions(), 'CloudFront');
      console.log("현재 CloudFront 배포 수:", currentDistributions.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const distributionId = cloudTrailEvent.responseElements.distribution.id;
        const currentDistribution = currentDistributions.find((dist: any) => dist.Id === distributionId);
  
        return {
          id: distributionId,
          name: currentDistribution ? currentDistribution.DomainName : '알 수 없음',
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentDistribution ? currentDistribution.Status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("CloudFront 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentCloudFrontDistributions() {
    const command = new ListDistributionsCommand({});
    const response = await retryWithBackoff(() => cloudFrontClient.send(command), 'CloudFront');
    return response.DistributionList.Items;
  }

  export { listCloudFrontResources };