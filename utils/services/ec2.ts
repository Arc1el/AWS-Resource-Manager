import { EC2Client, DescribeInstancesCommand, TerminateInstancesCommand } from "@aws-sdk/client-ec2";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let ec2Client: EC2Client;

async function getEC2Client() {
  if (!ec2Client) {
    ec2Client = await createAwsClient(EC2Client);
  }
  return ec2Client;
}

async function getCurrentEC2Instances() {
  const command = new DescribeInstancesCommand({});
  const client = await getEC2Client();
  const response = await retryWithBackoff(() => client.send(command), 'EC2');
  return response.Reservations.flatMap((reservation: any) => reservation.Instances);
}

async function terminateEC2Instance(instanceId: string) {
  const command = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
  try {
    const client = await getEC2Client();
    const response = await retryWithBackoff(() => client.send(command), 'EC2');
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

    const currentInstances = await getCurrentEC2Instances();
    console.log("현재 EC2 인스턴스 수:", currentInstances.length);

    return events.map((event: any) => {
      const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
      const instanceId = cloudTrailEvent.responseElements.instancesSet.items[0].instanceId;
      const currentInstance = currentInstances.find((instance: any) => instance.InstanceId === instanceId);

      return {
        id: instanceId,
        name: currentInstance ? currentInstance.Tags.find((tag: any) => tag.Key === 'Name')?.Value || instanceId : instanceId,
        creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
        creator: cloudTrailEvent.userIdentity.arn,
        state: currentInstance ? currentInstance.State.Name : '삭제됨',
      };
    });
  } catch (error) {
    console.error("EC2 리소스 조회 오류:", error);
    throw error;
  }
}

export { listEC2Resources, terminateEC2Instance };
