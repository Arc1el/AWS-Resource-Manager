import { BackupClient, ListBackupPlansCommand, GetBackupPlanCommand } from "@aws-sdk/client-backup";
import { createAwsClient, getResourceCreationEvents, retryWithBackoff } from '../aws';
import { format, utcToZonedTime } from 'date-fns-tz';

const region = process.env.AWS_REGION || "ap-northeast-2";
const TIMEZONE = 'Asia/Seoul';

let backupClient: BackupClient;

async function getBackupClient() {
  if (!backupClient) {
    backupClient = await createAwsClient(BackupClient);
  }
  return backupClient;
}

async function listBackupPlanResources(startDate?: Date, endDate?: Date) {
    console.log("Backup Plan 조회 기간:", startDate, "~", endDate);

    if (!startDate || !endDate) {
        throw new Error("시작 날짜와 종료 날짜가 필요합니다.");
    }
    
    try {
      const { events, startDate: eventStartDate, endDate: eventEndDate } = await getResourceCreationEvents(
        startDate,
        endDate,
        "CreateBackupPlan",
        "AWS::Backup::BackupPlan"
      );
      console.log("가져온 Backup Plan 이벤트 수:", events.length);
  
      const currentBackupPlans = await retryWithBackoff(() => getCurrentBackupPlans(), 'Backup');
      console.log("현재 Backup Plan 수:", currentBackupPlans.length);
  
      return events.map((event: any) => {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        const backupPlanId = cloudTrailEvent.responseElements.backupPlanId;
        const currentBackupPlan = currentBackupPlans.find((plan: any) => plan.BackupPlanId === backupPlanId);
  
        return {
          id: backupPlanId,
          name: currentBackupPlan ? currentBackupPlan.BackupPlan.BackupPlanName : backupPlanId,
          creationTime: format(utcToZonedTime(new Date(event.EventTime), TIMEZONE), 'yyyy-MM-dd HH:mm:ss'),
          creator: cloudTrailEvent.userIdentity.arn,
          state: currentBackupPlan ? 'Active' : '삭제됨',
        };
      });
    } catch (error) {
      console.error("Backup Plan 리소스 조회 오류:", error);
      throw error;
    }
  }
  
  async function getCurrentBackupPlans() {
    const command = new ListBackupPlansCommand({});
    const client = await getBackupClient();
    const response = await retryWithBackoff(() => client.send(command), 'Backup');
    const backupPlans = await Promise.all(response.BackupPlansList.map(async (plan: any) => {
      const getCommand = new GetBackupPlanCommand({ BackupPlanId: plan.BackupPlanId });
      const getResponse = await retryWithBackoff(() => client.send(getCommand), 'Backup');
      return getResponse;
    }));
    return backupPlans;
  }

  export { listBackupPlanResources };