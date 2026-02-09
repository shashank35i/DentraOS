import React, { useState, useEffect } from 'react';
import { XIcon, CalendarIcon, ClockIcon, UserIcon, UsersIcon, MessageSquareIcon } from 'lucide-react';
import { useAppointments, Appointment } from '../../contexts/AppointmentContext';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment
}) => {
  const { addAppointment, updateAppointment } = useAppointments();
  const [formData, setFormData] = useState({
    patientName: '',
    patientId: '',
    doctor: '',
    date: '',
    time: '',
    duration: '30',
    purpose: ''
  });

  useEffect(() => {
    if (appointment) {
      setFormData({
        patientName: appointment.patientName,
        patientId: appointment.patientId,
        doctor: appointment.doctor,
        date: appointment.date === 'Today' ? new Date().toISOString().split('T')[0] :
          appointment.date === 'Tomorrow' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] :
            appointment.date === 'Yesterday' ? new Date(Date.now() - 86400000).toISOString().split('T')[0] :
              appointment.date, // Simple handling for demo dates
        time: appointment.time.includes('AM') || appointment.time.includes('PM') ? convertTo24Hour(appointment.time) : appointment.time,
        duration: appointment.duration.includes('min') ? appointment.duration.replace(' min', '') : '60',
        purpose: appointment.purpose
      });
    } else {
      setFormData({
        patientName: '',
        patientId: '',
        doctor: '',
        date: '',
        time: '',
        duration: '30',
        purpose: ''
      });
    }
  }, [appointment, isOpen]);

  // Helper to convert 12h to 24h for input type="time"
  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours}:${minutes}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (appointment) {
      updateAppointment(appointment.id, {
        ...formData
      });
    } else {
      addAppointment({
        ...formData,
        status: 'scheduled'
      });
    }
    onClose();
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl transform transition-all w-full max-w-lg relative z-10">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <CalendarIcon size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
            {appointment ? 'Edit Appointment' : 'Add New Appointment'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
            <XIcon size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Patient Selection */}
            <div>
              <label htmlFor="patientName" className="label">
                Patient
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                  <UserIcon size={18} />
                </span>
                <input type="text" id="patientName" name="patientName" value={formData.patientName} onChange={handleChange} className="input pl-10" placeholder="Search patient..." required />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter patient name or ID
              </p>
            </div>
            {/* Doctor Selection */}
            <div>
              <label htmlFor="doctor" className="label">
                Doctor
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                  <UsersIcon size={18} />
                </span>
                <select id="doctor" name="doctor" value={formData.doctor} onChange={handleChange} className="input pl-10" required>
                  <option value="">Select doctor</option>
                  <option value="Dr. Roberts">Dr. Roberts</option>
                  <option value="Dr. Patel">Dr. Patel</option>
                  <option value="Dr. Johnson">Dr. Johnson</option>
                </select>
              </div>
            </div>
            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="label">
                  Date
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                    <CalendarIcon size={18} />
                  </span>
                  <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} className="input pl-10" required />
                </div>
              </div>
              <div>
                <label htmlFor="time" className="label">
                  Time
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                    <ClockIcon size={18} />
                  </span>
                  <input type="time" id="time" name="time" value={formData.time} onChange={handleChange} className="input pl-10" required />
                </div>
              </div>
            </div>
            {/* Duration */}
            <div>
              <label htmlFor="duration" className="label">
                Duration
              </label>
              <select id="duration" name="duration" value={formData.duration} onChange={handleChange} className="input" required>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            {/* Purpose */}
            <div>
              <label htmlFor="purpose" className="label">
                Purpose
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 top-3 flex items-start pl-3 text-gray-400 dark:text-gray-500">
                  <MessageSquareIcon size={18} />
                </span>
                <textarea id="purpose" name="purpose" value={formData.purpose} onChange={handleChange} className="input pl-10 h-24" placeholder="Reason for appointment..." required></textarea>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm">
              {appointment ? 'Update Appointment' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>;
};
