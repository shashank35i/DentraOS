# Dental Clinic Management System - Architecture Overview

## Project Overview
This is a comprehensive dental clinic management system built with a modern full-stack architecture. The system supports three user roles (Admin, Doctor, Patient) and includes AI-powered agents for automated workflows.

## Technology Stack

### Backend
- **Node.js/Express**: RESTful API server with authentication, routing, and middleware
- **MySQL**: Relational database for data persistence
- **Python Agents**: AI-powered background workers for automation
- **JWT**: Authentication and authorization
- **Nodemailer**: Email notifications
- **Multer**: File upload handling
- **OpenAI GPT-4**: AI capabilities for insights and summaries

### Frontend
- **React/TypeScript**: Modern SPA framework
- **Vite**: Build tool and development server
- **React Router**: Client-side routing
- **TailwindCSS**: Utility-first CSS framework
- **Recharts**: Data visualization
- **Lucide React**: Icon library

## System Architecture

### High-Level Components
1. **Frontend Application** - Role-based UI for Admin, Doctor, Patient
2. **Express API Server** - REST endpoints, authentication, data access
3. **MySQL Database** - Structured data storage with 30+ tables
4. **AI Agents** - Python workers processing events asynchronously
5. **Event Queue** - Asynchronous task processing system

### Database Schema
The system uses a comprehensive MySQL schema with tables for:
- **Users**: Authentication and role management (Admin, Doctor, Patient)
- **Appointments**: Scheduling, conflict detection, status tracking
- **Cases**: Treatment management with stages and risk scoring
- **Inventory**: Items, vendors, usage tracking, alerts
- **Billing**: Invoices, payments, revenue tracking
- **Visits & Procedures**: Clinical records and consumables
- **Notifications**: In-app and email notifications
- **Agent Events**: Asynchronous task queue

### AI Agents Architecture
The system features Python-based AI agents that run asynchronously:

1. **Appointment Agent**: Handles scheduling, conflict detection, reminders
2. **Inventory Agent**: Monitors stock levels, generates purchase orders
3. **Revenue Agent**: Tracks billing, sends reminders, generates insights
4. **Case Tracking Agent**: Manages treatment workflows, generates summaries

Agents communicate via an event-driven queue system stored in the `agent_events` table.

## Data Flow

### User Interaction Flow
1. **Authentication**: JWT tokens issued on login/signup
2. **Role-Based Access**: Frontend routes protected by role checking
3. **API Calls**: REST endpoints with middleware validation
4. **Database Operations**: Direct SQL queries with connection pooling
5. **Event Emission**: Key actions trigger events for agent processing

### Appointment Booking Flow
1. Admin/Doctor creates appointment via UI
2. API validates data, checks conflicts
3. Appointment saved to database
4. `AppointmentCreated` event enqueued
5. Appointment Agent processes event:
   - Predicts duration
   - Detects conflicts
   - Schedules reminders
   - Sends notifications

### Automated Workflows
- **Daily Monitors**: Agents run periodic tasks (inventory checks, revenue insights)
- **Event Processing**: Workers poll event queue for tasks
- **Fallback Logic**: Server includes inline fallbacks if agents are down
- **Notifications**: Automated alerts for conflicts, low stock, reminders

## Key Features

### For Administrators
- User management (create staff/patients)
- Clinic configuration and settings
- Inventory management and vendor relations
- Revenue tracking and analytics
- Case tracking and oversight
- System monitoring and agent control

### For Doctors
- Appointment management and scheduling
- Patient case management
- Treatment tracking and progress notes
- Inventory usage during visits
- Real-time notifications and alerts
- AI-generated case summaries

### For Patients
- Appointment booking and viewing
- Treatment history and progress
- Billing and payment tracking
- Notification center
- Help and support access

## Security & Configuration
- **Environment Variables**: Sensitive data (DB credentials, API keys) stored in .env
- **JWT Authentication**: Token-based auth with role-based access control
- **Input Validation**: Server-side validaation**: Conttion and sanitization
- **CORS Configurrolled cross-origin access
- **Rate Limiting**: API protection against abuse

## Deployment Considerations
- **Database**: MySQL with proper timezone handling (Asia/Kolkata)
- **Backend**: Node.js server with connection pooling
- **Frontend**: Static build served via web server
- **Agents**: Python workers running separately, polling database
- **Email**: SMTP configuration for notifications

This architecture provides a scalable, maintainable solution for dental clinic operations with intelligent automation and comprehensive user management.