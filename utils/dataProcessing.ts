import { Resource, ResourceType } from '../types';

// 문자열을 지정된 길이로 자르는 함수
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// 생성자 이름을 정제하고 길이를 제한하는 함수
export function cleanCreatorName(name: string, maxLength: number = 50): string {
  // ARN, IAM 역할, 사용자, STS 등의 불필요한 부분 제거
  let cleanedName = name
    .replace(/^arn:aws:(iam|sts)::\d+:/, '') // ARN 제거 (IAM 및 STS 포함)
    .replace(/^(user|role|assumed-role)\//, '') // IAM 사용자/역할 접두사 제거
    .replace(/\/.*$/, '') // 슬래시 이후의 모든 문자 제거 (세션 정보 등)
    .replace(/^.*?\\/, '') // 백슬래시 이전의 모든 문자 제거
    .replace(/@.*$/, ''); // @ 이후의 모든 문자 제거
  
  return cleanedName;
}

export function truncateName(name: string, maxLength: number = 50): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 3) + '...';
}

export function truncateId(id: string, maxLength: number = 30): string {
  if (id.length <= maxLength) return id;
  return id.slice(0, maxLength - 3) + '...';
}

export function groupResourcesByCreator(resources: Record<ResourceType, Resource[]>): Record<string, Record<ResourceType, Resource[]>> {
  const groupedResources: Record<string, Record<ResourceType, Resource[]>> = {};
  
  Object.entries(resources).forEach(([resourceType, resourceList]) => {
    resourceList.forEach(resource => {
      const cleanedCreator = cleanCreatorName(resource.creator || '알 수 없음', 50); // 여기서 50을 명시적으로 전달
      if (!groupedResources[cleanedCreator]) {
        groupedResources[cleanedCreator] = Object.fromEntries(
          Object.keys(resources).map(type => [type, []])
        ) as Record<string, Resource[]>;
      }
      groupedResources[cleanedCreator][resourceType as ResourceType].push(resource);
    });
  });

  return groupedResources;
}

export function getCreatorStats(groupedResources: Record<string, Record<ResourceType, Resource[]>>): Array<{
  creator: string;
  totalResources: number;
  resourceTypes: number;
  details: Record<string, Array<{ name: string; id: string }>>;
}> {
  return Object.entries(groupedResources).map(([creator, resources]) => {
    const totalResources = Object.values(resources).flat().length;
    const resourceTypes = Object.keys(resources).length;
    
    const details: Record<string, Array<{ name: string; id: string }>> = {};
    Object.entries(resources).forEach(([type, typeResources]) => {
      details[type] = typeResources.map(resource => ({
        name: truncateName(resource.name || resource.id, 30),
        id: truncateId(resource.id, 30)
      }));
    });

    return {
      creator,
      totalResources,
      resourceTypes,
      details
    };
  }).sort((a, b) => b.totalResources - a.totalResources);
}
