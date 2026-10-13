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
export async function cloudDateien(_kennung: string): Promise<Set<string>> {
  return new Set();
}
export async function cloudDateiSchreiben(_kennung: string, _name: string, _text: string): Promise<void> {}
export async function cloudDateiLesen(_kennung: string, _name: string): Promise<string | null> {
  return null;
}
export async function cloudBeiseitelegen(_text: string): Promise<void> {}
