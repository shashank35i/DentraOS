// src/layouts/patient/PatientSidebar.tsx
import React from "react";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  FileTextIcon,
  CreditCardIcon,
  HelpCircleIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  UserIcon,
  PanelLeftIcon,
  BellIcon,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth } from "../../components/ProtectedRoute";
import { useTheme } from "../../contexts/ThemeContext";

interface PatientSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItemBase =
  "flex items-center rounded-xl py-2 text-sm font-medium transition-colors border";

export const PatientSidebar: React.FC<PatientSidebarProps> = ({
  isOpen,
  onToggle,
}) => {
  const userName = localStorage.getItem("userName") || "Patient";
  const userId = localStorage.getItem("userId") || "PT-0000";
  const navigate = useNavigate();
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

  const active = "bg-[color:var(--brand)] text-white border-transparent shadow-soft";
  const inactive =
    "text-ink-muted hover:text-ink hover:bg-surface-muted border-transparent";

  const SidebarBody: React.FC = () => (
    <div className="flex h-full flex-col bg-surface border-r border-line">
      <div
        className={`flex items-center border-b border-line gap-2 ${
          isOpen ? "justify-between px-3 pt-3 pb-3" : "justify-center px-1 py-3"
        }`}
      >
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-surface-muted border border-line flex items-center justify-center font-bold text-ink text-sm">
              PT
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-ink">Patient portal</span>
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
            className={
              isOpen ? "rotate-180 transition-transform" : "transition-transform"
            }
          />
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-6 overflow-y-auto">
        <div>
          {isOpen && (
            <p className="px-2 mb-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">
              Overview
            </p>
          )}
          <NavLink
            to="/patient/overview"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <LayoutDashboardIcon size={18} />
            {isOpen && <span>Dashboard</span>}
          </NavLink>
        </div>

        <div>
          {isOpen && (
            <p className="px-2 mb-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">
              My care
            </p>
          )}

          <NavLink
            to="/patient/appointments"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <CalendarDaysIcon size={18} />
            {isOpen && <span>Appointments</span>}
          </NavLink>

          <NavLink
            to="/patient/treatments"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <FileTextIcon size={18} />
            {isOpen && <span>Treatment summaries</span>}
          </NavLink>

          <NavLink
            to="/patient/billing"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <CreditCardIcon size={18} />
            {isOpen && <span>Payments</span>}
          </NavLink>

          <NavLink
            to="/patient/alerts"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <BellIcon size={18} />
            {isOpen && <span>Notifications</span>}
          </NavLink>
        </div>

        <div>
          {isOpen && (
            <p className="px-2 mb-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">
              Support
            </p>
          )}
          <NavLink
            to="/patient/support"
            className={({ isActive }) =>
              [
                navItemBase,
                isOpen
                  ? "px-3 gap-2.5 justify-start"
                  : "px-0 gap-0 justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
            onClick={handleNavClick}
          >
            <HelpCircleIcon size={18} />
            {isOpen && <span>Help & contact</span>}
          </NavLink>
        </div>
      </nav>

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
                <p className="text-[11px] text-ink-muted">{userId}</p>
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
          className={`absolute inset-y-0 left-0 w-64 max-w-[80%] h-full shadow-2xl transform transition-transform duration-200 bg-surface ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarBody />
        </aside>
      </div>
    </>
  );
};
