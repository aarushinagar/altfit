"use client";

import { useState } from "react";
import { FREE_LIMIT } from "@/lib/constants";

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
          const verifyRes = await fetch("/api/razorpay-verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(46,33,24,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 300,
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
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
        <div
          style={{
            padding: "32px 36px 28px",
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
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 12,
              fontWeight: 400,
            }}
          >
            ALT FIT Pro
          </div>
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
        </div>

        {/* Plan Selection */}
        <div
          style={{
            padding: "24px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: `1px solid ${selected === plan.id ? "var(--gold)" : "var(--linen)"}`,
                    background:
                      selected === plan.id ? "var(--gold)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
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
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--warm-gray)",
                      fontWeight: 300,
                      marginTop: 2,
                    }}
                  >
                    {plan.sub}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
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
              </div>
            </button>
          ))}
        </div>

        {/* Features */}
        <div style={{ padding: "0 36px 24px" }}>
          {FEATURES.map((f) => (
            <div
              key={f}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
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
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: "0 36px 32px" }}>
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
            <div
              style={{
                fontSize: 12,
                color: "#c0392b",
                marginTop: 10,
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              ⚠ {error}
            </div>
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
        </div>
      </div>
    </div>
  );
}
