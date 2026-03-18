/**
 * Image Storage Engine — single authoritative place for all Supabase image ops.
 *
 * Accepts any input: File, Blob, Buffer, base64 data URL, or a remote https:// URL.
 * Always returns a permanent public CDN URL or throws — never returns empty string / null.
 *
 * Server-side only. Import only from API routes.
 *
 * DIAGNOSTIC FINDINGS (2026-03-18):
 *  - All existing items have imageUrl="" (empty string) from a pre-fix code version
 *    where Supabase uploads failed silently. Fix: use this engine for all new uploads.
 *  - SUPABASE_SERVICE_KEY is currently the anon key. Uploads will fail with RLS unless:
 *    a) The service_role key is set (Supabase Dashboard → Settings → API → service_role)
 *    b) OR the bucket has permissive INSERT/SELECT policies (see setup/supabase-storage-policies.sql)
 *  - The 'wardrobe-images' bucket must exist and be PUBLIC. Run scripts/setup-storage.ts once.
 *  - next.config.ts must whitelist *.supabase.co for next/image to load CDN URLs.
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "wardrobe-images";

function getClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        throw new Error(
            "[ImageStorage] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local\n" +
            "  Get the service_role key from: Supabase Dashboard → Settings → API → service_role",
        );
    }

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/**
 * Normalise any image source to a Buffer + contentType.
 */
async function toBuffer(
    source: File | Blob | Buffer | string,
): Promise<{ buffer: Buffer; contentType: string }> {
    // base64 data URL
    if (typeof source === "string" && source.startsWith("data:")) {
        const match = source.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new Error("[ImageStorage] Invalid base64 data URL");
        return {
            buffer: Buffer.from(match[2], "base64"),
            contentType: match[1],
        };
    }

    // Remote URL — fetch and buffer
    if (typeof source === "string" && source.startsWith("http")) {
        const res = await fetch(source);
        if (!res.ok) {
            throw new Error(
                `[ImageStorage] Failed to fetch remote image: HTTP ${res.status} from ${source}`,
            );
        }
        const blob = await res.blob();
        return {
            buffer: Buffer.from(await blob.arrayBuffer()),
            contentType: blob.type || "image/jpeg",
        };
    }

    // Node Buffer
    if (Buffer.isBuffer(source)) {
        return { buffer: source, contentType: "image/jpeg" };
    }

    // File or Blob (use duck typing to avoid 'File is not defined' in Node.js)
    if (source instanceof Blob) {
        return {
            buffer: Buffer.from(await (source as Blob).arrayBuffer()),
            contentType: (source as Blob).type || "image/jpeg",
        };
    }

    throw new Error("[ImageStorage] Unsupported image source type");
}

/**
 * Upload any image source to Supabase Storage.
 *
 * @param userId     Authenticated user ID (used to scope storage path)
 * @param itemId     Wardrobe item ID (used as filename, ensures uniqueness)
 * @param source     Image data: File | Blob | Buffer | base64 dataURL | https:// URL
 * @param ext        Optional file extension override (default: derived from contentType)
 * @returns          Permanent public CDN URL — always starts with https://
 */
export async function uploadWardrobeImage(
    userId: string,
    itemId: string,
    source: File | Blob | Buffer | string,
    ext?: string,
): Promise<string> {
    const supabase = getClient();
    const { buffer, contentType } = await toBuffer(source);

    const resolvedExt =
        ext ??
        contentType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ??
        "jpg";

    const storagePath = `users/${userId}/${itemId}.${resolvedExt}`;

    console.log(`[ImageStorage] Uploading ${buffer.byteLength} bytes → ${BUCKET}/${storagePath}`);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType,
            upsert: true,          // overwrite if exists (crop fixes, re-attaches)
            cacheControl: "31536000", // 1 year CDN cache
        });

    if (error) {
        const hint =
            error.message.includes("row-level security") ||
                error.message.includes("violates")
                ? " — RLS policy blocking upload. Run setup/supabase-storage-policies.sql or use the service_role key."
                : error.message.includes("not found") || error.message.includes("Bucket")
                    ? " — Bucket 'wardrobe-images' does not exist. Run: npm run setup:storage"
                    : "";
        throw new Error(`[ImageStorage] Upload failed: ${error.message}${hint}`);
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    if (!publicUrl || !publicUrl.startsWith("https://")) {
        throw new Error(
            `[ImageStorage] Unexpected public URL: "${publicUrl}". ` +
            "Check SUPABASE_URL in .env.local.",
        );
    }

    console.log(`[ImageStorage] ✅ Saved → ${publicUrl}`);
    return publicUrl;
}

/**
 * Build the Supabase Storage path for an item without uploading.
 * Used when you need to reference the path before the upload runs.
 */
export function wardrobeStoragePath(
    userId: string,
    itemId: string,
    ext = "webp",
): string {
    return `users/${userId}/${itemId}.${ext}`;
}

/**
 * Delete a wardrobe image from Supabase Storage.
 * Silently ignores missing files (idempotent).
 */
export async function deleteWardrobeImage(
    userId: string,
    itemId: string,
): Promise<void> {
    const supabase = getClient();
    const extensions = ["webp", "jpg", "jpeg", "png", "gif"];
    const paths = extensions.map((e) => wardrobeStoragePath(userId, itemId, e));

    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) {
        // Non-fatal — log but don't throw (item may not have had an image)
        console.warn(`[ImageStorage] Delete warning: ${error.message}`);
    }
}
