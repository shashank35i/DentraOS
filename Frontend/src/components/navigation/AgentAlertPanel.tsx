import React from 'react';
import { XIcon, CalendarIcon, PackageIcon, LineChartIcon, ClipboardListIcon, SparklesIcon } from 'lucide-react';
interface AgentAlertPanelProps {
  isOpen: boolean;
  onClose: () => void;
  openAIAssistant: (context: 'appointments' | 'inventory' | 'revenue' | 'cases' | 'general') => void;
}
interface AgentAlert {
  id: number;
  agentName: 'Appointments' | 'Inventory' | 'Revenue' | 'Case Tracking';
  message: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  context: 'appointments' | 'inventory' | 'revenue' | 'cases';
}
export const AgentAlertPanel: React.FC<AgentAlertPanelProps> = ({
  isOpen,
  onClose,
  openAIAssistant
}) => {
  // Sample agent alerts data
  const agentAlerts: AgentAlert[] = [{
    id: 1,
    agentName: 'Appointments',
    message: '3 patients are due for their 6-month checkups. Would you like to send automated reminders',
    time: 'Just now',
    priority: 'medium',
    actionable: true,
    context: 'appointments'
  }, {
    id: 2,
    agentName: 'Inventory',
    message: 'Based on usage patterns, you should order more dental impression material within 5 days.',
    time: '10 minutes ago',
    priority: 'high',
    actionable: true,
    context: 'inventory'
  }, {
    id: 3,
    agentName: 'Revenue',
    message: "This month's revenue is 12% higher than the same period last year. View detailed analysis",
    time: '1 hour ago',
    priority: 'low',
    actionable: true,
    context: 'revenue'
  }, {
    id: 4,
    agentName: 'Case Tracking',
    message: 'Patient #2145 treatment plan has been analyzed. AI suggests reviewing the crown procedure recommendation.',
    time: '2 hours ago',
    priority: 'medium',
    actionable: true,
    context: 'cases'
  }];
  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'Appointments':
        return <CalendarIcon size={18} />;
      case 'Inventory':
        return <PackageIcon size={18} />;
      case 'Revenue':
        return <LineChartIcon size={18} />;
      case 'Case Tracking':
        return <ClipboardListIcon size={18} />;
      default:
        return <div size={18} />;
    }
  };
  const getAgentColor = (agentName: string) => {
    switch (agentName) {
      case 'Appointments':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300';
      case 'Inventory':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'Revenue':
        return 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300';
      case 'Case Tracking':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  const handleTakeAction = (alert: AgentAlert) => {
    openAIAssistant(alert.context);
  };
  return <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold flex items-center dark:text-white">
          <SparklesIcon size={20} className="mr-2" />
          AI Agent Alerts
        </h2>
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={onClose}>
          <XIcon size={20} />
        </button>
      </div>
      <div className="overflow-y-auto h-full pb-20">
        {agentAlerts.length === 0 ? <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No agent alerts
          </div> : <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {agentAlerts.map(alert => <div key={alert.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${getAgentColor(alert.agentName)}`}>
                    {getAgentIcon(alert.agentName)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {alert.agentName} Agent
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityBadge(alert.priority)}`}>
                        {alert.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {alert.time}
                    </p>
                    {alert.actionable && <div className="mt-2 flex space-x-2">
                        <button onClick={() => handleTakeAction(alert)} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                          Take Action
                        </button>
                        <button className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                          Dismiss
                        </button>
                      </div>}
                  </div>
                </div>
              </div>)}
          </div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
        <button onClick={() => openAIAssistant('general')} className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center justify-center">
          <SparklesIcon size={16} className="mr-2" />
          Chat with AI Assistant
        </button>
      </div>
    </div>;
};
