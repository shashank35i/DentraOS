import React from "react";
import {
  HelpCircle,
  MessageCircle,
  Mail,
  BookOpen,
  LifeBuoy,
  Bug,
  ExternalLink,
  ArrowRightCircle,
  Sparkles,
} from "lucide-react";
import { DoctorLayout } from "./DoctorLayout";

export const DoctorHelp: React.FC = () => {
  return (
    <DoctorLayout>
      <div className="space-y-6">
        <section className="surface rounded-2xl px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <p className="section-title">Support desk</p>
              <h1 className="text-2xl font-semibold text-ink">
                How can we help you today
              </h1>
              <p className="text-sm text-ink-muted max-w-2xl">
                Guidance for appointments, case workflows, patient management, and
                AI assistant tools.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700">
                <Sparkles size={13} />
                <span>AI assistants online</span>
              </div>
              <p className="text-[11px] text-ink-muted">
                Use the chat shortcut inside any case or appointment to ask the AI
                for clinical summaries and drafts.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.4fr,1.1fr] gap-4">
          <div className="space-y-4">
            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">Quick actions</h2>
                <span className="text-[11px] text-ink-muted">
                  Frequent doctor workflows
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <button className="w-full text-left rounded-xl border border-line bg-surface-muted px-3 py-2.5 hover:border-emerald-500/40 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      Document a new case
                    </span>
                    <ArrowRightCircle size={14} className="text-ink-muted" />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Start from today&apos;s appointment or patient profile.
                  </p>
                </button>

                <button className="w-full text-left rounded-xl border border-line bg-surface-muted px-3 py-2.5 hover:border-emerald-500/40 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      Summarize a treatment plan
                    </span>
                    <ArrowRightCircle size={14} className="text-ink-muted" />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Generate patient-facing notes with the AI summary tool.
                  </p>
                </button>

                <button className="w-full text-left rounded-xl border border-line bg-surface-muted px-3 py-2.5 hover:border-emerald-500/40 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      Review follow-ups
                    </span>
                    <ArrowRightCircle size={14} className="text-ink-muted" />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Filter cases by "Waiting on patient" stage.
                  </p>
                </button>

                <button className="w-full text-left rounded-xl border border-line bg-surface-muted px-3 py-2.5 hover:border-emerald-500/40 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      Flag a complex case
                    </span>
                    <ArrowRightCircle size={14} className="text-ink-muted" />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Tag high-complexity work so admin can assist.
                  </p>
                </button>
              </div>
            </div>

            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-brand" />
                <h2 className="text-sm font-semibold text-ink">
                  Common questions
                </h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
                  <p className="font-medium text-ink">
                    How do I convert an appointment into a case
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Open the appointment and select Create case. The case will
                    link to the patient and visit automatically.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
                  <p className="font-medium text-ink">
                    Where can I see all cases assigned to me
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Go to Cases in the doctor console and filter by stage or
                    patient name.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
                  <p className="font-medium text-ink">
                    How does the AI summarizer use my notes
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    The AI only uses the fields and notes you enter to draft
                    summaries. You remain in full control before sharing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <LifeBuoy size={16} className="text-emerald-600" />
                <h2 className="text-sm font-semibold text-ink">
                  Need human support
                </h2>
              </div>

              <p className="text-xs text-ink-muted mb-3">
                For access issues, data corrections or urgent downtime, reach
                out to your clinic admin or technical support team.
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-brand" />
                    <div>
                      <p className="font-semibold text-ink">Clinic admin team</p>
                      <p className="text-[11px] text-ink-muted">
                        Roles, access and scheduling questions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-emerald-600" />
                    <div>
                      <p className="font-semibold text-ink">Technical support</p>
                      <p className="text-[11px] text-ink-muted">
                        Example: support@dental-clinic.ai
                      </p>
                    </div>
                  </div>
                  <a
                    href="mailto:support@dental-clinic.ai"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                  >
                    Email
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl px-5 py-4 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Bug size={14} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-ink">System tips</h2>
              </div>
              <ul className="space-y-2 list-disc list-inside text-ink-muted">
                <li>
                  If a page looks blank, try a hard refresh (Ctrl + Shift + R)
                  or re-login.
                </li>
                <li>
                  Avoid patient names in free text when sharing externally.
                </li>
                <li>
                  If a page is slow, note the time and case ID before contacting
                  support.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </DoctorLayout>
  );
};
