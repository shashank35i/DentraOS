import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  FileTextIcon,
  CreditCardIcon,
  BellIcon,
  UserIcon,
} from "lucide-react";
import { PatientSidebar } from "./PatientSidebar";

type Props = {
  children: React.ReactNode;
};

export const PatientLayout: React.FC<Props> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("patient_sidebar_open");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    localStorage.setItem("patient_sidebar_open", String(sidebarOpen));
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

  const leftPad = useMemo(() => {
    return sidebarOpen ? "lg:pl-64" : "lg:pl-16";
  }, [sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  const navItems = [
    { to: "/patient/overview", label: "Home", Icon: LayoutDashboardIcon },
    { to: "/patient/appointments", label: "Visits", Icon: CalendarDaysIcon },
    { to: "/patient/treatments", label: "Care", Icon: FileTextIcon },
    { to: "/patient/billing", label: "Billing", Icon: CreditCardIcon },
    { to: "/patient/profile", label: "Profile", Icon: UserIcon },
  ];

  return (
    <div className="app-shell h-screen w-full overflow-hidden">
      <div className="fixed inset-y-0 left-0 z-40">
        <PatientSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      </div>

      <div
        className={[
          leftPad,
          "h-screen flex flex-col",
          "transition-[padding] duration-150 ease-out",
        ].join(" ")}
      >
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-line bg-surface lg:hidden">
          <div className="text-sm font-semibold text-ink">Patient Portal</div>
          <NavLink
            to="/patient/alerts"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink"
            aria-label="Notifications"
          >
            <BellIcon size={16} />
          </NavLink>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-6">
          <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
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
