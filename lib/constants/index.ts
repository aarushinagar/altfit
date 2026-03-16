/**
 * Application-wide constants
 */

export const FREE_LIMIT = 100;

export const CATEGORIES = [
  "All",
  "Top",
  "Bottom",
  "Dress",
  "Outerwear",
  "Footwear",
  "Bag",
  "Accessory",
  "Outfit",
] as const;

export const SHUFFLE_VIBES = [
  "more polished and formal — elevate the look",
  "more relaxed and casual — ease off the formality",
  "bolder color choices — make a statement",
  "minimal and monochromatic — quiet luxury",
  "contrast-forward — mix light and dark dramatically",
] as const;

export const STYLE_TAGS = [
  "Minimal",
  "Classic",
  "Streetwear",
  "Bohemian",
  "Preppy",
  "Avant-Garde",
  "Romantic",
  "Edgy",
  "Athleisure",
  "Maximalist",
  "Business Casual",
  "Cottagecore",
  "Dark Academia",
  "Y2K",
  "Old Money",
] as const;

export const STYLE_ISSUES = [
  {
    id: "nothing-to-wear",
    label: "I have a full wardrobe and nothing to wear",
    desc: "Too many pieces, zero outfits",
  },
  {
    id: "repeat-outfits",
    label: "I wear the same 5 things on repeat",
    desc: "The rest just hangs there",
  },
  {
    id: "impulse-buying",
    label: "I keep buying things that don't go with anything",
    desc: "Always shopping, never satisfied",
  },
  {
    id: "no-identity",
    label: "I don't know what my style actually is",
    desc: "I dress differently every week",
  },
  {
    id: "occasions",
    label: "I never know what to wear for specific occasions",
    desc: "Events, meetings, dates — always a panic",
  },
  {
    id: "trends",
    label: "I chase trends and regret it",
    desc: "My wardrobe is a graveyard of mistakes",
  },
  {
    id: "time",
    label: "Getting dressed takes too long",
    desc: "I need a system, not another scroll",
  },
] as const;

/** Map UI style tags to backend enum values */
export const VALID_BACKEND_STYLES = [
  "minimalist",
  "classic",
  "bohemian",
  "streetwear",
  "preppy",
  "romantic",
  "edgy",
  "athleisure",
  "business-casual",
  "eclectic",
] as const;

export function mapStyleTagToBackend(tag: string): string {
  const lower = (tag || "").toLowerCase().trim();
  if (lower.includes("minimal")) return "minimalist";
  if (lower.includes("business") || lower === "business casual")
    return "business-casual";
  if (lower.includes("street")) return "streetwear";
  if (lower.includes("bohemian")) return "bohemian";
  if (lower.includes("preppy")) return "preppy";
  if (lower.includes("romantic")) return "romantic";
  if (lower.includes("edgy")) return "edgy";
  if (lower.includes("athleisure")) return "athleisure";
  if (
    lower.includes("eclectic") ||
    lower.includes("avant") ||
    lower.includes("maximalist") ||
    lower.includes("cottage") ||
    lower.includes("academia") ||
    lower.includes("y2k") ||
    lower.includes("old money")
  )
    return "eclectic";
  const sanitized = lower.replace(/\s+/g, "-");
  return VALID_BACKEND_STYLES.includes(sanitized as any)
    ? sanitized
    : "classic";
}
