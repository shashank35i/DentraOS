// src/AppRouter.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Landing } from "./pages/Landing";
import { Login } from "./pages/auth/Login";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { CreateAccount } from "./pages/auth/CreateAccount";
import { ResetPassword } from "./pages/auth/ResetPassword";

import { AdminDashboard } from "./pages/AdminDashboard";
import { DoctorDashboard } from "./pages/DoctorDashboard";
import { PatientDashboard } from "./pages/PatientDashboard";

import { AdminLayout } from "./layouts/admin/AdminLayout";
import { MainLayout } from "./layouts/MainLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";
import AdminClinicSetup from "./layouts/admin/AdminClinicSetup";

import { AppointmentList } from "./pages/appointments/AppointmentList";
import { AppointmentDetails } from "./pages/appointments/AppointmentDetails";
import { AppointmentsCalendar } from "./pages/appointments/AppointmentsCalendar";

import { UserSettings } from "./pages/settings/UserSettings";
import { ClinicSettings } from "./pages/settings/ClinicSettings";
import { AgentSettings } from "./pages/settings/AgentSettings";
import { ThemeSettings } from "./pages/settings/ThemeSettings";

import { PatientAppointments } from "./pages/PatientAppointments";
import { PatientTreatments } from "./pages/PatientTreatments";
import { PatientBilling } from "./pages/PatientBilling";
import { Profile } from "./pages/Profile";

import { DoctorAppointments } from "./layouts/doctor/DoctorAppointments";
import { DoctorCases } from "./layouts/doctor/DoctorCases";
import { DoctorCaseDetails } from "./layouts/doctor/DoctorCaseDetails";
import { DoctorPatients } from "./layouts/doctor/DoctorPatients";
import { DoctorInsights } from "./layouts/doctor/DoctorInsights";
import { DoctorHelp } from "./layouts/doctor/DoctorHelp";
import { DoctorLayout } from "./layouts/doctor/DoctorLayout";

import { AdminNotificationsPage } from "./layouts/admin/NotificationsPage";
import { DoctorNotificationsPage } from "./layouts/doctor/DoctorNotificationsPage";
import { PatientNotificationsPage } from "./layouts/patient/NotificationsPage";

import { AdminAppointments } from "./layouts/admin/AdminAppointments";
import { AdminCases } from "./layouts/admin/AdminCases";
import { AdminPatients } from "./layouts/admin/AdminPatients";
import { AdminInventory } from "./layouts/admin/AdminInventory";
import { AdminRevenue } from "./layouts/admin/AdminRevenue";
import { AdminHelp } from "./layouts/admin/AdminHelp";
import { AdminCaseTracking } from "./layouts/admin/AdminCaseTracking";
import { AdminAppointmentDetails } from "./layouts/admin/AdminAppointmentDetails";
import { DoctorAppointmentDetails } from "./layouts/doctor/DoctorAppointmentDetails";
import { AdminInvoiceDetails } from "./layouts/admin/AdminInvoiceDetails";
import { AdminPurchaseOrders } from "./layouts/admin/AdminPurchaseOrders";
import { AdminInventoryItemDetails } from "./layouts/admin/AdminInventoryItemDetails";

import { PatientHelp } from "./layouts/patient/PatientHelp";
import { PatientLayout } from "./layouts/patient/PatientLayout";

import { HelpAndContact } from "./pages/HelpAndContact";
import { ContactSupport } from "./pages/help/ContactSupport";

import { ProtectedRoute } from "./components/ProtectedRoute";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-6 bg-white rounded-xl shadow-soft">
    <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
    <p className="text-gray-600">This page is under construction. Check back soon!</p>
  </div>
);

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* ---------- Public ---------- */}
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ---------- ADMIN (REFRESHED ROUTES) ---------- */}
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route
          path="/admin/overview"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clinic"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminClinicSetup />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedule"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminAppointments />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/appointments/:id"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminAppointmentDetails />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/patients"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminPatients />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cases"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminCases />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/case-ops"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminCaseTracking />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminNotificationsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminInventory />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory/:itemCode"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminInventoryItemDetails />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/purchase-orders"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminPurchaseOrders />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/revenue"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminRevenue />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/invoices/:invoiceId"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminInvoiceDetails />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminHelp />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Profile />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin redirects (legacy) */}
        <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/clinic-setup" element={<Navigate to="/admin/clinic" replace />} />
        <Route path="/admin/appointments" element={<Navigate to="/admin/schedule" replace />} />
        <Route path="/admin/case-tracking" element={<Navigate to="/admin/case-ops" replace />} />
        <Route path="/admin/notifications" element={<Navigate to="/admin/alerts" replace />} />
        <Route path="/admin/help" element={<Navigate to="/admin/support" replace />} />
        <Route path="/app/AdminDashboard" element={<Navigate to="/admin/overview" replace />} />

        {/* ---------- DOCTOR (REFRESHED ROUTES) ---------- */}
        <Route path="/doctor" element={<Navigate to="/doctor/overview" replace />} />
        <Route
          path="/doctor/overview"
          element={
            <ProtectedRoute>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/schedule"
          element={
            <ProtectedRoute>
              <DoctorAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/appointments/:id"
          element={
            <ProtectedRoute>
              <DoctorAppointmentDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/cases"
          element={
            <ProtectedRoute>
              <DoctorCases />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/cases/:caseRef"
          element={
            <ProtectedRoute>
              <DoctorCaseDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/patients"
          element={
            <ProtectedRoute>
              <DoctorPatients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/insights"
          element={
            <ProtectedRoute>
              <DoctorInsights />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/alerts"
          element={
            <ProtectedRoute>
              <DoctorNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/support"
          element={
            <ProtectedRoute>
              <DoctorHelp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/profile"
          element={
            <ProtectedRoute>
              <DoctorLayout>
                <Profile />
              </DoctorLayout>
            </ProtectedRoute>
          }
        />

        {/* Doctor redirects (legacy) */}
        <Route path="/app/DoctorDashboard" element={<Navigate to="/doctor/overview" replace />} />
        <Route path="/doctor/appointments" element={<Navigate to="/doctor/schedule" replace />} />
        <Route path="/doctor/notifications" element={<Navigate to="/doctor/alerts" replace />} />
        <Route path="/doctor/help" element={<Navigate to="/doctor/support" replace />} />

        {/* ---------- PATIENT (REFRESHED ROUTES) ---------- */}
        <Route path="/patient" element={<Navigate to="/patient/overview" replace />} />
        <Route
          path="/patient/overview"
          element={
            <ProtectedRoute>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute>
              <PatientAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/treatments"
          element={
            <ProtectedRoute>
              <PatientTreatments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/billing"
          element={
            <ProtectedRoute>
              <PatientBilling />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/alerts"
          element={
            <ProtectedRoute>
              <PatientNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/support"
          element={
            <ProtectedRoute>
              <PatientHelp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute>
              <PatientLayout>
                <Profile />
              </PatientLayout>
            </ProtectedRoute>
          }
        />

        {/* Patient redirects (legacy) */}
        <Route path="/app/PatientDashboard" element={<Navigate to="/patient/overview" replace />} />
        <Route path="/patient/notifications" element={<Navigate to="/patient/alerts" replace />} />
        <Route path="/patient/help" element={<Navigate to="/patient/support" replace />} />

        {/* ---------- GLOBAL HELP ---------- */}
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <HelpAndContact />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help/contact"
          element={
            <ProtectedRoute>
              <ContactSupport />
            </ProtectedRoute>
          }
        />

        {/* ---------- /app LEGACY SHELL ---------- */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="appointments" element={<AppointmentList />} />
          <Route path="appointments/today" element={<AppointmentsCalendar />} />
          <Route path="appointments/:id" element={<AppointmentDetails />} />

          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="user" replace />} />
            <Route path="user" element={<UserSettings />} />
            <Route path="clinic" element={<ClinicSettings />} />
            <Route path="agent" element={<AgentSettings />} />
            <Route path="theme" element={<ThemeSettings />} />
          </Route>

          <Route path="inventory" element={<PlaceholderPage title="Inventory (legacy view)" />} />
          <Route path="inventory/table" element={<PlaceholderPage title="Inventory Table (legacy view)" />} />
          <Route path="revenue" element={<PlaceholderPage title="Revenue (legacy view)" />} />
          <Route path="cases" element={<PlaceholderPage title="Cases (legacy view)" />} />
          <Route path="cases/:id" element={<PlaceholderPage title="Case Details (legacy view)" />} />
          <Route path="patients" element={<PlaceholderPage title="Patients (legacy view)" />} />
          <Route path="patients/:id" element={<PlaceholderPage title="Patient Profile (legacy view)" />} />

          <Route path="help" element={<Navigate to="/admin/support" replace />} />
          <Route path="help/contact" element={<Navigate to="/admin/support" replace />} />
          <Route path="help/documentation" element={<Navigate to="/admin/support" replace />} />
          <Route path="help/videos" element={<Navigate to="/admin/support" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
