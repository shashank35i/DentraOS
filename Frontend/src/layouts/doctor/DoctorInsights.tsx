import React, { useEffect, useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { DoctorLayout } from "../../layouts/doctor/DoctorLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const DoctorInsights: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    hasData: false,
    metrics: {
      chairUtilization: 0,
      followUpRate: 0,
      cancellationRate: 0,
      caseVelocity: 0,
    },
    positiveSignals: [],
    watchList: [],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/doctor/insights-summary`, {
          headers: authHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || `Status ${res.status}`);
        setData(json || {});
      } catch (e: any) {
        setError(e.message || "Failed to load insights");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const metrics = data?.metrics || {};
  const positiveSignals = Array.isArray(data?.positiveSignals) ? data.positiveSignals : [];
  const watchList = Array.isArray(data?.watchList) ? data.watchList : [];

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Practice signals</p>
          <h1 className="text-2xl font-semibold text-ink">Insights</h1>
          <p className="mt-1 text-sm text-ink-muted max-w-2xl">
            A live summary of your appointments, case progress, and follow-ups.
          </p>
        </div>

        {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Chair utilization</p>
            <p className="text-2xl font-semibold text-ink">{loading ? "--" : `${Number(metrics.chairUtilization || 0)}%`}</p>
            <p className="text-xs text-ink-muted">Completed appointments (last 4 weeks)</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Follow-ups</p>
            <p className="text-2xl font-semibold text-ink">{loading ? "--" : `${Number(metrics.followUpRate || 0)}%`}</p>
            <p className="text-xs text-ink-muted">Cases with next-review dates</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Cancellations</p>
            <p className="text-2xl font-semibold text-ink">{loading ? "--" : `${Number(metrics.cancellationRate || 0)}%`}</p>
            <p className="text-xs text-ink-muted">Cancelled + no-show rate</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Case velocity</p>
            <p className="text-2xl font-semibold text-ink">{loading ? "--" : Number(metrics.caseVelocity || 0)}</p>
            <p className="text-xs text-ink-muted">Timeline touchpoints (last 14 days)</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2Icon size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-ink">Positive signals</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink-muted">
            {loading ? (
              <li className="text-xs text-ink-muted">Loading signals...</li>
            ) : positiveSignals.length ? (
              positiveSignals.map((text: string, idx: number) => (
                <li key={`${text}-${idx}`} className="flex items-start gap-2">
                  <CheckCircle2Icon size={13} className="mt-0.5 text-emerald-600" />
                  <span>{text}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-ink-muted">No positive signals yet.</li>
            )}
          </ul>
        </div>

        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircleIcon size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-ink">Watch list</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink-muted">
            {loading ? (
              <li className="text-xs text-ink-muted">Loading watch list...</li>
            ) : watchList.length ? (
              watchList.map((text: string, idx: number) => (
                <li key={`${text}-${idx}`} className="flex items-start gap-2">
                  <AlertCircleIcon size={13} className="mt-0.5 text-amber-600" />
                  <span>{text}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-ink-muted">No watch-list alerts right now.</li>
            )}
          </ul>
        </div>
      </section>
    </DoctorLayout>
  );
};
