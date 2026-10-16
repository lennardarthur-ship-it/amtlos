import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold, useFonts } from "@expo-google-fonts/onest";

/** Onest (OFL 1.1) in fünf Schnitten laden – die Schrift der App (E-142). Liefert, ob sie bereitsteht. */
export function useSchrift(): boolean {
  const [da, fehler] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold });
  // lässt sich die Schrift nicht laden, trotzdem starten (Systemschrift als Ersatz)
  return da || Boolean(fehler);
}
