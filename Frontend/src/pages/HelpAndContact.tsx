// src/pages/HelpAndContact.tsx
import React from "react";
import { HelpCircleIcon, MailIcon, PhoneIcon, MessageCircleIcon } from "lucide-react";
import { PatientLayout } from "../layouts/patient/PatientLayout";

export const HelpAndContact: React.FC = () => {
  const supportEmail = "support@dentalclinic.ai";
  const supportPhone = "+91-0000-000-000";

  return (
    <PatientLayout>
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HelpCircleIcon size={18} className="text-slate-200" />
          <h1 className="text-lg font-semibold text-slate-50">
            Help & contact
          </h1>
        </div>
        <p className="text-xs text-slate-400 max-w-xl">
          This portal is read-only. If anything looks incorrect or you need to reschedule an appointment, contact your clinic directly using the details below.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-50">
            <PhoneIcon size={16} className="text-emerald-300" />
            Phone
          </div>
          <p className="text-xs text-slate-300">
            Call the clinic for urgent questions, rescheduling, or billing queries.
          </p>
          <p className="text-sm font-medium text-slate-50 mt-1">
            {supportPhone}
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-50">
            <MailIcon size={16} className="text-sky-300" />
            Email
          </div>
          <p className="text-xs text-slate-300">
            For non-urgent questions or to share reports, you can email the clinic.
          </p>
          <p className="text-sm font-medium text-slate-50 mt-1">
            {supportEmail}
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-50">
            <MessageCircleIcon size={16} className="text-emerald-300" />
            Portal notes
          </div>
          <p className="text-xs text-slate-300">
            If you spot something that looks wrong (wrong tooth, wrong date, etc.), note down the appointment ID or invoice ID and mention it when you contact the clinic.
          </p>
        </div>
      </section>

      <section className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 space-y-2">
        <p className="font-semibold text-slate-50">FAQ</p>
        <p>
          <span className="font-medium text-slate-100">
            Can I change or cancel appointments here
          </span>{" "}
          No. This portal is read-only. Please call the clinic to make changes.
        </p>
        <p>
          <span className="font-medium text-slate-100">
            Why does it say “AI summaries”
          </span>{" "}
          Your dentist uses AI tools to generate clear summaries from clinical notes. These are always reviewed by a human before appearing here.
        </p>
      </section>
    </PatientLayout>
  );
};
