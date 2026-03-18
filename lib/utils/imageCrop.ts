/**
 * imageCrop.ts — Client-side canvas cropping utility.
 *
 * After Claude vision identifies individual clothing pieces from a full outfit
 * photo and returns their bounding boxes, this module is used to:
 *  1. Load the original image into an offscreen <canvas>
 *  2. Compute a padded, square crop region for each piece
 *  3. Return a JPEG File ready for upload to Supabase storage
 *
 * No third-party libraries — pure Canvas API only.
 */

export interface BoundingBox {
    top: number;    // percentage 0–100 of image height from top
    left: number;   // percentage 0–100 of image width from left
    width: number;  // percentage 0–100 of image width
    height: number; // percentage 0–100 of image height
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Minimum crop dimension in pixels before padding is applied. */
const MIN_CROP_PX = 200;

/** Output size for all cropped images (square). */
const OUTPUT_SIZE = 600;

/** Default padding fraction for most item categories. */
const DEFAULT_PADDING = 0.10;

/** Larger padding for accessories — they tend to be small in the frame. */
const ACCESSORY_PADDING = 0.20;

/** Neutral linen background used when padding exceeds image boundaries. */
const BG_COLOR = "#f5f2ee";

// ── Subcategory helpers ────────────────────────────────────────────────────

/** Small accessories typically located in the upper portion of a body shot. */
const TOP_ACCESSORY_SUBS = [
    "earring", "earrings", "necklace", "necklaces", "choker",
    "ring", "rings", "bracelet", "bracelets", "watch",
    "brooch", "pin", "hair", "hairpin", "barrette", "headband",
    "hat", "cap", "beret", "scarf", "sunglasses", "glasses",
];

/** Accessories typically located in the lower / mid portion of a body shot. */
const BOTTOM_ACCESSORY_SUBS = [
    "bag", "handbag", "purse", "clutch", "tote", "backpack", "satchel",
    "belt", "shoe", "shoes", "sneaker", "sneakers", "boot", "boots",
    "sandal", "sandals", "loafer", "loafers", "heel", "heels", "mule", "mules",
];

// ── Quadrant fallback ──────────────────────────────────────────────────────

/**
 * Returns a best-guess bounding box based on category + subcategory when
 * Claude did not return a confident bounding box.
 */
function getQuadrantBox(category: string, subcategory: string): BoundingBox {
    const sub = subcategory.toLowerCase();

    switch (category) {
        case "top":
            return { top: 5, left: 5, width: 90, height: 48 };

        case "bottom":
            return { top: 48, left: 5, width: 90, height: 50 };

        case "footwear":
            return { top: 70, left: 10, width: 80, height: 28 };

        case "outerwear":
            return { top: 5, left: 8, width: 84, height: 75 };

        case "full_outfit":
            // Center 80%
            return { top: 10, left: 10, width: 80, height: 80 };

        case "accessory": {
            if (TOP_ACCESSORY_SUBS.some((s) => sub.includes(s))) {
                // Neck-and-above accessories: top 28% centred
                return { top: 0, left: 20, width: 60, height: 28 };
            }
            if (BOTTOM_ACCESSORY_SUBS.some((s) => sub.includes(s))) {
                // Bags and shoes: lower 35%
                return { top: 65, left: 10, width: 80, height: 33 };
            }
            // Generic accessory: upper-middle third
            return { top: 5, left: 25, width: 50, height: 35 };
        }

        default:
            return { top: 10, left: 10, width: 80, height: 80 };
    }
}

// ── Image loading ──────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image for cropping"));
        };
        img.src = url;
    });
}

// ── Core crop function ─────────────────────────────────────────────────────

/**
 * Crops `file` to focus on the clothing item described by `boundingBox`
 * (or the estimated quadrant if `boundingBox` is null).
 *
 * The output is always a square JPEG at `OUTPUT_SIZE × OUTPUT_SIZE` px.
 *
 * @param file         The original full-image File
 * @param boundingBox  Bounding box from Claude vision (percentages), or null
 * @param category     e.g. "top", "bottom", "accessory"
 * @param subcategory  e.g. "t-shirt", "earring", "sneakers"
 */
export async function cropImageToPiece(
    file: File,
    boundingBox: BoundingBox | null,
    category: string,
    subcategory: string,
): Promise<File> {
    const img = await loadImage(file);
    const W = img.naturalWidth;
    const H = img.naturalHeight;

    // Choose bounding box source
    const bbox = boundingBox ?? getQuadrantBox(category, subcategory);

    // Padding factor — accessories get more breathing room
    const pad = category === "accessory" ? ACCESSORY_PADDING : DEFAULT_PADDING;

    // Convert percentages → pixels
    let cx = (bbox.left / 100) * W;
    let cy = (bbox.top / 100) * H;
    let cw = (bbox.width / 100) * W;
    let ch = (bbox.height / 100) * H;

    // Add padding on all sides
    const padX = cw * pad;
    const padY = ch * pad;
    cx = cx - padX;
    cy = cy - padY;
    cw = cw + padX * 2;
    ch = ch + padY * 2;

    // Enforce minimum crop size (expand from centroid if too small)
    if (cw < MIN_CROP_PX) {
        const expand = (MIN_CROP_PX - cw) / 2;
        cx -= expand;
        cw = MIN_CROP_PX;
    }
    if (ch < MIN_CROP_PX) {
        const expand = (MIN_CROP_PX - ch) / 2;
        cy -= expand;
        ch = MIN_CROP_PX;
    }

    // ── Square normalisation (1:1 aspect ratio) ───────────────────────────
    if (cw > ch) {
        // Wider than tall: expand height symmetrically around centroid
        const diff = cw - ch;
        cy -= diff / 2;
        ch = cw;
    } else if (ch > cw) {
        // Taller than wide: expand width symmetrically around centroid
        const diff = ch - cw;
        cx -= diff / 2;
        cw = ch;
    }

    // ── Clamp to image boundaries ─────────────────────────────────────────
    // After squaring, the region may exceed image bounds — clamp & re-centre.
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cx + cw > W) {
        cx = Math.max(0, W - cw);
        cw = Math.min(cw, W);
    }
    if (cy + ch > H) {
        cy = Math.max(0, H - ch);
        ch = Math.min(ch, H);
    }
    // Final square side = the smaller of the two clamped dimensions
    const side = Math.floor(Math.min(cw, ch));
    cx = Math.floor(cx);
    cy = Math.floor(cy);

    // ── Draw onto output canvas ───────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Neutral linen background (fills any padding that extends outside image)
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Draw the cropped region scaled to the full output square
    ctx.drawImage(img, cx, cy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    return new Promise<File>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Canvas.toBlob() returned null"));
                    return;
                }
                resolve(
                    new File(
                        [blob],
                        `crop_${category}_${subcategory.replace(/\s+/g, "_")}.jpg`,
                        { type: "image/jpeg" },
                    ),
                );
            },
            "image/jpeg",
            0.90,
        );
    });
}
