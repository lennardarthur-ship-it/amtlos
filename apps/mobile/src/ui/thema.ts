import { useEffect, useState } from "react";
import { AccessibilityInfo, LayoutAnimation, Platform, StyleSheet, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-142 „Bühne und Papier“, Farbwelt des Logos): Jede Tab-Seite beginnt auf
 * der dunkelblauen Bühne (Navy) mit der einen Zahl, die zählt; darunter schiebt sich ein helles Blatt mit dem Rest.
 * Schrift ist Onest (wie auf der Website), Akzent Indigo auf Hell (dunkel: helles Violett), Minze als Signal auf der
 * Bühne und als Farbe für Erfolg/Erledigt (auf Hell als dunkle Minze). Statusfarben nie allein, immer mit Text.
 */
const HELL = {
  /** Grund des Blatts unter der Bühne (Grau mit einem Hauch Navy) */
  papier: "#f4f4f9",
  /** Karten, Listen, Eingabefelder */
  blatt: "#ffffff",
  /** Füllung: Suchfeld, Zweitknöpfe, gedrückte Zeilen */
  flaeche: "#e9e8f3",
  tinte: "#120e3a",
  /** Nebentext (≥ 4,5:1 auf Weiß, Papier und Fläche) */
  tinteLeise: "#585672",
  linie: "#d8d7e6",
  linieLeise: "#e8e7f1",
  /** Rahmen von Eingabefeldern: mindestens 3:1 (WCAG 1.4.11) */
  rahmen: "#78768f",
  zeiger: "#b8b6cc",
  /** Handeln: Links, Auswahl, Fortschritt, Symbole – Indigo des Logos */
  amt: "#3b30c4",
  amtTief: "#2a2196",
  amtHauch: "#ecebff",
  amtText: "#ffffff",
  /** Minze des Logos: Signal auf der Bühne (nie als Text auf Hell) */
  minze: "#7cf5c8",
  /** Erfolg/Erledigt als Text und Zeichen auf Hell: dunkle Minze (5,5:1 auf Weiß) */
  erfolg: "#08785a",
  erfolgTief: "#055740",
  erfolgHauch: "#dcf8ec",
  /** Hauptknopf auf dem Blatt: das Navy der Bühne */
  haupt: "#120e3a",
  hauptText: "#ffffff",
  frist: "#d70015",
  fristHauch: "#ffe9ea",
  bald: "#a05a00",
  baldHauch: "#fff2dc",
  /** Symbolscheibe in Bernstein (Kacheln, Plaketten) */
  baldScheibe: "#fff2dc",
  /** Kreis hinter einem Symbol auf einer bernsteinfarbenen Karte */
  baldKreis: "#ffffff",
  lila: "#8a3fbf",
  lilaHauch: "#f3e9fa",
  gold: "#a05a00",
  goldHauch: "#fff2dc",
  blau: "#0a64d6",
  blauHauch: "#e5effd",
  /** Bühne: Navy mit weißer Schrift und Minze */
  buehne: "#120e3a",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.74)",
  /** Zweitknöpfe, Suchfeld und Plaketten auf der Bühne: deckend – das Bildzeichen scheint nicht durch */
  buehneFlaeche: "#2b2668",
  buehneKnopf: "#7cf5c8",
  buehneKnopfText: "#120e3a",
  /** Tab-Leiste: dunkle Kapsel */
  kapsel: "#0e0b2e",
  /** Rand der Kapsel (nur dunkel sichtbar) */
  kapselRand: "transparent",
  leiste: "rgba(255,255,255,0.8)",
  schatten: 0.08,
};
const DUNKEL: typeof HELL = {
  papier: "#0b0a16",
  blatt: "#18172b",
  flaeche: "#25243d",
  tinte: "#f3f3f8",
  tinteLeise: "#aaa9c2",
  linie: "#2e2d47",
  linieLeise: "#222137",
  rahmen: "#7c7a98",
  zeiger: "#54526f",
  amt: "#a79dff",
  amtTief: "#cdc7ff",
  amtHauch: "#272263",
  amtText: "#120e3a",
  minze: "#7cf5c8",
  erfolg: "#7cf5c8",
  erfolgTief: "#b5fadf",
  erfolgHauch: "#123a35",
  haupt: "#7cf5c8",
  hauptText: "#120e3a",
  frist: "#ff7a70",
  fristHauch: "#3a1715",
  bald: "#ffb340",
  baldHauch: "#2e2414",
  baldScheibe: "rgba(255,179,64,0.14)",
  baldKreis: "rgba(255,179,64,0.14)",
  lila: "#d7a6f5",
  lilaHauch: "#2f2140",
  gold: "#ffb340",
  goldHauch: "#3a2a10",
  blau: "#6eb4ff",
  blauHauch: "#132a46",
  buehne: "#17124a",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.72)",
  buehneFlaeche: "#2c2669",
  buehneKnopf: "#7cf5c8",
  buehneKnopfText: "#120e3a",
  kapsel: "#2a2750",
  kapselRand: "rgba(255,255,255,0.08)",
  leiste: "rgba(24,23,43,0.9)",
  schatten: 0,
};
export type Farben = typeof HELL;
/** Minze ist hell und dunkel gleich – Zeichenfarbe der Leisten auf der Bühne (daran erkennen Kopfknöpfe die Bühne). */
export const MINZE = HELL.minze;

/** Schrift (E-142): Onest in fünf Schnitten – überall gleich (iPhone, Web-Vorschau, Store-Bilder). */
export const SCHRIFT = {
  regular: { fontFamily: "Onest_400Regular", fontWeight: "400" },
  mittel: { fontFamily: "Onest_500Medium", fontWeight: "500" },
  halb: { fontFamily: "Onest_600SemiBold", fontWeight: "600" },
  bold: { fontFamily: "Onest_700Bold", fontWeight: "700" },
  display: { fontFamily: "Onest_800ExtraBold", fontWeight: "800" },
} as const;
/** Textgrößen: großer Titel 34, Titel 28, Überschrift 20, Fließtext 17, klein 15, Fußnote 13, mini 11 */
export const GROESSE = { mini: 11, caption: 13, klein: 15, basis: 17, gross: 20, titel: 28, grossTitel: 34, blatt: 38 } as const;
/** Mindestgröße für Tippziele */
export const ZIEL = 48;
/** Seitenrand */
export const RAND = 20;
/**
 * Ecken – eine Skala: 10 (kleine Flächen auf dem Papier), 14 (Felder, Kacheln, Fristblatt), 18 (Knöpfe, Antwortkarten),
 * 24 (Karten), 32 (Bühne und Blatt), Pille (Chips, Plaketten). Das Papier selbst hat 6 – wie ein Blatt, nicht wie eine Karte.
 */
export const RADIUS = { fein: 10, klein: 14, knopf: 18, karte: 24, buehne: 32, pille: 999, blatt: 6 } as const;
/** Abstand vom oberen Rand des hellen Blatts bis zum ersten Inhalt – auf allen Blättern gleich. */
export const BLATT_OBEN = 24;
export const HAARLINIE = StyleSheet.hairlineWidth;

export function useFarben(): Farben {
  return useColorScheme() === "dark" ? DUNKEL : HELL;
}

/** Weicher Schatten für Karten (nur hell). */
export function schattenStil(f: Farben, staerke = 1) {
  if (!f.schatten) return null;
  return { shadowColor: "#120e3a", shadowOpacity: f.schatten * staerke, shadowRadius: 14 * staerke, shadowOffset: { width: 0, height: 4 * staerke }, elevation: 2 * staerke };
}

export const istIos = Platform.OS === "ios";

/** „Bewegung reduzieren“ (Bedienungshilfen): dann keine Feder- und Stempel-Animationen. */
export function useWenigBewegung(): boolean {
  const [an, setAn] = useState(false);
  useEffect(() => {
    let aktiv = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((w) => aktiv && setAn(w)).catch(() => undefined);
    const abo = AccessibilityInfo.addEventListener("reduceMotionChanged", (w: boolean) => setAn(w));
    return () => {
      aktiv = false;
      abo.remove();
    };
  }, []);
  return an;
}

/** Nächste Layout-Änderung weich einblenden (Auf- und Zuklappen) – im Web ohne Wirkung. */
export function weich(): void {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
/** Kennung der „Fertig“-Leiste über Zahlentastaturen (InputAccessoryView, iOS) */
export const TASTATUR_FERTIG = "amtlos-tastatur-fertig";
