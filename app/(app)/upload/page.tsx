"use client";

import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/contexts/AppContext";
import UploadPage from "@/components/upload/UploadPage";

export default function UploadRoute() {
  const { savedItems, handleSaveItem } = useAppContext();
  const router = useRouter();

  return (
    <UploadPage
      onSaveItem={async (item) => {
        const saved = await handleSaveItem(item);
        if (saved) setTimeout(() => router.push("/wardrobe"), 1200);
      }}
      savedItems={savedItems as { id: string | number }[]}
    />
  );
}
