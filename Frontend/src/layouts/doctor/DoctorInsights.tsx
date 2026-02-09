import React from "react";
import { ActivityIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { DoctorLayout } from "../../layouts/doctor/DoctorLayout";

export const DoctorInsights: React.FC = () => {
  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Practice signals</p>
          <h1 className="text-2xl font-semibold text-ink">Insights</h1>
          <p className="mt-1 text-sm text-ink-muted max-w-2xl">
            A curated summary of weekly performance and patient engagement.
            Connect real analytics as the platform grows.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Chair utilization</p>
            <p className="text-2xl font-semibold text-ink">86%</p>
            <p className="text-xs text-ink-muted">Above 4-week average</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Follow-ups</p>
            <p className="text-2xl font-semibold text-ink">92%</p>
            <p className="text-xs text-ink-muted">Adherence this week</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Cancellations</p>
            <p className="text-2xl font-semibold text-ink">6%</p>
            <p className="text-xs text-ink-muted">Late afternoon slots</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Case velocity</p>
            <p className="text-2xl font-semibold text-ink">14</p>
            <p className="text-xs text-ink-muted">Active case touchpoints</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2Icon size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-ink">Positive signals</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li className="flex items-start gap-2">
              <CheckCircle2Icon size={13} className="mt-0.5 text-emerald-600" />
              <span>Chair utilization is above your 4-week average.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2Icon size={13} className="mt-0.5 text-emerald-600" />
              <span>Follow-up adherence is trending upwards for implant patients.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2Icon size={13} className="mt-0.5 text-emerald-600" />
              <span>Most morning slots are consistently filled.</span>
            </li>
          </ul>
        </div>

        <div className="surface rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircleIcon size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-ink">Watch list</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li className="flex items-start gap-2">
              <AlertCircleIcon size={13} className="mt-0.5 text-amber-600" />
              <span>Late afternoon slots have more cancellations than usual.</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircleIcon size={13} className="mt-0.5 text-amber-600" />
              <span>Two implant cases are approaching their review window.</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircleIcon size={13} className="mt-0.5 text-amber-600" />
              <span>Consider spacing long procedures with short hygiene visits.</span>
            </li>
          </ul>
        </div>
      </section>
    </DoctorLayout>
  );
};
