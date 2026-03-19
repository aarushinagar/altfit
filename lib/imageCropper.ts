/* eslint-disable @typescript-eslint/no-explicit-any */
import sharp from 'sharp'
import { validateAndRefineCrop } from './cropValidator'

export interface BoundingBox {
  top: number    // percentage 0-100
  left: number   // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
}

// Smart fallback regions — calibrated for person-only images
// These are where each item type TYPICALLY lives on a centered person
const FALLBACK_REGIONS: Record<string, BoundingBox> = {
  TOP:         { top: 18, left: 8,  width: 84, height: 32 },
  BOTTOM:      { top: 50, left: 8,  width: 84, height: 46 },
  DRESS:       { top: 14, left: 4,  width: 92, height: 83 },
  OUTERWEAR:   { top: 10, left: 3,  width: 94, height: 62 },
  FOOTWEAR:    { top: 70, left: 12, width: 76, height: 28 },
  BAG:         { top: 34, left: 32, width: 62, height: 42 },
  FULL_OUTFIT: { top: 0,  left: 0,  width: 100, height: 100 },
}

const OUTPUT_SIZES: Record<string, [number, number]> = {
  TOP:         [500, 580],
  BOTTOM:      [500, 650],
  DRESS:       [500, 780],
  OUTERWEAR:   [500, 700],
  FOOTWEAR:    [520, 420],
  BAG:         [520, 520],
  FULL_OUTFIT: [500, 750],
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
  const W = meta.width!, H = meta.height!
  const px = 6, py = 2 // padding %

  const left   = Math.max(0, Math.round((personBox.left / 100) * W) - Math.round((px / 100) * W))
  const top    = Math.max(0, Math.round((personBox.top  / 100) * H) - Math.round((py / 100) * H))
  const right  = Math.min(W, Math.round(((personBox.left + personBox.width)  / 100) * W) + Math.round((px / 100) * W))
  const bottom = Math.min(H, Math.round(((personBox.top  + personBox.height) / 100) * H) + Math.round((py / 100) * H))

  return sharp(imageBuffer)
    .extract({ left, top, width: right - left, height: bottom - top })
    .toBuffer()
}

export async function precisionCropItem(
  personBuffer: Buffer,
  boundingBox: BoundingBox | null | undefined,
  category: string,
  confidence: number = 1.0,
): Promise<Buffer> {
  const cat = (category ?? 'FULL_OUTFIT').toUpperCase()
  const [outW, outH] = OUTPUT_SIZES[cat] ?? [500, 650]

  try {
    const meta = await sharp(personBuffer).metadata()
    const imgW = meta.width!, imgH = meta.height!

    let cropPx: { left: number; top: number; width: number; height: number }
    let source = 'FALLBACK'

    if (boundingBox) {
      const validation = await validateAndRefineCrop(
        boundingBox, cat, confidence, imgW, imgH
      )

      if (validation.valid) {
        const finalBox = validation.adjustedBox ?? boundingBox
        source = 'CLAUDE'
        console.log(`[Crop] ✅ Claude bbox for ${cat} (${confidence.toFixed(2)}):`, finalBox)
        console.log(`[Crop] Reason: ${validation.reason}`)

        const padPct = cat === 'FOOTWEAR' || cat === 'BAG' ? 16 : 7
        const padX = Math.round((padPct / 100) * imgW)
        const padY = Math.round((padPct / 100) * imgH)

        const x1 = Math.max(0, Math.round((finalBox.left / 100) * imgW) - padX)
        const y1 = Math.max(0, Math.round((finalBox.top  / 100) * imgH) - padY)
        const x2 = Math.min(imgW, Math.round(((finalBox.left + finalBox.width)  / 100) * imgW) + padX)
        const y2 = Math.min(imgH, Math.round(((finalBox.top  + finalBox.height) / 100) * imgH) + padY)

        cropPx = { left: x1, top: y1, width: x2 - x1, height: y2 - y1 }
      } else {
        console.log(`[Crop] ⚠️ Claude bbox rejected for ${cat}: ${validation.reason}`)
        const region = FALLBACK_REGIONS[cat] ?? FALLBACK_REGIONS.FULL_OUTFIT
        cropPx = {
          left:   Math.round((region.left   / 100) * imgW),
          top:    Math.round((region.top    / 100) * imgH),
          width:  Math.round((region.width  / 100) * imgW),
          height: Math.round((region.height / 100) * imgH),
        }
      }
    } else {
      console.log(`[Crop] No bbox for ${cat} — using calibrated region`)
      const region = FALLBACK_REGIONS[cat] ?? FALLBACK_REGIONS.FULL_OUTFIT
      cropPx = {
        left:   Math.round((region.left   / 100) * imgW),
        top:    Math.round((region.top    / 100) * imgH),
        width:  Math.round((region.width  / 100) * imgW),
        height: Math.round((region.height / 100) * imgH),
      }
    }

    // Clamp and enforce minimums
    cropPx.left   = Math.max(0, Math.min(cropPx.left, imgW - 50))
    cropPx.top    = Math.max(0, Math.min(cropPx.top,  imgH - 50))
    cropPx.width  = Math.min(Math.max(cropPx.width,  80), imgW - cropPx.left)
    cropPx.height = Math.min(Math.max(cropPx.height, 80), imgH - cropPx.top)

    console.log(`[Crop] ${source} | ${cat} | px:`, cropPx, `| from ${imgW}x${imgH}`)

    return await sharp(personBuffer)
      .extract(cropPx)
      .resize(outW, outH, {
        fit: 'contain',
        background: { r: 248, g: 246, b: 242, alpha: 1 },
        withoutEnlargement: false,
      })
      .jpeg({ quality: 94, progressive: true, mozjpeg: true })
      .toBuffer()

  } catch (err: any) {
    console.error(`[Crop] ❌ ${cat}:`, err.message)
    return sharp(personBuffer)
      .resize(outW, outH, {
        fit: 'contain',
        background: { r: 248, g: 246, b: 242, alpha: 1 },
      })
      .jpeg({ quality: 88 })
      .toBuffer()
  }
}

export async function resizeProductPhoto(
  imageBuffer: Buffer,
  category: string,
): Promise<Buffer> {
  const cat = (category ?? 'FULL_OUTFIT').toUpperCase()
  const [outW, outH] = OUTPUT_SIZES[cat] ?? [500, 650]

  return sharp(imageBuffer)
    .resize(outW, outH, {
      fit: 'contain',
      background: { r: 248, g: 246, b: 242, alpha: 1 },
      withoutEnlargement: false,
    })
    .jpeg({ quality: 94, progressive: true, mozjpeg: true })
    .toBuffer()
}

