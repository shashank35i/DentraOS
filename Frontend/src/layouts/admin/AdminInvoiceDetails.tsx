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

export const AdminInvoiceDetails: React.FC = () => {
  const { invoiceId } = useParams();
  const [item, setItem] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!invoiceId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/admin/invoices/${invoiceId}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Status ${res.status}`);
        setItem(data.item || null);
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        setError(e.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [invoiceId]);

  return (
    <section className="surface rounded-2xl px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/admin/revenue" className="btn btn-secondary text-xs inline-flex items-center gap-1">
          <ArrowLeftIcon size={14} /> Back to revenue
        </Link>
        <span className="text-xs text-ink-muted">Invoice details</span>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted inline-flex items-center gap-2"><Loader2Icon size={16} className="animate-spin" /> Loading...</div>
      ) : error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : !item ? (
        <div className="text-sm text-ink-muted">Invoice not found.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div className="kpi-card"><p className="text-xs text-ink-muted">Invoice</p><p className="font-semibold text-ink">INV-{item.id}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Status</p><p className="font-semibold text-ink">{item.status || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Patient</p><p className="font-semibold text-ink">{item.patient_name || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Amount</p><p className="font-semibold text-ink">Rs {Number(item.amount || 0).toLocaleString()}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Issue date</p><p className="font-semibold text-ink">{item.issue_date || "--"}</p></div>
            <div className="kpi-card"><p className="text-xs text-ink-muted">Linked</p><p className="font-semibold text-ink">{item.appointment_uid || "--"} {item.case_uid ? `· ${item.case_uid}` : ""}</p></div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-3">
            <h3 className="text-sm font-semibold text-ink mb-2">Invoice items</h3>
            {items.length === 0 ? (
              <p className="text-xs text-ink-muted">No line items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="text-left text-ink-muted"><th className="py-1">Code</th><th className="py-1">Type</th><th className="py-1">Qty</th><th className="py-1">Unit</th><th className="py-1">Amount</th></tr></thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-t border-line"><td className="py-1">{row.code || "--"}</td><td className="py-1">{row.item_type || "--"}</td><td className="py-1">{row.qty || 0}</td><td className="py-1">{row.unit_price || 0}</td><td className="py-1">{row.amount || 0}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
