import { LayoutAnimation, Platform, StyleSheet, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-139): flach und klar wie die besten Finanz-Apps – Weiß, Amtsgrün mit
 * dunkler Bühne und Minze, Zweitfarben Lila/Gold/Blau für Kategorien, eine kräftige Grotesk (Onest), Pillen-Knöpfe.
 * Statusfarben nie allein, immer mit Text.
 */
const HELL = {
  papier: "#ffffff",
  /** Kartenfläche: flach, ohne Schatten – Flächen trennen durch Farbe, nicht durch Linien */
  blatt: "#f3f6f4",
  /** ruhige Füllung in Karten: Suchfeld, Zurück-Knopf, neutrale Hinweise */
  flaeche: "#e9eeeb",
  tinte: "#0d1f18",
  tinteLeise: "#56675f",
  linie: "#dfe5e1",
  linieLeise: "#ebefec",
  /** Rahmen von Eingabefeldern und Auswahl: mindestens 3:1 zum Hintergrund (WCAG 1.4.11) */
  rahmen: "#87938c",
  /** Pfeile in Listen */
  zeiger: "#a9b4ae",
  amt: "#0a7d55",
  amtTief: "#063b29",
  amtHauch: "#e1f3ea",
  /** Schrift auf Amtsgrün */
  amtText: "#ffffff",
  /** Minzgrün: Akzent auf dunklem Grün (Bühne) */
  minze: "#7fe3b8",
  frist: "#c4281c",
  fristHauch: "#fdeceb",
  bald: "#9e5200",
  baldHauch: "#fdf1dc",
  /** Zweitfarben für Kategorien (wie Euro-Scheine: Lila, Gold, Blau) – nur Flächen und Symbole, nie Text allein */
  lila: "#5b3db0",
  lilaHauch: "#eee8fc",
  gold: "#8a5a00",
  goldHauch: "#fcf1d2",
  blau: "#2856c4",
  blauHauch: "#e4ecfd",
  /** Bühne: die eine dunkle Fläche je Seite (Einladung, Pro) */
  buehne: "#063b29",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.78)",
  buehneKnopf: "#7fe3b8",
  buehneKnopfText: "#063b29",
  leiste: "rgba(255,255,255,0.9)",
  /** Deckkraft des Kartenschattens – flach: keiner */
  schatten: 0,
};
const DUNKEL: typeof HELL = {
  papier: "#0a110e",
  blatt: "#141d19",
  flaeche: "#1d2823",
  tinte: "#eef3f0",
  tinteLeise: "#a4b3ac",
  linie: "#25322c",
  linieLeise: "#1b2621",
  rahmen: "#62726a",
  zeiger: "#55635c",
  amt: "#3fd49a",
  amtTief: "#a2f1cf",
  amtHauch: "#123629",
  amtText: "#03140d",
  minze: "#7fe3b8",
  frist: "#ff8a7d",
  fristHauch: "#3b1b18",
  bald: "#f4b75a",
  baldHauch: "#382a12",
  lila: "#c6b6fd",
  lilaHauch: "#272042",
  gold: "#f2cd78",
  goldHauch: "#352b12",
  blau: "#a2c0ff",
  blauHauch: "#18284a",
  buehne: "#0f3627",
  buehneText: "#eef3f0",
  buehneLeise: "#b3c9bf",
  buehneKnopf: "#3fd49a",
  buehneKnopfText: "#03140d",
  leiste: "rgba(10,17,14,0.9)",
  schatten: 0,
};
export type Farben = typeof HELL;

/** Schrift (E-139): Onest (OFL 1.1), eine Familie in fünf Schnitten – fett für Überschriften, halbfett zur Auszeichnung. */
export const SCHRIFT = {
  regular: "Onest_400Regular",
  mittel: "Onest_500Medium",
  halb: "Onest_600SemiBold",
  bold: "Onest_700Bold",
  display: "Onest_800ExtraBold",
} as const;
/** Typografische Skala */
export const GROESSE = { mini: 11, caption: 13, klein: 15, basis: 17, gross: 20, titel: 26, grossTitel: 32, blatt: 38 } as const;
/** Mindestgröße für Tippziele */
export const ZIEL = 48;
/** Seitenrand */
export const RAND = 20;
/** Ecken: Felder 14, Karten 22, Bühne 28 – Knöpfe und Chips sind Pillen. */
export const RADIUS = { klein: 14, karte: 22, buehne: 28, blatt: 10, knopf: 999 } as const;
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
