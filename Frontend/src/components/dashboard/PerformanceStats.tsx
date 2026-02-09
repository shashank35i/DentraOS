import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
interface PerformanceStat {
  id: number;
  name: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease';
}
export const PerformanceStats: React.FC = () => {
  // Sample data
  const stats: PerformanceStat[] = [{
    id: 1,
    name: 'Patient Satisfaction',
    value: '92%',
    change: 3,
    changeType: 'increase'
  }, {
    id: 2,
    name: 'Treatment Completion Rate',
    value: '87%',
    change: 5,
    changeType: 'increase'
  }, {
    id: 3,
    name: 'Appointment Utilization',
    value: '94%',
    change: 2,
    changeType: 'increase'
  }, {
    id: 4,
    name: 'Cancellation Rate',
    value: '8%',
    change: 1,
    changeType: 'decrease'
  }];
  return <div className="space-y-4">
      {stats.map(stat => <div key={stat.id} className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.name}
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {stat.value}
            </p>
          </div>
          <div className={`flex items-center ${stat.changeType === 'increase'  'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {stat.changeType === 'increase'  <TrendingUpIcon size={16} className="mr-1" /> : <TrendingDownIcon size={16} className="mr-1" />}
            <span className="font-medium">{stat.change}%</span>
          </div>
        </div>)}
    </div>;
};