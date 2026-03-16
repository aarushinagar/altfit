/**
 * User actions — direct API calls
 */

import { getAuthToken } from "@/lib/utils/authUtils";
import type { UserProfileResponse } from "@/types/api";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

async function authedPost<T>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE}${url}`, {
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

export async function completeOnboarding(
  styleProfiles: string[],
  styleIssues: string[] = [],
): Promise<ApiResult<UserProfileResponse>> {
  return authedPost("/api/user/onboarding", { styleProfiles, styleIssues });
}
