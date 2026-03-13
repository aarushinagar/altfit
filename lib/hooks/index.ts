/**
 * Hooks Export
 * Central export point for all custom hooks
 */

export {
  useAuth,
  AuthProvider,
  type UseAuthReturn,
} from "@/lib/contexts/AuthContext";
export { useWardrobe, type UseWardrobeReturn } from "./useWardrobe";
export { useOutfit, type UseOutfitReturn } from "./useOutfit";
export { useUpload, type UseUploadReturn } from "./useUpload";
