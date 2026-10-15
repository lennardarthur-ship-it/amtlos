import { LayoutAnimation, Platform, StyleSheet, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-137): eine Marke mit Website, Dokumenten und App-Symbol.
 * Papier und Tinte, eine Handlungsfarbe (Amtsgrün), Statusfarben nur mit Text. Schrift: Amtlos Serif für Überschriften,
 * Amtlos Sans für alles andere – dieselben Schnitte wie auf der Website und in den erzeugten Dokumenten.
 */
const HELL = {
  papier: "#f2f4f1",
  blatt: "#ffffff",
  /** ruhige Füllfläche: neutrale Hinweise, gedrückte Zeilen, Platzhalter */
  flaeche: "#e8ece7",
  tinte: "#17232e",
  tinteLeise: "#4b5966",
  linie: "#d5dbd4",
  linieLeise: "#e6eae4",
  /** Rahmen von Eingabefeldern und Auswahlchips: mindestens 3:1 zum Hintergrund (WCAG 1.4.11) */
  rahmen: "#848f87",
  /** Pfeile in Listen, Haarlinien-Symbole */
  zeiger: "#a3ada6",
  amt: "#136f5b",
  amtTief: "#0d5143",
  amtHauch: "#e2eee9",
  /** Schrift auf Amtsgrün */
  amtText: "#ffffff",
  frist: "#b42318",
  fristHauch: "#fbe9e7",
  bald: "#a84a06",
  baldHauch: "#fdf0d9",
  /** Bühne: die eine dunkle Fläche je Seite (Einladung, Ergebnis) */
  buehne: "#0d5143",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.8)",
  buehneKnopf: "#ffffff",
  buehneKnopfText: "#0d5143",
  leiste: "rgba(242,244,241,0.86)",
  /** Deckkraft des Kartenschattens (dunkel: keiner, dort trägt der Rahmen) */
  schatten: 0.07,
};
const DUNKEL: typeof HELL = {
  papier: "#0f1519",
  blatt: "#172026",
  flaeche: "#1e2930",
  tinte: "#e6eae3",
  tinteLeise: "#aeb8c2",
  linie: "#2c3842",
  linieLeise: "#222c35",
  rahmen: "#66737f",
  zeiger: "#5c6873",
  amt: "#5cc2a6",
  amtTief: "#8ad8c2",
  amtHauch: "#173630",
  amtText: "#0f1519",
  frist: "#ff8a7a",
  fristHauch: "#3d1d1a",
  bald: "#f5b453",
  baldHauch: "#3a2a12",
  buehne: "#173630",
  buehneText: "#e6eae3",
  buehneLeise: "#b7c6c0",
  buehneKnopf: "#5cc2a6",
  buehneKnopfText: "#0f1519",
  leiste: "rgba(15,21,25,0.86)",
  schatten: 0,
};
export type Farben = typeof HELL;

/** Schnitte (assets/schriften, OFL 1.1). `halb` ist die Auszeichnung im Text, `fett` nur für Beträge und Ziffern. */
export const SCHRIFT = {
  regular: "AmtlosSans_400Regular",
  halb: "AmtlosSans_600SemiBold",
  bold: "AmtlosSans_700Bold",
  serif: "AmtlosSerif_600SemiBold",
} as const;
/** Typografische Skala (≈ 1,2), auf die kleine x-Höhe der Amtlos Sans abgestimmt. */
export const GROESSE = { mini: 11, caption: 13.5, klein: 15.5, basis: 17.5, gross: 21, titel: 27, grossTitel: 34, blatt: 38 } as const;
/** Mindestgröße für Tippziele */
export const ZIEL = 48;
/** Seitenrand (iOS: 20 pt) */
export const RAND = 20;
/** Ecken: Felder und Hinweise 12, Karten 18, große Flächen 24 – Chips sind rund. */
export const RADIUS = { klein: 12, karte: 18, buehne: 24, blatt: 10, knopf: 14 } as const;
export const HAARLINIE = StyleSheet.hairlineWidth;

export function useFarben(): Farben {
  return useColorScheme() === "dark" ? DUNKEL : HELL;
}

/** Weicher Schatten für Karten (nur hell). */
export function schattenStil(f: Farben, staerke = 1) {
  if (!f.schatten) return null;
  return { shadowColor: "#0e2a24", shadowOpacity: f.schatten * staerke, shadowRadius: 14 * staerke, shadowOffset: { width: 0, height: 3 * staerke }, elevation: 2 * staerke };
}

export const istIos = Platform.OS === "ios";

/** Nächste Layout-Änderung weich einblenden (Auf- und Zuklappen) – im Web ohne Wirkung. */
export function weich(): void {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
/** Kennung der „Fertig“-Leiste über Zahlentastaturen (InputAccessoryView, iOS) */
export const TASTATUR_FERTIG = "amtlos-tastatur-fertig";
