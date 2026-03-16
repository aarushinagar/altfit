"use client";

import { useState } from "react";
import { STYLE_TAGS, STYLE_ISSUES } from "@/lib/constants";

interface OnboardingResult {
  styles: string[];
  issues: string[];
}

interface OnboardingProps {
  onComplete: (data: OnboardingResult) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [styles, setStyles] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  const toggleStyle = (tag: string) => {
    setStyles((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleIssue = (id: string) => {
    setIssues((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 4
          ? [...prev, id]
          : prev,
    );
  };

  const canNext1 = styles.length >= 1;
  const canFinish = issues.length >= 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: "Cormorant Garamond, serif",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink)",
          marginBottom: 56,
        }}
      >
        ALT <span style={{ color: "var(--gold)" }}>F</span>IT
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 48 }}>
        {[1, 2].map((n) => (
          <div
            key={n}
            style={{
              width: n === step ? 28 : 6,
              height: 2,
              background: n <= step ? "var(--gold)" : "var(--linen)",
              transition: "all 0.4s ease",
            }}
          />
        ))}
      </div>

      {/* Step 1 — Style aesthetics */}
      {step === 1 && (
        <div
          style={{
            maxWidth: 640,
            width: "100%",
            animation: "fadeUp 0.5s ease forwards",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--taupe)",
                marginBottom: 14,
              }}
            >
              Step 1 of 2
            </div>
            <h2
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 40,
                fontWeight: 300,
                color: "var(--ink)",
                marginBottom: 10,
              }}
            >
              What&apos;s your{" "}
              <em style={{ fontStyle: "italic" }}>aesthetic?</em>
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--warm-gray)",
                fontWeight: 300,
                lineHeight: 1.6,
              }}
            >
              Pick everything that resonates. Your AI stylist uses this to
              understand your eye.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
              marginBottom: 48,
            }}
          >
            {STYLE_TAGS.map((tag) => {
              const selected = styles.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleStyle(tag)}
                  style={{
                    padding: "10px 20px",
                    background: selected ? "var(--ink)" : "var(--paper)",
                    color: selected ? "var(--cream)" : "var(--warm-gray)",
                    border: `1px solid ${selected ? "var(--ink)" : "var(--linen)"}`,
                    fontSize: 12,
                    letterSpacing: "0.06em",
                    fontFamily: "DM Sans, sans-serif",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => onComplete({ styles: [], issues: [] })}
              style={{
                background: "none",
                border: "none",
                fontSize: 11,
                color: "var(--taupe)",
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Skip setup
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              style={{
                background: canNext1 ? "var(--ink)" : "var(--linen)",
                color: canNext1 ? "var(--cream)" : "var(--taupe)",
                border: "none",
                padding: "14px 40px",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
                cursor: canNext1 ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Styling issues */}
      {step === 2 && (
        <div
          style={{
            maxWidth: 640,
            width: "100%",
            animation: "fadeUp 0.5s ease forwards",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--taupe)",
                marginBottom: 14,
              }}
            >
              Step 2 of 2
            </div>
            <h2
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 40,
                fontWeight: 300,
                color: "var(--ink)",
                marginBottom: 10,
              }}
            >
              What&apos;s your biggest{" "}
              <em style={{ fontStyle: "italic" }}>styling issue?</em>
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--warm-gray)",
                fontWeight: 300,
                lineHeight: 1.6,
              }}
            >
              Be honest. This is how ALT FIT actually solves your problem.
            </p>
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: issues.length === 4 ? "var(--gold)" : "var(--taupe)",
                letterSpacing: "0.06em",
                transition: "color 0.2s",
              }}
            >
              {issues.length === 0
                ? "Pick up to 4"
                : issues.length === 4
                  ? "Maximum selected"
                  : `${issues.length} selected — pick up to ${4 - issues.length} more`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 48,
            }}
          >
            {STYLE_ISSUES.map((bt) => {
              const selected = issues.includes(bt.id);
              const maxed = issues.length >= 4 && !selected;
              return (
                <button
                  key={bt.id}
                  onClick={() => toggleIssue(bt.id)}
                  disabled={maxed}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: selected ? "var(--paper)" : "transparent",
                    color: maxed ? "var(--taupe)" : "var(--charcoal)",
                    border: `1px solid ${selected ? "var(--gold)" : "var(--linen)"}`,
                    fontFamily: "DM Sans, sans-serif",
                    cursor: maxed ? "default" : "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                    opacity: maxed ? 0.45 : 1,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      {bt.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: maxed ? "var(--taupe)" : "var(--warm-gray)",
                        fontWeight: 300,
                      }}
                    >
                      {bt.desc}
                    </span>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      marginLeft: 16,
                      border: `1px solid ${selected ? "var(--gold)" : "var(--linen)"}`,
                      background: selected ? "var(--gold)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    {selected && (
                      <span
                        style={{
                          color: "var(--cream)",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setStep(1)}
              style={{
                background: "none",
                border: "none",
                fontSize: 11,
                color: "var(--taupe)",
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => onComplete({ styles, issues })}
              disabled={!canFinish}
              style={{
                background: canFinish ? "var(--ink)" : "var(--linen)",
                color: canFinish ? "var(--cream)" : "var(--taupe)",
                border: "none",
                padding: "14px 40px",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
                cursor: canFinish ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Enter ALT FIT →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
