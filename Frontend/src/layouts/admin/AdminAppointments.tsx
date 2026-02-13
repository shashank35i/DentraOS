import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  FilterIcon,
  SearchIcon,
  ClockIcon,
  UserIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_API = `${API_BASE}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function localYYYYMMDD(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(val: any) {
  if (!val) return "--";
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return localYYYYMMDD(dt);
  return s.slice(0, 10);
}

type AppointmentRow = {
  id: string;
  date: string;
  time: string;
  patient: string;
  doctor: string;
  type: string;
  status: string;
};

type UserOption = {
  id: string;
  name: string;
  phone: string | null;
};

type CreateAppointmentForm = {
  patientUid: string;
  doctorUid: string;
  date: string;
  time: string;
  type: string;
  status: string;
};

type SuggestedSlot = {
  date: string;
  startTime: string;
  endTime: string;
  predictedDurationMin: number;
};

export const AdminAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayStr = useMemo(() => localYYYYMMDD(new Date()), []);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAppointmentForm>(() => {
    return {
      patientUid: "",
      doctorUid: "",
      date: localYYYYMMDD(new Date()),
      time: "10:00",
      type: "General consultation",
      status: "Confirmed",
    };
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);

  const [patients, setPatients] = useState<UserOption[]>([]);
  const [doctors, setDoctors] = useState<UserOption[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  const [patientSearch, setPatientSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${ADMIN_API}/appointments?date=${encodeURIComponent(todayStr)}`,
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        setAppointments(data.items || []);
      } catch (err) {
        console.error("AdminAppointments error:", err);
        setError("Failed to load appointments.");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [todayStr, refreshKey]);

  useEffect(() => {
    if (!showCreate) return;
    if (patients.length > 0 && doctors.length > 0) return;

    const loadPeople = async () => {
      try {
        setPeopleLoading(true);
        setPeopleError(null);

        const resPatients = await fetch(`${ADMIN_API}/patients`, {
          headers: getAuthHeaders(),
        });
        if (!resPatients.ok) throw new Error(`Patients status ${resPatients.status}`);
        const dataPatients = await resPatients.json();
        const patientItems: UserOption[] = (dataPatients.items || []).map((p: any) => ({
          id: p.id,
          name: p.name || p.full_name || "Unknown patient",
          phone: p.phone ?? null,
        }));

        const resDoctors = await fetch(`${ADMIN_API}/doctors`, {
          headers: getAuthHeaders(),
        });
        if (!resDoctors.ok) throw new Error(`Doctors status ${resDoctors.status}`);
        const dataDoctors = await resDoctors.json();
        const doctorItems: UserOption[] = (dataDoctors.items || []).map((d: any) => ({
          id: d.id,
          name: d.name || d.full_name || "Unknown doctor",
          phone: d.phone ?? null,
        }));

        setPatients(patientItems);
        setDoctors(doctorItems);

        setCreateForm((prev) => ({
          ...prev,
          patientUid: prev.patientUid || patientItems[0].id || "",
          doctorUid: prev.doctorUid || doctorItems[0].id || "",
        }));
      } catch (err: any) {
        console.error("AdminAppointments people load error:", err);
        setPeopleError(err.message || "Failed to load patient / doctor lists.");
      } finally {
        setPeopleLoading(false);
      }
    };

    loadPeople();
  }, [showCreate, patients.length, doctors.length]);

  const filtered = appointments.filter((apt) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      String(apt.status || "").toUpperCase() === String(statusFilter).toUpperCase();
    if (!matchesStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(apt.id).toLowerCase().includes(q) ||
      String(apt.patient).toLowerCase().includes(q) ||
      String(apt.doctor).toLowerCase().includes(q)
    );
  });

  const appointmentCounts = useMemo(() => {
    const confirmed = appointments.filter((a) => a.status === "Confirmed").length;
    const completed = appointments.filter((a) => a.status === "Completed").length;
    const cancelled = appointments.filter((a) => a.status === "Cancelled").length;
    return { confirmed, completed, cancelled };
  }, [appointments]);

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  });

  const filteredDoctors = doctors.filter((d) => {
    if (!doctorSearch.trim()) return true;
    const q = doctorSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      (d.phone || "").toLowerCase().includes(q)
    );
  });

  function openCreateModal() {
    setCreateError(null);
    setPeopleError(null);
    setSuggestedSlots([]);
    setCreateForm((prev) => ({ ...prev, date: localYYYYMMDD(new Date()) }));
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreate(false);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setSuggestedSlots([]);

    const { patientUid, doctorUid, date, time, type, status } = createForm;

    if (!patientUid || !doctorUid) {
      setCreateError("Please select both patient and doctor.");
      return;
    }
    if (!date || !time) {
      setCreateError("Date and time are required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(`${ADMIN_API}/appointments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patientUid,
          doctorUid,
          date,
          time,
          type: type.trim() || "General consultation",
          status,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const body = contentType.includes("application/json")
          ? await res.json()
          : { message: await res.text() };

        if (res.status === 409 && body.conflict) {
          setCreateError(body.message || "Time slot conflict.");
          setSuggestedSlots(body.suggestedSlots || []);
          setCreating(false);
          return;
        }

        throw new Error(body.message || `Failed to create appointment (status ${res.status}).`);
      }

      setShowCreate(false);
      setCreating(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error("Create appointment error:", err);
      setCreating(false);
      setCreateError(err.message || "Could not create appointment.");
    }
  }

  function pickSuggestedSlot(slot: SuggestedSlot) {
    setCreateForm((f) => ({
      ...f,
      date: slot.date,
      time: slot.startTime.slice(0, 5),
    }));
    setCreateError(null);
  }

  return (
    <>
      <section className="surface rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="section-title">Clinic schedule</p>
            <h1 className="text-2xl font-semibold text-ink">Appointments</h1>
            <p className="mt-1 text-sm text-ink-muted">
              View and manage clinic appointments across all providers.
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              Date: <span className="font-mono">{todayStr}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="ghost-button">
              <FilterIcon size={14} />
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
            <button type="button" onClick={openCreateModal} className="btn btn-primary text-xs">
              New appointment
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink"
            >
              <option value="ALL">All statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Checked in">Checked in</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Requested">Requested</option>
            </select>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setStatusFilter("ALL");
                setSearch("");
              }}
            >
              Reset
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Total today</p>
            <p className="text-2xl font-semibold text-ink">{appointments.length}</p>
            <p className="text-xs text-ink-muted">Scheduled visits</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Confirmed</p>
            <p className="text-2xl font-semibold text-ink">{appointmentCounts.confirmed}</p>
            <p className="text-xs text-ink-muted">Ready to start</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Completed</p>
            <p className="text-2xl font-semibold text-ink">{appointmentCounts.completed}</p>
            <p className="text-xs text-ink-muted">Visits finished</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-ink-muted">Cancelled</p>
            <p className="text-2xl font-semibold text-ink">{appointmentCounts.cancelled}</p>
            <p className="text-xs text-ink-muted">No-show or reschedule</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs mb-4">
          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-ink-muted">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient, doctor, or ID"
              className="w-full rounded-2xl border border-line bg-surface pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-ink-muted">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-surface-muted">
              <ClockIcon size={12} />
              Today
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-surface-muted">
              <UserIcon size={12} />
              All doctors
            </span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] text-ink-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">ID</th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Patient</th>
                <th className="py-2 pr-4 font-medium">Doctor</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-ink-muted">
                    Loading appointments...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-ink-muted">
                    No appointments found.
                  </td>
                </tr>
              ) : (
                filtered.map((apt) => (
                  <tr
                    key={apt.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-muted transition"
                  >
                    <td className="py-2 pr-4 text-ink">{apt.id}</td>
                    <td className="py-2 pr-4 text-ink">{displayDate(apt.date)}</td>
                    <td className="py-2 pr-4 text-ink">{apt.time}</td>
                    <td className="py-2 pr-4 text-ink">{apt.patient}</td>
                    <td className="py-2 pr-4 text-ink">{apt.doctor}</td>
                    <td className="py-2 pr-4 text-ink-muted">{apt.type}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border " +
                          (apt.status === "Confirmed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/40"
                            : apt.status === "Checked in"
                            ? "bg-sky-500/10 text-sky-700 border-sky-400/40"
                            : apt.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-400/40"
                            : apt.status === "Cancelled"
                            ? "bg-rose-500/10 text-rose-700 border-rose-400/40"
                            : "bg-surface-muted text-ink border-line")
                        }
                      >
                        {apt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink">New appointment</h2>
              <button
                type="button"
                onClick={closeCreateModal}
                className="p-1 rounded-full hover:bg-surface-muted text-ink-muted"
              >
                <XIcon size={16} />
              </button>
            </div>

            <p className="text-[11px] text-ink-muted mb-3">
              Book an appointment for a patient with a selected doctor.
            </p>

            {peopleError && (
              <p className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {peopleError}
              </p>
            )}

            {createError && (
              <p className="mb-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            {suggestedSlots.length > 0 && (
              <div className="mb-3 rounded-xl border border-line bg-surface-muted p-3">
                <p className="text-[11px] text-ink font-semibold mb-2">
                  Suggested available slots (click one to fill):
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSlots.slice(0, 8).map((s, idx) => (
                    <button
                      key={`${s.date}-${s.startTime}-${idx}`}
                      type="button"
                      onClick={() => pickSuggestedSlot(s)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink hover:bg-surface-muted"
                    >
                      {s.startTime.slice(0, 5)}-{s.endTime.slice(0, 5)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-ink-muted mt-2">
                  Showing first 8 suggestions
                </p>
              </div>
            )}

            <form className="space-y-3 text-xs text-ink" onSubmit={handleCreateSubmit}>
              <div className="space-y-1">
                <label className="block text-[11px] text-ink-muted">Patient</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient by name, UID, or phone"
                  className="mb-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <select
                  value={createForm.patientUid}
                  onChange={(e) => setCreateForm((f) => ({ ...f, patientUid: e.target.value }))}
                  disabled={peopleLoading || patients.length === 0}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                >
                  <option value="">
                    {peopleLoading
                      ? "Loading patients..."
                      : filteredPatients.length === 0
                      ? "No patients match search"
                      : "Select patient"}
                  </option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-ink-muted">Doctor</label>
                <input
                  type="text"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Search doctor by name, UID, or phone"
                  className="mb-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <select
                  value={createForm.doctorUid}
                  onChange={(e) => setCreateForm((f) => ({ ...f, doctorUid: e.target.value }))}
                  disabled={peopleLoading || doctors.length === 0}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                >
                  <option value="">
                    {peopleLoading
                      ? "Loading doctors..."
                      : filteredDoctors.length === 0
                      ? "No doctors match search"
                      : "Select doctor"}
                  </option>
                  {filteredDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] text-ink-muted">Date</label>
                  <input
                    type="date"
                    value={createForm.date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-ink-muted">Time</label>
                  <input
                    type="time"
                    value={createForm.time}
                    onChange={(e) => setCreateForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-ink-muted">Visit type</label>
                <input
                  type="text"
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g. Implant consultation"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-ink-muted">Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Checked in">Checked in</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Requested">Requested</option>
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-ink-muted hover:bg-surface-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || peopleLoading || patients.length === 0 || doctors.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {creating && <Loader2Icon size={14} className="animate-spin" />}
                  <span>Create appointment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
