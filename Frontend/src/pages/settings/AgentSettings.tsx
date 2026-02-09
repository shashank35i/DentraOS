import React, { useState } from 'react';
import { CalendarIcon, PackageIcon, LineChartIcon, ClipboardListIcon, ToggleLeftIcon, ToggleRightIcon, SaveIcon, AlertCircleIcon } from 'lucide-react';
export const AgentSettings: React.FC = () => {
  const [agents, setAgents] = useState({
    appointments: {
      enabled: true,
      autoReminders: true,
      reminderHours: 24,
      autoScheduling: false,
      conflictDetection: true,
      waitlistManagement: true
    },
    inventory: {
      enabled: true,
      autoReorder: false,
      lowStockThreshold: 20,
      criticalStockThreshold: 10,
      predictiveOrdering: true,
      supplierIntegration: false
    },
    revenue: {
      enabled: true,
      weeklyReports: true,
      monthlyReports: true,
      anomalyDetection: true,
      forecastAccuracy: 'medium',
      paymentReminders: true
    },
    caseTracking: {
      enabled: true,
      treatmentSuggestions: true,
      progressTracking: true,
      outcomeAnalysis: true,
      riskAssessment: false,
      followUpReminders: true
    }
  });
  const handleToggle = (agent: string, setting: string) => {
    setAgents(prev => ({
      ...prev,
      [agent]: {
        ...prev[agent as keyof typeof prev],
        [setting]: !prev[agent as keyof typeof prev][setting as keyof (typeof prev)[keyof typeof prev]]
      }
    }));
  };
  const handleValueChange = (agent: string, setting: string, value: string | number) => {
    setAgents(prev => ({
      ...prev,
      [agent]: {
        ...prev[agent as keyof typeof prev],
        [setting]: value
      }
    }));
  };
  const handleSave = () => {
    console.log('Saving agent settings:', agents);
  };
  return <div className="space-y-6">
      {/* Overview */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md p-6">
        <div className="flex items-center mb-4">
          <div size={24} className="mr-3" />
          <h2 className="text-xl font-semibold">AI Agent Configuration</h2>
        </div>
        <p className="opacity-90">
          Customize how your AI agents operate to best suit your clinic's
          workflow. Enable or disable features, set thresholds, and configure
          automation preferences.
        </p>
      </div>
      {/* Appointments Agent */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Appointments Agent
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Intelligent scheduling and appointment management
              </p>
            </div>
          </div>
          <div className="relative inline-block w-12 h-6">
            <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.appointments.enabled} onChange={() => handleToggle('appointments', 'enabled')} />
            <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.appointments.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`} onClick={() => handleToggle('appointments', 'enabled')}></span>
            <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.appointments.enabled ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => handleToggle('appointments', 'enabled')}></span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Auto Reminders
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically send appointment reminders to patients
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.appointments.autoReminders} onChange={() => handleToggle('appointments', 'autoReminders')} disabled={!agents.appointments.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.appointments.autoReminders && agents.appointments.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.appointments.enabled ? 'opacity-50' : ''}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'autoReminders')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.appointments.autoReminders ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'autoReminders')}></span>
            </div>
          </div>
          {agents.appointments.autoReminders && <div className="ml-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <label className="label">Reminder Time (hours before)</label>
              <input type="number" value={agents.appointments.reminderHours} onChange={e => handleValueChange('appointments', 'reminderHours', parseInt(e.target.value))} className="input w-32" min="1" max="168" disabled={!agents.appointments.enabled} />
            </div>}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Conflict Detection
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Detect and prevent scheduling conflicts
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.appointments.conflictDetection} onChange={() => handleToggle('appointments', 'conflictDetection')} disabled={!agents.appointments.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.appointments.conflictDetection && agents.appointments.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.appointments.enabled ? 'opacity-50' : ''}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'conflictDetection')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.appointments.conflictDetection ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'conflictDetection')}></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Waitlist Management
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage patient waitlists and fill cancellations
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.appointments.waitlistManagement} onChange={() => handleToggle('appointments', 'waitlistManagement')} disabled={!agents.appointments.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.appointments.waitlistManagement && agents.appointments.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.appointments.enabled ? 'opacity-50' : ''}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'waitlistManagement')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.appointments.waitlistManagement ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.appointments.enabled && handleToggle('appointments', 'waitlistManagement')}></span>
            </div>
          </div>
        </div>
      </div>
      {/* Inventory Agent */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-300 mr-4">
              <PackageIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Inventory Agent
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Smart inventory tracking and predictive ordering
              </p>
            </div>
          </div>
          <div className="relative inline-block w-12 h-6">
            <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.inventory.enabled} onChange={() => handleToggle('inventory', 'enabled')} />
            <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.inventory.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`} onClick={() => handleToggle('inventory', 'enabled')}></span>
            <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.inventory.enabled ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => handleToggle('inventory', 'enabled')}></span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Low Stock Threshold (%)</label>
            <input type="number" value={agents.inventory.lowStockThreshold} onChange={e => handleValueChange('inventory', 'lowStockThreshold', parseInt(e.target.value))} className="input w-32" min="0" max="100" disabled={!agents.inventory.enabled} />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Alert when stock falls below this percentage
            </p>
          </div>
          <div>
            <label className="label">Critical Stock Threshold (%)</label>
            <input type="number" value={agents.inventory.criticalStockThreshold} onChange={e => handleValueChange('inventory', 'criticalStockThreshold', parseInt(e.target.value))} className="input w-32" min="0" max="100" disabled={!agents.inventory.enabled} />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Send urgent alerts when stock is critically low
            </p>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Predictive Ordering
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use AI to predict and suggest optimal order quantities
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.inventory.predictiveOrdering} onChange={() => handleToggle('inventory', 'predictiveOrdering')} disabled={!agents.inventory.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.inventory.predictiveOrdering && agents.inventory.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.inventory.enabled ? 'opacity-50' : ''}`} onClick={() => agents.inventory.enabled && handleToggle('inventory', 'predictiveOrdering')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.inventory.predictiveOrdering ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.inventory.enabled && handleToggle('inventory', 'predictiveOrdering')}></span>
            </div>
          </div>
        </div>
      </div>
      {/* Revenue Agent */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 mr-4">
              <LineChartIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Revenue Agent
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Financial analytics and revenue optimization
              </p>
            </div>
          </div>
          <div className="relative inline-block w-12 h-6">
            <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.revenue.enabled} onChange={() => handleToggle('revenue', 'enabled')} />
            <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.revenue.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`} onClick={() => handleToggle('revenue', 'enabled')}></span>
            <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.revenue.enabled ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => handleToggle('revenue', 'enabled')}></span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Weekly Reports
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive automated weekly revenue summaries
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.revenue.weeklyReports} onChange={() => handleToggle('revenue', 'weeklyReports')} disabled={!agents.revenue.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.revenue.weeklyReports && agents.revenue.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.revenue.enabled ? 'opacity-50' : ''}`} onClick={() => agents.revenue.enabled && handleToggle('revenue', 'weeklyReports')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.revenue.weeklyReports ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.revenue.enabled && handleToggle('revenue', 'weeklyReports')}></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Anomaly Detection
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alert on unusual revenue patterns or discrepancies
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.revenue.anomalyDetection} onChange={() => handleToggle('revenue', 'anomalyDetection')} disabled={!agents.revenue.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.revenue.anomalyDetection && agents.revenue.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.revenue.enabled ? 'opacity-50' : ''}`} onClick={() => agents.revenue.enabled && handleToggle('revenue', 'anomalyDetection')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.revenue.anomalyDetection ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.revenue.enabled && handleToggle('revenue', 'anomalyDetection')}></span>
            </div>
          </div>
          <div>
            <label className="label">Forecast Accuracy Level</label>
            <select value={agents.revenue.forecastAccuracy} onChange={e => handleValueChange('revenue', 'forecastAccuracy', e.target.value)} className="input" disabled={!agents.revenue.enabled}>
              <option value="low">Low - Faster processing</option>
              <option value="medium">Medium - Balanced</option>
              <option value="high">High - Most accurate</option>
            </select>
          </div>
        </div>
      </div>
      {/* Case Tracking Agent */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-300 mr-4">
              <ClipboardListIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Case Tracking Agent
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Patient treatment monitoring and analysis
              </p>
            </div>
          </div>
          <div className="relative inline-block w-12 h-6">
            <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.caseTracking.enabled} onChange={() => handleToggle('caseTracking', 'enabled')} />
            <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.caseTracking.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`} onClick={() => handleToggle('caseTracking', 'enabled')}></span>
            <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.caseTracking.enabled ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => handleToggle('caseTracking', 'enabled')}></span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Treatment Suggestions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-powered treatment recommendations
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.caseTracking.treatmentSuggestions} onChange={() => handleToggle('caseTracking', 'treatmentSuggestions')} disabled={!agents.caseTracking.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.caseTracking.treatmentSuggestions && agents.caseTracking.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.caseTracking.enabled ? 'opacity-50' : ''}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'treatmentSuggestions')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.caseTracking.treatmentSuggestions ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'treatmentSuggestions')}></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Progress Tracking
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitor treatment progress and outcomes
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.caseTracking.progressTracking} onChange={() => handleToggle('caseTracking', 'progressTracking')} disabled={!agents.caseTracking.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.caseTracking.progressTracking && agents.caseTracking.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.caseTracking.enabled ? 'opacity-50' : ''}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'progressTracking')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.caseTracking.progressTracking ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'progressTracking')}></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Follow-up Reminders
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatic reminders for follow-up appointments
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" checked={agents.caseTracking.followUpReminders} onChange={() => handleToggle('caseTracking', 'followUpReminders')} disabled={!agents.caseTracking.enabled} />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${agents.caseTracking.followUpReminders && agents.caseTracking.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'} ${!agents.caseTracking.enabled ? 'opacity-50' : ''}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'followUpReminders')}></span>
              <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${agents.caseTracking.followUpReminders ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => agents.caseTracking.enabled && handleToggle('caseTracking', 'followUpReminders')}></span>
            </div>
          </div>
        </div>
      </div>
      {/* Warning Message */}
      <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-4">
        <div className="flex items-start">
          <AlertCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300">
              Important Note
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Changes to AI agent settings may affect automated workflows.
              Review your configuration carefully before saving. Some features
              may require additional setup or integration.
            </p>
          </div>
        </div>
      </div>
      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm flex items-center">
          <SaveIcon size={18} className="mr-2" />
          Save Agent Settings
        </button>
      </div>
    </div>;
};