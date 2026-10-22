import { useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { GMBH_ANGABEN, KU_HINWEIS, PRUEFHINWEIS, betragUnplausibel, skontoBetrag, skontoFuer, cent as centAus, dateinamenTeil, dokumentHtml, eRechnungAus, pdfDateiname, vorlageFuer, xrechnungUbl, type Daten, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, Stempel, StempelAuftritt, Symbol, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { BLATT_OBEN, HAARLINIE, RADIUS, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { Papier, PapierBlatt } from "./Papier";
import { GrosserBetrag, RechtsHinweis } from "./gemeinsam";
import { mitVorlagenHinweis } from "../rechtshinweis";
import { drucken, pdfTeilenMitHash } from "../unterlagen/pdf";
import { NUMMER_DOPPELT, fehltFuer } from "../unterlagen/pruefung";
import { dateiTeilen } from "../unterlagen/sicherungDatei";
import { absenderFuer, heute } from "../unterlagen/speicher";
import { euroText, faelligAm, offenBrutto, rechnungBrutto } from "../unterlagen/ablage";
import { useAmtlos } from "../zustand";
import { bestaetigen } from "../ui/bestaetigen";
import { AbsenderSeite } from "./Betrieb";
import { BetriebTeilSeite } from "./Absender";
import { handwerkLaut, ohneZahlungsweg } from "./rechnungHinweise";
import { Ablauf, fehltJeSchritt } from "./Ablauf";
import { useProSperre } from "./Pro";
import { VORLAGEN_FREI_JE_MONAT, ausgabeErlaubt, betriebFuerDokument, eRechnungErlaubt, uebrig, zaehltFuerKontingent } from "../pro/regeln";
import { Ansage, useAnsage } from "./felder";
import { GEWERBE_VORLAGE } from "../gewerbe/felder";
import { GewerbeOnlineSeite } from "./GewerbeOnline";

/**
 * Nachkontrolle Dr. Weber (21.10.2026): Form der Unterlage als Kasten – am Anfang des Ablaufs und im Abschluss vor dem
 * Teilen (NachwG: Schriftform in den Branchen nach § 2a SchwarzArbG, sonst Textform mit Empfangsnachweis).
 */
export function FormHinweis({ v, d, unten = 12 }: { v: Vorlage; d: Daten; unten?: number }) {
  const f = useFarben();
  const h = v.formHinweis?.(d);
  if (!h) return null;
  const schrift = h.form === "schrift";
  const titel = schrift ? TEXT.nk_form_schrift_titel : h.form === "text" ? TEXT.nk_form_text_titel : TEXT.nk_form_offen_titel;
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
    // E-156: Rechnungen immer, Vorlagen mit Pro oder als kostenlose Vorlage des Monats; erneutes Teilen und Stornos gehen immer
    if (!ausgabeErlaubt(z.stand.unterlagen, u, z.pro, new Date()) && !sperre("pdf")) return;
    setLaedt(art === "teilen");
    // der Inhalt, aus dem das PDF entsteht (H1): Ändert er sich, während das Teilen-Menü offen ist (z. B. durch die
    // Synchronisation), wird nicht festgeschrieben
    const pdfDaten = u.daten;
    try {
      // R12 GoBD: festgeschrieben mit den festgehaltenen Absenderdaten; beim ersten Teilen werden die jetzigen festgehalten
      const absender = absenderFuer(z.stand, u);
      const html = dokumentHtml(v, pdfDaten, betriebFuerDokument(absender, z.pro));
      const erg = art === "teilen" ? await pdfTeilenMitHash(html, pdfDateiname(v, u.daten, heute()), v.querformat) : { ok: await drucken(html, pdfDateiname(v, u.daten, heute()), v.querformat) };
      // abgebrochen: nichts festschreiben, nichts vom Freikontingent verbrauchen
      if (!erg.ok) return;
      const erstesMal = !u.ausgegeben;
      if (!z.ausgeben(id, pdfDaten, "sha256" in erg ? erg.sha256 : undefined, absender)) return melden(TEXT.pdf_geaendert, "info");
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
    // E-156: Erstellen gehört zu Pro – eine schon einmal geteilte E-Rechnung geht immer wieder hinaus
    if (!eRechnungErlaubt(u, z.pro) && !sperre("e_rechnung")) return;
    const absender = absenderFuer(z.stand, u);
    const { daten, fehlt } = eRechnungAus(u.daten, absender);
    const alle = [...new Set([...fehltFuer(z.stand, u), ...fehlt])];
    setEFehlt(alle);
    if (alle.length) return;
    const xmlDaten = u.daten;
    try {
      // R12 GoBD: eine festgeschriebene Rechnung gibt ihr festgehaltenes Original weiter
      if (await dateiTeilen(`E-Rechnung-${dateinamenTeil(daten.nummer, 60) || "ohne-Nummer"}.xml`, u.festgeschrieben && u.xml ? u.xml : xrechnungUbl(daten, KU_HINWEIS), "application/xml") && !z.ausgeben(id, xmlDaten, undefined, absender, true)) melden(TEXT.pdf_geaendert, "info");
    } catch {
      setFehler(TEXT.e_rechnung_fehler);
    }
  };
  // ohne Pro und ohne freie Vorlage: „PDF teilen · Pro“ – man soll nicht erst beim Tippen gegen den Bezahlschirm laufen
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const frei = !u || ausgabeErlaubt(z.stand.unterlagen, u, z.pro, new Date());
  // E-156: ohne Pro bei einer noch nie ausgegebenen Vorlage – wie viele Vorlagen diesen Monat noch frei sind (über dem Knopf)
  const zaehlt = Boolean(u && !z.pro && !u.ausgegeben && zaehltFuerKontingent(u) && !(typeof u.daten.storno_zu === "string" && u.daten.storno_zu));
  const rest = zaehlt ? uebrig(z.stand.unterlagen, new Date()) : 0;
  const kontingent = zaehlt ? { text: TEXT.pro_rest(rest, VORLAGEN_FREI_JE_MONAT), leer: rest === 0 } : null;
  return { laedt, fehler, eFehlt, frei, kontingent, los: () => ausgabe("teilen"), drucken: () => ausgabe("drucken"), eRechnung };
}


/** R12: Angabe aus „Mein Betrieb“ ergänzen – Gesellschaftsangaben (§ 35a GmbHG) bzw. Absender. */
export function betriebOeffnen(nav: ReturnType<typeof useNav>, fehlt: string[]) {
  const betrieb = fehlt.filter((x) => x.includes("Mein Betrieb"));
  if (betrieb.length && betrieb.every((x) => x.includes(GMBH_ANGABEN))) nav.oeffnen("betrieb-gesellschaft", () => <BetriebTeilSeite teil="gesellschaft" />, true);
  else nav.oeffnen("absender", () => <AbsenderSeite />, true);
}


function VorschauSeite({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const teilen = useTeilen(id);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return <Unterseite titel="">{null}</Unterseite>;
  return (
    <Unterseite titel={TEXT.vorschau}>
      {/* das Dokument als Blatt Papier mit Rand und Schatten (E-144) */}
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flex: 1, borderRadius: RADIUS.blatt, overflow: "hidden", backgroundColor: "#ffffff", shadowColor: "#063b29", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
          <Vorschau html={dokumentHtml(v, u.daten, betriebFuerDokument(absenderFuer(z.stand, u), z.pro))} quer={v.querformat} />
        </View>
      </View>
      <Fuss ueber={teilen.fehler ? <Ansage text={teilen.fehler} farbe={f.frist} /> : teilen.kontingent ? <T v="caption" leise>{teilen.kontingent.text}</T> : festschreibenHinweis(v, Boolean(u.festgeschrieben)) ? <T v="caption" leise>{festschreibenHinweis(v, Boolean(u.festgeschrieben))}</T> : null}>
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
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  // Stempel auf dem Papier (A1, B1): „Geteilt“ bzw. „Bezahlt“ – fällt nur auf, wenn es gerade eben passiert ist
  const stempel = u && v && u.festgeschrieben && v.storno && !u.daten.storno_zu ? (u.bezahlt ? "bezahlt" : "geteilt") : null;
  const stempelVorher = useRef(stempel);
  const stempelNeu = useRef<string | null>(null);
  if (stempel !== stempelVorher.current) {
    stempelNeu.current = stempel;
    stempelVorher.current = stempel;
  }
  if (!u || !v) return null;
  const d = u.daten;
  const jeSchritt = fehltJeSchritt(v, d);
  const alle = fehltFuer(z.stand, u);
  const fest = Boolean(u.festgeschrieben);
  const nummerSchritt = v.fortlaufend ? v.abschnitte.findIndex((a) => a.felder.some((x) => x.id === v.fortlaufend)) : -1;
  const storno = u.storniertDurch ? z.stand.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
  const imFormular = new Set(jeSchritt.flat());
  // Prüfungen außerhalb der Schritte: einem Schritt zuordnen, wenn ein Feld dort so heißt; sonst „Mein Betrieb“ bzw. ohne Sprung
  const extra = alle.filter((x) => !imFormular.has(x)).map((x) => ({ text: x, schritt: x === NUMMER_DOPPELT ? nummerSchritt : schrittFuer(v, x), betrieb: x.includes("Mein Betrieb") }));
  const html = dokumentHtml(v, d, betriebFuerDokument(absenderFuer(z.stand, u), z.pro));
  const ergebnis = v.ergebnis?.(d) ?? [];
  const fertig = alle.length === 0;
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  const geteilt = fest && v.storno && !d.storno_zu;
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
      {/* Bühne (E-142): Stand, Empfänger bzw. Ergebnis und das Dokument als Blatt Papier auf dem tiefen Grün */}
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
                <Stempel groesse={104} farbe={stempel === "bezahlt" ? "#0a7d55" : "#06573b"} grund="rgba(255,255,255,0.86)" text={stempel === "bezahlt" ? TEXT.stempel_bezahlt : TEXT.stempel_geteilt} unter={stempel === "bezahlt" ? datumDe(`${u.bezahlt!}T12:00:00Z`) : datumDe(u.festgeschrieben!)} />
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
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {/* Plausibilität (G6): nur ein Hinweis, kein Hindernis */}
        {v.storno && betragUnplausibel(rechnungBrutto(u, z.stand.betrieb)) ? <Hinweis art="warnung" text={TEXT.betrag_unplausibel} /> : null}
        {/* Nachkontrolle Dr. Weber: die Form vor dem Teilen als eigener Kasten – Schriftform auch nach dem Teilen (ausdrucken) */}
        {!fest || v.formHinweis?.(d)?.form === "schrift" ? <FormHinweis v={v} d={d} /> : null}
        {/* R10: fachliche Hinweise der Vorlage (Leitweg-ID, EU-Kunde, Abweichung vom Pflichten-Check) – kein Hindernis */}
        {!fest
          ? (v.hinweise?.(d, z.stand.betrieb, { kleinunternehmer: typeof z.stand.profil["ust.kleinunternehmer"] === "boolean" ? (z.stand.profil["ust.kleinunternehmer"] as boolean) : null, handwerk: handwerkLaut(z.stand.profil) }) ?? [])
              // steht schon im Kasten zur Form
              .filter((h) => h !== v.formHinweis?.(d)?.text)
              .map((h) => <Hinweis key={h} art="warnung" text={h} />)
          : null}
        {/* Phase 1 (RDG): in der App, nie im PDF – die Unterlage gehört dem Betrieb; Rechnungen ohne (Geschäftsvorgang) */}
        {mitVorlagenHinweis(v) ? <RechtsHinweis art="vorlage" oben={4} /> : null}
        <T v="caption" leise stil={{ marginTop: 4 }}>{PRUEFHINWEIS}</T>

        <T v="gross" accessibilityRole="header" stil={{ marginTop: 30, marginBottom: 11 }}>{TEXT.mehr}</T>
        {eFehlt.length ? <ERechnungFehlt v={v} fehlt={eFehlt} springen={springen} gesperrt={fest} /> : null}
        <Karte>
          {[
            ...(v.eRechnung && eRechnung ? [{ symbol: "doc.text", titel: TEXT.mitPro(TEXT.e_rechnung, eRechnungErlaubt(u, z.pro)), los: () => void eRechnung() }] : []),
            { symbol: "printer", titel: TEXT.mitPro(TEXT.drucken, ausgabeErlaubt(z.stand.unterlagen, u, z.pro, new Date())), los: () => void druckenLos() },
            ...(v.alsText ? [{ symbol: "doc.on.doc", titel: TEXT.als_text, los: () => void Share.share({ message: v.alsText!(d, z.stand.betrieb) }).catch(() => undefined) }] : []),
            {
              symbol: "plus.circle",
              titel: TEXT.kopie,
              los: () => {
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
          {fest ? (
            v.storno && !u.storniertDurch && !d.storno_zu ? (
              <TextKnopf
                symbol="arrow.uturn.backward"
                gefahr
                text={TEXT.stornieren}
                onPress={() =>
                  void bestaetigen({ titel: TEXT.storno_wirklich, text: TEXT.storno_text, ja: TEXT.storno_ja }).then((ok) => {
                    if (!ok) return;
                    const neu = z.stornieren(id);
                    if (neu) {
                      melden(TEXT.storno_angelegt, "info");
                      nav.oeffnen(`ablauf-${neu.id}`, () => <Ablauf id={neu.id} amEnde />, true);
                    }
                  })
                }
              />
            ) : null
          ) : u.fassungen?.length ? null : (
            // R12 Personal: ein Nachweis mit früheren Fassungen ist in der Korrektur – löschen geht nicht
            <TextKnopf
              symbol="trash"
              gefahr
              text={TEXT.loeschen}
              onPress={() =>
                void bestaetigen({ titel: TEXT.loeschen_wirklich, ja: TEXT.loeschen_ja }).then((ok) => {
                  if (!ok) return;
                  z.loeschen(id);
                  melden(TEXT.geloescht, "info");
                })
              }
            />
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
            <T key={x.id} v="klein" leise>{TEXT.r12_zahlungen_liste(datumDe(x.datum), euroText(x.betrag_cent), x.minderung_cent ? TEXT.r12_minderung_kurz(euroText(x.minderung_cent), x.art ?? "skonto") : "")}</T>
          ))}
        </View>
      ) : null}
      {u.bezahlt || zahlungen.length ? <TextKnopf symbol="xmark" text={zahlungen.length ? TEXT.r12_zahlungen_entfernen : TEXT.zahlung_entfernen} onPress={() => z.bezahltSetzen(id, null)} /> : null}
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
      <T v="caption" leise>{TEXT.bezahlt_hilfe}</T>
    </Karte>
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
  const sk = u && !u.zahlungen?.length ? skontoFuer(u.daten, z.stand.betrieb.bundesland) : null;
  const skBetrag = sk && u ? skontoBetrag(rechnungBrutto(u, z.stand.betrieb), sk.prozent) : 0;
  const inFrist = Boolean(sk && datum <= sk.bis);
  const [text, setText] = useState(() => BETRAG_FELD.format((sk && heute() <= sk.bis ? offen - skBetrag : offen) / 100));
  const [rest, setRest] = useState<"offen" | "skonto" | "minderung">(sk && heute() <= sk.bis ? "skonto" : "offen");
  if (!u) return null;
  const betrag = centAus(text);
  const differenz = betrag === null ? 0 : offen - betrag;
  const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const speichern = () => {
    if (betrag === null || betrag < 0) return;
    const minderung = differenz > 0 && rest !== "offen" ? differenz : 0;
    z.zahlungVermerken(id, { datum, betrag_cent: Math.min(betrag, offen), ...(minderung ? { minderung_cent: minderung, art: rest === "minderung" ? "minderung" : "skonto" } : {}) });
    melden(TEXT.r12_zahlung_vermerkt(euroText(betrag)));
    z.erfolg();
    fertig();
  };
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <T v="klein" fett accessibilityRole="header">{TEXT.r12_zahlung_titel}</T>
      <DatumFeld label={TEXT.r12_zahlung_datum} wert={datum} aendern={(d) => d && setDatum(d)} />
      <Feld label={TEXT.r12_zahlung_betrag} wert={text} aendern={setText} keyboardType="decimal-pad" placeholder="0,00" fehler={text.trim() && betrag === null ? TEXT.betrag_falsch : betrag !== null && betrag > offen ? TEXT.r12_ueberzahlt : null} />
      {sk ? <T v="caption" leise>{inFrist ? TEXT.r12_skonto_passt(euroText(skBetrag), datumDe(sk.bis)) : TEXT.r12_skonto_spaet(datumDe(sk.bis))}</T> : null}
      {differenz > 0 && betrag !== null ? (
        <View style={{ gap: 4 }}>
          <T v="klein">{TEXT.r12_zahlung_rest(euroText(differenz))}</T>
          <Wahl wert={rest} aendern={setRest} optionen={[{ wert: "offen" as const, text: TEXT.r12_rest_offen }, { wert: "skonto" as const, text: TEXT.r12_rest_skonto }, { wert: "minderung" as const, text: TEXT.r12_rest_minderung }]} />
          {rest !== "offen" ? <T v="caption" leise>{TEXT.r12_minderung_hilfe}</T> : null}
        </View>
      ) : null}
      <Knopf ton symbol="checkmark" text={TEXT.r12_zahlung_vermerken} deaktiviert={betrag === null || betrag <= 0 && differenz <= 0} onPress={speichern} />
    </View>
  );
}
