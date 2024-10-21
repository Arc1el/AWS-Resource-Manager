export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Resource {
  id: string;
  name: string;
  creationTime: string;
  creator: string;
  state: string;
}

export type ResourceType = 'ec2' 
| 'rds' 
| 'sagemaker' 
| 'route53' 
| 'codebuild' 
| 'codedeploy' 
| 'codepipeline' 
| 'kinesis' 
| 'opensearch' 
| 'dms' 
| 'ecr' 
| 'ecs' 
| 'eks' 
| 'apigateway' 
| 'appmesh' 
| 'cloudfront' 
| 'glue' 
| 'gamelift' 
| 'chatbot' 
| 'directconnect' 
| 'vpc' 
| 'memorydb' 
| 'guardduty' 
| 'wafv2' 
| 'shield' 
| 'athena' 
| 'firehose' 
| 'emr' 
| 'msk' 
| 'connect' 
| 'pinpoint' 
| 'ses' 
| 'iot' 
| 'backupplan' 
| 'efs' 
| 'amazonmq' 
| 'sqs' 
| 'kafka' 
| 'stepfunctions' 
| 'appstream' 
| 'workspaces' 
| 'batchjobqueue' 
| 'elasticbeanstalkapplication' 
| 'lambdafunction' 
| 'docdb' 
| 'dynamodb' 
| 'elastiCache' 
| 'redshift';

