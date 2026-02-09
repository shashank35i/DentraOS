import React from 'react';
import { ClockIcon, UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
interface Appointment {
  id: number;
  patientName: string;
  time: string;
  duration: string;
  purpose: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}
export const AppointmentList: React.FC = () => {
  // Sample data
  const appointments: Appointment[] = [{
    id: 1,
    patientName: 'Sarah Johnson',
    time: '10:00 AM',
    duration: '30 min',
    purpose: 'Routine Checkup',
    status: 'in-progress'
  }, {
    id: 2,
    patientName: 'Michael Chen',
    time: '11:00 AM',
    duration: '45 min',
    purpose: 'Root Canal',
    status: 'scheduled'
  }, {
    id: 3,
    patientName: 'Emma Davis',
    time: '1:30 PM',
    duration: '1 hour',
    purpose: 'Wisdom Tooth Extraction',
    status: 'scheduled'
  }, {
    id: 4,
    patientName: 'Robert Wilson',
    time: '3:00 PM',
    duration: '30 min',
    purpose: 'Filling',
    status: 'scheduled'
  }, {
    id: 5,
    patientName: 'Lisa Thompson',
    time: '9:00 AM',
    duration: '30 min',
    purpose: 'Consultation',
    status: 'completed'
  }];
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
      default:
        return status;
    }
  };
  return <div className="space-y-4">
      {appointments.map(appointment => <div key={appointment.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
              <UserIcon size={20} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {appointment.patientName}
              </h3>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                <ClockIcon size={14} className="mr-1" />
                <span>
                  {appointment.time} • {appointment.duration} •{' '}
                  {appointment.purpose}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <span className={getStatusBadge(appointment.status)}>
              {getStatusText(appointment.status)}
            </span>
          </div>
        </div>)}
      <Link to="/app/appointments/today" className="block w-full py-3 text-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm">
        View Full Screen Calendar
      </Link>
    </div>;
};