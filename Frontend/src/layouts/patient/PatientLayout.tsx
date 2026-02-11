import React, { useEffect, useMemo, useState } from "react";
import { MenuIcon } from "lucide-react";
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

  const leftPad = useMemo(() => {
    return sidebarOpen ? "lg:pl-64" : "lg:pl-16";
  }, [sidebarOpen]);

  const openSidebar = () => setSidebarOpen(true);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

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
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
          <div className="text-sm font-semibold text-ink">Patient Portal</div>
          <button
            type="button"
            onClick={openSidebar}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-line bg-surface text-ink"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
