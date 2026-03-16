"use client";

import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/contexts/AppContext";
import TodayPage from "@/components/today/TodayPage";

export default function TodayRoute() {
  const { wardrobeTotal } = useAppContext();
  const router = useRouter();

  return (
    <TodayPage
      wardrobeTotal={wardrobeTotal}
      onGoToUpload={() => router.push("/upload")}
    />
  );
}
