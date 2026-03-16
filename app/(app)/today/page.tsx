"use client";

import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/contexts/AppContext";
import { markOutfitWorn } from "@/lib/actions/outfit";
import TodayPage from "@/components/today/TodayPage";

export default function TodayRoute() {
  const { wardrobeTotal, showToast } = useAppContext();
  const router = useRouter();

  return (
    <TodayPage
      wardrobeTotal={wardrobeTotal}
      onGoToUpload={() => router.push("/upload")}
      onWear={async (outfit: {
        outfitId?: string;
        id?: string;
        occasion?: string;
      }) => {
        const id = outfit.outfitId || outfit.id;
        if (id) await markOutfitWorn(id);
        showToast(
          `Look saved — wearing "${outfit.occasion || "your outfit"}" today.`,
        );
      }}
    />
  );
}
