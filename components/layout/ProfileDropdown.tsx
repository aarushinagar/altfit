/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { Box, Stack } from "@mui/material";

interface ProfileDropdownProps {
  user: { name?: string | null; email?: string | null } | null;
  plan: string | null;
  savedItemCount?: number;
  onClose: () => void;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
  isMobile?: boolean;
}

export default function ProfileDropdown({
  user,
  plan,
  savedItemCount = 0,
  onClose,
  onSignOut,
  onShowToast,
  isMobile = false,
}: ProfileDropdownProps) {
  return (
    <>
      <Box
        onClick={onClose}
        sx={{ position: "fixed", inset: 0, zIndex: 149 }}
      />
      <Box
        sx={{
          position: "absolute",
          top: "calc(100% + 10px)",
          right: 0,
          width: isMobile ? 200 : 220,
          background: "var(--cream)",
          border: "1px solid var(--linen)",
          boxShadow: "0 8px 32px rgba(46,33,24,0.14)",
          zIndex: 150,
          animation: "fadeUp 0.2s ease",
        }}
      >
        {!isMobile && (
          <Box
            sx={{
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
        )}
        <Box
          sx={{
            padding: isMobile ? "16px 18px 12px" : "18px 20px 14px",
            borderBottom: "1px solid var(--linen)",
          }}
        >
          <Box
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: isMobile ? 2 : 3,
            }}
          >
            {user?.name || "—"}
          </Box>
          <Box sx={{ fontSize: 11, color: "var(--taupe)", fontWeight: 300 }}>
            {user?.email || ""}
          </Box>
          {plan ? (
            <Box
              sx={{
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--gold)",
                marginTop: "6px",
                fontWeight: isMobile ? undefined : 500,
              }}
            >
              {isMobile ? `Pro · ${plan}` : `✦ Pro · ${plan}`}
            </Box>
          ) : !isMobile ? (
            <Box
              sx={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--taupe)",
                marginTop: "6px",
              }}
            >
              Free · {10 - savedItemCount} uploads left
            </Box>
          ) : null}
        </Box>
        <Box sx={{ padding: "8px 0" }}>
          {[
            {
              label: "Style Profile",
              icon: "◈",
              action: () => {
                onClose();
                onShowToast("Style Profile — coming soon");
              },
            },
            {
              label: "Preferences",
              icon: "⊹",
              action: () => {
                onClose();
                onShowToast("Preferences — coming soon");
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
                padding: isMobile ? "10px 18px" : "10px 20px",
                background: "none",
                border: "none",
                fontSize: 12,
                color: "var(--charcoal)",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
                textAlign: "left" as const,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--paper)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <Box
                component="span"
                sx={{ color: "var(--gold)", fontSize: 13, width: 16 }}
              >
                {icon}
              </Box>
              {label}
            </button>
          ))}
          <Box
            sx={{
              height: 1,
              background: "var(--linen)",
              margin: "6px 0",
            }}
          />
          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isMobile ? "10px 18px" : "10px 20px",
              background: "none",
              border: "none",
              fontSize: 12,
              color: "var(--warm-gray)",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
              textAlign: "left" as const,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--paper)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <Box component="span" sx={{ fontSize: 13, width: 16 }}>
              ↩
            </Box>
            Sign Out
          </button>
        </Box>
      </Box>
    </>
  );
}
