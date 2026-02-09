import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { UserIcon, BuildingIcon, SettingsIcon } from 'lucide-react';
export const SettingsLayout: React.FC = () => {
  const settingsNav = [{
    name: 'User Settings',
    path: '/app/settings/user',
    icon: <UserIcon size={20} />,
    description: 'Manage your personal profile and preferences'
  }, {
    name: 'Clinic Settings',
    path: '/app/settings/clinic',
    icon: <BuildingIcon size={20} />,
    description: 'Configure clinic information and operations'
  }, {
    name: 'AI Agent Settings',
    path: '/app/settings/agent',
    icon: <SettingsIcon size={20} />,
    description: 'Customize AI agent behavior and features'
  }, {
    name: 'Theme Settings',
    path: '/app/settings/theme',
    icon: <SettingsIcon size={20} />,
    description: 'Personalize the application appearance'
  }];
  return <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <SettingsIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Manage your account, clinic, and application preferences
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <nav className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-4">
            <ul className="space-y-2">
              {settingsNav.map(item => <li key={item.path}>
                  <NavLink to={item.path} className={({ 
                isActive
              }) => `flex items-start p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700/50'}`}>
                    <span className="mr-3 mt-0.5">{item.icon}</span>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </NavLink>
                </li>)}
            </ul>
          </nav>
        </div>
        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Outlet />
        </div>
      </div>
    </div>;
};
