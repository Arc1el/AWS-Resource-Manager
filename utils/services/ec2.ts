import { EC2Client, DescribeInstancesCommand, TerminateInstancesCommand } from "@aws-sdk/client-ec2";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const ec2Client = new EC2Client({ region });
const TIMEZONE = 'Asia/Seoul';

async function listEC2Resources(startDate?: Date, endDate?: Date) {
    console.log("EC2 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "RunInstances",
        "AWS::EC2::Instance"
      );
      console.log("가져온 EC2 이벤트 수:", events.length);
      console.log("이벤트 조회 기간:", eventStartDate, "~", eventEndDate);
  
      const currentInstances = await retryWithBackoff(() => getCurrentEC2Instances(), 'EC2');
      console.log("현재 EC2 인스턴스 수:", currentInstances.length);
  
      const ec2Resources = events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const instanceIds = cloudTrailEvent.responseElements.instancesSet.items.map((item: any) => item.instanceId);
        
        return instanceIds.map((instanceId: string) => {
          const currentInstance = currentInstances.find((instance: any) => instance.InstanceId === instanceId);
  
          return {
            id: instanceId,
            name: currentInstance?.Tags?.find((tag: any) => tag.Key === 'Name')?.Value || instanceId,
            creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
            creator: cloudTrailEvent.userIdentity.arn,
            state: currentInstance ? currentInstance.State.Name : '삭제됨',
          };
        });
      }).flat();

      // 중복 제거
      const uniqueResources = Array.from(new Map(ec2Resources.map((item: any) => [item.id, item])).values());
      
      console.log("최종 EC2 리소스 수:", uniqueResources.length);
      return uniqueResources;
    } catch (error) {
      console.error("EC2 리소스 조회 오류:", error);
      throw error;
    }
  }

async function getCurrentEC2Instances() {
  const command = new DescribeInstancesCommand({});
  const response = await retryWithBackoff(() => ec2Client.send(command), 'EC2');
  return response.Reservations.flatMap((reservation: any) => reservation.Instances);
}

async function terminateEC2Instance(instanceId: string) {
  const command = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
  try {
    const response = await retryWithBackoff(() => ec2Client.send(command), 'EC2');
    console.log('EC2 인스턴스 종료 요청 완료:', JSON.stringify(response, null, 2));
    return {
      success: true,
      message: 'EC2 인스턴스 종료 요청이 완료되었습니다.',
      details: response.TerminatingInstances
    };
  } catch (error) {
    console.error('EC2 인스턴스 종료 오류:', error);
    return {
      success: false,
      message: 'EC2 인스턴스 종료 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

export { listEC2Resources, terminateEC2Instance };
