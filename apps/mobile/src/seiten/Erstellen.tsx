import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Platform, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { T as TEXT } from "../texte";
import { KopfKnopf } from "../ui/bausteine";
import { Stapel, type Nav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { ZielKontext } from "./starten";
import { Unterlagen } from "./Unterlagen";

interface Erstellen {
  /** Blatt „Neu erstellen“ öffnen (Rechnung, Beleg, alle Vorlagen) */
  oeffnen(): void;
}
const Kontext = createContext<Erstellen>({ oeffnen: () => undefined });
export const useErstellen = () => useContext(Kontext);

/**
 * Der zentrale „+“-Knopf öffnet ein Blatt mit allem, was sich erstellen lässt – wie in den besten Werkzeug-Apps:
 * ein Ort zum Anfangen, egal auf welcher Seite man gerade ist. Gewählt wird im Blatt, gearbeitet im Tab:
 * `navFuer` liefert den Stapel des aktuellen Tabs, in dem der Ablauf dann aufgeht.
 */
export function ErstellenAnbieter({ navFuer, children }: { navFuer: () => Nav | undefined; children: ReactNode }) {
  const [offen, setOffen] = useState(false);
  // jedes Öffnen beginnt auf der ersten Seite des Blatts (kein halb offener Anlass vom letzten Mal)
  const [runde, setRunde] = useState(0);
  const warten = useRef<((nav: Nav) => void) | null>(null);
  const ziel = useCallback(
    (auf: (nav: Nav) => void) => {
      // erst schließen, dann im Tab öffnen – sonst liegt der Ablauf unter dem Blatt
      setOffen(false);
      const nav = navFuer();
      if (!nav) return;
      if (Platform.OS === "ios") warten.current = auf;
      else setTimeout(() => auf(nav), 50);
    },
    [navFuer],
  );
  const wert = useMemo(
    () => ({
      oeffnen: () => {
        setRunde((r) => r + 1);
        setOffen(true);
      },
    }),
    [],
  );
  return (
    <Kontext.Provider value={wert}>
      {children}
      <Modal
        visible={offen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOffen(false)}
        onDismiss={() => {
          // iOS: erst nach dem Wegschieben des Blatts öffnen, sonst springt die Animation
          const auf = warten.current;
          warten.current = null;
          const nav = navFuer();
          if (auf && nav) auf(nav);
        }}
      >
        <SafeAreaProvider>
          <ZielKontext.Provider value={ziel}>
            <Blatt key={runde} schliessen={() => setOffen(false)} />
          </ZielKontext.Provider>
        </SafeAreaProvider>
      </Modal>
    </Kontext.Provider>
  );
}

function Blatt({ schliessen }: { schliessen: () => void }) {
  const f = useFarben();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={Platform.OS === "ios" ? ["left", "right"] : ["top", "left", "right"]}>
      {/* Griff oben: zeigt, dass sich das Blatt nach unten wegschieben lässt */}
      {Platform.OS === "ios" ? <View style={{ alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: f.linie, marginTop: 6 }} /> : null}
      <Stapel zuruecksetzen={0} wurzel={<Unterlagen aktion={<KopfKnopf symbol="xmark" label={TEXT.schliessen} onPress={schliessen} />} />} />
    </SafeAreaView>
  );
}
