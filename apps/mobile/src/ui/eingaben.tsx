import { useState } from "react";
import { View } from "react-native";
import { cent, type EinfachesFeld, type EintragWert } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, BausteinListe, DatumFeld, Feld, MehrfachWahl, Schalter, TextKnopf, UhrzeitFeld, Wahl } from "./bausteine";

/** Viele oder lange Möglichkeiten untereinander, wenige kurze als Chips. */
const alsListe = (texte: string[]) => texte.length > 12 || texte.some((t) => t.length > 28);
const ANDERS = "\u0001anders";

/**
 * Einzeiliges Feld mit festen Möglichkeiten (E-124): auswählen statt tippen. „Andere …“ öffnet ein Textfeld für den
 * seltenen Fall, dass nichts passt. Erneutes Tippen auf die gewählte Möglichkeit hebt die Auswahl auf.
 */
export function AuswahlMitAnders({ label, hilfe, optionen, wert, setzen }: { label: string; hilfe?: string; optionen: string[]; wert: string; setzen: (w: string) => void }) {
  const eigen = wert.trim() !== "" && !optionen.includes(wert.trim());
  const [anders, setAnders] = useState(eigen);
  const offen = anders || eigen;
  const auswahl = [...optionen.map((o) => ({ wert: o, text: o })), { wert: ANDERS, text: TEXT.andere }];
  const gewaehlt = offen ? ANDERS : wert.trim() || null;
  const waehlen = (w: string) => {
    if (w === ANDERS) {
      setAnders(true);
      if (!eigen) setzen("");
      return;
    }
    setAnders(false);
    setzen(w === wert.trim() ? "" : w);
  };
  return (
    <View>
      {alsListe(optionen) ? <Auswahl label={label} hilfe={hilfe} wert={gewaehlt} aendern={waehlen} optionen={auswahl} /> : <Wahl label={label} hilfe={hilfe} wert={gewaehlt} aendern={waehlen} optionen={auswahl} />}
      {offen ? <Feld ohneLabel label={label} wert={eigen ? wert : ""} aendern={setzen} placeholder={TEXT.eigene_angabe} autoFocus={!eigen} /> : null}
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

/** Ein Eingabefeld je Feldart. */
export function Eingabe({ feld, wert, setzen }: { feld: EinfachesFeld; wert: EintragWert | undefined; setzen: (w: EintragWert) => void }) {
  const text = typeof wert === "string" ? wert : "";
  switch (feld.art) {
    case "text":
    case "mehrzeilig":
      if (feld.vorschlaege?.length)
        return feld.art === "text" ? <AuswahlMitAnders label={feld.label} hilfe={feld.hilfe} optionen={feld.vorschlaege} wert={text} setzen={setzen} /> : <ZeilenAuswahl label={feld.label} hilfe={feld.hilfe} optionen={feld.vorschlaege} wert={text} setzen={setzen} />;
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} mehrzeilig={feld.art === "mehrzeilig"} optional={!feld.pflicht} {...(feld.art === "text" ? tastaturFuer(feld.id) : {})} />;
    case "bausteine":
      return <BausteinListe label={feld.label} hilfe={feld.hilfe} werte={Array.isArray(wert) ? wert : []} aendern={setzen} optionen={feld.optionen} />;
    case "datum":
      return <DatumFeld label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} />;
    case "uhrzeit":
      return <UhrzeitFeld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} />;
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

