/**
 * Curation Pipeline — StateGraph
 *
 * Flow:
 *   fetch_weather
 *     → interpret_weather
 *     → query_wardrobe             (exits to END on empty wardrobe)
 *     → curate_outfits
 *     → validate_outfits           (loops back to curate_outfits up to 2 times)
 *     → persist_curation
 *     → hydrate_slots
 *     → END
 */

import { StateGraph, END } from "@langchain/langgraph";
import { CurationAnnotation, type CurationState } from "./state";
import {
  fetchWeatherNode,
  interpretWeatherNode,
  queryWardrobeNode,
  curateOutfitsNode,
  validateOutfitsNode,
  persistCurationNode,
  hydrateSlotsNode,
} from "./nodes";

const MAX_VALIDATION_RETRY_ATTEMPTS = 2;

function afterQueryWardrobe(state: CurationState): string {
  if (state.status === "failed") return END;
  return "curate_outfits";
}

function afterValidate(state: CurationState): string {
  if (state.status === "persisting") return "persist_curation";
  if (state.validationAttempts < MAX_VALIDATION_RETRY_ATTEMPTS)
    return "curate_outfits";
  // Exhausted retries — bail out
  return END;
}

function afterCurate(state: CurationState): string {
  if (state.status === "failed") return END;
  return "validate_outfits";
}

export function buildCurationGraph() {
  const graph = new StateGraph(CurationAnnotation)
    .addNode("fetch_weather", fetchWeatherNode)
    .addNode("interpret_weather", interpretWeatherNode)
    .addNode("query_wardrobe", queryWardrobeNode)
    .addNode("curate_outfits", curateOutfitsNode)
    .addNode("validate_outfits", validateOutfitsNode)
    .addNode("persist_curation", persistCurationNode)
    .addNode("hydrate_slots", hydrateSlotsNode)
    .addEdge("__start__", "fetch_weather")
    .addEdge("fetch_weather", "interpret_weather")
    .addEdge("interpret_weather", "query_wardrobe")
    .addConditionalEdges("query_wardrobe", afterQueryWardrobe, {
      curate_outfits: "curate_outfits",
      [END]: END,
    })
    .addConditionalEdges("curate_outfits", afterCurate, {
      validate_outfits: "validate_outfits",
      [END]: END,
    })
    .addConditionalEdges("validate_outfits", afterValidate, {
      curate_outfits: "curate_outfits",
      persist_curation: "persist_curation",
      [END]: END,
    })
    .addEdge("persist_curation", "hydrate_slots")
    .addEdge("hydrate_slots", END);

  return graph.compile();
}
