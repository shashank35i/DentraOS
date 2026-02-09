import React, { useEffect, useState } from "react";
import { Link, useNavigate, NavigateFunction } from "react-router-dom";
import {
  ArrowLeftIcon,
  CalendarIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";

type UserType = "Patient" | "Doctor" | "Admin";
type Role = "ADMIN" | "DOCTOR" | "PATIENT";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const REGISTER_URL = `${API_BASE}/api/auth/register`;
const LOGIN_URL = `${API_BASE}/api/auth/login`;
const EMAIL_OTP_REQUEST_URL = `${API_BASE}/api/auth/email-otp/request`;
const EMAIL_OTP_VERIFY_URL = `${API_BASE}/api/auth/email-otp/verify`;

function normalizeRoleString(value: unknown): Role | null {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (upper === "ADMIN" || upper === "DOCTOR" || upper === "PATIENT") {
    return upper as Role;
  }
  return null;
}

function normalizeRoleFromUserType(userType: UserType): Role {
  switch (userType) {
    case "Admin":
      return "ADMIN";
    case "Doctor":
      return "DOCTOR";
    default:
      return "PATIENT";
  }
}

function redirectAfterAuth(role: Role, navigate: NavigateFunction) {
  if (role === "ADMIN") navigate("/admin/overview", { replace: true });
  else if (role === "DOCTOR") navigate("/doctor/overview", { replace: true });
  else navigate("/patient/overview", { replace: true });
}

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export const CreateAccount: React.FC = () => {
  const navigate = useNavigate();

  const [userType, setUserType] = useState<UserType>("Patient");
  const [isStaff, setIsStaff] = useState(false);

  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [generatedId, setGeneratedId] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);
  const [emailOtpStatus, setEmailOtpStatus] = useState<string | null>(null);
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedRole = normalizeRoleString(localStorage.getItem("userRole"));
    if (token && storedRole) redirectAfterAuth(storedRole, navigate);
  }, [navigate]);

  useEffect(() => {
    if (!isStaff && userType !== "Patient") setUserType("Patient");
  }, [isStaff, userType]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "email") {
      setEmailOtpCode("");
      setEmailOtpSent(false);
      setEmailOtpVerified(false);
      setEmailOtpStatus(null);
      setEmailOtpError(null);
    }
  };

  const handleSendEmailOtp = async () => {
    setEmailOtpError(null);
    setEmailOtpStatus(null);

    const email = formData.email.trim();
    if (!email) {
      setEmailOtpError("Please enter your email first.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailOtpError("Please enter a valid email address.");
      return;
    }

    try {
      setEmailOtpLoading(true);
      const res = await fetch(EMAIL_OTP_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailOtpError(data.message || "Failed to send verification code.");
        return;
      }

      setEmailOtpSent(true);
      setEmailOtpVerified(false);
      setEmailOtpStatus("Verification code sent to your email.");
    } catch (err) {
      console.error("EMAIL OTP REQUEST ERROR:", err);
      setEmailOtpError("Unable to send verification code. Please try again.");
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setEmailOtpError(null);
    setEmailOtpStatus(null);

    const email = formData.email.trim();
    if (!email) {
      setEmailOtpError("Please enter your email first.");
      return;
    }
    if (!emailOtpCode.trim()) {
      setEmailOtpError("Please enter the verification code.");
      return;
    }

    try {
      setEmailOtpLoading(true);
      const res = await fetch(EMAIL_OTP_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: emailOtpCode.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        setEmailOtpError(data.message || "Invalid or expired code.");
        setEmailOtpVerified(false);
        return;
      }

      setEmailOtpVerified(true);
      setEmailOtpStatus("Email verified successfully.");
    } catch (err) {
      console.error("EMAIL OTP VERIFY ERROR:", err);
      setEmailOtpError("Unable to verify code. Please try again.");
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const email = formData.email.trim();

    if (!formData.fullName || !email || !formData.password) {
      setError("Please fill in all required fields marked with *.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!emailOtpVerified) {
      setError("Please verify your email before creating your account.");
      return;
    }

    try {
      setLoading(true);

      let roleUpper: Role = normalizeRoleFromUserType(userType);
      if (!isStaff) roleUpper = "PATIENT";

      const res = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleUpper,
          userType,
          fullName: formData.fullName,
          email,
          phone: formData.phone || null,
          dob: formData.dob || null,
          gender: formData.gender || null,
          address: formData.address || null,
          password: formData.password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Failed to create account.");
        return;
      }

      setGeneratedId(data.uid || "");

      const apiRole = normalizeRoleString(data.role);
      const normalizedRole: Role = apiRole - roleUpper;

      if (data.token) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userRole", normalizedRole);
        localStorage.setItem("userId", data.uid || "");
        localStorage.setItem("userName", data.name || formData.fullName);

        redirectAfterAuth(normalizedRole, navigate);
        return;
      }

      try {
        const loginRes = await fetch(LOGIN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: formData.password,
            role: normalizedRole,
            userType,
          }),
        });

        const loginData = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok) {
          setError(
            loginData.message ||
              "Account created, but automatic login failed. Please sign in manually."
          );
          setStep("success");
          return;
        }

        const finalRole = normalizeRoleString(loginData.role) - normalizedRole;

        localStorage.setItem("authToken", loginData.token);
        localStorage.setItem("userRole", finalRole);
        localStorage.setItem("userId", loginData.uid || data.uid || "");
        localStorage.setItem("userName", loginData.name || formData.fullName);

        redirectAfterAuth(finalRole, navigate);
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setError(
          "Your account was created, but automatic login failed. Please sign in manually."
        );
        setStep("success");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to reach server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="app-shell min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeftIcon size={16} />
            Back to login
          </Link>

          <div className="surface rounded-3xl p-7 mt-6">
            <h2 className="text-2xl font-semibold text-ink">Account created</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Your {userType.toLowerCase()} access is ready.
            </p>

            {generatedId && (
              <div className="mt-5 rounded-2xl border border-line bg-surface-muted px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">ID</div>
                <div className="mt-1 font-mono text-base font-semibold text-ink">{generatedId}</div>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-[color:var(--danger)]">{error}</p>
            )}

            <button onClick={() => navigate("/login")} className="btn btn-primary w-full mt-6">
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeftIcon size={16} />
            Back to login
          </Link>
          <div className="text-xs text-ink-muted">Create account</div>
        </div>

        <div className="mt-8 surface rounded-3xl p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Registration</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">Create your account</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Role-based access with secure email verification.
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl border border-line bg-surface-muted grid place-items-center text-ink font-semibold">
              DC
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-[12px] font-semibold text-ink">Account Type</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="isStaff"
                type="checkbox"
                checked={isStaff}
                onChange={(e) => setIsStaff(e.target.checked)}
                className="h-4 w-4 rounded border-line text-[color:var(--brand)]"
              />
              <label htmlFor="isStaff" className="text-sm text-ink">
                I am clinic staff (Doctor/Admin)
              </label>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["Patient", ...(isStaff ? ["Doctor", "Admin"] : [])] as UserType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setUserType(type)}
                    className={[
                      "p-3 rounded-2xl border text-sm font-semibold transition-all",
                      userType === type
                        ? "border-[color:var(--brand)]/60 bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
                        : "border-line bg-surface-muted text-ink-muted hover:bg-surface",
                    ].join(" ")}
                  >
                    {type}
                  </button>
                )
              )}
            </div>

            {!isStaff && (
              <p className="mt-2 text-xs text-ink-muted">
                Staff accounts are usually created by the clinic admin during Clinic Setup.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-xs text-[color:var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="fullName" className="label">Full name *</label>
              <div className="mt-1.5 relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                  <UserIcon size={16} />
                </span>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Your name"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">Email *</label>
              <div className="mt-1.5 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <MailIcon size={16} />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="input pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={emailOtpLoading || !formData.email.trim() || emailOtpVerified}
                  className="btn btn-primary whitespace-nowrap"
                >
                  {emailOtpVerified ? "Verified" : emailOtpLoading ? "Sending..." : "Send OTP"}
                </button>
              </div>
              {emailOtpStatus && (
                <p className="mt-1 text-[11px] text-[color:var(--success)]">{emailOtpStatus}</p>
              )}
              {emailOtpError && (
                <p className="mt-1 text-[11px] text-[color:var(--danger)]">{emailOtpError}</p>
              )}
            </div>

            {emailOtpSent && !emailOtpVerified && (
              <div>
                <label htmlFor="emailOtp" className="label">Email verification code</label>
                <div className="mt-1.5 flex flex-col sm:flex-row gap-2">
                  <input
                    id="emailOtp"
                    name="emailOtp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value)}
                    className="input"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={emailOtpLoading || !emailOtpCode.trim()}
                  className="btn btn-secondary whitespace-nowrap"
                >
                  {emailOtpLoading ? "Verifying..." : "Verify code"}
                </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="phone" className="label">Phone</label>
              <div className="mt-1.5 relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                  <PhoneIcon size={16} />
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dob" className="label">Date of birth</label>
                <div className="mt-1.5 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <CalendarIcon size={16} />
                  </span>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    value={formData.dob}
                    onChange={handleChange}
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gender" className="label">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="address" className="label">Address</label>
              <div className="mt-1.5 relative">
                <span className="absolute top-3.5 left-3 text-ink-muted">
                  <MapPinIcon size={16} />
                </span>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  placeholder="Clinic or home address"
                  value={formData.address}
                  onChange={handleChange}
                  className="input pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="password" className="label">Password *</label>
                <div className="mt-1.5 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <LockIcon size={16} />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm *</label>
                <div className="mt-1.5 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                    <LockIcon size={16} />
                  </span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input pl-9"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !emailOtpVerified}
              className="btn btn-primary w-full"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-[12px] text-ink-muted">
            <span>Already have an account</span>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-semibold text-ink hover:opacity-80"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAccount;
