import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// CreatorStat 인터페이스 정의
interface CreatorStat {
  creator: string;
  totalResources: number;
  resourceTypes: number;
  details: Record<string, Array<{ name: string; id: string }>>;
}

interface CreatorStatsProps {
  creatorStats: CreatorStat[];
}

export default function CreatorStats({ creatorStats }: CreatorStatsProps) {
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);

  // 데이터 로깅
  console.log('creatorStats:', creatorStats);

  const chartData = creatorStats.length > 0 ? {
    labels: creatorStats.map((stat: CreatorStat) => stat.creator),
    datasets: [
      {
        label: '총 리소스',
        data: creatorStats.map((stat: CreatorStat) => stat.totalResources),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: '리소스 유형',
        data: creatorStats.map((stat: CreatorStat) => stat.resourceTypes),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
      },
    ],
  } : {
    labels: [],
    datasets: []
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '생성자별 리소스 통계',
      },
    },
    maintainAspectRatio: false, // 추가
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">생성자별 리소스 통계</h2>
      {creatorStats.length > 0 ? (
        <div style={{ height: '400px' }}> {/* 명시적 높이 설정 */}
          <Bar data={chartData} options={options} />
        </div>
      ) : (
        <p>데이터가 없습니다.</p>
      )}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">상세 정보</h3>
        {creatorStats.map((stat: CreatorStat) => (
          <div key={stat.creator} className="mb-4">
            <button
              onClick={() => setExpandedCreator(expandedCreator === stat.creator ? null : stat.creator)}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800"
            >
              {stat.creator} (총 {stat.totalResources}개 리소스, {stat.resourceTypes}개 유형)
            </button>
            {expandedCreator === stat.creator && (
              <div className="ml-4 mt-2">
                {Object.entries(stat.details).map(([resourceType, resources]) => (
                  <div key={resourceType} className="mb-2">
                    <p className="font-semibold">{resourceType}: {resources.length}개</p>
                    <ul className="list-disc list-inside ml-4">
                      {resources.map(resource => (
                        <li key={resource.id}>{resource.name} ({resource.id})</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
