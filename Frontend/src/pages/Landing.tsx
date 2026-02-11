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

  const metrics = [
    { label: "Role-based workspaces", value: "3 portals" },
    { label: "Automation agents", value: "4 agents" },
    { label: "Core workflows", value: "Appointments, Inventory, Revenue, Cases" },
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
    <div className="app-shell min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-96 w-96 rounded-full bg-[color:var(--brand)]/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-60 left-[-10%] h-80 w-80 rounded-full bg-sky-400/10 blur-[110px]" />
      <nav className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl border border-line bg-surface-muted grid place-items-center font-semibold text-ink">
              DO
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-ink">DentraOS</div>
              <div className="text-[11px] text-ink-muted">
                Clinical operations, unified.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
            <Link
              to="/login"
              className="text-sm font-medium text-ink-muted hover:text-ink self-start sm:self-auto"
            >
              Login
            </Link>
            <Link to="/create-account" className="btn btn-primary w-full sm:w-auto text-center">
              Request access
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-14 pb-10 sm:pb-12">
        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8 lg:gap-10 items-center">
          <div className="reveal order-2 lg:order-1">
            <p className="section-title">Dental Clinic Operating System</p>
            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-ink leading-tight">
              DentraOS orchestrates every visit with calm, precision, and trust.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-ink-muted max-w-2xl">
              A unified platform for scheduling, treatments, inventory, and revenue —
              powered by AI agents that remove admin friction and keep care consistent.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="btn btn-primary w-full sm:w-auto text-center">
                Sign in to DentraOS
              </Link>
              <Link to="/create-account" className="btn btn-secondary w-full sm:w-auto text-center">
                Request access
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {benefits.map((b) => (
                <span key={b} className="pill">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="surface rounded-[28px] p-5 sm:p-6 md:p-7 shadow-card reveal-delay order-1 lg:order-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-ink-muted">Ops cockpit</p>
                <h2 className="text-lg font-semibold text-ink">Clinic pulse</h2>
              </div>
              <span className="pill">Live</span>
            </div>

            <div className="space-y-3">
              {agents.map(({ title, body, Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted px-4 py-3"
                >
                  <div className="h-10 w-10 rounded-2xl bg-[color:var(--brand)]/10 grid place-items-center">
                    <Icon size={18} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="text-xs text-ink-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3 text-xs">
              {metrics.map((m) => (
                <div key={m.label} className="surface-muted rounded-xl px-3 py-2">
                  <div className="text-[11px] text-ink-muted">{m.label}</div>
                  <div className="font-semibold text-ink">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="surface rounded-[28px] p-6 sm:p-8 md:p-10 reveal">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <p className="section-title">AI Agents</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Four agents running the clinic engine
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="surface rounded-2xl p-6 reveal">
            <p className="section-title">Outcomes</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              Operational clarity that scales with you
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              DentraOS aligns the entire team around a single, trusted workflow. Every visit,
              case, and follow-up is visible, coordinated, and auditable.
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="surface rounded-[28px] p-6 sm:p-8 md:p-10 text-center reveal">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink">
            Ready to run your clinic on DentraOS
          </h2>
          <p className="mt-3 text-sm text-ink-muted max-w-2xl mx-auto">
            Launch with clean dashboards, role-based access, and agents that remove repetitive
            work from day one.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/create-account" className="btn btn-primary w-full sm:w-auto text-center">
              Request access
            </Link>
            <Link to="/login" className="btn btn-secondary w-full sm:w-auto text-center">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="font-semibold text-ink">DentraOS</div>
            <p className="text-sm text-ink-muted">
              Professional operating system for dental care.
            </p>
          </div>
          <div className="text-sm text-ink-muted">© 2026 DentraOS</div>
        </div>
      </footer>
    </div>
  );
};
