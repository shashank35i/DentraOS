import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DoctorLayout } from "../../layouts/doctor/DoctorLayout";

type DoctorAppointment = {
  dbId: number;
  id: string;
  date: string | null;
  time: string | null;
  patient: string;
  reason: string;
  room: string;
  status: string;
};

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

const getAuthToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token") || "";

const norm = (s: any) => String(s || "").trim().toUpperCase();

function mapStatusToUiLabel(raw: any) {
  const s = norm(raw);
  if (s === "CONFIRMED") return "Confirmed";
  if (s === "CHECKED IN") return "In progress";
  if (s === "IN PROGRESS") return "In progress";
  if (s === "COMPLETED") return "Completed";
  if (s === "CANCELLED") return "Cancelled";
  if (s === "PENDING") return "Pending";
  if (!s) return "Pending";
  return String(raw);
}

function canCompleteStatus(raw: any) {
  const s = norm(raw);
  if (!s) return false;
  if (s === "COMPLETED" || s === "CANCELLED") return false;
  return (
    s === "CONFIRMED" ||
    s === "CHECKED IN" ||
    s === "IN PROGRESS" ||
    s === "PENDING" ||
    s === "SCHEDULED"
  );
}

function statusPillClass(raw: any) {
  const s = norm(raw);

  if (s === "CONFIRMED")
    return "bg-emerald-500/10 text-emerald-700 border-emerald-400/40";
  if (s === "CHECKED IN" || s === "IN PROGRESS")
    return "bg-sky-500/10 text-sky-700 border-sky-400/40";
  if (s === "COMPLETED")
    return "bg-emerald-500/10 text-emerald-700 border-emerald-400/40";
  if (s === "CANCELLED")
    return "bg-rose-500/10 text-rose-700 border-rose-400/40";
  if (s === "PENDING")
    return "bg-amber-500/10 text-amber-700 border-amber-400/40";

  return "bg-surface-muted text-ink border-line";
}

export const DoctorAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const totalCount = appointments.length;
  const actionableCount = useMemo(() => {
    return appointments.filter((a) => canCompleteStatus(a.status)).length;
  }, [appointments]);
  const completedCount = useMemo(() => {
    return appointments.filter((a) => norm(a.status) === "COMPLETED").length;
  }, [appointments]);
  const cancelledCount = useMemo(() => {
    return appointments.filter((a) => norm(a.status) === "CANCELLED").length;
  }, [appointments]);

  async function fetchAppointments() {
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please login again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/doctor/appointments`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Failed to load appointments");
      }

      const items: DoctorAppointment[] = (body.items || []).map((x: any) => ({
        dbId: Number(x.dbId - x.id),
        id: String(x.id - x.appointment_uid - x.appointmentUid - x.dbId - ""),
        date: x.date - null,
        time: x.time - null,
        patient: x.patient - "--",
        reason: x.reason - x.type - "General visit",
        room: x.room - "--",
        status: mapStatusToUiLabel(x.status),
      }));

      setAppointments(items);
    } catch (err: any) {
      console.error("Doctor appointments error:", err);
      setError(err.message || "Unable to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAppointments();
  }, []);

  async function markCompleted(dbId: number) {
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please login again.");
      return;
    }

    try {
      setCompletingId(dbId);

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/appointments/${dbId}/complete`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Failed to mark completed");
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.dbId === dbId ? { ...a, status: "Completed" } : a
        )
      );
    } catch (e: any) {
      console.error("Complete appointment error:", e);
      setError(e.message || "Could not complete appointment");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">Daily schedule</p>
            <h1 className="text-2xl font-semibold text-ink">
              Appointments
            </h1>
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">
              Review today&apos;s visits, track status, and close out completed
              sessions directly from this workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={fetchAppointments}
              className="ghost-button"
              title="Refresh"
            >
              <RefreshCwIcon size={14} />
              Refresh
            </button>
            <Link
              to="/doctor/overview"
              className="btn btn-secondary text-xs"
            >
              Overview
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total visits</p>
            <p className="text-2xl font-semibold text-ink">{totalCount}</p>
            <p className="text-xs text-ink-muted">Scheduled today</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Actionable</p>
            <p className="text-2xl font-semibold text-ink">{actionableCount}</p>
            <p className="text-xs text-ink-muted">Ready to close</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Completed</p>
            <p className="text-2xl font-semibold text-ink">{completedCount}</p>
            <p className="text-xs text-ink-muted">Marked finished</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Cancelled</p>
            <p className="text-2xl font-semibold text-ink">{cancelledCount}</p>
            <p className="text-xs text-ink-muted">Not seen</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-ink">Today&apos;s list</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ClockIcon size={13} />
            <span>Local time</span>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-ink-muted">
            Loading today&apos;s appointments...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-800">
            <AlertCircleIcon size={14} className="mt-0.5" />
            <div>
              <p className="font-semibold">Could not load appointments</p>
              <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
            </div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-muted">
            No appointments scheduled for today.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-ink-muted border-b border-line">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Patient</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 pr-4 font-medium">Room</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Actions</th>
                  <th className="py-2 pr-2 font-medium text-right">ID</th>
                </tr>
              </thead>

              <tbody>
                {appointments.map((a) => {
                  const showButton = canCompleteStatus(a.status);

                  return (
                    <tr
                      key={a.dbId}
                      className="border-b border-line last:border-b-0 hover:bg-surface-muted transition"
                    >
                      <td className="py-2 pr-4 align-top">
                        <div className="inline-flex rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink">
                          {a.date || "--"} - {a.time || "--:--"}
                        </div>
                      </td>

                      <td className="py-2 pr-4 align-top text-ink">
                        {a.patient}
                      </td>
                      <td className="py-2 pr-4 align-top text-ink-muted">
                        {a.reason}
                      </td>
                      <td className="py-2 pr-4 align-top text-ink-muted">
                        {a.room || "--"}
                      </td>

                      <td className="py-2 pr-4 align-top">
                        <span
                          className={[
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            statusPillClass(a.status),
                          ].join(" ")}
                        >
                          {a.status}
                        </span>
                      </td>

                      <td className="py-2 pr-4 align-top">
                        {showButton ? (
                          <button
                            type="button"
                            disabled={completingId === a.dbId}
                            onClick={() => markCompleted(a.dbId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-60"
                          >
                            <CheckCircle2Icon size={14} />
                            {completingId === a.dbId
                              ? "Completing..."
                              : "Mark completed"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-muted">--</span>
                        )}
                      </td>

                      <td className="py-2 pr-2 align-top text-right text-ink-muted font-mono">
                        {a.id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DoctorLayout>
  );
};
