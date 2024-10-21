import { SSMClient, ListAssociationsCommand, DescribeAssociationCommand } from "@aws-sdk/client-ssm";
import { getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

const ssmClient = new SSMClient({ region });

async function listChatbotResources(startDate?: Date, endDate?: Date) {
    console.log("Chatbot 조회 기간:", startDate, "~", endDate);
    
    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateSlackChannelConfiguration",
        "AWS::Chatbot::SlackChannelConfiguration"
      );
      console.log("가져온 Chatbot 이벤트 수:", events.length);
  
      const currentConfigurations = await retryWithBackoff(() => getCurrentChatbotConfigurations(), 'Chatbot');
      console.log("현재 Chatbot Slack Channel Configuration 수:", currentConfigurations.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const configurationName = cloudTrailEvent.requestParameters.configurationName;
        const currentConfiguration = currentConfigurations.find((config: any) => config.Name === configurationName);
  
        return {
          id: configurationName,
          name: configurationName,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentConfiguration ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Chatbot 리소스 조회 오류:", error);
      return []; // 오류 발생 시 빈 배열 반환
    }
  }
  
  async function getCurrentChatbotConfigurations() {
    const command = new ListAssociationsCommand({
      AssociationFilterList: [
        {
          key: 'AssociationName',
          value: 'AWSSupportChannelConfiguration'
        }
      ]
    });
    const response = await retryWithBackoff(() => ssmClient.send(command), 'Chatbot');
    return response.Associations || [];
  }

  export { listChatbotResources };