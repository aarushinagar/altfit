/**
 * Wardrobe actions — direct API calls
 */

import { getAuthToken } from "@/lib/utils/authUtils";
import type { WardrobeItemResponse } from "@/types/api";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

let isRefreshingToken = false;

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
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

    if (res.status === 401 && !isRefreshingToken) {
      isRefreshingToken = true;
      try {
        const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.data?.accessToken) {
            localStorage.setItem("accessToken", refreshData.data.accessToken);
            if (refreshData.data?.user)
              localStorage.setItem(
                "user",
                JSON.stringify(refreshData.data.user),
              );
            isRefreshingToken = false;
            return apiRequest<T>(url, options);
          }
        }
      } catch {
        /* fall through */
      }
      isRefreshingToken = false;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("auth:logout"));
      return {
        success: false,
        error: "Session expired. Please log in again.",
      };
    }

    if (!res.ok) {
      const msg =
        (data.error as string) ||
        (data.message as string) ||
        `HTTP ${res.status}`;
      return { success: false, error: msg };
    }
    return data as unknown as ApiResult<T>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export interface WardrobeCreatePayload {
  name: string;
  category: string;
  imageUrl: string;
  storagePath: string;
  colors?: string[];
  colorNames?: string[];
  pattern?: string | null;
  fabric?: string | null;
  fit?: string | null;
  formality?: number;
  season?: string[];
  occasion?: string[];
  stylistNote?: string | null;
  tags?: string[];
}

export async function getWardrobeItems(
  category?: string,
  limit = 50,
  offset = 0,
): Promise<ApiResult<{ items: WardrobeItemResponse[]; total: number }>> {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  params.append("limit", String(limit));
  params.append("offset", String(offset));
  return apiRequest(`/api/wardrobe?${params.toString()}`);
}

export async function getWardrobeItem(
  id: string,
): Promise<ApiResult<WardrobeItemResponse>> {
  return apiRequest(`/api/wardrobe/${id}`);
}

export async function createWardrobeItem(
  payload: WardrobeCreatePayload,
): Promise<ApiResult<WardrobeItemResponse>> {
  return apiRequest("/api/wardrobe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Upload a raw image file to POST /api/wardrobe.
 * The server handles Sharp processing, Supabase upload, Gemini vision analysis,
 * and DB persistence — all in one request.
 */
export async function createWardrobeItemFromFile(
  file: File,
  name?: string,
): Promise<ApiResult<WardrobeItemResponse>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append("image", file);
  formData.append(
    "name",
    name ||
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "Clothing Item",
  );

  try {
    const res = await fetch(`${BASE}/api/wardrobe`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });

    let data: Record<string, unknown> = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: `Invalid server response (${res.status})` };
    }

    if (res.status === 401 && !isRefreshingToken) {
      isRefreshingToken = true;
      try {
        const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.data?.accessToken) {
            localStorage.setItem("accessToken", refreshData.data.accessToken);
            isRefreshingToken = false;
            return createWardrobeItemFromFile(file, name);
          }
        }
      } catch {
        /* fall through */
      }
      isRefreshingToken = false;
      return { success: false, error: "Session expired. Please log in again." };
    }

    if (!res.ok) {
      const msg =
        (data.error as string) ||
        (data.message as string) ||
        `HTTP ${res.status}`;
      return { success: false, error: msg };
    }
    return data as unknown as ApiResult<WardrobeItemResponse>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function updateWardrobeItem(
  id: string,
  updates: Partial<WardrobeCreatePayload>,
): Promise<ApiResult<WardrobeItemResponse>> {
  return apiRequest(`/api/wardrobe/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteWardrobeItem(
  id: string,
): Promise<ApiResult<{ message: string }>> {
  return apiRequest(`/api/wardrobe/${id}`, { method: "DELETE" });
}

export async function bulkCreateWardrobeItems(
  items: WardrobeCreatePayload[],
): Promise<ApiResult<{ items: WardrobeItemResponse[]; count: number }>> {
  return apiRequest("/api/wardrobe/bulk", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function recordWear(
  id: string,
): Promise<ApiResult<WardrobeItemResponse>> {
  return apiRequest(`/api/wardrobe/${id}/wear`, { method: "POST" });
}
