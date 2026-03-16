"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, getStoredUser } from "@/lib/utils/authUtils";
import Auth from "@/components/auth/Auth";

export default function SignInPage() {
  const router = useRouter();

  // Redirect already-authenticated users away from this page
  useEffect(() => {
    const token = getAuthToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      router.replace(storedUser.onboarded ? "/today" : "/onboarding");
    }
  }, [router]);

  return (
    <Auth
      defaultMode="email-login"
      onAuth={(userData) => {
        router.push(userData.onboarded ? "/today" : "/onboarding");
      }}
    />
  );
}
