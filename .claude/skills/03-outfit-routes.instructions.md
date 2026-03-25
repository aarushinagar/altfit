---
applyTo: "app/api/outfits/**"
---

# ALTFit — Outfit API Routes

## Existing Routes

- `GET /api/outfits` — list outfits for user (includes OutfitItems + WardrobeItems)
- `POST /api/outfits` — create outfit with wardrobeItemIds
- `PATCH /api/outfits/[id]/worn` — mark outfit as worn

## POST /api/outfits — Ownership Verification

**Always verify every wardrobeItemId belongs to the requesting user before creating.**

```typescript
const items = await prisma.wardrobeItem.findMany({
  where: { id: { in: wardrobeItemIds }, userId },
});
if (items.length !== wardrobeItemIds.length) {
  return errorResponse("One or more items not found or not authorized", 403);
}
```

## Category → OutfitItem Role Mapping

```typescript
const roleMap: Record<string, string> = {
  top: "base",
  bottom: "base",
  dress: "base",
  outerwear: "layer",
  footwear: "accent",
  bag: "accent",
  accessory: "statement",
};
```

## Create Outfit with Items (nested write)

```typescript
const outfit = await prisma.outfit.create({
  data: {
    id: generateSnowflakeId(),
    userId,
    occasion,
    reasoning,
    colorStory,
    items: {
      create: wardrobeItemIds.map((itemId) => ({
        id: generateSnowflakeId(),
        wardrobeItemId: itemId,
        role: roleMap[items.find(i => i.id === itemId)?.category ?? "top"] ?? "base",
      })),
    },
  },
  include: { items: { include: { wardrobeItem: true } } },
});
```

## Scores

Outfit scores are optional floats: `scoreBalance`, `scoreFormality`, `scoreColor`, `scoreNovelty`.
Accept from body as `scores.balance`, `scores.formality`, etc. — null if not provided.
