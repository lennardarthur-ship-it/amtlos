import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { ohneVerdeckteFelder, sichtbar, type Daten, type EinfachesFeld, type Eintrag, type EintragWert, type Feld, type ListenFeld } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { TextKnopf } from "../ui/bausteine";
import { weich } from "../ui/thema";
import { Eingabe } from "../ui/eingaben";

/** Hat ein Feld einen Wert, den jemand eingetragen hat? (Schalter aus, leere Texte und Listen zählen nicht) */
export const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w === true);

/**
 * Felder eines Schritts oder Eintrags (E-124). Seltene Felder stehen hinter „Weitere Angaben“ – außer sie sind
 * schon ausgefüllt oder werden unter „Fehlt noch“ genannt. Listen zeichnet der Aufrufer (`liste`).
 */
export function Felder({ felder, werte, setze, fehlt, liste }: { felder: Feld[]; werte: Daten | Eintrag; setze: (k: string, w: EintragWert) => void; fehlt: string[]; liste?: (f: ListenFeld) => ReactNode }) {
  const [alle, setAlle] = useState(false);
  const sichtbareWerte = ohneVerdeckteFelder(felder, werte);
  const da = felder.filter((x) => sichtbar(x, sichtbareWerte));
  const versteckt = (x: Feld) => Boolean(x.selten) && !alle && !gefuellt(werte[x.id]) && !fehlt.some((l) => l === x.label || l.endsWith(`: ${x.label}`));
  const selten = da.filter((x) => x.selten);
  const zeigen = da.filter((x) => !versteckt(x));
  return (
    <View>
      {zeigen.map((x) => (x.art === "liste" ? <View key={x.id}>{liste?.(x)}</View> : <Eingabe key={x.id} feld={x as EinfachesFeld} wert={werte[x.id] as EintragWert} setzen={(w) => setze(x.id, w)} />))}
      {selten.length && (alle || selten.some(versteckt)) ? (
        <TextKnopf symbol={alle ? "chevron.up" : "chevron.down"} text={alle ? TEXT.weniger_angaben : TEXT.weitere_angaben(selten.filter(versteckt).length)} onPress={() => { weich(); setAlle(!alle); }} stil={{ marginTop: 14 }} />
      ) : null}
    </View>
  );
}
