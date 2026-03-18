"use client";

import { Box, Stack } from "@mui/material";

interface NavProps {
  page: string;
  savedItemCount: number;
  savedOutfitsCount: number;
  plan: string | null;
  user: { name?: string | null; email?: string | null } | null;
  isOpen: boolean;
  onPageChange: (page: string) => void;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
  onClose: () => void;
}

const NAV_ITEMS = [
  { id: "today", label: "Today" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "saved-outfits", label: "Saved Outfits" },
  { id: "upload", label: "Add Pieces" },
];

export default function AppNav({
  page,
  savedItemCount,
  savedOutfitsCount,
  plan,
  user,
  isOpen,
  onPageChange,
  onSignOut,
  onClose,
}: NavProps) {
  const initial = (user?.name || "U").charAt(0).toUpperCase();

  const navigate = (id: string) => {
    onPageChange(id);
    onClose();
  };

  return (
    <>
      {/* Overlay — only visible on mobile when nav is open */}
      <Box
        className={`nav-overlay${isOpen ? " nav-open" : ""}`}
        onClick={onClose}
      />

      <Box component="nav" className={`nav${isOpen ? " nav-open" : ""}`}>
        {/* Logo */}
        <button className="nav-logo" onClick={() => navigate("today")}>
          ALT <span>F</span>IT
        </button>

        {/* Navigation links */}
        <Stack className="nav-links">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              className={`nav-link${page === id ? " active" : ""}`}
              onClick={() => navigate(id)}
            >
              {label}
              {id === "wardrobe" && savedItemCount > 0
                ? ` · ${savedItemCount}`
                : ""}
              {id === "saved-outfits" && savedOutfitsCount > 0
                ? ` · ${savedOutfitsCount}`
                : ""}
            </button>
          ))}
        </Stack>

        {/* Bottom section: upload CTA + profile */}
        <Stack className="nav-bottom">
          <button className="nav-upload" onClick={() => navigate("upload")}>
            + New Upload
          </button>

          <Stack
            direction="row"
            alignItems="center"
            sx={{ gap: "10px", py: "4px" }}
          >
            <Box className="nav-avatar">{initial}</Box>
            <Box>
              <Box className="nav-user-name">{user?.name || "—"}</Box>
              <Box className="nav-user-plan">
                {plan ? `Pro · ${plan}` : "Free plan"}
              </Box>
            </Box>
          </Stack>

          <button className="nav-signout" onClick={onSignOut}>
            Sign out
          </button>
        </Stack>
      </Box>
    </>
  );
}
