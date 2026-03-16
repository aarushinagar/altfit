/**
 * Upload action — direct API call
 */

import { getAuthToken } from "@/lib/utils/authUtils";
import type { UploadResponse } from "@/types/api";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

export async function uploadImage(
  file: File,
): Promise<ApiResult<UploadResponse>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${BASE}/api/upload/image`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, error: data.error || `HTTP ${res.status}` };
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function classifyClothing(
  base64: string,
  mediaType: string,
): Promise<ApiResult<import("@/types/api").ClothingClassificationItem[]>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE}/api/classify-clothing`, {
      method: "POST",
      headers,
      body: JSON.stringify({ base64, mediaType }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, error: data.error || `HTTP ${res.status}` };
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Classification failed",
    };
  }
}
