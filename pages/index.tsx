import React, { useState, useEffect } from 'react';
import ResourceList from '../components/ResourceList';
import LoadingIndicator from '../components/LoadingIndicator';
import DateRangePicker from '../components/DateRangePicker';
import CreatorStats from '../components/CreatorStats';
import { groupResourcesByCreator, getCreatorStats, cleanCreatorName, truncateName, truncateId } from '../utils/dataProcessing';
import { DateRange, Resource, ResourceType } from '../types';

const resourceTypes: ResourceType[] = [
  'ec2', 'rds', 'apigateway',
  'sagemaker', 'route53', 'codebuild', 'codedeploy', 'codepipeline', 
  'kinesis', 'opensearch', 'dms', 'ecr', 'ecs', 'eks', 'appmesh', 
  'cloudfront', 'glue', 'gamelift', 'chatbot', 'directconnect', 'vpc', 'memorydb', 
  'guardduty', 'wafv2', 'shield', 'athena', 'firehose', 'emr', 'msk', 'connect', 
  'pinpoint', 'ses', 'iot', 'backupplan', 'efs', 'amazonmq', 'sqs',
  'stepfunctions', 'appstream', 'workspaces', 
  'elasticbeanstalkapplication', 'lambdafunction',
  'docdb', 'dynamodb', 'elastiCache', 'redshift'
];

interface ResourceState {
  data: Resource[] | null;
  isLoading: boolean;
  error: string | null;
}

export default function Home() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
    endDate: new Date()
  });

  const [resources, setResources] = useState<Record<ResourceType, ResourceState>>(() => 
    Object.fromEntries(resourceTypes.map(type => [type, { data: null, isLoading: false, error: null }])) as Record<ResourceType, ResourceState>
  );

  const [creatorStats, setCreatorStats] = useState<Array<{
    creator: string;
    totalResources: number;
    resourceTypes: number;
    details: Record<string, Array<{ name: string; id: string }>>;
  }>>([]);

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange);
  };

  const fetchResourcesForService = async (service: ResourceType) => {
    setResources(prev => ({
      ...prev,
      [service]: { ...prev[service], isLoading: true, error: null }
    }));

    try {
      const response = await fetch(`/api/get-resources?service=${service}&startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`);
      if (!response.ok) {
        throw new Error(`${service} 리소스 가져오기 실패`);
      }
      const data = await response.json();
      setResources(prev => ({
        ...prev,
        [service]: { data: data[service], isLoading: false, error: null }
      }));
    } catch (error) {
      console.error(`${service} 리소스 가져오기 오류:`, error);
      setResources(prev => ({
        ...prev,
        [service]: { 
          ...prev[service], 
          isLoading: false, 
          error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
        }
      }));
    }
  };

  const fetchResources = async () => {
    for (const service of resourceTypes) {
      await fetchResourcesForService(service);
    }

    const allResources = Object.fromEntries(
      Object.entries(resources).map(([key, value]) => [key, value.data || []])
    ) as Record<ResourceType, Resource[]>;

    const groupedResources = groupResourcesByCreator(allResources);
    const stats = getCreatorStats(groupedResources);
    setCreatorStats(stats);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-apple">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">AWS 리소스 관리자</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <DateRangePicker 
          dateRange={dateRange} 
          onDateRangeChange={handleDateRangeChange} 
          onFetchResources={fetchResources}
        />
        {resourceTypes.map(type => (
          <div key={type} className="card mb-6">
            <h2 className="text-xl font-bold mb-4">
              {type.toUpperCase()} 리소스 ({resources[type].data?.length || 0})
            </h2>
            {resources[type].isLoading ? (
              <LoadingIndicator />
            ) : resources[type].error ? (
              <p className="text-red-500">{resources[type].error}</p>
            ) : (
              <ResourceList 
                resources={resources[type].data?.map(resource => ({
                  ...resource,
                  name: truncateName(resource.name, 15),
                  id: truncateId(resource.id, 20),
                  creator: cleanCreatorName(resource.creator || '알 수 없음', 15)
                })) || []}
                onDelete={async (type: ResourceType, id: string) => {
                  console.log(`Deleting resource of type ${type} with id ${id}`);
                }}
                title={`${type.toUpperCase()} 리소스`} 
                type={type as ResourceType} 
              />
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
