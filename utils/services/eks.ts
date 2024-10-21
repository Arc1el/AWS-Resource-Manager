import { EKSClient, DescribeClusterCommand, ListClustersCommand as EKSListClustersCommand } from "@aws-sdk/client-eks";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let eksClient: EKSClient;

async function getEKSClient() {
    if (!eksClient) {
        eksClient = new EKSClient({ region });
    }
    return eksClient;
}

async function listEKSResources(startDate?: Date, endDate?: Date) {
    console.log("EKS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCluster",
        "AWS::EKS::Cluster"
      );
      console.log("가져온 EKS 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentEKSClusters(), 'EKS');
      console.log("현재 EKS 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterName = cloudTrailEvent.responseElements.cluster.name;
        const currentCluster = currentClusters.find((cluster: any) => cluster.name === clusterName);
  
        return {
          id: clusterName,
          name: clusterName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("EKS 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentEKSClusters() {
    const listCommand = new EKSListClustersCommand({});
    const client = await getEKSClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'EKS');
    const clusters = await Promise.all(listResponse.clusters.map(async (clusterName: any) => {
      const describeCommand = new DescribeClusterCommand({ name: clusterName });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'EKS');
      return describeResponse.cluster;
    }));
    return clusters;
  }

  export { listEKSResources };