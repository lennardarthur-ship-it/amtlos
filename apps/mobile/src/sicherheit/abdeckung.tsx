/**
 * Abdeckung für den App-Umschalter (M-3): iOS macht das Bild für den App-Umschalter, sobald die App „inactive“ wird –
 * noch bevor die Sperrseite (bei „background“) gezeichnet ist. Ist die App-Sperre an, legt sich deshalb schon bei
 * „inactive“ eine Fläche über alles, damit IBAN, SV-Nummern oder Kundendaten nicht im Umschalter stehen.
 */
import { useEffect, useState } from "react";
import { AppState, StyleSheet, View, type AppStateStatus } from "react-native";
import { Kachel } from "../ui/bausteine";
import { useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";

/** true, solange die App nicht im Vordergrund aktiv ist (inactive oder background). */
export function useVerdeckt(): boolean {
  // beim Start nur verdecken, wenn sicher im Hintergrund – „unknown“ würde sonst nie mehr aufgedeckt
  const [verdeckt, setVerdeckt] = useState(AppState.currentState === "background" || AppState.currentState === "inactive");
  useEffect(() => {
    // synchron im Ereignis setzen – kein Warten auf andere Zustände, damit die Fläche vor dem Schnappbild steht
    const abo = AppState.addEventListener("change", (z: AppStateStatus) => setVerdeckt(z !== "active"));
    return () => abo.remove();
  }, []);
  return verdeckt;
}

/**
 * Fläche über der ganzen App, solange sie nicht aktiv ist – nur bei eingeschalteter App-Sperre. Als letztes Kind in
 * den obersten Rahmen setzen (über Navigation und Sperrseite): `<Abdeckung />`.
 */
export function Abdeckung() {
  const { bereit, stand } = useAmtlos();
  const verdeckt = useVerdeckt();
  const f = useFarben();
  if (!bereit || !stand.appSperre || !verdeckt) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: f.papier, alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Kachel symbol="lock.fill" groesse={72} />
    </View>
  );
}
