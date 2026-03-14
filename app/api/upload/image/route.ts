/**
 * POST /api/upload/image
 *
 * Upload an image to Supabase Storage
 *
 * Request: multipart/form-data with 'file' field
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://...",
 *     "path": "wardrobe-images/user_id/...",
 *     "contentType": "image/jpeg",
 *     "size": 123456
 *   }
 * }
 */

import { NextRequest } from "next/server";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { uploadImage, generateUserStoragePath } from "@/lib/supabase";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { UploadResponse } from "@/types/api";

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    console.log("[Upload Image] Processing image upload");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.warn("[Upload Image] No file provided");
      return errorResponse("No file provided", 400);
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`[Upload Image] File too large: ${file.size} bytes`);
      return errorResponse("File size exceeds 5MB limit", 400);
    }

    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!validMimeTypes.includes(file.type)) {
      console.warn(`[Upload Image] Invalid file type: ${file.type}`);
      return errorResponse(
        "Invalid file type. Allowed: JPEG, PNG, WebP, GIF",
        400,
      );
    }

    console.log(
      `[Upload Image] Uploading file: ${file.name} (${file.size} bytes, ${file.type})`,
    );

    // Generate storage path
    const storagePath = generateUserStoragePath(userId, file.name);

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase
    const publicUrl = await uploadImage(buffer, storagePath, file.type);

    console.log(`[Upload Image] File uploaded successfully: ${publicUrl}`);

    return successResponse<UploadResponse>(
      {
        url: publicUrl,
        path: storagePath,
        contentType: file.type,
        size: file.size,
      },
      "File uploaded successfully",
      201,
    );
  } catch (error) {
    console.error("[Upload Image] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Upload failed",
      500,
    );
  }
}

/**
 * DELETE /api/upload/image
 *
 * Delete an image from Supabase Storage
 *
 * Request body:
 * {
 *   "path": "wardrobe-images/user_id/..."
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log("[Upload Delete] Processing image deletion");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json();
    const { path } = body;

    if (!path) {
      console.warn("[Upload Delete] No path provided");
      return errorResponse("No path provided", 400);
    }

    // Verify user owns this file (path contains userId)
    if (!path.includes(userId)) {
      console.warn(
        `[Upload Delete] User ${userId} tried to delete file not owned by them: ${path}`,
      );
      return errorResponse("Unauthorized", 403);
    }

    console.log(`[Upload Delete] Deleting file: ${path}`);

    // Delete from Supabase
    await import("@/lib/supabase").then(({ deleteImage }) => deleteImage(path));

    console.log(`[Upload Delete] File deleted successfully: ${path}`);

    return successResponse(
      { message: "File deleted successfully" },
      "File deleted",
      200,
    );
  } catch (error) {
    console.error("[Upload Delete] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Deletion failed",
      500,
    );
  }
}
