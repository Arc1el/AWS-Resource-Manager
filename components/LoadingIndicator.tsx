import React from 'react';

const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-2">로딩 중...</span>
    </div>
  );
}

export default LoadingIndicator;