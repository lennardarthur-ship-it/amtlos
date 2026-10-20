import { LayoutAnimation, Platform, StyleSheet, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-142 „Bühne und Papier“): Jede Tab-Seite beginnt auf der dunkelgrünen
 * Bühne mit der einen Zahl, die zählt; darunter schiebt sich ein helles Blatt mit dem Rest. Schrift ist Onest (wie im
 * App-Symbol und auf der Website), Akzent Minze auf Grün, Amtsgrün auf Hell. Statusfarben nie allein, immer mit Text.
 */
const HELL = {
  /** Grund des Blatts unter der Bühne (leicht grünliches Grau) */
  papier: "#f4f6f5",
  /** Karten, Listen, Eingabefelder */
  blatt: "#ffffff",
  /** Füllung: Suchfeld, Zweitknöpfe, gedrückte Zeilen */
  flaeche: "#e8eeeb",
  tinte: "#0c1f18",
  /** Nebentext (≥ 4,5:1 auf Weiß und auf dem Blatt) */
  tinteLeise: "#56655f",
  linie: "#d5ddd9",
  linieLeise: "#e6ece9",
  /** Rahmen von Eingabefeldern: mindestens 3:1 (WCAG 1.4.11) */
  rahmen: "#75837d",
  zeiger: "#b4c0bb",
  amt: "#0a7d55",
  amtTief: "#06573b",
  amtHauch: "#e1f3ea",
  amtText: "#ffffff",
  minze: "#7fe3b8",
  /** Hauptknopf auf dem Blatt: das tiefe Grün der Bühne */
  haupt: "#063b29",
  hauptText: "#ffffff",
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
  /** Bühne: dunkles Amtsgrün mit weißer Schrift und Minze */
  buehne: "#063b29",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.74)",
  buehneFlaeche: "rgba(255,255,255,0.12)",
  buehneKnopf: "#7fe3b8",
  buehneKnopfText: "#063b29",
  /** Tab-Leiste: dunkle Kapsel */
  kapsel: "#0c1f18",
  leiste: "rgba(255,255,255,0.8)",
  schatten: 0.08,
};
const DUNKEL: typeof HELL = {
  papier: "#0b0f0d",
  blatt: "#18201c",
  flaeche: "#24302b",
  tinte: "#f2f5f3",
  tinteLeise: "#a3b3ac",
  linie: "#2c3832",
  linieLeise: "#222c27",
  rahmen: "#75847d",
  zeiger: "#4f5c56",
  amt: "#30d68b",
  amtTief: "#8ff0c1",
  amtHauch: "#0f3324",
  amtText: "#00180d",
  minze: "#7fe3b8",
  haupt: "#7fe3b8",
  hauptText: "#063b29",
  frist: "#ff7a70",
  fristHauch: "#3a1715",
  bald: "#ffb340",
  baldHauch: "#3a2a10",
  lila: "#a5a3ff",
  lilaHauch: "#25243f",
  gold: "#ffb340",
  goldHauch: "#3a2a10",
  blau: "#6eb4ff",
  blauHauch: "#132a46",
  buehne: "#0a2a1e",
  buehneText: "#ffffff",
  buehneLeise: "rgba(255,255,255,0.72)",
  buehneFlaeche: "rgba(255,255,255,0.1)",
  buehneKnopf: "#7fe3b8",
  buehneKnopfText: "#063b29",
  kapsel: "#1f2a25",
  leiste: "rgba(24,32,28,0.9)",
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
/** Ecken: Felder 14, Karten 24, Bühne und Blatt 32, Knöpfe 18 (abgerundete Rechtecke), Chips sind Pillen. */
export const RADIUS = { klein: 14, karte: 24, buehne: 32, blatt: 8, knopf: 18 } as const;
export const HAARLINIE = StyleSheet.hairlineWidth;

export function useFarben(): Farben {
  return useColorScheme() === "dark" ? DUNKEL : HELL;
}

/** Weicher Schatten für Karten (nur hell). */
export function schattenStil(f: Farben, staerke = 1) {
  if (!f.schatten) return null;
  return { shadowColor: "#063b29", shadowOpacity: f.schatten * staerke, shadowRadius: 14 * staerke, shadowOffset: { width: 0, height: 4 * staerke }, elevation: 2 * staerke };
}

export const istIos = Platform.OS === "ios";

/** Nächste Layout-Änderung weich einblenden (Auf- und Zuklappen) – im Web ohne Wirkung. */
export function weich(): void {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
/** Kennung der „Fertig“-Leiste über Zahlentastaturen (InputAccessoryView, iOS) */
export const TASTATUR_FERTIG = "amtlos-tastatur-fertig";
