"use client";

import { useState } from "react";
import ProfileDropdown from "./ProfileDropdown";

interface MobileTopBarProps {
  user: { name?: string | null; email?: string | null } | null;
  plan: string | null;
  savedItemCount: number;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
}

export default function MobileTopBar({
  user,
  plan,
  savedItemCount,
  onSignOut,
  onShowToast,
}: MobileTopBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="mobile-topbar">
      <div className="mobile-logo">
        ALT <span>F</span>IT
      </div>
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
          <ProfileDropdown
            user={user}
            plan={plan}
            savedItemCount={savedItemCount}
            onClose={() => setProfileOpen(false)}
            onSignOut={onSignOut}
            onShowToast={onShowToast}
            isMobile
          />
        )}
      </div>
    </div>
  );
}
