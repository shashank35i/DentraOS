import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Appointment {
    id: number;
    patientName: string;
    patientId: string;
    doctor: string;
    date: string;
    time: string;
    duration: string;
    purpose: string;
    status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
}

interface AppointmentContextType {
    appointments: Appointment[];
    addAppointment: (appointment: Omit<Appointment, 'id'>) => void;
    updateAppointment: (id: number, updatedAppointment: Partial<Appointment>) => void;
    deleteAppointment: (id: number) => void;
    getAppointment: (id: number) => Appointment | undefined;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

export const useAppointments = () => {
    const context = useContext(AppointmentContext);
    if (!context) {
        throw new Error('useAppointments must be used within an AppointmentProvider');
    }
    return context;
};

interface AppointmentProviderProps {
    children: ReactNode;
}

export const AppointmentProvider: React.FC<AppointmentProviderProps> = ({ children }) => {
    // Sample data moved from AppointmentList.tsx
    const [appointments, setAppointments] = useState<Appointment[]>([
        {
            id: 1,
            patientName: 'Sarah Johnson',
            patientId: 'PT-1001',
            doctor: 'Dr. Roberts',
            date: 'Today',
            time: '10:00 AM',
            duration: '30 min',
            purpose: 'Routine Checkup',
            status: 'in-progress'
        },
        {
            id: 2,
            patientName: 'Michael Chen',
            patientId: 'PT-1002',
            doctor: 'Dr. Roberts',
            date: 'Today',
            time: '11:00 AM',
            duration: '45 min',
            purpose: 'Root Canal',
            status: 'scheduled'
        },
        {
            id: 3,
            patientName: 'Emma Davis',
            patientId: 'PT-1003',
            doctor: 'Dr. Patel',
            date: 'Today',
            time: '1:30 PM',
            duration: '1 hour',
            purpose: 'Wisdom Tooth Extraction',
            status: 'scheduled'
        },
        {
            id: 4,
            patientName: 'Robert Wilson',
            patientId: 'PT-1004',
            doctor: 'Dr. Roberts',
            date: 'Today',
            time: '3:00 PM',
            duration: '30 min',
            purpose: 'Filling',
            status: 'scheduled'
        },
        {
            id: 5,
            patientName: 'Lisa Thompson',
            patientId: 'PT-1005',
            doctor: 'Dr. Patel',
            date: 'Today',
            time: '9:00 AM',
            duration: '30 min',
            purpose: 'Consultation',
            status: 'completed'
        },
        {
            id: 6,
            patientName: 'David Garcia',
            patientId: 'PT-1006',
            doctor: 'Dr. Roberts',
            date: 'Tomorrow',
            time: '10:30 AM',
            duration: '45 min',
            purpose: 'Crown Fitting',
            status: 'scheduled'
        },
        {
            id: 7,
            patientName: 'Jennifer Lee',
            patientId: 'PT-1007',
            doctor: 'Dr. Patel',
            date: 'Tomorrow',
            time: '2:00 PM',
            duration: '30 min',
            purpose: 'Follow-up',
            status: 'scheduled'
        },
        {
            id: 8,
            patientName: 'Carlos Rodriguez',
            patientId: 'PT-1008',
            doctor: 'Dr. Roberts',
            date: 'Yesterday',
            time: '11:30 AM',
            duration: '1 hour',
            purpose: 'Dental Implant Consultation',
            status: 'completed'
        },
        {
            id: 9,
            patientName: 'Michelle Wong',
            patientId: 'PT-1009',
            doctor: 'Dr. Patel',
            date: 'Yesterday',
            time: '3:30 PM',
            duration: '30 min',
            purpose: 'Teeth Cleaning',
            status: 'no-show'
        },
        {
            id: 10,
            patientName: 'Kevin Smith',
            patientId: 'PT-1010',
            doctor: 'Dr. Roberts',
            date: 'Yesterday',
            time: '9:00 AM',
            duration: '45 min',
            purpose: 'Tooth Extraction',
            status: 'cancelled'
        }
    ]);

    const addAppointment = (appointment: Omit<Appointment, 'id'>) => {
        const newAppointment = {
            ...appointment,
            id: Math.max(...appointments.map(a => a.id), 0) + 1
        };
        setAppointments(prev => [...prev, newAppointment]);
    };

    const updateAppointment = (id: number, updatedAppointment: Partial<Appointment>) => {
        setAppointments(prev => prev.map(app =>
            app.id === id ? { ...app, ...updatedAppointment } : app
        ));
    };

    const deleteAppointment = (id: number) => {
        setAppointments(prev => prev.filter(app => app.id !== id));
    };

    const getAppointment = (id: number) => {
        return appointments.find(app => app.id === id);
    };

    return (
        <AppointmentContext.Provider value={{ appointments, addAppointment, updateAppointment, deleteAppointment, getAppointment }}>
            {children}
        </AppointmentContext.Provider>
    );
};
