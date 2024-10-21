import { WAFV2Client, ListWebACLsCommand, GetWebACLCommand } from "@aws-sdk/client-wafv2";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const wafv2Client = new WAFV2Client({ region });

async function listWAFv2Resources(startDate?: Date, endDate?: Date) {
    console.log("WAFv2 WebACL 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateWebACL",
        "AWS::WAFv2::WebACL"
      );
      console.log("가져온 WAFv2 WebACL 이벤트 수:", events.length);
  
      const currentWebACLs = await retryWithBackoff(() => getCurrentWAFv2WebACLs(), 'WAFv2');
      console.log("현재 WAFv2 WebACL 수:", currentWebACLs.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const webACLId = cloudTrailEvent.responseElements.summary.id;
        const webACLName = cloudTrailEvent.requestParameters.name;
        const currentWebACL = currentWebACLs.find((acl: any) => acl.Id === webACLId);
  
        return {
          id: webACLId,
          name: webACLName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentWebACL ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("WAFv2 WebACL 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentWAFv2WebACLs() {
    const listCommand = new ListWebACLsCommand({ Scope: 'REGIONAL' });
    const listResponse = await retryWithBackoff(() => wafv2Client.send(listCommand), 'WAFv2');
    const webACLs = await Promise.all(listResponse.WebACLs.map(async (webACL: any) => {
      const getCommand = new GetWebACLCommand({ 
        Id: webACL.Id, 
        Name: webACL.Name, 
        Scope: 'REGIONAL' 
      });
      const getResponse = await retryWithBackoff(() => wafv2Client.send(getCommand), 'WAFv2');
      return getResponse.WebACL;
    }));
    return webACLs;
  }
  
  export { listWAFv2Resources };