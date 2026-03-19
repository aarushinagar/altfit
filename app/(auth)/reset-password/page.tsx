"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box } from "@mui/material";

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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <Box sx={{ width: "100%", maxWidth: 360, animation: "fadeUp 0.5s ease forwards" }}>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 20, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 40 }}>
          ALT <span style={{ color: "var(--gold)" }}>F</span>IT
        </div>

        {done ? (
          <>
            <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: "var(--ink)", marginBottom: 12 }}>
              Password updated.
            </h3>
            <p style={{ fontSize: 13, color: "var(--warm-gray)", marginBottom: 32, lineHeight: 1.6 }}>
              Your password has been changed. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push("/signin")}
              style={{
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                padding: "14px 20px",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
                cursor: "pointer",
                width: "100%",
                fontWeight: 500,
              }}
            >
              Sign In
            </button>
          </>
        ) : (
          <>
            <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: "var(--ink)", marginBottom: 8 }}>
              New password.
            </h3>
            <p style={{ fontSize: 13, color: "var(--warm-gray)", fontWeight: 300, marginBottom: 32 }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--linen)")}
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--linen)")}
                />
              </div>

              {error && (
                <Box sx={{ fontSize: 12, color: "#c0392b", p: "8px 12px", background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)" }}>
                  {error}
                </Box>
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
                }}
              >
                {loading ? "Updating…" : "Set New Password"}
              </button>
            </form>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
