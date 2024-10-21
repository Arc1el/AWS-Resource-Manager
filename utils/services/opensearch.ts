import { OpenSearchClient, ListDomainNamesCommand, DescribeDomainCommand } from "@aws-sdk/client-opensearch";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let openSearchClient: OpenSearchClient;

async function getOpenSearchClient() {
    if (!openSearchClient) {
        openSearchClient = new OpenSearchClient({ region });
    }
    return openSearchClient;
}

async function listOpenSearchResources(startDate?: Date, endDate?: Date) {
    console.log("OpenSearch 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateDomain",
        "AWS::OpenSearchService::Domain"
      );
      console.log("가져온 OpenSearch 이벤트 수:", events.length);
  
      const currentDomains = await retryWithBackoff(() => getCurrentOpenSearchDomains(), 'OpenSearch');
      console.log("현재 OpenSearch 도메인 수:", currentDomains.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const domainName = cloudTrailEvent.requestParameters.domainName;
        const currentDomain = currentDomains.find((domain: any) => domain.DomainName === domainName);
  
        return {
          id: domainName,
          name: domainName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentDomain ? currentDomain.Processing : '삭제됨',
        };
      });
    } catch (error) {
      console.error("OpenSearch 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentOpenSearchDomains() {
    const client = await getOpenSearchClient();
    const listCommand = new ListDomainNamesCommand({});
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'OpenSearch');
    const domains = await Promise.all(listResponse.DomainNames.map(async (domain: any) => {
      const describeCommand = new DescribeDomainCommand({ DomainName: domain.DomainName });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'OpenSearch');
      return describeResponse.DomainStatus;
    }));
    return domains;
  }

  export { listOpenSearchResources };