"use client";

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
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
      {message}
    </div>
  );
}
