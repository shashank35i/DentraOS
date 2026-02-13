import React, { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Phone as PhoneIcon,
  X as XIcon,
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

type PatientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastVisit: string | null;
  status: string;
};

type NewPatientForm = {
  fullName: string;
  email: string;
  phone: string;
  medicalHistory: string;
  allergies: string;
  notes: string;
};

export const AdminPatients: React.FC = () => {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "NEEDS_REVIEW">("ALL");
  const [recentVisitOnly, setRecentVisitOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<NewPatientForm>({
    fullName: "",
    email: "",
    phone: "",
    medicalHistory: "",
    allergies: "",
    notes: "",
  });

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${ADMIN_API}/patients`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const raw = Array.isArray(data?.patients)
        ? data.patients
        : Array.isArray(data?.items)
        ? data.items
        : [];
      const mapped: PatientRow[] = raw.map((p: any) => ({
        id: String(p.id ?? p.uid ?? ""),
        name: String(p.name ?? p.full_name ?? "Unknown patient"),
        email: p.email ?? null,
        phone: p.phone ?? null,
        lastVisit: p.lastVisit ?? p.last_appointment ?? null,
        status: String(p.status ?? "Active"),
      }));
      setPatients(mapped);
    } catch (err) {
      console.error("AdminPatients error:", err);
      setError("Failed to load patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter((p) => {
      const matchesSearch =
        !q ||
        String(p.id || "").toLowerCase().includes(q) ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q) ||
        String(p.phone || "").toLowerCase().includes(q);
      const isActive = String(p.status || "").toLowerCase() === "active";
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "NEEDS_REVIEW" && !isActive);
      const matchesVisit = !recentVisitOnly || Boolean(p.lastVisit);
      return matchesSearch && matchesStatus && matchesVisit;
    });
  }, [patients, recentVisitOnly, search, statusFilter]);

  const openModal = () => {
    setCreateError(null);
    setForm({
      fullName: "",
      email: "",
      phone: "",
      medicalHistory: "",
      allergies: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating) return;
    setModalOpen(false);
  };

  const createPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!form.fullName.trim()) {
      setCreateError("Full name is required.");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch(`${ADMIN_API}/users`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: "PATIENT",
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          medicalHistory: form.medicalHistory.trim() || undefined,
          allergies: form.allergies.trim() || undefined,
          notes: form.notes.trim() || undefined,
          sendInviteEmail: false,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to create patient (status ${res.status})`);
      }

      setModalOpen(false);
      await fetchPatients();
    } catch (err: any) {
      console.error("Create patient error:", err);
      setCreateError(err.message || "Failed to create patient.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="section-title">Patient directory</p>
            <h1 className="text-2xl font-semibold text-ink">Patients</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Search and review patient records across your clinic.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button className="ghost-button" onClick={() => setFiltersOpen((v) => !v)}>
              <FilterIcon size={14} />
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
            <button className="btn btn-primary text-xs" onClick={openModal}>New patient</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Patients</p>
            <p className="text-2xl font-semibold text-ink">{patients.length}</p>
            <p className="text-xs text-ink-muted">Active profiles</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Active</p>
            <p className="text-2xl font-semibold text-ink">
              {patients.filter((p) => p.status === "Active").length}
            </p>
            <p className="text-xs text-ink-muted">Currently active</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Needs review</p>
            <p className="text-2xl font-semibold text-ink">
              {patients.filter((p) => p.status !== "Active").length}
            </p>
            <p className="text-xs text-ink-muted">Inactive or paused</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="relative w-full md:max-w-md mb-4">
          <span className="absolute inset-y-0 left-3 flex items-center text-ink-muted">
            <SearchIcon size={14} />
          </span>
          <input
            type="text"
            placeholder="Search by name, phone, or patient ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {filtersOpen && (
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="NEEDS_REVIEW">Needs review only</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={recentVisitOnly}
                onChange={(e) => setRecentVisitOnly(e.target.checked)}
              />
              Has recent visit
            </label>
            <button
              type="button"
              className="ghost-button justify-center"
              onClick={() => {
                setStatusFilter("ALL");
                setRecentVisitOnly(false);
                setSearch("");
              }}
            >
              Reset
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="rounded-2xl border border-line bg-surface divide-y divide-[color:var(--line)]">
          {loading ? (
            <div className="px-4 py-4 text-xs text-ink-muted text-center">
              Loading patients...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-4 text-xs text-ink-muted text-center">
              No patients found.
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-ink-muted">
                    ID: {p.id} - Last visit: {p.lastVisit || "--"}
                  </p>
                  {p.email && <p className="text-[11px] text-ink-muted">{p.email}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold border ${
                      p.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/40"
                        : "bg-surface-muted text-ink border-line"
                    }`}
                  >
                    {p.status}
                  </span>
                  <button className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-ink">
                    <PhoneIcon size={12} />
                    {p.phone || "No phone"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <h2 className="text-sm font-semibold text-ink">Create patient</h2>
                <p className="text-[11px] text-ink-muted">Add a patient profile to clinic records.</p>
              </div>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-surface-muted text-ink-muted">
                <XIcon size={16} />
              </button>
            </div>
            <form className="px-5 py-4 space-y-3 text-xs text-ink" onSubmit={createPatient}>
              {createError && (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-ink-muted">Full name *</label>
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                    placeholder="Patient full name"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                    placeholder="+91..."
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-ink-muted">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                  placeholder="patient@email.com"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-ink-muted">Medical history</label>
                  <textarea
                    value={form.medicalHistory}
                    onChange={(e) => setForm((f) => ({ ...f, medicalHistory: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs min-h-20"
                    placeholder="Optional notes"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Allergies / notes</label>
                  <textarea
                    value={form.allergies}
                    onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs min-h-20"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={closeModal} className="btn btn-secondary text-xs" disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs inline-flex items-center gap-2" disabled={creating}>
                  {creating && <Loader2Icon size={14} className="animate-spin" />}
                  Create patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
