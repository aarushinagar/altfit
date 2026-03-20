import type { Metadata } from "next";
import "./globals.css";
import "./globals-outfit.css";
import ThemeRegistry from "@/lib/theme/ThemeRegistry";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { GOOGLE_FONTS_URL } from "@/lib/theme/tokens";

export const metadata: Metadata = {
  title: "ALTFit — Your Personal Stylist",
  description: "AI-powered personal styling from your own wardrobe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Google Fonts URL is sourced from lib/theme/tokens.ts */}
        <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
      </head>
      <body>
        <ThemeRegistry>
          <AuthProvider>{children}</AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
