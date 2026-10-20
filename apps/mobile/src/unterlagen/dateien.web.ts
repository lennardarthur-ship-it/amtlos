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
