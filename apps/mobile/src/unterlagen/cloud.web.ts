/** Web: keine iCloud-Sicherung. */
export const AKTUELL = "";
export async function cloudVerfuegbar(): Promise<boolean> {
  return false;
}
export function kalenderwoche(_d: Date): string {
  return "";
}
export async function cloudSchreiben(_text: string, _jetzt?: Date, _opt?: { ersetzen?: boolean }): Promise<void> {}
export { SicherungUnlesbar, type VorhandeneSicherung } from "./cloudLogik";
export async function cloudVorhanden(): Promise<import("./cloudLogik").VorhandeneSicherung> {
  return { art: "keine" };
}
export async function cloudLesen(): Promise<string | null> {
  return null;
}
export async function cloudDateien(_kennung: string): Promise<Set<string>> {
  return new Set();
}
export async function cloudDateiSchreiben(_kennung: string, _name: string, _text: string): Promise<void> {}
export async function cloudDateiLesen(_kennung: string, _name: string): Promise<string | null> {
  return null;
}
export async function cloudBeiseitelegen(_text: string): Promise<void> {}
/** Ordnerwahl (Android, E-190) – im Web nicht vorhanden. */
export const ORDNER_WAHL = false;
export type OrdnerStatus = { art: "ok"; name: string } | { art: "keiner" } | { art: "kein_zugriff"; name: string };
export async function ordnerStatus(): Promise<OrdnerStatus> {
  return { art: "keiner" };
}
export async function ordnerWaehlen(): Promise<OrdnerStatus | null> {
  return null;
}
export async function ordnerVergessen(): Promise<void> {}
