import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOutIcon, UserIcon, MailIcon, ShieldIcon } from "lucide-react";
import { clearAuth } from "../components/ProtectedRoute";

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(
    localStorage.getItem("userName") || "User"
  );
  const [userRole, setUserRole] = useState(
    (localStorage.getItem("userRole") || "Member")
      .toLowerCase()
      .replace(/^./, (s) => s.toUpperCase())
  );
  const [userEmail, setUserEmail] = useState(
    localStorage.getItem("userEmail") || ""
  );

  useEffect(() => {
    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token");

    if (!token) return;

    const API_BASE =
      (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

    fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.user) return;
        const name = data.user.name || userName;
        const email = data.user.email || userEmail;
        const roleRaw = data.user.role || userRole;
        const role = String(roleRaw)
          .toLowerCase()
          .replace(/^./, (s) => s.toUpperCase());

        setUserName(name);
        setUserEmail(email);
        setUserRole(role);

        if (name) localStorage.setItem("userName", name);
        if (email) localStorage.setItem("userEmail", email);
        if (data.user.role) localStorage.setItem("userRole", data.user.role);
      })
      .catch(() => {
        // ignore
      });
  }, []);

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
            <p className="text-sm text-ink-muted">
              {userEmail || "Not available"}
            </p>
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
