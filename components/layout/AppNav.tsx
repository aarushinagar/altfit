"use client";

import { useState } from "react";
import ProfileDropdown from "./ProfileDropdown";

interface NavProps {
  page: string;
  savedItemCount: number;
  plan: string | null;
  user: { name?: string | null; email?: string | null } | null;
  onPageChange: (page: string) => void;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
}

export default function AppNav({
  page,
  savedItemCount,
  plan,
  user,
  onPageChange,
  onSignOut,
  onShowToast,
}: NavProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => onPageChange("today")}>
        ALT <span>F</span>IT
      </div>
      <div className="nav-links">
        {[
          { id: "today", label: "Today" },
          {
            id: "wardrobe",
            label: `Wardrobe${savedItemCount ? ` · ${savedItemCount}` : ""}`,
          },
          { id: "upload", label: "Add Pieces" },
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`nav-link ${page === id ? "active" : ""}`}
            onClick={() => onPageChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button className="nav-upload" onClick={() => onPageChange("upload")}>
          + Upload
        </button>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: profileOpen ? "var(--charcoal)" : "var(--ink)",
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
            <ProfileDropdown
              user={user}
              plan={plan}
              onClose={() => setProfileOpen(false)}
              onSignOut={onSignOut}
              onShowToast={onShowToast}
              savedItemCount={savedItemCount}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
