/**
 * App Context
 *
 * Provides shared state for all authenticated (app) pages:
 * user, plan, wardrobe items, toast, paywall, and action handlers.
 *
 * Scoped to app/(app)/layout.tsx — does not exist on public pages.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useWardrobe } from "@/lib/hooks/useWardrobe";
import { deleteWardrobeItem } from "@/lib/actions/wardrobe";
import { logoutUser } from "@/lib/actions/auth";
import { clear as clearIdb } from "idb-keyval";
import { getStoredUser, getAuthToken, decodeJwt } from "@/lib/utils/authUtils";
import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

const FREE_LIMIT = 10;

export interface AppUser {
  id?: string;
  name?: string | null;
  email?: string;
  onboarded?: boolean;
  [key: string]: unknown;
}

interface AppContextValue {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  plan: string | null;
  setPlan: (p: string | null) => void;
  savedItems: WardrobeItem[];
  wardrobeTotal: number;
  wardrobeLoading: boolean;
  loadWardrobeItems: (category?: string) => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
  showPaywall: boolean;
  setShowPaywall: (v: boolean) => void;
  /** Saves an item. Returns true if saved, false if blocked by paywall. */
  handleSaveItem: (item: { name?: string }) => Promise<boolean>;
  handleRemoveItem: (id: string | number) => Promise<void>;
  handleSignOut: () => Promise<void>;
  handleUpgrade: (selectedPlan: string) => void;
  savedOutfitsCount: number;
  loadSavedOutfitsCount: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [savedOutfitsCount, setSavedOutfitsCount] = useState(0);

  const loadSavedOutfitsCount = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/saved-outfits', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setSavedOutfitsCount((d.outfits ?? []).length);
      }
    } catch { /* noop */ }
  }, []);

  const {
    items: savedItems,
    total: wardrobeTotal,
    isLoading: wardrobeLoading,
    loadItems: loadWardrobeItems,
  } = useWardrobe();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getAuthToken();
    const planRaw = localStorage.getItem("altfit-plan");
    if (planRaw) {
      try {
        setPlan(JSON.parse(planRaw));
      } catch {
        /* noop */
      }
    }
    if (storedUser && token) {
      setUser(storedUser as AppUser);

      // Proactively refresh if the access token is expired or within 60 s of expiry.
      // This prevents the 401 → refresh → retry round-trip on every page load.
      const payload = decodeJwt(token);
      const exp = typeof payload?.exp === "number" ? payload.exp : 0;
      const isExpiredOrStale = exp * 1000 < Date.now() + 60_000;

      if (isExpiredOrStale) {
        const BASE = process.env.NEXT_PUBLIC_APP_URL || "";
        fetch(`${BASE}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.data?.accessToken) {
              localStorage.setItem("accessToken", data.data.accessToken);
              if (data.data?.user)
                localStorage.setItem("user", JSON.stringify(data.data.user));
            }
            loadWardrobeItems();
            loadSavedOutfitsCount();
          })
          .catch(() => { loadWardrobeItems(); loadSavedOutfitsCount(); });
      } else {
        loadWardrobeItems();
        loadSavedOutfitsCount();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleSaveItem = useCallback(
    async (item: { name?: string }): Promise<boolean> => {
      if (!plan && savedItems.length >= FREE_LIMIT) {
        setShowPaywall(true);
        return false;
      }
      await loadWardrobeItems();
      showToast(`"${item.name}" saved to your wardrobe`);
      return true;
    },
    [plan, savedItems.length, loadWardrobeItems, showToast],
  );

  const handleRemoveItem = useCallback(
    async (id: string | number) => {
      const result = await deleteWardrobeItem(String(id));
      if (result.success) {
        showToast("Item removed from wardrobe");
        await loadWardrobeItems();
      } else {
        showToast(result.error ?? "Failed to remove item");
      }
    },
    [loadWardrobeItems, showToast],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      /* noop */
    }
    // Clear IndexedDB (curation cache) and all localStorage/sessionStorage/cookies
    try {
      await clearIdb();
    } catch {
      /* noop */
    }
    setUser(null);
    setPlan(null);
  }, []);

  const handleUpgrade = useCallback(
    (selectedPlan: string) => {
      setPlan(selectedPlan);
      setShowPaywall(false);
      try {
        localStorage.setItem("altfit-plan", JSON.stringify(selectedPlan));
      } catch {
        /* noop */
      }
      showToast("Welcome to ALT FIT Pro ✦");
    },
    [showToast],
  );

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        plan,
        setPlan,
        savedItems: savedItems as WardrobeItem[],
        wardrobeTotal,
        wardrobeLoading,
        loadWardrobeItems,
        toast,
        showToast,
        showPaywall,
        setShowPaywall,
        handleSaveItem,
        handleRemoveItem,
        handleSignOut,
        handleUpgrade,
        savedOutfitsCount,
        loadSavedOutfitsCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
