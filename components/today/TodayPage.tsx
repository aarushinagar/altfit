"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { useAuth } from "@/lib/hooks";
import { getHourGreeting } from "@/lib/utils/clothing";
import { getAuthToken } from "@/lib/utils/authUtils";
import StyleOnboarding from "@/components/today/StyleOnboarding";
import SwipeCard from "@/components/today/SwipeCard";
import SwipeToast from "@/components/today/SwipeToast";
import SwipeHint from "@/components/today/SwipeHint";

// ── Loading copy ────────────────────────────────────────────────────────────

const LOADING_COPY = [
  { text: "Scanning your wardrobe...", ms: 0     },
  { text: "Matching your pieces...",   ms: 3000  },
  { text: "Checking the vibe...",      ms: 6000  },
  { text: "Cooking something good...", ms: 9000  },
  { text: "Almost there...",           ms: 12000 },
  { text: "Worth the wait, promise.",  ms: 16000 },
];

// ── Item photo grid (used inside each look card) ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LookItemGrid = ({ items }: { items: any[] }) => {
  if (!items || items.length === 0) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
      gap: "1px",
      backgroundColor: "rgba(0,0,0,0.04)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
    }}>
      {items.map((item) => (
        <div key={item.id} style={{
          backgroundColor: "#faf9f7",
          padding: "16px 12px",
        }}>
          {/* Photo */}
          <div style={{
            position: "relative",
            width: "100%",
            paddingBottom: "130%",
            backgroundColor: "#f0ede8",
            overflow: "hidden",
            marginBottom: "12px",
          }}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  const placeholder = el.nextElementSibling as HTMLElement | null;
                  if (placeholder) placeholder.style.display = "flex";
                }}
              />
            ) : null}
            <div style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              display: item.imageUrl ? "none" : "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              opacity: 0.2,
            }}>
              👗
            </div>
          </div>
          {/* Category */}
          <p style={{
            fontSize: "9px", textTransform: "uppercase",
            letterSpacing: "0.14em", color: "#a8a29e",
            margin: "0 0 3px", fontWeight: 400,
          }}>
            {item.category}
          </p>
          {/* Name */}
          <p style={{
            fontSize: "12px", fontWeight: 300,
            color: "#292524", margin: "0 0 6px", lineHeight: 1.3,
          }}>
            {item.name}
          </p>
          {/* Reason */}
          {item.reason && (
            <p style={{
              fontSize: "10px", color: "#b5b0aa",
              margin: 0, lineHeight: 1.4, fontStyle: "italic",
            }}>
              {item.reason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

interface TodayPageProps {
  wardrobeTotal: number;
  wardrobeLoading?: boolean;
  onGoToUpload: () => void;
}

export default function TodayPage({ wardrobeTotal, wardrobeLoading = false, onGoToUpload }: TodayPageProps) {
  const { user } = useAuth();
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [outfit, setOutfit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(LOADING_COPY[0].text);
  const [dateStr, setDateStr] = useState("");
  const [greeting, setGreeting] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Per-look state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [looks, setLooks] = useState<any[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [refreshingLook, setRefreshingLook] = useState<string | null>(null);
  const [savedLooks, setSavedLooks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'save' | 'skip'; visible: boolean }>({ message: '', type: 'save', visible: false });

  const showToast = (message: string, type: 'save' | 'skip') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  };

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    );
    setGreeting(getHourGreeting());
  }, []);

  // Sync outfit.looks → looks state whenever outfit updates
  useEffect(() => {
    if (outfit?.looks) {
      setLooks(outfit.looks);
      setTopIndex(0);
    }
  }, [outfit]);

  // Cycle loading messages while loading or refreshing
  useEffect(() => {
    if (!isLoading && !isRefreshing) {
      setLoadingText(LOADING_COPY[0].text);
      return;
    }
    const timers = LOADING_COPY.slice(1).map(({ text, ms }) =>
      setTimeout(() => setLoadingText(text), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [isLoading, isRefreshing]);

  const fetchOutfit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/curate-outfit", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 504) {
        setError("Taking longer than usual. Tap to try again.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setOutfit(data.outfit);
    } catch (_err: unknown) {
      setError((_err as Error).message || "Could not load today's outfit.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh ONE specific look — other two stay unchanged
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRefreshLook = async (lookType: string) => {
    if (refreshingLook) return;
    setRefreshingLook(lookType);
    try {
      const token = getAuthToken();
      const otherItemIds = looks
        .filter((l) => l.lookType !== lookType)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((l: any) => (l.items ?? []).map((i: any) => i.id));
      const res = await fetch("/api/curate-outfit/single", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lookType, existingItemIds: otherItemIds }),
      });
      if (!res.ok) throw new Error("Could not refresh look");
      const { look } = await res.json();
      // Replace only this look in state — other two are untouched
      setLooks((prev) => prev.map((l) => (l.lookType === lookType ? look : l)));
      // Reset save state for the refreshed look since it changed
      setSavedLooks((prev) => {
        const next = new Set(prev);
        next.delete(lookType);
        return next;
      });
    } catch (err: unknown) {
      console.error("[Refresh Look]", (err as Error).message);
    } finally {
      setRefreshingLook(null);
    }
  };

  // Swipe right → advance deck immediately, save in background
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSwipeRight = (look: any) => {
    // Advance the deck instantly so the next card springs up right away
    setTopIndex(prev => prev + 1);
    showToast('SAVED TO COLLECTION', 'save');

    if (savedLooks.has(look.lookType)) return;
    setSavedLooks(prev => new Set([...prev, look.lookType]));
    // Fire API in background (no await, no blocking)
    const token = getAuthToken();
    fetch('/api/saved-outfits', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        outfitName:   look.outfitName,
        lookType:     look.lookType,
        mood:         look.mood,
        formality:    look.formality,
        items:        look.items,
        stylingNote:  look.stylingNote,
        occasionTags: look.occasionTags,
        tip:          look.tip,
      }),
    }).catch(() => {});
  };

  // Swipe left → advance deck immediately
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSwipeLeft = (_lookType: string) => {
    setTopIndex(prev => prev + 1);
    showToast('NEXT LOOK', 'skip');
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    const previousOutfit = outfit; // save so we can restore on failure
    const previousLooks = looks;
    setIsRefreshing(true);
    setRefreshError(null);
    setOutfit(null);
    setLooks([]);
    setSavedLooks(new Set());
    try {
      const token = getAuthToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Step 1: Clear cache — MUST complete before fetching
      const clearRes = await fetch("/api/outfit-cache/clear", {
        method: "DELETE",
        credentials: "include",
        headers: authHeader,
      });
      const clearData = await clearRes.json().catch(() => ({}));
      console.log("[Refresh] Cache cleared:", clearData);

      // Step 2: Fetch fresh outfit — timestamp prevents any browser/CDN caching
      const timestamp = Date.now();
      const res = await fetch(`/api/curate-outfit?t=${timestamp}`, {
        credentials: "include",
        headers: {
          ...authHeader,
          "Cache-Control": "no-cache, no-store",
          "Pragma": "no-cache",
        },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      if (!data.outfit) throw new Error("No outfit data received");
      console.log("[Refresh] ✅ New outfit:", data.outfit?.looks?.[0]?.outfitName);
      setOutfit(data.outfit);
      // looks will be set by the outfit → looks useEffect
    } catch (_err: unknown) {
      console.error("[Refresh] ❌", (_err as Error).message);
      setOutfit(previousOutfit); // restore previous outfit so page isn't blank
      setLooks(previousLooks);
      setRefreshError("Could not refresh your look. Tap to try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch outfit once user + wardrobe are ready
  // wardrobeTotal is in deps because it often resolves AFTER user?.id,
  // so we need to re-check when it arrives. The !outfit && !isLoading guards
  // prevent duplicate fetches.
  useEffect(() => {
    if (user?.id && wardrobeTotal >= 2 && !outfit && !isLoading) {
      fetchOutfit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, wardrobeTotal]);

  // Check style profile once per session
  useEffect(() => {
    if (!user?.id) return;
    const alreadyPrompted = sessionStorage.getItem("altfit_onboarding_shown_this_session");
    if (alreadyPrompted) return;
    const token = getAuthToken();
    fetch("/api/style-profile", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.data === null) {
          setShowOnboarding(true);
          sessionStorage.setItem("altfit_onboarding_shown_this_session", "true");
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const hasWardrobe = wardrobeTotal >= 2;
  const showLoader  = isLoading || isRefreshing || wardrobeLoading;

  return (
    <Box className="today-page page">
      {showOnboarding && (
        <StyleOnboarding onComplete={() => setShowOnboarding(false)} />
      )}
      <SwipeHint />
      <SwipeToast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />

      <Box className="today-hero">
        <Box className="today-greeting fade-up">
          <div className="greeting-eyebrow">{dateStr}</div>
          <h1 className="greeting-title" style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(28px, 6vw, 52px)',
            fontWeight: 300,
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
            color: '#1c1917',
            marginBottom: '12px'
          }}>
            {greeting ? `${greeting}.` : ""} Your Curated Look<br />
            <em style={{ fontStyle: 'italic', fontWeight: 300, fontSize: '0.9em', opacity: 0.8 }}>for today</em>
          </h1>
          <p className="greeting-sub" style={{
            fontSize: '14px',
            fontWeight: 300,
            color: '#a8a29e',
            letterSpacing: '0.03em',
            marginTop: '16px'
          }}>
            AI-designed from your wardrobe. Intelligent, intentional, yours.
          </p>

          {/* Empty wardrobe — only show if wardrobe has loaded, confirmed empty, and no outfit */}
          {!hasWardrobe && !wardrobeLoading && !showLoader && !outfit && (
            <Box className="outfit-card" sx={{ p: 5, textAlign: "center" }}>
              <Box component="span" sx={{ fontSize: 32, mb: 2, display: "block" }}>
                👗
              </Box>
              <Box sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 300, color: "var(--ink)", mb: 1 }}>
                Your wardrobe is waiting.
              </Box>
              <Box sx={{ fontSize: 12, color: "var(--taupe)", mb: 3, lineHeight: 1.6 }}>
                Add at least 2 pieces to get your first AI-curated outfit.
              </Box>
              <button
                className="btn-primary"
                onClick={onGoToUpload}
                style={{ padding: "12px 28px", fontSize: 11, letterSpacing: "0.12em" }}
              >
                ADD PIECES
              </button>
            </Box>
          )}

          {/* Loading / refreshing */}
          {showLoader && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "80px 24px", gap: "20px",
            }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    backgroundColor: "#a8a29e",
                    animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <p
                key={loadingText}
                style={{
                  fontSize: "12px", letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "#a8a29e",
                  margin: 0, animation: "msgFadeIn 0.5s ease",
                }}
              >
                {loadingText}
              </p>
            </div>
          )}

          {/* Error */}
          {!showLoader && error && (
            <Box className="outfit-card" sx={{ p: 5, textAlign: "center" }}>
              <Box component="span" sx={{ fontSize: 32, mb: 2, display: "block" }}>⚠️</Box>
              <Box sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 300, color: "var(--ink)", mb: 1.5 }}>
                Could not load today&apos;s outfit
              </Box>
              <Box sx={{ fontSize: 12, color: "var(--taupe)", mb: 2.5, lineHeight: 1.6, background: "rgba(196,184,164,0.3)", p: "12px 16px", borderLeft: "2px solid var(--gold)" }}>
                {error.includes("wardrobe")
                  ? "Add some clothing items to your wardrobe first."
                  : error}
              </Box>
              <Stack direction="row" gap={1.5} justifyContent="center">
                <button
                  className="btn-secondary"
                  onClick={fetchOutfit}
                  style={{ padding: "12px 28px", fontSize: 11, letterSpacing: "0.12em" }}
                >
                  RETRY
                </button>
              </Stack>
            </Box>
          )}

          {/* Refresh error */}
          {!showLoader && refreshError && (
            <p style={{ fontSize: "12px", color: "#ef4444", textAlign: "center", marginTop: "16px" }}>
              {refreshError}
            </p>
          )}

          {/* Card stack — render back-to-front so top card is last in DOM */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {!showLoader && !error && looks.length > 0 && topIndex < looks.length && (() => {
            const visibleLooks = looks.slice(topIndex, topIndex + 3);
            return (
              <div style={{
                position: 'relative',
                height: '680px',
                marginBottom: '40px',
                marginTop: '32px',
              }}>
                {[...visibleLooks].reverse().map((look: any, reversedIdx: number) => {
                  const positionInStack = visibleLooks.length - 1 - reversedIdx;
                  const isTopCard = positionInStack === 0;
                  return (
                  <SwipeCard
                    key={`look-${look.lookType}`}
                    look={look}
                    positionInStack={positionInStack}
                    isTopCard={isTopCard}
                    onSwipeRight={handleSwipeRight}
                    onSwipeLeft={handleSwipeLeft}
                  >
            <div style={{
              border: "1px solid rgba(0,0,0,0.06)",
              marginTop: "24px",
              backgroundColor: "#ffffff",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>

              {/* Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div>
                  <p style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#a8a29e",
                    margin: "0 0 4px",
                    fontWeight: 400,
                  }}>
                    {look.lookType} LOOK
                  </p>
                  <h2 style={{
                    fontSize: "22px",
                    fontWeight: 300,
                    color: "#1c1917",
                    margin: 0,
                    fontFamily: "Cormorant Garamond, serif",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}>
                    {look.outfitName}
                  </h2>
                </div>
                <span style={{
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#a8a29e",
                  border: "1px solid #e7e5e4",
                  padding: "4px 10px",
                  flexShrink: 0,
                }}>
                  {look.formality}
                </span>
              </div>

              {/* Item photo grid */}
              <LookItemGrid items={look.items ?? []} />

              {/* Occasion tags */}
              {look.occasionTags?.length > 0 && (
                <div style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  padding: "14px 20px",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {look.occasionTags.map((tag: any) => (
                    <span key={tag} style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#78716c",
                      border: "1px solid #e7e5e4",
                      padding: "3px 10px",
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Styling note + tip */}
              <div style={{ padding: "20px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", gap: "10px", marginBottom: look.tip ? "12px" : 0 }}>
                  <span style={{ color: "#b5956a", marginTop: "2px", flexShrink: 0 }}>✦</span>
                  <p style={{
                    fontSize: "14px",
                    fontWeight: 300,
                    color: "#44403c",
                    lineHeight: 1.7,
                    fontStyle: "italic",
                    margin: 0,
                  }}>
                    &ldquo;{look.stylingNote}&rdquo;
                  </p>
                </div>
                {look.tip && (
                  <div style={{
                    display: "flex",
                    gap: "10px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                  }}>
                    <span style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#b5956a",
                      flexShrink: 0,
                      paddingTop: "2px",
                    }}>TIP</span>
                    <p style={{
                      fontSize: "13px",
                      fontWeight: 300,
                      color: "#78716c",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                      margin: 0,
                    }}>
                      {look.tip}
                    </p>
                  </div>
                )}
              </div>

              {/* Refresh + Save button row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 20px",
                borderTop: "1px solid rgba(0,0,0,0.05)",
              }}>
                {/* Refresh THIS look only */}
                <button
                  onClick={() => handleRefreshLook(look.lookType)}
                  disabled={!!refreshingLook}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    background: "none",
                    border: "1px solid #e7e5e4",
                    padding: "8px 16px",
                    cursor: refreshingLook ? "not-allowed" : "pointer",
                    opacity: refreshingLook && refreshingLook !== look.lookType ? 0.4 : 1,
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#78716c",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    animation: refreshingLook === look.lookType
                      ? "spin 1s linear infinite" : "none",
                  }}>
                    ↺
                  </span>
                  {refreshingLook === look.lookType ? "Finding look..." : "Refresh Look"}
                </button>

                {/* Save button */}
                <button
                  onClick={() => handleSwipeRight(look)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: savedLooks.has(look.lookType) ? "#1c1917" : "#ffffff",
                    border: savedLooks.has(look.lookType) ? "1px solid #1c1917" : "1px solid #d6d3d1",
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: savedLooks.has(look.lookType) ? "#ffffff" : "#1c1917",
                    transition: "all 0.2s ease",
                    fontWeight: 700,
                    borderRadius: "2px",
                    boxShadow: savedLooks.has(look.lookType) ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <span>{savedLooks.has(look.lookType) ? "✓" : "♡"}</span>
                  <span>{savedLooks.has(look.lookType) ? "Saved" : "Save Outfit"}</span>
                </button>
              </div>

            </div>
                  </SwipeCard>
                  );
                })}
              </div>
            );
          })()}

          {/* All looks seen */}
          {!showLoader && !error && looks.length > 0 && topIndex >= looks.length && (
            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              padding: '80px 24px',
              border: '1px solid rgba(0,0,0,0.06)',
              minHeight: '300px',
              marginTop: '24px',
            }}>
              <div style={{ textAlign: 'center' as const }}>
                <p style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: '22px', fontWeight: 300,
                  color: '#1c1917', margin: '0 0 8px', lineHeight: 1.4,
                }}>
                  All looks reviewed
                </p>
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#a8a29e', margin: 0 }}>
                  {savedLooks.size > 0
                    ? `You saved ${savedLooks.size} look${savedLooks.size > 1 ? 's' : ''} today`
                    : 'Come back tomorrow for fresh curation'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {savedLooks.size > 0 && (
                  <button
                    onClick={() => router.push('/saved-outfits')}
                    style={{
                      background: '#1c1917', border: 'none',
                      padding: '10px 20px', fontSize: '10px',
                      letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                      cursor: 'pointer', color: '#fff',
                    }}
                  >
                    View Saved
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  style={{
                    background: 'none', border: '1px solid #e7e5e4',
                    padding: '10px 20px', fontSize: '10px',
                    letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                    cursor: 'pointer', color: '#78716c',
                  }}
                >
                  Keep Styling
                </button>
              </div>
            </div>
          )}
        </Box>
      </Box>
    </Box>
  );
}
