import { useColorScheme } from "react-native";

/** Farben aus dem Designsystem (packages/web-kern/designsystem.css), hell und dunkel; Kontraste wie im Web geprüft. */
const HELL = {
  papier: "#f2f3ef",
  blatt: "#ffffff",
  tinte: "#1b2a3a",
  tinteLeise: "#4a5868",
  linie: "#d3d8d0",
  amt: "#136f5b",
  amtHauch: "#e3efeb",
  frist: "#b42318",
  fristHauch: "#fbe9e7",
  bald: "#a84a06",
  baldHauch: "#fdf0d9",
};
const DUNKEL: typeof HELL = {
  papier: "#11171d",
  blatt: "#19212a",
  tinte: "#e6eae3",
  tinteLeise: "#aeb8c2",
  linie: "#2f3a45",
  amt: "#5cc2a6",
  amtHauch: "#183a33",
  frist: "#ff8a7a",
  fristHauch: "#3d1d1a",
  bald: "#f5b453",
  baldHauch: "#3a2a12",
};
export type Farben = typeof HELL;

export const GROESSE = { klein: 13, basis: 16, gross: 20, titel: 25 } as const;
/** Mindestgröße für Tippziele (WCAG 2.5.8 verlangt 24, wir nehmen 48 wie Material/HIG). */
export const ZIEL = 48;

export function useFarben(): Farben {
  return useColorScheme() === "dark" ? DUNKEL : HELL;
}
