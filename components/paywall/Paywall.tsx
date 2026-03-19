"use client";

import { useState } from "react";
import { Box, Stack } from "@mui/material";
import { FREE_LIMIT } from "@/lib/constants";
import { getAuthToken } from "@/lib/utils/authUtils";

interface PaywallProps {
  onUpgrade: (plan: string) => void;
  onClose: () => void;
  itemCount: number;
  userEmail?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const PLANS = [
  {
    id: "yearly",
    label: "Annual",
    price: "₹699",
    per: "/ year",
    sub: "₹58/month · saves ₹690",
    badge: "BEST VALUE",
  },
  {
    id: "monthly",
    label: "Monthly",
    price: "₹199",
    per: "/ month",
    sub: "Cancel anytime",
    badge: null,
  },
] as const;

const FEATURES = [
  "Unlimited wardrobe items",
  "Unlimited AI outfit generation",
  "Priority AI analysis",
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Paywall({
  onUpgrade,
  onClose,
  itemCount,
  userEmail,
}: PaywallProps) {
  const [selected, setSelected] = useState<"yearly" | "monthly">("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setError(null);
    setLoading(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded)
        throw new Error("Payment SDK failed to load. Check your connection.");

      const orderRes = await fetch("/api/razorpay-create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, userEmail }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok)
        throw new Error(orderData.error || "Could not create order.");

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ALT FIT",
        description:
          selected === "yearly"
            ? "Annual Plan — ₹699/year"
            : "Monthly Plan — ₹199/month",
        order_id: orderData.orderId,
        prefill: { email: userEmail || "" },
        theme: { color: "#A0622C" },
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/razorpay-verify-payment", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: selected,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok)
              throw new Error(verifyData.error || "Payment verification failed.");
            onUpgrade(selected);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed.");
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on(
        "payment.failed",
        (response: { error?: { description?: string } }) => {
          setError(
            response.error?.description || "Payment failed. Please try again.",
          );
          setLoading(false);
        },
      );
      rzp.open();
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <Stack
      alignItems={{ xs: "flex-end", sm: "center" }}
      justifyContent="center"
      sx={{
        position: "fixed",
        inset: 0,
        background: "rgba(46,33,24,0.55)",
        zIndex: 300,
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <Box
        sx={{
          background: "var(--cream)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          overflowY: "auto",
          animation: "fadeUp 0.3s ease forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            p: "32px 36px 28px",
            borderBottom: "1px solid var(--linen)",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--taupe)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <Box
            sx={{
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--gold)",
              mb: 1.5,
              fontWeight: 400,
            }}
          >
            ALT FIT Pro
          </Box>
          <h2
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: 34,
              fontWeight: 300,
              color: "var(--ink)",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Your wardrobe is full.
            <br />
            <em style={{ fontStyle: "italic" }}>Your style isn&apos;t.</em>
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--warm-gray)",
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            You&apos;ve added {itemCount} pieces — the free limit is{" "}
            {FREE_LIMIT}. Upgrade to keep building.
          </p>
        </Box>

        {/* Plan Selection */}
        <Stack gap={1.25} sx={{ p: "24px 36px" }}>
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background:
                  selected === plan.id ? "var(--paper)" : "transparent",
                border: `1px solid ${selected === plan.id ? "var(--gold)" : "var(--linen)"}`,
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  sx={{
                    width: 16,
                    height: 16,
                    border: `1px solid ${selected === plan.id ? "var(--gold)" : "var(--linen)"}`,
                    background:
                      selected === plan.id ? "var(--gold)" : "transparent",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {selected === plan.id && (
                    <span
                      style={{
                        color: "var(--cream)",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </Stack>
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}
                  >
                    {plan.label}
                    {plan.badge && (
                      <span
                        style={{
                          fontSize: 8,
                          letterSpacing: "0.12em",
                          background: "var(--gold)",
                          color: "var(--cream)",
                          padding: "2px 6px",
                          fontWeight: 600,
                        }}
                      >
                        {plan.badge}
                      </span>
                    )}
                  </Stack>
                  <Box
                    sx={{
                      fontSize: 11,
                      color: "var(--warm-gray)",
                      fontWeight: 300,
                      mt: 0.25,
                    }}
                  >
                    {plan.sub}
                  </Box>
                </Box>
              </Stack>
              <Box sx={{ textAlign: "right" }}>
                <span
                  style={{
                    fontFamily: "Cormorant Garamond, serif",
                    fontSize: 22,
                    fontWeight: 400,
                    color: "var(--ink)",
                  }}
                >
                  {plan.price}
                </span>
                <span
                  style={{ fontSize: 11, color: "var(--taupe)", marginLeft: 3 }}
                >
                  {plan.per}
                </span>
              </Box>
            </button>
          ))}
        </Stack>

        {/* Features */}
        <Stack gap={1} sx={{ p: "0 36px 24px" }}>
          {FEATURES.map((f) => (
            <Stack key={f} direction="row" alignItems="center" gap={1.25}>
              <span style={{ color: "var(--gold)", fontSize: 10 }}>✦</span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--warm-gray)",
                  fontWeight: 300,
                }}
              >
                {f}
              </span>
            </Stack>
          ))}
        </Stack>

        {/* CTA */}
        <Box sx={{ p: "0 36px 32px" }}>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "var(--linen)" : "var(--ink)",
              color: loading ? "var(--taupe)" : "var(--cream)",
              border: "none",
              padding: "15px",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "DM Sans, sans-serif",
              cursor: loading ? "default" : "pointer",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {loading
              ? "Opening payment..."
              : `Continue — ${selected === "yearly" ? "₹699/yr" : "₹199/mo"}`}
          </button>
          {error && (
            <Box
              sx={{
                fontSize: 12,
                color: "#c0392b",
                mt: 1.25,
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              ⚠ {error}
            </Box>
          )}
          <p
            style={{
              fontSize: 10,
              color: "var(--taupe)",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Secure payment via Razorpay · Cancel anytime · No hidden fees
          </p>
        </Box>
      </Box>
    </Stack>
  );
}
