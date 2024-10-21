import { DocDBClient, DescribeDBClustersCommand } from "@aws-sdk/client-docdb";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const docDBClient = new DocDBClient({ region });

async function listDocDBResources(startDate?: Date, endDate?: Date) {
    console.log("DocumentDB 조회 기간:", startDate, "~", endDate);

    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateDBCluster",
        "AWS::DocDB::DBCluster"
      );
      console.log("가져온 DocumentDB 이벤트 수:", events.length);
  
      const currentClusters = await retryWithBackoff(() => getCurrentDocDBClusters(), 'DocumentDB');
      console.log("현재 DocumentDB 클러스터 수:", currentClusters.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const clusterIdentifier = cloudTrailEvent.requestParameters.dBClusterIdentifier;
        const currentCluster = currentClusters.find((cluster: any) => cluster.DBClusterIdentifier === clusterIdentifier);
  
        return {
          id: clusterIdentifier,
          name: clusterIdentifier,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentCluster ? currentCluster.Status : '삭제됨',
        };
      });
    } catch (error) {
      console.error("DocumentDB 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentDocDBClusters() {
    const command = new DescribeDBClustersCommand({});
    const response = await retryWithBackoff(() => docDBClient.send(command), 'DocumentDB');
    return response.DBClusters;
  }

  export { listDocDBResources };