/** Web (Vorschau, Rundgang): Belegdateien unverschlüsselt im localStorage – nur für Tests. */
import { istBelegDateiname } from "@amtlos/fachlogik";
import { ausBase64, base64 } from "./sicherung";

const SCHLUESSEL = (name: string) => `amtlos.datei.${name}`;
const speicher = () => (globalThis as unknown as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } }).localStorage;

export async function dateiAblegen(name: string, bytes: Uint8Array, _schluessel: Uint8Array | null): Promise<void> {
  if (!istBelegDateiname(name)) throw new Error("Ungültiger Dateiname");
  speicher()?.setItem(SCHLUESSEL(name), base64(bytes));
}
export async function dateiHolen(name: string, _schluessel: Uint8Array | null): Promise<Uint8Array | null> {
  const t = speicher()?.getItem(SCHLUESSEL(name));
  return t ? ausBase64(t) : null;
}
export function dateiEntfernen(name: string): void {
  speicher()?.removeItem(SCHLUESSEL(name));
}
export function alleDateienEntfernen(): void {
  const l = speicher() as unknown as { length: number; key(i: number): string | null; removeItem(k: string): void } | undefined;
  if (!l) return;
  for (let i = l.length - 1; i >= 0; i--) {
    const k = l.key(i);
    if (k?.startsWith("amtlos.datei.")) l.removeItem(k);
  }
}

/** Liegt die Datei vor? – ohne sie zu dekodieren (R9 Performance). */
export function dateiVorhanden(name: string): boolean {
  return istBelegDateiname(name) && speicher()?.getItem(SCHLUESSEL(name)) != null;
}
/** ungefähre Größe in Bytes (Base64 im localStorage) */
export function dateiGroesse(name: string): number {
  const t = istBelegDateiname(name) ? speicher()?.getItem(SCHLUESSEL(name)) : null;
  return t ? Math.floor((t.length * 3) / 4) : 0;
}
/** Web: Anzeige über eine Blob-URL (statt einer data-URI). */
export async function dateiAnzeigen(name: string, _schluessel: Uint8Array | null, mime = "application/octet-stream"): Promise<{ uri: string; entfernen(): void } | null> {
  const bytes = await dateiHolen(name, null);
  if (!bytes) return null;
  const g = globalThis as unknown as { URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: unknown[], o: { type: string }) => unknown };
  const uri = g.URL.createObjectURL(new g.Blob([bytes], { type: mime }));
  return { uri, entfernen: () => g.URL.revokeObjectURL(uri) };
}
export function ansichtenAufraeumen(): void {
  /* im Web nichts im Cache */
}
