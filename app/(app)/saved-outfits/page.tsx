"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppContext } from "@/lib/contexts/AppContext";
import { getAuthToken } from "@/lib/utils/authUtils";
import ShareSheet from "@/components/saved-outfits/ShareSheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SavedOutfit = {
  id:          string;
  outfitName:  string;
  lookType:    string;
  formality?:  string;
  savedAt:     string;
  stylingNote?: string;
  tip?:        string;
  occasionTags?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items:       any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function LoadingSkeleton() {
  return (
    <div style={{ padding: "40px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            border: "1px solid rgba(0,0,0,0.07)",
            backgroundColor: "#ffffff",
            marginBottom: "24px",
            padding: "20px",
          }}
        >
          <div
            style={{
              height: "12px",
              width: "60px",
              backgroundColor: "#f0ede8",
              marginBottom: "10px",
            }}
          />
          <div
            style={{ height: "24px", width: "180px", backgroundColor: "#f0ede8" }}
          />
        </div>
      ))}
    </div>
  );
}

export default function SavedOutfitsPage() {
  const { loadSavedOutfitsCount } = useAppContext();
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openShareId, setOpenShareId] = useState<string | null>(null);
  // map of outfit id → button ref
  const shareRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});

  const authHeader = useCallback((): Record<string, string> => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    fetch("/api/saved-outfits", {
      credentials: "include",
      headers: authHeader(),
    })
      .then((r) => r.json())
      .then((d) => setOutfits(d.outfits ?? []))
      .catch(() => setOutfits([]))
      .finally(() => setIsLoading(false));
  }, [authHeader]);

  const handleDelete = async (id: string) => {
    setOutfits((prev) => prev.filter((o) => o.id !== id));
    await fetch("/api/saved-outfits", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    // Refresh nav badge count
    loadSavedOutfitsCount();
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="page" style={{ paddingTop: "40px", paddingRight: "48px", paddingBottom: "80px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#a8a29e",
            margin: "0 0 8px",
          }}
        >
          YOUR COLLECTION
        </p>
        <h1
          style={{
            fontSize: "40px",
            fontWeight: 300,
            color: "#1c1917",
            fontFamily: "Cormorant Garamond, serif",
            margin: "0 0 8px",
            lineHeight: 1.1,
          }}
        >
          Saved Outfits
        </h1>
        <p style={{ color: "#a8a29e", fontSize: "13px", fontWeight: 300, margin: 0 }}>
          {outfits.length} {outfits.length === 1 ? "look" : "looks"} saved
        </p>
      </div>

      {/* Empty state */}
      {outfits.length === 0 && (
        <div style={{ paddingLeft: "48px", textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: "36px", marginBottom: "16px", opacity: 0.3 }}>
            ✦
          </div>
          <p
            style={{
              color: "#a8a29e",
              fontSize: "14px",
              fontWeight: 300,
              margin: "0 0 8px",
            }}
          >
            No saved outfits yet.
          </p>
          <p
            style={{
              color: "#c4bfbb",
              fontSize: "12px",
              margin: 0,
              fontWeight: 300,
            }}
          >
            Go to Today and tap + Save Outfit on looks you love.
          </p>
        </div>
      )}

      {/* Outfit cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {outfits.map((outfit) => (
          <div
            key={outfit.id}
            style={{
              border: "1px solid rgba(0,0,0,0.07)",
              backgroundColor: "#ffffff",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#a8a29e",
                    margin: "0 0 4px",
                    fontWeight: 400,
                  }}
                >
                  {outfit.lookType} LOOK
                </p>
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: 300,
                    color: "#1c1917",
                    margin: "0 0 4px",
                    fontFamily: "Cormorant Garamond, serif",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  {outfit.outfitName}
                </h2>
                <p style={{ fontSize: "11px", color: "#c4bfbb", margin: 0 }}>
                  Saved{" "}
                  {new Date(outfit.savedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Formality badge */}
                {outfit.formality && (
                  <span
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#a8a29e",
                      border: "1px solid #e7e5e4",
                      padding: "4px 10px",
                    }}
                  >
                    {outfit.formality}
                  </span>
                )}

                {/* Share */}
                <div style={{ position: "relative" }}>
                  {(() => {
                    if (!shareRefs.current[outfit.id]) {
                      shareRefs.current[outfit.id] = { current: null } as React.RefObject<HTMLButtonElement | null>;
                    }
                    const ref = shareRefs.current[outfit.id];
                    return (
                      <>
                        <button
                          ref={ref}
                          onClick={() =>
                            setOpenShareId((prev) =>
                              prev === outfit.id ? null : outfit.id
                            )
                          }
                          style={{
                            background: "none",
                            border:     "none",
                            cursor:     "pointer",
                            color:      openShareId === outfit.id ? "#b5956a" : "#c4bfbb",
                            padding:    "0 4px",
                            lineHeight: 1,
                            flexShrink: 0,
                            display:    "flex",
                            alignItems: "center",
                          }}
                          title="Share outfit"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                        </button>
                        {openShareId === outfit.id && (
                          <ShareSheet
                            outfit={outfit}
                            anchorRef={ref}
                            onClose={() => setOpenShareId(null)}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(outfit.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#c4bfbb",
                    fontSize: "20px",
                    padding: "0 4px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Remove saved outfit"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Item photos — compact horizontal scroll */}
            {Array.isArray(outfit.items) && outfit.items.length > 0 && (
              <div
                style={{
              display: "flex",
                  flexDirection: "row",
                  gap: "8px",
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                  overflowX: "auto",
                  scrollbarWidth: "none" as const,
                  msOverflowStyle: "none" as const,
                }}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {outfit.items.map((item: any, i: number) => (
                  <div key={i} style={{ flexShrink: 0, width: "100px" }}>
                    {/* Small photo */}
                    <div
                      style={{
                        width: "100px",
                        height: "130px",
                        backgroundColor: "#f0ede8",
                        overflow: "hidden",
                        marginBottom: "6px",
                        position: "relative",
                      }}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.style.background = "#e8e3da";
                            }
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            opacity: 0.2,
                          }}
                        >
                          👗
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <p
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#a8a29e",
                        margin: "0 0 2px",
                      }}
                    >
                      {item.category}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 300,
                        color: "#292524",
                        margin: 0,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Occasion tags */}
            {Array.isArray(outfit.occasionTags) && outfit.occasionTags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "12px 20px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  overflowX: "auto",
                  scrollbarWidth: "none" as const,
                  msOverflowStyle: "none" as const,
                  flexWrap: "nowrap" as const,
                }}
              >
                {outfit.occasionTags.map((tag: string) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#78716c",
                      border: "1px solid #e7e5e4",
                      padding: "3px 10px",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Styling note + tip */}
            {(outfit.stylingNote || outfit.tip) && (
              <div style={{ padding: "16px 20px" }}>
                {outfit.stylingNote && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: outfit.tip ? "12px" : 0,
                    }}
                  >
                    <span
                      style={{ color: "#b5956a", marginTop: "2px", flexShrink: 0 }}
                    >
                      ✦
                    </span>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 300,
                        color: "#44403c",
                        lineHeight: 1.7,
                        fontStyle: "italic",
                        margin: 0,
                      }}
                    >
                      &ldquo;{outfit.stylingNote}&rdquo;
                    </p>
                  </div>
                )}
                {outfit.tip && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      paddingTop: "12px",
                      borderTop: outfit.stylingNote
                        ? "1px solid rgba(0,0,0,0.04)"
                        : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "#b5956a",
                        flexShrink: 0,
                        paddingTop: "2px",
                      }}
                    >
                      TIP
                    </span>
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 300,
                        color: "#78716c",
                        fontStyle: "italic",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {outfit.tip}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
