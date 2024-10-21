import { AppMeshClient, ListMeshesCommand, DescribeMeshCommand } from "@aws-sdk/client-app-mesh";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const appMeshClient = new AppMeshClient({ region });

async function listAppMeshResources(startDate?: Date, endDate?: Date) {
  console.log("App Mesh 조회 기간:", startDate || "시작일 미지정", "~", endDate || "종료일 미지정");
  
  if (!startDate || !endDate) {
    throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
}

  try {
    const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
      startDate,
      endDate,
      "CreateMesh",
      "AWS::AppMesh::Mesh"
    );
    console.log("가져온 App Mesh 이벤트 수:", events.length);
    console.log("이벤트 조회 기간:", eventStartDate, "~", eventEndDate);
    

    const currentMeshes = await retryWithBackoff(() => getCurrentAppMeshes(), 'App Mesh');
    console.log("현재 App Mesh 수:", currentMeshes.length);

    if (events.length > 0) {
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const meshName = cloudTrailEvent.requestParameters.meshName;
        const currentMesh = currentMeshes.find((mesh: any) => mesh.meshName === meshName);
  
        return {
          id: meshName,
          name: meshName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentMesh ? currentMesh.status.status : '삭제됨',
        };
      });
    } else {
      // 이벤트가 없는 경우 현재 메시 정보만 반환
      return currentMeshes.map((mesh: any) => ({
        id: mesh.meshName,
        name: mesh.meshName,
        creationTime: '알 수 없음',
        creator: '알 수 없음',
        state: mesh.status.status,
      }));
    }
  } catch (error) {
    console.error("App Mesh 리소스 조회 오류:", error);
    throw error;
  }
}

async function getCurrentAppMeshes() {
  const listCommand = new ListMeshesCommand({});
  const listResponse = await retryWithBackoff(() => appMeshClient.send(listCommand), 'App Mesh');
  const meshes = await Promise.all(listResponse.meshes.map(async (mesh: any) => {
    const describeCommand = new DescribeMeshCommand({ meshName: mesh.meshName });
    const describeResponse = await retryWithBackoff(() => appMeshClient.send(describeCommand), 'App Mesh');
    return describeResponse.mesh;
  }));
  return meshes;
}

export { listAppMeshResources };
