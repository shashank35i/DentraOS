import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { AIAssistantModal } from "../../components/ai/AIAssistantModal";
import { DoctorLayout } from "./DoctorLayout";

type CaseStage = "New" | "In treatment" | "Waiting on patient" | "Completed";

type CaseSummary = {
  id: number;
  status: string;
  summary: string;
  recommendation: string;
  createdAt: string;
};

type CaseTimelineEntry = {
  id: number;
  action: string;
  note: string;
  createdAt: string;
  actor?: string;
};

type CaseAgentStatus = {
  eventId: number | null;
  eventType: string;
  status: string;
  updatedAt: string;
  lastError: string | null;
  actor?: string | null;
};

type CaseDocument = {
  id: string | number;
  doc_type: string;
  content: string;
  status: string;
  updated_at?: string;
  created_at?: string;
};

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";
const ACTIVE_AGENT_STATUSES = new Set(["NEW", "QUEUED", "PROCESSING"]);

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

function isNumericId(v: string | undefined): boolean {
  if (!v) return false;
  return /^\d+$/.test(String(v).trim());
}

function safeText(v: any): string {
  return String(v || "").trim();
}

export const DoctorCaseDetails: React.FC = () => {
  const { caseRef } = useParams<{ caseRef: string }>();
  const [dbId, setDbId] = useState<number | null>(null);
  const [caseUid, setCaseUid] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("Unknown patient");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const [model, setModel] = useState({
    diagnosis: "",
    toothRegion: "",
    stage: "New" as CaseStage,
    notes: "",
    nextReviewDate: "",
  });

  const [summaries, setSummaries] = useState<CaseSummary[]>([]);
  const [timeline, setTimeline] = useState<CaseTimelineEntry[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [agentStatus, setAgentStatus] = useState<CaseAgentStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>("");

  const displayCaseId = useMemo(() => {
    if (caseUid) return caseUid;
    if (dbId) return `CASE-${dbId}`;
    return "CASE-UNKNOWN";
  }, [caseUid, dbId]);

  const isSummaryBusy = ACTIVE_AGENT_STATUSES.has(
    String(agentStatus?.status || "").toUpperCase()
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please login again.");
      setLoading(false);
      return;
    }

    const resolveDbId = async () => {
      try {
        if (!caseRef) {
          setError("Missing case identifier in URL.");
          setLoading(false);
          return;
        }

        if (isNumericId(caseRef)) {
          setDbId(Number(caseRef));
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/doctor/cases`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to resolve case");
        }

        const data = await res.json();
        const items = (data.cases || []) as any[];
        const match = items.find((c) => {
          const uid = safeText(
            c.caseId || c.case_uid || c.caseUid || c.uid || c.id
          );
          return uid.toLowerCase() === caseRef.toLowerCase();
        });

        const resolvedDbId =
          Number(match.dbId || match.db_id || match.id || 0) || 0;

        if (!resolvedDbId) {
          throw new Error("Case not found for this ID.");
        }

        setDbId(resolvedDbId);
        const uid = safeText(
          match.caseId || match.case_uid || match.caseUid || match.uid
        );
        if (uid) setCaseUid(uid);
      } catch (err: any) {
        setError(err.message || "Failed to resolve case ID.");
        setLoading(false);
      }
    };

    resolveDbId();
  }, [caseRef]);

  const fetchAgentStatus = async () => {
    const token = getAuthToken();
    if (!token || !dbId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${dbId}/agent-status`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        setAgentStatus(null);
        return;
      }
      const data = await res.json();
      const latest = data?.latest;
      if (!latest) {
        setAgentStatus(null);
        setLastCheckedAt(new Date().toISOString().slice(0, 19).replace("T", " "));
        return;
      }
      setAgentStatus({
        eventId: Number(latest.eventId || 0) || null,
        eventType: safeText(latest.eventType),
        status: safeText(latest.status),
        updatedAt: safeText(latest.updatedAt).slice(0, 19).replace("T", " "),
        lastError: latest.lastError ? String(latest.lastError) : null,
        actor: latest.actor ? String(latest.actor) : null,
      });
      setLastCheckedAt(new Date().toISOString().slice(0, 19).replace("T", " "));
    } catch {
      setAgentStatus(null);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !dbId) return;

    const fetchCase = async () => {
      try {
        setLoading(true);
        setError(null);
        setStatusMsg(null);

        const res = await fetch(`${API_BASE_URL}/api/doctor/cases/${dbId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to load case");
        }

        const data = await res.json();
        const c = data.case || {};

        const uid = safeText(c.caseId || c.case_uid || c.caseUid || c.id);
        if (uid) setCaseUid(uid);

        setPatientName(safeText(c.patientName) || "Unknown patient");
        setCreatedAt(safeText(c.createdAt || c.created_at).slice(0, 10));
        setUpdatedAt(safeText(c.updatedAt || c.updated_at).slice(0, 10));

        const agentSummary = safeText(c.agentSummary || c.agent_summary);
        const agentRecommendation = safeText(
          c.agentRecommendation || c.agent_recommendation
        );
        if (agentSummary) {
          setSummaries([
            {
              id: c.id || dbId || 0,
              status: "READY",
              summary: agentSummary,
              recommendation: agentRecommendation,
              createdAt: safeText(c.updatedAt || c.updated_at).slice(0, 10),
            },
          ]);
        }

        setModel({
          diagnosis: safeText(c.diagnosis) || safeText(c.case_type),
          toothRegion: safeText(c.toothRegion) || "Not specified",
          stage: mapStageDbToLabel(c.stage),
          notes: safeText(c.notes),
          nextReviewDate: safeText(c.nextReviewDate || c.next_review_date).slice(
            0,
            10
          ),
        });
      } catch (err: any) {
        setError(err.message || "Unable to load case.");
      } finally {
        setLoading(false);
      }
    };

    const fetchSummaries = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/doctor/cases/${dbId}/summaries?includePending=1`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          setSummaries([]);
          return;
        }
        const data = await res.json();
        const items = (data.summaries || data.items || []) as any[];
        const mapped = items.map((s) => ({
          id: s.id,
          status: safeText(s.status),
          summary: safeText(s.summary || s.agent_summary),
          recommendation: safeText(s.recommendation || s.agent_recommendation),
          createdAt: safeText(s.created_at || s.createdAt).slice(0, 10),
        }));
        setSummaries(mapped);
      } catch {
        setSummaries([]);
      }
    };

    const fetchTimeline = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/doctor/cases/${dbId}/timeline`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          setTimeline([]);
          return;
        }
        const data = await res.json();
        const items = (data.timeline || data.items || []) as any[];
        const mapped = items.map((t) => ({
          id: t.id,
          action: safeText(t.action || t.event_type || t.type),
          note: safeText(t.note || t.message || t.summary),
          createdAt: safeText(t.created_at || t.createdAt),
          actor: safeText(t.actor || t.actor_name || t.actor_role || t.created_by),
        }));
        mapped.sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        });
        setTimeline(mapped);
      } catch {
        setTimeline([]);
      }
    };

    const fetchDocuments = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/doctor/cases/${dbId}/documents`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          setDocuments([]);
          return;
        }
        const data = await res.json();
        setDocuments((data.items || []) as CaseDocument[]);
      } catch {
        setDocuments([]);
      }
    };

    fetchCase();
    fetchSummaries();
    fetchTimeline();
    fetchDocuments();
    fetchAgentStatus();
  }, [dbId]);

  useEffect(() => {
    if (!dbId || !isSummaryBusy) return;
    const timer = setInterval(() => {
      fetchAgentStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [dbId, isSummaryBusy]);

  const handleSave = async () => {
    const token = getAuthToken();
    if (!token || !dbId) return;
    try {
      setSaving(true);
      setStatusMsg(null);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/doctor/cases/${dbId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          diagnosis: model.diagnosis,
          stage: mapStageLabelToDb(model.stage),
          notes: model.notes,
          toothRegion: model.toothRegion,
          nextReviewDate: model.nextReviewDate || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save case");
      }

      setStatusMsg("Case updated.");
    } catch (err: any) {
      setError(err.message || "Failed to save case.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestSummary = async () => {
    const token = getAuthToken();
    if (!token || !dbId || isSummaryBusy) return;
    try {
      setSummaryStatus(null);
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      setAgentStatus({
        eventId: null,
        eventType: "CaseGenerateSummary",
        status: "QUEUED",
        updatedAt: now,
        lastError: null,
        actor: null,
      });

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/cases/${dbId}/summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ caseId: dbId }),
        }
      );

      if (!res.ok) {
        if (res.status === 409) {
          const body = await res.json().catch(() => ({}));
          const existing = body?.existing || {};
          setAgentStatus({
            eventId: Number(existing.eventId || 0) || null,
            eventType: "CaseGenerateSummary",
            status: safeText(existing.status || "PROCESSING"),
            updatedAt: safeText(existing.updatedAt || now),
            lastError: null,
            actor: null,
          });
          setSummaryStatus("Summary already queued. Tracking existing job.");
          return;
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to request summary");
      }

      const body = await res.json().catch(() => ({}));
      setSummaryStatus(
        "Summary requested. The AI agent will process it shortly."
      );
      setAgentStatus({
        eventId: Number(body?.eventId || 0) || null,
        eventType: "CaseGenerateSummary",
        status: "QUEUED",
        updatedAt: now,
        lastError: null,
        actor: null,
      });
    } catch (err: any) {
      setSummaryStatus(err.message || "Failed to request summary.");
    }
  };

  const handleApproveSummary = async (summaryId: number) => {
    const token = getAuthToken();
    if (!token || !dbId || !summaryId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/doctor/cases/${dbId}/summaries/${summaryId}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to approve summary");
      }
      setSummaries((prev) =>
        prev.map((s) => (s.id === summaryId ? { ...s, status: "APPROVED" } : s))
      );
      setSummaryStatus("Summary approved.");
      fetchAgentStatus();
    } catch (err: any) {
      setSummaryStatus(err.message || "Failed to approve summary.");
    }
  };

  const renderAgentStatus = () => {
    if (!agentStatus) {
      return <span>No recent case-agent event.</span>;
    }
    const status = String(agentStatus.status || "").toUpperCase();
    const shortErr = agentStatus.lastError
      ? String(agentStatus.lastError).slice(0, 140)
      : "";

    if (status === "DONE") {
      return (
        <span className="inline-flex items-center gap-2">
          <CheckCircle2Icon size={14} className="text-emerald-600" />
          <span className="font-semibold text-ink">Summary generation: DONE</span>
          {agentStatus.eventId ? <span>- event #{agentStatus.eventId}</span> : null}
          <span>({agentStatus.updatedAt || "--"})</span>
        </span>
      );
    }

    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-2">
          <AlertCircleIcon size={14} className="text-rose-600" />
          <span className="font-semibold text-rose-700">Summary generation: FAILED</span>
          {agentStatus.eventId ? <span>- event #{agentStatus.eventId}</span> : null}
          {shortErr ? <span>- {shortErr}</span> : null}
          <button
            type="button"
            onClick={handleRequestSummary}
            className="underline text-ink hover:text-brand"
          >
            Retry
          </button>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2">
        <Loader2Icon size={14} className="animate-spin text-brand" />
        <span className="font-semibold text-ink">AI is generating summary...</span>
        {agentStatus.eventId ? <span>- event #{agentStatus.eventId}</span> : null}
        <span>({agentStatus.updatedAt || "--"})</span>
      </span>
    );
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className="rounded-2xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
          Loading case details...
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">Case file</p>
            <h1 className="text-2xl font-semibold text-ink">{displayCaseId}</h1>
            <p className="mt-1 text-sm text-ink-muted">{patientName}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="btn btn-secondary text-xs"
            >
              Open AI assistant
            </button>
            <Link to="/doctor/cases" className="ghost-button">
              Back to cases
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Created</p>
            <p className="text-lg font-semibold text-ink">
              {createdAt || "--"}
            </p>
            <p className="text-xs text-ink-muted">Case opened</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Updated</p>
            <p className="text-lg font-semibold text-ink">
              {updatedAt || "--"}
            </p>
            <p className="text-xs text-ink-muted">Last activity</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Stage</p>
            <p className="text-lg font-semibold text-ink">{model.stage}</p>
            <p className="text-xs text-ink-muted">Current status</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Next review</p>
            <p className="text-lg font-semibold text-ink">
              {model.nextReviewDate || "--"}
            </p>
            <p className="text-xs text-ink-muted">Follow-up date</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="mb-4 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {statusMsg}
        </div>
      )}
      <div className="mb-4 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink-muted">
        <div>{renderAgentStatus()}</div>
        <div className="mt-1 text-[11px] text-ink-muted">
          Last checked: {lastCheckedAt || "--"}
        </div>
      </div>



      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="surface rounded-2xl px-5 py-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">Diagnosis</label>
              <input
                value={model.diagnosis}
                onChange={(e) =>
                  setModel((prev) => ({ ...prev, diagnosis: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Tooth / region</label>
              <input
                value={model.toothRegion}
                onChange={(e) =>
                  setModel((prev) => ({ ...prev, toothRegion: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">Stage</label>
              <select
                value={model.stage}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    stage: e.target.value as CaseStage,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="New">New</option>
                <option value="In treatment">In treatment</option>
                <option value="Waiting on patient">Waiting on patient</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-muted">Next review date</label>
              <input
                type="date"
                value={model.nextReviewDate}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    nextReviewDate: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-muted">Notes</label>
            <textarea
              value={model.notes}
              onChange={(e) =>
                setModel((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={5}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dbId}
              className="btn btn-primary text-xs disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleRequestSummary}
              disabled={!dbId || isSummaryBusy}
              className="btn btn-secondary text-xs disabled:opacity-60"
            >
              {isSummaryBusy ? "Generating..." : "Generate AI summary"}
            </button>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="ghost-button"
            >
              Open AI assistant
            </button>
          </div>
          {summaryStatus && (
            <p className="text-[11px] text-ink-muted">{summaryStatus}</p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="surface rounded-2xl px-4 py-4 space-y-2">
            <h3 className="text-sm font-semibold text-ink">AI summaries</h3>
            {summaries.length === 0 ? (
              <p className="text-xs text-ink-muted">No AI summaries yet.</p>
            ) : (
              <div className="space-y-2">
                {summaries.map((s) => (
                  <div
                    key={s.id || `${s.createdAt}-${s.status}`}
                    className="rounded-xl border border-line bg-surface-muted p-3"
                  >
                    <div className="text-[11px] text-ink-muted">
                      {s.createdAt ? s.createdAt.slice(0, 16).replace("T", " ") : "--"}
                      {s.status ? ` - ${s.status}` : ""}
                    </div>
                    <p className="text-xs text-ink">
                      {s.summary || "Summary pending."}
                    </p>
                    {s.recommendation && (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {s.recommendation}
                      </p>
                    )}
                    {String(s.status).toUpperCase() !== "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() => handleApproveSummary(s.id)}
                        className="mt-2 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink hover:bg-surface-muted"
                      >
                        Approve summary
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface rounded-2xl px-4 py-4 space-y-2">
            <h3 className="text-sm font-semibold text-ink">Generated documents</h3>
            {documents.length === 0 ? (
              <p className="text-xs text-ink-muted">No generated documents yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="rounded-xl border border-line bg-surface-muted p-3">
                    <div className="text-[11px] text-ink-muted">
                      {String(d.doc_type || "").replace("_", " ")} - {d.status || "DRAFT"}
                    </div>
                    <p className="text-xs text-ink mt-1 whitespace-pre-wrap">
                      {String(d.content || "").slice(0, 260) || "Document content pending."}
                    </p>
                    <div className="mt-1 text-[11px] text-ink-muted">
                      {(d.updated_at || d.created_at || "").toString().slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface rounded-2xl px-4 py-4 space-y-2">
            <h3 className="text-sm font-semibold text-ink">Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-ink-muted">No timeline entries yet.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((t) => (
                  <div
                    key={t.id || `${t.createdAt}-${t.action}`}
                    className="rounded-xl border border-line bg-surface-muted p-3 text-xs text-ink-muted"
                  >
                    <div className="text-[11px] text-ink-muted">
                      {t.createdAt ? t.createdAt.slice(0, 16).replace("T", " ") : "--"}
                      {" - "}
                      {t.actor || "System"}
                    </div>
                    <div className="font-semibold text-ink">
                      {t.action || "Update"}
                    </div>
                    {t.note && <div className="mt-1">{t.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <AIAssistantModal
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        context="cases"
      />
    </DoctorLayout>
  );
};

export default DoctorCaseDetails;
