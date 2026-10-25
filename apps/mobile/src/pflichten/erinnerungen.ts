/**
 * Lokale Erinnerungen (E-128): Benachrichtigungen auf dem Gerät, ohne Server und ohne Push-Konto. Bei jeder Änderung
 * wird der ganze Plan neu gesetzt (eigene Benachrichtigungen löschen, nächste Termine eintragen).
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Erinnerung } from "./check";
import { MARKE } from "@amtlos/marke";

/**
 * Android (E-190): eigener Benachrichtigungskanal „Fristen“ (ab Android 8 Pflicht, sonst legt expo-notifications einen
 * unbenannten Standardkanal an). Ab Android 13 fragt das System erst nach der Erlaubnis (POST_NOTIFICATIONS), wenn ein
 * Kanal existiert – deshalb vor der Anfrage anlegen. Kein exakter Wecker: die Erinnerung um 9 Uhr darf sich um einige
 * Minuten verschieben (SCHEDULE_EXACT_ALARM ist in app.json gesperrt, keine Play-Erklärung nötig).
 */
export const KANAL = "fristen";
async function kanalAnlegen(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(KANAL, { name: "Fristen", description: `Erinnerungen von ${MARKE.name} vor Terminen deiner Pflichten`, importance: Notifications.AndroidImportance.DEFAULT, showBadge: false });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const erinnerungenMoeglich = true;

export async function erlaubnisAnfragen(): Promise<boolean> {
  await kanalAnlegen().catch(() => undefined);
  const jetzt = await Notifications.getPermissionsAsync();
  if (jetzt.granted) return true;
  if (!jetzt.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const datumDe = (iso: string) => iso.split("-").reverse().join(".");

export async function planen(plan: Erinnerung[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await kanalAnlegen().catch(() => undefined);
  const jetzt = Date.now();
  for (const e of plan) {
    const [j, m, t] = e.am.split("-").map(Number) as [number, number, number];
    const date = new Date(j, m - 1, t, 9, 0, 0);
    if (date.getTime() <= jetzt) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: e.titel, body: `Fällig am ${datumDe(e.termin)} – in ${MARKE.name} ansehen.`, data: { pflichtId: e.pflichtId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === "android" ? { channelId: KANAL } : null) },
    });
  }
}

export async function allesAbsagen(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
