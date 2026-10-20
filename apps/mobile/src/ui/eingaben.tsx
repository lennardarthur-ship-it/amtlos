import { createContext, useContext, useState } from "react";
import { View } from "react-native";
import { PLATZHALTER, cent, passtZuGruppen, type Daten, type EinfachesFeld, type Eintrag, type EintragWert, type Option } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, BausteinListe, DatumFeld, Feld, MehrfachWahl, Schalter, T, TextKnopf, UhrzeitFeld, Wahl } from "./bausteine";
import { RADIUS, useFarben } from "./thema";

/**
 * Umfeld der Eingaben (R10): Branchengruppen des Betriebs (Vorschläge nach Branche) und die ganze Unterlage (Vorschläge
 * aus einer anderen Liste, z. B. die eigenen Kontrollpunkte bei einer Messung).
 */
export const EingabeKontext = createContext<{ gruppen: readonly string[]; daten?: Daten }>({ gruppen: [] });

/** Vorschläge eines Textfelds: eigene Einträge aus einer anderen Liste zuerst, dann die zur Branche passenden. */
export function vorschlaegeFuer(feld: EinfachesFeld, gruppen: readonly string[], daten?: Daten): string[] {
  if (feld.art !== "text" && feld.art !== "mehrzeilig") return [];
  const aus = feld.vorschlaegeAus && daten && Array.isArray(daten[feld.vorschlaegeAus.liste]) ? (daten[feld.vorschlaegeAus.liste] as Eintrag[]).map((e) => (typeof e?.[feld.vorschlaegeAus!.feld] === "string" ? (e[feld.vorschlaegeAus!.feld] as string).trim().split("\n")[0]! : "")).filter(Boolean) : [];
  const fest = (feld.vorschlaege ?? []).filter((v) => passtZuGruppen(feld.vorschlagGruppen?.[v], gruppen));
  return [...new Set([...aus, ...fest])];
}

/** Bausteine nach Branche: passende zuerst, gewählte immer sichtbar, der Rest auf Wunsch. */
function aufteilen(optionen: Option[], gruppen: readonly string[], gewaehlt: string[]): [Option[], Option[]] {
  const da = optionen.filter((o) => passtZuGruppen(o.gruppen, gruppen) || gewaehlt.includes(o.wert));
  return [da, optionen.filter((o) => !da.includes(o))];
}

/** Viele oder lange Möglichkeiten untereinander, wenige kurze als Chips. */
const alsListe = (texte: string[]) => texte.length > 12 || texte.some((t) => t.length > 28);
const ANDERS = "\u0001anders";

/** Vorschlag mit Platzhalter „…“ (z. B. „Guten Tag …“): wird zum Text, in dem nur noch der Name fehlt. */
const mitLuecke = (t: string) => t.includes(PLATZHALTER);

/**
 * Einzeiliges Feld mit festen Möglichkeiten (E-124): auswählen statt tippen. „Andere …“ öffnet ein Textfeld für den
 * seltenen Fall, dass nichts passt. Erneutes Tippen auf die gewählte Möglichkeit hebt die Auswahl auf. Vorschläge mit
 * „…“ (R10) öffnen das Textfeld vorbefüllt, der Platzhalter ist markiert – Tippen ersetzt ihn durch den Namen.
 */
export function AuswahlMitAnders({ label, hilfe, optionen, wert, setzen }: { label: string; hilfe?: string; optionen: string[]; wert: string; setzen: (w: string) => void }) {
  const f = useFarben();
  const roh = wert.trim();
  const eigen = roh !== "" && (!optionen.includes(roh) || mitLuecke(roh));
  const [anders, setAnders] = useState(eigen);
  // Markierung des Platzhalters nach der Wahl – gilt nur, bis jemand tippt oder den Cursor setzt
  const [stelle, setStelle] = useState<{ start: number; end: number } | undefined>(undefined);
  const offen = anders || eigen;
  const auswahl = [...optionen.map((o) => ({ wert: o, text: o })), { wert: ANDERS, text: TEXT.andere }];
  const gewaehlt = roh && optionen.includes(roh) ? roh : offen ? ANDERS : null;
  const waehlen = (w: string) => {
    if (w === ANDERS) {
      setAnders(true);
      setStelle(undefined);
      if (!eigen) setzen("");
      return;
    }
    if (mitLuecke(w) && w !== roh) {
      const i = w.indexOf(PLATZHALTER);
      setAnders(true);
      setStelle({ start: i, end: i + PLATZHALTER.length });
      setzen(w);
      return;
    }
    setAnders(false);
    setStelle(undefined);
    setzen(w === roh ? "" : w);
  };
  return (
    <View>
      {alsListe(optionen) ? <Auswahl label={label} hilfe={hilfe} wert={gewaehlt} aendern={waehlen} optionen={auswahl} /> : <Wahl label={label} hilfe={hilfe} wert={gewaehlt} aendern={waehlen} optionen={auswahl} />}
      {offen ? (
        <Feld
          ohneLabel
          label={label}
          wert={eigen ? wert : ""}
          aendern={(w) => {
            setStelle(undefined);
            setzen(w);
          }}
          placeholder={TEXT.eigene_angabe}
          autoFocus={!eigen || Boolean(stelle)}
          selection={stelle}
          onSelectionChange={(e) => {
            const s = e.nativeEvent.selection;
            if (stelle && (s.start !== stelle.start || s.end !== stelle.end)) setStelle(undefined);
          }}
        />
      ) : null}
      {mitLuecke(roh) ? <T v="caption" farbe={f.bald} stil={{ marginTop: 5 }}>{TEXT.platzhalter_ersetzen}</T> : null}
    </View>
  );
}

/**
 * Mehrzeiliges Feld mit Vorschlägen: Zeilen ankreuzen, eigener Text darunter. Gespeichert wird weiterhin ein Text
 * (gewählte Zeilen zuerst, dann die Ergänzung) – so bleiben ältere Unterlagen lesbar.
 */
export function ZeilenAuswahl({ label, hilfe, optionen, wert, setzen }: { label: string; hilfe?: string; optionen: string[]; wert: string; setzen: (w: string) => void }) {
  const zeilen = wert.split("\n");
  const gewaehlt = zeilen.map((z) => z.trim()).filter((z) => optionen.includes(z));
  const ergaenzung = zeilen.filter((z) => !optionen.includes(z.trim())).join("\n").replace(/^\n+/, "");
  const [offen, setOffen] = useState(false);
  const zusammen = (g: string[], e: string) => [...g, ...(e ? [e] : [])].join("\n");
  const waehlen = (neu: string[]) => setzen(zusammen(neu, ergaenzung));
  const zeigeText = offen || ergaenzung.trim() !== "";
  return (
    <View>
      {alsListe(optionen) ? (
        <BausteinListe label={label} hilfe={hilfe} werte={gewaehlt} aendern={(w) => waehlen(optionen.filter((o) => w.includes(o)))} optionen={optionen.map((o) => ({ wert: o, text: o }))} />
      ) : (
        <MehrfachWahl label={label} hilfe={hilfe} werte={gewaehlt} aendern={(w) => waehlen(optionen.filter((o) => w.includes(o)))} optionen={optionen.map((o) => ({ wert: o, text: o }))} />
      )}
      {zeigeText ? (
        <Feld ohneLabel mehrzeilig label={`${label}: ${TEXT.ergaenzung}`} wert={ergaenzung} aendern={(e) => setzen(zusammen(gewaehlt, e))} placeholder={TEXT.ergaenzung_platzhalter} autoFocus={offen && !ergaenzung} />
      ) : (
        <TextKnopf symbol="plus" text={TEXT.eigenen_text} label={`${label}: ${TEXT.eigenen_text}`} onPress={() => setOffen(true)} stil={{ marginTop: 4 }} />
      )}
    </View>
  );
}

/** Tastatur und Autokorrektur passend zum Feld – E-Mail, IBAN, Steuer-ID & Co. dürfen nicht „verbessert“ werden. */
function tastaturFuer(id: string): Partial<React.ComponentProps<typeof Feld>> {
  const roh = { autoCorrect: false, spellCheck: false } as const;
  if (/email/.test(id)) return { ...roh, keyboardType: "email-address", autoCapitalize: "none", textContentType: "emailAddress", autoComplete: "email" };
  if (/(^|_)(iban|bic|ust_idnr|ust_id)$/.test(id)) return { ...roh, autoCapitalize: "characters" };
  if (/(^|_)steuer_id$/.test(id)) return { ...roh, keyboardType: "number-pad" };
  if (/(^|_)(sv_nummer|steuernummer)$/.test(id)) return { ...roh, autoCapitalize: "characters" };
  if (/(^|_)(telefon|tel)$/.test(id)) return { ...roh, keyboardType: "phone-pad", textContentType: "telephoneNumber" };
  if (/(^|_)plz$/.test(id)) return { ...roh, keyboardType: "number-pad", textContentType: "postalCode" };
  if (/(^|_)(website|url|webseite)$/.test(id)) return { ...roh, keyboardType: "url", autoCapitalize: "none", textContentType: "URL" };
  return {};
}

/**
 * Bausteine nach Branche (R10): die passenden Themen, gewählte immer; die übrigen hinter „Weitere“ – beim Friseur keine
 * Fritteuse, beim Elektriker keine Friseurchemikalien.
 */
function BausteineNachBranche({ feld, werte, setzen }: { feld: Extract<EinfachesFeld, { art: "bausteine" }>; werte: string[]; setzen: (w: string[]) => void }) {
  const { gruppen } = useContext(EingabeKontext);
  const [alle, setAlle] = useState(false);
  const [da, rest] = aufteilen(feld.optionen, gruppen, werte);
  return (
    <View>
      <BausteinListe label={feld.label} hilfe={feld.hilfe} werte={werte} aendern={setzen} optionen={alle ? feld.optionen : da} />
      {rest.length ? <TextKnopf symbol={alle ? "chevron.up" : "chevron.down"} erweitert={alle} text={alle ? TEXT.weniger_themen : TEXT.weitere_themen(rest.length)} onPress={() => setAlle(!alle)} stil={{ marginTop: 6 }} /> : null}
    </View>
  );
}

/** Ein Eingabefeld je Feldart; hervorgehobene Felder (z. B. Produktname) auf getönter Fläche. */
export function Eingabe({ feld, wert, setzen }: { feld: EinfachesFeld; wert: EintragWert | undefined; setzen: (w: EintragWert) => void }) {
  const f = useFarben();
  const inhalt = <EingabeFeld feld={feld} wert={wert} setzen={setzen} />;
  if (!feld.hervor) return inhalt;
  return <View style={{ marginTop: 14, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 0, borderRadius: RADIUS.klein, backgroundColor: f.amtHauch }}>{inhalt}</View>;
}

function EingabeFeld({ feld, wert, setzen }: { feld: EinfachesFeld; wert: EintragWert | undefined; setzen: (w: EintragWert) => void }) {
  const { gruppen, daten } = useContext(EingabeKontext);
  const text = typeof wert === "string" ? wert : "";
  switch (feld.art) {
    case "text":
    case "mehrzeilig": {
      const vorschlaege = vorschlaegeFuer(feld, gruppen, daten);
      if (vorschlaege.length)
        return feld.art === "text" ? <AuswahlMitAnders label={feld.label} hilfe={feld.hilfe} optionen={vorschlaege} wert={text} setzen={setzen} /> : <ZeilenAuswahl label={feld.label} hilfe={feld.hilfe} optionen={vorschlaege} wert={text} setzen={setzen} />;
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} mehrzeilig={feld.art === "mehrzeilig"} optional={!feld.pflicht} {...(feld.art === "text" ? tastaturFuer(feld.id) : {})} />;
    }
    case "bausteine":
      return <BausteineNachBranche feld={feld} werte={Array.isArray(wert) ? wert : []} setzen={setzen} />;
    case "datum":
      return <DatumFeld label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} />;
    case "uhrzeit":
      return <UhrzeitFeld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} jetzt={feld.jetzt} />;
    case "betrag":
      // Preis einer Position darf negativ sein (Nachlass) – die Zifferntastatur hat kein Minus
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} keyboardType={feld.id === "preis" ? "numbers-and-punctuation" : "decimal-pad"} placeholder="0,00" optional={!feld.pflicht} fehler={text.trim() && cent(text) === null ? TEXT.betrag_falsch : null} />;
    case "zahl":
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} keyboardType="decimal-pad" optional={!feld.pflicht} fehler={text.trim() && cent(text) === null ? TEXT.zahl_falsch : null} />;
    case "schalter":
      return <Schalter label={feld.label} hilfe={feld.hilfe} wert={wert === true} aendern={setzen} />;
    case "mehrfach":
      return <MehrfachWahl label={feld.label} hilfe={feld.hilfe} werte={Array.isArray(wert) ? wert : []} aendern={setzen} optionen={feld.optionen} />;
    case "wahl": {
      const lang = feld.optionen.length > 4 || feld.optionen.some((o) => o.text.length > 22);
      return lang ? <Auswahl label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} optionen={feld.optionen} /> : <Wahl label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} optionen={feld.optionen} />;
    }
  }
}

