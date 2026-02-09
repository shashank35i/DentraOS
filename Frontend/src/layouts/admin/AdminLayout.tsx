// src/layouts/admin/AdminLayout.tsx
import React, { useState } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";

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

  const setOpen = (value: boolean) => {
    setSidebarOpen(value);
    localStorage.setItem(SIDEBAR_KEY, String(value));
  };

  const openSidebar = () => setOpen(true);
  const closeSidebar = () => setOpen(false);
  const toggleSidebar = () => setOpen(!sidebarOpen);

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onClose={closeSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={openSidebar}
                className="inline-flex lg:hidden items-center justify-center h-9 w-9 rounded-xl border border-line bg-surface text-ink"
                aria-label="Open sidebar"
              >
                <MenuIcon size={18} />
              </button>
            )}

            <div className="hidden lg:block text-xs font-semibold tracking-[0.18em] uppercase text-ink-muted">
              Admin Panel
            </div>
          </div>

          <div className="text-[11px] text-ink-muted">Dental Clinic - Admin</div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
