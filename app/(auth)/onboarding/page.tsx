"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, getStoredUser } from "@/lib/utils/authUtils";
import { completeOnboarding } from "@/lib/actions/user";
import { mapStyleTagToBackend } from "@/lib/constants";
import Onboarding from "@/components/auth/Onboarding";

export default function OnboardingPage() {
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    const token = getAuthToken();
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      router.replace("/signin");
    }
  }, [router]);

  const handleComplete = async ({
    styles,
    issues,
  }: {
    styles: string[];
    issues: string[];
  }) => {
    const baseProfiles = styles.length > 0 ? styles : ["Classic"];
    const uniqueProfiles = [...new Set(baseProfiles.map(mapStyleTagToBackend))];

    try {
      await completeOnboarding(uniqueProfiles, issues);
    } catch (e) {
      console.error("Failed to save onboarding data:", e);
    }

    try {
      localStorage.setItem(
        "altfit-profile",
        JSON.stringify({ styles, issues }),
      );
    } catch {
      /* noop */
    }

    router.push("/today");
  };

  return <Onboarding onComplete={handleComplete} />;
}
