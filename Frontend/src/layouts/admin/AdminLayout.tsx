// src/layouts/admin/AdminLayout.tsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  UsersIcon,
  PackageIcon,
  BellIcon,
  UserIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { useTheme } from "../../contexts/ThemeContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "admin_sidebar_open";

const isDesktop = () =>
  typeof window !== "undefined" && window.innerWidth >= 1024;

const getInitialSidebarState = (): boolean => {
  if (typeof window === "undefined") return false;

  const stored = localStorage.getItem(SIDEBAR_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;

  return isDesktop();
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    getInitialSidebarState
  );
  const { mode, setMode } = useTheme();
  const themeMode =
    mode === "system"
      ? document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
      : mode;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const setOpen = (value: boolean) => {
    setSidebarOpen(value);
    localStorage.setItem(SIDEBAR_KEY, String(value));
  };

  const closeSidebar = () => setOpen(false);
  const toggleSidebar = () => setOpen(!sidebarOpen);

  const navItems = [
    { to: "/admin/overview", label: "Home", Icon: LayoutDashboardIcon },
    { to: "/admin/schedule", label: "Schedule", Icon: CalendarDaysIcon },
    { to: "/admin/patients", label: "Patients", Icon: UsersIcon },
    { to: "/admin/inventory", label: "Inventory", Icon: PackageIcon },
    { to: "/admin/profile", label: "Profile", Icon: UserIcon },
  ];

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onClose={closeSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-line bg-surface">
          <div className="hidden lg:block text-xs font-semibold tracking-[0.18em] uppercase text-ink-muted">
            Admin Panel
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-ink-muted">Dental Clinic - Admin</div>
            <NavLink
              to="/admin/alerts"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink"
              aria-label="Notifications"
            >
              <BellIcon size={16} />
            </NavLink>
            <button
              type="button"
              onClick={() => setMode(themeMode === "dark" ? "light" : "dark")}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink"
              aria-label="Toggle theme"
            >
              {themeMode === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface">
        <div className="grid grid-cols-5 gap-1 px-2 py-2 text-[11px] text-ink-muted">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-2",
                  isActive ? "text-brand bg-surface-muted" : "hover:text-ink",
                ].join(" ")
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};



