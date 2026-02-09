// src/layouts/MainLayout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MenuIcon } from 'lucide-react';

import { NotificationPanel } from '../components/navigation/NotificationPanel';
import { AgentAlertPanel } from '../components/navigation/AgentAlertPanel';
import { AIAssistantModal } from '../components/ai/AIAssistantModal';
import { AdminSidebar } from './admin/AdminSidebar';

export type AIAssistantContext =
  | 'appointments'
  | 'inventory'
  | 'revenue'
  | 'cases'
  | 'general';

export const MainLayout: React.FC = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAgentAlerts, setShowAgentAlerts] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiContext, setAIContext] = useState<AIAssistantContext>('general');

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const openAIAssistant = (context: AIAssistantContext = 'general') => {
    setAIContext(context);
    setShowAIAssistant(true);
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 transition-colors duration-150">
      {/* Admin sidebar (desktop rail + mobile drawer) */}
      <AdminSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar (ChatGPT-style) */}
        <header className="flex items-center justify-between px-3 py-2 lg:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/95 backdrop-blur">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Admin workspace
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet
            context={{
              openAIAssistant,
            }}
          />
        </main>
      </div>

      {/* Panels */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <AgentAlertPanel
        isOpen={showAgentAlerts}
        onClose={() => setShowAgentAlerts(false)}
        openAIAssistant={openAIAssistant}
      />

      <AIAssistantModal
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        context={aiContext}
      />
    </div>
  );
};
