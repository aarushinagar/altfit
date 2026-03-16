"use client";

import { useEffect, useState } from "react";
import { useWardrobe } from "@/lib/hooks/useWardrobe";
import { completeOnboarding } from "@/lib/actions/user";
import { logoutUser } from "@/lib/actions/auth";
import { markOutfitWorn } from "@/lib/actions/outfit";
import { deleteWardrobeItem } from "@/lib/actions/wardrobe";
import { mapStyleTagToBackend } from "@/lib/constants";
import { getStoredUser, getAuthToken } from "@/lib/utils/authUtils";

import Landing from "@/components/auth/Landing";
import Auth from "@/components/auth/Auth";
import Onboarding from "@/components/auth/Onboarding";
import TodayPage from "@/components/today/TodayPage";
import WardrobePage from "@/components/wardrobe/WardrobePage";
import UploadPage from "@/components/upload/UploadPage";
import Paywall from "@/components/paywall/Paywall";
import AppNav from "@/components/layout/AppNav";
import MobileTopBar from "@/components/layout/MobileTopBar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import Toast from "@/components/common/Toast";

import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

type Screen = "loading" | "landing" | "auth" | "onboarding" | "app";
type Page = "today" | "wardrobe" | "upload";

const FREE_LIMIT = 10;

interface UserData {
  id?: string;
  name?: string;
  email?: string;
  onboarded?: boolean;
  [key: string]: unknown;
}

interface WardrobeItemWithFlags extends WardrobeItem {
  isUploaded?: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<UserData | null>(null);
  const [page, setPage] = useState<Page>("today");
  const [toast, setToast] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const {
    items: savedItems,
    total: wardrobeTotal,
    isLoading: wardrobeLoading,
    loadItems: loadWardrobeItems,
  } = useWardrobe();

  useEffect(() => {
    async function init() {
      try {
        const storedUser = getStoredUser();
        const token = getAuthToken();
        const planData = localStorage.getItem("altfit-plan");

        if (planData) setPlan(JSON.parse(planData));

        if (storedUser && token) {
          setUser(storedUser as UserData);
          await loadWardrobeItems();
          setScreen((storedUser as UserData).onboarded ? "app" : "onboarding");
        } else {
          setScreen("landing");
        }
      } catch {
        setScreen("landing");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAuth = async (userData: Record<string, unknown>) => {
    setUser(userData as UserData);
    await loadWardrobeItems();
    setScreen(userData.onboarded ? "app" : "onboarding");
  };

  const handleOnboardingComplete = async (profileData: {
    styles: string[];
    issues: string[];
  }) => {
    const { styles: selectedProfiles, issues: selectedIssues } = profileData;
    const baseProfiles =
      selectedProfiles.length > 0 ? selectedProfiles : ["Classic"];
    const uniqueProfiles = [...new Set(baseProfiles.map(mapStyleTagToBackend))];

    try {
      await completeOnboarding(uniqueProfiles, selectedIssues);
    } catch (e) {
      console.error("Failed to save onboarding data:", e);
    }

    try {
      localStorage.setItem("altfit-profile", JSON.stringify(profileData));
    } catch {
      // Non-critical
    }
    setScreen("app");
  };

  const handleUpgrade = (selectedPlan: string) => {
    setPlan(selectedPlan);
    setShowPaywall(false);
    try {
      localStorage.setItem("altfit-plan", JSON.stringify(selectedPlan));
    } catch {
      // Non-critical
    }
    showToast("Welcome to ALT FIT Pro ✦");
  };

  const handleSaveItem = async (item: { name?: string }) => {
    const uploadedCount = (savedItems as WardrobeItemWithFlags[]).filter(
      (i) => i.isUploaded !== false,
    ).length;
    if (!plan && uploadedCount >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }
    await loadWardrobeItems();
    showToast(`"${item.name}" saved to your wardrobe`);
    setTimeout(() => setPage("wardrobe"), 1200);
  };

  const handleRemoveItem = async (id: string | number) => {
    const ok = await deleteWardrobeItem(String(id));
    if (ok) {
      showToast("Item removed from wardrobe");
      await loadWardrobeItems();
    } else {
      showToast("Failed to remove item");
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("Failed to logout:", e);
    }
    localStorage.removeItem("altfit-profile");
    localStorage.removeItem("altfit-plan");
    setUser(null);
    setPlan(null);
    setScreen("landing");
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--sand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: 22,
            fontWeight: 300,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink)",
            animation: "fadeIn 1s ease",
          }}
        >
          ALT <span style={{ color: "var(--gold)" }}>F</span>IT
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === "landing" && <Landing onEnter={() => setScreen("auth")} />}

      {screen === "auth" && <Auth onAuth={handleAuth} />}

      {screen === "onboarding" && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {screen === "app" && (
        <>
          {/* Mobile top bar */}
          <MobileTopBar
            user={user}
            plan={plan}
            savedItemCount={savedItems.length}
            onSignOut={handleSignOut}
            onShowToast={showToast}
          />

          {/* Desktop nav */}
          <AppNav
            page={page}
            savedItemCount={savedItems.length}
            plan={plan}
            user={user}
            onPageChange={(p) => setPage(p as Page)}
            onSignOut={handleSignOut}
            onShowToast={showToast}
          />

          {/* Page content */}
          {page === "today" && (
            <TodayPage
              wardrobeTotal={wardrobeTotal}
              onGoToUpload={() => setPage("upload")}
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
          )}
          {page === "wardrobe" && (
            <WardrobePage
              savedItems={savedItems as unknown as WardrobeItem[]}
              onRemoveItem={handleRemoveItem}
              isLoading={wardrobeLoading}
              onFilterChange={(category) => loadWardrobeItems(category)}
            />
          )}
          {page === "upload" && (
            <UploadPage
              onSaveItem={handleSaveItem}
              savedItems={savedItems as { id: string | number }[]}
            />
          )}

          {/* Mobile tab bar */}
          <MobileTabBar
            page={page}
            savedItemCount={savedItems.length}
            user={user}
            plan={plan}
            onPageChange={(p) => setPage(p as Page)}
            onSignOut={handleSignOut}
            onShowToast={showToast}
          />

          {/* Paywall */}
          {showPaywall && (
            <Paywall
              itemCount={
                (savedItems as unknown as WardrobeItemWithFlags[]).filter(
                  (i) => i.isUploaded !== false,
                ).length
              }
              onUpgrade={handleUpgrade}
              onClose={() => setShowPaywall(false)}
              userEmail={user?.email}
            />
          )}

          {/* Toast */}
          <Toast message={toast} />
        </>
      )}
    </div>
  );
}
