/**
 * Category inference from item name/type
 */

const VALID_CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "footwear",
  "bag",
  "accessory",
  "outfit",
] as const;

export function inferCategory(item: {
  name?: string;
  type?: string;
  category?: string;
}): string {
  const name = (item.name || "").toLowerCase();
  const type = (item.type || "").toLowerCase();
  const combined = `${name} ${type}`;

  if (/skirt|sarong/.test(combined)) return "bottom";
  if (/\bdress\b|gown|frock/.test(combined)) return "dress";
  if (/\bsaree\b|\bsari\b|lehenga|anarkali|\bkurta\b|salwar/.test(combined))
    return "dress";
  if (
    /top|blouse|shirt|\btee\b|crop|bodysuit|camisole|tank|sweater|knit|corset/.test(
      combined,
    )
  )
    return "top";
  if (/trouser|pant|jeans|shorts|palazzo/.test(combined)) return "bottom";
  if (/jacket|coat|blazer|cape|shawl|cardigan/.test(combined))
    return "outerwear";
  if (/shoe|heel|sneaker|boot|sandal|flat|loafer|mule/.test(combined))
    return "footwear";
  if (/bag|clutch|tote|purse|handbag|pouch/.test(combined)) return "bag";
  if (
    /necklace|bracelet|earring|ring|watch|sunglass|glasses|jewel|belt/.test(
      combined,
    )
  )
    return "accessory";

  return VALID_CATEGORIES.includes(item.category as any)
    ? item.category!
    : "outfit";
}

export function getHourGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
