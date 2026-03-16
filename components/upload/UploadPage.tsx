"use client";

import { useState } from "react";
import UploadZone from "@/components/upload/UploadZone";
import UploadItemCard, {
  UploadItem,
  ClothingPiece,
} from "@/components/upload/UploadItemCard";
import { uploadImage, classifyClothing } from "@/lib/actions/upload";
import {
  createWardrobeItem,
  type WardrobeCreatePayload,
} from "@/lib/actions/wardrobe";
import { createOutfit } from "@/lib/actions/outfit";
import {
  detectRealType,
  isHeicFile,
  prepareImage,
  cropImageForCategory,
} from "@/lib/utils/imageUtils";

interface WardrobeSavePayload {
  name: string;
  imageUrl: string;
}

interface UploadPageProps {
  onSaveItem: (item: WardrobeSavePayload) => void;
  savedItems: { id: string | number }[];
}

export default function UploadPage({ onSaveItem }: UploadPageProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragover, setDragover] = useState(false);

  const processFiles = async (files: FileList) => {
    const imageFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(f.name),
    );
    if (!imageFiles.length) return;

    for (const file of imageFiles) {
      const id = Date.now() + Math.random();
      const realType = await detectRealType(file);

      if (realType === "heic" || isHeicFile(file)) {
        setItems((prev) => [
          ...prev,
          {
            id,
            fileName: file.name,
            status: "heic",
            previewUrl: null,
            pieces: null,
            savedPieceIds: [],
            intent: null,
          },
        ]);
        continue;
      }

      setItems((prev) => [
        ...prev,
        {
          id,
          fileName: file.name,
          status: "reading",
          progress: 5,
          previewUrl: null,
          pieces: null,
          savedPieceIds: [],
          intent: null,
        },
      ]);

      let timer: ReturnType<typeof setInterval> | undefined;
      try {
        const { base64, previewDataURL, mediaType } = await prepareImage(file);

        // Upload immediately to reuse URL later
        let uploadedUrl: string | null = null;
        let uploadedStoragePath: string | null = null;
        const uploadRes = await uploadImage(file);
        if (!uploadRes.success) {
          throw new Error(uploadRes.error || "Failed to upload image.");
        }
        if (uploadRes.data) {
          uploadedUrl = (uploadRes.data as { url: string; path: string }).url;
          uploadedStoragePath = (
            uploadRes.data as { url: string; path: string }
          ).path;
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  previewUrl: previewDataURL,
                  base64,
                  mediaType,
                  uploadedUrl,
                  uploadedStoragePath,
                  status: "analyzing",
                  progress: 20,
                }
              : it,
          ),
        );

        timer = setInterval(() => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id && (it.progress ?? 0) < 85
                ? {
                    ...it,
                    progress: (it.progress ?? 0) + Math.random() * 5 + 2,
                  }
                : it,
            ),
          );
        }, 350);

        const classifyRes = await classifyClothing(base64, mediaType);
        if (!classifyRes.success || !classifyRes.data)
          throw new Error(classifyRes.error || "Classification failed");
        const pieces = classifyRes.data as ClothingPiece[];

        const primaryCount = pieces.filter(
          (p) => !["accessory"].includes((p.category || "").toLowerCase()),
        ).length;
        let previews: string[] | null = null;
        if (primaryCount > 1) {
          previews = await Promise.all(
            pieces.map((piece) =>
              cropImageForCategory(previewDataURL, piece.category || ""),
            ),
          );
        }

        clearInterval(timer);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: "ready",
                  progress: 100,
                  pieces,
                  piecePreviews: previews,
                }
              : it,
          ),
        );
      } catch (err) {
        if (timer) clearInterval(timer);
        const message = err instanceof Error ? err.message : String(err);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "error", error: message } : it,
          ),
        );
      }
    }
  };

  const saveFullOutfit = async (item: UploadItem) => {
    const firstName =
      item.pieces?.map((p) => p.name).join(" + ") ||
      item.fileName?.replace(/\.[^.]+$/, "") ||
      "Full Outfit";
    const primaryPieces = (item.pieces || []).filter(
      (p) => !["accessory"].includes((p.category || "").toLowerCase()),
    );
    const derivedCategory =
      primaryPieces.length === 1
        ? (primaryPieces[0].category || "outfit").toLowerCase()
        : "outfit";

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, savingFull: true } : it)),
    );

    try {
      let uploadedUrl = item.uploadedUrl;
      let storagePath = item.uploadedStoragePath;

      if (!uploadedUrl && item.previewUrl) {
        const res = await fetch(item.previewUrl);
        const blob = await res.blob();
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const f = new File([blob], `outfit-${item.id}.${ext}`, {
          type: blob.type,
        });
        const uploadRes = await uploadImage(f);
        if (uploadRes.success && uploadRes.data) {
          uploadedUrl = (uploadRes.data as { url: string; path: string }).url;
          storagePath = (uploadRes.data as { url: string; path: string }).path;
        }
      }
      if (!uploadedUrl || !storagePath) throw new Error("Image upload failed");

      const firstPiece = item.pieces?.[0] || {};
      const saved = await createWardrobeItem({
        name: firstName,
        category: derivedCategory,
        imageUrl: uploadedUrl,
        storagePath,
        colors:
          (firstPiece as ClothingPiece).colors ||
          ((firstPiece as ClothingPiece).colorHex
            ? [(firstPiece as ClothingPiece).colorHex!]
            : []),
        colorNames:
          (firstPiece as ClothingPiece).colorNames ||
          ((firstPiece as ClothingPiece).colorName
            ? [(firstPiece as ClothingPiece).colorName!]
            : []),
        pattern: (firstPiece as ClothingPiece).pattern || null,
        fabric: (firstPiece as ClothingPiece).fabric || null,
        fit: (firstPiece as ClothingPiece).fit || null,
        formality:
          typeof (firstPiece as ClothingPiece).formality === "number"
            ? ((firstPiece as ClothingPiece).formality as number)
            : 5,
        season: Array.isArray((firstPiece as ClothingPiece).season)
          ? ((firstPiece as ClothingPiece).season as string[])
          : (firstPiece as ClothingPiece).season
            ? [(firstPiece as ClothingPiece).season as string]
            : [],
        occasion: Array.isArray((firstPiece as ClothingPiece).occasion)
          ? ((firstPiece as ClothingPiece).occasion as string[])
          : [],
        stylistNote:
          (firstPiece as ClothingPiece).note ||
          (firstPiece as ClothingPiece).stylistNote ||
          null,
        tags: (firstPiece as ClothingPiece).tags || [],
      });
      if (!saved.success)
        throw new Error(saved.error || "Failed to save outfit");

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, intent: "full_outfit", savingFull: false }
            : it,
        ),
      );
      onSaveItem({ name: firstName, imageUrl: uploadedUrl });
    } catch (err) {
      console.error("[saveFullOutfit]", err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, savingFull: false } : it,
        ),
      );
    }
  };

  const savePiece = async (
    item: UploadItem,
    piece: ClothingPiece,
    pieceIdx: number,
  ): Promise<string | null> => {
    const pieceId = `${item.id}-piece-${pieceIdx}`;
    if ((item.savedPieceIds || []).includes(pieceId)) {
      return item.savedPieceWardrobeIds?.[pieceIdx] || null;
    }
    const primaryPieces = (item.pieces || []).filter(
      (p) => !["accessory"].includes((p.category || "").toLowerCase()),
    );
    const isSoloPiece = primaryPieces.length <= 1;

    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? { ...it, savingPieceIds: [...(it.savingPieceIds || []), pieceId] }
          : it,
      ),
    );

    try {
      let uploadedUrl: string | null = null;
      let storagePath: string | null = null;

      if (isSoloPiece && item.uploadedUrl) {
        uploadedUrl = item.uploadedUrl;
        storagePath = item.uploadedStoragePath ?? null;
      } else {
        const previewSrc =
          !isSoloPiece && item.previewUrl
            ? await cropImageForCategory(item.previewUrl, piece.category || "")
            : item.previewUrl;
        const dataUrl = previewSrc || item.previewUrl;
        if (dataUrl) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const ext = blob.type === "image/png" ? "png" : "jpg";
          const f = new File([blob], `piece-${pieceId}.${ext}`, {
            type: blob.type,
          });
          const uploadRes = await uploadImage(f);
          if (uploadRes.success && uploadRes.data) {
            uploadedUrl = (uploadRes.data as { url: string; path: string }).url;
            storagePath = (uploadRes.data as { url: string; path: string })
              .path;
          }
        }
      }
      if (!uploadedUrl || !storagePath) throw new Error("Image upload failed");

      const saved = await createWardrobeItem({
        name: piece.name || `${piece.category} piece`,
        category: (piece.category || "outfit").toLowerCase(),
        imageUrl: uploadedUrl,
        storagePath,
        colors: piece.colors || (piece.colorHex ? [piece.colorHex] : []),
        colorNames:
          piece.colorNames || (piece.colorName ? [piece.colorName] : []),
        pattern: piece.pattern || null,
        fabric: piece.fabric || null,
        fit: piece.fit || null,
        formality: typeof piece.formality === "number" ? piece.formality : 5,
        season: Array.isArray(piece.season)
          ? piece.season
          : piece.season
            ? [piece.season]
            : [],
        occasion: Array.isArray(piece.occasion) ? piece.occasion : [],
        stylistNote: piece.note || piece.stylistNote || null,
        tags:
          piece.tags ||
          (piece.pairsWith ? piece.pairsWith.map((p) => `pairs:${p}`) : []),
      });
      if (!saved.success || !saved.data)
        throw new Error(saved.error || "Failed to save piece");

      const wardrobeId = String((saved.data as { id: string | number }).id);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                savedPieceIds: [...(it.savedPieceIds || []), pieceId],
                savedPieceWardrobeIds: {
                  ...(it.savedPieceWardrobeIds || {}),
                  [pieceIdx]: wardrobeId,
                },
                savingPieceIds: (it.savingPieceIds || []).filter(
                  (sid) => sid !== pieceId,
                ),
              }
            : it,
        ),
      );
      onSaveItem({ name: piece.name || "piece", imageUrl: uploadedUrl });
      return wardrobeId;
    } catch (err) {
      console.error("[savePiece]", err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                savingPieceIds: (it.savingPieceIds || []).filter(
                  (sid) => sid !== pieceId,
                ),
              }
            : it,
        ),
      );
      return null;
    }
  };

  const saveAsOutfit = async (item: UploadItem) => {
    if ((item.pieces || []).length < 2) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, savingOutfit: true } : it,
      ),
    );
    try {
      let currentItem = item;
      const wardrobeIds: string[] = [];
      for (let idx = 0; idx < (item.pieces || []).length; idx++) {
        const existingId = currentItem.savedPieceWardrobeIds?.[idx];
        if (existingId) {
          wardrobeIds.push(existingId);
          continue;
        }
        const wid = await savePiece(currentItem, item.pieces![idx], idx);
        // Re-read current state
        await new Promise<void>((resolve) =>
          setItems((prev) => {
            currentItem = prev.find((it) => it.id === item.id) || currentItem;
            resolve();
            return prev;
          }),
        );
        if (wid) wardrobeIds.push(wid);
      }
      if (wardrobeIds.length < 2)
        throw new Error("Need at least 2 saved pieces");

      const outfitRes = await createOutfit({ wardrobeItemIds: wardrobeIds });
      if (!outfitRes.success)
        throw new Error(outfitRes.error || "Failed to create outfit");

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, outfitSaved: true, savingOutfit: false }
            : it,
        ),
      );
    } catch (err) {
      console.error("[saveAsOutfit]", err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, savingOutfit: false } : it,
        ),
      );
    }
  };

  const setIntent = (id: number, intent: UploadItem["intent"]) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, intent } : it)),
    );
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="upload-page page">
      <div className="page-header fade-up">
        <p className="page-eyebrow">Build Your Wardrobe</p>
        <h1 className="page-title">Add Pieces</h1>
        <p className="page-count">
          Upload any photo — you choose how to save it
        </p>
      </div>

      <div className="upload-body">
        <UploadZone
          dragover={dragover}
          setDragover={setDragover}
          onFiles={processFiles}
        />

        {items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((item) => (
              <UploadItemCard
                key={item.id}
                item={item}
                onSaveFullOutfit={saveFullOutfit}
                onSavePiece={savePiece}
                onSaveAsOutfit={saveAsOutfit}
                onSetIntent={setIntent}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
