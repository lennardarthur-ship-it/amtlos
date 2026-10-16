import { StackActions } from "@react-navigation/native";
import { useCallback, useContext, useMemo } from "react";
import { Blatt, WurzelNavKontext, registrieren, type Nav } from "../ui/navigation";
import { ZielKontext } from "./starten";
import { Unterlagen } from "./Unterlagen";

/** Blatt „Neu erstellen“ öffnen (alle Vorlagen, Suche, Anlässe). */
export function useErstellen() {
  const wurzel = useContext(WurzelNavKontext);
  return useMemo(() => ({ oeffnen: () => wurzel?.navigate("Neu") }), [wurzel]);
}

/**
 * Das Blatt selbst: gewählt wird hier, gearbeitet im eigenen Blatt – eine gewählte Vorlage ersetzt das Blatt
 * „Neu erstellen“ durch ihren Ablauf (kein Blatt über dem Blatt).
 */
export function NeuBlatt() {
  const wurzel = useContext(WurzelNavKontext);
  const ziel = useCallback(
    (auf: (nav: Nav) => void) => {
      if (!wurzel) return;
      let geoeffnet = false;
      const ersatz: Nav = {
        oeffnen: (schluessel, inhalt) => {
          geoeffnet = true;
          wurzel.dispatch(StackActions.replace("Blatt", { id: registrieren(inhalt), schluessel }));
        },
        zurueck: () => wurzel.goBack(),
      };
      auf(ersatz);
      if (!geoeffnet) wurzel.goBack();
    },
    [wurzel],
  );
  const params = useMemo(() => ({ id: registrieren(() => <Unterlagen schliessen />), schluessel: "neu" }), []);
  return (
    <ZielKontext.Provider value={ziel}>
      <Blatt params={params} />
    </ZielKontext.Provider>
  );
}
