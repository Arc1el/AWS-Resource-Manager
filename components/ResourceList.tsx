import React, { useState } from 'react';
import { Resource, ResourceType } from '../types';

interface ResourceListProps {
  resources: Resource[];
  onDelete: (type: ResourceType, id: string) => Promise<any>;
  title: string;
  type: ResourceType;
}

interface SelectedResources {
  [key: string]: boolean;
}

interface ResourceToDelete {
  type: ResourceType;
  id: string;
  name: string;
  command: string;
}

export default function ResourceList({ resources, onDelete, title, type }: ResourceListProps) {
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({});
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [resourcestoDelete, setResourcesToDelete] = useState<ResourceToDelete[]>([]);
  const [deleteResponse, setDeleteResponse] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const renderResourceTable = (resources: Resource[]) => {
    console.log("렌더링할 리소스:", resources);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-xl overflow-hidden shadow-apple">
          <thead className="bg-gray-50">
            <tr>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                선택
              </th> */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                생성 시간
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                생성자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resources.map((resource) => (
              <tr key={resource.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resource.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{resource.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resource.creationTime}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resource.creator}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    resource.state === '삭제됨' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {resource.state}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleDelete(resource.id, resource.name)}
                    className="text-red-600 hover:text-red-900 transition-colors duration-150 ease-in-out"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleDelete = (id: string, name: string) => {
    const command = `terminateEC2Instance("${id}")`;
    setResourcesToDelete([{ type, id, name, command }]);
    setShowConfirmModal(true);
    setDeleteResponse(null);
  };

  const deleteResource = async (resourceType: string, resourceId: string) => {
    try {
      const response = await fetch('/api/delete-resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceType, resourceId }),
      });

      if (!response.ok) {
        throw new Error('리소스 삭제 요청 실패');
      }

      const result = await response.json();
      console.log('리소스 삭제 결과:', result);
      return result;
    } catch (error) {
      console.error('리소스 삭제 오류:', error);
      throw error;
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const responses = await Promise.all(
        resourcestoDelete.map(async (resource) => {
          const response = await deleteResource(resource.type, resource.id);
          return { id: resource.id, ...response };
        })
      );
      setDeleteResponse(responses);
    } catch (error) {
      setDeleteResponse([{ 
        success: false, 
        message: '삭제 중 오류가 발생했습니다.', 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      }]);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setResourcesToDelete([]);
    setDeleteResponse(null);
  };

  return (
    <div className="container mx-auto px-4">
      {renderResourceTable(resources)}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-[40rem] shadow-lg rounded-xl bg-white">
            <h3 className="text-lg font-bold mb-4">다음 리소스를 삭제하시겠습니까?</h3>
            <ul className="mb-4">
              {resourcestoDelete.map(resource => (
                <li key={resource.id}>
                  <p>{resource.type}: {resource.id} ({resource.name})</p>
                  <p className="text-sm text-gray-600">실행될 명령: {resource.command}</p>
                </li>
              ))}
            </ul>
            {deleteResponse && (
              <div className="mb-4">
                <h4 className="font-bold">삭제 결과:</h4>
                <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(deleteResponse, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex justify-end">
              {!deleteResponse && (
                <>
                  <button
                    onClick={confirmDelete}
                    className="btn btn-primary mr-2"
                    disabled={isDeleting}
                  >
                    {isDeleting ? '삭제 중...' : '확인'}
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="btn btn-secondary"
                    disabled={isDeleting}
                  >
                    취소
                  </button>
                </>
              )}
              {deleteResponse && (
                <button
                  onClick={cancelDelete}
                  className="btn btn-secondary"
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
