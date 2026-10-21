import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";
import { gruppenFuerBetrieb, ohneVerdeckteFelder, sichtbar, type Daten, type EinfachesFeld, type Eintrag, type EintragWert, type Feld, type ListenFeld } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { T, TextKnopf } from "../ui/bausteine";
import { weich } from "../ui/thema";
import { Eingabe, EingabeKontext } from "../ui/eingaben";
import { useStandWahl } from "../zustand";

/** Meldung ansagen, sobald sie erscheint oder sich ändert – VoiceOver kennt keine Live-Regionen und keine Rolle „alert“. */
export function useAnsage(text: string | null | undefined) {
  useEffect(() => {
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}

/** Kurze Fehlermeldung als Text (z. B. direkt über dem Hauptknopf), die beim Erscheinen angesagt wird. */
export function Ansage({ text, farbe, v = "klein", fett = true }: { text: string; farbe?: string; v?: "klein" | "caption"; fett?: boolean }) {
  useAnsage(text);
  return <T v={v} fett={fett} farbe={farbe} accessibilityRole="alert" accessibilityLiveRegion="polite">{text}</T>;
}

/** Hat ein Feld einen Wert, den jemand eingetragen hat? (Schalter aus, leere Texte und Listen zählen nicht) */
export const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w === true);

/**
 * Felder eines Schritts oder Eintrags (E-124). Seltene Felder stehen hinter „Weitere Angaben“ – außer sie sind
 * schon ausgefüllt oder werden unter „Fehlt noch“ genannt. Listen zeichnet der Aufrufer (`liste`).
 */
export function Felder({ felder, werte, setze, fehlt, liste, kontext }: { felder: Feld[]; werte: Daten | Eintrag; setze: (k: string, w: EintragWert) => void; fehlt: string[]; liste?: (f: ListenFeld) => ReactNode; /** ganze Unterlage, wenn `werte` ein Listeneintrag ist (Vorschläge aus anderen Listen) */ kontext?: Daten }) {
  const [alle, setAlle] = useState(false);
  // Branche aus dem Pflichten-Check: Vorschläge und Bausteine passend zum Betrieb (R10)
  const branchen = useStandWahl((s) => s.profil["taetigkeit.branchen"]);
  // R12: dazu Werkstatt, Bäckerei und Transport (Themen der Unterweisung)
  const name = useStandWahl((s) => s.betrieb.name);
  const umfeld = useMemo(() => ({ gruppen: gruppenFuerBetrieb(branchen, name), daten: kontext ?? (werte as Daten) }), [branchen, name, kontext, werte]);
  const sichtbareWerte = ohneVerdeckteFelder(felder, werte);
  const da = felder.filter((x) => sichtbar(x, sichtbareWerte));
  // unter „Fehlt noch“ genannt (auch „Anrede: Name statt „…“ eintragen“): Feld zeigen, nicht hinter „Weitere Angaben“
  const versteckt = (x: Feld) => Boolean(x.selten) && !alle && !gefuellt(werte[x.id]) && !fehlt.some((l) => l === x.label || l.endsWith(`: ${x.label}`) || l.startsWith(`${x.label}: `));
  const selten = da.filter((x) => x.selten);
  const zeigen = da.filter((x) => !versteckt(x));
  return (
    <EingabeKontext.Provider value={umfeld}>
      <View>
      {zeigen.map((x) => (x.art === "liste" ? <View key={x.id}>{liste?.(x)}</View> : <Eingabe key={x.id} feld={x as EinfachesFeld} wert={werte[x.id] as EintragWert} setzen={(w) => setze(x.id, w)} />))}
      {selten.length && (alle || selten.some(versteckt)) ? (
        <TextKnopf symbol={alle ? "chevron.up" : "chevron.down"} text={alle ? TEXT.weniger_angaben : TEXT.weitere_angaben(selten.filter(versteckt).length)} onPress={() => { weich(); setAlle(!alle); }} stil={{ marginTop: 14 }} />
      ) : null}
      </View>
    </EingabeKontext.Provider>
  );
}
