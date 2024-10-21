import { RedshiftClient, DescribeClustersCommand as RedshiftDescribeClustersCommand } from "@aws-sdk/client-redshift";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let redshiftClient: RedshiftClient;

async function getRedshiftClient() {
    if (!redshiftClient) {
        redshiftClient = new RedshiftClient({ region });
    }
    return redshiftClient;
}

async function listRedshiftResources(startDate?: Date, endDate?: Date) {
    console.log("Redshift 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCluster",
        "AWS::Redshift::Cluster"
      );
      console.log("가져온 Redshift 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentRedshiftClusters(), 'Redshift');
      console.log("현재 Redshift 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterIdentifier = cloudTrailEvent.responseElements.clusterIdentifier;
        const currentCluster = currentClusters.find((cluster: any) => cluster.ClusterIdentifier === clusterIdentifier);
  
        return {
          id: clusterIdentifier,
          name: clusterIdentifier,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.ClusterStatus : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Redshift 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentRedshiftClusters() {
    const client = await getRedshiftClient();
    const command = new RedshiftDescribeClustersCommand({});
    const response = await retryWithBackoff(() => client.send(command), 'Redshift');
    return response.Clusters;
  }

  export { listRedshiftResources };