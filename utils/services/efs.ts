import { EFSClient, DescribeFileSystemsCommand } from "@aws-sdk/client-efs";

import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let efsClient: EFSClient;

async function getEFSClient() {
    if (!efsClient) {
        efsClient = new EFSClient({ region });
    }
    return efsClient;
}

async function listEFSResources(startDate?: Date, endDate?: Date) {
    console.log("EFS 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateFileSystem",
        "AWS::EFS::FileSystem"
      );
      console.log("가져온 EFS 이벤트 수:", events.length);
  
      const currentFileSystems = await retryWithBackoff(() => getCurrentEFSFileSystems(), 'EFS');
      console.log("현재 EFS 파일 시스템 수:", currentFileSystems.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const fileSystemId = cloudTrailEvent.responseElements.fileSystemId;
        const currentFileSystem = currentFileSystems.find((fs: any) => fs.FileSystemId === fileSystemId);
  
        return {
          id: fileSystemId,
          name: currentFileSystem ? currentFileSystem.Name : fileSystemId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentFileSystem ? currentFileSystem.LifeCycleState : '삭제됨',
        };
      });
    } catch (error) {
      console.error("EFS 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentEFSFileSystems() {
    const command = new DescribeFileSystemsCommand({});
    const client = await getEFSClient();
    const response = await retryWithBackoff(() => client.send(command), 'EFS');
    return response.FileSystems;
  }

  export { listEFSResources };