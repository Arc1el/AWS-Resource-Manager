import { EMRClient, ListClustersCommand as EMRListCommand, DescribeClusterCommand as EMRDescribeClusterCommand } from "@aws-sdk/client-emr";

import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let emrClient: EMRClient;

async function getEMRClient() {
    if (!emrClient) {
        emrClient = new EMRClient({ region });
    }
    return emrClient;
}

async function listEMRResources(startDate?: Date, endDate?: Date) {
    console.log("EMR 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "RunJobFlow",
        "AWS::EMR::Cluster"
      );
      console.log("가져온 EMR 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentEMRClusters(), 'EMR');
      console.log("현재 EMR 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterId = cloudTrailEvent.responseElements.jobFlowId;
        const currentCluster = currentClusters.find((cluster: any) => cluster.Id === clusterId);
  
        return {
          id: clusterId,
          name: cloudTrailEvent.requestParameters.name,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.Status.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("EMR 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentEMRClusters() {
    const listCommand = new EMRListCommand({});
    const client = await getEMRClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'EMR');
    const clusters = await Promise.all(listResponse.Clusters.map(async (cluster: any) => {
      const describeCommand = new EMRDescribeClusterCommand({ ClusterId: cluster.Id });
      const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'EMR');
      return describeResponse.Cluster;
    }));
    return clusters;
  }

  export { listEMRResources };