import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardListIcon,
  FilterIcon,
  SearchIcon,
  UserIcon,
  ActivityIcon,
  XIcon,
  PlusIcon,
  AlertCircleIcon,
} from "lucide-react";
import { DoctorLayout } from "./DoctorLayout";

type CaseStage = "New" | "In treatment" | "Waiting on patient" | "Completed";

export type DoctorCase = {
  dbId: number;
  id: string;
  patientName: string;
  toothRegion: string;
  diagnosis: string;
  stage: CaseStage;
  createdAt: string;
  updatedAt: string;
};

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

const getAuthToken = () =>
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  "";

const mapStageDbToLabel = (stageDb: string | null | undefined): CaseStage => {
  const s = String(stageDb || "").toUpperCase();
  if (s === "IN_TREATMENT") return "In treatment";
  if (s === "WAITING_ON_PATIENT") return "Waiting on patient";
  if (s === "CLOSED" || s === "COMPLETED") return "Completed";
  return "New";
};

const mapStageLabelToDb = (stage: CaseStage): string => {
  switch (stage) {
    case "In treatment":
      return "IN_TREATMENT";
    case "Waiting on patient":
      return "WAITING_ON_PATIENT";
    case "Completed":
      return "CLOSED";
    case "New":
    default:
      return "NEW";
  }
};

const stageBadgeClasses = (stage: CaseStage) => {
  switch (stage) {
    case "New":
      return "bg-sky-500/10 text-sky-700 border border-sky-400/40";
    case "In treatment":
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40";
    case "Waiting on patient":
      return "bg-amber-500/10 text-amber-700 border border-amber-400/40";
    case "Completed":
      return "bg-surface-muted text-ink border border-line";
    default:
      return "bg-surface-muted text-ink border border-line";
  }
};

export const DoctorCases: React.FC = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("userName") || "Doctor";

  const [cases, setCases] = useState<DoctorCase[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CaseStage | "All">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState({
    patientName: "",
    toothRegion: "",
    diagnosis: "",
    stage: "New" as CaseStage,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please login again.");
      setLoading(false);
      return;
    }

    const fetchCases = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/doctor/cases`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to load cases");
        }

        const data = await res.json();
        const items = (data.cases || []) as any[];

        const mapped: DoctorCase[] = items.map((c) => ({
          dbId: Number(c.dbId || c.id || 0),
          id: c.id || c.caseId || "--",
          patientName: c.patientName || "Unknown patient",
          toothRegion: c.toothRegion || "Not specified",
          diagnosis: c.diagnosis || c.type || "General case",
          stage: mapStageDbToLabel(c.stage),
          createdAt: (c.createdAt || "").slice(0, 10),
          updatedAt: (c.updatedAt || c.lastUpdated || "").slice(0, 10),
        }));

        setCases(mapped);
      } catch (err: any) {
        console.error("Doctor cases error:", err);
        setError(err.message || "Unable to load cases");
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      !search ||
      c.patientName.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.diagnosis.toLowerCase().includes(search.toLowerCase());

    const matchesStage = stageFilter === "All" || c.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const stageCounts = useMemo(() => {
    return cases.reduce(
      (acc, c) => {
        acc.total += 1;
        acc[c.stage] += 1;
        return acc;
      },
      {
        total: 0,
        New: 0,
        "In treatment": 0,
        "Waiting on patient": 0,
        Completed: 0,
      } as Record<string, number>
    );
  }, [cases]);

  const handleOpenNewCase = () => {
    setNewCase({
      patientName: "",
      toothRegion: "",
      diagnosis: "",
      stage: "New",
    });
    setIsNewCaseOpen(true);
  };

  const handleSubmitNewCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCase.patientName.trim() || !newCase.diagnosis.trim()) return;

    const token = getAuthToken();
    if (!token) {
      alert("Not authenticated. Please login again.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/doctor/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientName: newCase.patientName.trim(),
          toothRegion: newCase.toothRegion.trim(),
          diagnosis: newCase.diagnosis.trim(),
          stage: mapStageLabelToDb(newCase.stage),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not create case");
      }

      const data = await res.json();
      const c = data.case;

      const created: DoctorCase = {
        dbId: Number(c.dbId || c.id || 0),
        id: c.id || c.caseId || "--",
        patientName: c.patientName || newCase.patientName.trim(),
        toothRegion: c.toothRegion || newCase.toothRegion.trim() || "Not specified",
        diagnosis: c.diagnosis || newCase.diagnosis.trim(),
        stage: mapStageDbToLabel(c.stage),
        createdAt: (c.createdAt || "").slice(0, 10),
        updatedAt: (c.updatedAt || c.lastUpdated || "").slice(0, 10),
      };

      setCases((prev) => [created, ...prev]);
      setIsNewCaseOpen(false);
    } catch (err: any) {
      console.error("Create case error:", err);
      setError(err.message || "Unable to create case");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">Clinical archive</p>
            <h1 className="text-2xl font-semibold text-ink">Cases</h1>
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">
              Organize active treatment cases, track stages, and create new
              clinical workstreams for your panel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="ghost-button"
            >
              <FilterIcon size={14} />
              Filters
            </button>
            <button
              type="button"
              onClick={handleOpenNewCase}
              className="btn btn-primary text-xs"
            >
              <PlusIcon size={14} />
              New case
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">All cases</p>
            <p className="text-2xl font-semibold text-ink">{stageCounts.total}</p>
            <p className="text-xs text-ink-muted">Across all stages</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">New</p>
            <p className="text-2xl font-semibold text-ink">{stageCounts.New}</p>
            <p className="text-xs text-ink-muted">Recently opened</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">In treatment</p>
            <p className="text-2xl font-semibold text-ink">
              {stageCounts["In treatment"]}
            </p>
            <p className="text-xs text-ink-muted">Active plans</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Waiting</p>
            <p className="text-2xl font-semibold text-ink">
              {stageCounts["Waiting on patient"]}
            </p>
            <p className="text-xs text-ink-muted">Patient follow-up</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-800">
          <AlertCircleIcon size={14} className="mt-0.5" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
          </div>
        </div>
      )}

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-ink-muted">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by patient, diagnosis, or case ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              "All",
              "New",
              "In treatment",
              "Waiting on patient",
              "Completed",
            ] as const).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setStageFilter(stage as CaseStage | "All")}
                className={[
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px]",
                  stageFilter === stage
                    ? "border-line bg-surface text-ink"
                    : "border-line bg-surface-muted text-ink-muted",
                ].join(" ")}
              >
                {stage === "All" ? (
                  <ActivityIcon size={12} />
                ) : (
                  <UserIcon size={12} />
                )}
                <span>{stage}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="rounded-2xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
              Loading your cases...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No cases match your filters. Try adjusting the search or stage.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => c.dbId > 0 && navigate(`/doctor/cases/${c.dbId}`)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && c.dbId > 0) {
                      e.preventDefault();
                      navigate(`/doctor/cases/${c.dbId}`);
                    }
                  }}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-soft cursor-pointer hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[11px] font-mono text-ink-muted">
                      {c.id}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageBadgeClasses(
                        c.stage
                      )}`}
                    >
                      {c.stage}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-ink">
                    {c.diagnosis}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {c.patientName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Region: {c.toothRegion}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
                    <span>Created: {c.createdAt || "--"}</span>
                    <span>Updated: {c.updatedAt || "--"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {isNewCaseOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface text-ink shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-[0.16em]">
                  New case
                </p>
                <h2 className="text-sm font-semibold">
                  Create clinical case for {doctorName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCaseOpen(false)}
                className="h-8 w-8 rounded-xl border border-line bg-surface flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCase} className="px-4 py-4 space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-muted">
                  Patient name
                </label>
                <input
                  type="text"
                  value={newCase.patientName}
                  onChange={(e) =>
                    setNewCase((prev) => ({ ...prev, patientName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g., Rahul Sharma"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-muted">
                  Tooth / region
                </label>
                <input
                  type="text"
                  value={newCase.toothRegion}
                  onChange={(e) =>
                    setNewCase((prev) => ({ ...prev, toothRegion: e.target.value }))
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g., Lower left - #36"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-muted">
                  Diagnosis / treatment intent
                </label>
                <textarea
                  value={newCase.diagnosis}
                  onChange={(e) =>
                    setNewCase((prev) => ({ ...prev, diagnosis: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Short description of the treatment plan"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-muted">
                  Stage
                </label>
                <select
                  value={newCase.stage}
                  onChange={(e) =>
                    setNewCase((prev) => ({
                      ...prev,
                      stage: e.target.value as CaseStage,
                    }))
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="New">New</option>
                  <option value="In treatment">In treatment</option>
                  <option value="Waiting on patient">Waiting on patient</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCaseOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 active:translate-y-[1px] disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DoctorLayout>
  );
};
