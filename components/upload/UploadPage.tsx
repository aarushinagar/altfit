"use client";

import { useState } from "react";
import { Box, Stack } from "@mui/material";
import UploadZone from "@/components/upload/UploadZone";
import UploadItemCard, { UploadItem } from "@/components/upload/UploadItemCard";
import { detectRealType, isHeicFile } from "@/lib/utils/imageUtils";
import { createWardrobeItemFromFile } from "@/lib/actions/wardrobe";
import type { WardrobeItemResponse } from "@/types/api";

interface WardrobeSavePayload {
  name: string;
  imageUrl: string;
}

interface UploadPageProps {
  onSaveItem: (item: WardrobeSavePayload) => void;
  savedItems: { id: string | number }[];
}

// No-op callbacks — saves are handled server-side before status becomes "ready"
const noop = () => {};

export default function UploadPage({ onSaveItem }: UploadPageProps) {
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
    const newIds = filesToProcess.map((_, i) => Date.now() + i + Math.random());
    const previews: (string | null)[] = filesToProcess.map((file, i) => {
      if (fileTypes[i] === "heic" || isHeicFile(file)) return null;
      return URL.createObjectURL(file);
    });

    // Add all files to state at once — non-heic ones appear as "queued"
    const initialItems: UploadItem[] = filesToProcess.map((file, i) => ({
      id: newIds[i],
      fileName: file.name,
      status:
        fileTypes[i] === "heic" || isHeicFile(file)
          ? ("heic" as const)
          : ("queued" as const),
      previewUrl: previews[i],
      pieces: null,
      savedPieceIds: [],
      intent: null,
    }));

    setItems((prev) => [...prev, ...initialItems]);

    // Process non-heic files one-by-one; they transition queued → analyzing → ready/error
    for (let i = 0; i < filesToProcess.length; i++) {
      if (initialItems[i].status === "heic") continue;

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

        if (!result.success || !result.data) {
          throw new Error(result.error || "Server failed to process item");
        }

        const saved = result.data as WardrobeItemResponse;
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: "ready",
                  progress: 100,
                  intent: "full_outfit",
                  wardrobeItemId: saved.id,
                  uploadedUrl: saved.imageUrl,
                }
              : it,
          ),
        );
        onSaveItem({
          name: saved.name,
          imageUrl: saved.imageUrl ?? previewUrl,
        });
      } catch (err) {
        clearInterval(timer);
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
      </Box>
    </Box>
  );
}
