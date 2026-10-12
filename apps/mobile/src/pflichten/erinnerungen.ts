/**
 * Lokale Erinnerungen (E-128): Benachrichtigungen auf dem Gerät, ohne Server und ohne Push-Konto. Bei jeder Änderung
 * wird der ganze Plan neu gesetzt (eigene Benachrichtigungen löschen, nächste Termine eintragen).
 */
import * as Notifications from "expo-notifications";
import type { Erinnerung } from "./check";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const erinnerungenMoeglich = true;

export async function erlaubnisAnfragen(): Promise<boolean> {
  const jetzt = await Notifications.getPermissionsAsync();
  if (jetzt.granted) return true;
  if (!jetzt.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const datumDe = (iso: string) => iso.split("-").reverse().join(".");

export async function planen(plan: Erinnerung[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const jetzt = Date.now();
  for (const e of plan) {
    const [j, m, t] = e.am.split("-").map(Number) as [number, number, number];
    const date = new Date(j, m - 1, t, 9, 0, 0);
    if (date.getTime() <= jetzt) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: e.titel, body: `Fällig am ${datumDe(e.termin)} – in Amtlos ansehen.`, data: { pflichtId: e.pflichtId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

export async function allesAbsagen(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
