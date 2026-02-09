import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList as ClipboardListIcon,
  Filter as FilterIcon,
  Search as SearchIcon,
  Activity as ActivityIcon,
  User as UserIcon,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type CaseStage =
  | "NEW"
  | "IN_TREATMENT"
  | "WAITING_ON_PATIENT"
  | "READY_TO_CLOSE"
  | "CLOSED"
  | "BLOCKED";

const stageLabel: Record<CaseStage, string> = {
  NEW: "New",
  IN_TREATMENT: "In treatment",
  WAITING_ON_PATIENT: "Waiting on patient",
  READY_TO_CLOSE: "Ready to close",
  CLOSED: "Closed",
  BLOCKED: "Blocked",
};

type CaseCard = {
  id: string;
  patient: string;
  doctor: string;
  type: string;
  stage: CaseStage;
};

const normalizeStage = (stage: string | null | undefined): CaseStage => {
  const upper = (stage || "NEW").toUpperCase();
  switch (upper) {
    case "IN_TREATMENT":
      return "IN_TREATMENT";
    case "WAITING_ON_PATIENT":
      return "WAITING_ON_PATIENT";
    case "READY_TO_CLOSE":
      return "READY_TO_CLOSE";
    case "CLOSED":
      return "CLOSED";
    case "BLOCKED":
      return "BLOCKED";
    default:
      return "NEW";
  }
};

const stagePillClass = (stage: CaseStage) => {
  switch (stage) {
    case "NEW":
      return "bg-sky-500/10 text-sky-700 border border-sky-400/40";
    case "IN_TREATMENT":
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40";
    case "WAITING_ON_PATIENT":
      return "bg-amber-500/10 text-amber-700 border border-amber-400/40";
    case "READY_TO_CLOSE":
      return "bg-violet-500/10 text-violet-700 border border-violet-400/40";
    case "CLOSED":
      return "bg-surface-muted text-ink border border-line";
    case "BLOCKED":
      return "bg-rose-500/10 text-rose-700 border border-rose-400/40";
    default:
      return "bg-surface-muted text-ink border border-line";
  }
};

export const AdminCases: React.FC = () => {
  const [cases, setCases] = useState<CaseCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${ADMIN_API}/cases`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();

        const mapped: CaseCard[] = (data.items || []).map((c: any) => ({
          id: c.id,
          patient: c.patient,
          doctor: c.doctor,
          type: c.type,
          stage: normalizeStage(c.stage),
        }));

        setCases(mapped);
      } catch (err) {
        console.error("AdminCases error:", err);
        setError("Failed to load cases.");
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter((c) => {
      return (
        c.id.toLowerCase().includes(q) ||
        c.patient.toLowerCase().includes(q) ||
        c.doctor.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    });
  }, [cases, search]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<CaseStage, number> = {
      NEW: 0,
      IN_TREATMENT: 0,
      WAITING_ON_PATIENT: 0,
      READY_TO_CLOSE: 0,
      CLOSED: 0,
      BLOCKED: 0,
    };
    for (const c of cases) {
      counts[c.stage] += 1;
    }
    return counts;
  }, [cases]);

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="section-title">Case pipeline</p>
            <h1 className="text-2xl font-semibold text-ink">Cases</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Monitor every active case from creation to closure across all doctors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="ghost-button">
              <FilterIcon size={14} />
              Filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          {(
            [
              "NEW",
              "IN_TREATMENT",
              "WAITING_ON_PATIENT",
              "READY_TO_CLOSE",
              "BLOCKED",
              "CLOSED",
            ] as CaseStage[]
          ).map((stage) => (
            <div key={stage} className="kpi-card">
              <p className="text-xs text-ink-muted">{stageLabel[stage]}</p>
              <p className="text-xl font-semibold text-ink">
                {pipelineCounts[stage]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs mb-4">
          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-ink-muted">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by patient, doctor, or case ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-ink-muted">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-surface-muted">
              <UserIcon size={12} />
              All doctors
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-surface-muted">
              <ActivityIcon size={12} />
              All stages
            </span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center text-sm text-ink-muted py-4">
              Loading cases...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center text-sm text-ink-muted py-4">
              No cases found.
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="surface rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono text-ink-muted">{c.id}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stagePillClass(c.stage)}`}>
                    {stageLabel[c.stage]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-ink">{c.type}</p>
                <p className="mt-1 text-xs text-ink-muted">{c.patient}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Primary doctor: <span className="font-medium text-ink">{c.doctor}</span>
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
};
