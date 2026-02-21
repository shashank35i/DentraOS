import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { DoctorLayout } from "./DoctorLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export const DoctorAppointmentDetails: React.FC = () => {
  const { id } = useParams();
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [agent, setAgent] = useState<any | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [savingConsumables, setSavingConsumables] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [consumablesDraft, setConsumablesDraft] = useState<Array<{ itemCode: string; qty: number; unit?: string }>>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const statusNormalized = String(item?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const isTerminalStatus =
    statusNormalized === "completed" || statusNormalized === "cancelled" || statusNormalized === "no-show";
  const canComplete = !isTerminalStatus;

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/doctor/appointments/${id}`, {
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

  const loadInventory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/doctor/inventory`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      setInventoryItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message || "Failed to load inventory catalog");
    }
  };

  const loadConsumables = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/doctor/appointments/${id}/consumables`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      const items = Array.isArray(data.items) ? data.items : [];
      const mapped = items
        .map((r: any) => ({
          itemCode: String(r.item_code || r.item_ref || "").trim(),
          qty: Number(r.qty || 1),
          unit: r.unit || undefined,
        }))
        .filter((r: any) => !!r.itemCode && Number.isFinite(r.qty) && r.qty > 0);
      setConsumablesDraft(mapped);
    } catch (e: any) {
      setError(e.message || "Failed to load appointment consumables");
    }
  };

  useEffect(() => {
    loadInventory();
    loadConsumables();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    try {
      const isComplete = String(status).toLowerCase() === "completed";
      const url = isComplete
        ? `${API_BASE}/api/doctor/appointments/${id}/complete`
        : `${API_BASE}/api/doctor/appointments/${id}`;
      const res = await fetch(url, {
        method: "PATCH",
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

  const addConsumable = () => {
    const code = String(newItemCode || "").trim();
    const qty = Number(newQty || 0);
    if (!code) {
      setToast("Select an item first");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setToast("Quantity must be at least 1");
      return;
    }
    setConsumablesDraft((prev) => {
      const idx = prev.findIndex((p) => p.itemCode === code);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { itemCode: code, qty }];
    });
    setNewItemCode("");
    setItemSearch("");
    setNewQty(1);
  };

  const removeConsumable = (code: string) => {
    setConsumablesDraft((prev) => prev.filter((p) => p.itemCode !== code));
  };

  const updateConsumableQty = (code: string, qty: number) => {
    setConsumablesDraft((prev) =>
      prev.map((p) => (p.itemCode === code ? { ...p, qty: Math.max(1, Number(qty || 1)) } : p))
    );
  };

  const saveConsumables = async () => {
    if (!id) return;
    try {
      setSavingConsumables(true);
      setError(null);
      setToast(null);
      const payload = {
        items: consumablesDraft.map((c) => ({
          itemRef: c.itemCode,
          item_code: c.itemCode,
          inventory_item_id: c.itemCode,
          qty: c.qty,
          qty_used: c.qty,
          unit: c.unit || "pcs",
        })),
      };
      const res = await fetch(`${API_BASE}/api/doctor/appointments/${id}/consumables`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      setToast("Consumables saved");
      await Promise.all([load(), loadConsumables()]);
    } catch (e: any) {
      setError(e.message || "Failed to save consumables");
    } finally {
      setSavingConsumables(false);
    }
  };

  const filteredInventory = inventoryItems.filter((it) => {
    if (!itemSearch.trim()) return true;
    const q = itemSearch.toLowerCase();
    return String(it.name || "").toLowerCase().includes(q) || String(it.itemCode || it.id || "").toLowerCase().includes(q);
  });

  const itemLabel = (code: string) => {
    const found = inventoryItems.find((it) => (it.itemCode || it.id) === code);
    return found ? `${found.name} (${found.itemCode || found.id})` : code;
  };

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link to="/doctor/schedule" className="btn btn-secondary text-xs inline-flex items-center gap-1">
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
            {toast && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{toast}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="kpi-card"><p className="text-xs text-ink-muted">Appointment</p><p className="font-semibold text-ink">{item.appointment_uid || item.id}</p></div>
              <div className="kpi-card"><p className="text-xs text-ink-muted">Status</p><p className="font-semibold text-ink">{item.status || "--"}</p></div>
              <div className="kpi-card"><p className="text-xs text-ink-muted">Patient</p><p className="font-semibold text-ink">{item.patient_name || "--"}</p></div>
              <div className="kpi-card"><p className="text-xs text-ink-muted">Time</p><p className="font-semibold text-ink">{item.scheduled_date} {item.scheduled_time}</p></div>
              <div className="kpi-card"><p className="text-xs text-ink-muted">Reason</p><p className="font-semibold text-ink">{item.type || "--"}</p></div>
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
              <p className="font-semibold text-ink mb-2">Consumables</p>
              {!consumablesDraft.length ? <p className="text-xs text-ink-muted mb-3">No consumables selected.</p> : (
                <div className="mb-3 space-y-2">
                  {consumablesDraft.map((c) => (
                    <div key={c.itemCode} className="flex items-center justify-between rounded-lg border border-line px-2 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink truncate">{itemLabel(c.itemCode)}</p>
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={c.qty}
                          onChange={(e) => updateConsumableQty(c.itemCode, Number(e.target.value || 1))}
                          className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                        />
                        <button type="button" className="btn btn-secondary text-xs" onClick={() => removeConsumable(c.itemCode)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-line p-2 bg-surface-muted space-y-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-lg border border-line bg-surface px-2 py-2 text-xs"
                    placeholder="Search item by name/code"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-line bg-surface px-2 py-2 text-xs"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                  >
                    <option value="">Select item</option>
                    {filteredInventory.map((it) => {
                      const code = it.itemCode || it.id;
                      return (
                        <option key={code} value={code}>
                          {it.name} ({code}) - stock {it.stock}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-lg border border-line bg-surface px-2 py-2 text-xs"
                      value={newQty}
                      onChange={(e) => setNewQty(Number(e.target.value || 1))}
                    />
                    <button type="button" className="btn btn-secondary text-xs" onClick={addConsumable}>
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" className="btn btn-primary text-xs" onClick={saveConsumables} disabled={savingConsumables}>
                    {savingConsumables ? "Saving..." : "Save consumables"}
                  </button>
                </div>
              </div>
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
                disabled
                title="No-show is managed automatically by Appointment Agent after the grace window"
              >
                No-show (Auto)
              </button>
            </div>
          </div>
        )}
      </section>
    </DoctorLayout>
  );
};
