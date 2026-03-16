/**
 * Upsert Tool — persists a single wardrobe item to the database.
 *
 * Exposed as a "tool call" that ingestion nodes invoke after the LLM
 * produces metadata. Using a dedicated tool function (rather than inline
 * Prisma calls in the node) keeps the node logic focused on LLM interaction
 * and makes the persistence step independently testable.
 *
 * Upsert key: (userId, imageUrl, category)
 *   — If the user uploads the same photo again with the same detected category,
 *     we update the metadata instead of creating a duplicate record.
 */

import prisma from "@/backend/database/prisma";
import { generatePrismaId, toPrismaId } from "@/backend/database/prisma-id";
import { getModelForTask } from "../shared/models";
import { FORMALITY_LABEL_TO_INT } from "../shared/types";
import type { WardrobeItemMetadata } from "../shared/types";

export interface UpsertWardrobeItemParams {
  userId: string;
  imageUrl: string;
  storagePath: string;
  itemName: string;
  metadata: WardrobeItemMetadata;
  /** Set true when the LLM had low confidence (< 0.6) */
  needsReview: boolean;
}

export interface UpsertWardrobeItemResult {
  wardrobeItemId: string;
  /** true if an existing record was updated; false if a new one was created */
  wasUpdated: boolean;
}

/**
 * Create-or-update a WardrobeItem for the given user + photo + category.
 *
 * Multiple items with the same imageUrl but different categories are kept
 * as separate records (e.g. top + bottom from one outfit photo).
 */
export async function upsertWardrobeItem(
  params: UpsertWardrobeItemParams,
): Promise<UpsertWardrobeItemResult> {
  const { userId, imageUrl, storagePath, itemName, metadata, needsReview } =
    params;
  const model = getModelForTask("visionAnalysis");

  console.log(
    `[UpsertTool] Upserting ${metadata.category}/${metadata.subcategory} for user ${userId}`,
  );

  // Check if a record already exists for this user + image + category
  const existing = await prisma.wardrobeItem.findFirst({
    where: {
      userId: toPrismaId("WardrobeItem", "userId", userId) as unknown as bigint,
      imageUrl,
      category: metadata.category,
    },
    select: { id: true },
  });

  const formalityInt =
    FORMALITY_LABEL_TO_INT[
      metadata.formality as keyof typeof FORMALITY_LABEL_TO_INT
    ] ?? 5;

  const commonData = {
    name: itemName,
    category: metadata.category,
    imageUrl,
    storagePath,

    // New AI metadata
    subcategory: metadata.subcategory ?? null,
    primaryColorName: metadata.primary_color_name ?? null,
    primaryColorHex: metadata.primary_color_hex ?? null,
    secondaryColorName: metadata.secondary_color_name ?? null,
    secondaryColorHex: metadata.secondary_color_hex ?? null,
    colorPattern: metadata.color_pattern ?? null,
    fitType: metadata.fit_type ?? null,
    length: metadata.length ?? null,
    neckline: metadata.neckline ?? null,
    material: metadata.material ?? null,
    texture: metadata.texture ?? null,
    weight: metadata.weight ?? null,
    formalityLabel: metadata.formality ?? null,

    // Legacy fields for backward compat
    formality: formalityInt,
    fabric: metadata.material ?? null,
    fit: metadata.fit_type ?? null,
    season: metadata.season_tags ?? [],
    occasion: metadata.occasions ?? [],
    tags: metadata.style_aesthetic ?? [],
    colorNames: metadata.primary_color_name
      ? [metadata.primary_color_name]
      : [],

    // Weather / season suitability
    suitableTempMinC: metadata.suitable_temp_min_c ?? null,
    suitableTempMaxC: metadata.suitable_temp_max_c ?? null,
    weatherTags: metadata.weather_tags ?? [],
    styleAesthetic: metadata.style_aesthetic ?? [],
    brand: metadata.brand ?? null,

    // LLM audit
    parseConfidence: metadata.confidence ?? null,
    parseModel: model,
    parseNotes: metadata.parse_notes ?? null,
    displayHint: metadata.display_hint ?? null,
    needsReview: needsReview || !metadata,
    isActive: true,
  };

  if (existing) {
    // Update existing record
    await prisma.wardrobeItem.update({
      where: { id: existing.id },
      data: commonData,
    });

    console.log(
      `[UpsertTool] Updated existing item ${existing.id.toString()} (${metadata.category}/${metadata.subcategory})`,
    );

    return {
      wardrobeItemId: existing.id.toString(),
      wasUpdated: true,
    };
  }

  // Create new record + increment user's item count atomically
  let newItemId: bigint | null = null;

  await prisma.$transaction(async (tx) => {
    const created = await tx.wardrobeItem.create({
      data: {
        id: generatePrismaId("WardrobeItem") as never,
        userId: toPrismaId("WardrobeItem", "userId", userId) as never,
        ...commonData,
      },
    });
    newItemId = created.id;

    await tx.user.update({
      where: { id: toPrismaId("User", "id", userId) as never },
      data: { wardrobeItemCount: { increment: 1 } },
    });
  });

  console.log(
    `[UpsertTool] Created new item ${String(newItemId)} (${metadata.category}/${metadata.subcategory})`,
  );

  return {
    wardrobeItemId: String(newItemId),
    wasUpdated: false,
  };
}
