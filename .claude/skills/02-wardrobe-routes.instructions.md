---
applyTo: "app/api/wardrobe/**"
---

# ALTFit — Wardrobe API Routes

## Existing Routes

- `GET /api/wardrobe` — paginated list for authenticated user
- `POST /api/wardrobe` — create item (will invoke LangGraph ingestion — see skill 06)
- `GET/PATCH/DELETE /api/wardrobe/[id]` — single item operations
- `POST /api/wardrobe/[id]/wear` — increment wearCount + set lastWornAt
- `POST /api/wardrobe/bulk` — create multiple items in a transaction

## User Isolation Pattern

Every query MUST include `userId`. Never skip this.

```typescript
// GET — always filter by userId
const items = await prisma.wardrobeItem.findMany({
  where: { userId, isActive: true },
  orderBy: { createdAt: "desc" },
  take: limit,
  skip: offset,
});

// Single item — ownership check before mutation
const item = await prisma.wardrobeItem.findUnique({ where: { id } });
if (!item || item.userId !== userId) return errorResponse("Not found", 404);
```

## Wear Count Pattern

```typescript
await prisma.wardrobeItem.update({
  where: { id, userId },
  data: {
    wearCount: { increment: 1 },
    lastWornAt: new Date(),
  },
});
```

## Bulk Create Pattern (max 20 items per request)

```typescript
const created = await prisma.$transaction(
  items.map((item) => prisma.wardrobeItem.create({ data: { userId, ...item } }))
);
```

## Free Tier Enforcement

The database trigger `enforce_wardrobe_item_limit` fires BEFORE INSERT on `WardrobeItem`.
When the route returns a 400 with "wardrobe item limit", do NOT retry — surface it to the user as a paywall trigger.

## LangGraph Ingestion (Phase 7 of AGENT_TODO.md)

`POST /api/wardrobe` will run the ingestion graph for AI-enriched metadata:

```typescript
import { buildIngestionGraph } from "@/backend/langgraph/ingestion/graph";

const graph = buildIngestionGraph();
const result = await graph.invoke({ imageUrl, userId });
// result.wardrobeItemId, result.enrichedMetadata
```

Never call `/api/classify-clothing` — that route does not exist. The ingestion graph replaces it.
