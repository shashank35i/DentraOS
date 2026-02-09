import React from "react";
import {
  HelpCircle,
  MessageCircle,
  FileText,
  PlayCircle,
  Mail,
} from "lucide-react";
import { Link } from "react-router-dom";

export const AdminHelp: React.FC = () => {
  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div>
          <p className="section-title">Support</p>
          <h1 className="text-2xl font-semibold text-ink">
            Admin help center
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Quick links for administrators to troubleshoot access, agents, and daily workflows.
          </p>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={16} className="text-emerald-600" />
            <p className="font-semibold text-ink">Common admin tasks</p>
          </div>
          <ul className="space-y-1 text-xs text-ink-muted">
            <li>Reset a user password</li>
            <li>Add a new doctor or patient</li>
            <li>Resolve login and role access issues</li>
          </ul>
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-brand" />
            <p className="font-semibold text-ink">Documentation</p>
          </div>
          <p className="text-xs text-ink-muted mb-2">
            Review how appointments, cases, inventory, and revenue dashboards are wired.
          </p>
          <p className="text-[11px] text-ink-muted">
            Link internal SOPs or process docs here if needed.
          </p>
        </div>

        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle size={16} className="text-violet-600" />
            <p className="font-semibold text-ink">Need more help</p>
          </div>
          <p className="text-xs text-ink-muted mb-2">
            Contact your tech team or support inbox for deeper debugging.
          </p>
          <Link to="/help/contact" className="btn btn-primary text-xs inline-flex items-center gap-1">
            <Mail size={14} />
            Contact support
          </Link>
        </div>
      </section>
    </>
  );
};
