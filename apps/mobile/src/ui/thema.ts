import { LayoutAnimation, Platform, StyleSheet, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-140): iOS 26 – wie die beliebtesten Apps heute. Systemschrift (SF Pro),
 * gruppierter grauer Grund mit weißen Karten, Einstellungs-Symbole (gefüllte Quadrate), schwebende Glas-Tab-Leiste.
 * Markenfarbe Amtsgrün als Akzent, Dunkelgrün mit Minze für die eine Bühne. Statusfarben nie allein, immer mit Text.
 */
const HELL = {
  /** Seitengrund (systemGroupedBackground) */
  papier: "#f2f2f7",
  /** Karten, Listen, Eingabefelder (secondarySystemGroupedBackground) */
  blatt: "#ffffff",
  /** Füllung: Suchfeld, graue Knöpfe, gedrückte Zeilen */
  flaeche: "#e9e9ee",
  tinte: "#000000",
  /** Nebentext (≥ 4,5:1 auf Weiß und Grau) */
  tinteLeise: "#6c6c70",
  linie: "#c6c6c8",
  linieLeise: "#e5e5ea",
  /** Rahmen von Eingabefeldern: mindestens 3:1 (WCAG 1.4.11) */
  rahmen: "#8e8e93",
  zeiger: "#c4c4c7",
  amt: "#0a7d55",
  amtTief: "#06573b",
  amtHauch: "#e0f2ea",
  amtText: "#ffffff",
  minze: "#7fe3b8",
  frist: "#d70015",
  fristHauch: "#ffe9ea",
  bald: "#a05a00",
  baldHauch: "#fff2dc",
  lila: "#5e5ce6",
  lilaHauch: "#ecebfd",
  gold: "#a05a00",
  goldHauch: "#fff2dc",
  blau: "#0a64d6",
  blauHauch: "#e5effd",
  buehne: "#063b29",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.78)",
  buehneKnopf: "#7fe3b8",
  buehneKnopfText: "#063b29",
  leiste: "rgba(255,255,255,0.8)",
  schatten: 0.08,
};
const DUNKEL: typeof HELL = {
  papier: "#000000",
  blatt: "#1c1c1e",
  flaeche: "#2c2c2e",
  tinte: "#ffffff",
  tinteLeise: "#aeaeb2",
  linie: "#38383a",
  linieLeise: "#2c2c2e",
  rahmen: "#7c7c80",
  zeiger: "#5a5a5e",
  amt: "#30d68b",
  amtTief: "#8ff0c1",
  amtHauch: "#0f3324",
  amtText: "#00180d",
  minze: "#7fe3b8",
  frist: "#ff6961",
  fristHauch: "#3a1514",
  bald: "#ffb340",
  baldHauch: "#3a2a10",
  lila: "#a5a3ff",
  lilaHauch: "#25243f",
  gold: "#ffb340",
  goldHauch: "#3a2a10",
  blau: "#6eb4ff",
  blauHauch: "#132a46",
  buehne: "#0d3626",
  buehneText: "#ffffff",
  buehneLeise: "#b8cdc3",
  buehneKnopf: "#30d68b",
  buehneKnopfText: "#00180d",
  leiste: "rgba(28,28,30,0.72)",
  schatten: 0,
};
export type Farben = typeof HELL;

/** Schrift (E-140): die Systemschrift (SF Pro auf dem iPhone) – Gewicht statt eigener Schnitte. */
export const SCHRIFT = {
  regular: { fontWeight: "400" },
  mittel: { fontWeight: "500" },
  halb: { fontWeight: "600" },
  bold: { fontWeight: "700" },
  display: { fontWeight: "800" },
} as const;
/** iOS-Textstile: largeTitle 34, title1 28, title3 20, body 17, subheadline 15, footnote 13, caption 11 */
export const GROESSE = { mini: 11, caption: 13, klein: 15, basis: 17, gross: 20, titel: 28, grossTitel: 34, blatt: 38 } as const;
/** Mindestgröße für Tippziele */
export const ZIEL = 48;
/** Seitenrand */
export const RAND = 20;
/** Ecken: Felder 12, Karten 20, Bühne 26 – Knöpfe und Chips sind Pillen. */
export const RADIUS = { klein: 12, karte: 20, buehne: 26, blatt: 10, knopf: 999 } as const;
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
