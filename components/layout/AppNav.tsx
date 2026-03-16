"use client";

interface NavProps {
  page: string;
  savedItemCount: number;
  plan: string | null;
  user: { name?: string | null; email?: string | null } | null;
  onPageChange: (page: string) => void;
  onSignOut: () => void;
  onShowToast: (msg: string) => void;
}

const NAV_ITEMS = [
  { id: "today", label: "Today" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "upload", label: "Add Pieces" },
];

export default function AppNav({
  page,
  savedItemCount,
  plan,
  user,
  onPageChange,
  onSignOut,
}: NavProps) {
  const initial = (user?.name || "U").charAt(0).toUpperCase();

  return (
    <nav className="nav">
      {/* Logo */}
      <button className="nav-logo" onClick={() => onPageChange("today")}>
        ALT <span>F</span>IT
      </button>

      {/* Navigation links */}
      <div className="nav-links">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            className={`nav-link${page === id ? " active" : ""}`}
            onClick={() => onPageChange(id)}
          >
            {label}
            {id === "wardrobe" && savedItemCount > 0
              ? ` · ${savedItemCount}`
              : ""}
          </button>
        ))}
      </div>

      {/* Bottom section: upload CTA + profile */}
      <div className="nav-bottom">
        <button className="nav-upload" onClick={() => onPageChange("upload")}>
          + New Upload
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 0",
          }}
        >
          <div className="nav-avatar">{initial}</div>
          <div>
            <div className="nav-user-name">{user?.name || "—"}</div>
            <div className="nav-user-plan">
              {plan ? `Pro · ${plan}` : "Free plan"}
            </div>
          </div>
        </div>

        <button className="nav-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
