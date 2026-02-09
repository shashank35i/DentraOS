import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, LockIcon, CheckCircleIcon } from "lucide-react";

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please enter both password fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-md mx-auto px-4 py-12">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
          Back to login
        </Link>

        <div className="surface rounded-3xl p-7 mt-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl border border-line bg-surface-muted flex items-center justify-center font-semibold text-ink mx-auto mb-3">
              DC
            </div>
            <h1 className="text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="text-sm text-ink-muted mt-2">
              Create a new password for your account.
            </p>
          </div>

          {!submitted ? (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[12px] text-[color:var(--danger)]">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <LockIcon size={18} />
                    </span>
                    <input
                      id="password"
                      type="password"
                      className="input pl-10"
                      placeholder="Enter a new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Password must be at least 8 characters.
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="label">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">
                      <LockIcon size={18} />
                    </span>
                    <input
                      id="confirmPassword"
                      type="password"
                      className="input pl-10"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full">
                  Reset Password
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon size={32} className="text-[color:var(--success)]" />
              </div>
              <h2 className="text-xl font-semibold text-ink mb-2">
                Password reset successfully
              </h2>
              <p className="text-sm text-ink-muted mb-6">
                You can now use your new password to log in.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="btn btn-primary w-full"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
