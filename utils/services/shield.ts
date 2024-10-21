import { ShieldClient, ListProtectionsCommand, DescribeProtectionCommand } from "@aws-sdk/client-shield";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const shieldClient = new ShieldClient({ region });

async function listShieldResources(startDate?: Date, endDate?: Date) {
    console.log("Shield Protection 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateProtection",
        "AWS::Shield::Protection"
      );
      console.log("가져온 Shield Protection 이벤트 수:", events.length);
  
      let currentProtections = [];
      let subscriptionStatus = '구독됨';
  
      try {
        currentProtections = await retryWithBackoff(() => getCurrentShieldProtections(), 'Shield');
        console.log("현재 Shield Protection 수:", currentProtections.length);
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException' && error.message.includes('subscription does not exist')) {
          console.log("Shield 구독이 되어 있지 않습니다.");
          subscriptionStatus = '구독되지 않음';
        } else {
          throw error;
        }
      }
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const protectionId = cloudTrailEvent.responseElements.protectionId;
        const currentProtection = currentProtections.find((protection: any) => protection.Id === protectionId);
  
        return {
          id: protectionId,
          name: currentProtection ? currentProtection.Name : protectionId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: subscriptionStatus === '구독됨' ? (currentProtection ? 'Active' : '삭제됨') : '구독되지 않음',
          subscriptionStatus: subscriptionStatus,
        };
      });
    } catch (error) {
      console.error("Shield Protection 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentShieldProtections() {
    const listCommand = new ListProtectionsCommand({});
    const listResponse = await retryWithBackoff(() => shieldClient.send(listCommand), 'Shield');
    const protections = await Promise.all(listResponse.Protections.map(async (protection: any) => {
      const describeCommand = new DescribeProtectionCommand({ ProtectionId: protection.Id });
      const describeResponse = await retryWithBackoff(() => shieldClient.send(describeCommand), 'Shield');
      return describeResponse.Protection;
    }));
    return protections;
  }

  export { listShieldResources };