import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, NavigateFunction } from "react-router-dom";
import {
  Mail as MailIcon,
  ArrowLeft as ArrowLeftIcon,
  Lock as LockIcon,
  User as UserIcon,
} from "lucide-react";

type Role = "ADMIN" | "DOCTOR" | "PATIENT";

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  PATIENT: "Patient",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const LOGIN_URL = `${API_BASE}/api/auth/login`;

function normalizeRoleString(value: unknown): Role | null {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (upper === "ADMIN" || upper === "DOCTOR" || upper === "PATIENT") return upper as Role;
  return null;
}

function roleToUserType(role: Role): "Admin" | "Doctor" | "Patient" {
  if (role === "ADMIN") return "Admin";
  if (role === "DOCTOR") return "Doctor";
  return "Patient";
}

function redirectAfterAuth(role: Role, navigate: NavigateFunction) {
  if (role === "ADMIN") navigate("/admin/overview", { replace: true });
  else if (role === "DOCTOR") navigate("/doctor/overview", { replace: true });
  else navigate("/patient/overview", { replace: true });
}

export const Login: React.FC = () => {
  const [role, setRole] = useState<Role>("DOCTOR");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedRole = normalizeRoleString(localStorage.getItem("userRole"));
    if (token && storedRole) redirectAfterAuth(storedRole, navigate);
  }, [navigate]);

  const roleAccent = useMemo(() => {
    switch (role) {
      case "ADMIN":
        return {
          tabActive: "bg-[color:var(--brand)] text-white",
          icon: "text-[color:var(--brand)]",
        };
      case "PATIENT":
        return {
          tabActive: "bg-[color:var(--brand)] text-white",
          icon: "text-[color:var(--brand)]",
        };
      default:
        return {
          tabActive: "bg-[color:var(--brand)] text-white",
          icon: "text-[color:var(--brand)]",
        };
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          userType: roleToUserType(role),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed. Please check your credentials.");
        return;
      }

      const normalizedRole = normalizeRoleString(data.role) || role;

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userRole", normalizedRole);
      localStorage.setItem("userId", data.uid || "");
      localStorage.setItem("userName", data.name || "");

      redirectAfterAuth(normalizedRole, navigate);
    } catch (err) {
      console.error(err);
      setError("Cannot reach server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between">
          <Link
            to="/landing"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeftIcon size={16} />
            Back
          </Link>
          <div className="text-xs text-ink-muted">Secure access</div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-[1.1fr,1fr] gap-10 items-start">
          <div className="hidden md:flex flex-col space-y-6">
            <div>
              <p className="section-title">Welcome back</p>
              <h1 className="mt-2 text-4xl font-semibold text-ink">
                Dental Clinic Intelligence
              </h1>
              <p className="mt-3 text-sm text-ink-muted max-w-xl leading-relaxed">
                Sign in with the correct role. Your workspace is tailored automatically with
                clean dashboards and agent-led insights.
              </p>
            </div>
          </div>

          <div className="surface rounded-[28px] p-7 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl border border-line bg-surface-muted grid place-items-center font-semibold text-ink">
                  DC
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Login</p>
                  <p className="text-[11px] text-ink-muted">Access your workspace</p>
                </div>
              </div>
              <UserIcon size={20} className={roleAccent.icon} />
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-surface-muted p-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                {(["ADMIN", "DOCTOR", "PATIENT"] as Role[]).map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={[
                        "rounded-xl py-2.5 text-[12px] font-semibold transition",
                        active
                          ? roleAccent.tabActive
                          : "text-ink-muted hover:bg-surface",
                      ].join(" ")}
                    >
                      {roleLabel[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-3 py-2 text-[12px] text-[color:var(--danger)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-ink" htmlFor="email">
                  Email
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <MailIcon size={16} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink" htmlFor="password">
                  Password
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <LockIcon size={16} />
                  </span>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9"
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[11px] font-medium text-ink-muted hover:text-ink"
                  >
                    Forgot password
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? "Signing in..." : `Login as ${roleLabel[role]}`}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-line text-[12px] text-ink-muted">
              Need access? Contact your clinic administrator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
