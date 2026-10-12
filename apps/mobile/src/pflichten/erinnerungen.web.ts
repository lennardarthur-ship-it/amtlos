/** Web (Vorschau, Rundgang): keine Benachrichtigungen. */
import type { Erinnerung } from "./check";

export const erinnerungenMoeglich = false;
export async function erlaubnisAnfragen(): Promise<boolean> {
  return false;
}
export async function planen(_plan: Erinnerung[]): Promise<void> {}
export async function allesAbsagen(): Promise<void> {}
