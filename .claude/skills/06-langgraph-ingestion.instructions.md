---
applyTo: "backend/langgraph/ingestion/**,app/api/wardrobe/route.ts,lib/tools/vision.ts,lib/schemas/wardrobeItem.ts"
---

# ALTFit — LangGraph Ingestion Pipeline

## Purpose

Replaces the missing `/api/classify-clothing` route.
Runs when `POST /api/wardrobe` receives a new clothing image.
Classifies + enriches the item using Gemini Vision, then persists to Prisma.

## File Structure

```
backend/langgraph/ingestion/
  state.ts    — IngestionAnnotation
  nodes.ts    — validateImageNode, visionParseNode, enrichMetadataNode, persistItemNode
  graph.ts    — buildIngestionGraph()
lib/tools/vision.ts          — geminiVisionAnalyze()
lib/schemas/wardrobeItem.ts  — wardrobeItemMetadataSchema + WardrobeItemMetadata type
```

## State Shape (state.ts)

```typescript
import { Annotation } from "@langchain/langgraph";
import type { WardrobeItemMetadata } from "@/lib/schemas/wardrobeItem";

export const IngestionAnnotation = Annotation.Root({
  imageUrl: Annotation<string>(),
  userId: Annotation<string>(),
  rawParse: Annotation<WardrobeItemMetadata | null>({ default: () => null }),
  enrichedMetadata: Annotation<WardrobeItemMetadata | null>({ default: () => null }),
  wardrobeItemId: Annotation<string | null>({ default: () => null }),
  parseAttempts: Annotation<number>({ default: () => 0 }),
  confidence: Annotation<number>({ default: () => 0 }),
  error: Annotation<string | null>({ default: () => null }),
});
```

## Node Signatures (nodes.ts)

All nodes follow: `async function nodeName(state: typeof IngestionAnnotation.State)`

1. **validateImageNode** — HEAD request to imageUrl, check < 8MB, set `error` if invalid
2. **visionParseNode** — calls `geminiVisionAnalyze(state.imageUrl)`, sets `rawParse`, `confidence`, `parseAttempts`
3. **enrichMetadataNode** — normalizes colors, derives temp range from material if null, sets `enrichedMetadata`
4. **persistItemNode** — `prisma.wardrobeItem.create({ data: { id: generateSnowflakeId(), userId, ...mappedFields } })`, increments `wardrobeItemCount`

## Graph Wiring (graph.ts)

```typescript
import { StateGraph, END } from "@langchain/langgraph";

export function buildIngestionGraph() {
  const graph = new StateGraph(IngestionAnnotation)
    .addNode("validate", validateImageNode)
    .addNode("vision", visionParseNode)
    .addNode("enrich", enrichMetadataNode)
    .addNode("persist", persistItemNode)
    .addEdge("__start__", "validate")
    .addConditionalEdges("validate", (s) => s.error ? END : "vision")
    .addConditionalEdges("vision", (s) => {
      if (s.error) return END;
      if (s.confidence < 0.6 && s.parseAttempts < 2) return "vision"; // retry
      return "enrich";
    })
    .addEdge("enrich", "persist")
    .addEdge("persist", END);
  return graph.compile();
}
```

## Field Mapping (snake_case → camelCase for Prisma)

Zod schema uses snake_case (`primary_color_name`). Prisma model uses camelCase (`primaryColorName`).
`enrichMetadataNode` or `persistItemNode` must map all fields explicitly.

## Wiring into POST /api/wardrobe

```typescript
// In app/api/wardrobe/route.ts POST handler, after uploading image:
const graph = buildIngestionGraph();
const result = await graph.invoke({ imageUrl, userId });
if (result.error) return errorResponse(result.error, 422);
return successResponse({ wardrobeItemId: result.wardrobeItemId }, "Item saved", 201);
```
