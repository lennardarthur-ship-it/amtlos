/**
 * Rückfrage vor einer folgenschweren Handlung (Löschen, Storno) – auf dem iPhone der System-Dialog mit roter
 * Handlung, im Web (Vorschau, Rundgang) `confirm`. Liefert true, wenn bestätigt.
 */
import { Alert, Platform } from "react-native";
import { T as TEXT } from "../texte";

export function bestaetigen(o: { titel: string; text?: string; ja: string; nein?: string }): Promise<boolean> {
  if (Platform.OS === "web") {
    const w = globalThis as unknown as { confirm?: (t: string) => boolean };
    return Promise.resolve(Boolean(w.confirm?.([o.titel, o.text].filter(Boolean).join("\n\n"))));
  }
  return new Promise((fertig) =>
    Alert.alert(o.titel, o.text, [
      { text: o.nein ?? TEXT.abbrechen, style: "cancel", onPress: () => fertig(false) },
      { text: o.ja, style: "destructive", onPress: () => fertig(true) },
    ], { cancelable: true, onDismiss: () => fertig(false) }),
  );
}

/**
 * E-232: wichtiger Hinweis, den man bestätigen muss („Verstanden“) – auf dem Gerät der System-Dialog, im Web `alert`.
 */
export function hinweisen(titel: string, text: string): Promise<void> {
  if (Platform.OS === "web") {
    (globalThis as unknown as { alert?: (t: string) => void }).alert?.(`${titel}\n\n${text}`);
    return Promise.resolve();
  }
  return new Promise((fertig) => Alert.alert(titel, text, [{ text: TEXT.e200_abo_verstanden, onPress: () => fertig() }], { cancelable: true, onDismiss: () => fertig() }));
}
