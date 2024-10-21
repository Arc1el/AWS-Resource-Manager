import { KafkaClient, ListClustersV2Command as MSKListCommand, DescribeClusterV2Command } from "@aws-sdk/client-kafka";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const mskClient = new KafkaClient({ region });

async function listMSKResources(startDate?: Date, endDate?: Date) {
    console.log("MSK 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCluster",
        "AWS::MSK::Cluster"
      );
      console.log("가져온 MSK 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentMSKClusters(), 'MSK');
      console.log("현재 MSK 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterArn = cloudTrailEvent.responseElements.clusterArn;
        const currentCluster = currentClusters.find((cluster: any) => cluster.ClusterArn === clusterArn);
  
        return {
          id: clusterArn,
          name: cloudTrailEvent.requestParameters.clusterName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("MSK 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentMSKClusters() {
    const listCommand = new MSKListCommand({});
    const listResponse = await retryWithBackoff(() => mskClient.send(listCommand), 'MSK');
    const clusters = await Promise.all(listResponse.ClusterInfoList.map(async (cluster: any) => {
      const describeCommand = new DescribeClusterV2Command({ ClusterArn: cluster.ClusterArn });
      const describeResponse = await retryWithBackoff(() => mskClient.send(describeCommand), 'MSK');
      return describeResponse.ClusterInfo;
    }));
    return clusters;
  }

  export { listMSKResources };