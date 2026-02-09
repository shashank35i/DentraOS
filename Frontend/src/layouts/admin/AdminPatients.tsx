import React, { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Phone as PhoneIcon,
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
  phone: string | null;
  lastVisit: string | null;
  status: string;
};

export const AdminPatients: React.FC = () => {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${ADMIN_API}/patients`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setPatients(data.items || []);
      } catch (err) {
        console.error("AdminPatients error:", err);
        setError("Failed to load patients.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter((p) => {
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q)
      );
    });
  }, [patients, search]);

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
            <button className="ghost-button">
              <FilterIcon size={14} />
              Filters
            </button>
            <button className="btn btn-primary text-xs">New patient</button>
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
    </>
  );
};
