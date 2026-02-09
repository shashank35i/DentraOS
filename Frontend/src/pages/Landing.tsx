import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarIcon,
  PackageIcon,
  LineChartIcon,
  ClipboardListIcon,
  CheckIcon,
  UserIcon,
  UsersIcon,
  BuildingIcon,
  BriefcaseIcon,
} from "lucide-react";

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const role = (localStorage.getItem("userRole") || "").toUpperCase();

    if (token && role) {
      if (role === "ADMIN") {
        navigate("/admin/overview", { replace: true });
      } else if (role === "DOCTOR") {
        navigate("/doctor/overview", { replace: true });
      } else {
        navigate("/patient/overview", { replace: true });
      }
    }
  }, [navigate]);

  const agents = [
    {
      title: "Appointments Agent",
      body: "Schedules visits, manages changes, and keeps the day on track.",
      Icon: CalendarIcon,
    },
    {
      title: "Inventory Agent",
      body: "Predicts usage, flags shortages, and protects your supply chain.",
      Icon: PackageIcon,
    },
    {
      title: "Revenue Agent",
      body: "Surfaces trends and helps optimize profitability and cash flow.",
      Icon: LineChartIcon,
    },
    {
      title: "Case Tracking Agent",
      body: "Monitors treatments and keeps the care pathway consistent.",
      Icon: ClipboardListIcon,
    },
  ];

  const benefits = [
    "Reduce administrative overhead",
    "Keep schedules precise and balanced",
    "Prevent stockouts before they happen",
    "Deliver a smoother patient experience",
  ];

  const roles = [
    {
      title: "Dentist",
      body: "Patient histories, treatment summaries, and AI support for decisions.",
      Icon: UserIcon,
    },
    {
      title: "Staff",
      body: "Scheduling, inventory, and patient communication made easier.",
      Icon: UsersIcon,
    },
    {
      title: "Manager",
      body: "Operational dashboards, performance metrics, and reporting.",
      Icon: BuildingIcon,
    },
    {
      title: "Patient",
      body: "Appointments, treatment plans, and convenient billing views.",
      Icon: BriefcaseIcon,
    },
  ];

  return (
    <div className="app-shell min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl border border-line bg-surface-muted grid place-items-center font-semibold text-ink">
              DC
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-ink">Dental Clinic Intelligence</div>
              <div className="text-[11px] text-ink-muted">
                Agentic AI for clinical operations
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-ink-muted hover:text-ink">
              Login
            </Link>
            <Link to="/create-account" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="text-center reveal">
          <p className="section-title">Clinic Operating System</p>
          <h1 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-semibold text-ink">
            Calm, professional workflows for modern dental teams.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ink-muted max-w-3xl mx-auto">
            Four specialized agents coordinate appointments, inventory, revenue, and case
            tracking so your team can focus on care.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/login" className="btn btn-primary">
              Sign in
            </Link>
            <Link to="/admin/overview" className="btn btn-secondary">
              View Admin Demo
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-muted">
            {benefits.map((b) => (
              <span key={b} className="pill">
                {b}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="surface rounded-[28px] p-8 md:p-10 reveal">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="section-title">AI Agents</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Four agents that work in sync
              </h2>
            </div>
            <span className="text-xs text-ink-muted">Always on, always coordinated</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {agents.map(({ title, body, Icon }) => (
              <div key={title} className="surface-muted rounded-2xl p-5">
                <div className="w-11 h-11 rounded-2xl bg-[color:var(--brand)]/10 grid place-items-center mb-4">
                  <Icon size={20} className="text-brand" />
                </div>
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="surface rounded-2xl p-6 reveal">
            <p className="section-title">Outcomes</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              Operational clarity that scales
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              The platform aligns your team around a single, trusted workflow. Every visit,
              case, and follow-up is visible and coordinated.
            </p>
            <ul className="mt-5 space-y-3 text-sm text-ink-muted">
              {[
                "Consistent scheduling with agent-led conflict resolution",
                "Inventory guardrails that prevent urgent reorders",
                "Revenue insights that highlight improvement areas",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckIcon size={16} className="text-brand" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface rounded-2xl p-6 reveal-delay">
            <p className="section-title">Security</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              Built for healthcare-grade trust
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Role-based access, audit-friendly workflows, and predictable data handling keep
              your clinic safe and compliant.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              {[
                "Role separation",
                "Secure sessions",
                "Activity audit",
                "Permission controls",
              ].map((item) => (
                <div key={item} className="surface-muted rounded-xl px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8 reveal">
          <p className="section-title">Roles</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">Experiences tailored by role</h2>
          <p className="mt-3 text-sm text-ink-muted">
            Each persona sees a focused workspace, built for their responsibilities.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map(({ title, body, Icon }) => (
            <div key={title} className="surface rounded-2xl p-6 reveal">
              <div className="w-10 h-10 rounded-2xl bg-[color:var(--brand)]/10 grid place-items-center mb-4">
                <Icon size={18} className="text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="surface rounded-[28px] p-8 md:p-10 text-center reveal">
          <h2 className="text-3xl font-semibold text-ink">
            Ready to modernize your clinic
          </h2>
          <p className="mt-3 text-sm text-ink-muted max-w-2xl mx-auto">
            Launch with clean dashboards, role-based access, and agents that reduce work from
            day one.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/create-account" className="btn btn-primary">
              Create account
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Talk to support
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="font-semibold text-ink">Dental Clinic Intelligence</div>
            <p className="text-sm text-ink-muted">
              Professional agentic AI for dental operations.
            </p>
          </div>
          <div className="text-sm text-ink-muted">© 2026 Dental Clinic Intelligence</div>
        </div>
      </footer>
    </div>
  );
};
