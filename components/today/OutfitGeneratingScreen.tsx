"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = [
  { text: "Scanning your wardrobe...", ms: 0 },
  { text: "Understanding your style...", ms: 3500 },
  { text: "Matching pieces with intention...", ms: 7000 },
  { text: "Crafting three distinct looks...", ms: 11000 },
  { text: "Adding the finishing touches...", ms: 15500 },
  { text: "Worth the wait, we promise.", ms: 20000 },
  { text: "Almost ready — just a moment more...", ms: 25000 },
];

interface Props {
  /** Set to true when the API call has returned (success or error) */
  done: boolean;
  /** Called ~1 second after `done` becomes true, after the completion animation */
  onDone: () => void;
}

export default function OutfitGeneratingScreen({ done, onDone }: Props) {
  const [stageText, setStageText] = useState(STAGES[0].text);
  const [complete, setComplete] = useState(false);
  const calledDone = useRef(false);

  // Cycle through stage messages on a fixed client-side schedule
  useEffect(() => {
    const timers = STAGES.slice(1).map(({ text, ms }) =>
      setTimeout(() => setStageText(text), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // When API responds, complete the progress bar and dismiss
  useEffect(() => {
    if (done && !calledDone.current) {
      calledDone.current = true;
      setComplete(true);
      setTimeout(() => onDone(), 900);
    }
  }, [done, onDone]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0A0A0A",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Subtle texture grid */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />

      {/* ALT FIT wordmark */}
      <div style={{
        position: "absolute",
        top: 48,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: "Cormorant Garamond, serif",
        fontSize: "12px",
        letterSpacing: "0.52em",
        textTransform: "uppercase",
        color: "#A0622C",
        fontWeight: 400,
      }}>
        ALT FIT
      </div>

      {/* Thin decorative line */}
      <div style={{
        width: "32px",
        height: "1px",
        background: "rgba(160,98,44,0.4)",
        marginBottom: "32px",
      }} />

      {/* Stage message */}
      <div style={{
        textAlign: "center",
        padding: "0 48px",
        maxWidth: 400,
        minHeight: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p
          key={stageText}
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "clamp(24px, 6vw, 36px)",
            fontWeight: 300,
            color: "#F7F3EC",
            lineHeight: 1.35,
            margin: 0,
            animation: "outfitStageFadeIn 0.75s ease forwards",
            letterSpacing: "-0.01em",
          }}
        >
          {stageText}
        </p>
      </div>

      {/* Sub-label */}
      <p style={{
        fontFamily: "DM Sans, sans-serif",
        fontSize: "10px",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.2)",
        marginTop: "28px",
      }}>
        Curating your look
      </p>

      {/* Progress bar — fills 0→85% over 22s, snaps to 100% when complete */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: "rgba(255,255,255,0.06)",
      }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, #7A4010, #A0622C, #C07840)",
          width: complete ? "100%" : undefined,
          animation: complete ? "none" : "outfitProgress 22s cubic-bezier(0.05, 0.8, 0.4, 1) forwards",
          transition: complete ? "width 0.45s ease" : "none",
        }} />
      </div>
    </div>
  );
}
