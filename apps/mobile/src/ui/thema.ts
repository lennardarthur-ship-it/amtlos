import { Platform, useColorScheme } from "react-native";

/**
 * Designsystem der App (docs/06-design.md, E-117): Papier und Tinte, eine Handlungsfarbe, Statusfarben nur mit Text.
 * Farben wie im Web (packages/web-kern/designsystem.css), Schrift Atkinson Hyperlegible wie im Web.
 */
const HELL = {
  papier: "#f2f3ef",
  blatt: "#ffffff",
  tinte: "#1b2a3a",
  tinteLeise: "#4a5868",
  linie: "#d3d8d0",
  linieLeise: "#e6e9e3",
  amt: "#136f5b",
  amtTief: "#0d5143",
  amtHauch: "#e3efeb",
  frist: "#b42318",
  fristHauch: "#fbe9e7",
  bald: "#a84a06",
  baldHauch: "#fdf0d9",
  leiste: "rgba(242,243,239,0.82)",
};
const DUNKEL: typeof HELL = {
  papier: "#11171d",
  blatt: "#19212a",
  tinte: "#e6eae3",
  tinteLeise: "#aeb8c2",
  linie: "#2f3a45",
  linieLeise: "#232d38",
  amt: "#5cc2a6",
  amtTief: "#8ad8c2",
  amtHauch: "#183a33",
  frist: "#ff8a7a",
  fristHauch: "#3d1d1a",
  bald: "#f5b453",
  baldHauch: "#3a2a12",
  leiste: "rgba(17,23,29,0.82)",
};
export type Farben = typeof HELL;

/** Typografische Skala (iOS-nah, Atkinson Hyperlegible). */
export const SCHRIFT = {
  regular: "AtkinsonHyperlegible_400Regular",
  bold: "AtkinsonHyperlegible_700Bold",
} as const;
export const GROESSE = { caption: 13, klein: 15, basis: 17, gross: 20, titel: 22, grossTitel: 34, blatt: 38 } as const;
/** Mindestgröße für Tippziele */
export const ZIEL = 48;
/** Seitenrand (iOS: 20 pt) */
export const RAND = 20;
export const RADIUS = { klein: 8, karte: 14, blatt: 10 } as const;

export function useFarben(): Farben {
  return useColorScheme() === "dark" ? DUNKEL : HELL;
}

export const istIos = Platform.OS === "ios";
