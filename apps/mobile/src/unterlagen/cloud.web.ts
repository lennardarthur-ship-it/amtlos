/** Web: keine iCloud-Sicherung. */
export const AKTUELL = "";
export async function cloudVerfuegbar(): Promise<boolean> {
  return false;
}
export function kalenderwoche(_d: Date): string {
  return "";
}
export async function cloudSchreiben(_text: string): Promise<void> {}
export async function cloudLesen(): Promise<string | null> {
  return null;
}
