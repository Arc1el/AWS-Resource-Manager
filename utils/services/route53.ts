import { Route53Client, ListHostedZonesCommand } from "@aws-sdk/client-route-53";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const route53Client = new Route53Client({ region });


async function listRoute53Resources(startDate?: Date, endDate?: Date) {
    console.log("Route53 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateHostedZone",
        "AWS::Route53::HostedZone"
      );
      console.log("가져온 Route53 이벤트 수:", events.length);
  
      const currentHostedZones = await retryWithBackoff(() => getCurrentRoute53HostedZones(), 'Route53');
      console.log("현재 Route53 Hosted Zone 수:", currentHostedZones.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const hostedZoneId = cloudTrailEvent.responseElements.hostedZone.id;
        const currentHostedZone = currentHostedZones.find((zone: any) => zone.Id === hostedZoneId);
  
        return {
          id: hostedZoneId,
          name: cloudTrailEvent.requestParameters.name,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentHostedZone ? 'Active' : '삭제',
        };
      });
    } catch (error) {
      console.error("Route53 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentRoute53HostedZones() {
    const command = new ListHostedZonesCommand({});
    const response = await retryWithBackoff(() => route53Client.send(command), 'Route53');
    return response.HostedZones;
  }
    
  export { listRoute53Resources };