import { useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { GMBH_ANGABEN, KG_ANGABEN, KU_HINWEIS, betragUnplausibel, offeneLuecken, pruefHinweisFuer, skontoBetrag, skontoFuer, cent as centAus, dateinamenTeil, dokumentHtml, eRechnungAus, pdfDateiname, vorlageFuer, xrechnungUbl, type Daten, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, Stempel, StempelAuftritt, Symbol, T, TextKnopf, Wahl, Zeile, textAus } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { BLATT_OBEN, HAARLINIE, RADIUS, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { Papier, PapierBlatt } from "./Papier";
import { GrosserBetrag, RechtsHinweis } from "./gemeinsam";
import { mitVorlagenHinweis } from "../rechtshinweis";
import { pdfAusgeben, pdfBytesAusgeben } from "../unterlagen/pdf";
import { pdfAusgabe, pdfEinlesen } from "../unterlagen/pdfOriginal";
import { NUMMER_DOPPELT, fehltFuer, lueckenFrage, vaOhneEuroFrage } from "../unterlagen/pruefung";
import { dateiTeilen, dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { ausgabeHtml, druckBetrieb, druckFesthalten, nachgebildet } from "../unterlagen/ausgabe";
import { UNEINBRINGLICH_GRUENDE, absenderFuer, geteiltOffenLetzte, geteilteVersionen, guthabenRest, guthabenVerrechnungen, guthabenVerwendet, heute, offenAmTag, uneinbringlichMoeglich, verrechenbareRechnungen, zahlungPruefen, type EuStornoGrund, type GuthabenEintrag, type UneinbringlichGrund } from "../unterlagen/speicher";
import { einMonatNach, euBerichtigungSchluessel, euFehlerErkannt, euMeldeArtVon, euStornoGrund, euStornoGrundFest, euStornoTag, periodeText } from "../unterlagen/ustAusRechnungen";
import { euroText, faelligAm, offenBrutto, rechnungBrutto } from "../unterlagen/ablage";
import { useAmtlos } from "../zustand";
import { versandBestaetigt } from "./versand";
import { bestaetigen, hinweisen } from "../ui/bestaetigen";
import { AbsenderSeite } from "./Betrieb";
import { BetriebTeilSeite } from "./Absender";
import { handwerkLaut, ohneZahlungsweg } from "./rechnungHinweise";
import { Ablauf, fehltJeSchritt } from "./Ablauf";
import { useProSperre } from "./Pro";
import { ausgabeErlaubt, ausgabeGrund, eRechnungErlaubt, erstellenErlaubt } from "../pro/regeln";
import { Ansage, useAnsage } from "./felder";
import { GEWERBE_VORLAGE } from "../gewerbe/felder";
import { GewerbeOnlineSeite } from "./GewerbeOnline";

/**
 * Nachkontrolle Rechtsanwalt (21.10.2026): Form der Unterlage als Kasten – am Anfang des Ablaufs und im Abschluss vor dem
 * Teilen (NachwG: Schriftform in den Branchen nach § 2a SchwarzArbG, sonst Textform mit Empfangsnachweis).
 */
export function FormHinweis({ v, d, unten = 12 }: { v: Vorlage; d: Daten; unten?: number }) {
  const f = useFarben();
  const h = v.formHinweis?.(d);
  if (!h) return null;
  // E-167: Unterschrift der Unterwiesenen (Gefahrstoffe/Biostoffe) wie die Schriftform hervorgehoben
  const schrift = h.form === "schrift" || h.form === "unterschrift";
  const titel = h.form === "unterschrift" ? TEXT.sifa_unterschrift_titel : schrift ? TEXT.nk_form_schrift_titel : h.form === "text" ? TEXT.nk_form_text_titel : TEXT.nk_form_offen_titel;
  return (
    <View accessible accessibilityLabel={`${titel}. ${h.text}`} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: RADIUS.karte, backgroundColor: schrift ? f.baldHauch : f.flaeche, marginBottom: unten }}>
      <View style={{ paddingTop: 2 }}>
        <Symbol name={schrift ? "printer" : "doc.text"} groesse={18} farbe={schrift ? f.bald : f.tinteLeise} gewicht="semibold" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T fett>{titel}</T>
        <T v="klein">{h.text}</T>
      </View>
    </View>
  );
}

/**
 * Satz direkt über „PDF teilen“, solange die Unterlage noch nicht festgeschrieben ist (E-127): was das erste Teilen
 * bewirkt – bei Rechnungen mit dem Hinweis aufs Stornieren.
 */
export function festschreibenHinweis(v: Vorlage, fest: boolean): string | null {
  if (!v.festschreiben || fest) return null;
  return v.storno ? TEXT.rechnung_wird_festgeschrieben : TEXT.wird_festgeschrieben;
}

/**
 * Zu welchem Schritt eine Meldung aus „Fehlt noch“ gehört: Feld mit genau dieser Bezeichnung oder Zuordnung der
 * Vorlage (`pruefenZu`, z. B. „PLZ und Ort des Empfängers fehlen“ → Anschrift). −1: keinem Schritt zuzuordnen.
 */
export function schrittFuer(v: Vorlage, text: string): number {
  const feld = v.pruefenZu?.[text];
  return v.abschnitte.findIndex((a) => a.felder.some((x) => x.label === text || (feld !== undefined && x.id === feld)));
}

/**
 * PDF teilen oder drucken – mit Ladezustand und Fehlermeldung. Dokumente an Kunden (Rechnung) gehen nur vollständig
 * raus; nach dem Teilen bzw. Drucken gilt die Unterlage als ausgegeben und wird ggf. festgeschrieben (E-127).
 */
export function useTeilen(id: string) {
  const z = useAmtlos();
  const melden = useMeldung();
  const sperre = useProSperre();
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ausgabe = async (art: "teilen" | "drucken") => {
    const u = z.stand.unterlagen.find((x) => x.id === id);
    const v = u ? vorlageFuer(u.vorlage) : undefined;
    if (!u || !v) return;
    setFehler(null);
    if (v.kundendokument && fehltFuer(z.stand, u).length) return setFehler(TEXT.erst_vollstaendig);
    // E-210: Lücken im Text („[bitte ergänzen]“) – nachfragen, bevor ein unvollständiges Impressum hinausgeht
    const luecken = lueckenFrage(v, u.daten, druckBetrieb(z.stand, u, z.pro));
    if (luecken && !(await bestaetigen(luecken))) return;
    // E-224: Voranmeldung mit Erwerbs- bzw. § 13b-Belegen ohne Euro-Betrag im Zeitraum – nur nach Rückfrage hinaus
    const ohneEuro = vaOhneEuroFrage(z.stand, u);
    if (ohneEuro && !(await bestaetigen(ohneEuro))) return;
    // E-188: eine noch nie ausgegebene Rechnung bzw. Vorlage nur mit Pro; erneutes Teilen, Stornos und Kassenbuch gehen immer
    if (!ausgabeErlaubt(u, z.pro) && !sperre(ausgabeGrund(u), undefined, { entwurf: true })) return;
    setLaedt(art === "teilen");
    // der Inhalt, aus dem das PDF entsteht (H1): Ändert er sich, während das Teilen-Menü offen ist (z. B. durch die
    // Synchronisation), wird nicht festgeschrieben
    const pdfDaten = u.daten;
    try {
      // R12 GoBD: festgeschrieben mit den festgehaltenen Absenderdaten; beim ersten Teilen werden die jetzigen festgehalten.
      // E-220 (8b): festgehalten wird, was gedruckt wird (Absender nach der Pro-Regel und das HTML); festgeschrieben genau
      // das damals gedruckte Dokument
      const absender = druckBetrieb(z.stand, u, z.pro);
      const html = u.festgeschrieben ? ausgabeHtml(z.stand, u, z.pro) : dokumentHtml(v, pdfDaten, absender);
      const name = pdfDateiname(v, u.daten, heute());
      // E-228 (T-300): festgeschrieben mit aufbewahrtem PDF → genau dieses; sonst neu erzeugt, und bei der ersten Ausgabe
      // einer Vorlage mit Festschreibung wird das ausgegebene PDF selbst aufbewahrt
      const erg = await pdfAusgabe(u, Boolean(v.festschreiben), {
        lesen: z.dateiLesen,
        erzeugenUndAusgeben: () => pdfAusgeben(html, name, Boolean(v.querformat), art),
        bytesAusgeben: (b) => pdfBytesAusgeben(b, name, art),
        ablegen: (b) => z.dateiSpeichern(b, "pdf"),
        jetzt: () => new Date().toISOString(),
      });
      // abgebrochen: nichts festschreiben, nichts vom Freikontingent verbrauchen (abgelegt wird erst nach dem Teilen)
      if (!erg.ok) return;
      const sha = erg.sha256;
      if (erg.nachgereicht && !z.pdfOriginalSetzen(id, erg.nachgereicht)) z.dateiVerwerfen(erg.nachgereicht.datei);
      if (erg.originalFehlt) melden(TEXT.e228_original_fehlt, "info");
      // E-232 (T-328 c): über 10 MB – nicht aufbewahrt, der Nutzer muss das geteilte PDF selbst aufbewahren
      if (erg.zuGross) await hinweisen(TEXT.e232_pdf_selbst_titel, TEXT.e232_pdf_selbst(erg.zuGross.groesse));
      if (u.festgeschrieben) {
        if (erg.zuGross) z.pdfSelbstVermerken(id, erg.zuGross);
        return void z.ausgeben(id, pdfDaten, sha, absender, false, html);
      }
      // E-193 (4): Android meldet einen Abbruch des Teilen-Menüs (und des Druckdialogs) nicht – erst nach „Ja“ festschreiben;
      // bei „Nein“ bleibt der Entwurf, die ausgegebene Fassung wird vermerkt (später „Doch verschickt – festschreiben“)
      if (!(await versandBestaetigt(u, v, art === "drucken"))) return z.teilenOffen(id, { daten: pdfDaten, art: art === "drucken" ? "druck" : "pdf", ...(sha ? { pdfSha256: sha } : {}), absender, druck: druckFesthalten(html, absender.logo, new Date().toISOString()), ...(erg.neu ? { pdf: erg.neu } : erg.zuGross ? { pdfSelbst: erg.zuGross } : {}) });
      const erstesMal = !u.ausgegeben;
      if (!z.ausgeben(id, pdfDaten, sha, absender, false, html, erg.neu, erg.zuGross)) {
        if (erg.neu) z.dateiVerwerfen(erg.neu.datei);
        return melden(TEXT.pdf_geaendert, "info");
      }
      // ohne Festschreibung (Vorlage ohne `festschreiben`) zeigt nichts auf die Datei – nicht liegen lassen
      if (erg.neu) z.dateiVerwerfen(erg.neu.datei);
      if (erstesMal && v.festschreiben) z.erfolg();
    } catch {
      setFehler(TEXT.pdf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const [eFehlt, setEFehlt] = useState<string[]>([]);
  /** E-Rechnung (XRechnung, UBL) als Datei teilen – nur vollständig; zählt wie das PDF als ausgegeben (E-128). */
  const eRechnung = async () => {
    const u = z.stand.unterlagen.find((x) => x.id === id);
    const v = u ? vorlageFuer(u.vorlage) : undefined;
    if (!u || !v?.eRechnung) return;
    setFehler(null);
    // E-156/E-188: Erstellen gehört zu Pro – eine schon einmal geteilte E-Rechnung geht immer wieder hinaus
    if (!eRechnungErlaubt(u, z.pro) && !sperre("e_rechnung")) return;
    // E-220 (8b): wie beim PDF – festgehalten werden der gedruckte Absender und das Dokument (auch wenn zuerst die XRechnung hinausgeht)
    const absender = druckBetrieb(z.stand, u, z.pro);
    const { daten, fehlt } = eRechnungAus(u.daten, absender);
    const alle = [...new Set([...fehltFuer(z.stand, u), ...fehlt])];
    setEFehlt(alle);
    if (alle.length) return;
    const xmlDaten = u.daten;
    try {
      // R12 GoBD: eine festgeschriebene Rechnung gibt ihr festgehaltenes Original weiter
      if (!(await dateiTeilen(`E-Rechnung-${dateinamenTeil(daten.nummer, 60) || "ohne-Nummer"}.xml`, u.festgeschrieben && u.xml ? u.xml : xrechnungUbl(daten, KU_HINWEIS), "application/xml"))) return;
      // E-193 (4): auf Android erst nach „Ja, festschreiben“ (wie beim PDF)
      const html = u.festgeschrieben ? undefined : dokumentHtml(v, xmlDaten, absender);
      if (!(await versandBestaetigt(u, v, false))) return z.teilenOffen(id, { daten: xmlDaten, art: "xml", absender, ...(html ? { druck: druckFesthalten(html, absender.logo, new Date().toISOString()) } : {}) });
      if (!z.ausgeben(id, xmlDaten, undefined, absender, true, html)) melden(TEXT.pdf_geaendert, "info");
    } catch {
      setFehler(TEXT.e_rechnung_fehler);
    }
  };
  // ohne Pro bei einer noch nie ausgegebenen Unterlage: „PDF teilen · Pro“ – man soll nicht erst beim Tippen gegen den Bezahlschirm laufen
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const frei = !u || ausgabeErlaubt(u, z.pro);
  // E-188: darüber, dass das PDF zu Pro gehört und der Entwurf bleibt
  const kontingent = !frei ? { text: TEXT.pro_vorlage_pdf, leer: true } : null;
  return { laedt, fehler, eFehlt, frei, kontingent, los: () => ausgabe("teilen"), drucken: () => ausgabe("drucken"), eRechnung };
}


/**
 * E-228 (T-300): Aufbewahrtes Original-PDF einer festgeschriebenen Unterlage – Hinweis mit Prüfwert. Ohne Original (vor
 * dem Update festgeschrieben): das damals geteilte PDF einlesen (z. B. aus dem Postausgang der Mail); stimmt sein
 * SHA-256 mit dem beim ersten Teilen gespeicherten Prüfwert überein, wird es als Original aufbewahrt, sonst nicht.
 */
function PdfOriginalZeile({ id }: { id: string }) {
  const z = useAmtlos();
  const [laedt, setLaedt] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "warnung"; text: string } | null>(null);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  if (!u?.festgeschrieben) return null;
  const zeit = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const einlesen = async () => {
    setMeldung(null);
    const d = await dateiWaehlenBytes(["application/pdf"]).catch(() => null);
    if (!d) return;
    setLaedt(true);
    try {
      const r = await pdfEinlesen(u, d.bytes, (b) => z.dateiSpeichern(b, "pdf"), new Date().toISOString());
      if (r.pdf) {
        if (z.pdfOriginalSetzen(id, r.pdf)) setMeldung({ art: "erfolg", text: TEXT.e228_einlesen_gleich });
        else {
          z.dateiVerwerfen(r.pdf.datei);
          setMeldung({ art: "warnung", text: TEXT.e228_einlesen_fehler });
        }
      } else setMeldung({ art: "warnung", text: TEXT.e228_einlesen_ergebnis(r.ergebnis, r.sha256, u.pdfSha256 ?? null) });
    } catch {
      setMeldung({ art: "warnung", text: TEXT.e228_einlesen_fehler });
    } finally {
      setLaedt(false);
    }
  };
  // E-232 (T-328 c): zu groß zum Aufbewahren – deutlich sagen, dass das geteilte PDF selbst aufzubewahren ist
  if (u.pdfSelbst)
    return (
      <View style={{ marginTop: 4 }}>
        <Hinweis art="warnung" text={TEXT.e232_pdf_selbst_vermerk(zeit(u.pdfSelbst.am), u.pdfSelbst.groesse)} />
      </View>
    );
  if (u.pdf)
    return (
      <View style={{ marginTop: 4 }}>
        <T v="caption" leise>{TEXT.e228_original(zeit(u.pdf.am), u.pdf.sha256, u.pdf.quelle === "eingelesen")}</T>
        {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
      </View>
    );
  return (
    <View style={{ marginTop: 4 }}>
      <T v="caption" leise>{u.pdfFolgt ? TEXT.e228_original_folgt : TEXT.e228_ohne_original}</T>
      {u.pdfFolgt ? null : <TextKnopf symbol="doc.text" text={laedt ? TEXT.e228_einlesen_laedt : TEXT.e228_einlesen} onPress={() => void einlesen()} />}
      {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
    </View>
  );
}

/** R12: Angabe aus „Mein Betrieb“ ergänzen – Gesellschaftsangaben (§ 35a GmbHG; E-193: §§ 125, 177a HGB) bzw. Absender. */
export function betriebOeffnen(nav: ReturnType<typeof useNav>, fehlt: string[]) {
  const betrieb = fehlt.filter((x) => x.includes("Mein Betrieb"));
  if (betrieb.length && betrieb.every((x) => x.includes(GMBH_ANGABEN) || x.includes(KG_ANGABEN))) nav.oeffnen("betrieb-gesellschaft", () => <BetriebTeilSeite teil="gesellschaft" />, true);
  else nav.oeffnen("absender", () => <AbsenderSeite />, true);
}


function VorschauSeite({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const teilen = useTeilen(id);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return <Unterseite titel="">{null}</Unterseite>;
  // E-210: Lücken im Text auch in der Vorschau ansagen
  const luecken = u.festgeschrieben ? 0 : offeneLuecken(v, u.daten, druckBetrieb(z.stand, u, z.pro));
  return (
    <Unterseite titel={TEXT.vorschau}>
      {/* das Dokument als Blatt Papier mit Rand und Schatten (E-144) */}
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flex: 1, borderRadius: RADIUS.blatt, overflow: "hidden", backgroundColor: "#ffffff", shadowColor: "#120e3a", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
          <Vorschau html={ausgabeHtml(z.stand, u, z.pro)} quer={v.querformat} />
        </View>
      </View>
      <Fuss ueber={teilen.fehler ? <Ansage text={teilen.fehler} farbe={f.frist} /> : luecken ? <Ansage text={TEXT.e210_luecken_hinweis(luecken)} farbe={f.frist} /> : teilen.kontingent ? <T v="caption" leise>{teilen.kontingent.text}</T> : festschreibenHinweis(v, Boolean(u.festgeschrieben)) ? <T v="caption" leise>{festschreibenHinweis(v, Boolean(u.festgeschrieben))}</T> : null}>
        <Knopf text={TEXT.mitPro(TEXT.pdf_teilen, teilen.frei)} symbol="square.and.arrow.up" laedt={teilen.laedt} onPress={() => void teilen.los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/**
 * Abschluss eines Ablaufs (E-124): Stand („Fertig“ bzw. was fehlt, mit Sprung zum Schritt), Ergebnis, Vorschau des
 * Dokuments, Übersicht der Schritte und weitere Möglichkeiten. Der Hauptknopf „PDF teilen“ steht im Fuß des Ablaufs.
 */
export function Abschluss({ id, springen, fehler, drucken: druckenLos, eRechnung, eFehlt = [] }: { id: string; springen: (schritt: number) => void; fehler: string | null; drucken: () => Promise<void>; eRechnung?: () => Promise<void>; eFehlt?: string[] }) {
  const z = useAmtlos();
  const sperre = useProSperre();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  // Stempel auf dem Papier (A1, B1): „Geteilt“ bzw. „Bezahlt“ – fällt nur auf, wenn es gerade eben passiert ist
  const stempel = u && v && u.festgeschrieben && v.storno && !u.daten.storno_zu ? (u.bezahlt ? "bezahlt" : "geteilt") : null;
  const stempelVorher = useRef(stempel);
  const stempelNeu = useRef<string | null>(null);
  // E-200: Grund, wenn ein geteilter, nicht bestätigter Entwurf gelöscht wird (Änderungsprotokoll)
  const [loeschGrund, setLoeschGrund] = useState("");
  // E-214: Grund des Stornos bei Rechnungen mit EU-Umsatz (Steuerberater 26.10.2026)
  const [euGrund, setEuGrund] = useState<EuStornoGrund | null>(null);
  // E-218: Tag, an dem der Fehler erkannt wurde – vorbelegt mit heute (= Datum des Stornos)
  const [euErkannt, setEuErkannt] = useState<string | null>(null);
  if (stempel !== stempelVorher.current) {
    stempelNeu.current = stempel;
    stempelVorher.current = stempel;
  }
  if (!u || !v) return null;
  const d = u.daten;
  const jeSchritt = fehltJeSchritt(v, d);
  const alle = fehltFuer(z.stand, u);
  const fest = Boolean(u.festgeschrieben);
  // E-193 (4): zuletzt geteilte, auf Android nicht als verschickt bestätigte Fassung
  const offen = geteiltOffenLetzte(u);
  // E-200: verschiedene geteilte Fassungen – bei mehr als einer wählt der Nutzer, welche hinausging
  const versionen = geteilteVersionen(u);
  const nummerSchritt = v.fortlaufend ? v.abschnitte.findIndex((a) => a.felder.some((x) => x.id === v.fortlaufend)) : -1;
  const storno = u.storniertDurch ? z.stand.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
  const imFormular = new Set(jeSchritt.flat());
  // Prüfungen außerhalb der Schritte: einem Schritt zuordnen, wenn ein Feld dort so heißt; sonst „Mein Betrieb“ bzw. ohne Sprung
  const extra = alle.filter((x) => !imFormular.has(x)).map((x) => ({ text: x, schritt: x === NUMMER_DOPPELT ? nummerSchritt : schrittFuer(v, x), betrieb: x.includes("Mein Betrieb") }));
  // E-220 (8b): festgeschrieben das damals gedruckte Dokument (bzw. nachgebildet mit dem festgehaltenen Absender)
  const html = ausgabeHtml(z.stand, u, z.pro);
  const luecken = offeneLuecken(v, d, druckBetrieb(z.stand, u, z.pro));
  const nachbild = nachgebildet(u);
  const ergebnis = v.ergebnis?.(d) ?? [];
  const fertig = alle.length === 0;
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  const zeitDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const geteilt = fest && v.storno && !d.storno_zu;
  // E-214: Rechnung mit EU-Umsatz (ZM) – beim Stornieren nach dem Grund fragen; auf der Stornorechnung die Folgen
  const euFrage = fest && v.storno && !u.storniertDurch && !d.storno_zu && !!euMeldeArtVon(u, z.stand.betrieb);
  const euGrundSt = d.storno_zu ? euStornoGrund(u) : null;
  const euTag = euGrundSt ? euStornoTag(z.stand.unterlagen, z.stand.betrieb, u) : null;
  const euZeitraum = euTag ? `${periodeText(euTag.slice(0, 7))} (bzw. ${periodeText(`${euTag.slice(0, 4)}-Q${Math.floor((Number(euTag.slice(5, 7)) - 1) / 3) + 1}`)})` : "";
  const euErledigt = z.stand.erledigt[euBerichtigungSchluessel(u.id)];
  // E-218 (T-273 (4)): älteres Storno einer innergemeinschaftlichen Lieferung ohne Grund – Grund nachtragen
  const euStornoOrig = d.storno_zu && u.stornoZuId ? z.stand.unterlagen.find((x) => x.id === u.stornoZuId) : undefined;
  const euGrundNachtragen = !!euStornoOrig && !euStornoGrundFest(u) && euMeldeArtVon(euStornoOrig, z.stand.betrieb) !== null;
  // Rechnung an jemanden: auf der Bühne Stand und Empfänger – der Betrag steht groß auf dem Papier darunter (A13)
  const kunde = typeof d.kunde_name === "string" ? d.kunde_name.trim() : "";
  const kurzDatum = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  const faellig = v.storno && !d.storno_zu ? faelligAm(u) : null;
  const empfaengerZeile = v.storno && kunde ? [TEXT.an_empfaenger(kunde), u.bezahlt ? TEXT.bezahlt_am_kurz(kurzDatum(u.bezahlt)) : faellig ? TEXT.faellig_kurz(kurzDatum(faellig)) : ""].filter(Boolean).join("\u00a0· ") : "";
  const standText = fest ? (u.bezahlt && geteilt ? TEXT.stempel_bezahlt : geteilt ? TEXT.geteilt_titel : TEXT.festgeschrieben_titel) : fertig ? TEXT.alles_drin : TEXT.fast_fertig;
  // Ergebnis in Euro (z. B. EÜR) groß wie überall auf der Bühne; andere Ergebnisse (Stunden …) als Text
  const letzte = ergebnis.at(-1);
  const letzteCent = letzte && /€\s*$/.test(letzte[1]) ? centAus(letzte[1].replace(/\s*€\s*$/, "")) : null;
  return (
    <View>
      {/* Bühne (E-142): Stand, Empfänger bzw. Ergebnis und das Dokument als Blatt Papier auf dem Navy der Bühne */}
      <View style={{ paddingTop: 8, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {fertig || fest ? <Symbol name={fest && !geteilt ? "lock.fill" : "checkmark.circle.fill"} groesse={20} farbe={f.minze} gewicht="semibold" /> : null}
          <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.halb }}>{standText}</T>
        </View>
        {empfaengerZeile ? (
          <T v="gross" accessibilityRole="header" farbe={f.buehneText}>{empfaengerZeile}</T>
        ) : letzte ? (
          <View>
            <T v="klein" farbe={f.buehneLeise}>{letzte[0]}</T>
            {letzteCent !== null ? <GrosserBetrag cent={letzteCent} groesse={44} /> : <T farbe={f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, fontVariant: ["tabular-nums"] }}>{letzte[1]}</T>}
          </View>
        ) : (
          <T v="titel" accessibilityRole="header" farbe={f.buehneText}>{fest ? (geteilt ? TEXT.geteilt_titel : TEXT.festgeschrieben_titel) : fertig ? TEXT.fertig : TEXT.fast_fertig}</T>
        )}
      </View>

      {!fest && !fertig ? (
        <View accessibilityRole="summary" style={{ marginTop: 16, backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12 }}>
          <T v="klein" fett>{TEXT.fehlen(alle.length)}</T>
          {jeSchritt.flatMap((l, i) => l.map((x) => ({ text: x, schritt: i, betrieb: false }))).concat(extra).map((x, i) => (
            <View key={`${x.text}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie }}>
              <T v="klein" stil={{ flex: 1 }}>{x.text}</T>
              {x.betrieb ? (
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.im_betrieb}: ${x.text}`} onPress={() => betriebOeffnen(nav, [x.text])} />
              ) : x.schritt >= 0 ? (
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.ergaenzen}: ${x.text}`} onPress={() => springen(x.schritt)} />
              ) : null}
            </View>
          ))}
          <T v="caption" leise stil={{ marginTop: 6 }}>{v.kundendokument ? TEXT.fehlt_kunde : TEXT.fehlt_text}</T>
        </View>
      ) : null}

      {/* R12 (UX #4): „Alle Pflichtangaben sind drin“, aber kein Zahlungsweg – gelbe Zeile mit Sprung zur IBAN */}
      {!fest && v.storno && ohneZahlungsweg(d, z.stand.betrieb.iban) ? (
        <View accessibilityRole="summary" style={{ marginTop: 12, backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12, gap: 2 }}>
          <T v="klein" fett>{TEXT.r12_iban_frage(kunde)}</T>
          <T v="caption">{TEXT.r12_iban_text}</T>
          <TextKnopf symbol="building.columns" text={TEXT.r12_iban_eintragen} onPress={() => nav.oeffnen("betrieb-bank", () => <BetriebTeilSeite teil="bank" />, true)} />
        </View>
      ) : null}

      {fest ? (
        // festgeschrieben: das echte Dokument, nicht mehr bearbeitbar
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.vorschau_oeffnen} onPress={() => nav.oeffnen(`vorschau-${id}`, () => <VorschauSeite id={id} />, true)} style={({ pressed }) => ({ marginTop: 18, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
          <Papier>
            <Vorschau papier html={html} quer={v.querformat} hoehe={v.querformat ? 260 : 440} />
            {stempel ? (
              // Eingangsstempel oben rechts auf dem Blatt – Papier ist immer weiß, daher feste Farben
              <StempelAuftritt key={stempel} jetzt={stempelNeu.current === stempel} stil={{ position: "absolute", top: 14, right: 12 }}>
                <Stempel groesse={104} farbe={stempel === "bezahlt" ? "#08785a" : "#3b30c4"} grund="rgba(255,255,255,0.86)" text={stempel === "bezahlt" ? TEXT.stempel_bezahlt : TEXT.stempel_geteilt} unter={stempel === "bezahlt" ? datumDe(`${u.bezahlt!}T12:00:00Z`) : datumDe(u.festgeschrieben!)} />
              </StempelAuftritt>
            ) : null}
          </Papier>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 }}>
            <Symbol name="eye" groesse={17} farbe={f.minze} />
            <T v="klein" farbe={f.minze} stil={{ ...SCHRIFT.halb }}>{TEXT.vorschau_oeffnen}</T>
          </View>
        </Pressable>
      ) : (
        // noch offen (E-144): das Dokument als Papier – jeder Bereich antippbar; das echte PDF eine Tipp weiter
        <View style={{ marginTop: 18 }}>
          <PapierBlatt v={v} d={d} jeSchritt={jeSchritt} ergebnis={ergebnis} springen={springen} />
          <Pressable accessibilityRole="button" onPress={() => nav.oeffnen(`vorschau-${id}`, () => <VorschauSeite id={id} />, true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, opacity: pressed ? 0.6 : 1 })}>
            <Symbol name="eye" groesse={17} farbe={f.minze} />
            <T v="klein" farbe={f.minze} stil={{ ...SCHRIFT.halb }}>{TEXT.vorschau_oeffnen}</T>
          </Pressable>
        </View>
      )}

      {/* das Blatt darunter: Zahlung, Hinweise, Angaben und weitere Möglichkeiten */}
      <View style={{ marginHorizontal: -RAND, marginTop: 10, paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: 32, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne }}>
        {fest ? (
          <View>
            {geteilt ? <Hinweis art="erfolg" symbol="checkmark.circle" text={TEXT.geteilt_text(datumDe(u.festgeschrieben!))} /> : <Hinweis symbol="lock" text={TEXT.festgeschrieben_text(datumDe(u.festgeschrieben!), Boolean(v.storno))} />}
            {storno ? <Hinweis art="erfolg" text={TEXT.storniert_durch(String(storno.daten.nummer ?? ""))} /> : null}
            {typeof d.storno_zu === "string" && d.storno_zu ? <Hinweis text={TEXT.storniert_zu(d.storno_zu)} /> : null}
            {nachbild ? <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.e220_nachgebildet(nachbild.nachgetragen ? zeitDe(nachbild.nachgetragen) : null, u.pdfSha256 ?? null)}</T> : null}
            <PdfOriginalZeile id={id} />
            {v.storno && !u.storniertDurch ? <Zahlung id={id} /> : null}
          </View>
        ) : null}
        {/* Datenblatt Gewerbeanmeldung: weiter zum Online-Antrag – frei, auch ohne Pro */}
        {v.id === GEWERBE_VORLAGE ? (
          <Karte stil={{ marginTop: fest ? 12 : 0, marginBottom: 12 }}>
            <Zeile symbol="globe" ton="amt" titel={TEXT.go_einstieg} text={TEXT.go_einstieg_text} onPress={() => nav.oeffnen(`gewerbe-online-${id}`, () => <GewerbeOnlineSeite unterlageId={id} ergaenzen={springen} />, true)} letzte />
          </Karte>
        ) : null}
        {ergebnis.length > 1 ? (
          <Karte stil={{ marginTop: fest ? 12 : 0, paddingVertical: 8 }}>
            {ergebnis.map(([k, w], i) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie }}>
                <T v="klein" leise={i < ergebnis.length - 1} fett={i === ergebnis.length - 1} stil={{ flex: 1 }}>{k}</T>
                {/* der Betrag wird nie gekürzt – lieber bricht die Bezeichnung um */}
                <T v="klein" fett={i === ergebnis.length - 1} stil={{ flexShrink: 0, textAlign: "right", fontVariant: ["tabular-nums"] }}>{w}</T>
              </View>
            ))}
          </Karte>
        ) : null}
        {/* E-193 (4): auf Android geteilt, aber nicht als verschickt bestätigt – nicht mehr ändern, sondern die geteilte Fassung festschreiben */}
        {offen ? (
          <View accessibilityRole="summary" style={{ marginTop: fest ? 12 : 0, marginBottom: 12, backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}>
            <T v="klein" fett>{TEXT.fs_offen_titel(datumDe(offen.fassung.am))}</T>
            <T v="caption">{TEXT.fs_offen_text(Boolean(v.storno))}</T>
            {offen.geaendert ? <T v="caption">{TEXT.fs_offen_geaendert}</T> : null}
            {versionen.length > 1 ? (
              // E-200: mehrere verschiedene Fassungen – nicht automatisch die letzte, sondern die gewählte festschreiben
              <View style={{ gap: 4, marginTop: 4 }}>
                <T v="caption" fett>{TEXT.e200_fassungen_titel(versionen.length)}</T>
                <T v="caption">{TEXT.e200_fassungen_text}</T>
                {versionen.map((ver) => {
                  const zeit = zeitDe(ver.am);
                  const geaendert = JSON.stringify(ver.fassung.daten) !== JSON.stringify(u.daten);
                  return (
                    <View key={ver.sha256} style={{ marginTop: 4 }}>
                      <T v="caption" leise>{TEXT.e200_fassung_zeile(zeit, [...new Set(ver.ausgaben.map((a) => TEXT.e200_fassung_art[a.art] ?? a.art))].join(", "), ver.sha256.slice(0, 12), ver.ausgaben.length)}</T>
                      <TextKnopf
                        symbol="lock"
                        text={TEXT.e200_fassung_knopf(zeit)}
                        onPress={() =>
                          void bestaetigen({ titel: TEXT.fs_offen_wirklich(zeit), text: TEXT.fs_offen_wirklich_text(geaendert, Boolean(v.storno)), ja: TEXT.fs_offen_ja }).then((ok) => {
                            if (ok && z.geteiltFestschreiben(id, ver.am)) z.erfolg();
                          })
                        }
                      />
                    </View>
                  );
                })}
              </View>
            ) : (
              <TextKnopf
                symbol="lock"
                text={TEXT.fs_offen_knopf}
                onPress={() =>
                  void bestaetigen({ titel: TEXT.fs_offen_wirklich(datumDe(offen.fassung.am)), text: TEXT.fs_offen_wirklich_text(offen.geaendert, Boolean(v.storno)), ja: TEXT.fs_offen_ja }).then((ok) => {
                    if (ok && z.geteiltFestschreiben(id)) z.erfolg();
                  })
                }
              />
            )}
          </View>
        ) : null}
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {/* E-210: Lücken im Text – auch wenn alle Pflichtfelder ausgefüllt sind */}
        {!fest && luecken ? <Hinweis art="warnung" text={TEXT.e210_luecken_hinweis(luecken)} /> : null}
        {/* Plausibilität (G6): nur ein Hinweis, kein Hindernis */}
        {v.storno && betragUnplausibel(rechnungBrutto(u, z.stand.betrieb)) ? <Hinweis art="warnung" text={TEXT.betrag_unplausibel} /> : null}
        {/* Nachkontrolle Rechtsanwalt: die Form vor dem Teilen als eigener Kasten – Schriftform auch nach dem Teilen (ausdrucken) */}
        {!fest || v.formHinweis?.(d)?.form === "schrift" || v.formHinweis?.(d)?.form === "unterschrift" ? <FormHinweis v={v} d={d} /> : null}
        {/* R10: fachliche Hinweise der Vorlage (Leitweg-ID, EU-Kunde, Abweichung vom Pflichten-Check) – kein Hindernis */}
        {!fest
          ? (v.hinweise?.(d, z.stand.betrieb, { kleinunternehmer: typeof z.stand.profil["ust.kleinunternehmer"] === "boolean" ? (z.stand.profil["ust.kleinunternehmer"] as boolean) : null, handwerk: handwerkLaut(z.stand.profil) }) ?? [])
              // steht schon im Kasten zur Form
              .filter((h) => h !== v.formHinweis?.(d)?.text)
              .map((h) => <Hinweis key={h} art="warnung" text={h} />)
          : null}
        {/* Phase 1 (RDG): in der App, nie im PDF – die Unterlage gehört dem Betrieb; Rechnungen ohne (Geschäftsvorgang) */}
        {mitVorlagenHinweis(v) ? <RechtsHinweis art="vorlage" oben={4} /> : null}
        {/* Nachkontrolle Lebensmittelfachbeauftragter (23.10.2026): „Vorlagen fachlich durchgesehen (Stand …)“, solange die Vorlage dem
            freigegebenen Stand entspricht (Prüfsumme) – beim Hygieneplan nur in der Fassung für Lebensmittelbetriebe */}
        <T v="caption" leise stil={{ marginTop: 4 }}>{pruefHinweisFuer(v, d, z.stand.betrieb)}</T>

        <T v="gross" accessibilityRole="header" stil={{ marginTop: 30, marginBottom: 11 }}>{TEXT.mehr}</T>
        {eFehlt.length ? <ERechnungFehlt v={v} fehlt={eFehlt} springen={springen} gesperrt={fest} /> : null}
        <Karte>
          {[
            ...(v.eRechnung && eRechnung ? [{ symbol: "doc.text", titel: TEXT.mitPro(TEXT.e_rechnung, eRechnungErlaubt(u, z.pro)), los: () => void eRechnung() }] : []),
            { symbol: "printer", titel: TEXT.mitPro(TEXT.drucken, ausgabeErlaubt(u, z.pro)), los: () => void druckenLos() },
            // E-210: mit Lücken erst nach Rückfrage
            ...(v.alsText ? [{ symbol: "doc.on.doc", titel: TEXT.als_text, los: () => void (async () => {
              const luecken = lueckenFrage(v, d, absenderFuer(z.stand, u));
              if (luecken && !(await bestaetigen(luecken))) return;
              await Share.share({ message: v.alsText!(d, absenderFuer(z.stand, u)) });
            })().catch(() => undefined) }] : []),
            {
              symbol: "plus.circle",
              // E-188: eine Kopie ist eine neue Unterlage – mit Pro
              titel: TEXT.mitPro(TEXT.kopie, erstellenErlaubt(z.pro)),
              los: () => {
                if (!erstellenErlaubt(z.pro) && !sperre(ausgabeGrund(u))) return;
                const k = z.kopieren(id);
                if (k) {
                  melden(TEXT.kopie_angelegt);
                  nav.oeffnen(`ablauf-${k.id}`, () => <Ablauf id={k.id} />, true);
                }
              },
            },
          ].map((x, i, l) => (
            <Zeile key={x.symbol} symbol={x.symbol} titel={x.titel} onPress={x.los} letzte={i === l.length - 1} />
          ))}
        </Karte>
        <View style={{ marginTop: 8 }}>
          {/* Rückfragen als System-Dialog – eine Karte am Seitenende läge halb unter Fußleiste oder Meldung */}
          {/* E-214: Folgen des Stornos einer Rechnung mit EU-Umsatz – Berichtigung des ursprünglichen Zeitraums */}
          {euGrundSt && euTag ? (
            <View style={{ gap: 6, marginBottom: 10 }}>
              <Hinweis art={euGrundSt === "rechnung" && !euErledigt ? "warnung" : "info"} text={euGrundSt === "rechnung" ? TEXT.e214_berichtigen_hinweis(euZeitraum, textAus(einMonatNach(euFehlerErkannt(u)))) : TEXT.e214_berichtigen_betrag(euZeitraum)} />
              {/* E-218: Tag des Erkennens – auch nach der Festschreibung änderbar (wird nicht gedruckt) */}
              {euGrundSt === "rechnung" ? (
                <DatumFeld label={TEXT.e218_erkannt} hilfe={TEXT.e218_erkannt_hilfe} wert={euFehlerErkannt(u)} ohneHeute aendern={(x) => {
                  if (x && x > String(d.datum)) melden(TEXT.e218_erkannt_fehler, "info");
                  else z.euStornoSetzen(u.id, { erkannt: x });
                }} />
              ) : null}
              {euGrundSt === "rechnung" && fest ? (
                euErledigt ? (
                  <View>
                    <T v="caption" leise>{TEXT.e214_berichtigt_am(datumDe(euErledigt.slice(0, 10)))}</T>
                    <TextKnopf symbol="arrow.uturn.backward" leise text={TEXT.e214_berichtigt_zuruecknehmen} onPress={() => z.erledigtSetzen(euBerichtigungSchluessel(u.id), null)} />
                  </View>
                ) : (
                  <TextKnopf symbol="checkmark.circle" text={TEXT.e214_berichtigt_knopf} onPress={() => z.erledigtSetzen(euBerichtigungSchluessel(u.id), heute())} />
                )
              ) : null}
            </View>
          ) : null}
          {euFrage ? (
            <Auswahl<EuStornoGrund>
              label={TEXT.e214_storno_grund}
              hilfe={TEXT.e214_storno_grund_hilfe}
              wert={euGrund}
              aendern={setEuGrund}
              optionen={[
                { wert: "rechnung", text: TEXT.e214_grund_rechnung },
                { wert: "betrag", text: TEXT.e214_grund_betrag },
              ]}
            />
          ) : null}
          {euFrage && euGrund === "rechnung" ? <DatumFeld label={TEXT.e218_erkannt} hilfe={TEXT.e218_erkannt_hilfe} wert={euErkannt ?? heute()} aendern={setEuErkannt} /> : null}
          {euGrundNachtragen ? (
            <View style={{ marginBottom: 10 }}>
              <Auswahl<EuStornoGrund>
                label={TEXT.e214_storno_grund}
                hilfe={TEXT.e218_alt_grund_hilfe}
                wert={euGrundSt}
                aendern={(g) => z.euStornoSetzen(u.id, { grund: g })}
                optionen={[
                  { wert: "rechnung", text: TEXT.e214_grund_rechnung },
                  { wert: "betrag", text: TEXT.e214_grund_betrag },
                ]}
              />
            </View>
          ) : null}
          {fest ? (
            v.storno && !u.storniertDurch && !d.storno_zu ? (
              <TextKnopf
                symbol="arrow.uturn.backward"
                gefahr
                text={TEXT.stornieren}
                onPress={() => {
                  // E-229: uneinbringliche Forderung erst zurücknehmen (sonst doppelt gemindert)
                  if (u.uneinbringlich?.datum) {
                    melden(TEXT.e229_uneinbringlich_storno, "info");
                    return;
                  }
                  if (euFrage && !euGrund) {
                    melden(TEXT.e214_grund_fehlt, "info");
                    return;
                  }
                  if (euFrage && euGrund === "rechnung" && euErkannt && euErkannt > heute()) {
                    melden(TEXT.e218_erkannt_fehler, "info");
                    return;
                  }
                  void bestaetigen({ titel: TEXT.storno_wirklich, text: TEXT.storno_text, ja: TEXT.storno_ja }).then((ok) => {
                    if (!ok) return;
                    const neu = z.stornieren(id, euFrage ? euGrund ?? undefined : undefined, euFrage && euGrund === "rechnung" ? euErkannt : null);
                    if (neu) {
                      melden(TEXT.storno_angelegt, "info");
                      nav.oeffnen(`ablauf-${neu.id}`, () => <Ablauf id={neu.id} amEnde />, true);
                    }
                  });
                }}
              />
            ) : null
          ) : u.fassungen?.length ? null : (
            // R12 Personal: ein Nachweis mit früheren Fassungen ist in der Korrektur – löschen geht nicht
            <View style={{ gap: 6 }}>
              {/* E-200: geteilter, nicht bestätigter Entwurf – nur mit Grund (Änderungsprotokoll), die Nummer bleibt vergeben */}
              {offen ? <Feld label={TEXT.e200_entwurf_grund} hilfe={TEXT.e200_entwurf_grund_hilfe} wert={loeschGrund} aendern={setLoeschGrund} /> : null}
              <TextKnopf
                symbol="trash"
                gefahr
                text={TEXT.loeschen}
                onPress={() =>
                  void bestaetigen({ titel: TEXT.loeschen_wirklich, ...(offen ? { text: TEXT.fs_loeschen_text(datumDe(offen.fassung.am)) } : {}), ja: TEXT.loeschen_ja }).then((ok) => {
                    if (!ok) return;
                    z.loeschen(id, offen ? loeschGrund.trim() || TEXT.e200_entwurf_grund_standard : undefined);
                    melden(TEXT.geloescht, "info");
                  })
                }
              />
            </View>
          )}
        </View>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
      </View>
    </View>
  );
}

/** „Für die E-Rechnung fehlt noch“: wie „Fehlt noch“ mit „Ergänzen“ je Angabe – angesagt, sobald die Liste erscheint. */
function ERechnungFehlt({ v, fehlt, springen, gesperrt }: { v: Vorlage; fehlt: string[]; springen: (schritt: number) => void; gesperrt: boolean }) {
  const f = useFarben();
  const nav = useNav();
  useAnsage(`${TEXT.e_rechnung_fehlt} ${fehlt.join(", ")}`);
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10 }}>
      <T v="klein" fett>{TEXT.e_rechnung_fehlt}</T>
      {fehlt.map((x, i) => {
        const betrieb = x.includes("Mein Betrieb");
        // festgeschrieben: Angaben der Rechnung lassen sich nicht mehr ändern – nur „Mein Betrieb“
        const schritt = gesperrt ? -1 : x === NUMMER_DOPPELT ? v.abschnitte.findIndex((a) => a.felder.some((feld) => feld.id === v.fortlaufend)) : schrittFuer(v, x);
        return (
          <View key={x} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie }}>
            <T v="klein" stil={{ flex: 1 }}>{x}</T>
            {betrieb ? (
              <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.im_betrieb}: ${x}`} onPress={() => betriebOeffnen(nav, [x])} />
            ) : schritt >= 0 ? (
              <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.ergaenzen}: ${x}`} onPress={() => springen(schritt)} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Zahlungseingang einer festgeschriebenen Rechnung vermerken (E-129) – für die Ist-Versteuerung und den Überblick.
 * Bei einer Stornorechnung: die Erstattung. Der Vermerk gehört nicht zum Inhalt, die Rechnung bleibt unverändert.
 */
function Zahlung({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const [anders, setAnders] = useState(false);
  const [betragOffen, setBetragOffen] = useState(false);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const erstattung = typeof u?.daten.storno_zu === "string" && u.daten.storno_zu !== "";
  const vermerken = (d: string) => {
    z.bezahltSetzen(id, d);
    melden(erstattung ? TEXT.erstattung_vermerkt : TEXT.zahlung_vermerkt);
    z.erfolg();
  };
  if (!u) return null;
  const faellig = faelligAm(u);
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
  const ueberfaellig = !u.bezahlt && !erstattung && Boolean(faellig && faellig < heute());
  // R12: offener Betrag nach Teilzahlungen und Skonto – auch für die Zahlungserinnerung
  const offen = offenBrutto(u, z.stand.betrieb);
  const zahlungen = u.zahlungen ?? [];
  // freundliche Zahlungserinnerung als Text ins Teilen-Menü – Mail, Nachrichten, WhatsApp; nichts wird verschickt, ohne dass man es sieht
  const erinnern = () => {
    const b = z.stand.betrieb;
    const nummer = typeof u.daten.nummer === "string" ? u.daten.nummer.trim() : "";
    const kunde = typeof u.daten.kunde_name === "string" ? u.daten.kunde_name.trim() : "";
    const message = TEXT.erinnerung_text({ nummer, betrag: euroText(offen), faellig: faellig ? datumDe(faellig) : "", kunde, iban: b.iban.trim(), absender: [b.verantwortlich.trim(), b.name.trim()].filter(Boolean).join("\n") });
    void Share.share({ message, title: TEXT.erinnerung_senden }).catch(() => undefined);
  };
  return (
    <Karte stil={{ marginTop: 12, paddingVertical: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T fett>{u.bezahlt ? (erstattung ? TEXT.erstattet_am(datumDe(u.bezahlt)) : TEXT.bezahlt_am(datumDe(u.bezahlt))) : zahlungen.length ? TEXT.r12_offen_rest(euroText(offen)) : TEXT.offen_zahlung}</T>
          {/* Fälligkeit nach dem Zahlungsziel der Rechnung – überfällig in Rot */}
          {!u.bezahlt && !erstattung && faellig ? <T v="klein" farbe={faellig < heute() ? f.frist : undefined} leise={faellig >= heute()}>{faellig < heute() ? TEXT.faellig_war(datumDe(faellig)) : TEXT.faellig_bis(datumDe(faellig))}</T> : null}
        </View>
      </View>
      {zahlungen.length ? (
        <View accessibilityLabel={TEXT.r12_zahlung_titel} style={{ gap: 2 }}>
          {zahlungen.map((x) => (
            <T key={x.id} v="klein" leise>{TEXT.r12_zahlungen_liste(datumDe(x.datum), euroText(x.betrag_cent), x.minderung_cent ? TEXT.r12_minderung_kurz(euroText(x.minderung_cent), x.art ?? "skonto") : x.guthaben ? TEXT.e229_aus_guthaben_zeile(String(z.stand.unterlagen.find((q) => q.id === x.guthaben!.rechnung)?.daten.nummer ?? "")) : "")}</T>
          ))}
        </View>
      ) : null}
      {/* E-229: Guthaben aus Überzahlungen dieser Rechnung – zurücküberweisen oder verrechnen */}
      {(u.guthaben ?? []).some((e) => e.art === "ueberzahlung") ? <GuthabenAbschnitt id={id} /> : null}
      {u.bezahlt || zahlungen.length ? (guthabenVerwendet(z.stand, id) ? <T v="caption" leise>{TEXT.e229_entfernen_gesperrt}</T> : <TextKnopf symbol="xmark" text={zahlungen.length ? TEXT.r12_zahlungen_entfernen : TEXT.zahlung_entfernen} onPress={() => z.bezahltSetzen(id, null)} />) : null}
      {/* E-229: auch nach vollständiger Zahlung kann noch Geld kommen (doppelt überwiesen) – wird Guthaben */}
      {u.bezahlt && !erstattung ? (betragOffen ? <BetragErhalten id={id} offen={0} fertig={() => setBetragOffen(false)} /> : <TextKnopf symbol="eurosign" text={TEXT.e229_nochmal_erhalten} onPress={() => setBetragOffen(true)} />) : null}
      {u.uneinbringlich?.datum ? <T v="klein" fett>{TEXT.e229_uneinbringlich_seit(datumDe(u.uneinbringlich.datum), TEXT.e229_uneinbringlich_gruende[u.uneinbringlich.grund ?? "sonstiges"])}</T> : null}
      {!u.bezahlt ? (
        <View style={{ gap: 4 }}>
          {/* nach dem Teilen ist „bezahlt“ der nächste Schritt (B1) – als Hauptknopf; überfällig zuerst die Erinnerung */}
          {ueberfaellig ? <Knopf symbol="envelope" text={TEXT.erinnerung_senden} onPress={erinnern} /> : null}
          {zahlungen.length ? null : <Knopf ton={ueberfaellig} symbol="checkmark" text={erstattung ? TEXT.als_erstattet : TEXT.als_bezahlt_markieren} onPress={() => vermerken(heute())} stil={ueberfaellig ? { marginTop: 6 } : undefined} />}
          {zahlungen.length ? null : anders ? <DatumFeld label={TEXT.anderes_datum} wert={null} aendern={(d) => d && vermerken(d)} /> : <TextKnopf text={TEXT.anderes_datum} onPress={() => setAnders(true)} />}
          {/* R12: erhaltener Betrag – Teilzahlung, Skonto oder Minderung (§ 17 UStG) */}
          {erstattung ? null : betragOffen || zahlungen.length ? <BetragErhalten id={id} offen={offen} fertig={() => setBetragOffen(false)} /> : <TextKnopf symbol="eurosign" text={TEXT.r12_betrag_erhalten} onPress={() => setBetragOffen(true)} />}
        </View>
      ) : null}
      {!erstattung && uneinbringlichMoeglich(z.stand, u) ? <Uneinbringlich id={id} /> : null}
      <T v="caption" leise>{TEXT.bezahlt_hilfe}</T>
    </Karte>
  );
}

/** E-229 (Steuerberater 27.10.2026, T-304 a): Guthaben des Kunden aus Überzahlungen an dieser Rechnung. */
function GuthabenAbschnitt({ id }: { id: string }) {
  const z = useAmtlos();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  if (!u) return null;
  const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  return (
    <View accessibilityLabel={TEXT.e229_guthaben_titel} style={{ gap: 4 }}>
      <T v="klein" fett accessibilityRole="header">{TEXT.e229_guthaben_titel}</T>
      {(u.guthaben ?? []).filter((e) => e.art === "ueberzahlung").map((e) => {
        const rest = guthabenRest(z.stand, id, e.id);
        return (
          <View key={e.id} style={{ gap: 2 }}>
            <T v="klein">{TEXT.e229_guthaben_zeile(datumDe(e.datum), euroText(e.betrag_cent), euroText(Math.max(0, rest)))}</T>
            {(u.guthaben ?? []).filter((x) => x.art === "rueckzahlung" && x.bezug === e.id).map((x) => <T key={x.id} v="caption" leise>{TEXT.e229_rueckzahlung_zeile(datumDe(x.datum), euroText(x.betrag_cent))}</T>)}
            {guthabenVerrechnungen(z.stand, id, e.id).map((x) => <T key={x.zahlung.id} v="caption" leise>{TEXT.e229_verrechnet_zeile(datumDe(x.zahlung.datum), euroText(x.zahlung.betrag_cent), String(x.u.daten.nummer ?? ""))}</T>)}
            {rest > 0 ? <GuthabenVerwenden id={id} eintrag={e} rest={rest} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** E-229: Rest einer Überzahlung zurücküberweisen oder mit einer offenen Rechnung desselben Kunden verrechnen. */
function GuthabenVerwenden({ id, eintrag, rest }: { id: string; eintrag: GuthabenEintrag; rest: number }) {
  const z = useAmtlos();
  const melden = useMeldung();
  const [modus, setModus] = useState<"" | "zurueck" | "verrechnen">("");
  const [datum, setDatum] = useState<string>(heute());
  const [text, setText] = useState(BETRAG_FELD.format(rest / 100));
  const ziele = verrechenbareRechnungen(z.stand, id);
  const [ziel, setZiel] = useState<string | null>(ziele[0]?.id ?? null);
  const zielU = ziele.find((x) => x.id === ziel);
  const hoechstens = modus === "verrechnen" && zielU ? Math.min(rest, offenBrutto(zielU, z.stand.betrieb)) : rest;
  const betrag = centAus(text);
  const passt = betrag !== null && betrag > 0 && betrag <= hoechstens && datum >= eintrag.datum && datum <= heute();
  if (!modus)
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <TextKnopf text={TEXT.e229_zurueck} onPress={() => setModus("zurueck")} />
        <TextKnopf text={TEXT.e229_verrechnen} onPress={() => setModus("verrechnen")} />
      </View>
    );
  if (modus === "verrechnen" && !ziele.length) return <Hinweis text={TEXT.e229_verrechnen_keine} />;
  return (
    <View style={{ gap: 6, marginTop: 4 }}>
      <T v="klein" fett accessibilityRole="header">{modus === "zurueck" ? TEXT.e229_zurueck_titel : TEXT.e229_verrechnen_titel}</T>
      {modus === "verrechnen" ? <Auswahl label={TEXT.e229_verrechnen_rechnung} wert={ziel} aendern={(w) => setZiel(w)} optionen={ziele.map((x) => ({ wert: x.id, text: TEXT.r12g_rechnung_zeile(String(x.daten.nummer ?? ""), String(x.daten.kunde_name ?? ""), euroText(offenBrutto(x, z.stand.betrieb))) }))} /> : null}
      <DatumFeld label={modus === "zurueck" ? TEXT.e229_zurueck_datum : TEXT.e229_verrechnen_datum} wert={datum} aendern={(d) => d && setDatum(d)} />
      <Feld label={TEXT.r12_zahlung_betrag} wert={text} aendern={setText} keyboardType="decimal-pad" placeholder="0,00" fehler={text.trim() && (betrag === null || betrag > hoechstens) ? TEXT.e229_betrag_hoechstens(euroText(hoechstens)) : null} />
      {modus === "verrechnen" ? <T v="caption" leise>{TEXT.e229_verrechnen_hilfe}</T> : null}
      <Knopf
        ton
        symbol="checkmark"
        text={modus === "zurueck" ? TEXT.e229_zurueck_vermerken : TEXT.e229_verrechnen_vermerken}
        deaktiviert={!passt || (modus === "verrechnen" && !zielU)}
        onPress={() => {
          if (!passt || betrag === null) return;
          if (modus === "zurueck") {
            z.guthabenZurueckzahlen(id, eintrag.id, datum, betrag);
            melden(TEXT.e229_zurueck_vermerkt(euroText(betrag)));
          } else if (zielU) {
            z.guthabenVerrechnen(id, eintrag.id, zielU.id, datum, betrag);
            melden(TEXT.e229_verrechnet(euroText(betrag), String(zielU.daten.nummer ?? "")));
          }
          setModus("");
        }}
      />
      <TextKnopf text={TEXT.abbrechen} onPress={() => setModus("")} />
    </View>
  );
}

/** E-229 (Steuerberater 27.10.2026, T-304 c): Forderung uneinbringlich vermerken (§ 17 Abs. 2 Nr. 1 UStG) bzw. zurücknehmen. */
function Uneinbringlich({ id }: { id: string }) {
  const z = useAmtlos();
  const melden = useMeldung();
  const [offen, setOffen] = useState(false);
  const [datum, setDatum] = useState<string>(heute());
  const [grund, setGrund] = useState<UneinbringlichGrund | null>(null);
  const [text, setText] = useState("");
  const u = z.stand.unterlagen.find((x) => x.id === id);
  if (!u) return null;
  // E-232 (Steuerberater zu T-333 b): EU-Umsatz (Zusammenfassende Meldung) bzw. OSS – „bitte mit der Steuerberatung klären“
  const euOss = u.daten.oss === true ? "oss" : euMeldeArtVon(u, z.stand.betrieb) ? "zm" : null;
  if (u.uneinbringlich?.datum)
    return (
      <View style={{ gap: 4 }}>
        {u.uneinbringlich.text ? <T v="caption" leise>{u.uneinbringlich.text}</T> : null}
        <T v="caption" leise>{TEXT.e229_uneinbringlich_spaeter}</T>
        {euOss ? <Hinweis text={TEXT.e232_uneinbringlich_eu_oss(euOss)} /> : null}
        <TextKnopf
          text={TEXT.e229_uneinbringlich_zuruecknehmen}
          onPress={() => {
            z.uneinbringlichSetzen(id, null);
            melden(TEXT.e229_uneinbringlich_zurueckgenommen, "info");
          }}
        />
      </View>
    );
  if (!offen) return <TextKnopf symbol="exclamationmark.triangle" text={TEXT.e229_uneinbringlich} onPress={() => setOffen(true)} />;
  const offenBetrag = offenAmTag(z.stand, u, datum);
  const passt = Boolean(grund) && datum <= heute() && datum >= String(u.daten.datum ?? "") && offenBetrag > 0 && (grund !== "sonstiges" || text.replace(/\s+/g, " ").trim().length >= 10);
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <T v="klein" fett accessibilityRole="header">{TEXT.e229_uneinbringlich_titel}</T>
      <T v="caption" leise>{TEXT.e229_uneinbringlich_text(euroText(offenBetrag))}</T>
      {euOss ? <Hinweis text={TEXT.e232_uneinbringlich_eu_oss(euOss)} /> : null}
      <DatumFeld label={TEXT.e229_uneinbringlich_datum} wert={datum} aendern={(d) => d && setDatum(d)} />
      <Wahl label={TEXT.e229_uneinbringlich_grund} wert={grund} aendern={setGrund} optionen={UNEINBRINGLICH_GRUENDE.map((g) => ({ wert: g, text: TEXT.e229_uneinbringlich_gruende[g] }))} />
      <Feld label={TEXT.e229_uneinbringlich_erlaeuterung} hilfe={TEXT.e229_uneinbringlich_erlaeuterung_hilfe} optional={grund !== "sonstiges"} wert={text} aendern={setText} mehrzeilig />
      <Knopf
        ton
        gefahr
        symbol="checkmark"
        text={TEXT.e229_uneinbringlich_vermerken}
        deaktiviert={!passt}
        onPress={() => {
          if (!passt || !grund) return;
          z.uneinbringlichSetzen(id, { datum, grund, ...(text.trim() ? { text } : {}) });
          melden(TEXT.e229_uneinbringlich_vermerkt, "info");
          setOffen(false);
        }}
      />
      <TextKnopf text={TEXT.abbrechen} onPress={() => setOffen(false)} />
    </View>
  );
}

const BETRAG_FELD = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/**
 * R12: Zahlungseingang mit Betrag. Fehlt etwas, entscheidet man: Rest bleibt offen (Teilzahlung), Skonto oder Minderung –
 * dann mindert die Differenz Umsatz und Umsatzsteuer im Zeitraum der Zahlung (§ 17 UStG). Innerhalb der Skontofrist ist der
 * Betrag nach Skonto vorbelegt und „Skonto“ gewählt.
 */
function BetragErhalten({ id, offen, fertig }: { id: string; offen: number; fertig: () => void }) {
  const z = useAmtlos();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const [datum, setDatum] = useState<string>(heute());
  const sk = u && !u.zahlungen?.length && offen > 0 ? skontoFuer(u.daten, z.stand.betrieb.bundesland) : null;
  const skBetrag = sk && u ? skontoBetrag(rechnungBrutto(u, z.stand.betrieb), sk.prozent) : 0;
  const inFrist = Boolean(sk && datum <= sk.bis);
  const [text, setText] = useState(() => BETRAG_FELD.format((sk && heute() <= sk.bis ? offen - skBetrag : offen) / 100));
  const [rest, setRest] = useState<"offen" | "skonto" | "minderung">(sk && heute() <= sk.bis ? "skonto" : "offen");
  if (!u) return null;
  const betrag = centAus(text);
  const differenz = betrag === null ? 0 : offen - betrag;
  const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const minderung = differenz > 0 && rest !== "offen" ? differenz : 0;
  const zahlung = { datum, betrag_cent: betrag ?? 0, ...(minderung ? { minderung_cent: minderung, art: rest === "minderung" ? ("minderung" as const) : ("skonto" as const) } : {}) };
  // E-221 Befund 5: nie still kürzen – Überzahlung, Skonto ohne Zahlung, mehr als das vereinbarte Skonto und „ganz
  // gemindert, nichts erhalten“ werden abgelehnt (zahlungPruefen); gespeichert wird genau, was gemeldet wird
  const pruefung = betrag === null ? null : zahlungPruefen(z.stand, id, zahlung);
  const fehlerText = !pruefung?.fehler || pruefung.fehler === "betrag" ? null : pruefung.fehler === "ueberzahlt" ? TEXT.e221_ueberzahlt(euroText((betrag ?? 0) + minderung - offen), euroText(offen), minderung > 0) : pruefung.fehler === "skonto_zu_hoch" ? TEXT.e221_skonto_zu_hoch(euroText(pruefung.skontoHoechstens ?? 0)) : pruefung.fehler === "skonto_ohne_zahlung" ? TEXT.e221_skonto_ohne_zahlung : TEXT.e221_nichts_erhalten;
  const speichern = async () => {
    if (betrag === null || !pruefung || pruefung.fehler) return;
    // ohne vereinbartes Skonto ausdrücklich nachfragen (eine Obergrenze gibt es dann nicht)
    if (pruefung.ohneVereinbarung && !(await bestaetigen({ titel: TEXT.e221_skonto_ohne_vereinbarung_titel, text: TEXT.e221_skonto_ohne_vereinbarung_text(euroText(minderung)), ja: TEXT.e221_skonto_ohne_vereinbarung_ja }))) return;
    z.zahlungVermerken(id, zahlung);
    // E-229: der Teil über dem offenen Betrag bleibt Guthaben des Kunden – die Meldung sagt es
    melden(pruefung.ueberzahlung ? TEXT.e229_ueberzahlung_vermerkt(euroText(betrag), euroText(pruefung.ueberzahlung)) : TEXT.r12_zahlung_vermerkt(euroText(betrag)));
    z.erfolg();
    fertig();
  };
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <T v="klein" fett accessibilityRole="header">{TEXT.r12_zahlung_titel}</T>
      <DatumFeld label={TEXT.r12_zahlung_datum} wert={datum} aendern={(d) => d && setDatum(d)} />
      <Feld label={TEXT.r12_zahlung_betrag} wert={text} aendern={setText} keyboardType="decimal-pad" placeholder="0,00" fehler={text.trim() && betrag === null ? TEXT.betrag_falsch : null} />
      {/* E-229 (Steuerberater 27.10.2026): mehr als offen – nicht ablehnen, der Rest wird Guthaben des Kunden */}
      {pruefung && !pruefung.fehler && pruefung.ueberzahlung ? <Hinweis text={TEXT.e229_ueberzahlung(euroText(pruefung.ueberzahlung), euroText(offen))} /> : null}
      {pruefung?.fehler === "ueberzahlt" && offen > 0 ? <TextKnopf text={TEXT.e221_nur_offen(euroText(offen))} onPress={() => setText(BETRAG_FELD.format(offen / 100))} /> : null}
      {sk ? <T v="caption" leise>{inFrist ? TEXT.r12_skonto_passt(euroText(skBetrag), datumDe(sk.bis)) : TEXT.r12_skonto_spaet(datumDe(sk.bis))}</T> : null}
      {differenz > 0 && betrag !== null ? (
        <View style={{ gap: 4 }}>
          <T v="klein">{TEXT.r12_zahlung_rest(euroText(differenz))}</T>
          <Wahl wert={rest} aendern={setRest} optionen={[{ wert: "offen" as const, text: TEXT.r12_rest_offen }, { wert: "skonto" as const, text: TEXT.r12_rest_skonto }, { wert: "minderung" as const, text: TEXT.r12_rest_minderung }]} />
          {rest !== "offen" ? <T v="caption" leise>{TEXT.r12_minderung_hilfe}</T> : null}
        </View>
      ) : null}
      {fehlerText ? <Hinweis art="warnung" text={fehlerText} /> : null}
      <Knopf ton symbol="checkmark" text={TEXT.r12_zahlung_vermerken} deaktiviert={betrag === null || Boolean(pruefung?.fehler)} onPress={() => void speichern()} />
    </View>
  );
}
