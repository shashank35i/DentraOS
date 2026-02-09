import React, { useState } from 'react';
import { UserIcon, MailIcon, PhoneIcon, LockIcon, BellIcon, GlobeIcon, SaveIcon, CameraIcon } from 'lucide-react';
export const UserSettings: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Roberts',
    email: 'dr.roberts@dentalclinic.ai',
    phone: '(555) 123-4567',
    role: 'Dentist',
    specialization: 'General Dentistry',
    license: 'DDS-123456',
    language: 'en',
    timezone: 'America/New_York'
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    appointmentReminders: true,
    inventoryAlerts: true,
    revenueReports: false,
    agentSuggestions: true,
    systemUpdates: true
  });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleNotificationChange = (key: string) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }));
  };
  const handleSave = () => {
    console.log('Saving user settings:', formData, notifications);
    // Here you would typically save to an API
  };
  return <div className="space-y-6">
      {/* Profile Information */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <UserIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
            Profile Information
          </h2>
        </div>
        {/* Profile Picture */}
        <div className="flex items-center mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 text-2xl font-bold">
              {formData.firstName[0]}
              {formData.lastName[0]}
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
              <CameraIcon size={14} />
            </button>
          </div>
          <div className="ml-4">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Dr. {formData.firstName} {formData.lastName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formData.role}
            </p>
            <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-1">
              Change Photo
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="label">
              First Name
            </label>
            <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} className="input" />
          </div>
          <div>
            <label htmlFor="lastName" className="label">
              Last Name
            </label>
            <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <MailIcon size={18} />
              </span>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="input pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="label">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <PhoneIcon size={18} />
              </span>
              <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} className="input pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="role" className="label">
              Role
            </label>
            <select id="role" name="role" value={formData.role} onChange={handleInputChange} className="input">
              <option value="Dentist">Dentist</option>
              <option value="Hygienist">Dental Hygienist</option>
              <option value="Assistant">Dental Assistant</option>
              <option value="Manager">Practice Manager</option>
              <option value="Receptionist">Receptionist</option>
            </select>
          </div>
          <div>
            <label htmlFor="specialization" className="label">
              Specialization
            </label>
            <input type="text" id="specialization" name="specialization" value={formData.specialization} onChange={handleInputChange} className="input" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="license" className="label">
              License Number
            </label>
            <input type="text" id="license" name="license" value={formData.license} onChange={handleInputChange} className="input" />
          </div>
        </div>
      </div>
      {/* Security Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <LockIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Security
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="label">
              Current Password
            </label>
            <input type="password" id="currentPassword" className="input" placeholder="Enter current password" />
          </div>
          <div>
            <label htmlFor="newPassword" className="label">
              New Password
            </label>
            <input type="password" id="newPassword" className="input" placeholder="Enter new password" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">
              Confirm New Password
            </label>
            <input type="password" id="confirmPassword" className="input" placeholder="Confirm new password" />
          </div>
          <button className="px-4 py-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
            Change Password
          </button>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">
            Two-Factor Authentication
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Add an extra layer of security to your account by enabling
            two-factor authentication.
          </p>
          <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm">
            Enable 2FA
          </button>
        </div>
      </div>
      {/* Notification Preferences */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <BellIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Notification Preferences
        </h2>
        <div className="space-y-4">
          {Object.entries(notifications).map(([key, value]) => <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700 last:border-0">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {key === 'emailNotifications' && 'Receive email notifications for important updates'}
                  {key === 'appointmentReminders' && 'Get reminders about upcoming appointments'}
                  {key === 'inventoryAlerts' && 'Receive alerts when inventory is low'}
                  {key === 'revenueReports' && 'Get weekly revenue reports via email'}
                  {key === 'agentSuggestions' && 'Receive AI agent suggestions and recommendations'}
                  {key === 'systemUpdates' && 'Stay informed about system updates and maintenance'}
                </p>
              </div>
              <div className="relative inline-block w-12 h-6">
                <input type="checkbox" className="opacity-0 w-0 h-0" checked={value} onChange={() => handleNotificationChange(key)} />
                <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`} onClick={() => handleNotificationChange(key)}></span>
                <span className={`absolute cursor-pointer w-4 h-4 top-1 bg-white rounded-full transition-transform ${value ? 'transform translate-x-6' : 'translate-x-1'}`} onClick={() => handleNotificationChange(key)}></span>
              </div>
            </div>)}
        </div>
      </div>
      {/* Regional Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <GlobeIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Regional Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="language" className="label">
              Language
            </label>
            <select id="language" name="language" value={formData.language} onChange={handleInputChange} className="input">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
          <div>
            <label htmlFor="timezone" className="label">
              Timezone
            </label>
            <select id="timezone" name="timezone" value={formData.timezone} onChange={handleInputChange} className="input">
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>
        </div>
      </div>
      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm flex items-center">
          <SaveIcon size={18} className="mr-2" />
          Save Changes
        </button>
      </div>
    </div>;
};
