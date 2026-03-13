# Frontend API Integration Guide

## Overview

This monorepo uses **direct function calls** to communicate between frontend and backend instead of HTTP requests. All API calls are handled through the **API Client** (`lib/api-client.ts`) and **React Hooks** in `lib/hooks/`.

---

## Quick Start

### 1. Basic Setup in Your Component

```tsx
"use client";

import { useAuth } from "@/lib/hooks";

export default function MyComponent() {
  const { isLoggedIn, user, login, logout } = useAuth();

  return (
    <div>
      {isLoggedIn ? (
        <p>Welcome back, {user?.name}!</p>
      ) : (
        <p>Please login first</p>
      )}
    </div>
  );
}
```

---

## Available Hooks

### **useAuth** - Authentication Management

Manages user authentication state and provides login/logout methods.

```tsx
import { useAuth } from "@/lib/hooks";

const {
  isLoading, // boolean
  isLoggedIn, // boolean
  user, // { id, email, name, avatar, provider, onboarded }
  register, // (email, password, name) => Promise<boolean>
  login, // (email, password) => Promise<boolean>
  googleAuth, // (credential) => Promise<boolean>
  logout, // () => Promise<void>
  error, // string | null
} = useAuth();
```

**Example:**

```tsx
const { login, isLoading, error } = useAuth();

const handleLogin = async () => {
  const success = await login("user@example.com", "Password123");
  if (success) {
    // Redirect to dashboard
  }
};
```

---

### **useWardrobe** - Wardrobe Management

Manages wardrobe items (CRUD operations).

```tsx
import { useWardrobe } from "@/lib/hooks";

const {
  items, // WardrobeItemResponse[]
  isLoading, // boolean
  error, // string | null
  total, // number
  loadItems, // (category?, limit?, offset?) => Promise<void>
  createItem, // (payload) => Promise<WardrobeItemResponse | null>
  updateItem, // (id, updates) => Promise<WardrobeItemResponse | null>
  deleteItem, // (id) => Promise<boolean>
  getItem, // (id) => Promise<WardrobeItemResponse | null>
} = useWardrobe();
```

**Example:**

```tsx
const { items, loadItems, createItem } = useWardrobe();

// Load all wardrobe items
useEffect(() => {
  loadItems();
}, [loadItems]);

// Create new item
const handleAddItem = async () => {
  const item = await createItem({
    name: "Blue Jeans",
    category: "bottoms",
    imageUrl: "https://cdn.example.com/image.jpg",
    storagePath: "wardrobe-images/user123/item456.jpg",
    colors: ["blue"],
    fabric: "denim",
  });
  if (item) console.log("Item created:", item.id);
};
```

---

### **useOutfit** - Outfit Management

Manages outfit generation and tracking.

```tsx
import { useOutfit } from "@/lib/hooks";

const {
  outfits, // OutfitResponse[]
  isLoading, // boolean
  error, // string | null
  total, // number
  loadOutfits, // (worn?, limit?, offset?) => Promise<void>
  generateOutfit, // (occasion?, season?, mood?) => Promise<OutfitResponse | null>
  markOutfitWorn, // (id, worn?) => Promise<OutfitResponse | null>
} = useOutfit();
```

**Example:**

```tsx
const { generateOutfit, markOutfitWorn } = useOutfit();

// Generate outfit
const outfit = await generateOutfit("casual");

// Mark outfit as worn
await markOutfitWorn(outfit.id, true);
```

---

### **useUpload** - Image Upload

Manages file uploads to Supabase Storage.

```tsx
import { useUpload } from "@/lib/hooks";

const {
  isLoading, // boolean
  progress, // number (0-100)
  error, // string | null
  uploadImage, // (file: File) => Promise<UploadResponse | null>
  deleteImage, // (path: string) => Promise<boolean>
} = useUpload();
```

**Example:**

```tsx
const { uploadImage, isLoading, progress } = useUpload();

const handleFileSelect = async (file: File) => {
  const result = await uploadImage(file);
  if (result) {
    console.log("Uploaded to:", result.url);
    // Use result.url and result.path for wardrobe item
  }
};
```

---

## Direct API Client Usage

For more control, use the `apiClient` directly:

```tsx
import { apiClient } from "@/lib/api-client";

// Authentication
const response = await apiClient.auth.login("user@example.com", "password");
const user = await apiClient.auth.getCurrentUser();
await apiClient.auth.logout();

// Wardrobe
const items = await apiClient.wardrobe.getItems({ category: "tops" });
const item = await apiClient.wardrobe.createItem({
  /* ... */
});
await apiClient.wardrobe.deleteItem(itemId);

// Outfits
const outfits = await apiClient.outfit.getOutfits();
const outfit = await apiClient.outfit.generateOutfit("casual");

// Uploads
const uploadResult = await apiClient.upload.uploadImage(file);
await apiClient.upload.deleteImage(filePath);
```

---

## API Response Format

All APIs return standardized responses:

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T; // Populated if success=true
  error?: string; // Error message if success=false
  message?: string; // Optional success message
  statusCode?: number; // HTTP status code
}
```

**Example:**

```tsx
const response = await apiClient.auth.login(email, password);

if (response.success) {
  console.log("User:", response.data?.user);
} else {
  console.error("Login failed:", response.error);
}
```

---

## Authentication Flow

### Login Flow

```tsx
"use client";

import { useAuth } from "@/lib/hooks";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      router.push("/dashboard");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
```

### Token Management

- **Access tokens** are stored in `localStorage` with key `accessToken`
- **Refresh tokens** are stored in `httpOnly` cookies (automatic)
- **User data** is stored in `localStorage` with key `user`

You can retrieve stored auth state:

```tsx
import { getAuthToken, getStoredUser } from "@/lib/api-client";

const token = getAuthToken(); // string | null
const user = getStoredUser(); // user object | null
```

---

## Wardrobe Item Structure

```ts
interface WardrobeItemResponse {
  id: string;
  userId: string;
  name: string;
  category: string;
  imageUrl: string; // Supabase CDN URL
  storagePath: string; // Supabase storage path
  colors?: string[];
  pattern?: string;
  fabric?: string;
  fit?: string;
  formality?: string;
  season?: string[];
  occasion?: string[];
  tags?: string[];
  stylistNote?: string;
  wearCount: number;
  lastWornAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Outfit Item Structure

```ts
interface OutfitResponse {
  id: string;
  userId: string;
  occasion?: string;
  reasoning?: string;
  colorStory?: string;
  scores?: {
    balance?: number; // 0-10
    formality?: number; // 0-10
    color?: number; // 0-10
    novelty?: number; // 0-10
  };
  items?: Array<{
    id: string;
    role: "base" | "layer" | "accent" | "statement";
    wardrobeItem?: WardrobeItemResponse;
  }>;
  worn: boolean;
  wornAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Handling

All hooks provide error state management:

```tsx
const { isLoading, error, items, loadItems } = useWardrobe();

useEffect(() => {
  loadItems();
}, []);

if (error) {
  return <div className="error-alert">{error}</div>;
}

if (isLoading) {
  return <div>Loading...</div>;
}

return <ItemList items={items} />;
```

---

## Server vs Client Components

- **API Hooks MUST be used in Client Components** (`'use client'`)
- Backend endpoints work from both server and client
- For server-side calls, import `apiClient` directly

```tsx
// Server Component
import { apiClient } from "@/lib/api-client";

export async function WardrobeList() {
  const response = await apiClient.wardrobe.getItems();
  // Note: No 'use client' directive
}
```

---

## Complete Example: Wardrobe Dashboard

```tsx
"use client";

import { useEffect } from "react";
import { useAuth, useWardrobe, useUpload } from "@/lib/hooks";

export default function Dashboard() {
  const { user, logout, isLoggedIn } = useAuth();
  const { items, loadItems, createItem, deleteItem } = useWardrobe();
  const { uploadImage, isLoading: uploading } = useUpload();

  useEffect(() => {
    if (isLoggedIn) {
      loadItems();
    }
  }, [isLoggedIn, loadItems]);

  const handleAddItem = async (file: File, name: string) => {
    // Upload image first
    const uploadResult = await uploadImage(file);
    if (!uploadResult) return;

    // Create wardrobe item with uploaded image
    await createItem({
      name,
      category: "tops",
      imageUrl: uploadResult.url,
      storagePath: uploadResult.path,
    });

    // Reload items
    loadItems();
  };

  if (!isLoggedIn) {
    return <p>Please login first</p>;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <button onClick={logout}>Logout</button>

      <h2>My Wardrobe ({items.length} items)</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{ border: "1px solid #ccc", padding: "12px" }}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              style={{ width: "100%" }}
            />
            <h3>{item.name}</h3>
            <button onClick={() => deleteItem(item.id)}>Delete</button>
          </div>
        ))}
      </div>

      <h2>Add Item</h2>
      <FileUploadForm onSubmit={handleAddItem} disabled={uploading} />
    </div>
  );
}
```

---

## Environment Variables

The API client uses:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Set in `.env.local` or `.env` for the frontend.

---

## Debugging

All API calls are logged to the browser console with `[API Client]` prefix:

```
[API Client] POST /api/auth/login
[API Client] Success: { success: true, data: { ... } }
```

Each hook also logs its operations:

```
[Auth Hook] Logging in user: user@example.com
[Wardrobe Hook] Loading items
[Upload Hook] Starting upload: image.jpg 2048576 bytes
```

Open DevTools Console to debug requests and responses.

---

## Next Steps

1. Import hooks in your components
2. Handle authentication and redirection flows
3. Build wardrobe management UI
4. Implement outfit generation and history
5. Add image upload functionality

Example components are in `components/examples.tsx`.
