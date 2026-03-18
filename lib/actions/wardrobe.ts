/**
 * Wardrobe actions — direct API calls
 */

import { getAuthToken, decodeJwt } from "@/lib/utils/authUtils";
import type { WardrobeItemResponse } from "@/types/api";

// ── Types ─────────────────────────────────────────────────────────────────

export interface DetectedPiece {
  id: string;
  category: string;
  subcategory: string;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
}

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
  limit = 100,
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
/** Refresh the access token if it is expired or within 60 s of expiry. */
async function ensureFreshToken(): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;

  const payload = decodeJwt(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  const isStale = exp * 1000 < Date.now() + 60_000;

  if (!isStale) return token;

  try {
    const BASE = process.env.NEXT_PUBLIC_APP_URL || "";
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
    /* fall through — return stale token, let the 401 handler retry */
  }
  return token;
}

export async function createWardrobeItemFromFile(
  file: File,
  name?: string,
): Promise<
  ApiResult<{ items: WardrobeItemResponse[]; saved: number; failed: number }>
> {
  const token = await ensureFreshToken();
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
      signal: AbortSignal.timeout(65000), // 65 seconds to account for 16s API + overhead
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

    // API returns { success: true, items: [...], saved: N, failed: M }
    const apiResult = data as {
      success: boolean;
      items?: WardrobeItemResponse[];
      saved?: number;
      failed?: number;
    };

    if (!apiResult.success || !apiResult.items?.length) {
      return {
        success: false,
        error: apiResult.items?.length
          ? "No items saved from upload"
          : "Upload failed to return items",
      };
    }

    return {
      success: true,
      data: {
        items: apiResult.items,
        saved: apiResult.saved ?? 0,
        failed: apiResult.failed ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error:
          "Upload took too long and timed out. Please try again with a smaller image.",
      };
    }
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

// ── Crop upload helpers ────────────────────────────────────────────────────

/**
 * Upload a pre-cropped image File to Supabase via the upload API.
 * Returns the new public URL + storage path, or null if the upload fails.
 */
export async function uploadCroppedImage(
  croppedFile: File,
): Promise<{ url: string; path: string } | null> {
  const token = await ensureFreshToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append("file", croppedFile);

  try {
    const res = await fetch(`${BASE}/api/upload/image`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.data?.url) {
      return { url: data.data.url as string, path: data.data.path as string };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Replace the image URL (and storage path) on an existing wardrobe item.
 * Used after a client-side canvas crop has been uploaded to Supabase.
 */
export async function updateWardrobeItemImage(
  id: string,
  imageUrl: string,
  storagePath: string,
): Promise<boolean> {
  const result = await apiRequest(`/api/wardrobe/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ imageUrl, storagePath }),
  });
  return result.success;
}
