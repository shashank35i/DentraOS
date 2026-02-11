import React, { useEffect, useState } from "react";
import {
  FileTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "../layouts/patient/PatientLayout";

type Treatment = {
  id: string;
  title: string;
  lastUpdated: string | null;
  stage: string;
  summary: string;
  details: string | null;
};

type TreatmentsResponse = {
  items: Treatment[];
  error: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");

  if (!token) {
    const err: any = new Error("Missing auth token");
    err.code = "NO_TOKEN";
    throw err;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body.message || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const PatientTreatments: React.FC = () => {
  const navigate = useNavigate();

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus("loading");
        setErrorMsg(null);

        const data = await fetchWithAuth<TreatmentsResponse>(
          "/api/patient/treatments"
        );
        if (cancelled) return;

        const items = Array.isArray(data.items) ? data.items : [];
        const safeItems = items.filter(
          (item): item is Treatment =>
            !!item && typeof item === "object" && "id" in item
        );
        setTreatments(safeItems);
        setExpandedId(safeItems.length ? safeItems[0].id : null);
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        console.error("PATIENT TREATMENTS ERROR", err);

        if (err.code === "NO_TOKEN" || err.status === 401) {
          setErrorMsg("Session expired. Please log in again.");
          setStatus("error");
          navigate("/loginrole=patient");
        } else {
          setErrorMsg(err.message || "Failed to load treatments.");
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <PatientLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Treatment archive</p>
          <h1 className="text-2xl font-semibold text-ink">
            Treatment summaries
          </h1>
          <p className="mt-1 text-sm text-ink-muted max-w-xl">
            AI-assisted summaries based on your clinical notes and reviewed by
            your dentist. Read-only and for your reference.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total summaries</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? treatments.length : "--"}
            </p>
            <p className="text-xs text-ink-muted">On record</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Reviewed</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? treatments.length : "--"}
            </p>
            <p className="text-xs text-ink-muted">Clinician approved</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Latest update</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" && treatments[0]?.lastUpdated
                ? treatments[0].lastUpdated
                : "--"}
            </p>
            <p className="text-xs text-ink-muted">Most recent note</p>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="mb-3 rounded-xl border border-amber-500/60 bg-amber-500/10 text-xs text-amber-800 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <section className="surface rounded-2xl px-5 py-4 space-y-3">
        {status === "loading" && (
          <p className="text-xs text-ink-muted">Loading summaries...</p>
        )}

        {status === "ready" && treatments.length === 0 && (
          <p className="text-xs text-ink-muted">
            No treatment summaries available yet.
          </p>
        )}

        {status === "ready" &&
          treatments.map((t) => {
            const isOpen = expandedId === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl border border-line bg-surface-muted overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : t.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{t.title}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Stage: {t.stage}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Updated: {t.lastUpdated || "--"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                    <CheckCircle2Icon size={12} />
                    <span>Reviewed by dentist</span>
                    {isOpen ? (
                      <ChevronDownIcon size={16} className="text-ink-muted" />
                    ) : (
                      <ChevronRightIcon size={16} className="text-ink-muted" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
                    <p className="mb-2">{t.summary}</p>
                    {t.details && (
                      <pre className="whitespace-pre-wrap font-sans text-[11px] text-ink-muted leading-relaxed bg-surface rounded-lg px-3 py-2 border border-line">
                        {t.details}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </section>
    </PatientLayout>
  );
};
