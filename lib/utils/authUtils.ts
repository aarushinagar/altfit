/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auth utilities — browser-side
 */

export interface AuthState {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    provider: string;
    onboarded: boolean;
  };
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function setAuthState(authState: AuthState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("accessToken", authState.accessToken);
  localStorage.setItem("user", JSON.stringify(authState.user));
}

export function clearAuthState(): void {
  if (typeof window === "undefined") return;
  localStorage.clear();
  sessionStorage.clear();
  // Expire all document.cookie entries (path=/ covers all routes)
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

export function getStoredUser(): AuthState["user"] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * Returns a fresh access token, proactively refreshing via /api/auth/refresh
 * if the stored token is expired or within 90 seconds of expiry.
 *
 * Safe to call from any hook or action — never throws.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;

  const payload = decodeJwt(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  // Refresh if expired OR within 90 s of expiry (was 60 s — wider window prevents race)
  const isStale = exp * 1000 < Date.now() + 90_000;
  if (!isStale) return token;

  try {
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (r.ok) {
      const data = await r.json();
      if (data?.data?.accessToken) {
        localStorage.setItem("accessToken", data.data.accessToken);
        if (data.data?.user)
          localStorage.setItem("user", JSON.stringify(data.data.user));
        return data.data.accessToken as string;
      }
    }
  } catch {
    /* fall through — return stale token, let the API 401 handler retry */
  }
  return token;
}

export function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const existing = document.getElementById("gis-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export const GOOGLE_CLIENT_ID =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    : "YOUR_GOOGLE_CLIENT_ID_HERE";
