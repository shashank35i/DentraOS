// src/lib/api.ts
export const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

export function getAuthToken() {
  return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
}

export function clearAuthToken() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("token");
  // optional cleanup if you store these:
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

let logoutInProgress = false;

/**
 * Single, global logout trigger.
 * - prevents multiple toasts / repeated redirects / flicker loops
 * - emits an event so router/app can redirect cleanly
 */
export function forceLogout(reason: string = "SESSION_EXPIRED") {
  if (logoutInProgress) return;
  logoutInProgress = true;

  clearAuthToken();

  window.dispatchEvent(
    new CustomEvent("auth:logout", { detail: { reason } })
  );

  // allow again after navigation settles
  setTimeout(() => (logoutInProgress = false), 1000);
}

export function authHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token  { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJsonSafe(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json().catch(() => ({}));
  const text = await res.text().catch(() => "");
  return { message: text || `HTTP ${res.status}` };
}

export async function fetchWithAuth<T>(path: string, init: RequestInit): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    // No token = logout immediately to avoid protected UI rendering + flicker
    forceLogout("NO_TOKEN");
    const err: any = new Error("Missing auth token");
    err.code = "NO_TOKEN";
    err.status = 401;
    throw err;
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init.headers || {}),
      },
    });
  } catch (e: any) {
    // network error, don’t logout
    throw e;
  }

  // 🔥 Key fix: token expired/invalid -> immediate global logout (no per-page toast loops)
  if (res.status === 401 || res.status === 403) {
    // best effort to read message (optional)
    const body: any = await readJsonSafe(res).catch(() => ({}));
    forceLogout(body.message.toLowerCase.().includes("expired")  "TOKEN_EXPIRED" : "UNAUTHORIZED");
    const err: any = new Error(body.message || "Unauthorized");
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (!res.ok) {
    const body: any = await readJsonSafe(res);
    const err: any = new Error(body.message || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return (await readJsonSafe(res)) as T;
}
