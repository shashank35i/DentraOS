import React, { useEffect, useState, useRef } from 'react';
import { XIcon, SendIcon, SparklesIcon, CalendarIcon, PackageIcon, LineChartIcon, ClipboardListIcon, UserIcon } from 'lucide-react';
interface Message {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context: string;
}
interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'appointments' | 'inventory' | 'revenue' | 'cases' | 'general';
}
export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  context = 'general'
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current.scrollIntoView({
      behavior: 'smooth'
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add initial greeting based on context
      const greetingMessage = getContextualGreeting(context);
      setMessages([{
        id: 1,
        type: 'assistant',
        content: greetingMessage,
        timestamp: new Date(),
        context
      }]);
    }
  }, [isOpen, context]);
  const getContextualGreeting = (ctx: string) => {
    switch (ctx) {
      case 'appointments':
        return "Hello! I'm your AI Appointments Assistant. I can help you with scheduling, managing appointments, sending reminders, and optimizing your calendar. What would you like to know";
      case 'inventory':
        return "Hi! I'm your AI Inventory Assistant. I can help you track supplies, predict usage patterns, suggest optimal order quantities, and manage stock levels. How can I assist you";
      case 'revenue':
        return "Hello! I'm your AI Revenue Assistant. I can analyze financial data, identify trends, forecast revenue, and provide insights to maximize profitability. What would you like to explore";
      case 'cases':
        return "Hi! I'm your AI Case Tracking Assistant. I can help monitor patient treatments, suggest treatment plans, track progress, and analyze outcomes. How can I help";
      default:
        return "Hello! I'm your AI Assistant. I can help you with appointments, inventory, revenue analytics, case tracking, and general clinic management. What would you like assistance with";
    }
  };
  const getContextIcon = (ctx: string) => {
    switch (ctx) {
      case 'appointments':
        return <CalendarIcon size={20} />;
      case 'inventory':
        return <PackageIcon size={20} />;
      case 'revenue':
        return <LineChartIcon size={20} />;
      case 'cases':
        return <ClipboardListIcon size={20} />;
      default:
        return <SparklesIcon size={20} />;
    }
  };
  const getContextColor = (ctx: string) => {
    switch (ctx) {
      case 'appointments':
        return 'from-blue-500 to-blue-600';
      case 'inventory':
        return 'from-yellow-500 to-yellow-600';
      case 'revenue':
        return 'from-green-500 to-green-600';
      case 'cases':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateContextualResponse(inputValue, context);
      const assistantMessage: Message = {
        id: messages.length + 2,
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        context
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };
  const generateContextualResponse = (input: string, ctx: string) => {
    const lowerInput = input.toLowerCase();
    // Appointments context
    if (ctx === 'appointments') {
      if (lowerInput.includes('schedule') || lowerInput.includes('book')) {
        return 'I can help you schedule an appointment. Based on your current calendar, I have availability tomorrow at 10:00 AM, 2:00 PM, and 4:30 PM. Would you like me to book one of these slots';
      }
      if (lowerInput.includes('reminder') || lowerInput.includes('notify')) {
        return "I've analyzed your appointment patterns and found 3 patients who are due for their 6-month checkups. Would you like me to send automated reminders to them";
      }
      if (lowerInput.includes('cancel') || lowerInput.includes('reschedule')) {
        return 'I can help with that. Which appointment would you like to modify I can also check if there are patients on the waitlist who could fill a cancelled slot.';
      }
      return 'I can help you with scheduling appointments, sending reminders, managing cancellations, and optimizing your calendar. What specific task would you like assistance with';
    }
    // Inventory context
    if (ctx === 'inventory') {
      if (lowerInput.includes('order') || lowerInput.includes('buy')) {
        return 'Based on your current usage patterns, I recommend ordering: Dental Composite (2 units), Disposable Gloves (5 boxes), and Dental Anesthetic (3 bottles). This should last approximately 3 weeks. Would you like me to generate a purchase order';
      }
      if (lowerInput.includes('low') || lowerInput.includes('stock')) {
        return 'You currently have 3 items below the low stock threshold: Dental Composite (15% remaining), Disposable Gloves (25% remaining), and Dental Anesthetic (18% remaining). I suggest ordering within the next 5 days.';
      }
      if (lowerInput.includes('predict') || lowerInput.includes('usage')) {
        return "Based on the last 3 months, your average monthly usage is: Dental Composite (8 units), Disposable Gloves (15 boxes), Dental Anesthetic (6 bottles). I predict you'll need to reorder in approximately 12 days.";
      }
      return 'I can help you track supplies, predict usage patterns, generate purchase orders, and manage stock levels. What would you like to know about your inventory';
    }
    // Revenue context
    if (ctx === 'revenue') {
      if (lowerInput.includes('report') || lowerInput.includes('summary')) {
        return "This month's revenue is $45,200, which is 12% higher than last month. Your top revenue sources are: Root Canals (32%), Crowns (28%), and Cleanings (20%). Would you like a detailed breakdown";
      }
      if (lowerInput.includes('forecast') || lowerInput.includes('predict')) {
        return "Based on current trends and historical data, I forecast next month's revenue to be approximately $48,500 (±$2,000). This assumes similar appointment volume and treatment mix. Key factors: seasonal patterns and upcoming holidays.";
      }
      if (lowerInput.includes('improve') || lowerInput.includes('increase')) {
        return "I've identified 3 opportunities to increase revenue: 1) Fill 8 empty appointment slots this week (potential +$3,200), 2) Follow up with 5 patients who have pending treatment plans (potential +$6,500), 3) Optimize pricing for teeth whitening services based on market analysis.";
      }
      return 'I can analyze your financial data, create revenue reports, forecast future earnings, and suggest optimization strategies. What would you like to explore';
    }
    // Cases context
    if (ctx === 'cases') {
      if (lowerInput.includes('treatment') || lowerInput.includes('plan')) {
        return "I've analyzed Patient #2145's case. Based on their dental history and current condition, I recommend: 1) Crown placement for tooth #14, 2) Follow-up X-rays in 6 months, 3) Consider orthodontic consultation for alignment issues. Would you like detailed reasoning for each recommendation";
      }
      if (lowerInput.includes('progress') || lowerInput.includes('tracking')) {
        return 'Currently tracking 28 active cases. 5 are progressing ahead of schedule, 20 are on track, and 3 require attention (Patient #1089 reported persistent pain, Patient #1156 missed last appointment, Patient #2001 needs follow-up X-rays).';
      }
      if (lowerInput.includes('outcome') || lowerInput.includes('success')) {
        return 'Your treatment success rate is 94% over the last 6 months. Root canals have a 96% success rate, crowns 98%, and implants 92%. The 3 cases requiring attention are within normal variation. Overall, your outcomes are excellent.';
      }
      return 'I can help monitor patient treatments, suggest treatment plans, track progress, analyze outcomes, and identify cases needing attention. What would you like to know';
    }
    // General responses
    if (lowerInput.includes('help') || lowerInput.includes('what can you')) {
      return 'I can assist with: \n• Appointments: Scheduling, reminders, calendar optimization\n• Inventory: Stock tracking, predictive ordering, usage analysis\n• Revenue: Financial analytics, forecasting, optimization\n• Cases: Treatment monitoring, suggestions, outcome analysis\n\nWhat would you like help with';
    }
    return "I understand you're asking about: " + input + ". Could you provide more details so I can give you a more specific answer I'm here to help with appointments, inventory, revenue, and case tracking.";
  };
  const quickActions = [{
    label: "Show today's appointments",
    icon: <CalendarIcon size={14} />
  }, {
    label: 'Check inventory alerts',
    icon: <PackageIcon size={14} />
  }, {
    label: 'View revenue summary',
    icon: <LineChartIcon size={14} />
  }, {
    label: 'Review pending cases',
    icon: <ClipboardListIcon size={14} />
  }];
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl transform transition-all w-full max-w-3xl relative z-10 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className={`bg-gradient-to-r ${getContextColor(context)} text-white p-6 rounded-t-xl`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-4">
                  {getContextIcon(context)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">AI Assistant</h3>
                  <p className="text-sm opacity-90">
                    {context === 'general' ? 'General Support' : `${context.charAt(0).toUpperCase() + context.slice(1)} Support`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors">
                <XIcon size={20} />
              </button>
            </div>
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{
          maxHeight: '50vh'
        }}>
            {messages.map(message => <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 ml-3' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white mr-3'}`}>
                    {message.type === 'user' ? <UserIcon size={16} /> : <SparklesIcon size={16} />}
                  </div>
                  <div>
                    <div className={`px-4 py-3 rounded-lg ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white'}`}>
                      <p className="text-sm whitespace-pre-line">
                        {message.content}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                      {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                    </p>
                  </div>
                </div>
              </div>)}
            {isTyping && <div className="flex justify-start">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white mr-3">
                    <SparklesIcon size={16} />
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-700">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{
                    animationDelay: '0.2s'
                  }}></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{
                    animationDelay: '0.4s'
                  }}></div>
                    </div>
                  </div>
                </div>
              </div>}
            <div ref={messagesEndRef} />
          </div>
          {/* Quick Actions */}
          {messages.length <= 1 && <div className="px-6 pb-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Quick Actions:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, index) => <button key={index} onClick={() => setInputValue(action.label)} className="p-2 text-left text-sm bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center">
                    <span className="mr-2 text-gray-500 dark:text-gray-400">
                      {action.icon}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {action.label}
                    </span>
                  </button>)}
              </div>
            </div>}
          {/* Input */}
          <div className="p-6 border-t border-gray-200 dark:border-slate-700">
            <div className="flex space-x-3">
              <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask me anything..." className="flex-1 px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
              <button onClick={handleSendMessage} disabled={!inputValue.trim()} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                <SendIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>;
};