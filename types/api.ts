/**
 * API Response Types
 *
 * Standard response format for all API endpoints
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

/**
 * Auth-related response types
 */
export interface AuthPayload {
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

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  credential: string; // JWT from Google Identity Services
}

export interface RefreshTokenRequest {
  refreshToken?: string; // Can come from cookie
}

/**
 * Wardrobe item types
 */
export interface WardrobeItemRequest {
  name: string;
  category: string;
  imageUrl: string;
  storagePath: string;
  colors?: string[];
  colorNames?: string[];
  pattern?: string;
  fabric?: string;
  fit?: string;
  formality?: number;
  season?: string[];
  occasion?: string[];
  stylistNote?: string;
  tags?: string[];
}

export interface WardrobeItemResponse extends WardrobeItemRequest {
  id: string;
  userId: string;
  wearCount: number;
  lastWornAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Outfit types
 */
export interface OutfitRequest {
  occasion?: string;
  reasoning?: string;
  colorStory?: string;
  scoreBalance?: number;
  scoreFormality?: number;
  scoreColor?: number;
  scoreNovelty?: number;
  wardrobeItemIds: string[];
}

export interface OutfitResponse {
  id: string;
  userId: string;
  occasion: string | null;
  reasoning: string | null;
  colorStory: string | null;
  scoreBalance: number | null;
  scoreFormality: number | null;
  scoreColor: number | null;
  scoreNovelty: number | null;
  worn: boolean;
  wornAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    wardrobeItemId: string;
    role: string | null;
  }>;
}

/**
 * Upload response
 */
export interface UploadResponse {
  url: string;
  path: string;
  contentType: string;
  size: number;
}

/**
 * Subscription types
 */
export interface SubscriptionResponse {
  id: string;
  userId: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  startedAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
}
