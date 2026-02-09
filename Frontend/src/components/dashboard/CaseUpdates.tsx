import React from 'react';
import { UserIcon, CheckCircleIcon, AlertCircleIcon, ClockIcon } from 'lucide-react';
interface CaseUpdate {
  id: number;
  patientName: string;
  patientId: string;
  treatment: string;
  status: 'completed' | 'in-progress' | 'requires-attention';
  updateMessage: string;
  timestamp: string;
}
export const CaseUpdates: React.FC = () => {
  // Sample data
  const updates: CaseUpdate[] = [{
    id: 1,
    patientName: 'James Wilson',
    patientId: 'PT-1204',
    treatment: 'Dental Implant',
    status: 'completed',
    updateMessage: 'Final implant placement successful. Follow-up scheduled in 2 weeks.',
    timestamp: 'Today, 2:30 PM'
  }, {
    id: 2,
    patientName: 'Olivia Martinez',
    patientId: 'PT-1156',
    treatment: 'Orthodontic Treatment',
    status: 'in-progress',
    updateMessage: 'Braces adjusted. Progress is on track with treatment plan.',
    timestamp: 'Today, 11:15 AM'
  }, {
    id: 3,
    patientName: 'Ethan Brown',
    patientId: 'PT-1089',
    treatment: 'Root Canal',
    status: 'requires-attention',
    updateMessage: 'Patient reported persistent pain. Requires immediate follow-up.',
    timestamp: 'Yesterday, 4:45 PM'
  }];
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'in-progress':
        return <ClockIcon size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'requires-attention':
        return <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'requires-attention':
        return 'Requires Attention';
      default:
        return status;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'in-progress':
        return 'text-blue-600 dark:text-blue-400';
      case 'requires-attention':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  return <div className="space-y-6">
      {updates.map(update => <div key={update.id} className="border-b border-gray-100 dark:border-slate-700 pb-6 last:border-0 last:pb-0">
          <div className="flex items-start">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
              <UserIcon size={20} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {update.patientName}
                </h3>
                <div className={`flex items-center ${getStatusColor(update.status)}`}>
                  {getStatusIcon(update.status)}
                  <span className="text-xs font-medium ml-1">
                    {getStatusText(update.status)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ID: {update.patientId} • Treatment: {update.treatment}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                {update.updateMessage}
              </p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {update.timestamp}
                </span>
                <button className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  View Case
                </button>
              </div>
            </div>
          </div>
        </div>)}
    </div>;
};