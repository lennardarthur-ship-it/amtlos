import { StackActions } from "@react-navigation/native";
import { useCallback, useContext, useMemo } from "react";
import { T as TEXT } from "../texte";
import { Blatt, WurzelNavKontext, registrieren, useNav, type Nav } from "../ui/navigation";
import { BelegErfassenSeite } from "./Belege";
import type { SeitenKnopf } from "./gemeinsam";
import { ZielKontext, useStarten } from "./starten";
import { Unterlagen } from "./Unterlagen";

/** Blatt „Neu erstellen“ öffnen (alle Vorlagen, Suche, Anlässe). */
export function useErstellen() {
  const wurzel = useContext(WurzelNavKontext);
  return useMemo(() => ({ oeffnen: () => wurzel?.navigate("Neu") }), [wurzel]);
}

/**
 * Der „+“-Knopf oben rechts (E-141): auf dem iPhone ein Menü wie in Notizen oder Dateien – die zwei häufigsten
 * Handlungen direkt, alles andere im Blatt „Neu erstellen“. Im Web öffnet er das Blatt.
 */
export function useErstellenKnopf(): SeitenKnopf {
  const starten = useStarten();
  const nav = useNav();
  const erstellen = useErstellen();
  return useMemo(
    () => ({
      text: TEXT.erstellen,
      symbol: "plus",
      onPress: erstellen.oeffnen,
      menue: [
        { text: TEXT.rechnung_schreiben, symbol: "eurosign", onPress: () => starten("rechnung") },
        { text: TEXT.beleg_erfassen, symbol: "doc.viewfinder", onPress: () => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />, true) },
        { text: TEXT.alle_vorlagen_menue, symbol: "square.grid.2x2", onPress: erstellen.oeffnen },
      ],
    }),
    [starten, nav, erstellen],
  );
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
