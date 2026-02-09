import React, { useEffect, useState } from "react";
import {
  CalendarClockIcon,
  ActivityIcon,
  UsersIcon,
  ClipboardListIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DoctorLayout } from "../layouts/doctor/DoctorLayout";

type DoctorAppointment = {
  id: string | number;
  date: string | null;
  time: string | null;
  patient: string;
  reason: string;
  room: string;
  status: string;
};

type DoctorCase = {
  id: string;
  patientName: string;
  toothRegion: string;
  diagnosis: string;
  stage: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type DoctorPatient = {
  id: string;
  name: string;
  lastVisit: string | null;
  activeCases: number;
};

type AppointmentsResponse = {
  items: DoctorAppointment[];
  date: string;
  message: string;
};

type CasesResponse = {
  cases: DoctorCase[];
  message: string;
};

type PatientsResponse = {
  items: DoctorPatient[];
  message: string;
};

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");

  if (!token) {
    const err: any = new Error("No auth token in localStorage");
    err.code = "NO_TOKEN";
    throw err;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(
      data.message || `Request failed with status ${res.status}`
    );
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Doctor";

  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [cases, setCases] = useState<DoctorCase[]>([]);
  const [patients, setPatients] = useState<DoctorPatient[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [apptData, caseData, patientData] = await Promise.all([
          fetchWithAuth<AppointmentsResponse>("/api/doctor/appointments"),
          fetchWithAuth<CasesResponse>("/api/doctor/cases"),
          fetchWithAuth<PatientsResponse>("/api/doctor/patients"),
        ]);

        if (cancelled) return;

        setAppointments(apptData.items || []);
        setCases(caseData.cases || []);
        setPatients(patientData.items || []);
      } catch (err: any) {
        if (cancelled) return;
        console.error("DOCTOR DASHBOARD LOAD ERROR", err);

        if (err.code === "NO_TOKEN" || err.status === 401) {
          setErrorMsg("Session expired. Please log in again.");
          navigate("/loginrole=doctor");
        } else if (err.status === 403) {
          setErrorMsg("You do not have permission for this view.");
        } else if (err.message) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Failed to load doctor dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const totalAppts = appointments.length;
  const nonCancelledAppts = appointments.filter(
    (a) => a.status !== "Cancelled"
  );
  const completedAppts = appointments.filter((a) => a.status === "Completed");
  const completionRate =
    nonCancelledAppts.length > 0
      ? Math.round((completedAppts.length / nonCancelledAppts.length) * 100)
      : 0;

  const openCasesCount = cases.filter(
    (c) => c.stage !== "CLOSED" && c.stage !== "COMPLETED"
  ).length;

  const newPatientsLast30d = patients.length;

  const quickStats = {
    todayCount: totalAppts,
    openCases: openCasesCount,
    newPatients: newPatientsLast30d,
    completionRate,
  };

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">Daily workspace</p>
            <h1 className="text-2xl font-semibold text-ink">
              Good day, {userName}
            </h1>
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">
              A quick clinical overview of today&apos;s schedule, open cases, and
              practice signals.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <CalendarClockIcon size={16} className="text-brand" />
              Appointments today
            </div>
            <p className="text-2xl font-semibold text-ink">
              {quickStats.todayCount}
            </p>
            <Link to="/doctor/schedule" className="text-xs text-brand">
              View schedule
            </Link>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <ClipboardListIcon size={16} className="text-brand" />
              Open cases
            </div>
            <p className="text-2xl font-semibold text-ink">
              {quickStats.openCases}
            </p>
            <Link to="/doctor/cases" className="text-xs text-brand">
              View cases
            </Link>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <UsersIcon size={16} className="text-brand" />
              Patients in panel
            </div>
            <p className="text-2xl font-semibold text-ink">
              {patients.length}
            </p>
            <Link to="/doctor/patients" className="text-xs text-brand">
              View patients
            </Link>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <ActivityIcon size={16} className="text-brand" />
              Completion rate
            </div>
            <p className="text-2xl font-semibold text-ink">
              {quickStats.completionRate}%
            </p>
            <Link to="/doctor/insights" className="text-xs text-brand">
              View insights
            </Link>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}
      {loading && !errorMsg && (
        <div className="mb-4 text-sm text-ink-muted">Loading dashboard...</div>
      )}

      {!loading && !errorMsg && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.6fr,1fr] gap-6">
          <div className="surface rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClockIcon size={18} className="text-brand" />
                <h2 className="text-sm font-semibold text-ink">
                  Today&apos;s schedule
                </h2>
              </div>
              <Link
                to="/doctor/schedule"
                className="text-[11px] text-ink-muted hover:underline"
              >
                Open full view
              </Link>
            </div>

            <ul className="space-y-3 text-xs">
              {appointments.map((apt) => (
                <li
                  key={apt.id}
                  className="flex items-start justify-between rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      <div className="px-2 py-0.5 rounded-full bg-surface-muted text-[11px] font-mono text-ink-muted border border-line">
                        {apt.time || "--:--"}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-ink">{apt.patient}</p>
                      <p className="text-ink-muted mt-0.5">{apt.reason}</p>
                      <p className="text-ink-muted mt-0.5">
                        {apt.room} - {apt.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        apt.status === "Confirmed"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/60"
                          : apt.status === "In progress"
                            ? "bg-sky-500/10 text-sky-700 border-sky-400/60"
                          : apt.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/60"
                          : apt.status === "Cancelled"
                            ? "bg-rose-500/10 text-rose-700 border-rose-400/60"
                          : "bg-surface-muted text-ink border-line",
                      ].join(" ")}
                    >
                      {apt.status}
                    </span>
                    <button className="text-[11px] text-brand hover:underline">
                      Open chart
                    </button>
                  </div>
                </li>
              ))}
              {appointments.length === 0 && (
                <li className="text-xs text-ink-muted">
                  No appointments scheduled for today.
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="surface rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardListIcon size={18} className="text-brand" />
                  <h2 className="text-sm font-semibold text-ink">Active cases</h2>
                </div>
                <Link
                  to="/doctor/cases"
                  className="text-[11px] text-brand hover:underline"
                >
                  All cases
                </Link>
              </div>

              <p className="text-xs text-ink-muted">
                You currently have <span className="font-semibold">{quickStats.openCases}</span>
                {" "}open treatment cases assigned. Visit cases to manage progress.
              </p>
            </div>

            <div className="surface rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <ActivityIcon size={18} className="text-brand" />
                <h2 className="text-sm font-semibold text-ink">Quick signals</h2>
              </div>
              <ul className="space-y-2 text-[11px] text-ink-muted">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon size={13} className="mt-0.5 text-emerald-600" />
                  <span>
                    {quickStats.todayCount > 0
                      ? "Today&apos;s schedule is ready; appointments are visible in your list."
                      : "No appointments booked for today yet."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircleIcon size={13} className="mt-0.5 text-amber-600" />
                  <span>
                    {quickStats.openCases > 0
                      ? "You have ongoing treatment cases that may need follow-up this week."
                      : "No active treatment cases currently assigned."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ActivityIcon size={13} className="mt-0.5 text-brand" />
                  <span>
                    Recent completion rate is around {quickStats.completionRate}%
                    based on your recent appointments.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </DoctorLayout>
  );
};
