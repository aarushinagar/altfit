"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import FilterBar from "@/components/wardrobe/FilterBar";
import WardrobeGrid from "@/components/wardrobe/WardrobeGrid";
import WardrobeItemModal from "@/components/wardrobe/WardrobeItemModal";
import { inferCategory } from "@/lib/utils/clothing";
import { getAuthToken } from "@/lib/utils/authUtils";
import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

const BANNER_DISMISS_KEY = "altfit_missing_photo_banner_dismissed";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

interface WardrobePageProps {
  savedItems: WardrobeItem[];
  isLoading: boolean;
  onRemoveItem: (id: string | number) => void;
  onFilterChange?: (category?: string) => void;
  /** Refresh wardrobe list after a successful re-upload */
  onRefresh?: () => void;
}

export default function WardrobePage({
  savedItems,
  isLoading,
  onRemoveItem,
  onFilterChange,
  onRefresh,
}: WardrobePageProps) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden; read from localStorage on mount
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive count from the items prop directly — no reactive broken-load tracking needed
  const missingCount = savedItems.filter((i) => !i.imageUrl).length;

  useEffect(() => {
    // Only show banner if there are missing photos and user hasn't dismissed it
    const dismissed = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!dismissed) setBannerDismissed(false);
  }, []);

  // Poll every 3s while any item is still being analyzed
  useEffect(() => {
    const hasPending = savedItems.some(i => i.analysisStatus === 'pending');
    if (!hasPending) return;

    const timer = setInterval(() => {
      onRefresh?.();
    }, 3000);

    return () => clearInterval(timer);
  }, [savedItems, onRefresh]);

  const handleImageBroken = useCallback(() => {
    // Still useful for showing the banner if a URL was set but the image 404s
    setBannerDismissed((prev) => {
      if (prev) {
        const dismissed = localStorage.getItem(BANNER_DISMISS_KEY);
        return !!dismissed;
      }
      return prev;
    });
  }, []);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(BANNER_DISMISS_KEY, "1");
    setBannerDismissed(true);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const handleReupload = useCallback(async (id: string | number, file: File) => {
    setReuploadingId(id);
    try {
      const token = getAuthToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // 1. Upload the new image
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        headers: authHeader,
        body: formData,
        credentials: "include",
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        const msg = String(uploadData.error || "Upload failed");
        const isSetup =
          msg.includes("not configured") ||
          msg.includes("Bucket") ||
          msg.includes("bucket") ||
          msg.includes("row-level") ||
          msg.includes("storage") ||
          msg.includes("Unauthorized");
        showToast(
          isSetup
            ? "Storage setup failed — please try again"
            : `Upload failed: ${msg}`,
        );
        console.error("[Reupload] Upload failed:", msg);
        return;
      }

      // 2. PATCH the wardrobe item with the new imageUrl + storagePath
      const patchRes = await fetch(`${BASE}/api/wardrobe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          imageUrl: uploadData.data.url,
          storagePath: uploadData.data.path,
        }),
        credentials: "include",
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok || !patchData.success) {
        console.error("[Reupload] PATCH failed:", patchData.error);
        showToast(`Failed to save photo: ${patchData.error || "unknown error"}`);
        return;
      }

      // 3. Refresh wardrobe list so the new image is shown
      onRefresh?.();
      showToast("Photo saved ✓");
      // Update modal if it was the selected item
      setSelectedItem(prev => prev?.id === id ? { ...prev, imageUrl: uploadData.data.url } : prev);
    } catch (err) {
      console.error("[Reupload] Error:", err);
      showToast("Upload failed — check console for details");
    } finally {
      setReuploadingId(null);
    }
  }, [onRefresh, showToast]);

  const filtered = savedItems.filter((item) => {
    if (activeFilter === "All") return true;
    const cat = inferCategory(item);
    return cat === activeFilter.toLowerCase();
  });

  const handleFilterChange = (cat: string) => {
    setActiveFilter(cat);
    onFilterChange?.(cat === "All" ? undefined : cat.toLowerCase());
  };

  return (
    <Box className="wardrobe-page page">
      <div className="page-header fade-up">
        <p className="page-eyebrow">Your Collection</p>
        <h1 className="page-title">Wardrobe</h1>
        <p className="page-count">
          {savedItems.length} piece{savedItems.length !== 1 ? "s" : ""}
        </p>
      </div>

      <FilterBar activeFilter={activeFilter} onChange={handleFilterChange} />

      {missingCount > 0 && !bannerDismissed && (
        <Box
          sx={{
            mx: 0,
            mb: 2,
            px: 2,
            py: 1.25,
            background: "var(--linen)",
            borderLeft: "3px solid var(--gold)",
            fontSize: 11,
            letterSpacing: "0.06em",
            color: "var(--taupe)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <span>
            {missingCount} piece{missingCount !== 1 ? "s are" : " is"} missing{" "}
            a photo — click any <strong>Add Photo</strong> card to attach one.
          </span>
          <Box
            component="button"
            onClick={dismissBanner}
            sx={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "var(--taupe)", lineHeight: 1,
              p: 0.5, flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ✕
          </Box>
        </Box>
      )}

      <WardrobeGrid
        items={filtered}
        isLoading={isLoading}
        onItemClick={setSelectedItem}
        onReupload={handleReupload}
        onImageBroken={handleImageBroken}
        reuploadingId={reuploadingId}
      />

      {/* Re-attach success toast */}
      {toast && (
        <Box
          sx={{
            position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)",
            background: "var(--ink)", color: "#fff",
            px: 2.5, py: 1, borderRadius: 1,
            fontSize: 12, letterSpacing: "0.06em",
            zIndex: 9999,
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {toast}
        </Box>
      )}

      {selectedItem && (
        <WardrobeItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemove={(id) => {
            onRemoveItem(id);
            setSelectedItem(null);
          }}
          onReupload={handleReupload}
        />
      )}
    </Box>
  );
}
