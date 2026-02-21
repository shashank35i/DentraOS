import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export const AdminInventoryItemDetails: React.FC = () => {
  const { itemCode } = useParams();
  const [item, setItem] = useState<any | null>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!itemCode) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/admin/inventory/${encodeURIComponent(itemCode)}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
        setItem(data.item || null);
        setUsage(Array.isArray(data.usage) ? data.usage : []);
      } catch (e: any) {
        setError(e.message || "Failed to load item details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [itemCode]);

  return (
    <section className="surface rounded-2xl px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/admin/inventory" className="btn btn-secondary text-xs inline-flex items-center gap-1"><ArrowLeftIcon size={14} /> Back to inventory</Link>
        <Link to="/admin/purchase-orders" className="btn btn-secondary text-xs">View draft PO</Link>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted inline-flex items-center gap-2"><Loader2Icon size={16} className="animate-spin" /> Loading...</div>
      ) : error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : !item ? (
        <div className="text-sm text-ink-muted">Item not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="kpi-card"><p className="text-xs text-ink-muted">Item</p><p className="font-semibold text-ink">{item.item_code || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Stock</p><p className="font-semibold text-ink">{item.stock ?? "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Threshold</p><p className="font-semibold text-ink">{item.reorder_threshold ?? "--"}</p></div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-3">
            <h3 className="text-sm font-semibold text-ink mb-2">Recent usage</h3>
            {usage.length === 0 ? <p className="text-xs text-ink-muted">No usage records.</p> : (
              <ul className="space-y-2">
                {usage.map((u) => (
                  <li key={u.id} className="text-xs text-ink-muted">{u.item_name || u.item_code} · -{u.qty_used} · {String(u.created_at || "").replace("T", " ").slice(0, 19)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
