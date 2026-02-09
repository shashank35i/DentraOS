import React, { useEffect, useState } from "react";
import {
  CreditCardIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  DownloadIcon,
} from "lucide-react";
import { PatientLayout } from "../layouts/patient/PatientLayout";

type Payment = {
  id: number | string;
  date: string | null;
  description: string;
  amount: number;
  status: string;
  currency: string;
};

type DashboardResponse = {
  payments: Payment[];
};

type LoadState = "idle" | "loading" | "ready" | "error";

const rawBase =
  (import.meta as any).env.VITE_API_BASE_URL &&
  String((import.meta as any).env.VITE_API_BASE_URL).trim();

const API_ROOT = (rawBase || "http://localhost:4000").replace(/\/+$/, "");

export const PatientBilling: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    const fetchBilling = async () => {
      try {
        setStatus("loading");
        const token = localStorage.getItem("authToken");

        const res = await fetch(`${API_ROOT}/api/patient/dashboard`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          console.error("Patient billing HTTP error:", res.status);
          setStatus("error");
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        const rawText = await res.text();

        if (!contentType.includes("application/json")) {
          console.error(
            "Patient billing: non-JSON response (first 80 chars):",
            rawText.slice(0, 80).replace(/\s+/g, " ")
          );
          setStatus("error");
          return;
        }

        let data: DashboardResponse;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          console.error("Patient billing: failed to parse JSON:", parseErr);
          setStatus("error");
          return;
        }

        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Patient billing: network or fetch error:", err);
        setStatus("error");
      }
    };

    fetchBilling();
    return () => controller.abort();
  }, []);

  const currencyLabel =
    payments.length === 0
      ? "Rs "
      : payments[0].currency === "INR" || !payments[0].currency
        ? "Rs "
        : payments[0].currency + " ";

  const totalDue = payments
    .filter((p) => p.status && p.status.toUpperCase() !== "PAID")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const pendingCount = payments.filter(
    (p) => p.status && p.status.toUpperCase() !== "PAID"
  ).length;

  return (
    <PatientLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Billing</p>
          <h1 className="text-2xl font-semibold text-ink">
            Payments and invoices
          </h1>
          <p className="mt-1 text-sm text-ink-muted max-w-xl">
            Review past and upcoming charges. To pay or update billing details,
            contact your clinic front desk.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total due</p>
            <p className="text-2xl font-semibold text-ink">
              {currencyLabel}
              {Number(totalDue || 0).toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-ink-muted">Unpaid balance</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Pending invoices</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? pendingCount : "--"}
            </p>
            <p className="text-xs text-ink-muted">Awaiting payment</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total invoices</p>
            <p className="text-2xl font-semibold text-ink">
              {status === "ready" ? payments.length : "--"}
            </p>
            <p className="text-xs text-ink-muted">All time</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[0.9fr,1.1fr] gap-5">
        <div className="surface rounded-2xl px-5 py-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-ink-muted tracking-[0.16em] uppercase">
              Billing overview
            </p>
            <h2 className="mt-2 text-sm font-semibold text-ink">
              Current balance
            </h2>

            <p className="mt-1 text-2xl font-semibold text-amber-700">
              {currencyLabel}
              {Number(totalDue || 0).toLocaleString("en-IN")}
            </p>

            <p className="mt-1 text-[11px] text-ink-muted">
              Total of invoices not marked as Paid in your clinic system.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 text-[11px] text-ink-muted">
              <CreditCardIcon size={12} className="text-amber-600" />
              <span>
                Pending invoices: <span className="font-semibold">{status === "ready" ? pendingCount : "--"}</span>
              </span>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-ink-muted border-t border-line pt-3">
            For payment links, insurance clarifications, or corrections, contact
            your clinic billing team. Online payments are not processed in-app.
          </div>
        </div>

        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-ink-muted uppercase tracking-[0.14em]">
              Invoice history
            </p>
          </div>

          {status === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-surface-muted border border-line animate-pulse"
                />
              ))}
            </div>
          )}

          {status === "error" && (
            <p className="text-xs text-amber-700">
              Could not load billing information. Please refresh later or
              contact your clinic.
            </p>
          )}

          {status === "ready" && (
            <>
              {payments.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No invoices available yet. Your clinic may add invoices after
                  your first visit or treatment.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.14em] text-ink-muted border-b border-line">
                        <th className="py-2 pr-4">Invoice</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Description</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-2 text-right">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const rawStatus = (p.status || "").toUpperCase();
                        const isPaid = rawStatus === "PAID";
                        const isOverdue = rawStatus === "OVERDUE";
                        const statusLabel = isPaid
                          ? "Paid"
                          : isOverdue
                          ? "Overdue"
                          : p.status || "Pending";

                        const amountNum = Number(p.amount || 0);

                        const statusClasses = isPaid
                          ? "bg-emerald-500/10 text-emerald-700 border border-emerald-400/40"
                          : isOverdue
                          ? "bg-rose-500/10 text-rose-700 border border-rose-400/40"
                          : "bg-amber-500/10 text-amber-700 border border-amber-400/40";

                        return (
                          <tr key={p.id} className="border-b border-line last:border-b-0">
                            <td className="align-top py-2 pr-4 text-ink font-medium">
                              {typeof p.id === "string" ? p.id : `INV-${p.id}`}
                            </td>
                            <td className="align-top py-2 pr-4 text-ink-muted whitespace-nowrap">
                              {p.date || "--"}
                            </td>
                            <td className="align-top py-2 pr-4 text-ink-muted">
                              {p.description || "Dental treatment invoice"}
                            </td>
                            <td className="align-top py-2 pr-4 text-amber-700 font-semibold whitespace-nowrap">
                              {currencyLabel}
                              {amountNum.toLocaleString("en-IN")}
                            </td>
                            <td className="align-top py-2 pr-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses}`}
                              >
                                {isPaid ? (
                                  <CheckCircle2Icon size={11} className="mr-1" />
                                ) : (
                                  <AlertCircleIcon size={11} className="mr-1" />
                                )}
                                {statusLabel}
                              </span>
                            </td>
                            <td className="align-top py-2 pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  console.log(
                                    "PDF download is handled by the clinic; no in-app link.",
                                    p.id
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-line text-[11px] text-ink hover:bg-surface-muted transition disabled:opacity-60"
                              >
                                <DownloadIcon size={12} />
                                PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PatientLayout>
  );
};
