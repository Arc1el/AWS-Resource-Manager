import { CloudTrailClient, LookupEventsCommand, LookupEventsCommandInput } from "@aws-sdk/client-cloudtrail";

import { listEC2Resources } from './services/ec2';
import { listRDSResources } from './services/rds';
import { listVPCResources } from './services/vpc';
import { listSageMakerResources } from './services/sagemaker';
import { listRoute53Resources } from './services/route53';
import { listCodeBuildResources } from './services/codebuild';
import { listCodeDeployResources } from './services/codedeploy';
import { listCodePipelineResources } from './services/codepipeline';
import { listKinesisResources } from './services/kinesis';
import { listOpenSearchResources } from './services/opensearch';
import { listDMSResources } from './services/dms';
import { listECRResources } from './services/ecr';
import { listECSResources } from './services/ecs';
import { listEKSResources } from './services/eks';
import { listApiGatewayResources } from './services/apigateway';
import { listAppMeshResources } from './services/appmesh';
import { listCloudFrontResources } from './services/cloudfront';
import { listDocDBResources } from './services/docdb';
import { listDynamoDBResources } from './services/dynamodb';
import { listElastiCacheResources } from './services/elasticache';
import { listGlueResources } from './services/glue';
import { listGameLiftResources } from './services/gamelift';
import { listChatbotResources } from './services/chatbot';
import { listDirectConnectResources } from './services/directconnect';
import { listElasticBeanstalkApplicationResources } from './services/beanstalk';  
import { listMemoryDBResources } from './services/memorydb';
import { listGuardDutyResources } from './services/guardduty';
import { listWAFv2Resources } from './services/waf';
import { listShieldResources } from './services/shield';
import { listAthenaResources } from './services/athena';
import { listFirehoseResources } from './services/firehose';
import { listEMRResources } from './services/emr';
import { listMSKResources } from './services/msk';
import { listRedshiftResources } from './services/redshift';
import { listConnectResources } from './services/connect';
import { listPinpointResources } from './services/pinpoint';
import { listSESConfigurationSetResources } from './services/ses';
import { listIoTThingResources } from './services/iot';
import { listBackupPlanResources } from './services/backup';
import { listEFSResources } from './services/efs';
import { listAmazonMQResources } from './services/mq';
import { listSQSResources } from './services/sqs';
import { listStepFunctionsResources } from './services/stepfunctions';
import { listAppStreamResources } from './services/appstream';
import { listWorkSpacesResources } from './services/workspaces';
import { listLambdaFunctionResources } from './services/lambda';

const region = process.env.AWS_REGION || "ap-northeast-2";
const cloudTrailClient = new CloudTrailClient({ region });

const MAX_RETRIES = 10;
const BASE_DELAY = 1000; // 1초

async function retryWithBackoff(fn: () => Promise<any>, serviceName: string, maxRetries = MAX_RETRIES) {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.name === 'ThrottlingException' && retries < maxRetries) {
        retries++;
        const delay = Math.min(BASE_DELAY * Math.pow(2, retries) + Math.random() * 1000, 30000);
        console.log(`ThrottlingException 발생 (${serviceName}). ${retries}번째 재시도. ${delay}ms 후 다시 시도합니다.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

async function getResourceCreationEvents(startDate: Date, endDate: Date, eventName: string, resourceType: string) {
  const params = {
    StartTime: startDate,
    EndTime: endDate,
    LookupAttributes: [
      { AttributeKey: "EventName", AttributeValue: eventName },
    ],
  };

  console.log("CloudTrail 조회 파라미터:", params);

  const command = new LookupEventsCommand(params as LookupEventsCommandInput);
  try {
    const response = await retryWithBackoff(() => cloudTrailClient.send(command), 'CloudTrail');
    console.log("CloudTrail 응답 이벤트 수:", response.Events.length);

    const filteredEvents = response.Events.filter((event: any) => {
      try {
        const cloudTrailEvent = JSON.parse(event.CloudTrailEvent);
        // console.log("파싱된 CloudTrail 이벤트:", cloudTrailEvent);
        
        // eventName 확인
        if (cloudTrailEvent.eventName !== eventName) {
          console.log("이벤트 이름 불일치:", cloudTrailEvent.eventName);
          return false;
        }

        // EC2 인스턴스의 경우
        if (resourceType === "AWS::EC2::Instance") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.instancesSet && 
                 cloudTrailEvent.responseElements.instancesSet.items;
        }

        // RDS 스턴스의 경우
        if (resourceType === "AWS::RDS::DBInstance") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.dBInstanceIdentifier;
        }

        // SageMaker 노트북 인스턴스의 경우
        if (resourceType === "AWS::SageMaker::NotebookInstance") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.notebookInstanceArn;
        }

        // Route53 호스팅 존의 경우
        if (resourceType === "AWS::Route53::HostedZone") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.hostedZone && 
                 cloudTrailEvent.responseElements.hostedZone.id;
        }

        // CodeBuild 프로젝트의 경우 특별 처리
        if (resourceType === "AWS::CodeBuild::Project") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.project && 
                 cloudTrailEvent.responseElements.project.name;
        }

        // CodeDeploy 애플리케이션의 경우
        if (resourceType === "AWS::CodeDeploy::Application") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.application && 
                 cloudTrailEvent.responseElements.application.applicationId;
        }

        // CodePipeline 파이프라인의 경우
        if (resourceType === "AWS::CodePipeline::Pipeline") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.pipeline && 
                 cloudTrailEvent.responseElements.pipeline.name;
        }

        // Kinesis 스트림의 경우
        if (resourceType === "AWS::Kinesis::Stream") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.streamDescription && 
                 cloudTrailEvent.responseElements.streamDescription.streamName;
        }

        // OpenSearch 도메인의 경우
        if (resourceType === "AWS::OpenSearchService::Domain") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.domainStatus && 
                 cloudTrailEvent.responseElements.domainStatus.domainName;
        }

        // DMS 복제 인스턴스의 경우
        if (resourceType === "AWS::DMS::ReplicationInstance") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.replicationInstance && 
                 cloudTrailEvent.responseElements.replicationInstance.replicationInstanceIdentifier;
        }

        // ECR 리포지토리의 경우
        if (resourceType === "AWS::ECR::Repository") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.repository && 
                 cloudTrailEvent.responseElements.repository.repositoryName;
        }

        // ECS 클러스터의 경우
        if (resourceType === "AWS::ECS::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.cluster && 
                 cloudTrailEvent.responseElements.cluster.clusterName;
        }

        // EKS 클러스터의 경우
        if (resourceType === "AWS::EKS::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.cluster && 
                 cloudTrailEvent.responseElements.cluster.name;
        }

        // API Gateway REST API의 경우
        if (resourceType === "AWS::ApiGateway::RestApi") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.id;
        }

        // App Mesh의 경우
        if (resourceType === "AWS::AppMesh::Mesh") {
          return cloudTrailEvent.requestParameters && 
                 cloudTrailEvent.requestParameters.meshName;
        }

        // CloudFront 배포 경우
        if (resourceType === "AWS::CloudFront::Distribution") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.distribution && 
                 cloudTrailEvent.responseElements.distribution.id;
        }

        // DocDB 러스터의 경우
        if (resourceType === "AWS::DocDB::DBCluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.dBCluster && 
                 cloudTrailEvent.responseElements.dBCluster.dBClusterIdentifier;
        }

        // DynamoDB 테이블의 경우
        if (resourceType === "AWS::DynamoDB::Table") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.tableDescription && 
                 cloudTrailEvent.responseElements.tableDescription.tableName;
        }

        // ElastiCache 클러스터의 경우
        if (resourceType === "AWS::ElastiCache::CacheCluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.cacheCluster && 
                 cloudTrailEvent.responseElements.cacheCluster.cacheClusterId;
        }

        // Glue Job의 경우
        if (resourceType === "AWS::Glue::Job") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.name;
        }

        // GameLift Fleet의 경우
        if (resourceType === "AWS::GameLift::Fleet") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.fleetAttributes && 
                 cloudTrailEvent.responseElements.fleetAttributes.fleetId;
        }

        // Chatbot Slack Channel Configuration의 경우
        if (resourceType === "AWS::Chatbot::SlackChannelConfiguration") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.configuration && 
                 cloudTrailEvent.responseElements.configuration.configurationArn;
        }

        // Direct Connect 연결의 경우
        if (resourceType === "AWS::DirectConnect::Connection") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.connectionId;
        }

        // VPC의 경우
        if (resourceType === "AWS::EC2::VPC") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.vpc && 
                 cloudTrailEvent.responseElements.vpc.vpcId;
        }

        // MemoryDB 클러스터의 경우
        if (resourceType === "AWS::MemoryDB::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.cluster && 
                 cloudTrailEvent.responseElements.cluster.name;
        }

        // GuardDuty 디텍터의 경우
        if (resourceType === "AWS::GuardDuty::Detector") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.detectorId;
        }

        // WAFv2 WebACL의 경우
        if (resourceType === "AWS::WAFv2::WebACL") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.summary && 
                 cloudTrailEvent.responseElements.summary.id;
        }

        // Shield Protection의 경우
        if (resourceType === "AWS::Shield::Protection") {
          return cloudTrailEvent.responseElements &&
                 cloudTrailEvent.responseElements.protectionId;
        }
      
        // Athena WorkGroup의 경우
        if (resourceType === "AWS::Athena::WorkGroup") {
          return cloudTrailEvent.responseElements &&
                 cloudTrailEvent.responseElements.workGroup &&
                 cloudTrailEvent.responseElements.workGroup.name;
        }
      
        // Kinesis Firehose Delivery Stream의 경우
        if (resourceType === "AWS::KinesisFirehose::DeliveryStream") {
          return cloudTrailEvent.responseElements &&
                 cloudTrailEvent.responseElements.deliveryStreamName;
        }

        // EMR의 경우
        if (resourceType === "AWS::EMR::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.jobFlowId;
        }

        // MSK의 경우
        if (resourceType === "AWS::MSK::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.clusterArn;
        }

        // Redshift 클러스터의 경우
        if (resourceType === "AWS::Redshift::Cluster") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.clusterIdentifier;
        }

        // Connect 인스턴스의 경우
        if (resourceType === "AWS::Connect::Instance") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.id;
        }

        // Pinpoint 앱의 경우
        if (resourceType === "AWS::Pinpoint::App") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.applicationId;
        }

        // SES Configuration Set의 경우
        if (resourceType === "AWS::SES::ConfigurationSet") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.configurationSet && 
                 cloudTrailEvent.responseElements.configurationSet.name;
        }

        // IoT Thing의 경우
        if (resourceType === "AWS::IoT::Thing") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.thingName;
        }

        // Backup Plan의 경우
        if (resourceType === "AWS::Backup::BackupPlan") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.backupPlanId;
        }

        if (resourceType === "AWS::EFS::FileSystem") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.fileSystemId;
        }

        if (resourceType === "AWS::AmazonMQ::Broker") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.brokerId;
        }

        if (resourceType === "AWS::SQS::Queue") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.queueUrl;
        }

        // Step Functions State Machine의 경우
        if (resourceType === "AWS::StepFunctions::StateMachine") {
          return cloudTrailEvent.responseElements && 
                 cloudTrailEvent.responseElements.stateMachineArn;
        }

        // AppStream Fleet의 경우
        if (resourceType === "AWS::AppStream::Fleet") {
          return cloudTrailEvent.requestParameters && 
                 cloudTrailEvent.requestParameters.name;
        }

        // WorkSpaces의 경우
        if (resourceType === "AWS::WorkSpaces::Workspace") {
          return cloudTrailEvent.responseElements && 
                 (cloudTrailEvent.responseElements.failedRequests[0]?.workspaceId || 
                  cloudTrailEvent.responseElements.pendingRequests[0]?.workspaceId);
        }

        // Elastic Beanstalk Application의 경우
        if (resourceType === "AWS::ElasticBeanstalk::Application") {
          return cloudTrailEvent.requestParameters && 
                 cloudTrailEvent.requestParameters.applicationName;
        }

        // Lambda Function의 경우
        if (resourceType === "AWS::Lambda::Function") {
          return cloudTrailEvent.requestParameters && 
                 cloudTrailEvent.requestParameters.functionName;
        }

        // 일반적인 리소스 타입에 대한 처리
        if (cloudTrailEvent.resources) {
          const hasMatchingResource = cloudTrailEvent.resources.some((resource: { resourceType: string }) => resource.resourceType === resourceType);
          if (!hasMatchingResource) {
            console.log("일치하는 리소스 타입 없음:", cloudTrailEvent.resources.map((r: { resourceType: string }) => r.resourceType));
          }
          return hasMatchingResource;
        }

        console.log("리소스 정보가 없는 이벤트:", event.EventId);
        return false;
      } catch (parseError) {
        console.error("CloudTrail 이벤트 파싱 오류:", parseError);
        return false;
      }
    });

    console.log("필터링 후 이벤트 수:", filteredEvents.length);
    return {
      events: filteredEvents,
      startDate,
      endDate
    };
  } catch (error) {
    console.error("CloudTrail 이벤트 조회 오류:", error);
    throw error;
  }
}


export {
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
  listAppMeshResources,
  listDMSResources,
  listECRResources,
  listECSResources,
  listEKSResources,
  listCloudFrontResources,
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
  listDocDBResources,
  listDynamoDBResources,
  listElastiCacheResources,
  listRedshiftResources
};

export { getResourceCreationEvents, retryWithBackoff };
