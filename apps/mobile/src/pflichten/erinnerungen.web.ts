/** Web (Vorschau, Rundgang): keine Benachrichtigungen. */
import type { Mitteilung } from "./erinnerungsplan";

export const erinnerungenMoeglich = false;
export async function erlaubnisAnfragen(): Promise<boolean> {
  return false;
}
export async function planen(_plan: Mitteilung[]): Promise<void> {}
export async function allesAbsagen(): Promise<void> {}
