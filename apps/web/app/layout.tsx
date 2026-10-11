import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { aktuelleSprache } from "@/lib/sprache";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Amtlos", template: "%s · Amtlos" },
  description: "Alle Pflichten deines Unternehmens: erkannt, erklärt, terminiert.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#11171d" },
  ],
};

export default async function Wurzel({ children }: { children: ReactNode }) {
  const sprache = await aktuelleSprache();
  return (
    <html lang={sprache}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
