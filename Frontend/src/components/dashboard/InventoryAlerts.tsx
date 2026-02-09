import React from 'react';
import { AlertCircleIcon } from 'lucide-react';
interface InventoryAlert {
  id: number;
  item: string;
  category: string;
  remaining: number;
  threshold: number;
  priority: 'high' | 'medium' | 'low';
}
export const InventoryAlerts: React.FC = () => {
  // Sample data
  const alerts: InventoryAlert[] = [{
    id: 1,
    item: 'Dental Composite',
    category: 'Materials',
    remaining: 15,
    threshold: 20,
    priority: 'high'
  }, {
    id: 2,
    item: 'Disposable Gloves',
    category: 'Disposables',
    remaining: 25,
    threshold: 30,
    priority: 'medium'
  }, {
    id: 3,
    item: 'Dental Anesthetic',
    category: 'Medications',
    remaining: 18,
    threshold: 20,
    priority: 'low'
  }];
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  return <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        Low Stock Alerts
      </h3>
      {alerts.map(alert => <div key={alert.id} className="flex items-start p-3 border border-gray-100 dark:border-slate-700 rounded-lg">
          <AlertCircleIcon size={18} className={`mt-0.5 mr-3 ${getPriorityColor(alert.priority)}`} />
          <div className="flex-1">
            <div className="flex justify-between">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {alert.item}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {alert.remaining}% left
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Category: {alert.category} • Threshold: {alert.threshold}%
            </p>
          </div>
        </div>)}
      <button className="w-full mt-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex justify-center">
        Order Supplies
      </button>
    </div>;
};