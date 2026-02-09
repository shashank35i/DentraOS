import React, { useState } from 'react';
import { XIcon, CalendarIcon, ClockIcon, CheckCircleIcon, XCircleIcon, PlayIcon, UserIcon } from 'lucide-react';
import { Appointment } from '../../contexts/AppointmentContext';
interface AppointmentStatusModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}
export const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
  isOpen,
  appointment,
  onClose
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  if (!isOpen || !appointment) return null;
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };
  const handleSave = () => {
    console.log('Updating appointment status:', {
      appointmentId: appointment.id,
      newStatus: selectedStatus,
      notes
    });
    onClose();
  };
  const statusOptions = [{
    value: 'scheduled',
    label: 'Scheduled',
    icon: <CalendarIcon size={24} />,
    color: 'blue',
    description: 'Appointment is scheduled'
  }, {
    value: 'in-progress',
    label: 'In Progress',
    icon: <PlayIcon size={24} />,
    color: 'yellow',
    description: 'Patient is currently being seen'
  }, {
    value: 'completed',
    label: 'Completed',
    icon: <CheckCircleIcon size={24} />,
    color: 'green',
    description: 'Appointment finished successfully'
  }, {
    value: 'cancelled',
    label: 'Cancelled',
    icon: <XCircleIcon size={24} />,
    color: 'red',
    description: 'Appointment was cancelled'
  }];
  return <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl transform transition-all w-full max-w-2xl relative z-10">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Update Appointment Status
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
            <XIcon size={20} />
          </button>
        </div>
        <div className="p-6">
          {/* Appointment Info */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
                <UserIcon size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {appointment.patientName}
                </h4>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 space-x-3">
                  <span className="flex items-center">
                    <ClockIcon size={14} className="mr-1" />
                    {appointment.time}
                  </span>
                  <span>{appointment.purpose}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Current Status */}
          <div className="mb-6">
            <label className="label">Current Status</label>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : appointment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300' : appointment.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'}`}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </div>
          </div>
          {/* Status Options */}
          <div className="mb-6">
            <label className="label">Change Status To</label>
            <div className="grid grid-cols-2 gap-3">
              {statusOptions.map(option => <button key={option.value} onClick={() => handleStatusChange(option.value)} className={`p-4 border rounded-lg transition-all text-left ${selectedStatus === option.value ? `border-${option.color}-500 bg-${option.color}-50 dark:bg-${option.color}-900/20` : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
                <div className="flex items-start">
                  <div className={`w-10 h-10 bg-${option.color}-100 dark:bg-${option.color}-900/30 rounded-lg flex items-center justify-center text-${option.color}-600 dark:text-${option.color}-300 mr-3`}>
                    {option.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>)}
            </div>
          </div>
          {/* Notes */}
          <div className="mb-6">
            <label htmlFor="notes" className="label">
              Add Notes (Optional)
            </label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className="input h-24" placeholder="Add any relevant notes about this status change..."></textarea>
          </div>
          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!selectedStatus} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>;
};
