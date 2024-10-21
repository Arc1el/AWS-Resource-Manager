import { ECSClient, DescribeClustersCommand, ListClustersCommand } from "@aws-sdk/client-ecs";
  import { getResourceCreationEvents, retryWithBackoff } from '../aws';
  import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let ecsClient: ECSClient;

async function getECSClient() {
    if (!ecsClient) {
        ecsClient = new ECSClient({ region });
    }
    return ecsClient;
}

async function listECSResources(startDate?: Date, endDate?: Date) {
    console.log("ECS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCluster",
        "AWS::ECS::Cluster"
      );
      console.log("가져온 ECS 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentECSClusters(), 'ECS');
      console.log("현재 ECS 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterName = cloudTrailEvent.responseElements.cluster.clusterName;
        const currentCluster = currentClusters.find((cluster: any) => cluster.clusterName === clusterName);
  
        return {
          id: clusterName,
          name: clusterName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("ECS 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentECSClusters() {
    const listCommand = new ListClustersCommand({});
    const client = await getECSClient();
    const listResponse = await retryWithBackoff(() => client.send(listCommand), 'ECS');
    const describeCommand = new DescribeClustersCommand({ clusters: listResponse.clusterArns });
    const describeResponse = await retryWithBackoff(() => client.send(describeCommand), 'ECS');
    return describeResponse.clusters;
  }

  export { listECSResources };