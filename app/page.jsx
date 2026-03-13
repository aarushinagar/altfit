"use client";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

const GOOGLE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
`;

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  :root {
    --cream: #F7F3EC; --paper: #EFE9DE; --linen: #E2D9CC;
    --sand: #D4C8B4; --taupe: #A89880; --dust: #C4B8A4;
    --warm-gray: #8C7C6C; --charcoal: #4A3828; --ink: #2E2118;
    --gold: #A0622C; --gold-light: #C07840; --blush: #D4B8A0;
  }
  html { -webkit-text-size-adjust: 100%; }
  body { background: var(--cream); font-family: 'DM Sans', sans-serif; color: var(--charcoal); overscroll-behavior: none; }
  input, button, select, textarea { -webkit-appearance: none; font-family: inherit; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .app { min-height: 100vh; background: var(--cream); }

  /* ─── DESKTOP NAV (768+) ─── */
  .nav { display: none; }
  @media (min-width: 768px) {
    .nav {
      display: flex; position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      align-items: center; justify-content: space-between;
      padding: 0 48px; height: 72px;
      background: rgba(247,243,236,0.94); backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--linen);
    }
  }
  .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 500; letter-spacing: 0.12em; color: var(--ink); cursor: pointer; text-transform: uppercase; }
  .nav-logo span { color: var(--gold); }
  .nav-links { display: flex; gap: 32px; align-items: center; }
  .nav-link { font-size: 12px; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: var(--warm-gray); cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: 'DM Sans', sans-serif; }
  .nav-link:hover, .nav-link.active { color: var(--ink); }
  .nav-link.active { border-bottom: 1px solid var(--gold); padding-bottom: 2px; }
  .nav-upload { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cream); background: var(--ink); border: none; padding: 10px 24px; cursor: pointer; transition: background 0.2s; font-family: 'DM Sans', sans-serif; }
  .nav-upload:hover { background: var(--charcoal); }

  /* ─── MOBILE TOP BAR (<768) ─── */
  .mobile-topbar {
    display: flex; position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    align-items: center; justify-content: space-between;
    padding: 0 20px; height: 60px;
    background: rgba(247,243,236,0.96); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--linen);
  }
  @media (min-width: 768px) { .mobile-topbar { display: none; } }
  .mobile-logo { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 500; letter-spacing: 0.12em; color: var(--ink); text-transform: uppercase; }
  .mobile-logo span { color: var(--gold); }
  .mobile-signout { background: none; border: none; font-size: 10px; color: var(--taupe); cursor: pointer; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'DM Sans', sans-serif; }

  /* ─── MOBILE BOTTOM TAB BAR (<768) ─── */
  .tab-bar {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    height: 64px; background: rgba(247,243,236,0.97); backdrop-filter: blur(20px);
    border-top: 1px solid var(--linen); padding-bottom: env(safe-area-inset-bottom);
  }
  @media (min-width: 768px) { .tab-bar { display: none; } }
  .tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: none; border: none; cursor: pointer; padding: 8px 4px; }
  .tab-icon { font-size: 20px; line-height: 1; }
  .tab-label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--taupe); font-family: 'DM Sans', sans-serif; font-weight: 400; }
  .tab-item.active .tab-label { color: var(--gold); }
  .tab-upload-btn { flex: 1; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; }
  .tab-upload-inner { width: 44px; height: 44px; background: var(--ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--cream); font-weight: 300; }

  /* ─── PAGE WRAPPER ─── */
  .page { min-height: 100vh; padding-top: 60px; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
  @media (min-width: 768px) { .page { padding-top: 72px; padding-bottom: 0; } }

  /* ─── TODAY PAGE ─── */
  .today-page { padding: 0; }

  /* Mobile: single column, compact */
  .today-hero { padding: 24px 20px 40px; display: flex; flex-direction: column; gap: 28px; }

  /* Desktop: original two-column editorial layout */
  @media (min-width: 768px) {
    .today-hero {
      display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start;
      padding: 60px 60px 60px; max-width: 1400px; margin: 0 auto;
    }
  }
  @media (min-width: 1200px) { .today-hero { padding: 80px 80px 60px; gap: 80px; } }

  .greeting-eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--taupe); margin-bottom: 12px; font-weight: 400; }
  .greeting-title { font-family: 'Cormorant Garamond', serif; font-size: 34px; font-weight: 300; line-height: 1.15; color: var(--ink); margin-bottom: 8px; }
  @media (min-width: 768px) { .greeting-title { font-size: 48px; } }
  @media (min-width: 1200px) { .greeting-title { font-size: 52px; } }
  .greeting-title em { font-style: italic; color: var(--warm-gray); }
  .greeting-sub { font-size: 13px; color: var(--warm-gray); font-weight: 300; margin-bottom: 20px; line-height: 1.6; letter-spacing: 0.02em; }
  @media (min-width: 768px) { .greeting-sub { margin-bottom: 36px; } }
  .weather-pill { display: inline-flex; align-items: center; gap: 8px; background: var(--paper); border: 1px solid var(--linen); padding: 7px 14px; font-size: 12px; color: var(--warm-gray); margin-bottom: 20px; letter-spacing: 0.04em; }
  @media (min-width: 768px) { .weather-pill { padding: 8px 16px; margin-bottom: 40px; } }

  /* Outfit card */
  .outfit-card { background: var(--paper); border: 1px solid var(--linen); overflow: hidden; animation: fadeUp 0.7s ease forwards; }
  .outfit-card-header { padding: 16px 18px; border-bottom: 1px solid var(--linen); display: flex; align-items: center; justify-content: space-between; }
  @media (min-width: 768px) { .outfit-card-header { padding: 20px 24px 16px; } }
  .outfit-card-title { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--taupe); font-weight: 400; }
  .occasion-tag { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); background: rgba(160,98,44,0.10); padding: 3px 10px; border: 1px solid rgba(160,98,44,0.22); }

  /* Outfit pieces: 2-col on narrow mobile, 4-col on wider */
  .outfit-pieces { display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid var(--linen); }
  @media (min-width: 420px) { .outfit-pieces { grid-template-columns: repeat(4, 1fr); } }
  .outfit-piece { padding: 14px 10px; border-right: 1px solid var(--linen); text-align: center; }
  @media (min-width: 768px) { .outfit-piece { padding: 20px 16px; cursor: pointer; transition: background 0.2s; } .outfit-piece:hover { background: var(--cream); } }
  .outfit-piece:last-child { border-right: none; }
  .piece-visual { width: 100%; aspect-ratio: 3/4; background: var(--linen); margin-bottom: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; position: relative; overflow: hidden; }
  @media (min-width: 768px) { .piece-visual { font-size: 28px; } }
  .piece-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--taupe); margin-bottom: 3px; font-weight: 400; }
  .piece-name { font-size: 10px; color: var(--charcoal); font-weight: 400; line-height: 1.3; }
  @media (min-width: 768px) { .piece-name { font-size: 11px; } }
  .outfit-reasoning { padding: 14px 18px; display: flex; align-items: flex-start; gap: 10px; }
  @media (min-width: 768px) { .outfit-reasoning { padding: 16px 24px; gap: 12px; } }
  .reasoning-icon { color: var(--gold); font-size: 13px; flex-shrink: 0; margin-top: 2px; }
  .reasoning-text { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-weight: 300; font-style: italic; color: var(--warm-gray); line-height: 1.6; letter-spacing: 0.02em; }
  @media (min-width: 768px) { .reasoning-text { font-size: 15px; } }
  .outfit-actions { padding: 14px 18px; display: flex; gap: 10px; align-items: center; border-top: 1px solid var(--linen); }
  @media (min-width: 768px) { .outfit-actions { padding: 16px 24px; gap: 12px; } }
  .btn-primary { flex: 1; background: var(--ink); color: var(--cream); border: none; padding: 13px 16px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.2s; font-weight: 500; }
  .btn-primary:hover { background: var(--charcoal); }
  .btn-secondary { background: none; color: var(--charcoal); border: 1px solid var(--linen); padding: 12px 14px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: border-color 0.2s; white-space: nowrap; }
  .btn-secondary:hover { border-color: var(--taupe); }
  .btn-shuffle { background: none; border: 1px solid var(--linen); color: var(--warm-gray); padding: 12px 14px; cursor: pointer; transition: all 0.2s; font-size: 16px; }
  .btn-shuffle:hover { border-color: var(--gold); color: var(--gold); }
  .btn-shuffle.spinning { animation: spin 0.5s linear; }

  /* Sidebar */
  .today-sidebar { padding-top: 0; }
  @media (min-width: 768px) { .today-sidebar { padding-top: 8px; } }
  .sidebar-section { margin-bottom: 28px; }
  @media (min-width: 768px) { .sidebar-section { margin-bottom: 40px; } }
  .sidebar-heading { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--taupe); margin-bottom: 14px; font-weight: 400; }
  .style-score-bar { display: flex; flex-direction: column; gap: 8px; }
  .score-item { display: flex; align-items: center; gap: 12px; }
  .score-label { font-size: 11px; color: var(--warm-gray); width: 72px; flex-shrink: 0; }
  .score-track { flex: 1; height: 2px; background: var(--linen); position: relative; }
  .score-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--gold); transition: width 1s ease; }
  .insight-card { background: var(--ink); color: var(--cream); padding: 18px; }
  @media (min-width: 768px) { .insight-card { padding: 20px; } }
  .insight-card .insight-label { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; font-weight: 400; }
  .insight-card .insight-text { font-family: 'Cormorant Garamond', serif; font-size: 16px; font-weight: 300; line-height: 1.4; }
  @media (min-width: 768px) { .insight-card .insight-text { font-size: 17px; } }
  .last-worn-list { display: flex; flex-direction: column; gap: 6px; }
  .last-worn-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--paper); border: 1px solid var(--linen); }
  .last-worn-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .last-worn-name { color: var(--charcoal); flex: 1; font-size: 12px; }
  .last-worn-date { color: var(--taupe); font-size: 11px; }

  /* ─── WARDROBE PAGE ─── */
  .wardrobe-page { padding: 20px 16px 24px; }
  @media (min-width: 768px) { .wardrobe-page { padding: 48px 60px; max-width: 1400px; margin: 0 auto; } }
  @media (min-width: 1200px) { .wardrobe-page { padding: 60px 80px; } }
  .page-header { margin-bottom: 24px; }
  @media (min-width: 768px) { .page-header { margin-bottom: 48px; } }
  .page-eyebrow { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--taupe); margin-bottom: 10px; font-weight: 400; }
  .page-title { font-family: 'Cormorant Garamond', serif; font-size: 34px; font-weight: 300; color: var(--ink); margin-bottom: 4px; }
  @media (min-width: 768px) { .page-title { font-size: 44px; } }
  .page-count { font-size: 13px; color: var(--taupe); font-weight: 300; }

  /* Filter bar: horizontal scroll on mobile, wrap on desktop */
  .filter-bar { display: flex; gap: 6px; margin-bottom: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; align-items: center; }
  .filter-bar::-webkit-scrollbar { display: none; }
  @media (min-width: 768px) { .filter-bar { flex-wrap: wrap; gap: 8px; margin-bottom: 40px; overflow: visible; } }
  .filter-label { display: none; }
  @media (min-width: 768px) { .filter-label { display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--taupe); margin-right: 4px; font-weight: 400; } }
  .filter-chip { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--warm-gray); background: none; border: 1px solid var(--linen); padding: 6px 14px; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; font-weight: 400; white-space: nowrap; flex-shrink: 0; }
  .filter-chip:hover { border-color: var(--taupe); color: var(--charcoal); }
  .filter-chip.active { background: var(--ink); color: var(--cream); border-color: var(--ink); }

  /* Wardrobe grid: 2 cols mobile → 3 cols tablet → auto-fill desktop */
  .wardrobe-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; }
  @media (min-width: 540px) { .wardrobe-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 768px) { .wardrobe-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
  .wardrobe-item { position: relative; cursor: pointer; overflow: hidden; background: var(--paper); animation: fadeIn 0.4s ease forwards; }
  @media (min-width: 768px) { .wardrobe-item { transition: transform 0.3s; } .wardrobe-item:hover { z-index: 2; transform: scale(1.02); } .wardrobe-item:hover .item-overlay { opacity: 1; } }
  .item-image { width: 100%; aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; font-size: 36px; background: var(--linen); position: relative; overflow: hidden; }
  @media (min-width: 768px) { .item-image { font-size: 40px; } }
  .item-info { padding: 10px; border-top: 1px solid var(--linen); }
  @media (min-width: 768px) { .item-info { padding: 12px; } }
  .item-type { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--taupe); margin-bottom: 2px; font-weight: 400; }
  .item-name { font-size: 11px; color: var(--charcoal); font-weight: 400; line-height: 1.3; }
  @media (min-width: 768px) { .item-name { font-size: 12px; } }
  .item-meta { display: flex; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
  .item-tag { font-size: 9px; letter-spacing: 0.06em; color: var(--warm-gray); background: var(--linen); padding: 2px 6px; font-weight: 400; }
  .item-overlay { position: absolute; inset: 0; background: rgba(46,33,24,0.65); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
  .item-overlay-text { color: var(--cream); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 400; }

  /* ─── MODAL ─── */
  /* Mobile: full-screen bottom sheet */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(46,33,24,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 200; animation: fadeIn 0.2s ease; }
  .modal { background: var(--cream); width: 100%; max-height: 90vh; overflow-y: auto; animation: fadeUp 0.3s ease forwards; }
  .modal-header { padding: 20px 20px 16px; border-bottom: 1px solid var(--linen); display: flex; justify-content: space-between; align-items: start; }
  .modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--taupe); line-height: 1; padding: 4px; }
  .modal-close:hover { color: var(--ink); }
  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .modal-image { aspect-ratio: 3/4; background: var(--paper); border: 1px solid var(--linen); display: flex; align-items: center; justify-content: center; font-size: 72px; position: relative; overflow: hidden; max-height: 38vh; }

  /* Desktop: centered dialog, side-by-side layout */
  @media (min-width: 768px) {
    .modal-backdrop { align-items: center; padding: 24px; }
    .modal { max-width: 720px; max-height: 88vh; }
    .modal-header { padding: 28px 32px 24px; }
    .modal-body { padding: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .modal-image { max-height: none; }
  }
  .modal-details { display: flex; flex-direction: column; gap: 20px; }
  .detail-block-label { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--taupe); margin-bottom: 6px; font-weight: 400; }
  .styling-note { background: var(--paper); border: 1px solid var(--linen); padding: 16px; }
  .pairing-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pairing-chip { font-size: 10px; color: var(--warm-gray); background: var(--linen); padding: 4px 10px; letter-spacing: 0.06em; border: 1px solid var(--dust); }
  .wear-count { display: flex; align-items: center; gap: 8px; }
  .wear-dots { display: flex; gap: 3px; flex-wrap: wrap; }
  .wear-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); }
  .wear-dot.empty { background: var(--linen); }

  /* ─── UPLOAD PAGE ─── */
  .upload-page { padding: 20px 16px 24px; max-width: 900px; margin: 0 auto; }
  @media (min-width: 768px) { .upload-page { padding: 48px 60px; } }
  @media (min-width: 1200px) { .upload-page { padding: 60px 80px; } }
  .upload-zone { border: 1px dashed var(--taupe); padding: 48px 24px; text-align: center; cursor: pointer; transition: all 0.3s; background: var(--paper); margin-bottom: 32px; }
  @media (min-width: 768px) { .upload-zone { padding: 80px 40px; } .upload-zone:hover { border-color: var(--gold); background: rgba(160,98,44,0.03); } }
  .upload-zone.dragover { border-color: var(--gold); background: rgba(160,98,44,0.04); }
  .upload-icon { font-size: 28px; margin-bottom: 16px; opacity: 0.5; }
  @media (min-width: 768px) { .upload-icon { font-size: 36px; margin-bottom: 20px; } }
  .upload-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; color: var(--ink); margin-bottom: 6px; }
  @media (min-width: 768px) { .upload-title { font-size: 28px; margin-bottom: 8px; } }
  .upload-sub { font-size: 12px; color: var(--taupe); font-weight: 300; }
  @media (min-width: 768px) { .upload-sub { font-size: 13px; } }
  .progress-bar { height: 1px; background: var(--linen); position: relative; overflow: hidden; }
  .progress-fill { position: absolute; top: 0; left: 0; height: 100%; background: var(--gold); transition: width 0.5s ease; }
  .analyzing-tag { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--ink); color: var(--cream); padding: 2px 8px; font-weight: 400; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--cream); }
  ::-webkit-scrollbar-thumb { background: var(--dust); }
`;

const FREE_LIMIT = 10;

// ===================== PAYWALL =====================
function Paywall({ onUpgrade, onClose, itemCount, userEmail }) {
  const [selected, setSelected] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleUpgrade = async () => {
    setError(null);
    setLoading(true);

    console.log("[Payment] Starting upgrade flow", {
      plan: selected,
      userEmail: userEmail?.replace(/[^@]/g, "*"),
    });

    try {
      // Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded)
        throw new Error("Payment SDK failed to load. Check your connection.");

      console.log("[Payment] Razorpay SDK loaded successfully");

      // Create order server-side
      const orderRes = await fetch("/api/razorpay-create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, userEmail }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        console.error("[Payment] Order creation failed", {
          status: orderRes.status,
          error: orderData.error,
        });
        throw new Error(orderData.error || "Could not create order.");
      }

      console.log("[Payment] Order created successfully", {
        orderId: orderData.orderId,
        amount: orderData.amount,
      });

      // Open Razorpay checkout
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
          ondismiss: () => {
            console.log("[Payment] Checkout dismissed");
            setLoading(false);
          },
        },
        handler: async (response) => {
          console.log("[Payment] Payment successful, verifying...", {
            paymentId: response.razorpay_payment_id,
          });

          // Verify payment server-side
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
          if (!verifyRes.ok) {
            console.error("[Payment] Verification failed", {
              status: verifyRes.status,
              error: verifyData.error,
            });
            throw new Error(verifyData.error || "Payment verification failed.");
          }

          console.log("[Payment] Payment verified successfully", {
            plan: selected,
          });
          onUpgrade(selected);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        console.error("[Payment] Payment failed", {
          error: response.error?.description,
        });
        setError(
          response.error?.description || "Payment failed. Please try again.",
        );
        setLoading(false);
      });
      rzp.open();
      setLoading(false);
    } catch (err) {
      console.error("[Payment] Payment flow error", { message: err.message });
      setError(err.message || "Something went wrong.");
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
        <div
          style={{
            padding: "32px 36px 28px",
            borderBottom: "1px solid var(--linen)",
            position: "relative",
          }}
        >
          {onClose && (
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
          )}
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
            <em style={{ fontStyle: "italic" }}>Your style isn't.</em>
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--warm-gray)",
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            You've added {itemCount} pieces — the free limit is {FREE_LIMIT}.
            Upgrade to keep building.
          </p>
        </div>

        <div
          style={{
            padding: "24px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {[
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
          ].map((plan) => (
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

        <div style={{ padding: "0 36px 24px" }}>
          {[
            "Unlimited wardrobe items",
            "Unlimited AI outfit generation",
            "Priority AI analysis",
          ].map((f) => (
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

// ===================== DEMO DATA =====================
const WARDROBE_ITEMS = [
  {
    id: 1,
    emoji: "👔",
    name: "White Linen Shirt",
    type: "Shirt",
    category: "top",
    color: "#FFFFFF",
    colorName: "White",
    pattern: "Solid",
    fit: "Relaxed",
    formality: "Smart Casual",
    season: "Summer",
    wornCount: 3,
    pairsWith: ["Tailored Trousers", "Dark Denim", "Linen Shorts"],
    note: "The foundation piece. Clean, breathable, effortlessly polished.",
  },
  {
    id: 2,
    emoji: "👗",
    name: "Beige Slip Dress",
    type: "Dress",
    category: "dress",
    color: "#D4C4B0",
    colorName: "Beige",
    pattern: "Solid",
    fit: "Fitted",
    formality: "Smart Casual",
    season: "Summer",
    wornCount: 1,
    pairsWith: ["White Sneakers", "Strappy Heels", "Structured Tote"],
    note: "Understated luxury. Pairs with almost everything.",
  },
  {
    id: 3,
    emoji: "👖",
    name: "Dark Indigo Jeans",
    type: "Jeans",
    category: "bottom",
    color: "#1A2A4A",
    colorName: "Indigo",
    pattern: "Solid",
    fit: "Fitted",
    formality: "Casual",
    season: "All-Season",
    wornCount: 7,
    pairsWith: ["White Shirt", "Striped Top", "Blazer"],
    note: "Your most versatile piece. Dark wash keeps it polished.",
  },
  {
    id: 4,
    emoji: "🧥",
    name: "Camel Wool Blazer",
    type: "Blazer",
    category: "outerwear",
    color: "#C19A6B",
    colorName: "Camel",
    pattern: "Solid",
    fit: "Fitted",
    formality: "Smart Casual",
    season: "Winter",
    wornCount: 2,
    pairsWith: ["White Tee", "Trousers", "Jeans"],
    note: "The instant-elevation layer. Transforms any casual outfit.",
  },
  {
    id: 5,
    emoji: "👟",
    name: "White Leather Sneakers",
    type: "Sneakers",
    category: "footwear",
    color: "#FFFFFF",
    colorName: "White",
    pattern: "Solid",
    fit: null,
    formality: "Casual",
    season: "All-Season",
    wornCount: 12,
    pairsWith: ["Jeans", "Trousers", "Slip Dress"],
    note: "Clean and current. The modern shoe for any casual look.",
  },
  {
    id: 6,
    emoji: "👜",
    name: "Tan Structured Tote",
    type: "Tote",
    category: "bag",
    color: "#C4A47C",
    colorName: "Tan",
    pattern: "Solid",
    fit: null,
    formality: "Smart Casual",
    season: "All-Season",
    wornCount: 8,
    pairsWith: ["Any outfit"],
    note: "Structured silhouette reads as polished without trying.",
  },
  {
    id: 7,
    emoji: "👕",
    name: "Navy Breton Stripe",
    type: "T-Shirt",
    category: "top",
    color: "#1A2A4A",
    colorName: "Navy",
    pattern: "Striped",
    fit: "Fitted",
    formality: "Casual",
    season: "All-Season",
    wornCount: 4,
    pairsWith: ["White Jeans", "Beige Trousers", "Midi Skirt"],
    note: "A Parisian staple that never loses its relevance.",
  },
  {
    id: 8,
    emoji: "👡",
    name: "Nude Block Heel",
    type: "Heels",
    category: "footwear",
    color: "#D4B8A0",
    colorName: "Nude",
    pattern: "Solid",
    fit: null,
    formality: "Smart Casual",
    season: "All-Season",
    wornCount: 3,
    pairsWith: ["Trousers", "Midi Dress", "Blazer"],
    note: "Lengthens the leg, elevates the outfit. A wardrobe staple.",
  },
  {
    id: 9,
    emoji: "🧣",
    name: "Ivory Cashmere Scarf",
    type: "Scarf",
    category: "accessory",
    color: "#FAF0E0",
    colorName: "Ivory",
    pattern: "Solid",
    fit: null,
    formality: "Smart Casual",
    season: "Winter",
    wornCount: 5,
    pairsWith: ["Coat", "Blazer", "Knit"],
    note: "Adds texture and warmth without visual noise.",
  },
  {
    id: 10,
    emoji: "🧥",
    name: "Cream Knit Sweater",
    type: "Sweater",
    category: "top",
    color: "#F5EDD8",
    colorName: "Cream",
    pattern: "Textured",
    fit: "Relaxed",
    formality: "Casual",
    season: "Winter",
    wornCount: 6,
    pairsWith: ["Jeans", "Trousers", "Midi Skirt"],
    note: "Cozy but composed. The relaxed knit done right.",
  },
  {
    id: 11,
    emoji: "🩱",
    name: "Black Slim Trousers",
    type: "Trousers",
    category: "bottom",
    color: "#1A1714",
    colorName: "Black",
    pattern: "Solid",
    fit: "Fitted",
    formality: "Formal",
    season: "All-Season",
    wornCount: 9,
    pairsWith: ["White Shirt", "Blazer", "Silk Blouse"],
    note: "The sharpest bottom you own. Anchor for any formal look.",
  },
  {
    id: 12,
    emoji: "👒",
    name: "Straw Wide Brim Hat",
    type: "Hat",
    category: "accessory",
    color: "#C4A96D",
    colorName: "Natural",
    pattern: "Textured",
    fit: null,
    formality: "Casual",
    season: "Summer",
    wornCount: 2,
    pairsWith: ["Slip Dress", "Linen Shirt", "Shorts"],
    note: "Summer's finishing touch. Effortlessly editorial.",
  },
];

const CATEGORIES = [
  "All",
  "Top",
  "Bottom",
  "Dress",
  "Outerwear",
  "Footwear",
  "Bag",
  "Accessory",
  "Outfit",
];

const SHUFFLE_VIBES = [
  "more polished and formal — elevate the look",
  "more relaxed and casual — ease off the formality",
  "bolder color choices — make a statement",
  "minimal and monochromatic — quiet luxury",
  "contrast-forward — mix light and dark dramatically",
];

function getHourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ===================== inferCategory =====================
function inferCategory(item) {
  const name = (item.name || "").toLowerCase();
  const type = (item.type || "").toLowerCase();
  const combined = `${name} ${type}`;
  if (/skirt|sarong/.test(combined)) return "bottom";
  if (/\bdress\b|gown|frock/.test(combined)) return "dress";
  if (/\bsaree\b|\bsari\b|lehenga|anarkali|\bkurta\b|salwar/.test(combined))
    return "dress";
  if (
    /top|blouse|shirt|\btee\b|crop|bodysuit|camisole|tank|sweater|knit|corset/.test(
      combined,
    )
  )
    return "top";
  if (/trouser|pant|jeans|shorts|palazzo/.test(combined)) return "bottom";
  if (/jacket|coat|blazer|cape|shawl|cardigan/.test(combined))
    return "outerwear";
  if (/shoe|heel|sneaker|boot|sandal|flat|loafer|mule/.test(combined))
    return "footwear";
  if (/bag|clutch|tote|purse|handbag|pouch/.test(combined)) return "bag";
  if (
    /necklace|bracelet|earring|ring|watch|sunglass|glasses|jewel|belt/.test(
      combined,
    )
  )
    return "accessory";
  const valid = [
    "top",
    "bottom",
    "dress",
    "outerwear",
    "footwear",
    "bag",
    "accessory",
    "outfit",
  ];
  return valid.includes(item.category) ? item.category : "outfit";
}

// ===================== AI FUNCTIONS =====================
/**
 * Frontend-side logging utility
 */
function logToConsole(context, level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const style = `color: ${level === "error" ? "#e74c3c" : level === "warn" ? "#f39c12" : "#27ae60"}; font-weight: bold;`;
  console.log(
    `%c[${timestamp}] ${level.toUpperCase()} in ${context}`,
    style,
    message,
    data,
  );
}

/**
 * Generate outfit using backend API
 * Calls safe backend route that handles Anthropic API securely
 */
async function generateOutfitWithAI(
  wardrobeItems,
  previousOutfitIds = [],
  shuffleVibe = null,
) {
  const startTime = Date.now();
  const context = "generateOutfitWithAI";

  try {
    logToConsole(context, "info", "Starting outfit generation", {
      itemCount: wardrobeItems.length,
      previousOutfitCount: previousOutfitIds.length,
      hasViba: !!shuffleVibe,
    });

    if (!wardrobeItems || wardrobeItems.length === 0) {
      throw new Error("No wardrobe items provided");
    }

    // Call backend API instead of Anthropic directly
    const res = await fetch("/api/generate-outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wardrobeItems,
        previousOutfitIds,
        shuffleVibe,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      logToConsole(context, "error", "Backend API failed", {
        status: res.status,
        error: data?.error,
      });
      throw new Error(data?.error || `API error: ${res.status}`);
    }

    logToConsole(context, "info", "Outfit generated successfully", {
      occasion: data.occasion,
      pieceCount: data.pieces?.length,
      processingMs: Date.now() - startTime,
    });

    return data;
  } catch (error) {
    logToConsole(context, "error", "Failed to generate outfit", {
      message: error.message,
      processingMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Classify clothing using backend API
 * Calls safe backend route that handles Anthropic API securely
 */
async function classifyClothingWithAI(base64, mediaType) {
  const startTime = Date.now();
  const context = "classifyClothingWithAI";

  try {
    logToConsole(context, "info", "Starting clothing classification", {
      mediaType,
      imageSize: `${(base64.length / 1024).toFixed(1)}KB`,
    });

    if (!base64 || typeof base64 !== "string") {
      throw new Error("Invalid image data provided");
    }

    if (!mediaType) {
      throw new Error("Missing media type");
    }

    // Call backend API instead of Anthropic directly
    const res = await fetch("/api/classify-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mediaType }),
    });

    const data = await res.json();

    if (!res.ok) {
      logToConsole(context, "error", "Backend API failed", {
        status: res.status,
        error: data?.error,
      });
      throw new Error(data?.error || `API error: ${res.status}`);
    }

    if (!data.items || !Array.isArray(data.items)) {
      throw new Error("Invalid response format from API");
    }

    logToConsole(context, "info", "Classification completed successfully", {
      itemCount: data.items.length,
      processingMs: Date.now() - startTime,
    });

    return data.items;
  } catch (error) {
    logToConsole(context, "error", "Failed to classify clothing", {
      message: error.message,
      processingMs: Date.now() - startTime,
    });
    throw error;
  }
}

// ===================== IMAGE UTILS =====================
async function detectRealType(file) {
  const buf = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57)
    return "webp";
  const ftyp = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (ftyp === "ftyp") return "heic";
  return "unknown";
}

function isHeicFile(file) {
  const name = (file.name || "").toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

async function prepareImage(file) {
  const dataURL = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

  const jpeg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.src = dataURL;
  });

  return {
    base64: jpeg.split(",")[1],
    previewDataURL: jpeg,
    mediaType: "image/jpeg",
  };
}

const cropImageForCategory = (sourceDataUrl, category) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth,
        H = img.naturalHeight;
      const boxes = {
        top: { y: 0.04, h: 0.6 },
        outerwear: { y: 0.04, h: 0.72 },
        bottom: { y: 0.32, h: 0.65 },
        dress: { y: 0.04, h: 0.94 },
        footwear: { y: 0.62, h: 0.36 },
        bag: { y: 0.22, h: 0.6 },
        accessory: { y: 0.04, h: 0.48 },
      };
      const box = boxes[(category || "").toLowerCase()] || { y: 0.0, h: 1.0 };
      const sy = Math.round(H * box.y),
        sh = Math.round(H * box.h);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = sh;
      c.getContext("2d").drawImage(img, 0, sy, W, sh, 0, 0, W, sh);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
};

// ===================== COMPONENTS =====================

function WardrobeImage({ item, style = {} }) {
  if (!item.previewUrl) return null;
  return (
    <img
      src={item.previewUrl}
      alt={item.name || ""}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
        ...style,
      }}
    />
  );
}

function ScoreBar({ label, value }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    setTimeout(() => setWidth(value), 300);
  }, [value]);
  return (
    <div className="score-item">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${width}%` }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--taupe)", minWidth: 28 }}>
        {value}%
      </span>
    </div>
  );
}

function PieceCard({ role, item }) {
  return (
    <div className="outfit-piece">
      <div
        className="piece-visual"
        style={{
          background: item.previewUrl
            ? "#ede9e3"
            : `${item.color || item.colorHex || "#ccc"}22`,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {item.previewUrl ? (
          <WardrobeImage item={item} />
        ) : (
          <span style={{ fontSize: 32 }}>{item.emoji}</span>
        )}
      </div>
      <div className="piece-label">{role}</div>
      <div className="piece-name">{item.name}</div>
    </div>
  );
}

// ===================== TODAY PAGE =====================
function TodayPage({ onWear, savedItems }) {
  const [outfit, setOutfit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [previousIds, setPreviousIds] = useState([]);
  const [animKey, setAnimKey] = useState(0);

  const allItems =
    savedItems.length >= 2 ? savedItems : [...savedItems, ...WARDROBE_ITEMS];
  const greeting = getHourGreeting();

  const generateOutfit = async (isShuffle = false) => {
    setLoading(true);
    setError(null);
    const vibe = isShuffle
      ? SHUFFLE_VIBES[shuffleCount % SHUFFLE_VIBES.length]
      : null;
    try {
      const result = await generateOutfitWithAI(allItems, previousIds, vibe);
      setOutfit(result);
      setPreviousIds(result.pieces.map((p) => String(p.item.id)));
      setAnimKey((k) => k + 1);
      if (isShuffle) setShuffleCount((c) => c + 1);
    } catch (err) {
      setError(err.message || "Could not generate outfit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allItems.length >= 2) generateOutfit(false);
  }, [savedItems.length]);

  const scores = outfit?.scores || {
    balance: 0,
    formality: 0,
    color: 0,
    novelty: 0,
  };

  return (
    <div className="today-page page">
      <div className="today-hero">
        {/* LEFT */}
        <div className="today-greeting fade-up">
          <div className="greeting-eyebrow">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="greeting-title">
            {greeting}. <br />
            <em>Here's your look</em> <br />
            for today.
          </h1>
          <p className="greeting-sub">
            Curated from your wardrobe. Intelligent, intentional, yours.
          </p>
          <div className="weather-pill">
            <span>🌤</span>
            <span>Mumbai · 29°C · Partly Cloudy</span>
          </div>

          {loading && (
            <div
              className="outfit-card"
              style={{ padding: 40, textAlign: "center" }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 16,
                  animation: "spin 1.2s linear infinite",
                  display: "inline-block",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 20,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                {shuffleCount > 0
                  ? "Finding a new look..."
                  : "Curating your outfit..."}
              </div>
              <div style={{ fontSize: 12, color: "var(--taupe)" }}>
                Analyzing your wardrobe with color psychology
              </div>
            </div>
          )}

          {!loading && error && (
            <div
              className="outfit-card"
              style={{ padding: 40, textAlign: "center" }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
              <div
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 22,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 12,
                }}
              >
                Could not generate outfit
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--taupe)",
                  marginBottom: 20,
                  lineHeight: 1.6,
                  background: "rgba(196,184,164,0.3)",
                  padding: "12px 16px",
                  borderLeft: "2px solid var(--gold)",
                }}
              >
                {error === "AI returned no matching items" ? (
                  <>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      No matching items in wardrobe
                    </div>
                    <div>Try adding more pieces to get started.</div>
                  </>
                ) : error.includes("Rate limit") ? (
                  <>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      Too many requests
                    </div>
                    <div>Please wait a few minutes before trying again.</div>
                  </>
                ) : error.includes("No wardrobe items") ? (
                  <>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      Your wardrobe is empty
                    </div>
                    <div>
                      Upload your first pieces to unlock outfit generation.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      Error: {error}
                    </div>
                    <div>
                      Please try again or contact support if the problem
                      persists.
                    </div>
                  </>
                )}
              </div>
              <div
                style={{ display: "flex", gap: 12, justifyContent: "center" }}
              >
                {allItems.length < 2 && (
                  <button
                    className="btn-primary"
                    onClick={() => setPage("upload")}
                    style={{
                      padding: "12px 28px",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                    }}
                  >
                    ADD PIECES
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => generateOutfit(false)}
                  style={{
                    padding: "12px 28px",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                  }}
                >
                  RETRY
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !outfit && allItems.length < 2 && (
            <div
              className="outfit-card"
              style={{ padding: 40, textAlign: "center" }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>👗</div>
              <div
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 22,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Your wardrobe is waiting.
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--taupe)",
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Add at least 2 pieces to get your first AI-curated outfit.
              </div>
            </div>
          )}

          {!loading && outfit && (
            <div key={animKey} className="outfit-card fade-up">
              <div className="outfit-card-header">
                <span className="outfit-card-title">Today's Outfit</span>
                <span className="occasion-tag">{outfit.occasion}</span>
              </div>
              <div
                className="outfit-pieces"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(outfit.pieces.length, 4)}, 1fr)`,
                }}
              >
                {outfit.pieces.map(({ role, item }) => (
                  <PieceCard key={item.id} role={role} item={item} />
                ))}
              </div>
              {outfit.colorStory && (
                <div
                  style={{
                    padding: "10px 24px",
                    background: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--gold)",
                      marginRight: 8,
                    }}
                  >
                    Color Story
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--cream)",
                      opacity: 0.8,
                    }}
                  >
                    {outfit.colorStory}
                  </span>
                </div>
              )}
              <div className="outfit-reasoning">
                <span className="reasoning-icon">✦</span>
                <p className="reasoning-text">"{outfit.reasoning}"</p>
              </div>
              <div className="outfit-actions">
                <button className="btn-primary" onClick={() => onWear(outfit)}>
                  Wear This Today
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => generateOutfit(false)}
                >
                  Regenerate
                </button>
                <button
                  className={`btn-shuffle ${loading ? "spinning" : ""}`}
                  onClick={() => generateOutfit(true)}
                  title="Different vibe"
                  disabled={loading}
                >
                  ↻
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="today-sidebar" style={{ animationDelay: "0.15s" }}>
          <div className="sidebar-section">
            <p className="sidebar-heading">Style Score</p>
            <div className="style-score-bar">
              <ScoreBar label="Balance" value={scores.balance} />
              <ScoreBar label="Formality" value={scores.formality} />
              <ScoreBar label="Color" value={scores.color} />
              <ScoreBar label="Novelty" value={scores.novelty} />
            </div>
          </div>
          <div className="sidebar-section">
            <p className="sidebar-heading">Your Wardrobe</p>
            <div className="insight-card">
              <div className="insight-label">Collection</div>
              <div className="insight-text">
                {savedItems.length > 0
                  ? `${savedItems.length} piece${savedItems.length > 1 ? "s" : ""} saved · outfit engine active`
                  : "Upload your clothes to unlock AI styling"}
              </div>
            </div>
          </div>
          {outfit && (
            <div className="sidebar-section">
              <p className="sidebar-heading">Today's Pieces</p>
              <div className="last-worn-list">
                {outfit.pieces.map(({ role, item }) => (
                  <div key={item.id} className="last-worn-item">
                    <div
                      className="last-worn-dot"
                      style={{
                        background: item.colorHex || item.color || "#ccc",
                      }}
                    />
                    <span className="last-worn-name">{item.name}</span>
                    <span className="last-worn-date">{role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== WARDROBE PAGE =====================
function WardrobePage({ savedItems, onRemoveItem }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);

  const allItems = [...savedItems, ...WARDROBE_ITEMS];

  const filtered = allItems.filter((item) => {
    if (activeFilter === "All") return true;
    const cat = inferCategory(item);
    return cat === activeFilter.toLowerCase();
  });

  return (
    <div className="wardrobe-page page">
      <div className="page-header fade-up">
        <p className="page-eyebrow">Your Collection</p>
        <h1 className="page-title">Wardrobe</h1>
        <p className="page-count">
          {allItems.length} pieces · {savedItems.length} yours ·{" "}
          {WARDROBE_ITEMS.length} demo
        </p>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Filter</span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filter-chip ${activeFilter === cat ? "active" : ""}`}
            onClick={() => setActiveFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="wardrobe-grid">
        {filtered.map((item, i) => (
          <div
            key={item.id}
            className="wardrobe-item"
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => setSelectedItem(item)}
          >
            <div
              className="item-image"
              style={{
                background: item.previewUrl
                  ? "#f0ece6"
                  : `${item.color || item.colorHex || "#ccc"}18`,
              }}
            >
              {item.previewUrl ? (
                <WardrobeImage
                  item={item}
                  style={{ position: "absolute", inset: 0 }}
                />
              ) : (
                <span style={{ fontSize: 44, position: "relative", zIndex: 1 }}>
                  {item.emoji}
                </span>
              )}
              {item.isUploaded && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "var(--gold)",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                  }}
                />
              )}
            </div>
            <div className="item-info">
              <div className="item-type">{item.type || item.category}</div>
              <div className="item-name">{item.name}</div>
              <div className="item-meta">
                <span className="item-tag">{item.colorName}</span>
                <span className="item-tag">{item.formality}</span>
              </div>
            </div>
            <div className="item-overlay">
              <span className="item-overlay-text">View Details</span>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--taupe)",
                    marginBottom: 6,
                    fontWeight: 400,
                  }}
                >
                  {selectedItem.category}
                </div>
                <div
                  style={{
                    fontFamily: "Cormorant Garamond, serif",
                    fontSize: 28,
                    fontWeight: 300,
                    color: "var(--ink)",
                  }}
                >
                  {selectedItem.name}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {selectedItem.isUploaded && (
                  <button
                    onClick={() => {
                      onRemoveItem(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: "none",
                      border: "1px solid var(--linen)",
                      color: "var(--taupe)",
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                  >
                    Remove
                  </button>
                )}
                <button
                  className="modal-close"
                  onClick={() => setSelectedItem(null)}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div>
                <div
                  className="modal-image"
                  style={{
                    background: selectedItem.previewUrl
                      ? "#f0ece6"
                      : `${selectedItem.color || selectedItem.colorHex || "#ccc"}18`,
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  {selectedItem.previewUrl ? (
                    <WardrobeImage item={selectedItem} />
                  ) : (
                    <span style={{ fontSize: 72 }}>{selectedItem.emoji}</span>
                  )}
                </div>
              </div>
              <div className="modal-details">
                <div className="styling-note">
                  <div className="detail-block-label">Stylist Note</div>
                  <div
                    style={{
                      fontFamily: "Cormorant Garamond, serif",
                      fontSize: 16,
                      fontWeight: 300,
                      color: "var(--charcoal)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    "{selectedItem.note}"
                  </div>
                </div>
                <div>
                  <div className="detail-block-label">Details</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px 16px",
                    }}
                  >
                    {[
                      ["Color", selectedItem.colorName],
                      ["Pattern", selectedItem.pattern],
                      ["Fit", selectedItem.fit || "—"],
                      ["Formality", selectedItem.formality],
                      ["Season", selectedItem.season],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--taupe)",
                            marginBottom: 2,
                          }}
                        >
                          {k}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--charcoal)" }}>
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="detail-block-label">Pairs Well With</div>
                  <div className="pairing-chips">
                    {(selectedItem.pairsWith || []).map((p) => (
                      <span key={p} className="pairing-chip">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="detail-block-label">Wear History</div>
                  <div className="wear-count">
                    <div className="wear-dots">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`wear-dot ${i < (selectedItem.wornCount || 0) ? "" : "empty"}`}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--taupe)" }}>
                      {selectedItem.wornCount || 0}× worn
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== UPLOAD PAGE =====================
function UploadPage({ onSaveItem, savedItems }) {
  const [items, setItems] = useState([]);
  const [dragover, setDragover] = useState(false);

  const addAnalyzedItem = (item) => {
    setItems((prev) => [item, ...prev]);
  };

  const processFiles = async (files) => {
    const imageFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(f.name),
    );
    if (!imageFiles.length) return;

    for (const file of imageFiles) {
      const id = Date.now() + Math.random();
      const realType = await detectRealType(file);
      if (realType === "heic" || isHeicFile(file)) {
        setItems((prev) => [
          ...prev,
          {
            id,
            fileName: file.name,
            status: "heic",
            previewUrl: null,
            pieces: null,
            savedPieceIds: [],
            intent: null,
          },
        ]);
        continue;
      }

      setItems((prev) => [
        ...prev,
        {
          id,
          fileName: file.name,
          status: "reading",
          progress: 5,
          previewUrl: null,
          base64: null,
          mediaType: null,
          pieces: null,
          savedPieceIds: [],
          intent: null,
        },
      ]);

      let timer;
      try {
        const { base64, previewDataURL, mediaType } = await prepareImage(file);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  previewUrl: previewDataURL,
                  base64,
                  mediaType,
                  status: "analyzing",
                  progress: 20,
                }
              : it,
          ),
        );

        timer = setInterval(() => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id && it.progress < 85
                ? { ...it, progress: it.progress + Math.random() * 5 + 2 }
                : it,
            ),
          );
        }, 350);

        const pieces = await classifyClothingWithAI(base64, mediaType);
        const primaryCount = pieces.filter(
          (p) => !["accessory"].includes((p.category || "").toLowerCase()),
        ).length;

        let previews = null;
        if (primaryCount > 1) {
          previews = await Promise.all(
            pieces.map((piece) =>
              cropImageForCategory(previewDataURL, piece.category),
            ),
          );
        }

        clearInterval(timer);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: "ready",
                  progress: 100,
                  pieces,
                  piecePreviews: previews,
                }
              : it,
          ),
        );
      } catch (err) {
        clearInterval(timer);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: "error", error: err?.message || String(err) }
              : it,
          ),
        );
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    processFiles(e.dataTransfer.files);
  };
  const handleFileChange = (e) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  const saveFullOutfit = (item) => {
    const primaryPieces = (item.pieces || []).filter(
      (p) => !["accessory"].includes((p.category || "").toLowerCase()),
    );
    const derivedCategory =
      primaryPieces.length === 1
        ? (primaryPieces[0].category || "outfit").toLowerCase()
        : "outfit";
    const derivedType =
      primaryPieces.length === 1
        ? primaryPieces[0].type || primaryPieces[0].category
        : "Full Outfit";

    onSaveItem({
      id: `${item.id}-full`,
      name: item.pieces?.length
        ? item.pieces.map((p) => p.name).join(" + ")
        : item.fileName.replace(/\.[^.]+$/, "") || "Full Outfit",
      category: derivedCategory,
      type: derivedType,
      colorName: item.pieces?.[0]?.colorName || "",
      colorHex: item.pieces?.[0]?.colorHex || "#888",
      pattern: item.pieces?.[0]?.pattern || "",
      formality: item.pieces?.[0]?.formality || "Casual",
      season: item.pieces?.[0]?.season || "All-Season",
      note: item.pieces?.[0]?.note || "",
      pairsWith: item.pieces?.[0]?.pairsWith || [],
      emoji: item.pieces?.[0]?.emoji || "👗",
      previewUrl: item.previewUrl,
      color: item.pieces?.[0]?.colorHex || "#888",
      wornCount: 0,
      isUploaded: true,
      addedAt: new Date().toISOString(),
    });
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, intent: "full_outfit" } : it,
      ),
    );
  };

  const savePiece = async (item, piece, pieceIdx) => {
    const pieceId = `${item.id}-piece-${pieceIdx}`;
    if ((item.savedPieceIds || []).includes(pieceId)) return;

    const primaryPieces = (item.pieces || []).filter(
      (p) => !["accessory"].includes((p.category || "").toLowerCase()),
    );
    const isSoloPiece = primaryPieces.length <= 1;
    const imageUrl =
      !isSoloPiece && item.previewUrl
        ? await cropImageForCategory(item.previewUrl, piece.category)
        : item.previewUrl;

    onSaveItem({
      id: pieceId,
      ...piece,
      previewUrl: imageUrl,
      color: piece.colorHex || "#ccc",
      wornCount: 0,
      isUploaded: true,
      sourceUploadId: item.id,
      addedAt: new Date().toISOString(),
    });
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? { ...it, savedPieceIds: [...(it.savedPieceIds || []), pieceId] }
          : it,
      ),
    );
  };

  return (
    <div className="upload-page page">
      <div className="page-header fade-up">
        <p className="page-eyebrow">Build Your Wardrobe</p>
        <h1 className="page-title">Add Pieces</h1>
        <p className="page-count">
          Upload any photo — you choose how to save it
        </p>
      </div>

      <label
        className={`upload-zone ${dragover ? "dragover" : ""}`}
        style={{
          display: "block",
          cursor: "pointer",
          position: "relative",
          zIndex: 10,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <div className="upload-icon">↑</div>
        <div className="upload-title">Drop your photo here</div>
        <p className="upload-sub">
          Full outfit or single piece — you decide what to save
        </p>
      </label>

      {items.length > 0 && (
        <div style={{ marginTop: 32 }}>
          {items.map((item) => {
            if (item.status === "heic")
              return (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 24,
                    border: "1px solid var(--gold)",
                    background: "var(--paper)",
                    padding: "24px 28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "flex-start",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 28 }}>📸</div>
                    <div>
                      <div
                        style={{
                          fontFamily: "Cormorant Garamond, serif",
                          fontSize: 18,
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      >
                        iPhone HEIC photo — needs conversion
                      </div>
                      <div style={{ fontSize: 12, color: "var(--taupe)" }}>
                        <strong>{item.fileName}</strong> — convert then
                        re-upload.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <a
                      href="https://heictojpeg.net"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        padding: "12px",
                        background: "var(--ink)",
                        color: "var(--cream)",
                        textDecoration: "none",
                        textAlign: "center",
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Convert Online →
                    </a>
                    <div
                      style={{
                        padding: "12px",
                        background: "var(--linen)",
                        fontSize: 11,
                        color: "var(--charcoal)",
                        lineHeight: 1.5,
                      }}
                    >
                      Permanent fix: iPhone Settings → Camera → Formats →{" "}
                      <strong>Most Compatible</strong>
                    </div>
                  </div>
                </div>
              );

            if (item.status === "reading" || item.status === "analyzing")
              return (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 24,
                    border: "1px solid var(--linen)",
                    background: "var(--paper)",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: 120,
                      flexShrink: 0,
                      minHeight: 140,
                      background: "var(--linen)",
                      position: "relative",
                    }}
                  >
                    {item.previewUrl && (
                      <img
                        src={item.previewUrl}
                        alt=""
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center top",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "20px 24px" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--taupe)",
                        marginBottom: 10,
                      }}
                    >
                      {item.status === "reading"
                        ? "Preparing image..."
                        : `Identifying garments... ${Math.round(item.progress)}%`}
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );

            if (item.status === "error")
              return (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 24,
                    border: "1px solid #ecc",
                    background: "var(--paper)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      padding: "20px 24px",
                    }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0 }}>⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#c0392b",
                          marginBottom: 6,
                        }}
                      >
                        Analysis failed
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#a93226",
                          wordBreak: "break-word",
                          marginBottom: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {item.error?.includes("Rate limit") ? (
                          <>
                            Too many requests. Please wait a few seconds and try
                            again.
                          </>
                        ) : item.error?.includes("No valid JSON") ||
                          item.error?.includes("parse") ? (
                          <>
                            The image is unclear. Try a clearer photo with good
                            lighting and contrast.
                          </>
                        ) : item.error?.includes("Invalid image") ? (
                          <>
                            Invalid image format. Please use JPG, PNG, or WebP
                            files.
                          </>
                        ) : (
                          <>Error: {item.error}</>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter((it) => it.id !== item.id),
                          )
                        }
                        style={{
                          fontSize: 11,
                          background: "#c0392b",
                          color: "white",
                          border: "none",
                          padding: "8px 14px",
                          cursor: "pointer",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontFamily: "DM Sans, sans-serif",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );

            if (item.status !== "ready") return null;

            return (
              <div
                key={item.id}
                style={{
                  marginBottom: 32,
                  border: "1px solid var(--linen)",
                  background: "var(--paper)",
                }}
              >
                <div style={{ display: "flex" }}>
                  <div
                    style={{
                      width: 160,
                      flexShrink: 0,
                      minHeight: 210,
                      background: "var(--linen)",
                      position: "relative",
                    }}
                  >
                    {item.previewUrl && (
                      <img
                        src={item.previewUrl}
                        alt=""
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center top",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "24px 28px",
                      borderLeft: "1px solid var(--linen)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--gold)",
                        marginBottom: 8,
                      }}
                    >
                      {item.source === "instagram" ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                            fill="none"
                            stroke="var(--gold)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                          @{item.authorName || "instagram"} ·{" "}
                          {item.pieces?.length || 0} piece
                          {(item.pieces?.length || 0) !== 1 ? "s" : ""} detected
                        </span>
                      ) : (
                        `✦ ${item.pieces?.length || 0} piece${(item.pieces?.length || 0) !== 1 ? "s" : ""} detected`
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "Cormorant Garamond, serif",
                        fontSize: 21,
                        fontWeight: 300,
                        color: "var(--ink)",
                        marginBottom: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.pieces?.map((p) => p.name).join(", ")}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--taupe)",
                        marginBottom: 20,
                        lineHeight: 1.6,
                      }}
                    >
                      How would you like to save this?
                    </div>

                    {!item.intent && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <button
                          onClick={() => saveFullOutfit(item)}
                          style={{
                            background: "var(--ink)",
                            color: "var(--cream)",
                            border: "none",
                            padding: "14px 18px",
                            fontSize: 11,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontFamily: "DM Sans, sans-serif",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          ✦ Save as Full Outfit
                          <div
                            style={{
                              fontSize: 10,
                              opacity: 0.55,
                              marginTop: 3,
                              letterSpacing: "0.03em",
                              textTransform: "none",
                            }}
                          >
                            One wardrobe item · original photo · no crop
                          </div>
                        </button>
                        <button
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, intent: "individual" }
                                  : it,
                              ),
                            )
                          }
                          style={{
                            background: "transparent",
                            color: "var(--ink)",
                            border: "1px solid var(--ink)",
                            padding: "14px 18px",
                            fontSize: 11,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontFamily: "DM Sans, sans-serif",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          ▫ Save Individual Pieces
                          <div
                            style={{
                              fontSize: 10,
                              opacity: 0.55,
                              marginTop: 3,
                              letterSpacing: "0.03em",
                              textTransform: "none",
                            }}
                          >
                            Pick which pieces to save · each gets its own
                            cropped image
                          </div>
                        </button>
                      </div>
                    )}

                    {item.intent === "full_outfit" && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--gold)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontWeight: 500,
                        }}
                      >
                        ✓ Full outfit saved to wardrobe
                      </div>
                    )}
                    {item.intent === "individual" && (
                      <div style={{ fontSize: 12, color: "var(--taupe)" }}>
                        Tap "+ Save" on the pieces you want below ↓
                      </div>
                    )}
                  </div>
                </div>

                {item.intent === "individual" && item.pieces?.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--linen)" }}>
                    <div
                      style={{
                        padding: "14px 20px 10px",
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--taupe)",
                      }}
                    >
                      Save only what you want — accessories are optional
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(148px, 1fr))",
                        gap: 1,
                        background: "var(--linen)",
                      }}
                    >
                      {item.pieces.map((piece, idx) => {
                        const pieceId = `${item.id}-piece-${idx}`;
                        const isSaved = (item.savedPieceIds || []).includes(
                          pieceId,
                        );
                        const OBJ_POS = {
                          top: "50% 38%",
                          outerwear: "50% 32%",
                          bottom: "50% 28%",
                          dress: "50% 40%",
                          footwear: "50% 80%",
                          bag: "50% 48%",
                          accessory: "50% 32%",
                        };
                        const objPos =
                          OBJ_POS[(piece.category || "").toLowerCase()] ||
                          "50% 40%";
                        const previewSrc =
                          item.piecePreviews?.[idx] || item.previewUrl;
                        return (
                          <div
                            key={idx}
                            style={{
                              background: "var(--paper)",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "1/1",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              <img
                                src={previewSrc}
                                alt=""
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  objectPosition: objPos,
                                  filter: isSaved ? "brightness(0.6)" : "none",
                                }}
                              />
                              {isSaved && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "var(--gold)",
                                      color: "var(--ink)",
                                      fontSize: 9,
                                      letterSpacing: "0.1em",
                                      textTransform: "uppercase",
                                      fontWeight: 600,
                                      padding: "5px 12px",
                                    }}
                                  >
                                    ✓ Saved
                                  </div>
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                padding: "10px 12px",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  color: "var(--taupe)",
                                }}
                              >
                                {piece.category}
                              </div>
                              <div
                                style={{
                                  fontFamily: "Cormorant Garamond, serif",
                                  fontSize: 14,
                                  color: "var(--ink)",
                                  lineHeight: 1.3,
                                }}
                              >
                                {piece.name}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                {[piece.colorName, piece.formality]
                                  .filter(Boolean)
                                  .map((t) => (
                                    <span
                                      key={t}
                                      className="analyzing-tag"
                                      style={{ fontSize: 9 }}
                                    >
                                      {t}
                                    </span>
                                  ))}
                              </div>
                              {!isSaved && (
                                <button
                                  onClick={() => savePiece(item, piece, idx)}
                                  style={{
                                    marginTop: "auto",
                                    background: "var(--ink)",
                                    color: "var(--cream)",
                                    border: "none",
                                    padding: "7px 10px",
                                    fontSize: 9,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    fontFamily: "DM Sans, sans-serif",
                                    cursor: "pointer",
                                    fontWeight: 500,
                                    width: "100%",
                                  }}
                                >
                                  + Save this piece
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 48,
          padding: "32px",
          background: "var(--paper)",
          border: "1px solid var(--linen)",
        }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--taupe)",
            marginBottom: 16,
            fontWeight: 400,
          }}
        >
          What we detect
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {[
            {
              icon: "🏷",
              label: "Category & Type",
              desc: "Top, bottom, footwear, and 12 subcategories",
            },
            {
              icon: "🎨",
              label: "Color Analysis",
              desc: "Primary + secondary with exact values",
            },
            {
              icon: "✂️",
              label: "Fit & Cut",
              desc: "Oversized, fitted, relaxed, cropped, longline",
            },
            {
              icon: "🌿",
              label: "Pattern",
              desc: "Solid, striped, printed, textured, embellished",
            },
            {
              icon: "🌦",
              label: "Seasonality",
              desc: "Summer, winter, transitional, all-season",
            },
            {
              icon: "🥂",
              label: "Occasion",
              desc: "Casual to formal — matched to your lifestyle",
            },
          ].map(({ icon, label, desc }) => (
            <div
              key={label}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--linen)",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "var(--charcoal)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--taupe)",
                  lineHeight: 1.4,
                  fontWeight: 300,
                }}
              >
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================== ONBOARDING DATA =====================
const STYLE_TAGS = [
  "Minimal",
  "Classic",
  "Streetwear",
  "Bohemian",
  "Preppy",
  "Avant-Garde",
  "Romantic",
  "Edgy",
  "Athleisure",
  "Maximalist",
  "Business Casual",
  "Cottagecore",
  "Dark Academia",
  "Y2K",
  "Old Money",
];
const BODY_TYPES = [
  {
    id: "nothing-to-wear",
    label: "I have a full wardrobe and nothing to wear",
    desc: "Too many pieces, zero outfits",
  },
  {
    id: "repeat-outfits",
    label: "I wear the same 5 things on repeat",
    desc: "The rest just hangs there",
  },
  {
    id: "impulse-buying",
    label: "I keep buying things that don't go with anything",
    desc: "Always shopping, never satisfied",
  },
  {
    id: "no-identity",
    label: "I don't know what my style actually is",
    desc: "I dress differently every week",
  },
  {
    id: "occasions",
    label: "I never know what to wear for specific occasions",
    desc: "Events, meetings, dates — always a panic",
  },
  {
    id: "trends",
    label: "I chase trends and regret it",
    desc: "My wardrobe is a graveyard of mistakes",
  },
  {
    id: "time",
    label: "Getting dressed takes too long",
    desc: "I need a system, not another scroll",
  },
];

// ===================== ONBOARDING =====================
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [styles, setStyles] = useState([]);
  const [issues, setIssues] = useState([]);

  const toggleStyle = (tag) => {
    setStyles((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleIssue = (id) => {
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

      {/* Progress */}
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

      {/* Step 1 — Style */}
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
              What's your <em style={{ fontStyle: "italic" }}>aesthetic?</em>
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
            {STYLE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleStyle(tag)}
                style={{
                  padding: "10px 20px",
                  background: styles.includes(tag)
                    ? "var(--ink)"
                    : "var(--paper)",
                  color: styles.includes(tag)
                    ? "var(--cream)"
                    : "var(--warm-gray)",
                  border: `1px solid ${styles.includes(tag) ? "var(--ink)" : "var(--linen)"}`,
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {tag}
              </button>
            ))}
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

      {/* Step 2 — Body Type */}
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
              What's your biggest{" "}
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
            {BODY_TYPES.map((bt) => {
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
                    border: `1px solid ${selected ? "var(--gold)" : maxed ? "var(--linen)" : "var(--linen)"}`,
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

// ===================== LANDING PAGE =====================
function Landing({ onEnter }) {
  const features = [
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
          onMouseEnter={(e) => (e.target.style.borderColor = "var(--gold)")}
          onMouseLeave={(e) => (e.target.style.borderColor = "var(--linen)")}
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
            onMouseEnter={(e) => (e.target.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.target.style.opacity = "1")}
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
              e.target.style.borderColor = "var(--taupe)";
              e.target.style.color = "var(--charcoal)";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "var(--linen)";
              e.target.style.color = "var(--warm-gray)";
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
        {features.map((f, i) => (
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

// ===================== AUTH SCREEN =====================
// ── JWT decoder (no library needed) ──────────────────────────────────────────
function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Load Google Identity Services script once ─────────────────────────────────
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById("gis-script");
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── GOOGLE CLIENT ID — set yours here or via env ──────────────────────────────
// Get one free at: console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0
// Add your Vercel domain + localhost:3000 to Authorized JS origins
const GOOGLE_CLIENT_ID =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    : "YOUR_GOOGLE_CLIENT_ID_HERE"; // ← replace this

function Auth({ onAuth }) {
  const [mode, setMode] = useState("choose"); // choose | email-signup | email-login
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientIdMissing, setClientIdMissing] = useState(false);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
      setClientIdMissing(true);
      return;
    }
    loadGisScript()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            const payload = decodeJwt(response.credential);
            if (!payload) {
              setError("Google sign-in failed — could not read profile.");
              return;
            }

            // Call actual GoogleAuth API
            setLoading(true);
            try {
              const authResponse = await apiClient.auth.googleAuth(
                response.credential,
              );
              if (authResponse.success && authResponse.data) {
                onAuth(authResponse.data.user);
              } else {
                setError(
                  authResponse.error ||
                    "Google sign-in failed. Please try again.",
                );
              }
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Google sign-in failed. Please try again.",
              );
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
      // Render a hidden button and programmatically click it — most reliable cross-browser
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap not available — fall back to popup via renderButton trick
          setLoading(false);
          const tmp = document.createElement("div");
          tmp.style.cssText =
            "position:fixed;opacity:0;pointer-events:none;top:0;left:0;";
          document.body.appendChild(tmp);
          window.google.accounts.id.renderButton(tmp, {
            type: "standard",
            theme: "outline",
            size: "large",
          });
          setTimeout(() => {
            tmp.querySelector("div[role=button]")?.click();
            setTimeout(() => document.body.removeChild(tmp), 5000);
          }, 100);
        }
      });
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
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
      let response;
      if (mode === "email-signup") {
        // Call register endpoint
        response = await apiClient.auth.register(
          email,
          password,
          name || email.split("@")[0],
        );
      } else {
        // Call login endpoint
        response = await apiClient.auth.login(email, password);
      }

      if (response.success && response.data) {
        onAuth(response.data.user);
      } else {
        setError(response.error || "Authentication failed. Please try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
      }}
    >
      {/* Left panel — editorial */}
      <div
        style={{
          flex: 1,
          background: "var(--sand)",
          display: "none",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          position: "relative",
          overflow: "hidden",
        }}
        className="auth-left-panel"
      >
        <style>{`@media (min-width: 768px) { .auth-left-panel { display: flex !important; } } @media (min-width: 768px) { .auth-right-panel { width: 460px !important; } }`}</style>
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
            {[
              "Your AI outfit, ready every morning",
              "Color psychology applied to your wardrobe",
              "Learns your style over time",
            ].map((line) => (
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
        {/* Decorative */}
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

      {/* Right panel — auth form */}
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

              {/* Setup notice if Client ID not yet configured */}
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
                        GOOGLE_CLIENT_ID
                      </code>{" "}
                      in the code
                    </li>
                  </ol>
                </div>
              )}

              {/* Google */}
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
                    <label
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--taupe)",
                        display: "block",
                        marginBottom: 7,
                        fontWeight: 400,
                      }}
                    >
                      Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      style={{
                        width: "100%",
                        background: "var(--paper)",
                        border: "1px solid var(--linen)",
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "var(--charcoal)",
                        fontFamily: "DM Sans, sans-serif",
                        outline: "none",
                      }}
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
                  <label
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--taupe)",
                      display: "block",
                      marginBottom: 7,
                      fontWeight: 400,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    style={{
                      width: "100%",
                      background: "var(--paper)",
                      border: "1px solid var(--linen)",
                      padding: "12px 14px",
                      fontSize: 13,
                      color: "var(--charcoal)",
                      fontFamily: "DM Sans, sans-serif",
                      outline: "none",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--gold)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--linen)")
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--taupe)",
                      display: "block",
                      marginBottom: 7,
                      fontWeight: 400,
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      background: "var(--paper)",
                      border: "1px solid var(--linen)",
                      padding: "12px 14px",
                      fontSize: 13,
                      color: "var(--charcoal)",
                      fontFamily: "DM Sans, sans-serif",
                      outline: "none",
                    }}
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
            By continuing, you agree to ALT FIT's Terms of Service and Privacy
            Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  // screen: "landing" | "auth" | "onboarding" | "app"
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("today");
  const [toast, setToast] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null); // null | "monthly" | "yearly"
  const [showPaywall, setShowPaywall] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Check if user is already logged in via API client
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("accessToken");

        // Get wardrobe items and profile from localStorage
        let wardrobeResult = null;
        let profileResult = null;
        let planResult = null;

        try {
          const wardrobeData = localStorage.getItem("wardrobe-items");
          const profileData = localStorage.getItem("altfit-profile");
          const planData = localStorage.getItem("altfit-plan");

          wardrobeResult = wardrobeData ? { value: wardrobeData } : null;
          profileResult = profileData ? { value: profileData } : null;
          planResult = planData ? { value: planData } : null;
        } catch (e) {
          console.error("Failed to read from localStorage:", e);
        }

        const savedUser = storedUser ? JSON.parse(storedUser) : null;
        const savedProfile = profileResult?.value
          ? JSON.parse(profileResult.value)
          : null;

        if (wardrobeResult?.value) {
          const items = JSON.parse(wardrobeResult.value);
          const migrated = items.map((item) =>
            !item.category || item.category === "full_outfit"
              ? { ...item, category: inferCategory(item) }
              : item,
          );
          setSavedItems(migrated);
          if (migrated.some((m, i) => m.category !== items[i].category)) {
            try {
              localStorage.setItem("wardrobe-items", JSON.stringify(migrated));
            } catch (e) {
              console.error("Failed to save wardrobe items:", e);
            }
          }
        }

        if (planResult?.value) setPlan(JSON.parse(planResult.value));

        if (savedUser && token) {
          setUser(savedUser);
          setProfile(savedProfile);
          setScreen(savedProfile ? "app" : "onboarding");
        } else {
          setScreen("landing");
        }
      } catch {
        setScreen("landing");
      }
    }
    init();
  }, []);

  const handleAuth = async (userData) => {
    // userData already contains the user data from API
    setUser(userData);
    // Note: API client already stored the token in localStorage automatically
    setScreen("onboarding");
  };

  const handleOnboardingComplete = async (profileData) => {
    setProfile(profileData);
    try {
      localStorage.setItem("altfit-profile", JSON.stringify(profileData));
    } catch (e) {
      console.error("Failed to save profile:", e);
    }
    setScreen("app");
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleUpgrade = async (selectedPlan) => {
    setPlan(selectedPlan);
    setShowPaywall(false);
    try {
      localStorage.setItem("altfit-plan", JSON.stringify(selectedPlan));
    } catch (e) {
      console.error("Failed to save plan:", e);
    }
    showToast("Welcome to ALT FIT Pro ✦");
  };

  const handleSaveItem = async (item) => {
    const userItems = savedItems.filter((i) => i.isUploaded);
    if (!plan && userItems.length >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }
    const updated = [item, ...savedItems.filter((i) => i.id !== item.id)];
    setSavedItems(updated);
    try {
      localStorage.setItem("wardrobe-items", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save wardrobe items:", e);
    }
    showToast(`"${item.name}" saved to your wardrobe`);
    setTimeout(() => setPage("wardrobe"), 1200);
  };

  const handleRemoveItem = async (id) => {
    const updated = savedItems.filter((i) => i.id !== id);
    setSavedItems(updated);
    try {
      localStorage.setItem("wardrobe-items", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save wardrobe items:", e);
    }
    showToast("Item removed from wardrobe");
  };

  const handleSignOut = async () => {
    try {
      // Call API logout to invalidate session on backend
      await apiClient.auth.logout();
    } catch (e) {
      console.error("Failed to logout from backend:", e);
    }

    // Clear local UI state
    setUser(null);
    setProfile(null);
    setSavedItems([]);
    setScreen("landing");
  };

  if (screen === "loading")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--sand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: 22,
            fontWeight: 300,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink)",
            animation: "fadeIn 1s ease",
          }}
        >
          ALT <span style={{ color: "var(--gold)" }}>F</span>IT
        </div>
      </div>
    );

  return (
    <>
      <style>{GOOGLE_FONTS + styles}</style>
      <div className="app">
        {screen === "landing" && <Landing onEnter={() => setScreen("auth")} />}
        {screen === "auth" && <Auth onAuth={handleAuth} />}
        {screen === "onboarding" && (
          <Onboarding onComplete={handleOnboardingComplete} />
        )}
        {screen === "app" && (
          <>
            {/* ── MOBILE TOP BAR ── */}
            <div className="mobile-topbar">
              <div className="mobile-logo">
                ALT <span>F</span>IT
              </div>
              {/* Profile avatar */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "var(--ink)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Cormorant Garamond, serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--cream)",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </button>
                {profileOpen && (
                  <>
                    <div
                      onClick={() => setProfileOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 149 }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        right: 0,
                        width: 200,
                        background: "var(--cream)",
                        border: "1px solid var(--linen)",
                        boxShadow: "0 8px 32px rgba(46,33,24,0.14)",
                        zIndex: 150,
                        animation: "fadeUp 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          padding: "16px 18px 12px",
                          borderBottom: "1px solid var(--linen)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 2,
                          }}
                        >
                          {user?.name || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--taupe)",
                            fontWeight: 300,
                          }}
                        >
                          {user?.email || ""}
                        </div>
                        {plan && (
                          <div
                            style={{
                              fontSize: 9,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "var(--gold)",
                              marginTop: 6,
                            }}
                          >
                            Pro · {plan}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "8px 0" }}>
                        {[
                          {
                            label: "Style Profile",
                            icon: "◈",
                            action: () => {
                              setProfileOpen(false);
                              showToast("Style Profile — coming soon");
                            },
                          },
                          {
                            label: "Preferences",
                            icon: "⊹",
                            action: () => {
                              setProfileOpen(false);
                              showToast("Preferences — coming soon");
                            },
                          },
                        ].map(({ label, icon, action }) => (
                          <button
                            key={label}
                            onClick={action}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 18px",
                              background: "none",
                              border: "none",
                              fontSize: 12,
                              color: "var(--charcoal)",
                              cursor: "pointer",
                              fontFamily: "DM Sans, sans-serif",
                              textAlign: "left",
                            }}
                          >
                            <span
                              style={{ color: "var(--gold)", fontSize: 13 }}
                            >
                              {icon}
                            </span>
                            {label}
                          </button>
                        ))}
                        <div
                          style={{
                            height: 1,
                            background: "var(--linen)",
                            margin: "6px 0",
                          }}
                        />
                        <button
                          onClick={() => {
                            setProfileOpen(false);
                            handleSignOut();
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 18px",
                            background: "none",
                            border: "none",
                            fontSize: 12,
                            color: "var(--warm-gray)",
                            cursor: "pointer",
                            fontFamily: "DM Sans, sans-serif",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>↩</span>Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── DESKTOP NAV ── */}
            <nav className="nav">
              <div className="nav-logo" onClick={() => setPage("today")}>
                ALT <span>F</span>IT
              </div>
              <div className="nav-links">
                {[
                  { id: "today", label: "Today" },
                  {
                    id: "wardrobe",
                    label: `Wardrobe${savedItems.length ? ` · ${savedItems.length}` : ""}`,
                  },
                  { id: "upload", label: "Add Pieces" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    className={`nav-link ${page === id ? "active" : ""}`}
                    onClick={() => setPage(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  className="nav-upload"
                  onClick={() => setPage("upload")}
                >
                  + Upload
                </button>
                {/* Profile avatar + dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setProfileOpen((o) => !o)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: profileOpen
                        ? "var(--charcoal)"
                        : "var(--ink)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Cormorant Garamond, serif",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--cream)",
                      letterSpacing: "0.04em",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </button>
                  {profileOpen && (
                    <>
                      <div
                        onClick={() => setProfileOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 149 }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 12px)",
                          right: 0,
                          width: 220,
                          background: "var(--cream)",
                          border: "1px solid var(--linen)",
                          boxShadow: "0 8px 40px rgba(46,33,24,0.16)",
                          zIndex: 150,
                          animation: "fadeUp 0.2s ease",
                        }}
                      >
                        {/* Arrow */}
                        <div
                          style={{
                            position: "absolute",
                            top: -5,
                            right: 14,
                            width: 10,
                            height: 10,
                            background: "var(--cream)",
                            border: "1px solid var(--linen)",
                            transform: "rotate(45deg)",
                            borderBottom: "none",
                            borderRight: "none",
                          }}
                        />
                        <div
                          style={{
                            padding: "18px 20px 14px",
                            borderBottom: "1px solid var(--linen)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--ink)",
                              marginBottom: 3,
                            }}
                          >
                            {user?.name || "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--taupe)",
                              fontWeight: 300,
                            }}
                          >
                            {user?.email || ""}
                          </div>
                          {plan && (
                            <div
                              style={{
                                fontSize: 9,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "var(--gold)",
                                marginTop: 6,
                                fontWeight: 500,
                              }}
                            >
                              ✦ Pro · {plan}
                            </div>
                          )}
                          {!plan && (
                            <div
                              style={{
                                fontSize: 9,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                color: "var(--taupe)",
                                marginTop: 6,
                              }}
                            >
                              Free ·{" "}
                              {10 -
                                savedItems.filter((i) => i.isUploaded)
                                  .length}{" "}
                              uploads left
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "8px 0" }}>
                          {[
                            {
                              label: "Style Profile",
                              icon: "◈",
                              action: () => {
                                setProfileOpen(false);
                                showToast("Style Profile — coming soon");
                              },
                            },
                            {
                              label: "Preferences",
                              icon: "⊹",
                              action: () => {
                                setProfileOpen(false);
                                showToast("Preferences — coming soon");
                              },
                            },
                          ].map(({ label, icon, action }) => (
                            <button
                              key={label}
                              onClick={action}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 20px",
                                background: "none",
                                border: "none",
                                fontSize: 12,
                                color: "var(--charcoal)",
                                cursor: "pointer",
                                fontFamily: "DM Sans, sans-serif",
                                textAlign: "left",
                                transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--paper)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                              }
                            >
                              <span
                                style={{
                                  color: "var(--gold)",
                                  fontSize: 13,
                                  width: 16,
                                }}
                              >
                                {icon}
                              </span>
                              {label}
                            </button>
                          ))}
                          <div
                            style={{
                              height: 1,
                              background: "var(--linen)",
                              margin: "6px 0",
                            }}
                          />
                          <button
                            onClick={() => {
                              setProfileOpen(false);
                              handleSignOut();
                            }}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 20px",
                              background: "none",
                              border: "none",
                              fontSize: 12,
                              color: "var(--warm-gray)",
                              cursor: "pointer",
                              fontFamily: "DM Sans, sans-serif",
                              textAlign: "left",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--paper)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "none")
                            }
                          >
                            <span style={{ fontSize: 13, width: 16 }}>↩</span>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </nav>

            {/* ── PAGES ── */}
            {page === "today" && (
              <TodayPage
                savedItems={savedItems}
                onWear={(outfit) =>
                  showToast(`Look saved — wearing "${outfit.occasion}" today.`)
                }
              />
            )}
            {page === "wardrobe" && (
              <WardrobePage
                savedItems={savedItems}
                onRemoveItem={handleRemoveItem}
              />
            )}
            {page === "upload" && (
              <UploadPage onSaveItem={handleSaveItem} savedItems={savedItems} />
            )}

            {/* ── MOBILE BOTTOM TAB BAR ── */}
            <div className="tab-bar">
              <button
                className={`tab-item ${page === "today" ? "active" : ""}`}
                onClick={() => setPage("today")}
              >
                <span className="tab-icon">✦</span>
                <span className="tab-label">Today</span>
              </button>
              <button
                className={`tab-item ${page === "wardrobe" ? "active" : ""}`}
                onClick={() => setPage("wardrobe")}
              >
                <span className="tab-icon">👗</span>
                <span className="tab-label">
                  Wardrobe{savedItems.length ? ` · ${savedItems.length}` : ""}
                </span>
              </button>
              <button
                className="tab-upload-btn"
                onClick={() => setPage("upload")}
              >
                <div
                  className="tab-upload-inner"
                  style={{
                    background:
                      page === "upload" ? "var(--gold)" : "var(--ink)",
                  }}
                >
                  +
                </div>
              </button>
              <button
                className={`tab-item`}
                onClick={() => setProfileOpen((o) => !o)}
              >
                <span className="tab-icon" style={{ fontSize: 18 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "var(--ink)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Cormorant Garamond, serif",
                      fontSize: 13,
                      color: "var(--cream)",
                      fontWeight: 500,
                    }}
                  >
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                </span>
                <span className="tab-label">Profile</span>
              </button>
            </div>

            {showPaywall && (
              <Paywall
                itemCount={savedItems.filter((i) => i.isUploaded).length}
                onUpgrade={handleUpgrade}
                onClose={() => setShowPaywall(false)}
                userEmail={user?.email}
              />
            )}

            {toast && (
              <div
                style={{
                  position: "fixed",
                  bottom: 80,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--ink)",
                  color: "var(--cream)",
                  padding: "12px 24px",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  animation: "fadeUp 0.3s ease",
                  zIndex: 300,
                  whiteSpace: "nowrap",
                }}
              >
                {toast}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
