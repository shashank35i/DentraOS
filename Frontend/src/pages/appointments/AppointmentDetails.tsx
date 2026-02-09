import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppointmentModal } from '../../components/appointments/AppointmentModal';
import { ArrowLeftIcon, CalendarIcon, UserIcon, ClockIcon, MessageSquareIcon, CheckCircleIcon, XCircleIcon, EditIcon, PrinterIcon, PhoneIcon } from 'lucide-react';
interface Appointment {
  id: number;
  patientName: string;
  patientId: string;
  patientInfo: {
    age: number;
    phone: string;
    email: string;
    address: string;
  };
  doctor: string;
  date: string;
  time: string;
  duration: string;
  purpose: string;
  notes: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  history: {
    date: string;
    treatment: string;
    notes: string;
    doctor: string;
  }[];
}
import { useAppointments } from '../../contexts/AppointmentContext';

export const AppointmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getAppointment, updateAppointment, deleteAppointment } = useAppointments();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const appointmentData = getAppointment(Number(id));

  if (!appointmentData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appointment not found</h2>
        <Link to="/app/appointments" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
          Back to Appointments
        </Link>
      </div>
    );
  }

  // Mock additional data that isn't in the main context yet
  const appointment = {
    ...appointmentData,
    patientInfo: {
      age: 34,
      phone: '(555) 123-4567',
      email: 'sarah.johnson@example.com',
      address: '123 Main St, Anytown, CA 12345'
    },
    notes: 'Patient has been experiencing mild sensitivity in the upper right molar. Last cleaning was 6 months ago. X-rays may be needed to check for any potential cavities.',
    history: [{
      date: 'May 15, 2023',
      treatment: 'Teeth Cleaning',
      notes: 'Regular cleaning performed. No issues detected.',
      doctor: 'Dr. Roberts'
    }, {
      date: 'Nov 22, 2022',
      treatment: 'Filling',
      notes: 'Filled cavity in lower left molar. Patient tolerated procedure well.',
      doctor: 'Dr. Patel'
    }, {
      date: 'May 10, 2022',
      treatment: 'Teeth Cleaning',
      notes: 'Regular cleaning performed. Recommended improved flossing technique.',
      doctor: 'Dr. Roberts'
    }]
  };

  const handleStatusChange = (newStatus: any) => {
    updateAppointment(appointment.id, { status: newStatus });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to cancel this appointment')) {
      deleteAppointment(appointment.id);
      navigate('/app/appointments');
    }
  };
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
    <div className="flex items-center mb-6">
      <Link to="/app/appointments" className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mr-4">
        <ArrowLeftIcon size={20} />
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <CalendarIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Appointment Details
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          View and manage appointment information
        </p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Appointment Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Appointment Information
            </h2>
            <span className={getStatusBadge(appointment.status)}>
              {getStatusText(appointment.status)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Date & Time
              </p>
              <p className="text-gray-900 dark:text-white flex items-center mt-1">
                <CalendarIcon size={16} className="mr-2 text-gray-400 dark:text-gray-500" />
                {appointment.date} at {appointment.time} (
                {appointment.duration})
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Doctor
              </p>
              <p className="text-gray-900 dark:text-white mt-1">
                {appointment.doctor}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Purpose
              </p>
              <p className="text-gray-900 dark:text-white mt-1">
                {appointment.purpose}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Patient ID
              </p>
              <p className="text-gray-900 dark:text-white mt-1">
                {appointment.patientId}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Notes
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              {appointment.notes}
            </p>
          </div>
        </div>
        {/* Update Status */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Update Appointment Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <button onClick={() => handleStatusChange('scheduled')} className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${appointment.status === 'scheduled' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <CalendarIcon size={24} className="text-blue-600 dark:text-blue-400 mb-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Scheduled
              </span>
            </button>
            <button onClick={() => handleStatusChange('in-progress')} className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${appointment.status === 'in-progress' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <ClockIcon size={24} className="text-yellow-600 dark:text-yellow-400 mb-2" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                In Progress
              </span>
            </button>
            <button onClick={() => handleStatusChange('completed')} className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${appointment.status === 'completed' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <CheckCircleIcon size={24} className="text-green-600 dark:text-green-400 mb-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Completed
              </span>
            </button>
            <button onClick={() => handleStatusChange('cancelled')} className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${appointment.status === 'cancelled' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <XCircleIcon size={24} className="text-red-600 dark:text-red-400 mb-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Cancelled
              </span>
            </button>
          </div>
        </div>
        {/* Add Notes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add Treatment Notes
          </h2>
          <div className="mb-4">
            <textarea className="input h-32" placeholder="Enter treatment notes, observations, and follow-up recommendations..."></textarea>
          </div>
          <div className="flex justify-end">
            <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm">
              Save Notes
            </button>
          </div>
        </div>
        {/* Visit History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Visit History
          </h2>
          <div className="space-y-6">
            {appointment.history.map((visit, index) => <div key={index} className="relative pl-6 border-l-2 border-gray-200 dark:border-slate-700">
              <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-500"></div>
              <div className="mb-1 flex justify-between">
                <h3 className="text-md font-medium text-gray-900 dark:text-white">
                  {visit.treatment}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {visit.date}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
                {visit.notes}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Doctor: {visit.doctor}
              </p>
            </div>)}
          </div>
        </div>
      </div>
      {/* Right Column */}
      <div className="space-y-6">
        {/* Patient Information */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Patient Information
            </h2>
            <Link to={`/app/patients/${appointment.patientId}`} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              View Profile
            </Link>
          </div>
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-4">
              <UserIcon size={32} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {appointment.patientName}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {appointment.patientId} • {appointment.patientInfo.age} years
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start">
              <PhoneIcon size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Phone
                </p>
                <p className="text-gray-900 dark:text-white">
                  {appointment.patientInfo.phone}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <MessageSquareIcon size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Email
                </p>
                <p className="text-gray-900 dark:text-white">
                  {appointment.patientInfo.email}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <CalendarIcon size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Address
                </p>
                <p className="text-gray-900 dark:text-white">
                  {appointment.patientInfo.address}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button onClick={() => setShowModal(true)} className="w-full p-3 flex items-center justify-center bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors">
              <EditIcon size={18} className="mr-2" />
              Edit Appointment
            </button>
            <button className="w-full p-3 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
              <PrinterIcon size={18} className="mr-2" />
              Print Details
            </button>
            <button onClick={handleDelete} className="w-full p-3 flex items-center justify-center bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
              <XCircleIcon size={18} className="mr-2" />
              Cancel Appointment
            </button>
          </div>
        </div>
        {/* AI Assistant */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
              <RobotIcon size={20} />
            </div>
            <h2 className="text-lg font-semibold">AI Assistant</h2>
          </div>
          <p className="mb-4 opacity-90">
            Based on the patient's history, I recommend checking for
            sensitivity in the upper right quadrant and comparing with
            previous X-rays from 6 months ago.
          </p>
          <button className="w-full py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
            Get AI Treatment Suggestions
          </button>
        </div>
      </div>
    </div>
    {/* Edit Appointment Modal */}
    <AppointmentModal isOpen={showModal} onClose={() => setShowModal(false)} appointment={appointment} />
  </div>
};
// Add this to avoid TypeScript errors
const RobotIcon: React.FC<{
  size: number;
}> = ({
  size
}) => {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <rect x="8" y="17" width="8" height="4" />
      <rect x="9" y="3" width="6" height="8" rx="2" />
      <path d="M15 7h2a2 2 0 0 1 2 2v2" />
      <path d="M9 7H7a2 2 0 0 0-2 2v2" />
    </svg>;
  };
