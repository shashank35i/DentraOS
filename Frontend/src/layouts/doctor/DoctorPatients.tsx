import React, { useEffect, useMemo, useState } from "react";
import { UsersIcon, AlertCircleIcon } from "lucide-react";
import { DoctorLayout } from "../../layouts/doctor/DoctorLayout";

type DoctorPatient = {
  id: string;
  name: string;
  lastVisit: string | null;
  activeCases: number;
};

const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

const getAuthToken = () =>
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  "";

export const DoctorPatients: React.FC = () => {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please login again.");
      setLoading(false);
      return;
    }

    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/doctor/patients`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to load patients");
        }

        const data = await res.json();
        setPatients(data.items || []);
      } catch (err: any) {
        console.error("Doctor patients error:", err);
        setError(err.message || "Unable to load patients");
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const totalPatients = patients.length;
  const activeCaseCount = useMemo(
    () => patients.reduce((sum, p) => sum + (p.activeCases || 0), 0),
    [patients]
  );
  const recentPatients = useMemo(
    () => patients.filter((p) => p.lastVisit).length,
    [patients]
  );

  return (
    <DoctorLayout>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title">Patient panel</p>
            <h1 className="text-2xl font-semibold text-ink">Patients</h1>
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">
              A focused list of patients currently under your care, with active
              cases and last visit context for quick follow up.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total patients</p>
            <p className="text-2xl font-semibold text-ink">{totalPatients}</p>
            <p className="text-xs text-ink-muted">Active panel size</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Active cases</p>
            <p className="text-2xl font-semibold text-ink">{activeCaseCount}</p>
            <p className="text-xs text-ink-muted">Open care plans</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Recent visits</p>
            <p className="text-2xl font-semibold text-ink">{recentPatients}</p>
            <p className="text-xs text-ink-muted">With recorded visit</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <UsersIcon size={18} className="text-brand" />
          <h2 className="text-sm font-semibold text-ink">Patient list</h2>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-ink-muted">
            Loading patients...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-800">
            <AlertCircleIcon size={14} className="mt-0.5" />
            <div>
              <p className="font-semibold">Could not load patients</p>
              <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
            </div>
          </div>
        ) : patients.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-muted">
            No patients found for your recent appointments.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-ink-muted border-b border-line">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Last visit</th>
                  <th className="py-2 pr-4 font-medium">Active cases</th>
                  <th className="py-2 pr-2 font-medium text-right">ID</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-muted transition"
                  >
                    <td className="py-2 pr-4 align-top text-ink">
                      {p.name}
                    </td>
                    <td className="py-2 pr-4 align-top text-ink-muted">
                      {p.lastVisit || "--"}
                    </td>
                    <td className="py-2 pr-4 align-top text-ink-muted">
                      {p.activeCases}
                    </td>
                    <td className="py-2 pr-2 align-top text-right text-ink-muted font-mono">
                      {p.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DoctorLayout>
  );
};
