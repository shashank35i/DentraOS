import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft as ArrowLeftIcon,
  Mail as MailIcon,
  CheckCircle as CheckCircleIcon,
  Key as KeyIcon,
  Lock as LockIcon,
} from "lucide-react";

type Step = "email" | "otp" | "reset" | "success";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const FORGOT_URL = `${API_BASE}/api/auth/forgot-password`;
const VERIFY_OTP_URL = `${API_BASE}/api/auth/verify-otp`;
const RESET_URL = `${API_BASE}/api/auth/reset-password`;

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(FORGOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to send verification code.");
        return;
      }

      setStep("otp");
    } catch (err) {
      console.error(err);
      setError("Unable to reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid or expired code.");
        return;
      }

      setStep("reset");
    } catch (err) {
      console.error(err);
      setError("Unable to reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(RESET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to reset password.");
        return;
      }

      setStep("success");
    } catch (err) {
      console.error(err);
      setError("Unable to reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const heading = useMemo(() => {
    if (step === "email") return "Reset your password";
    if (step === "otp") return "Check your email";
    if (step === "reset") return "Set a new password";
    return "Password updated";
  }, [step]);

  const subheading = useMemo(() => {
    if (step === "email")
      return "Enter the email linked to your account. We'll send a verification code.";
    if (step === "otp")
      return `We sent a 6-digit code to ${email || "your email"}. Enter it below to continue.`;
    if (step === "reset") return "Choose a strong password you do not use elsewhere.";
    return "You can now sign in using your new password.";
  }, [step, email]);

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeftIcon size={16} />
            Back
          </button>
          <div className="text-xs text-ink-muted">Password recovery</div>
        </div>

        <div className="mt-8 surface rounded-3xl p-7">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-2xl grid place-items-center border border-line bg-surface-muted">
              {step === "email" && <MailIcon size={18} className="text-ink" />}
              {step === "otp" && <KeyIcon size={18} className="text-ink" />}
              {step === "reset" && <LockIcon size={18} className="text-ink" />}
              {step === "success" && (
                <CheckCircleIcon size={18} className="text-[color:var(--success)]" />
              )}
            </div>
            <div className="pt-0.5">
              <h1 className="text-2xl font-semibold text-ink">{heading}</h1>
              <p className="mt-2 text-sm text-ink-muted">{subheading}</p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-3 py-2 text-[12px] text-[color:var(--danger)]">
              {error}
            </div>
          )}

          <div className="mt-6">
            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <MailIcon size={16} />
                    </span>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@clinic.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "Sending..." : "Send code"}
                </button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="label">Verification code</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <KeyIcon size={16} />
                    </span>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="input pl-9"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "Verifying..." : "Continue"}
                </button>
                <div className="flex items-center justify-between text-[12px] text-ink-muted">
                  <button type="button" onClick={() => setStep("email")} className="hover:text-ink">
                    Use different email
                  </button>
                  <button type="button" onClick={() => handleEmailSubmit()} className="hover:text-ink">
                    Resend
                  </button>
                </div>
              </form>
            )}

            {step === "reset" && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="label">New password</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <LockIcon size={16} />
                    </span>
                    <input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="label">Confirm password</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <LockIcon size={16} />
                    </span>
                    <input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            )}

            {step === "success" && (
              <div className="text-center py-4">
                <div className="mx-auto h-12 w-12 rounded-2xl grid place-items-center border border-[color:var(--success)]/30 bg-[color:var(--success)]/10">
                  <CheckCircleIcon size={22} className="text-[color:var(--success)]" />
                </div>
                <div className="mt-4 text-sm text-ink">Your password has been updated.</div>
                <div className="mt-1 text-[12px] text-ink-muted">You can now sign in.</div>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="btn btn-primary w-full mt-6"
                >
                  Return to login
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-[12px] text-ink-muted">
          <Link to="/login" className="hover:text-ink">Login</Link>
          <span className="h-1 w-1 rounded-full bg-[color:var(--line)]" />
          <Link to="/create-account" className="hover:text-ink">Create account</Link>
        </div>
      </div>
    </div>
  );
};
