# Web App Readme

## Overview
Dental Clinic Intelligence is a role-based, agentic AI web app for clinic operations. It provides three primary workspaces (Admin, Doctor, Patient) and a shared landing and auth experience. The UI is refreshed to a classic, professional clinical theme with calm typography, warm neutral surfaces, and clear data hierarchy.

## Roles And Workspaces
- Admin: Clinic setup, scheduling, patients, cases, case tracking, inventory, revenue, notifications, and support.
- Doctor: Daily schedule, cases, patients, insights, notifications, and help.
- Patient: Appointments, treatments, billing, notifications, and help.

## Key Routes
Public
- `/` and `/landing`: Landing page
- `/login`: Role-based login
- `/create-account`: Account creation with email OTP
- `/forgot-password` and `/reset-password`: Password recovery

Admin
- `/admin/overview`: Admin dashboard (primary entry)
- `/admin/clinic`: Clinic setup
- `/admin/schedule`: Appointments
- `/admin/patients`: Patient management
- `/admin/cases`: Case management
- `/admin/case-ops`: Case tracking
- `/admin/alerts`: Notifications
- `/admin/inventory`: Inventory
- `/admin/revenue`: Revenue
- `/admin/support`: Help and contact

Doctor
- `/doctor/overview`: Dashboard
- `/doctor/schedule`: Appointments
- `/doctor/cases`: Case list
- `/doctor/cases/:caseRef`: Case details
- `/doctor/patients`: Patient list
- `/doctor/insights`: Insights
- `/doctor/alerts`: Notifications
- `/doctor/support`: Help and docs

Patient
- `/patient/overview`: Dashboard
- `/patient/appointments`: Appointments
- `/patient/treatments`: Treatment summaries
- `/patient/billing`: Billing and payments
- `/patient/alerts`: Notifications
- `/patient/support`: Help and contact

Backward-compatible redirects exist for older paths such as `/admin/dashboard`, `/doctor/appointments`, `/patient/notifications`, `/app/AdminDashboard`, `/app/DoctorDashboard`, and `/app/PatientDashboard`.

## UI Refresh Summary
- Classic clinical palette with warm surfaces and subtle gradients.
- Two-font system: a clean sans for body and a serif display for headings.
- Redesigned navigation shells for Admin, Doctor, and Patient.
- Updated landing and auth screens with a professional, medical-grade presentation.
- Global re-skin of legacy palette classes to harmonize older pages with the new theme.

## Notes
- The app uses role-based routing and local storage for session context (role, auth token, user name, user id).
- Admin, Doctor, and Patient routing now uses clearer, task-oriented paths while keeping legacy redirects.
