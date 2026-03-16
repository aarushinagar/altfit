/**
 * Auth actions — direct API calls without the apiClient wrapper
 * These are plain async functions callable from any client component.
 */

import {
  setAuthState,
  clearAuthState,
  getAuthToken,
} from "@/lib/utils/authUtils";
import type { AuthPayload } from "@/types/api";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

async function post<T>(endpoint: string, body: unknown): Promise<ApiResult<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, error: data.error || `HTTP ${res.status}` };
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<ApiResult<AuthPayload>> {
  const result = await post<AuthPayload>("/api/auth/register", {
    email,
    password,
    name,
  });
  if (result.success && result.data)
    setAuthState({
      accessToken: result.data.accessToken,
      user: result.data.user,
    });
  return result;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<ApiResult<AuthPayload>> {
  const result = await post<AuthPayload>("/api/auth/login", {
    email,
    password,
  });
  if (result.success && result.data)
    setAuthState({
      accessToken: result.data.accessToken,
      user: result.data.user,
    });
  return result;
}

export async function googleAuthUser(
  credential: string,
): Promise<ApiResult<AuthPayload>> {
  const result = await post<AuthPayload>("/api/auth/google", { credential });
  if (result.success && result.data)
    setAuthState({
      accessToken: result.data.accessToken,
      user: result.data.user,
    });
  return result;
}

export async function logoutUser(): Promise<void> {
  try {
    await post("/api/auth/logout", {});
  } finally {
    clearAuthState();
  }
}
