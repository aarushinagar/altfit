import type { BoundingBox } from './imageCropper'

interface ValidationResult {
  valid: boolean
  reason: string
  adjustedBox?: BoundingBox
}

export async function validateAndRefineCrop(
  box: BoundingBox,
  category: string,
  confidence: number,
  imgW: number,
  imgH: number
): Promise<ValidationResult> {
  void imgW
  void imgH
  const cat = category.toUpperCase()

  // ── RULE 1: Confidence threshold per category
  const minConfidence: Record<string, number> = {
    TOP: 0.72, BOTTOM: 0.72, DRESS: 0.70,
    OUTERWEAR: 0.68, FOOTWEAR: 0.75, BAG: 0.70,
    FULL_OUTFIT: 0.60
  }
  if (confidence < (minConfidence[cat] ?? 0.70)) {
    return { valid: false, reason: `Confidence ${confidence} below threshold` }
  }

  // ── RULE 2: Box dimensions sanity
  if (box.width < 4 || box.height < 4) {
    return { valid: false, reason: 'Box too small' }
  }
  if (box.top + box.height > 103 || box.left + box.width > 103) {
    return { valid: false, reason: 'Box exceeds image bounds' }
  }

  // ── RULE 3: Area plausibility by category
  const area = box.width * box.height
  const areaRules: Record<string, [number, number]> = {
    TOP:         [200,  4500],
    BOTTOM:      [200,  5000],
    DRESS:       [1000, 9000],
    OUTERWEAR:   [500,  7000],
    FOOTWEAR:    [30,   2500],
    BAG:         [50,   3500],
    FULL_OUTFIT: [2000, 10000]
  }
  const [minArea, maxArea] = areaRules[cat] ?? [100, 10000]
  if (area < minArea) return { valid: false, reason: `Area ${area} too small` }
  if (area > maxArea) return { valid: false, reason: `Area ${area} too large` }

  // ── RULE 4: Face exclusion — push TOP/DRESS/OUTERWEAR boxes down if they start too high
  const faceExcludeCategories = ['TOP', 'DRESS', 'OUTERWEAR']
  if (faceExcludeCategories.includes(cat) && box.top < 12) {
    const pushDown = 14 - box.top
    const adjusted: BoundingBox = {
      top:    14,
      left:   box.left,
      width:  box.width,
      height: Math.max(box.height - pushDown, 20)
    }
    console.log(`[Validator] ${cat} box adjusted to exclude face`)
    return { valid: true, reason: 'Face excluded', adjustedBox: adjusted }
  }

  // ── RULE 5: Category position plausibility
  const expectedRegions: Record<string, { topMin: number; topMax: number }> = {
    TOP:       { topMin: 8,  topMax: 60 },
    BOTTOM:    { topMin: 35, topMax: 75 },
    DRESS:     { topMin: 8,  topMax: 40 },
    OUTERWEAR: { topMin: 5,  topMax: 55 },
    FOOTWEAR:  { topMin: 50, topMax: 95 },
    BAG:       { topMin: 20, topMax: 85 }
  }
  const region = expectedRegions[cat]
  if (region) {
    if (box.top < region.topMin || box.top > region.topMax) {
      return {
        valid: false,
        reason: `${cat} top ${box.top}% outside expected range ${region.topMin}-${region.topMax}%`
      }
    }
  }

  return { valid: true, reason: 'Passed all validation rules' }
}
