// src/layouts/admin/AdminClinicSetup.tsx
import { useEffect, useMemo, useRef, useState } from "react";

type ClinicSettings = {
  clinic_name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  working_hours: any;
  treatment_types: string[];
  note_templates: any;
  ai_prefs: {
    enable_smart_scheduling: boolean;
    enable_no_show_detection: boolean;
    enable_inventory_anomaly_flags: boolean;
    enable_revenue_forecast: boolean;
  };
};

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function api(path: string) {
  // expects path like "/api/...."
  return `${API_BASE}${path}`;
}

function getAuthHeaders() {
  // MUST match what your Login/CreateAccount stores
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (value == null || value === "") return fallback;
    if (typeof value === "object") return value as T;
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

async function readJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return await res.text();
}

async function requestJson(path: string, init: RequestInit) {
  const res = await fetch(api(path), init);
  const body = await readJsonOrText(res);

  if (!res.ok) {
    // Prefer backend message fields if present
    const msg =
      (body && typeof body === "object" && (body.error || body.message)) ||
      (typeof body === "string" && body.trim()) ||
      `Request failed (HTTP ${res.status})`;

    const hint =
      res.status === 401 || res.status === 403
        ? " (Auth failed -- please login again and ensure you are ADMIN.)"
        : "";

    throw new Error(`${msg}${hint}`);
  }

  if (typeof body === "string") {
    // backend returned non-json but ok; still handle gracefully
    return { ok: true, raw: body };
  }

  return body;
}

const DEFAULT_WORKING_HOURS = {
  monday: [{ start: "10:00", end: "19:00" }],
  tuesday: [{ start: "10:00", end: "19:00" }],
  wednesday: [{ start: "10:00", end: "19:00" }],
  thursday: [{ start: "10:00", end: "19:00" }],
  friday: [{ start: "10:00", end: "19:00" }],
  saturday: [{ start: "10:00", end: "14:00" }],
  sunday: [],
};

export function AdminClinicSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [treatmentsText, setTreatmentsText] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState(
    JSON.stringify(DEFAULT_WORKING_HOURS, null, 2)
  );
  const [noteTemplatesText, setNoteTemplatesText] = useState(
    JSON.stringify(
      {
        follow_up: "Follow-up reminder: Please visit the clinic in {{days}} days.",
        no_show: "We missed you today. Reply to reschedule.",
        post_op: "Post-treatment care: {{instructions}}",
      },
      null,
      2
    )
  );
  const [aiPrefs, setAiPrefs] = useState({
    enable_smart_scheduling: true,
    enable_no_show_detection: true,
    enable_inventory_anomaly_flags: true,
    enable_revenue_forecast: true,
  });

  // Staff
  const [staff, setStaff] = useState<UserRow[]>([]);
  const [staffRole, setStaffRole] = useState("Doctor");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [creatingStaff, setCreatingStaff] = useState(false);

  const toastTimer = useRef<number | null>(null);

  const treatmentsList = useMemo(() => {
    const items = treatmentsText
      .split(/\r\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(items));
  }, [treatmentsText]);

  function showToast(msg: string, autoHideMs: number = 3500) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), autoHideMs);
  }

  async function loadClinic() {
    setLoading(true);
    setToast(null);

    try {
      const data = await requestJson("/api/admin/clinic-setup", {
        headers: getAuthHeaders(),
      });

      const c: ClinicSettings =
        (data.clinic && {
          clinic_name:
            data.clinic.clinic_name || data.clinic.clinicName || "",
          address: data.clinic.address || data.clinic.clinic_address || "",
          phone: data.clinic.phone || data.clinic.clinic_phone || "",
          email: data.clinic.email || data.clinic.clinic_email || "",
          timezone: data.clinic.timezone || "Asia/Kolkata",
          working_hours:
            data.clinic.working_hours ||
            data.clinic.workingHours ||
            data.clinic.working_hours_json ||
            data.clinic.workingHoursJson ||
            DEFAULT_WORKING_HOURS,
          treatment_types:
            data.clinic.treatment_types ||
            data.clinic.treatmentCatalog ||
            data.clinic.treatment_catalog ||
            [],
          note_templates:
            data.clinic.note_templates ||
            data.clinic.noteTemplates ||
            data.clinic.note_templates_json ||
            {},
          ai_prefs:
            data.clinic.ai_prefs ||
            data.clinic.aiPreferences ||
            data.clinic.ai_preferences_json ||
            {},
        }) || {
          clinic_name: "",
          address: "",
          phone: "",
          email: "",
          timezone: "Asia/Kolkata",
          working_hours: DEFAULT_WORKING_HOURS,
          treatment_types: [],
          note_templates: {},
          ai_prefs: {
            enable_smart_scheduling: true,
            enable_no_show_detection: true,
            enable_inventory_anomaly_flags: true,
            enable_revenue_forecast: true,
          },
        };

      setClinicName(c.clinic_name || "");
      setAddress(c.address || "");
      setPhone(c.phone || "");
      setEmail(c.email || "");
      setTimezone(c.timezone || "Asia/Kolkata");

      setWorkingHoursText(
        JSON.stringify(safeJsonParse(c.working_hours, DEFAULT_WORKING_HOURS), null, 2)
      );

      setNoteTemplatesText(
        JSON.stringify(
          safeJsonParse(c.note_templates, {
            follow_up: "Follow-up reminder: Please visit the clinic in {{days}} days.",
            no_show: "We missed you today. Reply to reschedule.",
            post_op: "Post-treatment care: {{instructions}}",
          }),
          null,
          2
        )
      );

      setAiPrefs(
        safeJsonParse(c.ai_prefs, {
          enable_smart_scheduling: true,
          enable_no_show_detection: true,
          enable_inventory_anomaly_flags: true,
          enable_revenue_forecast: true,
        })
      );

      const tts = Array.isArray(c.treatment_types) ? c.treatment_types : [];
      setTreatmentsText(tts.join("\n"));
    } catch (e: any) {
      showToast(e.message || "Failed to load clinic setup", 4500);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaff() {
    try {
      // NOTE: UI labels -> backend query roles
      const roleQueries = [
        { label: "Doctor", query: "DOCTOR" },
        { label: "Assistant", query: "ASSISTANT" },
        { label: "Admin", query: "ADMIN" },
      ];

      const results = await Promise.all(
        roleQueries.map((r) =>
          fetch(api(`/api/admin/users?role=${encodeURIComponent(r.query)}`), {
            headers: getAuthHeaders(),
          })
        )
      );

      const payloads = await Promise.all(
        results.map(async (res) => {
          if (!res.ok) return { users: [] as UserRow[] };
          try {
            const body = await readJsonOrText(res);
            if (typeof body === "object") {
              if (Array.isArray((body as any).items)) return { users: (body as any).items as UserRow[] };
              if (Array.isArray((body as any).users)) return { users: (body as any).users as UserRow[] };
            }
            return { users: [] as UserRow[] };
          } catch {
            return { users: [] as UserRow[] };
          }
        })
      );

      const all = ([] as UserRow[])
        .concat(payloads[2].users || []) // Admin
        .concat(payloads[0].users || []) // Doctor
        .concat(payloads[1].users || []) // Assistant
        .filter((u) => u && u.id);

      // Normalize fields and default active when not provided
      const normalized = all.map((u) => ({
        ...u,
        full_name: (u as any).fullName || u.full_name,
        is_active:
          typeof u.is_active === "number"
            ? u.is_active
            : typeof (u as any).isActive === "number"
            ? (u as any).isActive
            : 1, // default to active
      }));

      normalized.sort((a, b) => {
        const ra = (a.role || "").localeCompare(b.role || "");
        if (ra !== 0) return ra;
        return (a.full_name || (a as any).fullName || "").localeCompare(
          b.full_name || (b as any).fullName || ""
        );
      });

      setStaff(normalized);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadClinic().finally(loadStaff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveClinic() {
    setSaving(true);
    setToast(null);

    try {
      let working_hours: any;
      let note_templates: any;

      try {
        working_hours = JSON.parse(workingHoursText);
      } catch {
        throw new Error("Working Hours JSON is invalid.");
      }
      try {
        note_templates = JSON.parse(noteTemplatesText);
      } catch {
        throw new Error("Note Templates JSON is invalid.");
      }

      const payload = {
        clinicName,
        phone,
        email,
        address,
        timezone,
        workingHours: working_hours,
        treatmentCatalog: treatmentsList,
        noteTemplates: note_templates,
        aiPreferences: aiPrefs,
      };

      await requestJson("/api/admin/clinic-setup", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      showToast("Saved successfully.");
    } catch (e: any) {
      showToast(e.message || "Save failed", 4500);
    } finally {
      setSaving(false);
    }
  }

  async function createStaff() {
    setCreatingStaff(true);
    setToast(null);

    try {
      if (!staffName.trim()) throw new Error("Full name is required");
      if (!staffEmail.trim()) throw new Error("Email is required for staff accounts");

      // basic email sanity check (keeps UI the same)
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail.trim());
      if (!emailOk) throw new Error("Please enter a valid email address");

      // map UI roles -> backend-friendly (keeps your existing UI labels)
      const role =
        staffRole.toLowerCase() === "doctor"
          ? "DOCTOR"
          : staffRole.toLowerCase() === "admin"
          ? "ADMIN"
          : "ASSISTANT";

      const payload = {
        role,
        fullName: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim() ? staffPhone.trim() : null,
        tempPassword: staffPassword.trim() ? staffPassword.trim() : null,
        sendInviteEmail: !!sendInvite,
      };

      await requestJson("/api/admin/users", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      setStaffName("");
      setStaffEmail("");
      setStaffPhone("");
      setStaffPassword("");
      showToast("Staff account created.", 3500);

      await loadStaff();
    } catch (e: any) {
      showToast(e.message || "Failed to create staff", 4500);
    } finally {
      setCreatingStaff(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="surface rounded-2xl px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-title">Clinic configuration</p>
            <h1 className="text-2xl font-semibold text-ink">Clinic setup</h1>
            <p className="text-sm text-ink-muted mt-1">
              Configure clinic details, working hours, templates, and create staff accounts.
            </p>
          </div>
          <button
            onClick={saveClinic}
            disabled={saving || loading}
            className={`btn btn-primary text-xs ${saving || loading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {toast && (
        <div className="rounded-2xl border border-line bg-surface-muted text-ink px-4 py-3 text-sm">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-muted">Loading clinic settings...</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clinic Info */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold">Clinic Information</h2>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-muted">Clinic Name</label>
                <input
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g., SmileCare Dental Clinic"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Full clinic address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink-muted">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Clinic phone"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-muted">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Clinic email"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Timezone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Asia/Kolkata"
                />
              </div>
            </div>
          </div>

          {/* Staff */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold">Staff Accounts</h2>
            <p className="text-xs text-ink-muted mt-1">
              Admin should create Doctor/Assistant accounts here. Staff should not self-register.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-muted">Role</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="Doctor">Doctor</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Full Name</label>
                <input
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g., Dr. Asha Kumar"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Email</label>
                <input
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Staff login email"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Phone</label>
                <input
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Optional"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-ink-muted">
                  Temporary Password (optional)
                </label>
                <input
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Leave empty to auto-generate"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="sendInvite"
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                <label htmlFor="sendInvite" className="text-sm text-ink-muted">
                  Email an invite with the login password
                </label>
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={createStaff}
                  disabled={creatingStaff}
                  className={`w-full btn btn-primary text-xs ${
                    creatingStaff ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {creatingStaff ? "Creating..." : "Create Staff Account"}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Existing Staff</h3>
                <button onClick={loadStaff} className="text-xs text-brand hover:underline">
                  Refresh
                </button>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-muted text-ink-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Role</th>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr>
                        <td className="px-4 py-3 text-ink-muted" colSpan={4}>
                          No staff added yet.
                        </td>
                      </tr>
                    ) : (
                      staff.map((u) => (
                        <tr key={u.id} className="border-t border-line">
                          <td className="px-4 py-2">{u.role}</td>
                          <td className="px-4 py-2">{u.full_name || (u as any).fullName || "--"}</td>
                          <td className="px-4 py-2 text-ink-muted">{u.email || "--"}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                u.is_active ? "bg-green-50 text-green-700" : "bg-surface-muted text-ink-muted"
                              }`}
                            >
                              {u.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Treatments */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold">Treatment Types</h2>
            <p className="text-xs text-ink-muted mt-1">
              One per line (used in cases, procedures, and duration predictions).
            </p>
            <textarea
              value={treatmentsText}
              onChange={(e) => setTreatmentsText(e.target.value)}
              rows={10}
              className="mt-4 w-full rounded-lg border border-line px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="CONSULTATION\nCHECKUP\nSCALING\nFILLING\nROOT_CANAL\nIMPLANT"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {treatmentsList.slice(0, 18).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink"
                >
                  {t}
                </span>
              ))}
              {treatmentsList.length > 18 && (
                <span className="text-xs text-ink-muted">+{treatmentsList.length - 18} more...</span>
              )}
            </div>
          </div>

          {/* JSON Blocks */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold">Automation Preferences</h2>
            <p className="text-xs text-ink-muted mt-1">
              Toggle automation features and edit templates/hours as needed.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-ink-muted">AI Toggles</label>
                <div className="space-y-2 text-sm text-ink">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!aiPrefs.enable_smart_scheduling}
                      onChange={(e) =>
                        setAiPrefs((prev) => ({ ...prev, enable_smart_scheduling: e.target.checked }))
                      }
                    />
                    <span>Smart scheduling</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!aiPrefs.enable_no_show_detection}
                      onChange={(e) =>
                        setAiPrefs((prev) => ({ ...prev, enable_no_show_detection: e.target.checked }))
                      }
                    />
                    <span>No-show detection</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!aiPrefs.enable_inventory_anomaly_flags}
                      onChange={(e) =>
                        setAiPrefs((prev) => ({ ...prev, enable_inventory_anomaly_flags: e.target.checked }))
                      }
                    />
                    <span>Inventory anomaly flags</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!aiPrefs.enable_revenue_forecast}
                      onChange={(e) =>
                        setAiPrefs((prev) => ({ ...prev, enable_revenue_forecast: e.target.checked }))
                      }
                    />
                    <span>Revenue forecasting</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-muted">Working Hours JSON</label>
                <textarea
                  value={workingHoursText}
                  onChange={(e) => setWorkingHoursText(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">Note Templates JSON</label>
                <textarea
                  value={noteTemplatesText}
                  onChange={(e) => setNoteTemplatesText(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// NOTE: supports BOTH import styles:
// import AdminClinicSetup from "..."
// import { AdminClinicSetup } from "..."
export default AdminClinicSetup;


