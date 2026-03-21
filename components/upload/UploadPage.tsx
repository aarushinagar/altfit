/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { Box, Stack } from "@mui/material";
import UploadZone from "@/components/upload/UploadZone";
import UploadItemCard, { UploadItem } from "@/components/upload/UploadItemCard";
import { detectRealType, isHeicFile } from "@/lib/utils/imageUtils";
import {
  createWardrobeItemFromFile,
  uploadCroppedImage,
  updateWardrobeItemImage,
  type DetectedPiece,
} from "@/lib/actions/wardrobe";
import { cropImageToPiece } from "@/lib/utils/imageCrop";
import type { WardrobeItemResponse } from "@/types/api";

interface WardrobeSavePayload {
  name: string;
  imageUrl: string;
}

interface UploadPageProps {
  onSaveItem: (item: WardrobeSavePayload) => void;
  savedItems: { id: string | number }[];
  wardrobeTotal?: number;
  recentItems?: { id: string | number; imageUrl?: string | null; category?: string }[];
}

// No-op callbacks — saves are handled server-side before status becomes "ready"
const noop = () => { };

export default function UploadPage({ onSaveItem, wardrobeTotal = 0, recentItems = [] }: UploadPageProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragover, setDragover] = useState(false);

  // MAX_UPLOAD = 10 unique image uploads per session
  // Total wardrobe items can be 100+ since users can reuse the same image for multiple items
  const MAX_UPLOAD = 10;

  const processFiles = async (files: FileList) => {
    const imageFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(f.name),
    );
    if (!imageFiles.length) return;

    // Enforce max 10 total using the current items closure value
    const filesToProcess = imageFiles.slice(
      0,
      Math.max(MAX_UPLOAD - items.length, 0),
    );
    if (!filesToProcess.length) return;

    // Detect all file types in parallel before adding anything to the queue
    const fileTypes = await Promise.all(
      filesToProcess.map((f) => detectRealType(f)),
    );

    // Build preview URLs and assign stable IDs for all files upfront
    // HEIC files can't be rendered by browsers, but the backend converts them — no special casing
    const newIds = filesToProcess.map((_, i) => Date.now() + i + Math.random());
    const previews: (string | null)[] = filesToProcess.map((file, i) => {
      if (fileTypes[i] === "heic" || isHeicFile(file)) return null; // can't render HEIC, preview shows skeleton
      return URL.createObjectURL(file);
    });

    // All files start as "queued" — HEIC is no longer blocked client-side (backend handles it)
    const initialItems: UploadItem[] = filesToProcess.map((file, i) => ({
      id: newIds[i],
      fileName: file.name,
      status: "queued" as const,
      previewUrl: previews[i],
      pieces: null,
      savedPieceIds: [],
      intent: null,
    }));

    setItems((prev) => [...prev, ...initialItems]);

    // Process all files one-by-one; they transition queued → analyzing → ready/error
    for (let i = 0; i < filesToProcess.length; i++) {

      const file = filesToProcess[i];
      const id = newIds[i];
      const previewUrl = previews[i]!;
      const name =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim() || "Clothing Item";

      // Transition: queued → analyzing
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "analyzing", progress: 25 } : it,
        ),
      );

      // Show "analyzing..." hint after 5 seconds
      const hintTimeout = setTimeout(() => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && it.status === "analyzing"
              ? {
                ...it,
                progress: Math.max(it.progress ?? 25, 40),
              }
              : it,
          ),
        );
      }, 5000);

      // Fake progress ticks while the server processes (Sharp + Gemini + DB)
      const timer = setInterval(() => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id && (it.progress ?? 0) < 88
              ? { ...it, progress: (it.progress ?? 0) + Math.random() * 4 + 1 }
              : it,
          ),
        );
      }, 400);

      try {
        const result = await createWardrobeItemFromFile(file, name);
        clearInterval(timer);
        clearTimeout(hintTimeout);

        if (!result.success || !result.data?.items?.length) {
          throw new Error(result.error || "Server failed to process item");
        }

        // API returned one or more items from this upload (multi-piece detection)
        const detectedItems = result.data.items;
        const firstItem = detectedItems[0];

        // ── Done — replace placeholder card with one card per detected piece ──
        setItems((prev) => {
          const without = prev.filter((it) => it.id !== id);
          const pieceCards: UploadItem[] = detectedItems.map((piece, idx) => ({
            id: id + idx, // stable id: original + offset
            fileName: piece.name,       // display the AI-detected piece name
            status: "ready" as const,
            previewUrl: piece.imageUrl, // show the cropped piece image
            uploadedUrl: piece.imageUrl,
            wardrobeItemId: piece.id,
            progress: 100,
            intent: "full_outfit" as const,
            pieces: null,
            savedPieceIds: [],
          }));
          return [...without, ...pieceCards];
        });
        // Notify parent once per piece (paywall + wardrobe refresh)
        for (const piece of detectedItems) {
          onSaveItem({
            name: piece.name,
            imageUrl: piece.imageUrl ?? previewUrl,
          });
        }
      } catch (err) {
        clearInterval(timer);
        clearTimeout(hintTimeout);
        const message = err instanceof Error ? err.message : String(err);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "error", error: message } : it,
          ),
        );
      }
    }
  };

  const removeItem = (id: number) => {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      // Revoke object URL to avoid memory leaks
      if (item?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  return (
    <Box className="upload-page page">
      <Box className="page-header fade-up">
        <p className="page-eyebrow">Build Your Wardrobe</p>
        <h1 className="page-title">Add Pieces</h1>
        <p className="page-count">
          Drop a photo — AI analyses and saves it instantly
        </p>

        {/* Upload stats */}
        {wardrobeTotal > 0 && (
          <Box sx={{
            display: "flex", alignItems: "center", gap: 3,
            mt: 2, mb: 3, px: "20px", py: "16px",
            background: "rgba(201,169,110,0.08)",
            border: "1px solid rgba(201,169,110,0.2)",
            borderRadius: "12px",
          }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
              <Box sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "var(--ink)", lineHeight: 1 }}>{wardrobeTotal}</Box>
              <Box sx={{ fontSize: 11, color: "#9a8f80", letterSpacing: "0.05em" }}>pieces in wardrobe</Box>
            </Box>
            <Box sx={{ width: 1, height: 40, background: "rgba(201,169,110,0.3)", flexShrink: 0 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
              <Box sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "var(--ink)", lineHeight: 1 }}>Daily</Box>
              <Box sx={{ fontSize: 11, color: "#9a8f80", letterSpacing: "0.05em" }}>AI outfit curation</Box>
            </Box>
          </Box>
        )}
      </Box>

      <Box className="upload-body">
        <UploadZone
          dragover={dragover}
          setDragover={setDragover}
          onFiles={processFiles}
        />

        {items.length >= MAX_UPLOAD && (
          <Box
            sx={{
              fontSize: 11,
              color: "var(--taupe)",
              textAlign: "center",
              py: 1,
              letterSpacing: "0.06em",
            }}
          >
            Maximum of {MAX_UPLOAD} images reached. Remove an item to add more.
          </Box>
        )}

        {items.length > 0 && (
          <Stack gap={2}>
            {items.map((item) => (
              <UploadItemCard
                key={item.id}
                item={item}
                onSaveFullOutfit={noop}
                onSavePiece={noop}
                onSaveAsOutfit={noop}
                onSetIntent={noop}
                onRemove={removeItem}
              />
            ))}
          </Stack>
        )}

        {/* Recently added pieces */}
        {recentItems.length > 0 && items.length === 0 && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f80", mb: 1.5 }}>
              Recently Added
            </Box>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1,
              "@media (min-width: 600px)": { gridTemplateColumns: "repeat(6, 1fr)" },
            }}>
              {recentItems.map((item) => (
                <Box key={item.id} sx={{ aspectRatio: "1", borderRadius: "8px", overflow: "hidden", background: "var(--linen)" }}>
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.category ?? ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
