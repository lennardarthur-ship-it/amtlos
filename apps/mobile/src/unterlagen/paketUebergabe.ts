/**
 * E-221 Befund 6: Steuerberater-Paket teilen und erst danach festschreiben – ohne react-native, damit der Ablauf ohne
 * Gerät prüfbar ist.
 *
 * Android: expo-sharing kehrt auch nach „Zurück“ zurück und meldet keinen Abbruch (wie E-190, E-193). Festgeschrieben
 * wird dort deshalb erst nach der ausdrücklichen Bestätigung „Paket übergeben“; bei „Nein“ bleibt alles offen, und die
 * Festschreibung ist ein eigener, ausdrücklicher Schritt („Paket wurde doch übergeben – festschreiben“). iPhone: Das
 * Teilen-Menü meldet einen Abbruch selbst (`teilen` liefert false) – dann wird nichts festgeschrieben, ohne Frage.
 */
export type PaketUebergabe = "fest" | "abgebrochen" | "offen";

export async function paketUebergeben(o: {
  /** Teilen-Menü; false: abgebrochen (iPhone meldet das, Android nicht) */
  teilen: () => Promise<boolean>;
  /** Android: Nachfrage, ob das Paket wirklich weitergegeben wurde */
  bestaetigen: () => Promise<boolean>;
  festschreiben: () => void;
  android: boolean;
}): Promise<PaketUebergabe> {
  if (!(await o.teilen())) return "abgebrochen";
  if (o.android && !(await o.bestaetigen())) return "offen";
  o.festschreiben();
  return "fest";
}
