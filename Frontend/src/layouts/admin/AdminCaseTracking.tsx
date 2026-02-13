import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ClipboardListIcon,
  ClockIcon,
  FilterIcon,
  SearchIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

type CaseStage =
  | "NEW"
  | "IN_TREATMENT"
  | "WAITING_ON_PATIENT"
  | "READY_TO_CLOSE"
  | "CLOSED"
  | "BLOCKED";

type CasePriority = "LOW" | "MEDIUM" | "HIGH";

interface CaseTrackingSummary {
  totalCases: number;
  highRiskCount: number;
  needsFollowUpCount: number;
  byStage: Partial<Record<CaseStage, number>>;
  updatedAt: string | null;
}

interface TrackedCase {
  id: number;
  caseId: string;
  patientName: string;
  patientUid: string | null;
  doctorName: string;
  doctorUid: string | null;
  type: string;
  stage: CaseStage;
  priority: CasePriority;
  riskScore: number;
  nextAction: string | null;
  nextReviewDate: string | null;
  lastUpdated: string;
  agentSummary: string | null;
  agentRecommendation: string | null;
  flagged: boolean;
}

const stageLabel: Record<CaseStage, string> = {
  NEW: "New",
  IN_TREATMENT: "In treatment",
  WAITING_ON_PATIENT: "Waiting on patient",
  READY_TO_CLOSE: "Ready to close",
  CLOSED: "Closed",
  BLOCKED: "Blocked",
};

const priorityLabel: Record<CasePriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const AdminCaseTracking: React.FC = () => {
  const [summary, setSummary] = useState<CaseTrackingSummary | null>(null);
  const [cases, setCases] = useState<TrackedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCaseId, setUpdatingCaseId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<CaseStage | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH_ONLY">("ALL");

  const token = localStorage.getItem("authToken");
  const safeSummary: CaseTrackingSummary = summary ?? {
    totalCases: 0,
    highRiskCount: 0,
    needsFollowUpCount: 0,
    byStage: {},
    updatedAt: null,
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [summaryRes, listRes] = await Promise.all([
          fetch(`${ADMIN_API}/cases/tracking-summary`, { headers }),
          fetch(`${ADMIN_API}/cases/tracking-list?limit=50`, { headers }),
        ]);

        if (!summaryRes.ok) {
          const text = await summaryRes.text().catch(() => "");
          throw new Error(
            `Failed to load case summary (${summaryRes.status}): ${
              text || summaryRes.statusText
            }`
          );
        }

        if (!listRes.ok) {
          const text = await listRes.text().catch(() => "");
          throw new Error(
            `Failed to load case list (${listRes.status}): ${
              text || listRes.statusText
            }`
          );
        }

        const summaryJson = await summaryRes.json();
        const listJson = await listRes.json();
        const byStageRaw =
          summaryJson && typeof summaryJson.byStage === "object" && summaryJson.byStage
            ? summaryJson.byStage
            : {};
        const normalizedByStage = Object.fromEntries(
          Object.entries(byStageRaw).map(([k, v]) => [String(k).toUpperCase(), Number(v || 0)])
        ) as Partial<Record<CaseStage, number>>;

        setSummary({
          totalCases: Number(summaryJson?.totalCases || 0),
          highRiskCount: Number(summaryJson?.highRiskCount || 0),
          needsFollowUpCount: Number(summaryJson?.needsFollowUpCount || 0),
          byStage: normalizedByStage,
          updatedAt: summaryJson?.updatedAt ? String(summaryJson.updatedAt) : null,
        });

        setCases(Array.isArray(listJson.cases) ? listJson.cases : []);
      } catch (err: any) {
        console.error("CASE TRACKING LOAD ERROR:", err);
        setError(err.message || "Unable to load case tracking data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (stageFilter !== "ALL" && c.stage !== stageFilter) return false;
      if (riskFilter === "HIGH_ONLY" && c.riskScore < 70) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.caseId.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.doctorName.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    });
  }, [cases, stageFilter, riskFilter, search]);

  const updateCaseStage = async (caseId: number, newStage: CaseStage) => {
    try {
      if (!token) return;
      setUpdatingCaseId(caseId);
      setError(null);

      const res = await fetch(`${ADMIN_API}/cases/${caseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update case stage");
      }

      const updated = await res.json();

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                stage: updated.case?.stage ?? newStage,
                lastUpdated: updated.case?.lastUpdated ?? c.lastUpdated,
              }
            : c
        )
      );
    } catch (err: any) {
      console.error("UPDATE CASE STAGE ERROR:", err);
      setError(err.message || "Unable to update case stage.");
    } finally {
      setUpdatingCaseId(null);
    }
  };

  const toggleHighRiskFilter = () => {
    setRiskFilter((prev) => (prev === "ALL" ? "HIGH_ONLY" : "ALL"));
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "--";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const riskBadgeClass = (score: number) => {
    if (score >= 80) {
      return "bg-rose-500/10 text-rose-700 border border-rose-400/40";
    }
    if (score >= 60) {
      return "bg-amber-500/10 text-amber-700 border border-amber-400/40";
    }
    return "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40";
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

  const priorityDotClass = (priority: CasePriority) => {
    switch (priority) {
      case "HIGH":
        return "bg-rose-500";
      case "MEDIUM":
        return "bg-amber-500";
      case "LOW":
        return "bg-emerald-500";
    }
  };

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="section-title">Case intelligence</p>
            <h1 className="text-2xl font-semibold text-ink">
              Case tracking
            </h1>
            <p className="mt-1 text-sm text-ink-muted max-w-xl">
              Track every active case, see pipeline stage, and surface risks with
              AI tracking signals.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="ghost-button">
              <FilterIcon size={14} />
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
            <button
              type="button"
              onClick={toggleHighRiskFilter}
              className={
                riskFilter === "HIGH_ONLY"
                  ? "btn btn-primary text-xs"
                  : "btn btn-secondary text-xs"
              }
            >
              <AlertTriangleIcon size={14} />
              {riskFilter === "HIGH_ONLY" ? "High-risk only" : "Highlight high-risk"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">Active cases</span>
                <ClipboardListIcon size={14} className="text-brand" />
              </div>
              <p className="text-2xl font-semibold text-ink">
                {safeSummary.totalCases ?? "--"}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                New: {safeSummary.byStage.NEW ?? 0} - In treatment: {safeSummary.byStage.IN_TREATMENT ?? 0}
              </p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">High-risk cases</span>
                <AlertTriangleIcon size={14} className="text-rose-600" />
              </div>
              <p className="text-2xl font-semibold text-ink">
                {safeSummary.highRiskCount ?? "--"}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Based on AI risk scoring.
              </p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">Needs follow-up</span>
                <ClockIcon size={14} className="text-amber-600" />
              </div>
              <p className="text-2xl font-semibold text-ink">
                {safeSummary.needsFollowUpCount ?? "--"}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Next review is due today.
              </p>
            </div>
          </div>

          <div className="surface rounded-2xl px-4 py-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink">
              <ZapIcon size={13} />
              Case tracking agent
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">
              AI summaries of your riskiest cases.
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Once wired to your LLM endpoint, this panel will pull a daily summary
              of blocked or high-risk cases and propose next actions for the team.
            </p>
            {safeSummary.updatedAt && (
              <p className="mt-3 text-[11px] text-ink-muted">
                Last refreshed: {formatDate(safeSummary.updatedAt)}
              </p>
            )}
          </div>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient, doctor, or case ID"
              className="w-full rounded-2xl border border-line bg-surface pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {filtersOpen && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                "ALL",
                "NEW",
                "IN_TREATMENT",
                "WAITING_ON_PATIENT",
                "READY_TO_CLOSE",
                "BLOCKED",
                "CLOSED",
              ] as const
            ).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() =>
                  setStageFilter(stage === "ALL" ? "ALL" : (stage as CaseStage))
                }
                className={
                  stageFilter === stage || (stage === "ALL" && stageFilter === "ALL")
                    ? "btn btn-primary text-xs"
                    : "btn btn-secondary text-xs"
                }
              >
                {stage === "ALL" ? "All" : stageLabel[stage as CaseStage]}
                {stage !== "ALL" && safeSummary.byStage[stage as CaseStage] != null && (
                  <span className="ml-1 text-[10px] opacity-70">
                    {safeSummary.byStage[stage as CaseStage]}
                  </span>
                )}
              </button>
            ))}
          </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-6 text-sm text-ink-muted">
            Loading case tracking data...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-6 text-sm text-ink-muted">
            No cases match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-ink-muted border-b border-line">
                  <th className="py-2 pr-4 font-medium">Case</th>
                  <th className="py-2 pr-4 font-medium">Patient</th>
                  <th className="py-2 pr-4 font-medium">Doctor</th>
                  <th className="py-2 pr-4 font-medium">Stage</th>
                  <th className="py-2 pr-4 font-medium">Priority</th>
                  <th className="py-2 pr-4 font-medium">Risk</th>
                  <th className="py-2 pr-4 font-medium">Next action</th>
                  <th className="py-2 pr-2 font-medium">Next review</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-muted align-top"
                  >
                    <td className="py-3 pr-4 text-ink">
                      <div className="font-mono text-[11px] text-ink-muted">{c.caseId}</div>
                      <div className="mt-0.5 text-xs font-semibold">{c.type}</div>
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        Updated {formatDate(c.lastUpdated)}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink">
                      <div className="flex items-center gap-1.5">
                        <UserIcon size={12} className="text-ink-muted" />
                        <span className="text-xs font-medium">{c.patientName}</span>
                      </div>
                      {c.patientUid && (
                        <div className="mt-0.5 text-[11px] text-ink-muted">
                          ID: {c.patientUid}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink">
                      <div className="text-xs font-medium">{c.doctorName}</div>
                      {c.doctorUid && (
                        <div className="mt-0.5 text-[11px] text-ink-muted">
                          ID: {c.doctorUid}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink">
                      <select
                        className={`text-[11px] rounded-full px-2 py-1 pr-5 outline-none border ${stagePillClass(c.stage)}`}
                        value={c.stage}
                        onChange={(e) => updateCaseStage(c.id, e.target.value as CaseStage)}
                        disabled={updatingCaseId === c.id}
                      >
                        {(
                          [
                            "NEW",
                            "IN_TREATMENT",
                            "WAITING_ON_PATIENT",
                            "READY_TO_CLOSE",
                            "BLOCKED",
                            "CLOSED",
                          ] as CaseStage[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {stageLabel[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="inline-flex items-center gap-1 text-[11px] text-ink">
                        <span className={`h-2 w-2 rounded-full ${priorityDotClass(c.priority)}`} />
                        <span>{priorityLabel[c.priority]}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${riskBadgeClass(c.riskScore)}`}>
                        <span>{Math.round(c.riskScore)}%</span>
                        {c.riskScore >= 60 && <AlertTriangleIcon size={11} />}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink-muted max-w-xs">
                      <div className="text-xs">
                        {c.nextAction || (
                          <span className="text-ink-muted">No next step logged</span>
                        )}
                      </div>
                      {c.agentRecommendation && (
                        <div className="mt-1 text-[11px] text-emerald-700">
                          <span className="font-semibold">Agent:</span> {c.agentRecommendation}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-ink">
                      <div className="flex items-center gap-1 text-xs">
                        <ClockIcon size={12} className="text-ink-muted" />
                        <span>{formatDate(c.nextReviewDate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};
