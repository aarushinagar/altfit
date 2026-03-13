/**
 * useOutfit Hook
 * Manages outfit state and provides outfit-related methods
 */

"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
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
    async (worn?: boolean, limit: number = 50, offset: number = 0) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Outfit Hook] Loading outfits", { worn, limit, offset });
        const response = await apiClient.outfit.getOutfits({
          worn,
          limit,
          offset,
        });

        if (response.success && response.data) {
          setOutfits(response.data.outfits);
          setTotal(response.data.total);
          console.log(
            "[Outfit Hook] Loaded",
            response.data.outfits.length,
            "outfits",
          );
        } else {
          const errorMsg = response.error || "Failed to load outfits";
          setError(errorMsg);
          console.error("[Outfit Hook] Load error:", errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Outfit Hook] Error:", errorMsg);
      } finally {
        setIsLoading(false);
      }
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
        const response = await apiClient.outfit.generateOutfit({
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
        const response = await apiClient.outfit.markOutfitWorn(id, worn);

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
