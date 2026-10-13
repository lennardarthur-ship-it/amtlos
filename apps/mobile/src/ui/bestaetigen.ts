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
