// src/pages/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Package,
  LineChart,
  ClipboardList,
  Users,
  Activity,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function readJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  return { message: text };
}

type DashboardSummary = {
  todayAppointments: number;
  todayAppointmentsDelta: number;
  lowStockItems: number;
  todaysRevenue: number;
  todaysRevenueDeltaPercent: number | null;
  activeCases: number;
  casePipeline: {
    new: number;
    inTreatment: number;
    awaitingFollowUp: number;
  };
  patientSnapshot: {
    newPatientsToday: number;
    returningPatientsToday: number;
    cancelledAppointmentsToday: number;
  };
  asOf: string;
};

export const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userName = localStorage.getItem("userName") || "Admin";
  const clinicName = "Dental Clinic Intelligence";

  useEffect(() => {
    const ac = new AbortController();

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${ADMIN_API}/dashboard-summary`, {
          headers: getAuthHeaders(),
          signal: ac.signal,
        });

        const data = await readJsonOrText(res);

        if (!res.ok) {
          const msg =
            data.error ||
            data.message ||
            `Failed to load dashboard summary (HTTP ${res.status})`;
          throw new Error(msg);
        }

        setSummary(data);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Dashboard summary error:", err);
        setError(err.message || "Failed to load dashboard summary.");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl px-6 py-5 reveal">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="section-title">Executive overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              Good to see you, {userName}.
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Live operational snapshot for{" "}
              <span className="font-semibold text-ink">{clinicName}</span> across
              appointments, inventory, revenue, and active cases.
            </p>
            {summary && (
              <p className="mt-1 text-xs text-ink-muted">
                As of <span className="font-mono">{summary.asOf}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="pill">
              <Activity size={13} />
              {loading ? "Loading dashboards..." : "Realtime dashboards on"}
            </span>
            {error && <span className="text-[11px] text-[color:var(--danger)]">{error}</span>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="kpi-card reveal">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">Today appointments</span>
            <div className="w-8 h-8 rounded-full bg-[color:var(--brand)]/10 flex items-center justify-center">
              <CalendarDays size={16} className="text-brand" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-ink">
            {summary ? summary.todayAppointments : "--"}
          </p>
          <p className="text-xs text-brand">
            {summary
              ? `+${summary.todayAppointmentsDelta} vs last week`
              : "Loading..."}
          </p>
        </div>

        <div className="kpi-card reveal">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">Low-stock items</span>
            <div className="w-8 h-8 rounded-full bg-[color:var(--accent)]/15 flex items-center justify-center">
              <Package size={16} className="text-[color:var(--accent)]" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-ink">
            {summary ? summary.lowStockItems : "--"}
          </p>
          <p className="text-xs text-[color:var(--accent)]">Inventory agent watching</p>
        </div>

        <div className="kpi-card reveal">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">Today revenue</span>
            <div className="w-8 h-8 rounded-full bg-[color:var(--brand)]/10 flex items-center justify-center">
              <LineChart size={16} className="text-brand" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-ink">
            {summary ? `INR ${summary.todaysRevenue.toLocaleString()}` : "--"}
          </p>
          <p className="text-xs text-brand">
            {summary && summary.todaysRevenueDeltaPercent != null
              ? `${summary.todaysRevenueDeltaPercent.toFixed(1)}% vs 7-day avg`
              : "Loading..."}
          </p>
        </div>

        <div className="kpi-card reveal">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">Active cases</span>
            <div className="w-8 h-8 rounded-full bg-[color:var(--success)]/12 flex items-center justify-center">
              <ClipboardList size={16} className="text-[color:var(--success)]" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-ink">
            {summary ? summary.activeCases : "--"}
          </p>
          <p className="text-xs text-[color:var(--success)]">Case agent tracking</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr] gap-4">
        <div className="surface rounded-2xl p-5 reveal">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[color:var(--success)]" />
              <h2 className="text-sm font-semibold text-ink">Case pipeline</h2>
            </div>
            <span className="text-[11px] text-ink-muted">From case tracking agent</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {summary ? (
              <>
                {Object.entries(summary.casePipeline).map(([key, value]) => (
                  <div
                    key={key}
                    className="surface-muted rounded-xl p-3 border border-line"
                  >
                    <p className="text-ink-muted capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-ink-muted">Loading...</p>
            )}
          </div>
        </div>

        <div className="surface rounded-2xl p-5 reveal">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand" />
              <h2 className="text-sm font-semibold text-ink">Patients snapshot</h2>
            </div>
            <span className="text-[11px] text-ink-muted">Today</span>
          </div>

          <ul className="space-y-2 text-xs text-ink-muted">
            <li className="flex justify-between">
              <span>New patients registered</span>
              <span className="font-semibold text-ink">
                {summary ? summary.patientSnapshot.newPatientsToday : "--"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Returning patients</span>
              <span className="font-semibold text-ink">
                {summary ? summary.patientSnapshot.returningPatientsToday : "--"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Cancelled appointments</span>
              <span className="font-semibold text-[color:var(--warn)]">
                {summary ? summary.patientSnapshot.cancelledAppointmentsToday : "--"}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
