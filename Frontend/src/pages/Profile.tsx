import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOutIcon, UserIcon, MailIcon, ShieldIcon } from "lucide-react";
import { clearAuth } from "../components/ProtectedRoute";

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "User";
  const userRole = (localStorage.getItem("userRole") || "Member")
    .toLowerCase()
    .replace(/^./, (s) => s.toUpperCase());
  const userEmail = localStorage.getItem("userEmail") || "user@example.com";

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="surface rounded-2xl px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-surface-muted border border-line grid place-items-center">
            <UserIcon size={22} className="text-brand" />
          </div>
          <div>
            <p className="text-xs text-ink-muted">Profile</p>
            <h1 className="text-2xl font-semibold text-ink">{userName}</h1>
            <p className="text-sm text-ink-muted">{userRole}</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-6 py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-surface-muted border border-line grid place-items-center">
            <MailIcon size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Contact</p>
            <p className="text-sm text-ink-muted">{userEmail}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-surface-muted border border-line grid place-items-center">
            <ShieldIcon size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Access</p>
            <p className="text-sm text-ink-muted">
              Role-based access and secure sessions are enabled for your account.
            </p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Sign out</p>
          <p className="text-xs text-ink-muted">
            End your session on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-secondary inline-flex items-center gap-2"
        >
          <LogOutIcon size={16} />
          Logout
        </button>
      </section>
    </div>
  );
};
