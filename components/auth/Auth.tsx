"use client";

import { useState, useRef, useEffect } from "react";
import { loginUser, registerUser, googleAuthUser } from "@/lib/actions/auth";
import {
  loadGisScript,
  decodeJwt,
  GOOGLE_CLIENT_ID,
} from "@/lib/utils/authUtils";

interface AuthProps {
  onAuth: (user: Record<string, unknown>) => void;
  defaultMode?: "choose" | "email-signup" | "email-login";
}

const BULLET_LINES = [
  "Your AI outfit, ready every morning",
  "Color psychology applied to your wardrobe",
  "Learns your style over time",
];

export default function Auth({ onAuth, defaultMode = "choose" }: AuthProps) {
  const [mode, setMode] = useState<"choose" | "email-signup" | "email-login">(
    defaultMode,
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientIdMissing, setClientIdMissing] = useState(false);
  const isGoogleInitialized = useRef(false);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
      setClientIdMissing(true);
      return;
    }
    if (isGoogleInitialized.current) return;

    loadGisScript()
      .then(() => {
        if (
          isGoogleInitialized.current ||
          !(
            window as unknown as {
              google?: { accounts?: { id?: { initialize?: unknown } } };
            }
          ).google?.accounts?.id
        )
          return;
        isGoogleInitialized.current = true;
        const g = (
          window as unknown as {
            google: {
              accounts: { id: { initialize: (opts: unknown) => void } };
            };
          }
        ).google;
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential: string }) => {
            const payload = decodeJwt(response.credential);
            if (!payload) {
              setError("Google sign-in failed — could not read profile.");
              return;
            }
            setLoading(true);
            try {
              const res = await googleAuthUser(response.credential);
              if (res.success && res.data) {
                onAuth(res.data.user as Record<string, unknown>);
              } else {
                setError(
                  res.error || "Google sign-in failed. Please try again.",
                );
              }
            } finally {
              setLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      })
      .catch(() =>
        setError("Could not load Google sign-in. Check your connection."),
      );
  }, []);

  const handleGoogle = async () => {
    setError(null);
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
      setError(
        "Google Client ID not configured. See setup instructions below.",
      );
      return;
    }
    setLoading(true);
    try {
      await loadGisScript();
      const g = (
        window as unknown as {
          google: {
            accounts: {
              id: {
                prompt: (
                  cb: (n: {
                    isNotDisplayed: () => boolean;
                    isSkippedMoment: () => boolean;
                  }) => void,
                ) => void;
                renderButton: (el: HTMLElement, opts: unknown) => void;
              };
            };
          };
        }
      ).google;
      g.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLoading(false);
          const tmp = document.createElement("div");
          tmp.style.cssText =
            "position:fixed;opacity:0;pointer-events:none;top:0;left:0;";
          document.body.appendChild(tmp);
          g.accounts.id.renderButton(tmp, {
            type: "standard",
            theme: "outline",
            size: "large",
          });
          setTimeout(() => {
            (
              tmp.querySelector("div[role=button]") as HTMLElement | null
            )?.click();
            setTimeout(() => document.body.removeChild(tmp), 5000);
          }, 100);
        }
      });
    } catch {
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "email-signup" && !name.trim()) {
      setError("What should we call you?");
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === "email-signup"
          ? await registerUser(email, password, name || email.split("@")[0])
          : await loginUser(email, password);
      if (res.success && res.data) {
        onAuth(res.data.user as Record<string, unknown>);
      } else {
        setError(res.error || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--paper)",
    border: "1px solid var(--linen)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--charcoal)",
    fontFamily: "DM Sans, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--taupe)",
    display: "block",
    marginBottom: 7,
    fontWeight: 400,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
      }}
    >
      <style>{`
        @media (min-width: 768px) { .auth-left-panel { display: flex !important; } }
        @media (min-width: 768px) { .auth-right-panel { width: 460px !important; } }
      `}</style>

      {/* Left editorial panel */}
      <div
        className="auth-left-panel"
        style={{
          flex: 1,
          background: "var(--sand)",
          display: "none",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          position: "relative",
          overflow: "hidden",
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

        <div style={{ animation: "fadeUp 0.7s ease forwards" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 24,
            }}
          >
            AI Personal Stylist
          </div>
          <h2
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "clamp(36px, 4vw, 56px)",
              fontWeight: 300,
              color: "var(--ink)",
              lineHeight: 1.15,
              marginBottom: 28,
            }}
          >
            Dress with
            <br />
            <em style={{ fontStyle: "italic", color: "var(--warm-gray)" }}>
              intention.
            </em>
            <br />
            Every day.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {BULLET_LINES.map((line) => (
              <div
                key={line}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span style={{ color: "var(--gold)", fontSize: 10 }}>✦</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--warm-gray)",
                    fontWeight: 300,
                  }}
                >
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--dust)",
            letterSpacing: "0.04em",
          }}
        >
          Style, elevated by AI
        </div>

        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            right: -60,
            top: "30%",
            width: 200,
            height: 200,
            border: "1px solid rgba(160,98,44,0.22)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -20,
            top: "38%",
            width: 120,
            height: 120,
            border: "1px solid rgba(160,98,44,0.16)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Right form panel */}
      <div
        className="auth-right-panel"
        style={{
          width: "100%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "var(--cream)",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            animation: "fadeUp 0.5s ease forwards",
          }}
        >
          {mode === "choose" && (
            <>
              <h3
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 34,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Welcome.
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--warm-gray)",
                  fontWeight: 300,
                  marginBottom: 40,
                  lineHeight: 1.5,
                }}
              >
                Sign in or create your account to start.
              </p>

              {clientIdMissing && (
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--linen)",
                    padding: "14px 16px",
                    marginBottom: 20,
                    fontSize: 11,
                    color: "var(--charcoal)",
                    lineHeight: 1.7,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--gold)",
                      marginBottom: 8,
                      fontWeight: 500,
                    }}
                  >
                    ⚙ Google OAuth Setup Required
                  </div>
                  <ol style={{ paddingLeft: 16, color: "var(--warm-gray)" }}>
                    <li>
                      Go to <strong>console.cloud.google.com</strong>
                    </li>
                    <li>
                      APIs &amp; Services → Credentials → Create OAuth 2.0
                      Client ID
                    </li>
                    <li>
                      Type: <strong>Web application</strong>
                    </li>
                    <li>
                      Add your domain to <strong>Authorized JS origins</strong>
                    </li>
                    <li>
                      Copy the Client ID → set{" "}
                      <code
                        style={{
                          background: "var(--linen)",
                          padding: "1px 4px",
                        }}
                      >
                        NEXT_PUBLIC_GOOGLE_CLIENT_ID
                      </code>{" "}
                      in your .env
                    </li>
                  </ol>
                </div>
              )}

              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  background: "var(--paper)",
                  border: "1px solid var(--linen)",
                  padding: "14px 20px",
                  fontSize: 13,
                  color: "var(--charcoal)",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  marginBottom: 12,
                  transition: "all 0.2s",
                  fontWeight: 400,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--taupe)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--linen)")
                }
              >
                {loading ? (
                  <span
                    style={{
                      animation: "spin 1s linear infinite",
                      display: "inline-block",
                      fontSize: 16,
                    }}
                  >
                    ◌
                  </span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                )}
                {loading ? "Opening Google..." : "Continue with Google"}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "20px 0",
                }}
              >
                <div
                  style={{ flex: 1, height: 1, background: "var(--linen)" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--taupe)",
                    letterSpacing: "0.06em",
                  }}
                >
                  or
                </span>
                <div
                  style={{ flex: 1, height: 1, background: "var(--linen)" }}
                />
              </div>

              <button
                onClick={() => setMode("email-signup")}
                style={{
                  width: "100%",
                  background: "var(--ink)",
                  color: "var(--cream)",
                  border: "none",
                  padding: "14px 20px",
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                Create Account
              </button>
              <button
                onClick={() => setMode("email-login")}
                style={{
                  width: "100%",
                  background: "none",
                  color: "var(--charcoal)",
                  border: "1px solid var(--linen)",
                  padding: "13px 20px",
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  fontWeight: 400,
                }}
              >
                Sign In with Email
              </button>
            </>
          )}

          {(mode === "email-signup" || mode === "email-login") && (
            <>
              <button
                onClick={() => {
                  setMode("choose");
                  setError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--taupe)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  marginBottom: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ← Back
              </button>
              <h3
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 34,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                {mode === "email-signup" ? "Create account." : "Sign in."}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--warm-gray)",
                  fontWeight: 300,
                  marginBottom: 32,
                }}
              >
                {mode === "email-signup"
                  ? "Start your style journey."
                  : "Welcome back."}
              </p>

              <form
                onSubmit={handleEmailAuth}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {mode === "email-signup" && (
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      style={inputStyle}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "var(--gold)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "var(--linen)")
                      }
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--gold)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--linen)")
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--gold)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--linen)")
                    }
                  />
                </div>

                {error && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#c0392b",
                      padding: "8px 12px",
                      background: "rgba(192,57,43,0.06)",
                      border: "1px solid rgba(192,57,43,0.2)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? "var(--linen)" : "var(--ink)",
                    color: loading ? "var(--taupe)" : "var(--cream)",
                    border: "none",
                    padding: "14px 20px",
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontFamily: "DM Sans, sans-serif",
                    cursor: loading ? "default" : "pointer",
                    marginTop: 8,
                    fontWeight: 500,
                    transition: "all 0.2s",
                  }}
                >
                  {loading
                    ? "Just a moment..."
                    : mode === "email-signup"
                      ? "Create Account"
                      : "Sign In"}
                </button>

                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--taupe)" }}>
                    {mode === "email-signup"
                      ? "Already have an account? "
                      : "New here? "}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(
                        mode === "email-signup"
                          ? "email-login"
                          : "email-signup",
                      );
                      setError(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 12,
                      color: "var(--gold)",
                      cursor: "pointer",
                      fontFamily: "DM Sans, sans-serif",
                      textDecoration: "underline",
                    }}
                  >
                    {mode === "email-signup" ? "Sign in" : "Create account"}
                  </button>
                </div>
              </form>
            </>
          )}

          <p
            style={{
              fontSize: 10,
              color: "var(--taupe)",
              lineHeight: 1.6,
              marginTop: 32,
              textAlign: "center",
            }}
          >
            By continuing, you agree to ALT FIT&apos;s Terms of Service and
            Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
