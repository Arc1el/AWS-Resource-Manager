import { ElastiCacheClient, DescribeCacheClustersCommand } from "@aws-sdk/client-elasticache";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let elastiCacheClient: ElastiCacheClient;

async function getElastiCacheClient() {
    if (!elastiCacheClient) {
        elastiCacheClient = new ElastiCacheClient({ region });
    }
    return elastiCacheClient;
}

async function listElastiCacheResources(startDate?: Date, endDate?: Date) {
    console.log("ElastiCache 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCacheCluster",
        "AWS::ElastiCache::CacheCluster"
      );
      console.log("가져온 ElastiCache 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentElastiCacheClusters(), 'ElastiCache');
      console.log("현재 ElastiCache 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterName = cloudTrailEvent.requestParameters.cacheClusterId;
        const currentCluster = currentClusters.find((cluster: any) => cluster.CacheClusterId === clusterName);
  
        return {
          id: clusterName,
          name: clusterName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.CacheClusterStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("ElastiCache 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentElastiCacheClusters() {
    const command = new DescribeCacheClustersCommand({});
    const client = await getElastiCacheClient();
    const response = await retryWithBackoff(() => client.send(command), 'ElastiCache');
    return response.CacheClusters;
  }

  export { listElastiCacheResources };