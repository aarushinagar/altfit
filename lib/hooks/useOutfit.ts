/**
 * useOutfit Hook
 * Manages outfit state and provides outfit-related methods
 */

"use client";

import { useCallback, useState } from "react";
import {
  generateOutfit as generateOutfitAction,
  markOutfitWorn as markOutfitWornAction,
} from "@/lib/actions/outfit";
import { OutfitResponse } from "@/types/api";

export interface UseOutfitReturn {
  outfits: OutfitResponse[];
  isLoading: boolean;
  error: string | null;
  total: number;

  // Methods
  loadOutfits: (
    worn?: boolean,
    limit?: number,
    offset?: number,
  ) => Promise<void>;
  generateOutfit: (
    occasion?: string,
    season?: string,
    mood?: string,
  ) => Promise<OutfitResponse | null>;
  markOutfitWorn: (
    id: string,
    worn?: boolean,
  ) => Promise<OutfitResponse | null>;
}

export function useOutfit(): UseOutfitReturn {
  const [outfits, setOutfits] = useState<OutfitResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadOutfits = useCallback(
    async (_worn?: boolean, _limit: number = 50, _offset: number = 0) => {
      // getOutfits endpoint not yet implemented; outfits are generated on demand
      setOutfits([]);
      setTotal(0);
    },
    [],
  );

  const generateOutfit = useCallback(
    async (
      occasion?: string,
      season?: string,
      mood?: string,
    ): Promise<OutfitResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Outfit Hook] Generating outfit", {
          occasion,
          season,
          mood,
        });
        const response = await generateOutfitAction({
          occasion,
          season,
          mood,
        });

        if (response.success && response.data) {
          const newOutfit = response.data;
          setOutfits([newOutfit, ...outfits]);
          setTotal(total + 1);
          console.log("[Outfit Hook] Outfit generated:", newOutfit.id);
          return newOutfit;
        } else {
          const errorMsg = response.error || "Failed to generate outfit";
          setError(errorMsg);
          console.error("[Outfit Hook] Generate error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Outfit Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [outfits, total],
  );

  const markOutfitWorn = useCallback(
    async (
      id: string,
      worn: boolean = true,
    ): Promise<OutfitResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Outfit Hook] Marking outfit as worn:", id);
        const response = await markOutfitWornAction(id, worn);

        if (response.success && response.data) {
          setOutfits(
            outfits.map((outfit) =>
              outfit.id === id ? response.data! : outfit,
            ),
          );
          console.log("[Outfit Hook] Outfit marked as worn:", id);
          return response.data;
        } else {
          const errorMsg = response.error || "Failed to mark outfit as worn";
          setError(errorMsg);
          console.error("[Outfit Hook] Mark worn error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Outfit Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [outfits],
  );

  return {
    outfits,
    isLoading,
    error,
    total,
    loadOutfits,
    generateOutfit,
    markOutfitWorn,
  };
}
