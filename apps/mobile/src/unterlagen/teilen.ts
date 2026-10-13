/**
 * Teilen-Menü mit Ergebnis. expo-sharing meldet auf dem iPhone auch ein Abbrechen als Erfolg – dann würde eine
 * Rechnung festgeschrieben oder eine Sicherung als erstellt gelten, ohne dass etwas das Gerät verlassen hat. Auf iOS
 * deshalb das Teilen-Menü von React Native, das „abgebrochen“ meldet.
 */
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

/** true: geteilt bzw. gesichert; false: abgebrochen. */
export async function teilen(uri: string, o: { mimeType: string; UTI?: string; titel: string }): Promise<boolean> {
  if (Platform.OS === "ios") {
    const r = await Share.share({ url: uri, title: o.titel });
    return r.action !== Share.dismissedAction;
  }
  await Sharing.shareAsync(uri, { mimeType: o.mimeType, UTI: o.UTI, dialogTitle: o.titel });
  return true;
}
