import React from 'react';
import { XIcon, CheckIcon } from 'lucide-react';
interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'appointment' | 'inventory' | 'system' | 'revenue';
}
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose
}) => {
  // Sample notifications data
  const notifications: Notification[] = [{
    id: 1,
    title: 'Appointment Reminder',
    message: 'Dr. Johnson has 5 appointments scheduled for today',
    time: '5 minutes ago',
    read: false,
    type: 'appointment'
  }, {
    id: 2,
    title: 'Inventory Alert',
    message: 'Dental composite is running low (15% remaining)',
    time: '30 minutes ago',
    read: false,
    type: 'inventory'
  }, {
    id: 3,
    title: 'Payment Received',
    message: 'Payment of $250 received from patient #1204',
    time: '1 hour ago',
    read: true,
    type: 'revenue'
  }, {
    id: 4,
    title: 'System Update',
    message: 'System maintenance scheduled for tonight at 2 AM',
    time: '3 hours ago',
    read: true,
    type: 'system'
  }];
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'appointment':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300';
      case 'inventory':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'revenue':
        return 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300';
      case 'system':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  return <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold dark:text-white">Notifications</h2>
        <div className="flex items-center space-x-3">
          <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto h-full pb-20">
        {notifications.length === 0 ? <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No notifications
          </div> : <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {notifications.map(notification => <div key={notification.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                <div className="flex items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${getTypeColor(notification.type)}`}>
                    {notification.type === 'appointment' && <span className="text-sm font-bold">A</span>}
                    {notification.type === 'inventory' && <span className="text-sm font-bold">I</span>}
                    {notification.type === 'revenue' && <span className="text-sm font-bold">R</span>}
                    {notification.type === 'system' && <span className="text-sm font-bold">S</span>}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {notification.time}
                    </p>
                  </div>
                  <button className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <CheckIcon size={16} />
                  </button>
                </div>
              </div>)}
          </div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
        <button className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          Mark all as read
        </button>
      </div>
    </div>;
};
