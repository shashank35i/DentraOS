// src/layouts/doctor/DoctorSidebar.tsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  UsersIcon,
  ActivityIcon,
  HelpCircleIcon,
  LogOutIcon,
  StethoscopeIcon,
  PanelLeftIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  BellIcon,
} from "lucide-react";
import { clearAuth } from "../../components/ProtectedRoute";
import { useTheme } from "../../contexts/ThemeContext";

interface DoctorSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItemBase =
  "flex items-center rounded-xl py-2 text-sm transition-colors border";
const activeStyles =
  "bg-[color:var(--brand)] text-white border-transparent shadow-soft";
const inactiveStyles =
  "text-ink-muted hover:text-ink hover:bg-surface-muted border-transparent";

export const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  isOpen,
  onToggle,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Doctor";
  const { mode, setMode } = useTheme();
  const themeMode =
    mode === "system"
      ? document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
      : mode;

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const handleNavClick = () => {
    if (isOpen && window.innerWidth < 1024) onToggle();
  };

  const navItems = [
    {
      label: "Overview",
      to: "/doctor/overview",
      Icon: LayoutDashboardIcon,
    },
    {
      label: "Today's schedule",
      to: "/doctor/schedule",
      Icon: CalendarDaysIcon,
    },
    {
      label: "Cases",
      to: "/doctor/cases",
      Icon: ClipboardListIcon,
    },
    {
      label: "Patients",
      to: "/doctor/patients",
      Icon: UsersIcon,
    },
    {
      label: "Insights",
      to: "/doctor/insights",
      Icon: ActivityIcon,
    },
    { label: "Notifications", to: "/doctor/alerts", Icon: BellIcon },
  ];

  const supportItems = [
    {
      label: "Help & docs",
      to: "/doctor/support",
      Icon: HelpCircleIcon,
    },
  ];

  const SidebarBody: React.FC = () => (
    <div className="flex h-full flex-col bg-surface border-r border-line">
      <div
        className={`flex items-center border-b border-line gap-2 ${
          isOpen
            ? "justify-between px-3 pt-3 pb-3"
            : "justify-center px-1 py-3"
        }`}
      >
        {isOpen && (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-surface-muted border border-line grid place-items-center">
              <StethoscopeIcon size={18} className="text-brand" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink">Doctor Console</div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-muted text-ink-muted"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelLeftIcon
            size={18}
            className={isOpen ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
        <div>
          {isOpen && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-muted mb-2.5">
              Workspace
            </div>
          )}
          <nav className="space-y-1">
            {navItems.map(({ label, to, Icon }) => {
              const isOverview =
                label === "Overview" &&
                (location.pathname === "/doctor/overview" ||
                  location.pathname === "/doctor");

              return (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) =>
                    [
                      navItemBase,
                      isOpen
                        ? "px-3 gap-2.5 justify-start"
                        : "px-0 gap-0 justify-center",
                      isActive || isOverview ? activeStyles : inactiveStyles,
                    ].join(" ")
                  }
                  onClick={handleNavClick}
                >
                  <Icon size={18} className="shrink-0" />
                  {isOpen && <span>{label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div>
          {isOpen && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-muted mb-2.5">
              Support
            </div>
          )}
          <nav className="space-y-1">
            {supportItems.map(({ label, to, Icon }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  [
                    navItemBase,
                    isOpen
                      ? "px-3 gap-2.5 justify-start"
                      : "px-0 gap-0 justify-center",
                    isActive ? activeStyles : inactiveStyles,
                    "text-ink-muted",
                  ].join(" ")
                }
                onClick={handleNavClick}
              >
                <Icon size={18} className="shrink-0" />
                {isOpen && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-t border-line px-3 py-3 space-y-2">
        {isOpen && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-2 py-1.5">
            <span className="text-[11px] text-ink-muted">Appearance</span>
            <div className="inline-flex items-center gap-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode("light")}
                className={`h-7 w-7 rounded-lg grid place-items-center text-ink-muted ${
                  themeMode === "light"
                    ? "bg-white text-ink shadow-soft"
                    : "hover:bg-white/70"
                }`}
                aria-label="Light theme"
              >
                <SunIcon size={15} />
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={`h-7 w-7 rounded-lg grid place-items-center text-ink-muted ${
                  themeMode === "dark"
                    ? "bg-surface text-white"
                    : "hover:bg-white/70"
                }`}
                aria-label="Dark theme"
              >
                <MoonIcon size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-surface-muted border border-line grid place-items-center text-xs font-semibold text-ink">
              <UserIcon size={14} />
            </div>
            {isOpen && (
              <div className="leading-tight">
                <p className="text-xs font-medium text-ink">{userName}</p>
                <p className="text-[11px] text-ink-muted">Signed in</p>
              </div>
            )}
          </div>

          {isOpen && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface-muted transition"
            >
              <LogOutIcon size={13} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block h-screen overflow-hidden transition-[width] duration-150 ease-out ${
          isOpen ? "w-64" : "w-16"
        }`}
      >
        <SidebarBody />
      </aside>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onToggle}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 w-64 max-w-[80%] h-full bg-surface shadow-2xl transform transition-transform duration-200 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarBody />
        </aside>
      </div>
    </>
  );
};
