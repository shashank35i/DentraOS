import React, { useEffect, useMemo, useState } from "react";
import {
  Package as PackageIcon,
  Filter as FilterIcon,
  AlertTriangle as AlertTriangleIcon,
  X as XIcon,
  Search as SearchIcon,
  Loader2 as Loader2Icon,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  status: "Healthy" | "Reorder soon" | "Low" | string;
  reorderThreshold: number;
  expiryDate: string | null;
};

type CreateInventoryPayload = {
  itemCode: string;
  name: string;
  category: string;
  stock: number;
  reorderThreshold: number;
  expiryDate: string | null;
};

function computeStatus(stock: number, reorderThreshold: number) {
  const rt = typeof reorderThreshold === "number" ? reorderThreshold : null;
  if (rt == null) return "Healthy";
  if (stock <= rt) return "Low";
  if (stock <= Math.ceil(rt * 1.5)) return "Reorder soon";
  return "Healthy";
}

export const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [itemCode, setItemCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Consumables");
  const [stock, setStock] = useState<number>(0);
  const [reorderThreshold, setReorderThreshold] = useState<number>(10);
  const [expiryDate, setExpiryDate] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchesQuery =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        (it.category || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "ALL" || it.category === categoryFilter;

      return matchesQuery && matchesCategory;
    });
  }, [items, query, categoryFilter]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${ADMIN_API}/inventory`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();

      const normalized: InventoryItem[] = (data.items || []).map((r: any) => {
        const stockNum = Number(r.stock - 0);
        const rtNum =
          r.reorderThreshold != null ? Number(r.reorderThreshold) : undefined;

        const status =
          r.status && String(r.status).trim().length
            ? r.status
            : computeStatus(stockNum, rtNum);

        return {
          id: String(r.id),
          name: String(r.name || "--"),
          category: String(r.category || "Uncategorized"),
          stock: stockNum,
          status,
          reorderThreshold: rtNum,
          expiryDate: r.expiryDate ?? null,
        };
      });

      setItems(normalized);
    } catch (err) {
      console.error("AdminInventory error:", err);
      setError("Failed to load inventory.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const resetForm = () => {
    setItemCode("");
    setName("");
    setCategory("Consumables");
    setStock(0);
    setReorderThreshold(10);
    setExpiryDate("");
    setFormError(null);
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const submitNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = itemCode.trim();
    const nm = name.trim();
    const cat = category.trim() || "Uncategorized";

    if (!code) return setFormError("Item Code is required (e.g., GAUZE-001).");
    if (!nm) return setFormError("Name is required.");
    if (!Number.isFinite(stock) || stock < 0)
      return setFormError("Stock must be 0 or greater.");
    if (!Number.isFinite(reorderThreshold) || reorderThreshold < 0)
      return setFormError("Reorder threshold must be 0 or greater.");

    const payload: CreateInventoryPayload = {
      itemCode: code,
      name: nm,
      category: cat,
      stock: Math.floor(stock),
      reorderThreshold: Math.floor(reorderThreshold),
      expiryDate: expiryDate ? expiryDate : null,
    };

    try {
      setSubmitting(true);

      const res = await fetch(`${ADMIN_API}/inventory`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        const serverMsg = msg.message ? String(msg.message) : `Status ${res.status}`;
        throw new Error(serverMsg);
      }

      await fetchInventory();
      setModalOpen(false);
    } catch (err: any) {
      console.error("Create inventory item error:", err);
      setFormError(err.message || "Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="section-title">Supply chain</p>
            <h1 className="text-2xl font-semibold text-ink">Inventory</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Track stock levels, identify low items, and keep your clinic prepared.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="ghost-button"
            >
              <FilterIcon size={14} />
              Filters
            </button>
            <button onClick={openModal} className="btn btn-primary text-xs">
              New item
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Items tracked</p>
            <p className="text-2xl font-semibold text-ink">{items.length}</p>
            <p className="text-xs text-ink-muted">Across all categories</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Low stock</p>
            <p className="text-2xl font-semibold text-ink">
              {items.filter((i) => computeStatus(i.stock, i.reorderThreshold) === "Low").length}
            </p>
            <p className="text-xs text-ink-muted">Needs immediate reorder</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Reorder soon</p>
            <p className="text-2xl font-semibold text-ink">
              {items.filter((i) => computeStatus(i.stock, i.reorderThreshold) === "Reorder soon").length}
            </p>
            <p className="text-xs text-ink-muted">Within 1.5x threshold</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Healthy</p>
            <p className="text-2xl font-semibold text-ink">
              {items.filter((i) => computeStatus(i.stock, i.reorderThreshold) === "Healthy").length}
            </p>
            <p className="text-xs text-ink-muted">Stock stable</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex-1 relative">
            <SearchIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID, category..."
              className="w-full rounded-xl border border-line bg-surface px-9 py-2 text-sm text-ink outline-none"
            />
          </div>

          {filtersOpen && (
            <div className="sm:w-64">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "All categories" : c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="rounded-2xl border border-line bg-surface divide-y divide-[color:var(--line)]">
          {loading ? (
            <div className="px-4 py-4 text-xs text-ink-muted text-center">
              Loading inventory...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-4 text-xs text-ink-muted text-center">
              No inventory items found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const status = item.status || computeStatus(item.stock, item.reorderThreshold);
              const badgeClass =
                status === "Healthy"
                  ? "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40"
                  : status === "Reorder soon"
                  ? "bg-amber-500/10 text-amber-700 border border-amber-400/40"
                  : "bg-rose-500/10 text-rose-700 border border-rose-400/40";

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {item.category || "Uncategorized"} - ID: {item.id}
                    </p>
                    {item.reorderThreshold != null && (
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Reorder threshold: {item.reorderThreshold}
                      </p>
                    )}
                    {item.expiryDate && (
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Expiry: {String(item.expiryDate).slice(0, 10)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-ink-muted">
                      Stock: <span className="font-semibold text-ink">{item.stock}</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${badgeClass}`}
                    >
                      {(status === "Low" || status === "Reorder soon") && (
                        <AlertTriangleIcon size={12} />
                      )}
                      {status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-surface/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Add inventory item
                </h2>
                <p className="text-xs text-ink-muted">
                  Create a new stock item for your clinic.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-surface-muted"
                aria-label="Close"
              >
                <XIcon size={16} className="text-ink-muted" />
              </button>
            </div>

            <form onSubmit={submitNewItem} className="px-5 py-4 space-y-3">
              {formError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted">Item Code *</label>
                  <input
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="GAUZE-001"
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-ink-muted">Category</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Consumables"
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-muted">Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sterile gauze pads"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-ink-muted">Stock *</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    min={0}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-ink-muted">Reorder threshold *</label>
                  <input
                    type="number"
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(Number(e.target.value))}
                    min={0}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-ink-muted">Expiry date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary text-xs"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs inline-flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting && <Loader2Icon size={14} className="animate-spin" />}
                  Create item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
