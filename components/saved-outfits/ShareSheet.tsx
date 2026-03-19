"use client";

import { useState, useRef, useEffect } from "react";

interface ShareSheetProps {
  outfit: {
    outfitName: string;
    lookType:   string;
    stylingNote?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[];
  };
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function buildShareText(outfit: ShareSheetProps["outfit"]): string {
  const pieces = (outfit.items ?? [])
    .map((i) => i.name)
    .filter(Boolean)
    .join(" · ");

  const lines = [
    `✦ ${outfit.outfitName}`,
    `${outfit.lookType ?? ""} look — styled by ALT FIT AI`.trim(),
    "",
    pieces,
  ];
  if (outfit.stylingNote) lines.push("", `"${outfit.stylingNote}"`);
  lines.push("", "Try it → https://altfit-6fma.onrender.com");
  return lines.join("\n");
}

export default function ShareSheet({ outfit, anchorRef, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        sheetRef.current &&
        !sheetRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  const text = buildShareText(outfit);

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  async function shareInstagram() {
    // On mobile, navigator.share covers Instagram via native share sheet
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: outfit.outfitName,
          text,
          url:   "https://altfit-6fma.onrender.com",
        });
        onClose();
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }
    // Desktop fallback: copy to clipboard + hint
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {/* ignore */}
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch {/* ignore */}
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: outfit.outfitName,
          text,
          url:   "https://altfit-6fma.onrender.com",
        });
        onClose();
      } catch {/* user cancelled */}
    }
  }

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      ref={sheetRef}
      style={{
        position:        "absolute",
        top:             "calc(100% + 6px)",
        right:           0,
        zIndex:          100,
        background:      "#ffffff",
        border:          "1px solid rgba(0,0,0,0.09)",
        boxShadow:       "0 8px 32px rgba(0,0,0,0.10)",
        width:           "220px",
        padding:         "6px 0",
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize:        "9px",
          textTransform:   "uppercase",
          letterSpacing:   "0.16em",
          color:           "#a8a29e",
          margin:          "0",
          padding:         "8px 16px 10px",
          borderBottom:    "1px solid rgba(0,0,0,0.05)",
        }}
      >
        Share this look
      </p>

      {/* WhatsApp */}
      <button onClick={shareWhatsApp} style={btnStyle}>
        <span style={{ fontSize: "16px", lineHeight: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </span>
        <span>Share on WhatsApp</span>
      </button>

      {/* Instagram */}
      <button onClick={shareInstagram} style={btnStyle}>
        <span style={{ fontSize: "16px", lineHeight: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f9ce34"/>
                <stop offset="0.33" stopColor="#ee2a7b"/>
                <stop offset="1" stopColor="#6228d7"/>
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2"/>
            <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="2"/>
            <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)"/>
          </svg>
        </span>
        <span>{hasNativeShare ? "Share to Instagram" : "Copy for Instagram"}</span>
        {copied && !hasNativeShare && (
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#a8a29e" }}>Copied</span>
        )}
      </button>

      <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", margin: "4px 0" }} />

      {/* Copy text */}
      <button onClick={copyText} style={btnStyle}>
        <span style={{ fontSize: "14px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </span>
        <span>{copied ? "Copied ✓" : "Copy outfit details"}</span>
      </button>

      {/* Native share (mobile) */}
      {hasNativeShare && (
        <button onClick={nativeShare} style={btnStyle}>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </span>
          <span>More options</span>
        </button>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display:         "flex",
  alignItems:      "center",
  gap:             "10px",
  width:           "100%",
  background:      "none",
  border:          "none",
  cursor:          "pointer",
  padding:         "10px 16px",
  fontSize:        "13px",
  fontWeight:      300,
  color:           "#292524",
  textAlign:       "left",
  transition:      "background 0.12s",
  fontFamily:      "DM Sans, sans-serif",
};
