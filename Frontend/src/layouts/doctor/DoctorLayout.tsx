// src/layouts/doctor/DoctorLayout.tsx
import React, { useState, useEffect } from "react";
import { MenuIcon } from "lucide-react";
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

  const openSidebar = () => setSidebarOpen(true);
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      <DoctorSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-3 py-2 lg:hidden border-b border-line bg-surface/90 backdrop-blur">
          <div className="text-sm font-semibold text-ink">Doctor Workspace</div>

          <button
            type="button"
            onClick={openSidebar}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-line bg-surface text-ink"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
