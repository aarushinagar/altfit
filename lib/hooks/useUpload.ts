/**
 * useUpload Hook
 * Manages file uploads and provides upload methods
 */

"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { UploadResponse } from "@/types/api";

export interface UseUploadReturn {
  isLoading: boolean;
  progress: number;
  error: string | null;

  // Methods
  uploadImage: (file: File) => Promise<UploadResponse | null>;
  deleteImage: (path: string) => Promise<boolean>;
}

export function useUpload(): UseUploadReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsLoading(true);
      setProgress(0);
      setError(null);

      try {
        // Validate file
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          throw new Error("File size exceeds 10MB limit");
        }

        const validTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ];
        if (!validTypes.includes(file.type)) {
          throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
        }

        console.log(
          "[Upload Hook] Starting upload:",
          file.name,
          file.size,
          "bytes",
        );
        setProgress(10);

        const response = await apiClient.upload.uploadImage(file);

        setProgress(100);

        if (response.success && response.data) {
          console.log("[Upload Hook] Upload successful:", response.data.url);
          return response.data;
        } else {
          const errorMsg = response.error || "Upload failed";
          setError(errorMsg);
          console.error("[Upload Hook] Upload error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Upload Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    },
    [],
  );

  const deleteImage = useCallback(async (path: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[Upload Hook] Deleting image:", path);
      const response = await apiClient.upload.deleteImage(path);

      if (response.success) {
        console.log("[Upload Hook] Image deleted:", path);
        return true;
      } else {
        const errorMsg = response.error || "Delete failed";
        setError(errorMsg);
        console.error("[Upload Hook] Delete error:", errorMsg);
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      console.error("[Upload Hook] Error:", errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    progress,
    error,
    uploadImage,
    deleteImage,
  };
}
