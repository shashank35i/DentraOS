import React from 'react';
import { SunIcon, MoonIcon, CheckIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
export const ThemeSettings: React.FC = () => {
  const {
    darkMode,
    toggleDarkMode
  } = useTheme();
  return <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Mode */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Theme Mode
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 border rounded-lg cursor-pointer transition-all ${!darkMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`} onClick={() => darkMode && toggleDarkMode()}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <SunIcon size={20} />
                </div>
                {!darkMode && <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <CheckIcon size={16} />
                  </div>}
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Light Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Bright theme with light backgrounds
              </p>
            </div>
            <div className={`p-4 border rounded-lg cursor-pointer transition-all ${darkMode ? 'border-blue-500 bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`} onClick={() => !darkMode && toggleDarkMode()}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <MoonIcon size={20} />
                </div>
                {darkMode && <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <CheckIcon size={16} />
                  </div>}
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Dark Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Dark theme with reduced brightness
              </p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <label htmlFor="theme-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Toggle Dark Mode
              </label>
              <div className="relative inline-block w-12 h-6">
                <input id="theme-toggle" type="checkbox" className="opacity-0 w-0 h-0" checked={darkMode} onChange={toggleDarkMode} />
                <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}></span>
                <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${darkMode ? 'transform translate-x-6' : 'translate-x-1'}`}></span>
              </div>
            </div>
          </div>
        </div>
        {/* Theme Preview */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preview
          </h2>
          <div className={`border rounded-lg overflow-hidden ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className={`p-3 ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-6 h-6 rounded-md ${darkMode ? 'bg-slate-800' : 'bg-white'} flex items-center justify-center mr-2`}>
                    <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                  </div>
                  <div className={`h-3 w-24 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                </div>
                <div className="flex space-x-1">
                  <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                </div>
              </div>
            </div>
            <div className={`p-4 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex space-x-4 mb-4">
                <div className={`w-10 h-10 rounded-md ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}></div>
                <div className="flex-1 space-y-2">
                  <div className={`h-3 w-3/4 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                  <div className={`h-3 w-1/2 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className={`h-3 w-full rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                <div className={`h-3 w-full rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                <div className={`h-3 w-2/3 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
              </div>
              <div className="flex justify-end space-x-2">
                <div className={`h-6 w-16 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                <div className="h-6 w-16 rounded bg-blue-500"></div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            This is a preview of how the application will look in{' '}
            {darkMode ? 'dark' : 'light'} mode.
          </div>
        </div>
      </div>
      {/* Additional Theme Options */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Additional Options
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Auto Theme Switching
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically switch theme based on system preferences
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" />
              <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors bg-gray-300 dark:bg-slate-600"></span>
              <span className="absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform translate-x-1"></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Reduce Animations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Minimize motion effects for better performance
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" />
              <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors bg-gray-300 dark:bg-slate-600"></span>
              <span className="absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform translate-x-1"></span>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                High Contrast Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Increase contrast for better visibility
              </p>
            </div>
            <div className="relative inline-block w-12 h-6">
              <input type="checkbox" className="opacity-0 w-0 h-0" />
              <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors bg-gray-300 dark:bg-slate-600"></span>
              <span className="absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform translate-x-1"></span>
            </div>
          </div>
        </div>
      </div>
    </div>;
};