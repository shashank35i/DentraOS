import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "../layouts/patient/PatientLayout";

type AppointmentRow = {
  id: string | number;
  date: string | null;
  time: string | null;
  doctor: string;
  reason: string;
  status: string;
  location: string | null;
  notes: string | null;
};

type AppointmentsResponse = {
  items: AppointmentRow[];
  error: boolean;
};

type LoadState = "loading" | "ready" | "error";

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");

  if (!token) {
    const err: any = new Error("Missing auth token");
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
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body.message || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

function normalizeStatus(s: string) {
  const x = String(s || "").trim().toUpperCase();
  if (x === "CONFIRMED") return "CONFIRMED";
  if (x === "PENDING") return "PENDING";
  if (x === "CANCELLED") return "CANCELLED";
  if (x === "COMPLETED") return "COMPLETED";
  if (x === "OVERDUE") return "OVERDUE";
  return x || "PENDING";
}

export const PatientAppointments: React.FC = () => {
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus("loading");
        setErrorMsg(null);

        const data = await fetchWithAuth<AppointmentsResponse>(
          "/api/patient/appointments"
        );
        if (cancelled) return;

        setAppointments(Array.isArray(data.items) ? data.items : []);
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        console.error("PATIENT APPOINTMENTS ERROR", err);

        if (err.code === "NO_TOKEN" || err.status === 401) {
          setErrorMsg("Session expired. Please log in again.");
          setStatus("error");
          navigate("/loginrole=patient");
        } else {
          setErrorMsg(err.message || "Failed to load appointments.");
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const upcomingCount = useMemo(() => {
    return appointments.filter((a) => normalizeStatus(a.status) !== "COMPLETED")
      .length;
  }, [appointments]);

  const completedCount = useMemo(() => {
    return appointments.filter((a) => normalizeStatus(a.status) === "COMPLETED")
      .length;
  }, [appointments]);

  const getStatusStyles = (st: string) => {
    const s = normalizeStatus(st);
    if (s === "CONFIRMED")
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40";
    if (s === "PENDING")
      return "bg-amber-500/10 text-amber-700 border border-amber-400/40";
    if (s === "CANCELLED")
      return "bg-rose-500/10 text-rose-700 border border-rose-400/40";
    if (s === "COMPLETED")
      return "bg-surface-muted text-ink border border-line";
    return "bg-surface-muted text-ink border border-line";
  };

  const getStatusIcon = (st: string) => {
    const s = normalizeStatus(st);
    if (s === "CONFIRMED") return <CheckCircle2Icon size={13} className="mr-1" />;
    if (s === "PENDING") return <AlertCircleIcon size={13} className="mr-1" />;
    if (s === "CANCELLED") return <XCircleIcon size={13} className="mr-1" />;
    return null;
  };

  return (
    <PatientLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Your schedule</p>
          <h1 className="text-2xl font-semibold text-ink">Appointments</h1>
          <p className="mt-1 text-sm text-ink-muted max-w-xl">
            Review upcoming and past appointments. For urgent changes, call your
            clinic directly.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Upcoming</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? upcomingCount : "--"}
            </p>
            <p className="text-xs text-ink-muted">Scheduled visits</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Completed</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? completedCount : "--"}
            </p>
            <p className="text-xs text-ink-muted">Visits finished</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total on record</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? appointments.length : "--"}
            </p>
            <p className="text-xs text-ink-muted">Across all time</p>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="mb-3 rounded-xl border border-amber-500/60 bg-amber-500/10 text-xs text-amber-800 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-ink">Appointment list</h2>
          </div>
          <span className="text-[11px] text-ink-muted">Local time</span>
        </div>

        {status === "loading" && (
          <div className="text-xs text-ink-muted">Loading appointments...</div>
        )}

        {status === "ready" && appointments.length === 0 && (
          <p className="text-xs text-ink-muted">No appointments found.</p>
        )}

        {status === "ready" && appointments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.14em] text-ink-muted border-b border-line">
                  <th className="py-2 pr-4">Date and time</th>
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr
                    key={apt.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-muted transition"
                  >
                    <td className="align-top py-2 pr-4">
                      <div className="text-ink font-medium">
                        {apt.date || "--"}
                      </div>
                      <div className="flex items-center gap-1 text-ink-muted mt-0.5">
                        <ClockIcon size={11} />
                        <span>{apt.time || "--:--"}</span>
                      </div>
                    </td>
                    <td className="align-top py-2 pr-4 text-ink">{apt.doctor}</td>
                    <td className="align-top py-2 pr-4 text-ink-muted">
                      {apt.reason}
                    </td>
                    <td className="align-top py-2 pr-4">
                      <div className="flex items-start gap-1.5 text-ink-muted">
                        <MapPinIcon size={11} className="mt-0.5" />
                        <span>{apt.location || "Clinic"}</span>
                      </div>
                    </td>
                    <td className="align-top py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyles(
                          apt.status
                        )}`}
                      >
                        {getStatusIcon(apt.status)}
                        {normalizeStatus(apt.status)}
                      </span>
                    </td>
                    <td className="align-top py-2 pr-2 text-ink-muted">
                      {apt.notes || "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PatientLayout>
  );
};
