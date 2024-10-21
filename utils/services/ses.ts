import { SESv2Client, ListConfigurationSetsCommand, GetConfigurationSetCommand } from "@aws-sdk/client-sesv2";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let sesClient: SESv2Client;

async function getSESClient() {
    if (!sesClient) {
        sesClient = new SESv2Client({ region });
    }
    return sesClient;
}

async function listSESConfigurationSetResources(startDate?: Date, endDate?: Date) {
    console.log("SES Configuration Set 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateConfigurationSet",
        "AWS::SES::ConfigurationSet"
      );
      console.log("가져온 SES Configuration Set 이벤트 수:", events.length);
  
      const currentConfigSets = await retryWithBackoff(() => getCurrentSESConfigurationSets(), 'SES');
      console.log("현재 SES Configuration Set 수:", currentConfigSets.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const configSetName = cloudTrailEvent.responseElements.configurationSet.name;
        const currentConfigSet = currentConfigSets.find((set: any) => set.Name === configSetName);
  
        return {
          id: configSetName,
          name: configSetName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentConfigSet ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("SES Configuration Set 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentSESConfigurationSets() {
    const client = await getSESClient();
    const command = new ListConfigurationSetsCommand({});
    const response = await retryWithBackoff(() => client.send(command), 'SES');
    const configSets = await Promise.all(response.ConfigurationSets.map(async (set: any) => {
      const getCommand = new GetConfigurationSetCommand({ ConfigurationSetName: set.Name });
      const getResponse = await retryWithBackoff(() => client.send(getCommand), 'SES');
      return getResponse;
    }));
    return configSets;
  }

  export { listSESConfigurationSetResources };