import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { aktuelleMarke, markenStil } from "@/lib/marke";
import { aktuelleSprache } from "@/lib/sprache";
import "./globals.css";
import { MARKE } from "@amtlos/marke";

export async function generateMetadata(): Promise<Metadata> {
  const name = (await aktuelleMarke())?.name ?? MARKE.name;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Alle Pflichten deines Unternehmens: erkannt, erklärt, terminiert.",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e1c" },
  ],
};

export default async function Wurzel({ children }: { children: ReactNode }) {
  const [sprache, marke] = await Promise.all([aktuelleSprache(), aktuelleMarke()]);
  return (
    <html lang={sprache}>
      {/* Markenfarben (geprüfte #rrggbb-Werte) überschreiben die Handlungsfarbe des Designsystems */}
      {marke ? <head><style dangerouslySetInnerHTML={{ __html: markenStil(marke) }} /></head> : null}
      <body className="antialiased">{children}</body>
    </html>
  );
}
