import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2Icon, ArrowLeftIcon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export const AdminAppointmentDetails: React.FC = () => {
  const { id } = useParams();
  const [item, setItem] = useState<any | null>(null);
  const [agent, setAgent] = useState<any | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusRaw = String(item?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const isTerminalStatus =
    statusRaw === "completed" || statusRaw === "cancelled" || statusRaw === "no-show";
  const canComplete = !isTerminalStatus;
  const canCancel = !isTerminalStatus;

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/appointments/${id}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      setItem(data.item || null);
      await loadAgentStatus();
    } catch (e: any) {
      setError(e.message || "Failed to load appointment details");
    } finally {
      setLoading(false);
    }
  };

  const loadAgentStatus = async () => {
    if (!id) return;
    const res = await fetch(`${API_BASE}/api/appointments/${id}/agent-status`, {
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setAgent(data.latest || null);
    setLastCheckedAt(new Date().toISOString());
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const status = String(agent?.status || "").toUpperCase();
    if (status !== "NEW" && status !== "PROCESSING") return;
    const timer = window.setInterval(() => {
      loadAgentStatus();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [id, agent?.status]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    try {
      const isComplete = String(status).toLowerCase() === "completed";
      const url = isComplete
        ? `${API_BASE}/api/admin/appointments/${id}/complete`
        : `${API_BASE}/api/admin/appointments/${id}`;
      const method = "PATCH";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: isComplete ? undefined : JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to update appointment status");
    }
  };

  return (
    <section className="surface rounded-2xl px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/admin/schedule" className="btn btn-secondary text-xs inline-flex items-center gap-1">
          <ArrowLeftIcon size={14} /> Back to schedule
        </Link>
        <span className="text-xs text-ink-muted">Appointment details</span>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted inline-flex items-center gap-2"><Loader2Icon size={16} className="animate-spin" /> Loading...</div>
      ) : error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : !item ? (
        <div className="text-sm text-ink-muted">Appointment not found.</div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="kpi-card"><p className="text-xs text-ink-muted">Appointment</p><p className="font-semibold text-ink">{item.appointment_uid || item.id}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Status</p><p className="font-semibold text-ink">{item.status || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Patient</p><p className="font-semibold text-ink">{item.patient_name || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Doctor</p><p className="font-semibold text-ink">{item.doctor_name || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Time</p><p className="font-semibold text-ink">{item.scheduled_date} {item.scheduled_time}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Linked case</p><p className="font-semibold text-ink">{item.case_uid || "--"}</p></div>
          </div>

          <div className="rounded-2xl border border-line p-3 bg-surface-muted">
            <p className="text-xs text-ink-muted mb-1">Notes</p>
            <p className="text-ink">{item.notes || "No notes"}</p>
          </div>

          <div className="rounded-2xl border border-line p-3 bg-surface-muted">
            <p className="text-xs text-ink-muted mb-1">Appointment Agent</p>
            {agent ? (
              <div className="space-y-1">
                <p className="text-sm text-ink">
                  {agent.status === "DONE"
                    ? `Done (${agent.eventType})`
                    : agent.status === "FAILED"
                    ? `Failed (${agent.eventType})`
                    : `Running (${agent.eventType})`}
                </p>
                <p className="text-xs text-ink-muted">
                  Event #{agent.eventId} · updated {agent.updatedAt || "--"}
                </p>
                {agent.lastError ? (
                  <p className="text-xs text-rose-700">Error: {String(agent.lastError).slice(0, 160)}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">No recent automation events for this appointment.</p>
            )}
            {lastCheckedAt ? (
              <p className="mt-1 text-[11px] text-ink-muted">Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-ink">Consumables</p>
              {item.invoice?.id ? <Link className="text-xs text-brand underline" to={`/admin/invoices/${item.invoice.id}`}>View invoice</Link> : null}
            </div>
            {!item.consumables?.length ? <p className="text-xs text-ink-muted">No consumables logged.</p> : (
              <ul className="space-y-2">
                {item.consumables.map((c: any) => (
                  <li key={c.id} className="text-xs text-ink-muted">{c.item_name || c.item_code || "Item"} - {c.qty_used}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => updateStatus("Completed")}
              disabled={!canComplete}
              title={canComplete ? "Mark appointment as completed" : "Completed/cancelled/no-show appointments are read-only"}
            >
              Complete
            </button>
            <button
              className="btn btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => updateStatus("Cancelled")}
              disabled={!canCancel}
              title={canCancel ? "Cancel appointment" : "Completed/cancelled/no-show appointments are read-only"}
            >
              Cancel
            </button>
            <button
              className="btn btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
              title="No-show is managed automatically by Appointment Agent after the grace window"
            >
              No-show (Auto)
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
