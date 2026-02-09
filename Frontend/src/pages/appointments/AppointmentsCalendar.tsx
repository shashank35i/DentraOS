import React, { useState } from 'react';
import { CalendarIcon, ListIcon, GridIcon, FilterIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, UserIcon } from 'lucide-react';
import { AppointmentModal } from '../../components/appointments/AppointmentModal';
import { AppointmentStatusModal } from '../../components/appointments/AppointmentStatusModal';
import { useAppointments, Appointment } from '../../contexts/AppointmentContext';
export const AppointmentsCalendar: React.FC = () => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { appointments } = useAppointments();
  const filteredAppointments = appointments.filter(apt => {
    if (filterDoctor !== 'all' && apt.doctor !== filterDoctor) return false;
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false;
    return true;
  });
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };
  return <div className="h-full flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <CalendarIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Today's Appointments
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>
      <button onClick={() => setShowAddModal(true)} className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm">
        <PlusIcon size={18} className="mr-2" />
        Add Appointment
      </button>
    </div>
    {/* Filters and View Toggle */}
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FilterIcon size={18} className="text-gray-500 dark:text-gray-400" />
            <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-700 dark:text-white">
              <option value="all">All Doctors</option>
              <option value="Dr. Roberts">Dr. Roberts</option>
              <option value="Dr. Patel">Dr. Patel</option>
              <option value="Dr. Johnson">Dr. Johnson</option>
            </select>
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-700 dark:text-white">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
            <ListIcon size={20} />
          </button>
          <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
            <GridIcon size={20} />
          </button>
        </div>
      </div>
    </div>
    {/* Appointments List */}
    <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-soft overflow-hidden">
      <div className="h-full overflow-y-auto p-6">
        {filteredAppointments.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <CalendarIcon size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">No appointments found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div> : <div className="space-y-4">
          {filteredAppointments.map(appointment => <div key={appointment.id} className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedAppointment(appointment)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
                  <UserIcon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    {appointment.patientName}
                  </h3>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 space-x-4">
                    <span className="flex items-center">
                      <ClockIcon size={14} className="mr-1" />
                      {appointment.time} • {appointment.duration}
                    </span>
                    <span>{appointment.purpose}</span>
                    <span>{appointment.doctor}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                  {getStatusText(appointment.status)}
                </span>
              </div>
            </div>
          </div>)}
        </div>}
      </div>
    </div>
    {/* Modals */}
    <AppointmentModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    <AppointmentStatusModal isOpen={!!selectedAppointment} appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />
  </div>;
};
