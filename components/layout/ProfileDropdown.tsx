"use client";

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
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 149 }}
      />
      <div
        style={{
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
        )}
        <div
          style={{
            padding: isMobile ? "16px 18px 12px" : "18px 20px 14px",
            borderBottom: "1px solid var(--linen)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: isMobile ? 2 : 3,
            }}
          >
            {user?.name || "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--taupe)", fontWeight: 300 }}>
            {user?.email || ""}
          </div>
          {plan ? (
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--gold)",
                marginTop: 6,
                fontWeight: isMobile ? undefined : 500,
              }}
            >
              {isMobile ? `Pro · ${plan}` : `✦ Pro · ${plan}`}
            </div>
          ) : !isMobile ? (
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: "var(--taupe)",
                marginTop: 6,
              }}
            >
              Free · {10 - savedItemCount} uploads left
            </div>
          ) : null}
        </div>
        <div style={{ padding: "8px 0" }}>
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
              <span style={{ color: "var(--gold)", fontSize: 13, width: 16 }}>
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
            <span style={{ fontSize: 13, width: 16 }}>↩</span>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
