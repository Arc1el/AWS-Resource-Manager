import { WorkSpacesClient, DescribeWorkspacesCommand } from "@aws-sdk/client-workspaces";

import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let workSpacesClient: WorkSpacesClient;

async function getWorkSpacesClient() {
    if (!workSpacesClient) {
        workSpacesClient = new WorkSpacesClient({ region: process.env.AWS_REGION });
    }
    return workSpacesClient;
}

async function listWorkSpacesResources(startDate?: Date, endDate?: Date) {
    console.log("WorkSpaces 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateWorkspaces",
        "AWS::WorkSpaces::Workspace"
      );
      console.log("가져온 WorkSpaces 이벤트 수:", events.length);
  
      const currentWorkspaces = await retryWithBackoff(() => getCurrentWorkSpaces(), 'WorkSpaces');
      console.log("현재 WorkSpaces 수:", currentWorkspaces.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const workspaceId = cloudTrailEvent.responseElements.failedRequests[0]?.workspaceId || 
                            cloudTrailEvent.responseElements.pendingRequests[0]?.workspaceId;
        const currentWorkspace = currentWorkspaces.find((ws: any) => ws.WorkspaceId === workspaceId);
  
        return {
          id: workspaceId,
          name: currentWorkspace ? currentWorkspace.UserName : workspaceId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentWorkspace ? currentWorkspace.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("WorkSpaces 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentWorkSpaces() {
    const client = await getWorkSpacesClient();
    const command = new DescribeWorkspacesCommand({});
    const response = await retryWithBackoff(() => client.send(command), 'WorkSpaces');
    return response.Workspaces || [];
  }

  export { listWorkSpacesResources };