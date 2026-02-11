// src/layouts/doctor/DoctorLayout.tsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  UsersIcon,
  ActivityIcon,
} from "lucide-react";
import { DoctorSidebar } from "./DoctorSidebar";

interface DoctorLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "doctor_sidebar_open";

export const DoctorLayout: React.FC<DoctorLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

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

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const navItems = [
    { to: "/doctor/overview", label: "Home", Icon: LayoutDashboardIcon },
    { to: "/doctor/schedule", label: "Schedule", Icon: CalendarDaysIcon },
    { to: "/doctor/cases", label: "Cases", Icon: ClipboardListIcon },
    { to: "/doctor/patients", label: "Patients", Icon: UsersIcon },
    { to: "/doctor/insights", label: "Insights", Icon: ActivityIcon },
  ];

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      <DoctorSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-3 py-2 lg:hidden border-b border-line bg-surface/90 backdrop-blur">
          <div className="text-sm font-semibold text-ink">Doctor Workspace</div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
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
