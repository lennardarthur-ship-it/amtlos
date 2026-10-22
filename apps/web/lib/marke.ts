import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { konfig } from "./konfig";

/** White-Label-Marke (E-105): nur Darstellung. Farben sind im Studio auf Kontrast geprüft. */
export interface Marke { schluessel: string; name: string; farbe_hell: string; farbe_dunkel: string; logo_url: string | null; support_email: string | null }

const FARBE = /^#[0-9a-f]{6}$/;

/** Hostname der Anfrage (hinter dem Proxy: X-Forwarded-Host), ohne Port, klein geschrieben. */
export function hostAus(kopf: { get(name: string): string | null }): string | null {
  const roh = (kopf.get("x-forwarded-host") ?? kopf.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
  const host = roh.replace(/:\d+$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(host) ? host : null;
}

/** Marke zum Hostnamen; ohne Marke (oder wenn die API nicht antwortet) gilt Amtlos. Fünf Minuten zwischengespeichert. */
export const aktuelleMarke = cache(async (): Promise<Marke | null> => {
  const host = hostAus(await headers());
  if (!host || host === "localhost") return null;
  try {
    const r = await fetch(`${konfig().apiUrl}/v1/marke?host=${encodeURIComponent(host)}`, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const m = (await r.json()) as Marke;
    // Nur geprüfte Formate in das Stylesheet übernehmen (zweite Absicherung zur Prüfung im Studio)
    if (!FARBE.test(m.farbe_hell) || !FARBE.test(m.farbe_dunkel)) return null;
    return m;
  } catch {
    return null;
  }
});

/** CSS-Variablen der Marke: Handlungsfarbe hell/dunkel, abgeleitete Töne über color-mix. */
export function markenStil(m: Marke): string {
  const satz = (farbe: string, flaeche: string, tief: string) =>
    `--color-amt:${farbe};--color-amt-tief:color-mix(in srgb, ${farbe} 75%, ${tief});--color-amt-hauch:color-mix(in srgb, ${farbe} 12%, ${flaeche});`;
  return `:root{${satz(m.farbe_hell, "#ffffff", "#000000")}}@media (prefers-color-scheme: dark){:root{${satz(m.farbe_dunkel, "#1a1930", "#ffffff")}}}`;
}
