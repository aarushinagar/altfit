/**
 * Ingestion Pipeline — Graph
 *
 * Wires the 4 nodes into a LangGraph StateGraph.
 *
 * Flow:
 *   __start__ → validate_image
 *             → vision_parse (→ retry if low confidence + attempts < 2)
 *             → enrich_metadata
 *             → persist_item
 *             → END
 *
 * Error routing:
 *   - validate_image error  → END immediately
 *   - vision_parse error    → persist_item (stores with needsReview=true)
 */

import { StateGraph, END } from "@langchain/langgraph";
import { IngestionAnnotation } from "./state";
import {
  validateImageNode,
  visionParseNode,
  enrichMetadataNode,
  persistItemNode,
} from "./nodes";

export function buildIngestionGraph() {
  const graph = new StateGraph(IngestionAnnotation)
    // ── Nodes ──────────────────────────────────────────────────
    .addNode("validate_image", validateImageNode)
    .addNode("vision_parse", visionParseNode)
    .addNode("enrich_metadata", enrichMetadataNode)
    .addNode("persist_item", persistItemNode)

    // ── Edges ──────────────────────────────────────────────────
    .addEdge("__start__", "validate_image")

    // After validation: abort on error, else parse
    .addConditionalEdges("validate_image", (state) => {
      return state.error ? END : "vision_parse";
    })

    // After vision parse:
    //  - error → skip enrich, go straight to persist (with needsReview=true)
    //  - low confidence + retries left → retry vision_parse
    //  - otherwise → enrich
    .addConditionalEdges("vision_parse", (state) => {
      if (state.status === "persisting") return "persist_item"; // vision error path
      if (state.confidence < 0.6 && state.parseAttempts < 2)
        return "vision_parse"; // retry
      return "enrich_metadata";
    })

    .addEdge("enrich_metadata", "persist_item")
    .addEdge("persist_item", END);

  return graph.compile();
}

export type IngestionGraph = ReturnType<typeof buildIngestionGraph>;
