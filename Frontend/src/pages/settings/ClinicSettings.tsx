import React, { useState } from 'react';
import { BuildingIcon, MapPinIcon, PhoneIcon, MailIcon, ClockIcon, DollarSignIcon, UsersIcon, SaveIcon } from 'lucide-react';
export const ClinicSettings: React.FC = () => {
  const [clinicData, setClinicData] = useState({
    name: 'Bright Smiles Dental Clinic',
    address: '123 Main Street',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    phone: '(555) 987-6543',
    email: 'info@brightsmilesdental.com',
    website: 'www.brightsmilesdental.com',
    taxId: '12-3456789'
  });
  const [operatingHours, setOperatingHours] = useState([{
    day: 'Monday',
    open: '09:00',
    close: '17:00',
    closed: false
  }, {
    day: 'Tuesday',
    open: '09:00',
    close: '17:00',
    closed: false
  }, {
    day: 'Wednesday',
    open: '09:00',
    close: '17:00',
    closed: false
  }, {
    day: 'Thursday',
    open: '09:00',
    close: '17:00',
    closed: false
  }, {
    day: 'Friday',
    open: '09:00',
    close: '17:00',
    closed: false
  }, {
    day: 'Saturday',
    open: '10:00',
    close: '14:00',
    closed: false
  }, {
    day: 'Sunday',
    open: '10:00',
    close: '14:00',
    closed: true
  }]);
  const [billing, setBilling] = useState({
    currency: 'USD',
    taxRate: '8.5',
    acceptedPayments: {
      cash: true,
      creditCard: true,
      debitCard: true,
      insurance: true,
      check: false
    }
  });
  const handleClinicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setClinicData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleHoursChange = (index: number, field: string, value: string | boolean) => {
    const newHours = [...operatingHours];
    newHours[index] = {
      ...newHours[index],
      [field]: value
    };
    setOperatingHours(newHours);
  };
  const handlePaymentToggle = (method: string) => {
    setBilling(prev => ({
      ...prev,
      acceptedPayments: {
        ...prev.acceptedPayments,
        [method]: !prev.acceptedPayments[method as keyof typeof prev.acceptedPayments]
      }
    }));
  };
  const handleSave = () => {
    console.log('Saving clinic settings:', clinicData, operatingHours, billing);
  };
  return <div className="space-y-6">
      {/* Clinic Information */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <BuildingIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Clinic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="name" className="label">
              Clinic Name
            </label>
            <input type="text" id="name" name="name" value={clinicData.name} onChange={handleClinicChange} className="input" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="address" className="label">
              Street Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <MapPinIcon size={18} />
              </span>
              <input type="text" id="address" name="address" value={clinicData.address} onChange={handleClinicChange} className="input pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="city" className="label">
              City
            </label>
            <input type="text" id="city" name="city" value={clinicData.city} onChange={handleClinicChange} className="input" />
          </div>
          <div>
            <label htmlFor="state" className="label">
              State
            </label>
            <input type="text" id="state" name="state" value={clinicData.state} onChange={handleClinicChange} className="input" />
          </div>
          <div>
            <label htmlFor="zipCode" className="label">
              ZIP Code
            </label>
            <input type="text" id="zipCode" name="zipCode" value={clinicData.zipCode} onChange={handleClinicChange} className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <PhoneIcon size={18} />
              </span>
              <input type="tel" id="phone" name="phone" value={clinicData.phone} onChange={handleClinicChange} className="input pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <MailIcon size={18} />
              </span>
              <input type="email" id="email" name="email" value={clinicData.email} onChange={handleClinicChange} className="input pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="website" className="label">
              Website
            </label>
            <input type="text" id="website" name="website" value={clinicData.website} onChange={handleClinicChange} className="input" />
          </div>
          <div>
            <label htmlFor="taxId" className="label">
              Tax ID / EIN
            </label>
            <input type="text" id="taxId" name="taxId" value={clinicData.taxId} onChange={handleClinicChange} className="input" />
          </div>
        </div>
      </div>
      {/* Operating Hours */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <ClockIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Operating Hours
        </h2>
        <div className="space-y-3">
          {operatingHours.map((schedule, index) => <div key={schedule.day} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div className="w-28">
                <span className="font-medium text-gray-900 dark:text-white">
                  {schedule.day}
                </span>
              </div>
              {!schedule.closed ? <div className="flex items-center space-x-3">
                  <input type="time" value={schedule.open} onChange={e => handleHoursChange(index, 'open', e.target.value)} className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white" />
                  <span className="text-gray-500 dark:text-gray-400">to</span>
                  <input type="time" value={schedule.close} onChange={e => handleHoursChange(index, 'close', e.target.value)} className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white" />
                </div> : <span className="text-gray-500 dark:text-gray-400 px-3 py-1.5">
                  Closed
                </span>}
              <button onClick={() => handleHoursChange(index, 'closed', !schedule.closed)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${schedule.closed ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'}`}>
                {schedule.closed ? 'Open' : 'Close'}
              </button>
            </div>)}
        </div>
      </div>
      {/* Billing Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-6">
          <DollarSignIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
          Billing Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="currency" className="label">
              Currency
            </label>
            <select id="currency" value={billing.currency} onChange={e => setBilling(prev => ({
            ...prev,
            currency: e.target.value
          }))} className="input">
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
            </select>
          </div>
          <div>
            <label htmlFor="taxRate" className="label">
              Tax Rate (%)
            </label>
            <input type="number" id="taxRate" value={billing.taxRate} onChange={e => setBilling(prev => ({
            ...prev,
            taxRate: e.target.value
          }))} className="input" step="0.1" />
          </div>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">
            Accepted Payment Methods
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(billing.acceptedPayments).map(([method, accepted]) => <div key={method} className={`p-4 border rounded-lg cursor-pointer transition-all ${accepted ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`} onClick={() => handlePaymentToggle(method)}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {method.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${accepted ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-slate-600'}`}>
                      {accepted && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>}
                    </div>
                  </div>
                </div>)}
          </div>
        </div>
      </div>
      {/* Staff Management */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <UsersIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
            Staff Management
          </h2>
          <button className="px-4 py-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
            Add Staff Member
          </button>
        </div>
        <div className="space-y-3">
          {[{
          name: 'Dr. John Roberts',
          role: 'Dentist',
          status: 'Active'
        }, {
          name: 'Dr. Sarah Patel',
          role: 'Dentist',
          status: 'Active'
        }, {
          name: 'Emily Johnson',
          role: 'Dental Hygienist',
          status: 'Active'
        }, {
          name: 'Michael Chen',
          role: 'Dental Assistant',
          status: 'Active'
        }, {
          name: 'Lisa Anderson',
          role: 'Receptionist',
          status: 'Active'
        }].map((staff, index) => <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mr-3">
                  {staff.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {staff.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {staff.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="badge badge-success">{staff.status}</span>
                <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                  Edit
                </button>
              </div>
            </div>)}
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
