import { MemoryDBClient, DescribeClustersCommand as MemoryDBDescribeClustersCommand } from "@aws-sdk/client-memorydb";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const memoryDBClient = new MemoryDBClient({ region });

async function listMemoryDBResources(startDate?: Date, endDate?: Date) {
    console.log("MemoryDB 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateCluster",
        "AWS::MemoryDB::Cluster"
      );
      console.log("가져온 MemoryDB 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentMemoryDBClusters(), 'MemoryDB');
      console.log("현재 MemoryDB 클러스 :", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterName = cloudTrailEvent.responseElements.cluster.name;
        const currentCluster = currentClusters.find((cluster: any)   => cluster.Name === clusterName);
  
        return {
          id: clusterName,
          name: clusterName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.Status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("MemoryDB 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentMemoryDBClusters() {
    const command = new MemoryDBDescribeClustersCommand({});
    const response = await retryWithBackoff(() => memoryDBClient.send(command), 'MemoryDB');
    return response.Clusters;
  }

  export { listMemoryDBResources };