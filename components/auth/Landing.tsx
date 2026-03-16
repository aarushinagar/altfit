"use client";

interface LandingProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    icon: "✦",
    title: "AI Outfit Engine",
    desc: "Color psychology meets your wardrobe. Every suggestion is intentional.",
  },
  {
    icon: "◈",
    title: "Smart Wardrobe",
    desc: "Upload once. ALT FIT learns what you own and how you wear it.",
  },
  {
    icon: "⊹",
    title: "Style Scores",
    desc: "Real-time feedback on balance, formality, color, and novelty.",
  },
];

export default function Landing({ onEnter }: LandingProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--sand)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 20px",
          borderBottom: "1px solid var(--linen)",
        }}
      >
        <div
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          ALT <span style={{ color: "var(--gold)" }}>F</span>IT
        </div>
        <button
          onClick={onEnter}
          style={{
            background: "none",
            border: "1px solid var(--linen)",
            color: "var(--warm-gray)",
            padding: "9px 24px",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "DM Sans, sans-serif",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--gold)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--linen)")
          }
        >
          Sign In
        </button>
      </div>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px 40px",
          textAlign: "center",
          animation: "fadeUp 0.8s ease forwards",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 32,
            fontWeight: 400,
          }}
        >
          AI Personal Stylist
        </div>
        <h1
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "clamp(52px, 9vw, 96px)",
            fontWeight: 300,
            lineHeight: 1.08,
            color: "var(--ink)",
            marginBottom: 28,
            maxWidth: 800,
          }}
        >
          Your wardrobe,
          <br />
          <em style={{ fontStyle: "italic", color: "var(--charcoal)" }}>
            finally intelligent.
          </em>
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--warm-gray)",
            fontWeight: 300,
            lineHeight: 1.7,
            maxWidth: 480,
            marginBottom: 52,
          }}
        >
          ALT FIT learns your style, analyzes your wardrobe, and curates a new
          outfit every morning — grounded in color psychology.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            onClick={onEnter}
            style={{
              background: "var(--gold)",
              color: "var(--ink)",
              border: "none",
              padding: "16px 44px",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontFamily: "DM Sans, sans-serif",
              cursor: "pointer",
              fontWeight: 500,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Get Started — Free
          </button>
          <button
            onClick={onEnter}
            style={{
              background: "none",
              border: "1px solid var(--linen)",
              color: "var(--warm-gray)",
              padding: "16px 32px",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "DM Sans, sans-serif",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--taupe)";
              e.currentTarget.style.color = "var(--charcoal)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--linen)";
              e.currentTarget.style.color = "var(--warm-gray)";
            }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Feature strip */}
      <style>{`
        .feature-strip { border-top:1px solid var(--linen); display:grid; grid-template-columns:repeat(2,1fr); background:var(--cream); }
        @media(min-width:768px){ .feature-strip { grid-template-columns:repeat(4,1fr); } }
        .feature-item { padding:28px 20px; border-right:1px solid var(--linen); border-bottom:1px solid var(--linen); }
        @media(min-width:768px){ .feature-item { padding:36px 32px; } }
      `}</style>
      <div className="feature-strip">
        {FEATURES.map((f, i) => (
          <div key={i} className="feature-item">
            <div
              style={{ fontSize: 18, color: "var(--gold)", marginBottom: 14 }}
            >
              {f.icon}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: "var(--charcoal)",
                marginBottom: 8,
              }}
            >
              {f.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--warm-gray)",
                lineHeight: 1.6,
                fontWeight: 300,
              }}
            >
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "20px 24px",
          borderTop: "1px solid var(--linen)",
          background: "var(--cream)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--dust)",
          }}
        >
          ALT FIT © 2025
        </div>
        <div style={{ fontSize: 11, color: "var(--dust)" }}>
          Style, elevated by AI
        </div>
      </div>
    </div>
  );
}
