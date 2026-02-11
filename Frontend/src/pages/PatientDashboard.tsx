import React, { useEffect, useState } from "react";
import {
  CalendarIcon,
  FileTextIcon,
  CreditCardIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ShieldIcon,
  SparklesIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PatientLayout } from "../layouts/patient/PatientLayout";

type Appointment = {
  id: string;
  date: string | null;
  time: string | null;
  doctorName: string;
  reason: string;
  status: string;
  location: string | null;
};

type TreatmentSummary = {
  id: string;
  title: string;
  lastUpdated: string | null;
  stage: string;
  snippet: string;
};

type Payment = {
  id: string | number;
  date: string | null;
  description: string;
  amount: number;
  currency: string | null;
  status: string;
};

type DashboardResponse = {
  upcomingAppointments: Appointment[];
  treatmentSummaries: TreatmentSummary[];
  payments: Payment[];
  error: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const SkeletonCard: React.FC<{ className: string }> = ({ className = "" }) => (
  <div
    className={
      "rounded-xl border border-line bg-surface-muted p-4 animate-pulse " +
      className
    }
  >
    <div className="h-4 w-24 bg-surface rounded mb-3" />
    <div className="h-3 w-full bg-surface rounded mb-2" />
    <div className="h-3 w-2/3 bg-surface rounded" />
  </div>
);

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

export const PatientDashboard: React.FC = () => {
  const userName = localStorage.getItem("userName") || "Patient";
  const navigate = useNavigate();

  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >([]);
  const [treatmentSummaries, setTreatmentSummaries] = useState<
    TreatmentSummary[]
  >([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus("loading");
        setErrorMsg(null);

        const data = await fetchWithAuth<DashboardResponse>(
          "/api/patient/dashboard"
        );
        if (cancelled) return;

        setUpcomingAppointments(
          Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : []
        );
        setTreatmentSummaries(
          Array.isArray(data.treatmentSummaries) ? data.treatmentSummaries : []
        );
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        console.error("PATIENT DASHBOARD ERROR", err);

        if (err.code === "NO_TOKEN" || err.status === 401) {
          setErrorMsg("Session expired. Please log in again.");
          setStatus("error");
          navigate("/loginrole=patient");
        } else {
          setErrorMsg(err.message || "Failed to load dashboard.");
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const pendingCount = payments.filter(
    (p) => p.status.toUpperCase() !== "PAID"
  ).length;

  const currencyLabel =
    payments.length === 0
      ? "Rs "
      : payments[0].currency === "INR" || !payments[0].currency
        ? "Rs "
        : `${payments[0].currency} `;

  return (
    <PatientLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="surface rounded-2xl px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="section-title flex items-center gap-2">
                <SparklesIcon size={14} className="text-brand" />
                Patient overview
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                Hi {userName}, welcome back.
              </h1>
              <p className="mt-2 text-sm text-ink-muted max-w-xl">
                Snapshot of your upcoming visits, active treatments, and recent
                billing activity.
              </p>
            </div>

            <div className="pill">
              <ShieldIcon size={14} className="text-brand" />
              <span>Clinic-managed data</span>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 text-xs text-amber-800 px-4 py-2">
            {errorMsg}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CalendarIcon size={18} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-ink-muted">Upcoming visits</p>
                <p className="text-2xl font-semibold text-ink">
                  {status === "ready" ? upcomingAppointments.length : "--"}
                </p>
              </div>
            </div>
            <Link to="/patient/appointments" className="text-xs text-brand">
              Open schedule <ChevronRightIcon size={14} className="inline" />
            </Link>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                <FileTextIcon size={18} className="text-sky-700" />
              </div>
              <div>
                <p className="text-xs text-ink-muted">Active treatments</p>
                <p className="text-2xl font-semibold text-ink">
                  {status === "ready" ? treatmentSummaries.length : "--"}
                </p>
              </div>
            </div>
            <Link to="/patient/treatments" className="text-xs text-brand">
              View details <ChevronRightIcon size={14} className="inline" />
            </Link>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <CreditCardIcon size={18} className="text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-ink-muted">Pending invoices</p>
                <p className="text-2xl font-semibold text-ink">
                  {status === "ready" ? pendingCount : "--"}
                </p>
              </div>
            </div>
            <Link to="/patient/billing" className="text-xs text-brand">
              Open billing <ChevronRightIcon size={14} className="inline" />
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.25fr,1fr] gap-6">
          <div className="space-y-6">
            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={18} className="text-emerald-700" />
                  <h2 className="text-sm font-semibold text-ink">
                    Upcoming appointments
                  </h2>
                </div>
                <span className="text-[11px] text-ink-muted flex items-center">
                  <ClockIcon size={12} className="mr-1" />
                  Local time
                </span>
              </div>

              {status === "loading" && (
                <div className="space-y-3">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )}

              {status === "error" && !upcomingAppointments.length && (
                <p className="text-xs text-amber-700">
                  Could not load your schedule. Please refresh later.
                </p>
              )}

              {status === "ready" && (
                <>
                  {upcomingAppointments.length === 0 ? (
                    <p className="text-xs text-ink-muted">
                      No upcoming appointments on file.
                    </p>
                  ) : (
                    <ul className="space-y-3 text-xs">
                      {upcomingAppointments.map((apt, index) => (
                        <li
                          key={apt.id}
                          className="relative flex gap-3 bg-surface-muted border border-line rounded-lg px-3 py-2.5"
                        >
                          <div className="flex flex-col items-center pt-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {index !== upcomingAppointments.length - 1 && (
                              <span className="flex-1 w-px bg-line mt-1" />
                            )}
                          </div>

                          <div className="flex-1">
                            <p className="font-medium text-ink">
                              {apt.date} - {apt.time}
                            </p>
                            <p className="text-ink-muted mt-0.5">
                              {apt.reason}
                            </p>
                            <p className="text-ink-muted mt-0.5">
                              With <span className="text-ink">{apt.doctorName}</span>
                              {apt.location && (
                                <>
                                  {" "}- <span className="text-ink-muted">{apt.location}</span>
                                </>
                              )}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={
                                "px-2 py-1 rounded-full text-[10px] font-semibold border " +
                                (apt.status.toUpperCase() === "CONFIRMED"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/40"
                                  : "bg-surface text-ink-muted border-line")
                              }
                            >
                              {apt.status}
                            </span>
                            <Link
                              to="/patient/appointments"
                              className="text-[11px] text-brand"
                            >
                              Open details
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileTextIcon size={18} className="text-sky-700" />
                  <h2 className="text-sm font-semibold text-ink">
                    Treatment summaries
                  </h2>
                </div>
                <span className="text-[11px] text-ink-muted flex items-center">
                  <CheckCircle2Icon size={12} className="mr-1 text-emerald-600" />
                  AI-assisted notes
                </span>
              </div>

              {status === "loading" && (
                <div className="space-y-3">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )}

              {status === "error" && !treatmentSummaries.length && (
                <p className="text-xs text-amber-700">
                  Could not load treatment history.
                </p>
              )}

              {status === "ready" && (
                <>
                  {treatmentSummaries.length === 0 ? (
                    <p className="text-xs text-ink-muted">
                      No treatment summaries available yet.
                    </p>
                  ) : (
                    <ul className="space-y-3 text-xs">
                      {treatmentSummaries.map((t) => (
                        <li
                          key={t.id}
                          className="bg-surface-muted border border-line rounded-lg px-3 py-3"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="font-medium text-ink">{t.title}</p>
                            <span className="text-[10px] text-ink-muted">
                              Updated: {t.lastUpdated}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-700 mb-1">
                            Stage: {t.stage}
                          </p>
                          <p className="text-ink-muted text-[11px] leading-relaxed">
                            {t.snippet}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCardIcon size={18} className="text-amber-700" />
                  <h2 className="text-sm font-semibold text-ink">
                    Payments and invoices
                  </h2>
                </div>
                <Link
                  to="/patient/billing"
                  className="text-[11px] text-brand"
                >
                  Open billing <ChevronRightIcon size={14} className="inline" />
                </Link>
              </div>

              {status === "loading" && (
                <div className="space-y-3">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )}

              {status === "error" && !payments.length && (
                <p className="text-xs text-amber-700">
                  Could not load billing details.
                </p>
              )}

              {status === "ready" && (
                <>
                  {payments.length === 0 ? (
                    <p className="text-xs text-ink-muted">No invoices yet.</p>
                  ) : (
                    <ul className="space-y-3 text-xs">
                      {payments.map((p) => (
                        <li
                          key={p.id}
                          className="flex justify-between items-center bg-surface-muted border border-line rounded-lg px-3 py-2.5"
                        >
                          <div>
                            <p className="font-medium text-ink">
                              {p.description}
                            </p>
                            <p className="text-ink-muted mt-0.5">
                              {p.date} - {p.id}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-amber-700">
                              {currencyLabel}
                              {Number(p.amount || 0).toLocaleString("en-IN")}
                            </p>
                            <span
                              className={
                                "inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border " +
                                (p.status.toUpperCase() === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/40"
                                  : "bg-amber-500/10 text-amber-700 border-amber-400/40")
                              }
                            >
                              {p.status.toUpperCase() === "PAID" ? (
                                <CheckCircle2Icon size={11} className="mr-1" />
                              ) : (
                                <AlertCircleIcon size={11} className="mr-1" />
                              )}
                              {p.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="surface rounded-2xl px-4 py-4 flex items-start gap-3 text-[11px]">
              <ShieldIcon size={16} className="text-emerald-700 mt-0.5" />
              <div>
                <p className="font-semibold text-ink mb-1">
                  Data from your clinic
                </p>
                <p className="text-ink-muted">
                  Appointment, treatment, and billing data refresh automatically
                  from the clinic system.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PatientLayout>
  );
};
