import React from 'react';
import { CalendarIcon, PackageIcon, LineChartIcon, ClipboardListIcon, SparklesIcon } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
interface AgentSuggestion {
  id: number;
  agentType: 'appointment' | 'inventory' | 'revenue' | 'case';
  message: string;
  time: string;
  actionable: boolean;
  context: 'appointments' | 'inventory' | 'revenue' | 'cases';
}
interface OutletContext {
  openAIAssistant: (context: 'appointments' | 'inventory' | 'revenue' | 'cases' | 'general') => void;
}
export const AgentSuggestions: React.FC = () => {
  const {
    openAIAssistant
  } = useOutletContext<OutletContext>();
  // Sample data
  const suggestions: AgentSuggestion[] = [{
    id: 1,
    agentType: 'appointment',
    message: '3 patients are due for their 6-month checkups. Send reminders',
    time: 'Just now',
    actionable: true,
    context: 'appointments'
  }, {
    id: 2,
    agentType: 'inventory',
    message: 'Dental impression material needs to be ordered within 5 days.',
    time: '10 min ago',
    actionable: true,
    context: 'inventory'
  }, {
    id: 3,
    agentType: 'revenue',
    message: "This month's revenue is 12% higher than the same period last year.",
    time: '1 hour ago',
    actionable: false,
    context: 'revenue'
  }];
  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return <CalendarIcon size={16} />;
      case 'inventory':
        return <PackageIcon size={16} />;
      case 'revenue':
        return <LineChartIcon size={16} />;
      case 'case':
        return <ClipboardListIcon size={16} />;
      default:
        return <div size={16} />;
    }
  };
  const getAgentColor = (type: string) => {
    switch (type) {
      case 'appointment':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
      case 'inventory':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'revenue':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300';
      case 'case':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300';
    }
  };
  const handleTakeAction = (suggestion: AgentSuggestion) => {
    openAIAssistant(suggestion.context);
  };
  return <div className="space-y-4">
      {suggestions.map(suggestion => <div key={suggestion.id} className="p-4 border border-gray-100 dark:border-slate-700 rounded-lg">
          <div className="flex items-start">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${getAgentColor(suggestion.agentType)}`}>
              {getAgentIcon(suggestion.agentType)}
            </div>
            <div className="flex-1">
              <p className="text-gray-800 dark:text-gray-200">
                {suggestion.message}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {suggestion.time}
              </p>
              {suggestion.actionable && <div className="mt-3 flex space-x-2">
                  <button onClick={() => handleTakeAction(suggestion)} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    Take Action
                  </button>
                  <button className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                    Dismiss
                  </button>
                </div>}
            </div>
          </div>
        </div>)}
      <div className="flex items-center justify-center mt-4">
        <button onClick={() => openAIAssistant('general')} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          <SparklesIcon size={16} className="mr-2" />
          Chat with AI Assistant
        </button>
      </div>
    </div>;
};