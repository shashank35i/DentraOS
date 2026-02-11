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
  SparklesIcon,
  ShieldIcon,
  Globe2Icon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const themeMode =
    mode === "system"
      ? document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
      : mode;

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
    { label: "Built for teams", value: "Admin, Doctor, Patient" },
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

      <nav className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl border border-line bg-surface-muted grid place-items-center font-semibold text-ink">
              DO
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-ink">DentraOS</div>
              <div className="text-[11px] text-ink-muted">Clinical operations, unified.</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-nowrap">
            <button
              type="button"
              onClick={() => setMode(themeMode === "dark" ? "light" : "dark")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink"
              aria-label="Toggle theme"
            >
              {themeMode === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
            <Link to="/login" className="btn btn-secondary px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[92px] shrink-0 leading-none">
              Sign in
            </Link>
            <Link to="/create-account" className="btn btn-primary px-4 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[120px] shrink-0 leading-none">
              Request access
            </Link>
          </div>
        </div>

        <div className="hidden sm:block border-t border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center gap-4 text-xs text-ink-muted">
            <a href="#about" className="hover:text-ink">About</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#agents" className="hover:text-ink">Agents</a>
            <a href="#roles" className="hover:text-ink">Roles</a>
          </div>
        </div>
      </nav>

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-8 sm:pb-10">
        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8 lg:gap-10 items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
              <SparklesIcon size={14} className="text-brand" />
              Clinic-grade AI operating system
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-ink leading-tight">
              A calm, intelligent home for every dental visit.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-ink-muted max-w-2xl">
              DentraOS is a modern clinical OS built for dentistry. It unifies scheduling,
              treatment tracking, inventory, and billing into a single trusted workspace.
              AI agents handle the repetitive work so your team can focus on care.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 text-xs">
              {metrics.map((m) => (
                <div key={m.label} className="surface-muted rounded-xl px-3 py-2">
                  <div className="text-[11px] text-ink-muted">{m.label}</div>
                  <div className="font-semibold text-ink">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="btn btn-primary w-full sm:w-auto text-center">
                Sign in to DentraOS
              </Link>
              <Link to="/create-account" className="btn btn-secondary w-full sm:w-auto text-center">
                Request access
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {benefits.map((b) => (
                <span key={b} className="pill">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="surface rounded-[28px] p-5 sm:p-6 md:p-7 shadow-card reveal-delay">
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
          </div>
        </div>
      </header>

      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="surface rounded-[28px] p-6 sm:p-8 md:p-10 reveal">
          <div className="grid md:grid-cols-[1.1fr,0.9fr] gap-6 items-center">
            <div>
              <p className="section-title">About</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-ink">
                Built like the best AI products: clean, focused, and fast.
              </h2>
              <p className="mt-3 text-sm text-ink-muted">
                DentraOS combines role-based workspaces, live operational insights, and AI
                automation so teams move faster with fewer mistakes and better patient outcomes.
              </p>
            </div>
            <div className="surface-muted rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <ShieldIcon size={20} className="text-brand mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-ink">Designed for trust</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Clear permissions, audit-friendly workflows, and predictable data handling.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 mt-4">
                <Globe2Icon size={20} className="text-brand mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-ink">Anywhere access</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Web-first experience built for desktop and mobile use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
                <li key={item} className="flex items-center gap-2 flex-nowrap">
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

      <section id="agents" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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

      <section id="roles" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
