import React, { useEffect, useMemo, useState } from "react";
import { BellIcon, CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type Notif = {
  id: number;
  channel: string | null;
  type: string | null;
  title: string | null;
  message: string;
  status: string;
  created_at: string | null;
  scheduled_at: string | null;
  read_at: string | null;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
};

function notificationHref(n: Notif) {
  const t = String(n.related_entity_type || "").toLowerCase();
  const id = n.related_entity_id;
  if ((t === "appointments" || String(n.type || "").includes("APPOINT")) && id) return `/admin/appointments/${id}`;
  if ((t === "cases" || String(n.type || "").includes("CASE")) && id) return `/admin/cases`;
  if ((t === "purchase_orders" || String(n.type || "").includes("INVENTORY_LOW")) && id) return `/admin/purchase-orders`;
  if ((t === "invoices" || String(n.type || "").includes("REVENUE")) && id) return `/admin/invoices/${id}`;
  return "/admin/alerts";
}

export const AdminNotificationsPage: React.FC = () => {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((n) => String(n.status).toUpperCase() !== "READ");
  }, [items, tab]);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${API_BASE}/api/notifications?includeRead=1`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n)));
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }

  async function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, status: "READ" })));
    await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">System alerts</p>
            <h1 className="text-2xl font-semibold text-ink">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Inventory, revenue, appointment agent alerts, and clinic-wide notices.
            </p>
          </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button onClick={() => setTab("unread")} className={
              tab === "unread" ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"
            }>
                Unread
              </button>
            <button onClick={() => setTab("all")} className={
              tab === "all" ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"
            }>
              All
            </button>
            <button onClick={load} className="ghost-button">
              <RefreshCwIcon size={14} />
              Refresh
            </button>
            <button onClick={readAll} className="btn btn-secondary text-xs">
              <CheckIcon size={14} />
              Mark all read
            </button>
          </div>
        </div>
      </section>

      {err && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-4">
          {err}
        </p>
      )}

      <section className="surface rounded-2xl px-4 py-2">
        {loading ? (
          <div className="px-4 py-6 text-ink-muted text-sm flex items-center gap-2">
            <Loader2Icon className="animate-spin" size={16} /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-ink-muted text-sm">No notifications.</div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {filtered.map((n) => (
              <li key={n.id} className="px-4 py-3 hover:bg-surface-muted">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-ink flex items-center gap-2">
                      <BellIcon size={14} className="text-brand" />
                      {n.title || n.type || "Notification"}
                    </div>
                    <div className="mt-1 text-sm text-ink">{n.message}</div>
                    <div className="mt-2">
                      <Link to={notificationHref(n)} className="text-xs text-brand hover:underline">
                        Open related item
                      </Link>
                    </div>
                    <div className="mt-2 text-[11px] text-ink-muted">
                      {n.created_at || ""}
                      {n.scheduled_at ? (
                        <>
                          <span className="mx-2">-</span>
                          Scheduled: <span className="font-mono">{n.scheduled_at}</span>
                        </>
                      ) : null}
                      <span className="mx-2">-</span>
                      <span className="font-mono">
                        {String(n.status || "").toUpperCase()}
                      </span>
                      <span className="mx-2">-</span>
                      <span className="font-mono">event #{n.id}</span>
                    </div>
                  </div>

                  {String(n.status).toUpperCase() !== "READ" && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="btn btn-secondary text-xs"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};
