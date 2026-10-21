/** Typen für das Paket `hyphen` (Liang-Silbentrennung) – nur, was trennen.ts braucht. */
declare module "hyphen" {
  type Muster = unknown;
  export default function erzeugen(muster: Muster, optionen?: { hyphenChar?: string; minWordLength?: number }): (text: string) => string;
}
declare module "hyphen/patterns/de-1996" {
  const muster: unknown;
  export default muster;
}
