import { DescribeVpcsCommand, EC2Client } from "@aws-sdk/client-ec2";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';
const ec2Client = new EC2Client({ region });


async function listVPCResources(startDate?: Date, endDate?: Date) {
    console.log("VPC 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateVpc",
        "AWS::EC2::VPC"
      );
      console.log("가져온 VPC 이벤트 수:", events.length);
  
      const currentVPCs = await retryWithBackoff(() => getCurrentVPCs(), 'VPC');
      console.log("현재 VPC 수:", currentVPCs.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const vpcId = cloudTrailEvent.responseElements.vpc.vpcId;
        const currentVPC = currentVPCs.find((vpc: any) => vpc.VpcId === vpcId);
  
        return {
          id: vpcId,
          name: currentVPC ? currentVPC.Tags.find((tag: any)   => tag.Key === 'Name')?.Value || vpcId : vpcId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentVPC ? currentVPC.State : '삭제됨',
        };
      });
    } catch (error) {
      console.error("VPC 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentVPCs() {
    const command = new DescribeVpcsCommand({});
    const response = await retryWithBackoff(() => ec2Client.send(command), 'VPC');
    return response.Vpcs;
  }
  
  export { listVPCResources };