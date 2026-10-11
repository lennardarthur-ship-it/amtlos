import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ApiKlient } from "./kern/api";
import { KONFIG } from "./konfig";

export type PushErgebnis = "aktiv" | "verweigert" | "kein_geraet" | "fehler";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Erlaubnis holen, Expo-Push-Token erzeugen und bei der API registrieren (E-108). */
export async function pushEinschalten(klient: ApiKlient): Promise<PushErgebnis> {
  if (!Device.isDevice) return "kein_geraet";
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("erinnerungen", { name: "Erinnerungen", importance: Notifications.AndroidImportance.DEFAULT });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return "verweigert";
  try {
    const token = (await Notifications.getExpoPushTokenAsync(KONFIG.eas?.projectId ? { projectId: KONFIG.eas.projectId } : undefined)).data;
    await klient.geraetRegistrieren({ push_token: token, plattform: Platform.OS === "ios" ? "ios" : "android", name: Device.modelName ?? "" });
    return "aktiv";
  } catch {
    return "fehler";
  }
}

/** Tippen auf eine Erinnerung: den App-Pfad (z. B. /pflichten/…) an die App geben. */
export function beiTippen(ziel: (link: string) => void) {
  const abo = Notifications.addNotificationResponseReceivedListener((r) => {
    const link = (r.notification.request.content.data as { link?: unknown } | undefined)?.link;
    if (typeof link === "string" && link.startsWith("/")) ziel(link);
  });
  return () => abo.remove();
}
