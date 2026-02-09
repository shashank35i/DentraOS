import React, { useMemo, useState } from "react";
import { PatientSidebar } from "./PatientSidebar";

type Props = {
  children: React.ReactNode;
};

export const PatientLayout: React.FC<Props> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const leftPad = useMemo(() => {
    return sidebarOpen ? "lg:pl-64" : "lg:pl-16";
  }, [sidebarOpen]);

  return (
    <div className="app-shell h-screen w-full overflow-hidden">
      <div className="fixed inset-y-0 left-0 z-40">
        <PatientSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />
      </div>

      <main
        className={[
          leftPad,
          "h-screen overflow-y-auto overflow-x-hidden",
          "transition-[padding] duration-150 ease-out",
        ].join(" ")}
      >
        <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};
