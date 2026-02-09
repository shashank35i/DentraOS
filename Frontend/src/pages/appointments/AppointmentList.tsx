import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, PlusIcon, FilterIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, UserIcon, XIcon } from 'lucide-react';
import { AppointmentModal } from '../../components/appointments/AppointmentModal';
import { useAppointments, Appointment } from '../../contexts/AppointmentContext';
export const AppointmentList: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('today');
  const { appointments, deleteAppointment } = useAppointments();
  // Filter appointments
  const filteredAppointments = appointments.filter(appointment => {
    // Date filter
    if (dateFilter === 'today' && appointment.date !== 'Today') return false;
    if (dateFilter === 'tomorrow' && appointment.date !== 'Tomorrow') return false;
    if (dateFilter === 'yesterday' && appointment.date !== 'Yesterday') return false;
    // Status filter
    if (statusFilter && appointment.status !== statusFilter) return false;
    // Search query
    if (searchQuery && !appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) && !appointment.patientId.toLowerCase().includes(searchQuery.toLowerCase()) && !appointment.purpose.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'badge badge-info';
      case 'in-progress':
        return 'badge badge-warning';
      case 'completed':
        return 'badge badge-success';
      case 'cancelled':
        return 'badge badge-danger';
      case 'no-show':
        return 'badge badge-danger';
      default:
        return 'badge';
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
      case 'no-show':
        return 'No Show';
      default:
        return status;
    }
  };
  return <div>
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <CalendarIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Appointments
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Manage and track all patient appointments
        </p>
      </div>
      <button onClick={() => { setSelectedAppointment(null); setShowModal(true); }} className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm">
        <PlusIcon size={18} className="mr-2" />
        Add Appointment
      </button>
    </div>
    {/* Filters and Search */}
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by:
          </span>
          <div className="flex space-x-2">
            <button className={`px-3 py-1 text-sm rounded-full ${dateFilter === 'today' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`} onClick={() => setDateFilter('today')}>
              Today
            </button>
            <button className={`px-3 py-1 text-sm rounded-full ${dateFilter === 'tomorrow' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`} onClick={() => setDateFilter('tomorrow')}>
              Tomorrow
            </button>
            <button className={`px-3 py-1 text-sm rounded-full ${dateFilter === 'yesterday' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`} onClick={() => setDateFilter('yesterday')}>
              Yesterday
            </button>
            <button className={`px-3 py-1 text-sm rounded-full ${dateFilter === 'all' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`} onClick={() => setDateFilter('all')}>
              All
            </button>
          </div>
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <button className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg flex items-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
              <FilterIcon size={16} className="mr-2" />
              Status
              {statusFilter && <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                {getStatusText(statusFilter)}
              </span>}
            </button>
            {/* Status dropdown would go here */}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <input type="text" placeholder="Search appointments..." className="w-full px-4 py-2 pl-10 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <SearchIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            {searchQuery && <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => setSearchQuery('')}>
              <XIcon size={16} />
            </button>}
          </div>
        </div>
      </div>
    </div>
    {/* Appointments Table */}
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Doctor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No appointments found
                </td>
              </tr>
            ) : (
              filteredAppointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-3">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {appointment.patientName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {appointment.patientId}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white">
                  {appointment.doctor}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white">
                  {appointment.date}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <ClockIcon size={12} className="mr-1" />
                  {appointment.time} ({appointment.duration})
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white">
                  {appointment.purpose}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={getStatusBadge(appointment.status)}>
                  {getStatusText(appointment.status)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link to={`/app/appointments/${appointment.id}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                  View
                </Link>
                <button onClick={() => { setSelectedAppointment(appointment); setShowModal(true); }} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mr-3">
                  Edit
                </button>
                <button onClick={() => deleteAppointment(appointment.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
                  Delete
                </button>
              </td>
            </tr>
          ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-slate-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing <span className="font-medium">1</span> to{' '}
          <span className="font-medium">{filteredAppointments.length}</span>{' '}
          of{' '}
          <span className="font-medium">{filteredAppointments.length}</span>{' '}
          results
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 border border-gray-200 dark:border-slate-700 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50" disabled>
            <ChevronLeftIcon size={16} />
          </button>
          <button className="px-3 py-1 border border-gray-200 dark:border-slate-700 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50" disabled>
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
    {/* Add Appointment Modal */}
    <AppointmentModal isOpen={showModal} onClose={() => setShowModal(false)} appointment={selectedAppointment} />
  </div>;
};
