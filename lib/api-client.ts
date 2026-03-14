/**
 * Frontend API Client
 * Handles all communication with backend API endpoints
 * Manages JWT tokens, cookie handling, and request/response formatting
 */

import {
  AuthPayload,
  WardrobeItemResponse,
  OutfitResponse,
  UploadResponse,
  ClothingClassificationItem,
  GeneratedOutfitResponse,
  UserProfileResponse,
  SubscriptionResponse,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Module-level flag to prevent concurrent refresh attempts
let isRefreshingToken = false;

/**
 * API Response wrapper type
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Auth State stored in localStorage
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

/**
 * Helper to get auth token from localStorage
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
};

/**
 * Helper to set auth state in localStorage
 */
export const setAuthState = (authState: AuthState) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("accessToken", authState.accessToken);
  localStorage.setItem("user", JSON.stringify(authState.user));
};

/**
 * Helper to clear auth state from localStorage
 */
export const clearAuthState = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
};

/**
 * Helper to get stored user data
 */
export const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

/**
 * Make API request with automatic token handling and error management
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add custom headers from options
  if (
    options.headers &&
    typeof options.headers === "object" &&
    !Array.isArray(options.headers)
  ) {
    Object.assign(headers, options.headers);
  }

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    console.log(`[API Client] ${options.method || "GET"} ${endpoint}`);
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies in request
    });

    const data = await response.json();

    // Handle 401 Unauthorized — attempt one token refresh then retry
    if (
      response.status === 401 &&
      !isRefreshingToken &&
      !endpoint.includes("/api/auth/")
    ) {
      isRefreshingToken = true;
      try {
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.data?.accessToken) {
            localStorage.setItem("accessToken", refreshData.data.accessToken);
            if (refreshData.data?.user) {
              localStorage.setItem(
                "user",
                JSON.stringify(refreshData.data.user),
              );
            }
            isRefreshingToken = false;
            // Retry the original request with the new token
            return apiRequest<T>(endpoint, options);
          }
        }
      } catch {
        // refresh network error — fall through to logout
      }
      isRefreshingToken = false;
      clearAuthState();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
      return { success: false, error: "Session expired. Please log in again." };
    }

    if (!response.ok) {
      console.error(`[API Client] Error ${response.status}:`, data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    console.log(`[API Client] Success:`, data);
    return data;
  } catch (error) {
    console.error(`[API Client] Request failed:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Upload file with multipart form data
 */
async function uploadFile(
  endpoint: string,
  file: File,
  options: Omit<RequestInit, "body" | "headers"> = {},
): Promise<ApiResponse<UploadResponse>> {
  const url = `${API_URL}${endpoint}`;
  const token = getAuthToken();

  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    console.log(`[API Client] POST ${endpoint} (file upload)`);
    const response = await fetch(url, {
      method: "POST",
      ...options,
      headers,
      body: formData,
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[API Client] Upload failed ${response.status}:`, data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    console.log(`[API Client] Upload success:`, data);
    return data;
  } catch (error) {
    console.error(`[API Client] Upload request failed:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export const authAPI = {
  /**
   * Register new user with email and password
   */
  register: async (email: string, password: string, name: string) => {
    const response = await apiRequest<AuthPayload>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });

    if (response.success && response.data) {
      setAuthState({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
    }

    return response;
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    const response = await apiRequest<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      setAuthState({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
    }

    return response;
  },

  /**
   * Google OAuth login with credential
   */
  googleAuth: async (credential: string) => {
    const response = await apiRequest<AuthPayload>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });

    if (response.success && response.data) {
      setAuthState({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
    }

    return response;
  },

  /**
   * Refresh access token using refresh token from cookie
   */
  refreshToken: async () => {
    const response = await apiRequest<AuthPayload>("/api/auth/refresh", {
      method: "POST",
    });

    if (response.success && response.data) {
      setAuthState({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
    }

    return response;
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser: async () => {
    return apiRequest<AuthState["user"]>("/api/auth/me", {
      method: "GET",
    });
  },

  /**
   * Logout and clear session
   */
  logout: async () => {
    const response = await apiRequest("/api/auth/logout", {
      method: "POST",
    });

    if (response.success) {
      clearAuthState();
    }

    return response;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export const uploadAPI = {
  /**
   * Upload image file to Supabase Storage
   */
  uploadImage: async (file: File) => {
    return uploadFile("/api/upload/image", file);
  },

  /**
   * Delete image by path
   */
  deleteImage: async (path: string) => {
    return apiRequest<{ message: string }>("/api/upload/image", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// WARDROBE ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export interface WardrobeListQuery {
  category?: string;
  limit?: number;
  offset?: number;
}

export interface WardrobeCreatePayload {
  name: string;
  category: string;
  imageUrl: string;
  storagePath: string;
  colors?: string[];
  pattern?: string;
  fabric?: string;
  fit?: string;
  formality?: string;
  season?: string[];
  occasion?: string[];
  tags?: string[];
  stylistNote?: string;
}

export const wardrobeAPI = {
  /**
   * Get user's wardrobe items with pagination
   */
  getItems: async (query: WardrobeListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.category) params.append("category", query.category);
    if (query.limit) params.append("limit", String(query.limit));
    if (query.offset) params.append("offset", String(query.offset));

    return apiRequest<{
      items: WardrobeItemResponse[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/wardrobe?${params.toString()}`, {
      method: "GET",
    });
  },

  /**
   * Get single wardrobe item
   */
  getItem: async (id: string) => {
    return apiRequest<WardrobeItemResponse>(`/api/wardrobe/${id}`, {
      method: "GET",
    });
  },

  /**
   * Create new wardrobe item
   */
  createItem: async (payload: WardrobeCreatePayload) => {
    return apiRequest<WardrobeItemResponse>("/api/wardrobe", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update wardrobe item
   */
  updateItem: async (id: string, updates: Partial<WardrobeCreatePayload>) => {
    return apiRequest<WardrobeItemResponse>(`/api/wardrobe/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete wardrobe item
   */
  deleteItem: async (id: string) => {
    return apiRequest<{ message: string }>(`/api/wardrobe/${id}`, {
      method: "DELETE",
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// OUTFIT ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export interface OutfitListQuery {
  worn?: boolean;
  limit?: number;
  offset?: number;
}

export interface OutfitGeneratePayload {
  occasion?: string;
  season?: string;
  mood?: string;
}

export const outfitAPI = {
  /**
   * Get outfit history with optional filtering
   */
  getOutfits: async (query: OutfitListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.worn !== undefined) params.append("worn", String(query.worn));
    if (query.limit) params.append("limit", String(query.limit));
    if (query.offset) params.append("offset", String(query.offset));

    return apiRequest<{
      outfits: OutfitResponse[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/outfits?${params.toString()}`, {
      method: "GET",
    });
  },

  /**
   * Generate AI outfit from wardrobe
   */
  generateOutfit: async (payload: OutfitGeneratePayload = {}) => {
    return apiRequest<OutfitResponse>("/api/ai/outfit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Manually create an outfit from wardrobe item IDs
   */
  createOutfit: async (payload: {
    wardrobeItemIds: string[];
    occasion?: string;
    reasoning?: string;
    colorStory?: string;
    scores?: {
      balance?: number;
      formality?: number;
      color?: number;
      novelty?: number;
    };
  }) => {
    return apiRequest<OutfitResponse>("/api/outfits", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Mark outfit as worn
   */
  markOutfitWorn: async (id: string, worn: boolean = true) => {
    return apiRequest<OutfitResponse>(`/api/outfits/${id}/worn`, {
      method: "PATCH",
      body: JSON.stringify({ worn, wornAt: new Date().toISOString() }),
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT ALL APIs
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// AI ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export const aiAPI = {
  /**
   * Classify clothing items from a base64 image.
   * base64 must NOT include the data:image/...;base64, prefix.
   */
  classifyClothing: async (base64: string, mediaType: string) => {
    return apiRequest<ClothingClassificationItem[]>("/api/classify-clothing", {
      method: "POST",
      body: JSON.stringify({ base64, mediaType }),
    });
  },

  /**
   * Generate a styled outfit from user's wardrobe (stored in DB).
   */
  generateOutfit: async (options?: {
    previousOutfitIds?: string[];
    shuffleVibe?: string;
  }) => {
    return apiRequest<GeneratedOutfitResponse>("/api/generate-outfit", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// USER ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

export const userAPI = {
  getProfile: async () => {
    return apiRequest<UserProfileResponse>("/api/user/profile", {
      method: "GET",
    });
  },

  updateProfile: async (updates: { name?: string; avatar?: string }) => {
    return apiRequest<UserProfileResponse>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  completeOnboarding: async (
    styleProfiles: string[],
    styleIssues: string[] = [],
  ) => {
    return apiRequest<UserProfileResponse>("/api/user/onboarding", {
      method: "POST",
      body: JSON.stringify({ styleProfiles, styleIssues }),
    });
  },

  getSubscription: async () => {
    return apiRequest<SubscriptionResponse | null>("/api/user/subscription", {
      method: "GET",
    });
  },

  deleteAccount: async (password?: string) => {
    return apiRequest<{ deleted: boolean }>("/api/user/account", {
      method: "DELETE",
      body: JSON.stringify(password ? { password } : {}),
    });
  },
};

// ════════════════════════════════════════════════════════════════════════════
// WARDROBE BULK
// ════════════════════════════════════════════════════════════════════════════

export const wardrobeBulkAPI = {
  bulkCreateItems: async (
    items: import("@/types/api").WardrobeItemCreateInput[],
  ) => {
    return apiRequest<{ items: WardrobeItemResponse[]; count: number }>(
      "/api/wardrobe/bulk",
      {
        method: "POST",
        body: JSON.stringify({ items }),
      },
    );
  },

  bulkDeleteItems: async (ids: string[]) => {
    return apiRequest<{ deleted: number }>("/api/wardrobe/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },

  recordWear: async (id: string) => {
    return apiRequest<WardrobeItemResponse>(`/api/wardrobe/${id}/wear`, {
      method: "POST",
    });
  },
};

export const apiClient = {
  auth: authAPI,
  upload: uploadAPI,
  wardrobe: wardrobeAPI,
  wardrobeBulk: wardrobeBulkAPI,
  outfit: outfitAPI,
  ai: aiAPI,
  user: userAPI,
};
