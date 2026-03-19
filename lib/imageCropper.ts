/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-side Image Cropper
 *
 * After Claude identifies clothing items with bounding boxes,
 * use this to precisely crop and scale the image.
 *
 * Runs ONLY on the server. Requires sharp.
 */

import sharp from 'sharp'

export interface BoundingBox {
  top: number    // percentage 0-100
  left: number   // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
}

// Category-specific validation rules — tuned for person-only images
const CATEGORY_RULES: Record<string, {
  maxAreaPercent: number  // max % of image area this item can occupy
  minAreaPercent: number  // min % of image area
}> = {
  ACCESSORY:   { maxAreaPercent: 20,  minAreaPercent: 0.1 },
  FOOTWEAR:    { maxAreaPercent: 35,  minAreaPercent: 1   },
  BAG:         { maxAreaPercent: 50,  minAreaPercent: 2   },
  TOP:         { maxAreaPercent: 70,  minAreaPercent: 5   },
  BOTTOM:      { maxAreaPercent: 70,  minAreaPercent: 5   },
  DRESS:       { maxAreaPercent: 100, minAreaPercent: 15  },
  OUTERWEAR:   { maxAreaPercent: 90,  minAreaPercent: 8   },
  FULL_OUTFIT: { maxAreaPercent: 100, minAreaPercent: 20  },
}

// Smart fallback crops — relative to person-only image (background already removed)
const FALLBACK_CROPS: Record<string, BoundingBox> = {
  TOP:         { top: 5,  left: 5,  width: 90, height: 48 },
  BOTTOM:      { top: 47, left: 5,  width: 90, height: 50 },
  DRESS:       { top: 2,  left: 2,  width: 96, height: 96 },
  FULL_OUTFIT: { top: 0,  left: 0,  width: 100, height: 100 },
  OUTERWEAR:   { top: 2,  left: 2,  width: 96, height: 72 },
  FOOTWEAR:    { top: 55, left: 5,  width: 90, height: 45 },
  BAG:         { top: 38, left: 45, width: 52, height: 42 },
  ACCESSORY:   { top: 2,  left: 20, width: 60, height: 28 },
}

// Output sizes per category (w x h)
const OUTPUT_SIZES: Record<string, { w: number; h: number }> = {
  ACCESSORY:   { w: 400, h: 400 },
  FOOTWEAR:    { w: 500, h: 400 },
  BAG:         { w: 500, h: 500 },
  TOP:         { w: 500, h: 600 },
  BOTTOM:      { w: 500, h: 600 },
  DRESS:       { w: 500, h: 750 },
  OUTERWEAR:   { w: 500, h: 650 },
  FULL_OUTFIT: { w: 500, h: 750 },
}

// Padding in pixels added around each category's crop
const PADDING_PX: Record<string, number> = {
  ACCESSORY:   15,
  FOOTWEAR:    20,
  BAG:         15,
  TOP:         10,
  BOTTOM:      10,
  DRESS:       8,
  OUTERWEAR:   10,
  FULL_OUTFIT: 5,
}

function validateBoundingBox(
  box: any,
  category: string,
): { valid: boolean; reason?: string } {
  if (!box) return { valid: false, reason: 'null box' }

  const { top, left, width, height } = box

  if (
    typeof top !== 'number' ||
    typeof left !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return { valid: false, reason: 'non-numeric values' }
  }
  if (top < 0 || left < 0 || width <= 0 || height <= 0) {
    return { valid: false, reason: 'negative or zero values' }
  }
  if (top + height > 105 || left + width > 105) {
    return { valid: false, reason: 'exceeds image bounds' }
  }
  if (width < 2 || height < 2) {
    return { valid: false, reason: 'too small' }
  }

  const rules = CATEGORY_RULES[category.toUpperCase()]
  if (rules) {
    const areaPercent = (width * height) / 100
    if (areaPercent > rules.maxAreaPercent) {
      return {
        valid: false,
        reason: `area ${areaPercent.toFixed(1)}% exceeds max ${rules.maxAreaPercent}% for ${category}`,
      }
    }
    if (areaPercent < rules.minAreaPercent) {
      return {
        valid: false,
        reason: `area ${areaPercent.toFixed(1)}% below min ${rules.minAreaPercent}% for ${category}`,
      }
    }
  }

  return { valid: true }
}

function boxToPixels(
  box: BoundingBox,
  category: string,
  imgWidth: number,
  imgHeight: number,
): { left: number; top: number; width: number; height: number } {
  const pad = PADDING_PX[category.toUpperCase()] ?? 10

  const pxLeft   = Math.round((box.left   / 100) * imgWidth)
  const pxTop    = Math.round((box.top    / 100) * imgHeight)
  const pxWidth  = Math.round((box.width  / 100) * imgWidth)
  const pxHeight = Math.round((box.height / 100) * imgHeight)

  const left   = Math.max(0, pxLeft - pad)
  const top    = Math.max(0, pxTop  - pad)
  const right  = Math.min(imgWidth,  pxLeft + pxWidth  + pad)
  const bottom = Math.min(imgHeight, pxTop  + pxHeight + pad)

  return { left, top, width: right - left, height: bottom - top }
}

export function isValidPersonBox(box: any): box is BoundingBox {
  return (
    box != null &&
    typeof box.top === 'number' &&
    typeof box.left === 'number' &&
    typeof box.width === 'number' &&
    typeof box.height === 'number' &&
    box.width > 5 &&
    box.height > 10 &&
    box.top >= 0 &&
    box.left >= 0 &&
    box.top + box.height <= 110 &&
    box.left + box.width <= 110
  )
}

export async function cropToPersonOnly(
  imageBuffer: Buffer,
  personBox: BoundingBox,
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const imgW = meta.width!
  const imgH = meta.height!

  const padX = Math.round((8 / 100) * imgW)
  const padY = Math.round((3 / 100) * imgH)

  const left   = Math.max(0, Math.round((personBox.left / 100) * imgW) - padX)
  const top    = Math.max(0, Math.round((personBox.top  / 100) * imgH) - padY)
  const right  = Math.min(imgW, Math.round(((personBox.left + personBox.width)  / 100) * imgW) + padX)
  const bottom = Math.min(imgH, Math.round(((personBox.top  + personBox.height) / 100) * imgH) + padY)

  return sharp(imageBuffer)
    .extract({ left, top, width: right - left, height: bottom - top })
    .toBuffer()
}

export async function cropItemFromImage(
  imageBuffer: Buffer,
  boundingBox: BoundingBox | null | undefined,
  category: string,
  itemName: string = '',
  confidence: number = 1.0,
  personDetected: boolean = true,
): Promise<Buffer> {
  const cat = (category ?? 'TOP').toUpperCase()

  try {
    // If no person detected → it's a product photo, return full image resized only
    if (!personDetected) {
      console.log('[Cropper] Product photo (no person detected) — returning full image resized')
      return await sharp(imageBuffer)
        .resize(600, 750, {
          fit: 'contain',
          background: { r: 248, g: 246, b: 242, alpha: 1 },
        })
        .jpeg({ quality: 90 })
        .toBuffer()
    }

    const isAccessory = cat === 'ACCESSORY'
    const lowConfidence = (confidence ?? 0) < 0.8

    if (isAccessory && (lowConfidence || !boundingBox)) {
      console.log('[Cropper] Accessory low confidence — using full person image')
      return await sharp(imageBuffer)
        .resize(600, 800, {
          fit: 'contain',
          background: { r: 248, g: 246, b: 242, alpha: 1 },
        })
        .jpeg({ quality: 90 })
        .toBuffer()
    }

    const metadata = await sharp(imageBuffer).metadata()
    const imgWidth  = metadata.width  ?? 800
    const imgHeight = metadata.height ?? 1000

    const validation = validateBoundingBox(boundingBox, cat)

    let cropPixels: { left: number; top: number; width: number; height: number }
    let validBox = validation.valid && boundingBox

    // For FOOTWEAR specifically, reject bounding box if it's too low (foot position shifted too far down)
    if (cat === 'FOOTWEAR' && boundingBox && boundingBox.top > 70) {
      console.log('[Cropper] Footwear bbox too low — using fallback')
      validBox = false
    }

    if (validBox && boundingBox) {
      console.log(`[Cropper] ✅ Using Claude bbox for ${itemName} (${cat}):`, boundingBox)
      cropPixels = boxToPixels(boundingBox, cat, imgWidth, imgHeight)
    } else {
      console.log(`[Cropper] ⚠️ Invalid bbox for ${itemName} (${cat}): ${validation.reason} — using fallback`)
      const fallback = FALLBACK_CROPS[cat] ?? FALLBACK_CROPS.FULL_OUTFIT
      cropPixels = boxToPixels(fallback, cat, imgWidth, imgHeight)
    }

    // Enforce minimum crop size
    const minPx = 120
    if (cropPixels.width < minPx || cropPixels.height < minPx) {
      cropPixels.width  = Math.max(cropPixels.width,  minPx)
      cropPixels.height = Math.max(cropPixels.height, minPx)
      cropPixels.left   = Math.max(0, Math.min(cropPixels.left, imgWidth  - cropPixels.width))
      cropPixels.top    = Math.max(0, Math.min(cropPixels.top,  imgHeight - cropPixels.height))
    }

    console.log(`[Cropper] Extracting px:`, cropPixels, `from ${imgWidth}x${imgHeight} image`)

    const outSize = OUTPUT_SIZES[cat] ?? { w: 500, h: 600 }

    return await sharp(imageBuffer)
      .extract(cropPixels)
      .resize(outSize.w, outSize.h, {
        fit: 'contain',
        background: { r: 248, g: 246, b: 242, alpha: 1 },
      })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer()

  } catch (err: any) {
    console.error(`[Cropper] ❌ Failed for ${itemName}:`, err.message)

    // Ultimate fallback — return resized original
    try {
      return await sharp(imageBuffer)
        .resize(500, 600, {
          fit: 'contain',
          background: { r: 248, g: 246, b: 242, alpha: 1 },
        })
        .jpeg({ quality: 85 })
        .toBuffer()
    } catch {
      return imageBuffer
    }
  }
}

/**
 * Smart crop by category — applies fixed percentage regions on a person-only buffer.
 * No Claude bounding boxes needed. Each category covers the region where that
 * item type typically appears on the body.
 */
export async function smartCropByCategory(
  imageBuffer: Buffer,
  category: string,
): Promise<Buffer> {
  try {
    const meta = await sharp(imageBuffer).metadata()
    const w = meta.width!
    const h = meta.height!

    const cat = (category ?? 'FULL_OUTFIT').toUpperCase()

    // Percentage-based regions — where each item type lives on a person
    const regions: Record<string, { top: number; left: number; width: number; height: number }> = {
      TOP: {
        top:    Math.round(h * 0.12),
        left:   Math.round(w * 0.05),
        width:  Math.round(w * 0.90),
        height: Math.round(h * 0.40),
      },
      BOTTOM: {
        top:    Math.round(h * 0.45),
        left:   Math.round(w * 0.05),
        width:  Math.round(w * 0.90),
        height: Math.round(h * 0.50),
      },
      DRESS: {
        top:    Math.round(h * 0.08),
        left:   Math.round(w * 0.03),
        width:  Math.round(w * 0.94),
        height: Math.round(h * 0.88),
      },
      FULL_OUTFIT: {
        top:    0,
        left:   0,
        width:  w,
        height: h,
      },
      OUTERWEAR: {
        top:    Math.round(h * 0.08),
        left:   Math.round(w * 0.03),
        width:  Math.round(w * 0.94),
        height: Math.round(h * 0.65),
      },
      FOOTWEAR: {
        top:    Math.round(h * 0.68),
        left:   Math.round(w * 0.05),
        width:  Math.round(w * 0.90),
        height: Math.round(h * 0.30),
      },
      BAG: {
        top:    Math.round(h * 0.30),
        left:   Math.round(w * 0.30),
        width:  Math.round(w * 0.65),
        height: Math.round(h * 0.45),
      },
    }

    const region = regions[cat] ?? regions.FULL_OUTFIT

    // Clamp to image bounds
    const left   = Math.max(0, Math.min(region.left,   w - 10))
    const top    = Math.max(0, Math.min(region.top,    h - 10))
    const width  = Math.min(region.width,  w - left)
    const height = Math.min(region.height, h - top)

    console.log(`[Cropper] smartCrop ${cat}: extract ${left},${top} ${width}x${height} from ${w}x${h}`)

    return await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .resize(600, 750, {
        fit: 'contain',
        background: { r: 248, g: 246, b: 242, alpha: 1 },
      })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch (err: any) {
    console.error('[Cropper] smartCropByCategory failed:', err.message)
    // Fallback — return full image resized
    return sharp(imageBuffer)
      .resize(600, 750, {
        fit: 'contain',
        background: { r: 248, g: 246, b: 242, alpha: 1 },
      })
      .jpeg({ quality: 90 })
      .toBuffer()
  }
}

/**
 * Precision crop — uses Claude bounding box if valid, otherwise falls back
 * to category-specific region cuts on the person-only buffer.
 * Always produces a clean, tightly-framed product-style output.
 */
export async function precisionCrop(
  imageBuffer: Buffer,
  boundingBox: BoundingBox | null,
  category: string,
  confidence: number,
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const imgW = meta.width!
  const imgH = meta.height!
  const cat = (category ?? 'FULL_OUTFIT').toUpperCase()

  const isValidBox = (box: BoundingBox): boolean => {
    if (!box) return false
    if (box.width < 5 || box.height < 5) return false
    if (box.top < 0 || box.left < 0) return false
    if (box.top + box.height > 102) return false
    if (box.left + box.width > 102) return false
    if (confidence < 0.75) return false
    const area = box.width * box.height
    const maxArea: Record<string, number> = {
      TOP: 5000, BOTTOM: 5500, DRESS: 9000,
      FOOTWEAR: 2500, BAG: 3000, OUTERWEAR: 6000,
      FULL_OUTFIT: 10000,
    }
    if (area > (maxArea[cat] ?? 10000)) return false
    return true
  }

  let crop: { left: number; top: number; width: number; height: number }

  if (boundingBox && isValidBox(boundingBox)) {
    // Use Claude's bounding box with padding
    const pad = (cat === 'FOOTWEAR' || cat === 'BAG') ? 15 : 8
    const rawLeft   = (boundingBox.left   / 100) * imgW
    const rawTop    = (boundingBox.top    / 100) * imgH
    const rawWidth  = (boundingBox.width  / 100) * imgW
    const rawHeight = (boundingBox.height / 100) * imgH
    const padX = (pad / 100) * imgW
    const padY = (pad / 100) * imgH
    const left   = Math.max(0, Math.round(rawLeft - padX))
    const top    = Math.max(0, Math.round(rawTop  - padY))
    const right  = Math.min(imgW, Math.round(rawLeft + rawWidth  + padX))
    const bottom = Math.min(imgH, Math.round(rawTop  + rawHeight + padY))
    crop = { left, top, width: right - left, height: bottom - top }
    console.log(`[Crop] ✅ Using Claude bbox for ${category}:`, boundingBox)
  } else {
    // Smart fallback — fixed percentage regions of person-only image
    console.log(`[Crop] ⚠️ Using fallback for ${category}`)
    const fallbacks: Record<string, { left: number; top: number; width: number; height: number }> = {
      TOP:         { left: Math.round(imgW * 0.05), top: Math.round(imgH * 0.12), width: Math.round(imgW * 0.90), height: Math.round(imgH * 0.38) },
      BOTTOM:      { left: Math.round(imgW * 0.05), top: Math.round(imgH * 0.47), width: Math.round(imgW * 0.90), height: Math.round(imgH * 0.48) },
      DRESS:       { left: Math.round(imgW * 0.02), top: Math.round(imgH * 0.08), width: Math.round(imgW * 0.96), height: Math.round(imgH * 0.88) },
      OUTERWEAR:   { left: Math.round(imgW * 0.02), top: Math.round(imgH * 0.08), width: Math.round(imgW * 0.96), height: Math.round(imgH * 0.65) },
      FOOTWEAR:    { left: Math.round(imgW * 0.10), top: Math.round(imgH * 0.70), width: Math.round(imgW * 0.80), height: Math.round(imgH * 0.28) },
      BAG:         { left: Math.round(imgW * 0.35), top: Math.round(imgH * 0.35), width: Math.round(imgW * 0.60), height: Math.round(imgH * 0.40) },
      FULL_OUTFIT: { left: 0, top: 0, width: imgW, height: imgH },
    }
    crop = fallbacks[cat] ?? fallbacks.FULL_OUTFIT
    crop.left   = Math.max(0, Math.min(crop.left,   imgW - 50))
    crop.top    = Math.max(0, Math.min(crop.top,    imgH - 50))
    crop.width  = Math.min(crop.width,  imgW - crop.left)
    crop.height = Math.min(crop.height, imgH - crop.top)
  }

  // Enforce minimum dimensions
  if (crop.width < 50)  { crop.width  = Math.min(50, imgW - crop.left) }
  if (crop.height < 50) { crop.height = Math.min(50, imgH - crop.top)  }

  const outputSizes: Record<string, [number, number]> = {
    TOP: [500, 600], BOTTOM: [500, 650], DRESS: [500, 750],
    OUTERWEAR: [500, 700], FOOTWEAR: [500, 400],
    BAG: [500, 500], FULL_OUTFIT: [500, 750],
  }
  const [outW, outH] = outputSizes[cat] ?? [500, 650]

  return sharp(imageBuffer)
    .extract(crop)
    .resize(outW, outH, {
      fit: 'contain',
      background: { r: 248, g: 246, b: 242, alpha: 1 },
    })
    .jpeg({ quality: 92, progressive: true })
    .toBuffer()
}
