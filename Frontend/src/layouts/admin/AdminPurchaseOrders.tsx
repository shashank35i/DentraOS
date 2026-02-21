import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2Icon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export const AdminPurchaseOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/purchase-orders`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      setOrders(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id: number) => {
    setSelectedId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/purchase-orders/${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
      setSelected(data.item || null);
      setLineItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message || "Failed to load PO details");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="surface rounded-2xl px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="section-title">Procurement</p>
          <h1 className="text-2xl font-semibold text-ink">Purchase orders</h1>
        </div>
        <Link to="/admin/inventory" className="btn btn-secondary text-xs">Back to inventory</Link>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted inline-flex items-center gap-2"><Loader2Icon size={16} className="animate-spin" /> Loading...</div>
      ) : error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface">
            {orders.length === 0 ? (
              <div className="p-4 text-sm text-ink-muted">No purchase orders.</div>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {orders.map((po) => (
                  <li key={po.id}>
                    <button
                      type="button"
                      onClick={() => loadDetails(Number(po.id))}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-muted ${selectedId === Number(po.id) ? "bg-surface-muted" : ""}`}
                    >
                      <div className="text-sm font-semibold text-ink">PO #{po.id}</div>
                      <div className="text-xs text-ink-muted">{po.vendor_name || "Unknown vendor"} · {po.status || "Draft"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            {!selected ? (
              <p className="text-sm text-ink-muted">Select a purchase order to view details.</p>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-ink">PO #{selected.id}</h3>
                <p className="text-xs text-ink-muted mt-1">Vendor: {selected.vendor_name || "--"} · Status: {selected.status || "--"}</p>
                <div className="mt-3 space-y-2">
                  {lineItems.length === 0 ? (
                    <p className="text-xs text-ink-muted">No line items.</p>
                  ) : (
                    lineItems.map((li) => (
                      <div key={li.id} className="rounded-xl border border-line bg-surface-muted p-2 text-xs text-ink">
                        {(li.item_name || li.item_code || "Item") + ` · Qty ${li.qty || 0}`}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
