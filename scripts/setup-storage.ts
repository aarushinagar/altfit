/**
 * Supabase Storage Setup Script
 *
 * Run ONCE before using the app:
 *   npm run setup:storage
 *
 * This script:
 *   1. Creates the 'wardrobe-images' bucket (if it doesn't exist)
 *   2. Sets it to public (images accessible via CDN URL without auth)
 *   3. Reports its current status
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local.
 *
 * NOTE: If SUPABASE_SERVICE_KEY is the anon key (not service_role), this
 * script will fail. Get the service_role key from:
 *   Supabase Dashboard → Settings → API → service_role (secret)
 * Then set it as SUPABASE_SERVICE_KEY in .env.local.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const BUCKET = "wardrobe-images";

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error(
            "❌ Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local"
        );
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });

    console.log(`[setup] Connecting to ${supabaseUrl}...`);

    // 1. List existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error(
            "❌ Failed to list buckets — this usually means the key is not service_role:",
            listError.message
        );
        console.error(
            "  → Get the service_role key from: Supabase Dashboard → Settings → API → service_role"
        );
        process.exit(1);
    }

    const exists = buckets?.some((b: { name: string }) => b.name === BUCKET);

    if (exists) {
        // Ensure it's public
        const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024, // 10 MB
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
        });
        if (updateError) {
            console.error("❌ Failed to update bucket:", updateError.message);
            process.exit(1);
        }
        console.log(`✅ Bucket '${BUCKET}' already exists — updated to public.`);
    } else {
        // Create it
        const { error: createError } = await supabase.storage.createBucket(BUCKET, {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024, // 10 MB
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
        });
        if (createError) {
            console.error("❌ Failed to create bucket:", createError.message);
            process.exit(1);
        }
        console.log(`✅ Bucket '${BUCKET}' created successfully.`);
    }

    // 2. Test upload
    const testBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload("_test/ping.png", testBuffer, { upsert: true, contentType: "image/png" });

    if (uploadError) {
        console.error("❌ Test upload failed:", uploadError.message);
        console.error("  → If this is an RLS error, run setup/supabase-storage-policies.sql in the Supabase SQL Editor.");
        process.exit(1);
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl("_test/ping.png");
    console.log("✅ Test upload succeeded:", publicUrl);

    // 3. Cleanup test file
    await supabase.storage.from(BUCKET).remove(["_test/ping.png"]);

    console.log("\n✅ Storage setup complete. Your app is ready to store wardrobe images.");
    console.log(`   Bucket: ${BUCKET} (public)`);
    console.log(`   CDN:    ${supabaseUrl}/storage/v1/object/public/${BUCKET}/`);
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
