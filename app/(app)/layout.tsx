/**
 * Authenticated app layout — wraps /today, /wardrobe, /upload
 *
 * Responsibilities:
 * - Provides AppContext (plan, wardrobe items, toast, paywall, handlers)
 * - Auth guard: redirects to /signin if not logged in
 * - Renders the persistent navigation shell (AppNav, MobileTopBar, MobileTabBar)
 * - Renders global overlays (Paywall, Toast)
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppProvider, useAppContext } from "@/lib/contexts/AppContext";
import { getAuthToken, getStoredUser } from "@/lib/utils/authUtils";
import AppNav from "@/components/layout/AppNav";
import MobileTopBar from "@/components/layout/MobileTopBar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import Paywall from "@/components/paywall/Paywall";
import Toast from "@/components/common/Toast";
import { Toaster } from "react-hot-toast";

/** Inner shell — rendered inside AppProvider so it can consume the context. */
function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    plan,
    savedItems,
    savedOutfitsCount,
    toast,
    showPaywall,
    setShowPaywall,
    handleSignOut,
    handleUpgrade,
    showToast,
  } = useAppContext();

  const [navOpen, setNavOpen] = useState(false);

  // Derive current page key from pathname ("/today" → "today")
  const currentPage = pathname.split("/").pop() || "today";

  // Auth guard — synchronous; localStorage is always available client-side
  useEffect(() => {
    const token = getAuthToken();
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      router.replace("/signin");
    }
  }, [router]);

  // Update page title based on current route
  useEffect(() => {
    const titles: Record<string, string> = {
      today: "ALT FIT — Today's Look",
      wardrobe: "ALT FIT — Your Wardrobe",
      "saved-outfits": "ALT FIT — Saved Outfits",
      upload: "ALT FIT — Add Pieces",
    };
    document.title = titles[currentPage] || "ALT FIT";
  }, [currentPage]);

  const onSignOut = async () => {
    await handleSignOut();
    router.push("/signin");
  };

  const onPageChange = (p: string) => router.push(`/${p}`);

  return (
    <div className="app">
      <MobileTopBar
        user={user}
        plan={plan}
        savedItemCount={savedItems.length}
        onSignOut={onSignOut}
        onShowToast={showToast}
        onToggleNav={() => setNavOpen((o) => !o)}
      />

      <AppNav
        page={currentPage}
        savedItemCount={savedItems.length}
        savedOutfitsCount={savedOutfitsCount}
        plan={plan}
        user={user}
        isOpen={navOpen}
        onPageChange={onPageChange}
        onSignOut={onSignOut}
        onShowToast={showToast}
        onClose={() => setNavOpen(false)}
      />

      {children}

      <MobileTabBar
        page={currentPage}
        savedItemCount={savedItems.length}
        user={user}
        plan={plan}
        onPageChange={onPageChange}
        onSignOut={onSignOut}
        onShowToast={showToast}
      />

      {showPaywall && (
        <Paywall
          itemCount={savedItems.length}
          onUpgrade={handleUpgrade}
          onClose={() => setShowPaywall(false)}
          userEmail={user?.email}
        />
      )}

      <Toast message={toast} />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1c1917",
            color: "#F7F3EC",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "11px",
            letterSpacing: "0.08em",
            borderRadius: 0,
            padding: "12px 20px",
            border: "1px solid rgba(255,255,255,0.08)",
          },
          success: {
            iconTheme: { primary: "#A0622C", secondary: "#F7F3EC" },
          },
        }}
      />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
