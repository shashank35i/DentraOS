// src/layouts/admin/AdminSidebar.tsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  UsersIcon,
  ClipboardListIcon,
  PackageIcon,
  LineChartIcon,
  HelpCircleIcon,
  LogOutIcon,
  PanelLeftIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  ActivityIcon,
  BellIcon,
  SettingsIcon,
} from "lucide-react";
import { clearAuth } from "../../components/ProtectedRoute";
import { useTheme } from "../../contexts/ThemeContext";

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const navBase =
  "flex items-center rounded-xl py-2 text-sm font-medium transition-colors border";
const active =
  "bg-[color:var(--brand)] text-white border-transparent shadow-soft";
const inactive =
  "border-transparent text-ink-muted hover:text-ink hover:bg-surface-muted";

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Admin";
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
    if (!isOpen) return;
    if (window.innerWidth < 1024) onClose();
  };

  const navItems = [
    { to: "/admin/overview", label: "Overview", Icon: LayoutDashboardIcon },
    { to: "/admin/clinic", label: "Clinic setup", Icon: SettingsIcon },
    { to: "/admin/schedule", label: "Appointments", Icon: CalendarDaysIcon },
    { to: "/admin/patients", label: "Patients", Icon: UsersIcon },
    { to: "/admin/cases", label: "Cases", Icon: ClipboardListIcon },
    { to: "/admin/case-ops", label: "Case tracking", Icon: ActivityIcon },
    { to: "/admin/alerts", label: "Notifications", Icon: BellIcon },
    { to: "/admin/inventory", label: "Inventory", Icon: PackageIcon },
    { to: "/admin/revenue", label: "Revenue", Icon: LineChartIcon },
    { to: "/admin/support", label: "Help & contact", Icon: HelpCircleIcon },
  ];

  const SidebarBody = () => (
    <div className="flex h-full flex-col bg-surface border-r border-line">
      <div
        className={`flex items-center border-b border-line ${
          isOpen ? "justify-between px-3 py-3" : "justify-center px-1 py-3"
        }`}
      >
        {isOpen && (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-surface-muted border border-line grid place-items-center font-semibold text-ink">
              DC
            </div>
            <div className="text-sm font-semibold text-ink">Clinic Admin</div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="h-8 w-8 grid place-items-center rounded-full hover:bg-surface-muted text-ink-muted"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelLeftIcon
            size={18}
            className={isOpen ? "rotate-180 transition-transform" : ""}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleNavClick}
            className={({ isActive }) =>
              [
                navBase,
                isOpen ? "px-3 gap-2.5" : "justify-center",
                isActive ? active : inactive,
              ].join(" ")
            }
          >
            <Icon size={18} />
            {isOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-line px-3 py-3 space-y-3">
        {isOpen && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-2 py-1.5">
            <span className="text-[11px] text-ink-muted">Appearance</span>
            <div className="flex gap-1">
              <button
                onClick={() => setMode("light")}
                className={`h-7 w-7 rounded-lg grid place-items-center ${
                  themeMode === "light"
                    ? "bg-white text-ink shadow-soft"
                    : "hover:bg-white/70"
                }`}
                aria-label="Light theme"
              >
                <SunIcon size={14} />
              </button>
              <button
                onClick={() => setMode("dark")}
                className={`h-7 w-7 rounded-lg grid place-items-center ${
                  themeMode === "dark"
                    ? "bg-slate-900 text-white"
                    : "hover:bg-white/70"
                }`}
                aria-label="Dark theme"
              >
                <MoonIcon size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-surface-muted border border-line grid place-items-center">
              <UserIcon size={14} className="text-ink-muted" />
            </div>
            {isOpen && (
              <div>
                <p className="text-xs font-medium text-ink">{userName}</p>
                <p className="text-[11px] text-ink-muted">Signed in</p>
              </div>
            )}
          </div>

          {isOpen && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-line px-2.5 py-1 text-[11px] hover:bg-surface-muted"
            >
              <LogOutIcon size={13} />
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block h-screen transition-[width] duration-150 ${
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
          className={`absolute inset-0 bg-black/40 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-64 bg-surface transform transition-transform ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarBody />
        </aside>
      </div>
    </>
  );
};
