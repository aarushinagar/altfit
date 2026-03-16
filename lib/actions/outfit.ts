/**
 * Outfit actions — direct API calls
 */

import type { OutfitResponse } from "@/types/api";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE}${url}`, {
      ...options,
      headers,
      credentials: "include",
    });
    let data: Record<string, unknown> = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: `Invalid server response (${res.status})` };
    }
    if (!res.ok)
      return {
        success: false,
        error: (data.error as string) || `HTTP ${res.status}`,
      };
    return data as unknown as ApiResult<T>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function generateOutfit(options?: {
  occasion?: string;
  season?: string;
  mood?: string;
}): Promise<ApiResult<OutfitResponse>> {
  return apiRequest("/api/outfits", {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export async function createOutfit(payload: {
  wardrobeItemIds: string[];
  occasion?: string;
  reasoning?: string;
  colorStory?: string;
}): Promise<ApiResult<OutfitResponse>> {
  return apiRequest("/api/outfits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markOutfitWorn(
  id: string,
  worn = true,
): Promise<ApiResult<OutfitResponse>> {
  return apiRequest(`/api/outfits/${id}/worn`, {
    method: "PATCH",
    body: JSON.stringify({ worn, wornAt: new Date().toISOString() }),
  });
}
