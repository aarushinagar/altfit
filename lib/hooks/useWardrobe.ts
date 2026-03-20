/**
 * useWardrobe Hook
 * Manages wardrobe items state and provides CRUD methods
 */

"use client";

import { useCallback, useState } from "react";
import {
  getWardrobeItems,
  getWardrobeItem,
  createWardrobeItem,
  updateWardrobeItem,
  deleteWardrobeItem,
  type WardrobeCreatePayload,
} from "@/lib/actions/wardrobe";
import { WardrobeItemResponse } from "@/types/api";

export interface UseWardrobeReturn {
  items: WardrobeItemResponse[];
  isLoading: boolean;
  error: string | null;
  total: number;

  // Methods
  loadItems: (
    category?: string,
    limit?: number,
    offset?: number,
  ) => Promise<void>;
  createItem: (
    payload: WardrobeCreatePayload,
  ) => Promise<WardrobeItemResponse | null>;
  updateItem: (
    id: string,
    updates: Partial<WardrobeCreatePayload>,
  ) => Promise<WardrobeItemResponse | null>;
  deleteItem: (id: string) => Promise<boolean>;
  getItem: (id: string) => Promise<WardrobeItemResponse | null>;
}

export function useWardrobe(): UseWardrobeReturn {
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadItems = useCallback(
    async (category?: string, limit: number = 200, offset: number = 0) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Wardrobe Hook] Loading items", {
          category,
          limit,
          offset,
        });
        const response = await getWardrobeItems(category, limit, offset);

        if (response.success && response.data) {
          setItems(response.data.items);
          setTotal(response.data.total);
          console.log(
            "[Wardrobe Hook] Loaded",
            response.data.items.length,
            "items",
          );
        } else {
          const errorMsg = response.error || "Failed to load items";
          setError(errorMsg);
          console.error("[Wardrobe Hook] Load error:", errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Wardrobe Hook] Error:", errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const createItem = useCallback(
    async (
      payload: WardrobeCreatePayload,
    ): Promise<WardrobeItemResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Wardrobe Hook] Creating item:", payload.name);
        const response = await createWardrobeItem(payload);

        if (response.success && response.data) {
          setItems((prev) => [response.data!, ...prev]);
          setTotal((prev) => prev + 1);
          console.log("[Wardrobe Hook] Item created:", response.data.id);
          return response.data;
        } else {
          const errorMsg = response.error || "Failed to create item";
          setError(errorMsg);
          console.error("[Wardrobe Hook] Create error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Wardrobe Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<WardrobeCreatePayload>,
    ): Promise<WardrobeItemResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Wardrobe Hook] Updating item:", id);
        const response = await updateWardrobeItem(id, updates);

        if (response.success && response.data) {
          setItems((prev) =>
            prev.map((item) => (item.id === id ? response.data! : item)),
          );
          console.log("[Wardrobe Hook] Item updated:", id);
          return response.data;
        } else {
          const errorMsg = response.error || "Failed to update item";
          setError(errorMsg);
          console.error("[Wardrobe Hook] Update error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Wardrobe Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Wardrobe Hook] Deleting item:", id);
        const response = await deleteWardrobeItem(id);

        if (response.success) {
          setItems((prev) => prev.filter((item) => item.id !== id));
          setTotal((prev) => prev - 1);
          console.log("[Wardrobe Hook] Item deleted:", id);
          return true;
        } else {
          const errorMsg = response.error || "Failed to delete item";
          setError(errorMsg);
          console.error("[Wardrobe Hook] Delete error:", errorMsg);
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Wardrobe Hook] Error:", errorMsg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getItem = useCallback(
    async (id: string): Promise<WardrobeItemResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[Wardrobe Hook] Getting item:", id);
        const response = await getWardrobeItem(id);

        if (response.success && response.data) {
          console.log("[Wardrobe Hook] Got item:", id);
          return response.data;
        } else {
          const errorMsg = response.error || "Failed to get item";
          setError(errorMsg);
          console.error("[Wardrobe Hook] Get error:", errorMsg);
          return null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[Wardrobe Hook] Error:", errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    items,
    isLoading,
    error,
    total,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    getItem,
  };
}
