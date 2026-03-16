"use client";

import { useState } from "react";
import { Box, Stack } from "@mui/material";
import ProfileDropdown from "./ProfileDropdown";

interface MobileTabBarProps {
  page: string;
  savedItemCount: number;
  user: { name?: string | null } | null;
  plan: string | null;
  onPageChange: (page: string) => void;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
}

export default function MobileTabBar({
  page,
  savedItemCount,
  user,
  plan,
  onPageChange,
  onSignOut,
  onShowToast,
}: MobileTabBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box className="tab-bar">
      <button
        className={`tab-item ${page === "today" ? "active" : ""}`}
        onClick={() => onPageChange("today")}
      >
        <span className="tab-icon">❆</span>
        <span className="tab-label">Today</span>
      </button>
      <button
        className={`tab-item ${page === "wardrobe" ? "active" : ""}`}
        onClick={() => onPageChange("wardrobe")}
      >
        <span className="tab-icon">👗</span>
        <span className="tab-label">
          Wardrobe{savedItemCount ? ` · ${savedItemCount}` : ""}
        </span>
      </button>
      <button className="tab-upload-btn" onClick={() => onPageChange("upload")}>
        <Box
          className="tab-upload-inner"
          sx={{
            background: page === "upload" ? "var(--gold)" : "var(--ink)",
          }}
        >
          +
        </Box>
      </button>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <button
          className="tab-item"
          onClick={() => setProfileOpen((o) => !o)}
          style={{ width: "100%", flex: "unset" }}
        >
          <span className="tab-icon" style={{ fontSize: 18 }}>
            <Stack
              alignItems="center"
              justifyContent="center"
              component="span"
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--ink)",
                display: "inline-flex",
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 13,
                color: "var(--cream)",
                fontWeight: 500,
              }}
            >
              {(user?.name || "U").charAt(0).toUpperCase()}
            </Stack>
          </span>
          <span className="tab-label">Profile</span>
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
      </Box>
    </Box>
  );
}
