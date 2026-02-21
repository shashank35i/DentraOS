import React, { useEffect, useState } from "react";
import {
  LineChart as LineChartIcon,
  ArrowUpRight as ArrowUpRightIcon,
  ArrowDownRight as ArrowDownRightIcon,
  FileTextIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type RevenueDashboard = {
  thisMonthTotal: number;
  pendingOverdue: number;
  avgPerDay: number;
  growthPercent: number | null;
  last6Months: { label: string; value: number }[];
};

export const AdminRevenue: React.FC = () => {
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        setLoading(true);
        setError(null);
        const [dashboardRes, summaryRes, invoicesRes] = await Promise.all([
          fetch(`${ADMIN_API}/revenue-dashboard`, { headers: getAuthHeaders() }),
          fetch(`${ADMIN_API}/revenue/summary`, { headers: getAuthHeaders() }),
          fetch(`${ADMIN_API}/invoices`, { headers: getAuthHeaders() }),
        ]);

        if (!dashboardRes.ok) throw new Error(`Status ${dashboardRes.status}`);

        const dashboardJson = await dashboardRes.json();
        setData(dashboardJson);

        const summaryJson = summaryRes.ok ? await summaryRes.json() : null;
        setSummary(summaryJson);

        const invoicesJson = invoicesRes.ok ? await invoicesRes.json() : { items: [] };
        setInvoices(Array.isArray(invoicesJson.items) ? invoicesJson.items : []);
      } catch (err) {
        console.error("AdminRevenue error:", err);
        setError("Failed to load revenue data.");
      } finally {
        setLoading(false);
      }
    };
    fetchRevenue();
  }, []);

  const latestReport = Array.isArray(summary?.reports) ? summary.reports[0] : null;

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Financials</p>
          <h1 className="text-2xl font-semibold text-ink">Revenue and performance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Track monthly revenue, compare trends, and understand cashflow at a glance.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">This month</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink">{data ? `Rs ${data.thisMonthTotal.toLocaleString()}` : "--"}</span>
              {data && data.growthPercent != null && (
                <span className={`inline-flex items-center gap-1 text-xs ${data.growthPercent >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {data.growthPercent >= 0 ? <ArrowUpRightIcon size={14} /> : <ArrowDownRightIcon size={14} />}
                  {data.growthPercent.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Pending / overdue</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink">{data ? `Rs ${data.pendingOverdue.toLocaleString()}` : "--"}</span>
              <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                <ArrowDownRightIcon size={14} />
                Needs attention
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Avg. revenue / day</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink">{data ? `Rs ${Math.round(data.avgPerDay).toLocaleString()}` : "--"}</span>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <section className="surface rounded-2xl px-5 py-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LineChartIcon size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-ink">Last 6 months</h2>
          </div>
          {latestReport ? (
            <Link to="/admin/revenue" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              <FileTextIcon size={13} /> View report
            </Link>
          ) : null}
        </div>
        <div className="h-40 rounded-xl border border-line bg-surface-muted flex items-end gap-2 px-4 pb-3">
          {loading || !data
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 animate-pulse">
                  <div className="w-7 rounded-full bg-surface h-1/2" />
                  <span className="text-[10px] text-ink-muted">--</span>
                </div>
              ))
            : data.last6Months.map((m, i) => (
                <div key={m.label + i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-7 rounded-full bg-gradient-to-t from-[color:var(--brand)]/30 via-[color:var(--brand)]/60 to-[color:var(--accent)]/80"
                    style={{ height: `${Math.min(100, (m.value / (data.thisMonthTotal || 1)) * 80 + 20)}%` }}
                  />
                  <span className="text-[10px] text-ink-muted">{m.label.substring(5)}</span>
                </div>
              ))}
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink">Invoices</h2>
          <span className="text-xs text-ink-muted">Click invoice to open details</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface divide-y divide-[color:var(--line)]">
          {invoices.length === 0 ? (
            <div className="px-4 py-4 text-sm text-ink-muted">No invoices found.</div>
          ) : (
            invoices.slice(0, 30).map((inv) => (
              <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-muted">
                <div>
                  <Link to={`/admin/invoices/${inv.id}`} className="text-sm font-semibold text-brand hover:underline">INV-{inv.id}</Link>
                  <p className="text-xs text-ink-muted">{inv.patient_name || "Unknown patient"} · {inv.issue_date || "--"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">Rs {Number(inv.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-ink-muted">{inv.status || "Pending"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
};
