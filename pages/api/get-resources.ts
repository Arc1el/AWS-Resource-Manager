import { NextApiRequest, NextApiResponse } from 'next';

import { 
  listEC2Resources,
  listRDSResources, 
  listApiGatewayResources, 
  listSageMakerResources, 
  listRoute53Resources, 
  listCodeBuildResources, 
  listCodeDeployResources, 
  listCodePipelineResources, 
  listKinesisResources, 
  listOpenSearchResources, 
  listDMSResources, 
  listECRResources, 
  listECSResources, 
  listEKSResources, 
  listAppMeshResources, 
  listCloudFrontResources, 
  listDocDBResources,
  listDynamoDBResources,
  listElastiCacheResources,
  listGlueResources,
  listGameLiftResources,
  listChatbotResources,
  listDirectConnectResources,
  listVPCResources,
  listMemoryDBResources,
  listGuardDutyResources,
  listWAFv2Resources,
  listShieldResources,
  listAthenaResources,
  listFirehoseResources,
  listEMRResources,
  listMSKResources,
  listRedshiftResources,
  listConnectResources,
  listPinpointResources,
  listSESConfigurationSetResources,
  listIoTThingResources,
  listBackupPlanResources,
  listEFSResources,
  listAmazonMQResources,
  listSQSResources,
  listStepFunctionsResources,
  listAppStreamResources,
  listWorkSpacesResources,
  listElasticBeanstalkApplicationResources,
  listLambdaFunctionResources,
} from '../../utils/aws';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { startDate: startDateString, endDate: endDateString, service } = req.query;

    const startDate = startDateString ? new Date(startDateString as string) : undefined;
    const endDate = endDateString ? new Date(endDateString as string) : undefined;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '시작 날짜와 종료 날짜가 필요합니다.' });
    }

    if (!service) {
      return res.status(400).json({ error: '서비스 파라미터가 필요합니다.' });
    }

    try {
      let resources;
      switch (service) {
        case 'ec2':
          resources = await listEC2Resources(startDate, endDate);
          break;
        case 'rds':
          resources = await listRDSResources(startDate, endDate);
          console.log('API - RDS 리소스:', resources); // 로그 추가
          break;
        case 'apigateway':
          resources = await listApiGatewayResources(startDate, endDate);
          break;
        case 'sagemaker':
          resources = await listSageMakerResources(startDate, endDate);
          break;
        case 'route53':
          resources = await listRoute53Resources(startDate, endDate);
          break;
        case 'codebuild':
          resources = await listCodeBuildResources(startDate, endDate);
          break;
        case 'codedeploy':
          resources = await listCodeDeployResources(startDate, endDate);
          break;
        case 'codepipeline':
          resources = await listCodePipelineResources(startDate, endDate);
          break;
        case 'kinesis':
          resources = await listKinesisResources(startDate, endDate);
          break;
        case 'opensearch':
          resources = await listOpenSearchResources(startDate, endDate);
          break;
        case 'appmesh':
          resources = await listAppMeshResources(startDate, endDate);
          break;
        case 'dms':
          resources = await listDMSResources(startDate, endDate);
          break;
        case 'ecr':
          resources = await listECRResources(startDate, endDate);
          break;
        case 'ecs':
          resources = await listECSResources(startDate, endDate);
          break;
        case 'eks':
          resources = await listEKSResources(startDate, endDate);
          break;
        case 'cloudfront':
          resources = await listCloudFrontResources(startDate, endDate);
          break;
        case 'glue':
          resources = await listGlueResources(startDate, endDate);
          break;
        case 'gamelift':
          resources = await listGameLiftResources(startDate, endDate);
          break;
        case 'chatbot':
          resources = await listChatbotResources(startDate, endDate);
          break;
        case 'directconnect':
          resources = await listDirectConnectResources(startDate, endDate);
          break;
        case 'vpc':
          resources = await listVPCResources(startDate, endDate);
          break;
        case 'memorydb':
          resources = await listMemoryDBResources(startDate, endDate);
          break;
        case 'guardduty':
          resources = await listGuardDutyResources(startDate, endDate);
          break;
        case 'wafv2':
          resources = await listWAFv2Resources(startDate, endDate);
          break;
        case 'shield':
          resources = await listShieldResources(startDate, endDate);
          break; 
        case 'athena':
          resources = await listAthenaResources(startDate, endDate);
          break;
        case 'firehose':
          resources = await listFirehoseResources(startDate, endDate);
          break;
        case 'emr':
          resources = await listEMRResources(startDate, endDate);
          break;
        case 'msk':
          resources = await listMSKResources(startDate, endDate);
          break;
        case 'connect':
          resources = await listConnectResources(startDate, endDate);
          break;
        case 'pinpoint':
          resources = await listPinpointResources(startDate, endDate);
          break;
        case 'ses':
          resources = await listSESConfigurationSetResources(startDate, endDate);
          break;
        case 'iot':
          resources = await listIoTThingResources(startDate, endDate);
          break;
        case 'backupplan':
          resources = await listBackupPlanResources(startDate, endDate);
          break;
        case 'efs':
          resources = await listEFSResources(startDate, endDate);
          break;
        case 'amazonmq':
          resources = await listAmazonMQResources(startDate, endDate);
          break;
        case 'sqs':
          resources = await listSQSResources(startDate, endDate);
          break;
        case 'stepfunctions':
          resources = await listStepFunctionsResources(startDate, endDate);
          break;
        case 'appstream':
          resources = await listAppStreamResources(startDate, endDate);
          break;
        case 'workspaces':
          resources = await listWorkSpacesResources(startDate, endDate);
          break;
        case 'elasticbeanstalkapplication':
          resources = await listElasticBeanstalkApplicationResources(startDate, endDate);
          break;
        case 'lambdafunction':
          resources = await listLambdaFunctionResources(startDate, endDate);
          break;
        case 'docdb':
          resources = await listDocDBResources(startDate, endDate);
          break;
        case 'dynamodb':
          resources = await listDynamoDBResources(startDate, endDate);
          break;
        case 'elastiCache':
          resources = await listElastiCacheResources(startDate, endDate);
          break;
        case 'redshift':
          resources = await listRedshiftResources(startDate, endDate);
          break;
        default:
          return res.status(400).json({ error: '지원되지 않는 서비스입니다.' });
      }

      res.status(200).json({ [service]: resources });
    } catch (error) {
      console.error('리소스 조회 오류:', error);
      res.status(500).json({ error: '내부 서버 오류' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
