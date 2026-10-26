import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { VORSTEUER_AUFTEILEN, fehlendeAngaben, istPrivatperson, personAus, personIn, profilStartwerte, vorlageFuer, type Daten, type Vorlage, type VorlagenAbschnitt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Betrag, Fuss, Hinweis, Knopf,  T, TextKnopf, Wahl, ZurueckKnopf, textAus } from "../ui/bausteine";
import { HellerStatus, TastaturRahmen, useKopf, useNav } from "../ui/navigation";
import { RADIUS, RAND,  useFarben } from "../ui/thema";
import { HAUPT_STAETTE, PERSONEN_LISTE, STAETTEN_VORLAGEN, betriebFehlt, personenSortiert } from "../unterlagen/speicher";
import { FassungenKarte, KorrekturSeite } from "./Fassungen";
import { StaettenWahl } from "./BetriebStaetten";
import { fehltFuer } from "../unterlagen/pruefung";
import { offeneRechnungen, periodeText, perioden, umsaetzeFuer, type EuBerichtigung, type UstUebernahme, type Versteuerung } from "../unterlagen/ustAusRechnungen";
import { ossFuer, ossQuartale, zmFuer, zmPerioden } from "../unterlagen/euMeldungen";
import { useAmtlos } from "../zustand";
import { mitVorlagenHinweis } from "../rechtshinweis";
import { RechtsHinweis } from "./gemeinsam";
import { Abschluss, FormHinweis, betriebOeffnen, festschreibenHinweis, useTeilen } from "./Abschluss";
import { AuswahlSeite } from "../ui/auswahlseite";
import { AbsenderSeite } from "./Betrieb";
import { useProSperre } from "./Pro";
import { EUER_GESPERRT, bilanzierendeGewinnermittlung, euerUebernahme, jahreMitDaten, kassenHinweis, kassenHinweisMit, kassenLage, type EuerUebernahme } from "../unterlagen/steuerpaket";
import { kasseFuerUst } from "../unterlagen/kasse";
import { Ansage, Felder, useAnsage } from "./felder";
import { InfoSeite } from "./InfoSeite";
import { ListenSchritt } from "./Liste";
import { trennen } from "../ui/trennen";

/** Fehlende Angaben je Schritt – für „Fast fertig“ und die Übersicht. Prüfungen gegen „Mein Betrieb“ stehen extra. */
export function fehltJeSchritt(v: Vorlage, d: Daten): string[][] {
  return v.abschnitte.map((a) => fehlendeAngaben({ ...v, abschnitte: [a], pruefen: undefined }, d));
}

/** Person aus der Unterlage merken (Mitarbeiter, Kunde) – beim Weitergehen und beim Schließen. */
function merken(v: Vorlage, d: Daten | undefined, z: ReturnType<typeof useAmtlos>) {
  const p = d ? personAus(v, d) : null;
  if (p && v.person) z.personMerken(v.person.art, p);
}

/** Auswahl gespeicherter Mitarbeiter bzw. Kunden über den Feldern eines Schritts. */
function PersonenWahl({ v, id, daten }: { v: Vorlage; id: string; daten: Daten }) {
  const z = useAmtlos();
  const nav = useNav();
  if (!v.person) return null;
  const art = v.person.art;
  // R12 (Coach #21): Gesundheitsangaben nur von Personen – keine Firmenkunden aus den Rechnungen
  const nurPersonen = v.id === "anamnese_einwilligung";
  const personen = personenSortiert(z.stand[PERSONEN_LISTE[art]]).filter((p) => !nurPersonen || istPrivatperson(p.name));
  const name = typeof daten[v.person.felder.name ?? ""] === "string" ? (daten[v.person.felder.name!] as string).trim().toLocaleLowerCase("de") : "";
  const gewaehlt = personen.find((p) => p.name.trim().toLocaleLowerCase("de") === name)?.id ?? null;
  const waehlen = (pid: string) => {
    const p = personen.find((x) => x.id === pid);
    if (p) z.setzen(id, personIn(v, p));
  };
  // viele Personen: die zuletzt benutzten als Chips, alle über eine Auswahl mit Suche
  const viele = personen.length > 6;
  const chips = viele ? [...personen].sort((a, b) => (b.geaendert ?? "").localeCompare(a.geaendert ?? "")).slice(0, 5) : personen;
  if (viele && gewaehlt && !chips.some((p) => p.id === gewaehlt)) chips.unshift(personen.find((p) => p.id === gewaehlt)!);
  return (
    <View style={{ marginTop: 8 }}>
      {personen.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -RAND }} contentContainerStyle={{ paddingHorizontal: RAND, paddingVertical: 4 }}>
          <Wahl label={TEXT.gespeicherte[art]} wert={gewaehlt} aendern={waehlen} optionen={chips.map((p) => ({ wert: p.id, text: p.name }))} />
        </ScrollView>
      ) : null}
      {viele ? (
        <TextKnopf symbol="magnifyingglass" text={TEXT.alle_personen[art](personen.length)} onPress={() => nav.oeffnen(`personen-wahl-${art}`, () => <AuswahlSeite titel={TEXT.gespeicherte[art]} wert={gewaehlt} optionen={personen.map((p) => ({ wert: p.id, text: p.name }))} aendern={waehlen} />)} />
      ) : null}
      <T v="caption" leise stil={{ marginTop: personen.length ? 4 : 0 }}>{nurPersonen ? TEXT.r12_gemerkt_person : TEXT.wird_gemerkt[art]}</T>
    </View>
  );
}

/**
 * Umsatzsteuer-Voranmeldung: Umsätze aus den geteilten Rechnungen eines Monats oder Quartals übernehmen (E-128) –
 * bei Soll nach Leistungsdatum, bei Ist nach Zahlungseingang (E-129).
 */
function AusRechnungen({ id, daten }: { id: string; daten: Daten }) {
  const z = useAmtlos();
  const f = useFarben();
  const sperre = useProSperre();
  const v: Versteuerung = daten.versteuerung === "ist" ? "ist" : "soll";
  const [uebernommen, setUebernommen] = useState<{ periode: string; v: Versteuerung; r: UstUebernahme } | null>(null);
  const liste = perioden(z.stand.unterlagen, z.stand.betrieb, v, z.stand.belege, z.stand.kasse);
  const offen = v === "ist" ? offeneRechnungen(z.stand.unterlagen).length : 0;
  const r = uebernommen && uebernommen.v === v ? uebernommen.r : null;
  // Kleinunternehmer geben keine Voranmeldung ab – dann kein Kassenhinweis
  // R12: mit Kassenabschlüssen nur noch fehlende Tage nennen
  const kasse = r && !r.kleinunternehmer ? kassenHinweisMit(kassenLage(z.stand.profil), "ust", r.kasseFehlend) : null;
  // Ergebnis und Warnungen der Übernahme ansagen (VoiceOver bemerkt die neuen Zeilen sonst nicht)
  useAnsage(
    r
      ? [
          r.kleinunternehmer ? (r.steuerschuldBelege ? TEXT.ust_ku_13b : TEXT.aus_rechnungen_ku) : TEXT.aus_rechnungen_ok(r.anzahl),
          r.kuGemischt ? TEXT.ust_ku_gemischt : "",
          kasse?.text ?? "",
          r.kasseTage ? TEXT.r12_kasse_uebernommen(r.kasseTage) : "",
          r.minderungen ? TEXT.r12_minderungen(r.minderungen) : "",
          r.gutschriften ? TEXT.aus_rechnungen_gutschriften(r.gutschriften) : "",
          r.ersatz ? TEXT.aus_rechnungen_ersatz(r.ersatz) : "",
          r.ersatzNummern.length ? TEXT.stb_ersatz_nummern(r.ersatzNummern) : "",
          r.oss ? TEXT.stb_oss_nicht_va(r.oss) : "",
          r.berichtigungen.length ? TEXT.e214_va_berichtigung(r.berichtigungen.map((b) => b.stornoNr)) : "",
          ...anderswoTexte(r.berichtigungenAnderswo),
          r.offen ? TEXT.aus_rechnungen_offen(r.offen) : "",
          r.vorsteuerBelege || r.ohneVorsteuer ? TEXT.aus_rechnungen_vorsteuer(r.vorsteuerBelege, r.ohneVorsteuer) : "",
          r.vorsteuerPruefen ? VORSTEUER_AUFTEILEN : "",
        ].filter(Boolean).join(" ")
      : null,
  );
  if (!liste.length)
    return <T v="caption" leise stil={{ marginTop: 10 }}>{v === "ist" && offen ? TEXT.aus_rechnungen_ist_leer(offen) : TEXT.aus_rechnungen_leer}</T>;
  return (
    <View style={{ marginTop: 16, padding: 16, borderRadius: RADIUS.karte, backgroundColor: f.amtHauch }}>
      <T v="klein" fett farbe={f.amtTief}>{TEXT.mitPro(TEXT.aus_rechnungen_titel, z.pro)}</T>
      <T v="caption" farbe={f.amtTief}>{v === "ist" ? TEXT.aus_rechnungen_nach_ist : TEXT.aus_rechnungen_nach_soll}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        <Wahl
          wert={uebernommen?.v === v ? uebernommen.periode : null}
          aendern={(p) => {
            if (!sperre("ust_uebernahme")) return;
            const ku = z.stand.profil["ust.kleinunternehmer"];
            const erg = umsaetzeFuer(z.stand.unterlagen, p, z.stand.betrieb, v, z.stand.belege, typeof ku === "boolean" ? ku : undefined, kasseFuerUst(z.stand));
            if (!erg) return;
            z.setzen(id, erg.werte);
            setUebernommen({ periode: p, v, r: erg });
          }}
          optionen={liste.map((p) => ({ wert: p, text: periodeText(p) }))}
        />
      </ScrollView>
      {r ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          {r.kleinunternehmer ? <T v="caption" farbe={f.bald}>{r.steuerschuldBelege ? TEXT.ust_ku_13b : TEXT.aus_rechnungen_ku}</T> : <T v="caption" farbe={f.amtTief}>{TEXT.aus_rechnungen_ok(r.anzahl)}</T>}
          {r.kuGemischt ? <T v="caption" farbe={f.bald}>{TEXT.ust_ku_gemischt}</T> : null}
          {kasse ? <Hinweis art={kasse.warnung ? "warnung" : "info"} symbol="banknote" text={kasse.text} /> : null}
          {r.kasseTage ? <T v="caption" farbe={f.amtTief}>{TEXT.r12_kasse_uebernommen(r.kasseTage)}</T> : null}
          {r.minderungen ? <T v="caption" farbe={f.amtTief}>{TEXT.r12_minderungen(r.minderungen)}</T> : null}
          {r.gutschriften ? <T v="caption" farbe={f.bald}>{TEXT.aus_rechnungen_gutschriften(r.gutschriften)}</T> : null}
          {r.ersatz ? <T v="caption" farbe={f.bald}>{TEXT.aus_rechnungen_ersatz(r.ersatz)}</T> : null}
          {/* StB-Prüfung (5.2): welche Rechnungen nach dem Rechnungsdatum zählen; OSS gehört nicht in die Voranmeldung */}
          {r.ersatzNummern.length ? <T v="caption" farbe={f.bald}>{TEXT.stb_ersatz_nummern(r.ersatzNummern)}</T> : null}
          {r.oss ? <T v="caption" farbe={f.bald}>{TEXT.stb_oss_nicht_va(r.oss)}</T> : null}
          {/* E-214: Stornos „Fehler in der Rechnung“ berichtigen den ursprünglichen Zeitraum */}
          {r.berichtigungen.length ? <Hinweis art="warnung" text={TEXT.e214_va_berichtigung(r.berichtigungen.map((b) => b.stornoNr))} /> : null}
          {anderswoTexte(r.berichtigungenAnderswo).map((t) => <T key={t} v="caption" farbe={f.bald}>{t}</T>)}
          {r.offen ? <T v="caption" farbe={f.bald}>{TEXT.aus_rechnungen_offen(r.offen)}</T> : null}
          {r.vorsteuerBelege || r.ohneVorsteuer ? <T v="caption" farbe={f.amtTief}>{TEXT.aus_rechnungen_vorsteuer(r.vorsteuerBelege, r.ohneVorsteuer)}</T> : null}
          {r.vorsteuerPruefen ? <T v="caption" farbe={f.bald}>{VORSTEUER_AUFTEILEN}</T> : null}
          {/* R10: § 13b-Belege, Dauerfristverlängerung und Sondervorauszahlung */}
          {r.steuerschuldBelege ? <T v="caption" farbe={f.amtTief}>{TEXT.ust_13b_belege(r.steuerschuldBelege)}</T> : null}
          {!r.kleinunternehmer && z.stand.profil["ust.dauerfristverlaengerung"] === true ? <T v="caption" farbe={f.amtTief}>{TEXT.ust_dfv}</T> : null}
          {!r.kleinunternehmer && z.stand.profil["ust.dauerfristverlaengerung"] === true && uebernommen && /-12$/.test(uebernommen.periode) ? <T v="caption" farbe={f.bald}>{TEXT.ust_sondervorauszahlung}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

/** E-214: je ursprünglichem Zeitraum ein Satz „Storno … zählt als Berichtigung in …“ */
function anderswoTexte(l: EuBerichtigung[]): string[] {
  const je = new Map<string, string[]>();
  for (const b of l) {
    const z = `${periodeText(b.monat)} bzw. ${periodeText(b.quartal)}`;
    je.set(z, [...(je.get(z) ?? []), b.stornoNr]);
  }
  return [...je].map(([z, nr]) => TEXT.e214_va_anderswo(nr, z));
}

/**
 * StB-Prüfung (5.2, C-9): OSS-Erklärung bzw. Zusammenfassende Meldung aus den geteilten Rechnungen übernehmen – je
 * Quartal (OSS) bzw. Monat oder Quartal (ZM).
 */
function EuAusRechnungen({ id, art }: { id: string; art: "oss" | "zm" }) {
  const z = useAmtlos();
  const f = useFarben();
  const sperre = useProSperre();
  const v: Versteuerung = z.stand.betrieb.versteuerung === "ist" ? "ist" : "soll";
  const [ergebnis, setErgebnis] = useState<{ periode: string; anzahl: number; zeilen: number; berichtigungen?: EuBerichtigung[]; anderswo?: EuBerichtigung[]; minderungen?: number } | null>(null);
  const liste = art === "oss" ? ossQuartale(z.stand.unterlagen, z.stand.betrieb, v) : zmPerioden(z.stand.unterlagen, z.stand.betrieb);
  useAnsage(ergebnis ? TEXT.stb_eu_ok(ergebnis.anzahl, ergebnis.zeilen) : null);
  if (!liste.length) return <T v="caption" leise stil={{ marginTop: 10 }}>{TEXT.stb_eu_leer[art]}</T>;
  return (
    <View style={{ marginTop: 16, padding: 16, borderRadius: RADIUS.karte, backgroundColor: f.amtHauch }}>
      <T v="klein" fett farbe={f.amtTief}>{TEXT.mitPro(TEXT.stb_eu_titel[art], z.pro)}</T>
      <T v="caption" farbe={f.amtTief}>{TEXT.stb_eu_text[art]}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        <Wahl
          wert={ergebnis?.periode ?? null}
          aendern={(p) => {
            if (!sperre("ust_uebernahme")) return;
            const erg = art === "oss" ? ossFuer(z.stand.unterlagen, p, z.stand.betrieb, v) : zmFuer(z.stand.unterlagen, p, z.stand.betrieb);
            if (!erg) return;
            z.setzen(id, erg.werte as Daten);
            setErgebnis({ periode: p, anzahl: erg.anzahl, zeilen: erg.zeilen.length, ...("berichtigungen" in erg ? { berichtigungen: erg.berichtigungen, anderswo: erg.berichtigungenAnderswo, minderungen: erg.minderungen } : {}) });
          }}
          optionen={liste.map((p) => ({ wert: p, text: periodeText(p) }))}
        />
      </ScrollView>
      {ergebnis ? <T v="caption" farbe={f.amtTief} stil={{ marginTop: 8 }}>{TEXT.stb_eu_ok(ergebnis.anzahl, ergebnis.zeilen)}</T> : null}
      {/* E-214: Berichtigung (Fehler in der Rechnung), Stornos, die anderswo zählen, und Skonti im Zeitraum der Zahlung */}
      {ergebnis?.berichtigungen?.length ? <View style={{ marginTop: 6 }}><Hinweis art="warnung" text={`${TEXT.e214_va_berichtigung(ergebnis.berichtigungen.map((b) => b.stornoNr))} ${TEXT.e214_zm_berichtigung(textAus(ergebnis.berichtigungen.map((b) => b.zmFrist).sort()[0]!))}`} /></View> : null}
      {anderswoTexte(ergebnis?.anderswo ?? []).map((t) => <T key={t} v="caption" farbe={f.bald} stil={{ marginTop: 4 }}>{t}</T>)}
      {ergebnis?.minderungen ? <T v="caption" farbe={f.amtTief} stil={{ marginTop: 4 }}>{TEXT.e214_zm_minderung(ergebnis.minderungen)}</T> : null}
      <T v="caption" farbe={f.bald} stil={{ marginTop: 4 }}>{art === "oss" ? TEXT.stb_oss_frist : TEXT.stb_zm_frist}</T>
    </View>
  );
}

/** EÜR (E-133): Einnahmen und Ausgaben eines Jahres aus bezahlten Rechnungen und Belegen übernehmen. */
function EuerAusDaten({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const sperre = useProSperre();
  const [ergebnis, setErgebnis] = useState<{ jahr: string; r: EuerUebernahme } | null>(null);
  const jahre = jahreMitDaten(z.stand);
  const kasse = ergebnis ? kassenHinweisMit(kassenLage(z.stand.profil), "euer", ergebnis.r.kasseFehlend) : null;
  useAnsage(ergebnis ? [TEXT.euer_aus_daten_ok(ergebnis.r.rechnungen, ergebnis.r.belege), ergebnis.r.kassentage ? TEXT.r12_kasse_uebernommen(ergebnis.r.kassentage) : "", kasse?.text ?? "", ergebnis.r.unbezahlt ? TEXT.euer_unbezahlt(ergebnis.r.unbezahlt) : "", ergebnis.r.anlagen ? TEXT.euer_anlagen(ergebnis.r.anlagen) : "", ergebnis.r.hinweis, ergebnis.r.ustVorschlag ?? ""].filter(Boolean).join(" ") : null);
  // StB-Prüfung (E-4): bilanzierende Betriebe – keine EÜR-Übernahme, Hinweis „Bilanz statt EÜR“
  if (bilanzierendeGewinnermittlung(z.stand)) return <View style={{ marginTop: 16 }}><Hinweis art="warnung" text={EUER_GESPERRT} /></View>;
  if (!jahre.length) return <T v="caption" leise stil={{ marginTop: 10 }}>{TEXT.euer_leer}</T>;
  return (
    <View style={{ marginTop: 16, padding: 16, borderRadius: RADIUS.karte, backgroundColor: f.amtHauch }}>
      <T v="klein" fett farbe={f.amtTief}>{TEXT.mitPro(TEXT.euer_aus_daten_titel, z.pro)}</T>
      <T v="caption" farbe={f.amtTief}>{TEXT.euer_aus_daten_text}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        <Wahl
          wert={ergebnis?.jahr ?? null}
          aendern={(jahr) => {
            if (!sperre("ust_uebernahme")) return;
            const r = euerUebernahme(z.stand, jahr);
            z.setzen(id, { jahr, einnahmen: r.einnahmen, ausgaben: r.ausgaben });
            setErgebnis({ jahr, r });
          }}
          optionen={jahre.map((j) => ({ wert: j, text: j }))}
        />
      </ScrollView>
      {ergebnis ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          <T v="caption" farbe={f.amtTief}>{TEXT.euer_aus_daten_ok(ergebnis.r.rechnungen, ergebnis.r.belege)}</T>
          {ergebnis.r.kassentage ? <T v="caption" farbe={f.amtTief}>{TEXT.r12_kasse_uebernommen(ergebnis.r.kassentage)}</T> : null}
          {kasse ? <Hinweis art={kasse.warnung ? "warnung" : "info"} symbol="banknote" text={kasse.text} /> : null}
          {ergebnis.r.unbezahlt ? <T v="caption" farbe={f.bald}>{TEXT.euer_unbezahlt(ergebnis.r.unbezahlt)}</T> : null}
          {ergebnis.r.anlagen ? <T v="caption" farbe={f.bald}>{TEXT.euer_anlagen(ergebnis.r.anlagen)}</T> : null}
          <T v="caption" farbe={f.bald}>{ergebnis.r.hinweis}</T>
          {/* StB-Prüfung (E-1): Vorschlag der USt-Zahlungen aus den eigenen Voranmeldungen */}
          {ergebnis.r.ustVorschlag ? <T v="caption" farbe={f.amtTief}>{ergebnis.r.ustVorschlag}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Kopf eines Schritts auf der Bühne (E-144): „Schritt 2 von 4“, Titel, Hilfe, beim ersten Schritt „Wozu?“. */
function SchrittKopf({ v, a, index }: { v: Vorlage; a: VorlagenAbschnitt; index: number }) {
  const f = useFarben();
  const nav = useNav();
  return (
    <View style={{ paddingTop: 4, paddingBottom: 26 }}>
      <T v="caption" fett farbe={f.minze} stil={{ marginBottom: 4 }}>{TEXT.schritt(index + 1, v.abschnitte.length)}</T>
      <T v="titel" accessibilityRole="header" farbe={f.buehneText}>{trennen(a.titel ?? "")}</T>
      {a.hilfe ? <T farbe={f.buehneLeise} stil={{ marginTop: 6 }}>{a.hilfe}</T> : null}
      {index === 0 ? <TextKnopf buehne symbol="questionmark.circle" text={TEXT.wozu_link} onPress={() => nav.oeffnen(`info-${v.id}`, () => <InfoSeite id={v.id} />, true)} stil={{ marginTop: 4 }} /> : null}
    </View>
  );
}

function Schritt({ v, a, index, id, daten, fehlt }: { v: Vorlage; a: VorlagenAbschnitt; index: number; id: string; daten: Daten; fehlt: string[] }) {
  const z = useAmtlos();
  const mitPerson = v.person && a.felder.some((x) => x.id === v.person!.felder.name);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  // R12 (Bäckerei #7): Hygiene-, Lebensmittel- und Arbeitszeitnachweise einer Betriebsstätte zuordnen – ohne eigene
  // Zuordnung gilt beim Arbeitszeitnachweis die Betriebsstätte der Person
  // Nachkontrolle Rechtsanwalt: Form der Unterlage (NachwG) – oben, wenn sie feststeht; ändert sie sich durch eine Eingabe
  // auf diesem Bildschirm (Branche gewählt), steht der Kasten direkt unter der Auswahl statt oben
  const form = v.formHinweis?.(daten)?.form;
  const [formVorher, setFormVorher] = useState<string | null | undefined>(undefined);
  const formUnten = index === 0 && formVorher !== undefined && form !== formVorher;
  const person = v.person ? z.stand.mitarbeiter.find((p) => typeof daten[v.person!.felder.name ?? ""] === "string" && p.name.trim().toLocaleLowerCase("de") === (daten[v.person!.felder.name!] as string).trim().toLocaleLowerCase("de")) : undefined;
  return (
    <View>
      {/* Nachkontrolle Rechtsanwalt: Form gleich am Anfang, wenn sie feststeht (NachwG: Schriftform in den § 2a-Branchen aus dem Check) */}
      {index === 0 && form && form !== "offen" && !formUnten ? <FormHinweis v={v} d={daten} unten={16} /> : null}
      {index === 0 && STAETTEN_VORLAGEN.has(v.id) && z.stand.betriebsstaetten.length ? <StaettenWahl wert={u?.betriebsstaette ?? person?.betriebsstaette ?? HAUPT_STAETTE} aendern={(st) => z.unterlageStaette(id, st)} hilfe={TEXT.r12p_staette_unterlage_hilfe} /> : null}
      {mitPerson ? <PersonenWahl v={v} id={id} daten={daten} /> : null}
      {v.ausRechnungen && index === 0 ? <AusRechnungen id={id} daten={daten} /> : null}
      {v.ausEuRechnungen && index === 0 ? <EuAusRechnungen id={id} art={v.ausEuRechnungen} /> : null}
      {/* R10 UI: Kasse bzw. Shop laut Check – bei den Umsätzen immer sagen, dass sie dazugehören (nicht erst nach der Übernahme) */}
      {v.ausRechnungen && index === 1 && z.stand.kasse.length && kassenLage(z.stand.profil) !== "shop" ? (
        // R12: mit Kassenabschlüssen übernimmt die App die Kassenumsätze selbst
        <Hinweis art="info" symbol="banknote" text={TEXT.r12_kasse_ust_schritt} />
      ) : v.ausRechnungen && index === 1 && kassenHinweis(kassenLage(z.stand.profil), "ust")?.warnung ? (
        <Hinweis art="warnung" symbol="banknote" text={kassenLage(z.stand.profil) === "shop" ? TEXT.shop_ust_schritt : TEXT.kasse_ust_schritt} />
      ) : null}
      {v.id === "euer" && index === 0 ? <EuerAusDaten id={id} /> : null}
      <Felder felder={a.felder} werte={daten} fehlt={fehlt} setze={(k, w) => { if (formVorher === undefined) setFormVorher(form ?? null); z.setzen(id, { [k]: w }); }} liste={(f) => <ListenSchritt feld={f} id={id} />} />
      {formUnten ? <View style={{ marginTop: 16 }}><FormHinweis v={v} d={daten} unten={0} /></View> : null}
    </View>
  );
}

/** Fortschritt: ein Balken je Schritt, der letzte ist „Fertig“. */
function Fortschritt({ n, aktuell }: { n: number; aktuell: number }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: n, now: aktuell + 1 }} accessibilityLabel={TEXT.schritt(aktuell + 1, n)} style={{ flexDirection: "row", gap: 4, paddingHorizontal: RAND, paddingVertical: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= aktuell ? f.minze : "rgba(255,255,255,0.2)" }} />
      ))}
    </View>
  );
}

/**
 * Geführter Ablauf einer Unterlage (E-124): ein Abschnitt je Bildschirm, unten ein Hauptknopf, am Ende der Abschluss mit
 * Vorschau und „PDF teilen“. Gespeichert wird bei jeder Eingabe. Eine neue, unveränderte Unterlage verschwindet beim
 * Schließen wieder. `amEnde`: bestehende Unterlagen öffnen beim Abschluss (Vorschau und Übersicht).
 */
export function Ablauf({ id, neu, amEnde, start }: { id: string; neu?: boolean; amEnde?: boolean; /** Schritt beim Öffnen (z. B. „im Datenblatt ergänzen“) */ start?: number }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const unterlage = z.stand.unterlagen.find((u) => u.id === id);
  const vorlage = unterlage ? vorlageFuer(unterlage.vorlage) : undefined;
  const n = vorlage?.abschnitte.length ?? 0;
  const fest = Boolean(unterlage?.festgeschrieben);
  const [schritt, setSchritt] = useState(amEnde || fest ? n : start !== undefined && start >= 0 && start < n ? start : 0);
  const teilen = useTeilen(id);
  const anfang = useRef(unterlage ? JSON.stringify(unterlage.daten) : "");
  const zRef = useRef(z);
  zRef.current = z;
  const weg = useRef(false);
  // R12 (UX #5): Startwerte aus mehreren Antworten des Checks (z. B. Bruttopreise bei reinen Privatkunden) – nur bei einer
  // neuen Unterlage; was so vorbelegt ist, gilt als unverändert (die leere Unterlage verschwindet beim Schließen weiter)
  useEffect(() => {
    if (!neu || !unterlage || !vorlage) return;
    // nur, was noch leer ist – Angaben aus „Mein Betrieb“ (z. B. die Rechtsform) gehen vor
    const leer = (w: unknown) => w === undefined || w === null || w === false || w === "" || (Array.isArray(w) && !w.length);
    const start = Object.fromEntries(Object.entries(profilStartwerte(vorlage, z.stand.profil, z.stand.betrieb)).filter(([k]) => leer(unterlage.daten[k])));
    if (!Object.keys(start).length) return;
    z.setzen(id, start);
    anfang.current = JSON.stringify({ ...unterlage.daten, ...start });
    // nur beim Öffnen
  }, []);
  // VoiceOver: neuer Schritt wird angesagt (der Fokus bleibt sonst auf „Weiter“)
  useAnsage(vorlage && schritt < n ? `${TEXT.schritt(schritt + 1, n)}: ${vorlage.abschnitte[schritt]?.titel ?? ""}` : null);

  useEffect(
    () => () => {
      const zz = zRef.current;
      const d = zz.daten(id);
      const v = d ? vorlageFuer(zz.stand.unterlagen.find((u) => u.id === id)?.vorlage ?? "") : undefined;
      if (!d || !v) return;
      if (neu && JSON.stringify(d) === anfang.current) zz.loeschen(id);
      else merken(v, d, zz);
    },
    [id, neu],
  );
  useEffect(() => {
    if (!unterlage && !weg.current) {
      weg.current = true;
      nav.zurueck();
    }
  }, [unterlage, nav]);
  // Kopfzeile des Blatts: Schließen links, Titel, „Übersicht“ rechts (springt zum Abschluss)
  const amAbschlussKopf = schritt >= n || fest;
  useKopf({
    titel: vorlage?.titel ?? "",
    schliessen: true,
    // Bühne (E-142, E-144): Leiste und Grund in der Bühnenfarbe – Schritte und Abschluss
    buehne: true,
    rechts: amAbschlussKopf || !vorlage ? null : { text: TEXT.uebersicht, onPress: () => { merken(vorlage, z.daten(id), z); setSchritt(n); } },
  });
  if (!unterlage || !vorlage) return null;

  const daten = unterlage.daten;
  const fehlt = fehlendeAngaben(vorlage, daten, z.stand.betrieb);
  const ergebnis = vorlage.ergebnis?.(daten) ?? [];
  // festgeschriebene Unterlagen zeigen nur noch den Abschluss (GoBD, E-127)
  const amAbschluss = schritt >= n || fest;
  const gehe = (i: number) => {
    if (fest) return;
    merken(vorlage, z.daten(id), z);
    setSchritt(Math.max(0, Math.min(n, i)));
  };
  const letzteZahl = ergebnis.at(-1);
  // fehlen Absender-Angaben (Mein Betrieb), führt der Hauptknopf direkt dorthin
  const betriebFehlt_ = !fest && vorlage.kundendokument ? fehltFuer(z.stand, unterlage).filter((x) => x.includes("Mein Betrieb")) : [];
  const absenderFehlt = betriebFehlt_.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: f.buehne }}>
      <HellerStatus />
      {amAbschluss ? null : <Fortschritt n={n} aktuell={schritt} />}
      <TastaturRahmen grund={f.buehne}>
        <ScrollView key={schritt} contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 8, paddingBottom: 0, flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {amAbschluss ? null : <SchrittKopf v={vorlage} a={vorlage.abschnitte[schritt]!} index={schritt} />}
          <View style={amAbschluss ? { flexGrow: 1 } : { flexGrow: 1, marginHorizontal: -RAND, paddingHorizontal: RAND, paddingTop: 22, paddingBottom: 32, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne }}>
          {!amAbschluss && schritt === 0 && vorlage.kundendokument && betriebFehlt(z.stand.betrieb) ? (
            // ohne Absender wäre die Rechnung am Ende nicht teilbar – das gleich am Anfang sagen
            <View style={{ padding: 16, borderRadius: RADIUS.karte, backgroundColor: f.amtHauch, gap: 8, marginBottom: 12 }}>
              <T fett farbe={f.amtTief}>{TEXT.absender_fehlt_titel}</T>
              <T v="klein">{TEXT.absender_fehlt_text}</T>
              <Knopf symbol="building.2" text={TEXT.absender_eintragen} onPress={() => nav.oeffnen("absender", () => <AbsenderSeite />, true)} />
            </View>
          ) : null}
          {amAbschluss ? (
            <View>
              <Abschluss id={id} springen={gehe} fehler={null} drucken={teilen.drucken} eRechnung={teilen.eRechnung} eFehlt={teilen.eFehlt} />
              {/* R12 (Zoll #2): Fassungen eines festgeschriebenen Nachweises – die alten bleiben, mit Datum und Grund */}
              {/* über der Papierfläche, die der Abschluss nach unten verlängert (absolut positioniert) */}
              {vorlage.korrektur && unterlage.fassungen?.length ? (
                <View style={{ zIndex: 2, marginHorizontal: -RAND, marginTop: -32, paddingHorizontal: RAND, paddingBottom: 32, backgroundColor: f.papier }}>
                  <FassungenKarte id={id} />
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              <Schritt v={vorlage} a={vorlage.abschnitte[schritt]!} index={schritt} id={id} daten={daten} fehlt={fehlt} />
              {/* Phase 1 (RDG): ruhig unter den Feldern jedes Schritts – nicht bei Rechnungen */}
              {mitVorlagenHinweis(vorlage) ? <RechtsHinweis art="vorlage" oben={24} /> : null}
            </View>
          )}
          {amAbschluss ? null : <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />}
          </View>
        </ScrollView>
        <Fuss
          ueber={
            amAbschluss && teilen.fehler ? (
              // direkt über dem Knopf – oben im Inhalt sähe man den Hinweis nach dem Scrollen nicht
              <Ansage text={teilen.fehler} farbe={f.frist} />
            ) : amAbschluss && teilen.kontingent?.leer ? (
              // E-188: ein noch nie geteilter Entwurf ohne Pro – darum „PDF teilen · Pro“
              <T v="caption" leise>{teilen.kontingent.text}</T>
            ) : amAbschluss && !absenderFehlt && festschreibenHinweis(vorlage, fest) ? (
              // vor dem ersten Teilen: was das Teilen bewirkt – direkt über dem Knopf, ohne Rückfrage
              <T v="caption" leise>{vorlage.korrektur ? TEXT.r12p_wird_festgeschrieben : festschreibenHinweis(vorlage, fest)}</T>
            ) : amAbschluss && teilen.kontingent ? (
              <T v="caption" leise>{teilen.kontingent.text}</T>
            ) : !amAbschluss && letzteZahl && !/^0,00\s/.test(letzteZahl[1]) ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T v="klein" leise>{letzteZahl[0]}</T>
                <Betrag v="klein">{letzteZahl[1]}</Betrag>
              </View>
            ) : null
          }
        >
          {schritt > 0 && !fest ? (
            <ZurueckKnopf label={TEXT.vorheriger_schritt} onPress={() => gehe(schritt - 1)} />
          ) : null}
          {amAbschluss && absenderFehlt ? (
            <Knopf text={TEXT.absender_ergaenzen} symbol="building.2" onPress={() => betriebOeffnen(nav, betriebFehlt_)} stil={{ flex: 1 }} />
          ) : amAbschluss ? (
            <>
              {/* R12 (Zoll #2): festgeschriebener Nachweis – Korrektur als neue Fassung mit Grund */}
              {fest && vorlage.korrektur ? <Knopf ton symbol="pencil" text={TEXT.r12p_korrigieren} onPress={() => nav.oeffnen(`korrektur-${id}`, () => <KorrekturSeite id={id} />, true)} stil={{ flex: 1 }} /> : null}
              <Knopf text={TEXT.mitPro(TEXT.pdf_teilen, teilen.frei)} symbol="square.and.arrow.up" laedt={teilen.laedt} onPress={() => void teilen.los()} stil={{ flex: 1 }} />
            </>
          ) : (
            <Knopf text={schritt === n - 1 ? TEXT.zum_dokument : TEXT.weiter} onPress={() => gehe(schritt + 1)} stil={{ flex: 1 }} />
          )}
        </Fuss>
      </TastaturRahmen>
    </View>
  );
}
