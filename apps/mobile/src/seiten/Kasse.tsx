import { useMemo, useState } from "react";
import { View } from "react-native";
import { KASSEN_BEWEGUNGEN, bestandVor, belegGezahlt, belegNummern, cent, kassenFehler, kassenInhaltGeaendert, kassenSummen, kassenVerlauf, kassenbuchDaten, retrogradeBareinnahmen, standortVon, type KassenBewegung, type KassenBewegungsArt, type KassenInhalt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { ChipLeiste, DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, MehrfachWahl, Schalter, T, TextKnopf, Wahl, Zeile, useGrosseSchrift } from "../ui/bausteine";
import { bestaetigen } from "../ui/bestaetigen";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { istIos, useFarben, weich } from "../ui/thema";
import { belegFoto } from "../unterlagen/belegfoto";
import { kassenMonat, kassenMonate, offeneLadenkasse, ruhetage } from "../unterlagen/kasse";
import { dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
import { istKleinunternehmer } from "../unterlagen/steuerpaket";
import { useAmtlos } from "../zustand";
import { Ablauf } from "./Ablauf";
import { BuehnenBlatt, GrosserBetrag, Gruppe, Leer } from "./gemeinsam";

/**
 * Kasse (R12): Tagesabschlüsse laut Z-Bon bzw. Kassenbericht, Monatsübersicht mit Bargeldbestand und Warnungen
 * (negativer Bestand, fehlende Tage, Lücken in der Z-Bon-Folge, Kassendifferenzen), Kassenbuch als PDF. Erfassen ist
 * immer kostenlos (Pflicht-Nachweis).
 */

const EURO = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FELD = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const MONAT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const euro = (c: number) => `${EURO.format(c / 100)} €`;
const feld = (c: number | null | undefined) => (c ? FELD.format(c / 100) : "");
const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const tagText = (iso: string) => `${TEXT.r12_wochentage[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${datumDe(iso)}`;
const monatText = (m: string) => MONAT.format(new Date(`${m}-15T12:00:00Z`));

/** Kasse öffnen – von „Heute“ und „Unterlagen“ aus. */
export function useKasseOeffnen() {
  const nav = useNav();
  return () => nav.oeffnen("kasse", () => <KasseSeite />);
}

/** Zeile „Kasse“ für Heute und Unterlagen. */
export function KasseZeile({ letzte = true }: { letzte?: boolean }) {
  const z = useAmtlos();
  const oeffnen = useKasseOeffnen();
  const tag = heute();
  const heuteDa = z.stand.kasse.some((k) => k.datum === tag);
  const letzter = z.stand.kasse.reduce<string | null>((m, k) => (!m || k.datum > m ? k.datum : m), null);
  return <Zeile symbol="banknote" titel={TEXT.r12_kasse_zeile} text={z.stand.kasse.length ? (heuteDa ? TEXT.r12_heute_erfasst : `${TEXT.r12_heute_offen} · ${TEXT.r12_kasse_zeile_text(letzter ? datumDe(letzter) : null)}`) : TEXT.r12_kasse_zeile_text(null)} onPress={oeffnen} letzte={letzte} />;
}

export function KasseSeite() {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const grosseSchrift = useGrosseSchrift();
  const monate = useMemo(() => kassenMonate(z.stand), [z.stand]);
  const [monat, setMonat] = useState(monate[0]!);
  const m = useMemo(() => kassenMonat(z.stand, monat), [z.stand, monat]);
  const neu = () => nav.oeffnen("kasse-neu", () => <KassenTagSeite />, true);
  const oeffnen = (id: string) => nav.oeffnen(`kasse-${id}`, () => <KassenTagSeite id={id} />, true);
  const ruhe = ruhetage(z.stand.profil);
  const kassenbuch = () => {
    // je Standort ein Kassenbuch; hier der Hauptbetrieb bzw. der erste Standort des Monats
    const st = m.abschluesse.length ? standortVon(m.abschluesse[0]!) : "";
    const d = kassenbuchDaten(z.stand.kasse, z.stand.belege, monat, belegNummern([...z.stand.belege, ...z.stand.belegArchiv]), st);
    if (!d) return;
    const u = z.anlegen("kassenbuch");
    z.setzen(u.id, d);
    nav.oeffnen(`ablauf-${u.id}`, () => <Ablauf id={u.id} amEnde />, true);
  };
  const zeilen: [string, string, string?][] = [
    ...([19, 7, 0] as const).filter((s) => s !== 0 || m.je[0].brutto).map((s): [string, string, string] => [TEXT.r12_brutto_satz(s), euro(m.je[s].brutto), s ? TEXT.r12_netto_ust(euro(m.je[s].netto), euro(m.je[s].ust)) : ""]),
    [TEXT.r12_bar, euro(m.bar)],
    [TEXT.r12_karte, euro(m.karte)],
    ...(m.sonstige ? [[TEXT.r12_sonstige, euro(m.sonstige)] as [string, string]] : []),
    ...(m.ausgabenBar ? [[TEXT.r12_barausgaben, euro(-m.ausgabenBar)] as [string, string]] : []),
    ...(m.entnahmen ? [[TEXT.r12_entnahmen, euro(-m.entnahmen)] as [string, string]] : []),
    ...(m.einlagen ? [[TEXT.r12_einlagen, euro(m.einlagen)] as [string, string]] : []),
    ...(m.transit ? [[TEXT.r12_transit, euro(-m.transit)] as [string, string]] : []),
    ...m.endeJe.map((e): [string, string] => [e.standort ? `${TEXT.r12_bestand_ende} · ${e.standort}` : TEXT.r12_bestand_ende, euro(e.cent)]),
  ];
  return (
    <BuehnenBlatt
      titel={TEXT.r12_kasse_titel}
      unter={TEXT.r12_kasse_unter}
      buehne={
        <View style={{ gap: 16 }}>
          <View accessible accessibilityLabel={TEXT.r12_umsatz_label(monatText(monat), euro(m.brutto), m.abschluesse.length)} style={{ gap: 2 }}>
            <T v="klein" farbe={f.buehneLeise}>{TEXT.r12_umsatz_monat(monatText(monat))}</T>
            <GrosserBetrag cent={m.brutto} groesse={grosseSchrift ? 40 : 52} />
            <T v="klein" farbe={f.buehneLeise}>{TEXT.r12_tage(m.abschluesse.length)}</T>
          </View>
          <Knopf buehne symbol="plus" text={TEXT.r12_erfassen} onPress={neu} />
        </View>
      }
    >
      {monate.length > 1 ? <ChipLeiste label={TEXT.r12_monat_waehlen} wert={monat} aendern={setMonat} optionen={monate.map((x) => ({ wert: x, text: monatText(x) }))} stil={{ marginTop: 0, marginBottom: 12 }} /> : null}
      {m.negativ.length ? <Hinweis art="warnung" symbol="exclamationmark.triangle" text={TEXT.r12_negativ(m.negativ.map(datumDe).slice(0, 4).join(", "))} /> : null}
      {m.fehlend.length ? <Hinweis art="warnung" symbol="calendar" text={TEXT.r12_fehlend(m.fehlendText)} /> : null}
      {m.zbonLuecken.length ? <Hinweis art="info" text={TEXT.r12_zbon_luecken(m.zbonLuecken.slice(0, 8).join(", "))} /> : null}
      {m.differenzen.length ? <Hinweis art="info" text={TEXT.r12_differenzen(m.differenzen.length, euro(m.differenzen.reduce((a, d) => a + d.cent, 0)))} /> : null}
      {!z.stand.kasse.length ? (
        <Leer symbol="banknote" text={TEXT.r12_leer} unter={TEXT.r12_leer_text} />
      ) : (
        <View>
          <Gruppe erste titel={TEXT.r12_uebersicht}>
            <Karte stil={{ paddingVertical: 8 }}>
              {zeilen.map(([a, w, unter], i) => (
                <View key={a} accessible accessibilityLabel={`${a}: ${w}${unter ? `, ${unter}` : ""}`} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
                    <T stil={{ flexShrink: 1 }}>{a}</T>
                    <T fett>{w}</T>
                  </View>
                  {unter ? <T v="caption" leise>{unter}</T> : null}
                </View>
              ))}
            </Karte>
          </Gruppe>
          <Gruppe titel={TEXT.r12_tage_titel}>
            {m.abschluesse.length ? (
              <Karte>
                {[...m.abschluesse].reverse().map((k, i, l) => {
                  const s = kassenSummen(k);
                  return <Zeile key={k.id} symbol={k.geschlossen ? "moon" : "doc.text"} titel={tagText(k.datum)} text={[standortVon(k), k.geschlossen ? TEXT.r12_geschlossen : k.zbon ? `Z ${k.zbon}` : "", k.historie?.length ? TEXT.r12_korrigiert(k.historie.length) : TEXT.r12_festgeschrieben].filter(Boolean).join(" · ")} wert={k.geschlossen ? undefined : euro(s.brutto)} onPress={() => oeffnen(k.id)} letzte={i === l.length - 1} />;
                })}
              </Karte>
            ) : (
              <T leise>{TEXT.r12_kassenbuch_leer}</T>
            )}
          </Gruppe>
          {m.abschluesse.length ? (
            <View style={{ marginTop: 14 }}>
              <Knopf ton symbol="doc.richtext" text={TEXT.r12_kassenbuch_pdf(monatText(monat))} onPress={kassenbuch} />
              <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.r12_kassenbuch_text}</T>
            </View>
          ) : null}
        </View>
      )}
      <MehrfachWahl label={TEXT.r12_ruhetage} hilfe={TEXT.r12_ruhetage_hilfe} werte={ruhe.map(String)} aendern={(w) => z.profilSetzen({ "kasse.ruhetage": w })} optionen={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ wert: String(d), text: TEXT.r12_wochentage_lang[d]! }))} />
      <T v="caption" leise stil={{ marginTop: 16 }}>{TEXT.r12_kostenlos}</T>
    </BuehnenBlatt>
  );
}

type Form = {
  datum: string;
  geschlossen: boolean;
  kassenbericht: boolean;
  zbon: string;
  u19: string;
  u7: string;
  u0: string;
  karte: string;
  sonstige: string;
  rechnungen: string;
  anfang: string;
  gezaehlt: string;
  bewegungen: { art: KassenBewegungsArt; betrag: string; text: string }[];
  tse_seriennr: string;
  tse_von: string;
  tse_bis: string;
  bediener: string;
  standort: string;
  notiz: string;
  datei: string | null;
};

const formAus = (k: KassenInhalt | undefined, bericht: boolean, tag: string): Form => ({
  datum: k?.datum ?? tag,
  geschlossen: Boolean(k?.geschlossen),
  kassenbericht: k ? Boolean(k.kassenbericht) : bericht,
  zbon: k?.zbon ?? "",
  u19: feld(k?.umsatz.find((u) => u.satz === 19)?.brutto_cent),
  u7: feld(k?.umsatz.find((u) => u.satz === 7)?.brutto_cent),
  u0: feld(k?.umsatz.find((u) => u.satz === 0)?.brutto_cent),
  karte: feld(k?.karte_cent),
  sonstige: feld(k?.sonstige_cent),
  rechnungen: feld(k?.rechnungen_cent),
  anfang: feld(k?.anfang_cent),
  gezaehlt: typeof k?.gezaehlt_cent === "number" ? FELD.format(k.gezaehlt_cent / 100) : "",
  bewegungen: (k?.bewegungen ?? []).map((b) => ({ art: b.art, betrag: feld(b.betrag_cent), text: b.text ?? "" })),
  tse_seriennr: k?.tse_seriennr ?? "",
  tse_von: k?.tse_von ?? "",
  tse_bis: k?.tse_bis ?? "",
  bediener: k?.bediener ?? "",
  standort: k?.standort ?? "",
  notiz: k?.notiz ?? "",
  datei: k?.datei ?? null,
});

const c = (t: string) => (t.trim() ? cent(t) : 0);
const falsch = (t: string) => Boolean(t.trim()) && (cent(t) === null || (cent(t) ?? 0) < 0);

/**
 * Tagesabschluss erfassen, ansehen oder korrigieren. Neu: Tag (heute), Umsatz je Steuersatz brutto, davon Karte –
 * mehr braucht es nicht. Offene Ladenkasse: Kassenbericht mit gezähltem Endbestand (retrograd).
 */
export function KassenTagSeite({ id }: { id?: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const melden = useMeldung();
  const alt = id ? z.stand.kasse.find((k) => k.id === id) : undefined;
  const [korrektur, setKorrektur] = useState(false);
  const [grund, setGrund] = useState("");
  const [mehr, setMehr] = useState(false);
  const [form, setForm] = useState<Form>(() => formAus(alt, offeneLadenkasse(z.stand.profil), heute()));
  const [fehler, setFehler] = useState<string | null>(null);
  const ku = istKleinunternehmer(z.stand);
  const nurLesen = Boolean(alt && !korrektur);
  const setze = (w: Partial<Form>) => setForm((x) => ({ ...x, ...w }));
  const nummern = useMemo(() => belegNummern([...z.stand.belege, ...z.stand.belegArchiv]), [z.stand.belege, z.stand.belegArchiv]);

  // Bestand vor dem Tag (ohne diesen Abschluss), Barbelege des Tages
  const andere = z.stand.kasse.filter((k) => k.id !== id);
  const standort = form.standort.trim();
  const vorher = kassenVerlauf(andere.filter((k) => k.datum < form.datum || (k.datum === form.datum && k.erstellt < (alt?.erstellt ?? "9")) ), z.stand.belege.filter((b) => (b.bezahlt || b.datum) < form.datum), standort);
  const bestand = bestandVor(vorher, form.datum) ?? (vorher.tage.length ? vorher.tage[vorher.tage.length - 1]!.ende : null);
  const ersterTag = bestand === null;
  const barbelege = z.stand.belege.filter((b) => !b.ungueltig && b.zahlung === "bar" && (b.bezahlt || b.datum) === form.datum && !standort);
  const ausgaben = barbelege.reduce((a, b) => a + belegGezahlt(b), 0);
  const bew = (art: KassenBewegungsArt) => form.bewegungen.filter((b) => b.art === art).reduce((a, b) => a + (c(b.betrag) ?? 0), 0);
  const anfang = ersterTag ? (c(form.anfang) ?? 0) : (bestand ?? 0);

  // Kassenbericht: Bareinnahmen retrograd; Umsatz = bar + unbar; 19 % = Rest nach 7 % und 0 %
  const karte = c(form.karte) ?? 0;
  const sonstige = c(form.sonstige) ?? 0;
  const rechnungen = c(form.rechnungen) ?? 0;
  const gezaehlt = form.gezaehlt.trim() ? cent(form.gezaehlt) : null;
  const barBericht = form.kassenbericht && gezaehlt !== null ? retrogradeBareinnahmen({ anfang, gezaehlt, ausgaben, entnahmen: bew("entnahme"), transit: bew("transit"), einlagen: bew("einlage") }) - rechnungen : 0;
  const u7 = c(form.u7) ?? 0;
  const u0 = c(form.u0) ?? 0;
  const u19 = form.kassenbericht ? barBericht + karte + sonstige - u7 - u0 : (c(form.u19) ?? 0);
  const inhalt: KassenInhalt = {
    datum: form.datum,
    ...(form.geschlossen ? { geschlossen: true } : {}),
    zbon: form.zbon.trim() || null,
    umsatz: form.geschlossen ? [] : ku ? [{ satz: 0, brutto_cent: u19 + u7 + u0 }].filter((u) => u.brutto_cent) : [{ satz: 19, brutto_cent: u19 }, { satz: 7, brutto_cent: u7 }, { satz: 0, brutto_cent: u0 }].filter((u) => u.brutto_cent),
    karte_cent: form.geschlossen ? 0 : karte,
    sonstige_cent: form.geschlossen ? 0 : sonstige,
    ...(rechnungen ? { rechnungen_cent: rechnungen } : {}),
    bewegungen: form.bewegungen.map((b): KassenBewegung | null => (c(b.betrag) ? { art: b.art, betrag_cent: c(b.betrag)!, ...(b.text.trim() ? { text: b.text.trim() } : {}) } : null)).filter((b): b is KassenBewegung => b !== null),
    anfang_cent: ersterTag && form.anfang.trim() ? c(form.anfang) : null,
    gezaehlt_cent: gezaehlt,
    datei: form.datei,
    notiz: form.notiz.trim() || null,
    ...(form.kassenbericht ? { kassenbericht: true } : {}),
    ...(form.tse_seriennr.trim() ? { tse_seriennr: form.tse_seriennr.trim() } : {}),
    ...(form.tse_von.trim() ? { tse_von: form.tse_von.trim() } : {}),
    ...(form.tse_bis.trim() ? { tse_bis: form.tse_bis.trim() } : {}),
    ...(form.bediener.trim() ? { bediener: form.bediener.trim() } : {}),
    ...(standort ? { standort } : {}),
  };
  const s = kassenSummen(inhalt);
  const soll = anfang + s.einlagen + s.bar + s.rechnungen - ausgaben - s.entnahmen - s.transit;
  const fehlerListe = kassenFehler(inhalt);
  const betragFalsch = [form.u19, form.u7, form.u0, form.karte, form.sonstige, form.rechnungen, form.anfang, form.gezaehlt, ...form.bewegungen.map((b) => b.betrag)].some(falsch);

  const speichern = async () => {
    setFehler(null);
    if (betragFalsch) return setFehler(TEXT.betrag_falsch);
    if (fehlerListe.includes("unbar_zu_hoch")) return setFehler(TEXT.r12_unbar_zu_hoch);
    if (form.kassenbericht && !form.geschlossen && gezaehlt === null) return setFehler(TEXT.r12_gezaehlt_pflicht);
    if (alt && !grund.trim()) return setFehler(TEXT.r12_grund_fehlt);
    // kein negativer Bestand (§ 146 Abs. 1 Satz 2 AO) – nur nach ausdrücklicher Bestätigung
    if (soll < 0 && !(await bestaetigen({ titel: TEXT.r12_negativ_frage_titel, text: TEXT.r12_negativ_frage(euro(soll)), ja: TEXT.r12_trotzdem }))) return;
    if (!alt && andere.some((k) => k.datum === form.datum && standortVon(k) === standort) && !(await bestaetigen({ titel: TEXT.r12_schon_da(datumDe(form.datum)), ja: TEXT.r12_trotzdem }))) return;
    if (alt) {
      if (!kassenInhaltGeaendert(alt, inhalt)) {
        melden(TEXT.r12_unveraendert, "info");
        return setKorrektur(false);
      }
      z.kasseKorrigieren(alt.id, inhalt, grund);
      melden(TEXT.r12_korrigiert_meldung);
      setKorrektur(false);
      setGrund("");
      return;
    }
    z.kasseSpeichern(inhalt);
    melden(TEXT.r12_gespeichert(datumDe(form.datum), euro(s.brutto)));
    z.erfolg();
    nav.zurueck();
  };
  const foto = async (kamera: boolean) => {
    try {
      const bytes = kamera ? await belegFoto(true) : (await dateiWaehlenBytes(["image/*", "application/pdf"]))?.bytes;
      if (!bytes) return;
      setze({ datei: await z.dateiSpeichern(bytes, kamera ? "jpg" : "pdf") });
    } catch {
      melden(TEXT.beleg_fehler, "info");
    }
  };
  const betragFeld = (label: string, wert: string, aendern: (w: string) => void, hilfe?: string) => <Feld label={label} hilfe={hilfe} wert={wert} aendern={aendern} keyboardType="decimal-pad" placeholder="0,00" editable={!nurLesen} fehler={falsch(wert) ? TEXT.betrag_falsch : null} />;
  const weitere = [form.zbon && form.kassenbericht, form.sonstige, form.rechnungen, form.u0, form.tse_seriennr, form.tse_von, form.tse_bis, form.bediener, form.standort, form.notiz].filter(Boolean).length;

  return (
    <BuehnenBlatt
      titel={alt ? (korrektur ? TEXT.r12_korrektur_titel : tagText(alt.datum)) : TEXT.r12_neu_titel}
      unter={alt ? (korrektur ? TEXT.r12_korrektur_unter : undefined) : form.kassenbericht ? TEXT.r12_neu_unter_bericht : TEXT.r12_neu_unter}
      buehne={
        <View accessible accessibilityLabel={TEXT.r12_summe(euro(s.brutto))} style={{ gap: 2 }}>
          <T v="klein" farbe={f.buehneLeise}>{TEXT.r12_summe("").replace(/:\s*$/, "")}</T>
          <GrosserBetrag cent={s.brutto} groesse={44} />
        </View>
      }
      fuss={
        <Fuss ueber={fehler ? <T v="klein" farbe={f.frist} accessibilityLiveRegion="assertive">{fehler}</T> : undefined}>
          {nurLesen ? <Knopf ton symbol="pencil" text={TEXT.r12_korrigieren} onPress={() => setKorrektur(true)} stil={{ flex: 1 }} /> : <Knopf symbol="checkmark" text={alt ? TEXT.r12_korrektur_speichern : TEXT.r12_speichern} onPress={() => void speichern()} stil={{ flex: 1 }} />}
        </Fuss>
      }
    >
      {korrektur ? <Feld label={TEXT.r12_grund} hilfe={TEXT.r12_grund_hilfe} wert={grund} aendern={setGrund} /> : null}
      {alt ? null : <DatumFeld label={TEXT.r12_datum} wert={form.datum} aendern={(d) => d && setze({ datum: d })} />}
      {nurLesen ? null : <Schalter label={TEXT.r12_geschlossen_schalter} wert={form.geschlossen} aendern={(w) => setze({ geschlossen: w })} />}
      {form.geschlossen ? null : (
        <View>
          {/* Kassenbericht oben nur bei offener Ladenkasse (laut Check) – sonst unter „Weitere Angaben“, damit der Abschluss kurz bleibt */}
          {nurLesen || !(offeneLadenkasse(z.stand.profil) || form.kassenbericht) ? null : <Schalter label={TEXT.r12_kassenbericht_schalter} hilfe={TEXT.r12_kassenbericht_hilfe} wert={form.kassenbericht} aendern={(w) => setze({ kassenbericht: w })} />}
          {form.kassenbericht ? (
            <View>
              {ersterTag ? betragFeld(TEXT.r12_anfang, form.anfang, (w) => setze({ anfang: w }), TEXT.r12_anfang_hilfe) : <T v="klein" leise stil={{ marginTop: 14 }}>{TEXT.r12_anfang_auto(euro(anfang))}</T>}
              {betragFeld(TEXT.r12_gezaehlt_pflicht, form.gezaehlt, (w) => setze({ gezaehlt: w }))}
              {betragFeld(TEXT.r12_karte_feld, form.karte, (w) => setze({ karte: w }), TEXT.r12_karte_hilfe)}
              {ku ? null : betragFeld(TEXT.r12_kassenbericht_7, form.u7, (w) => setze({ u7: w }), TEXT.r12_kassenbericht_7_hilfe)}
              <T v="klein" stil={{ marginTop: 10 }}>{`${TEXT.r12_kassenbericht_bar}: ${euro(barBericht)}`}</T>
            </View>
          ) : (
            <View>
              {betragFeld(ku ? TEXT.r12_umsatz_ku : TEXT.r12_umsatz_19, form.u19, (w) => setze({ u19: w }), TEXT.r12_umsatz_hilfe)}
              {ku ? null : betragFeld(TEXT.r12_umsatz_7, form.u7, (w) => setze({ u7: w }))}
              {betragFeld(TEXT.r12_karte_feld, form.karte, (w) => setze({ karte: w }), TEXT.r12_karte_hilfe)}
              <Feld label={TEXT.r12_zbon} hilfe={TEXT.r12_zbon_hilfe} wert={form.zbon} aendern={(w) => setze({ zbon: w })} keyboardType="number-pad" editable={!nurLesen} />
            </View>
          )}
          <Karte stil={{ marginTop: 14, paddingVertical: 10, gap: 4 }}>
            <T fett>{TEXT.r12_bar_ergebnis(euro(s.bar))}</T>
            {fehlerListe.includes("unbar_zu_hoch") ? <T v="klein" farbe={f.frist}>{TEXT.r12_unbar_zu_hoch}</T> : null}
            {barbelege.length ? <T v="klein" leise>{TEXT.r12_belege_tag(barbelege.length, barbelege.map((b) => `${b.lieferant.trim() || nummern.get(b.id)} ${euro(belegGezahlt(b))}`).join(", "))}</T> : null}
            <T v="klein" farbe={soll < 0 ? f.frist : undefined} leise={soll >= 0}>{TEXT.r12_soll(euro(soll))}</T>
            {gezaehlt !== null && !form.kassenbericht && gezaehlt !== soll ? <T v="klein" leise>{TEXT.r12_differenz(euro(gezaehlt - soll))}</T> : null}
          </Karte>
        </View>
      )}
      {/* Geld rein oder raus: Bank, Privatentnahme, Einlage */}
      <View style={{ marginTop: 14 }}>
        {form.bewegungen.length ? <T v="klein" fett accessibilityRole="header">{TEXT.r12_bewegungen}</T> : null}
        {form.bewegungen.map((b, i) => (
          <Karte key={i} stil={{ marginTop: 8, paddingVertical: 8 }}>
            <Wahl label={TEXT.r12_bewegung_art} wert={b.art} aendern={(w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, art: w } : x)) })} optionen={KASSEN_BEWEGUNGEN} />
            {betragFeld(TEXT.r12_bewegung_betrag, b.betrag, (w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, betrag: w } : x)) }))}
            <Feld label={TEXT.r12_bewegung_text} wert={b.text} aendern={(w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, text: w } : x)) })} editable={!nurLesen} />
            {nurLesen ? null : <TextKnopf symbol="xmark" leise text={TEXT.entfernen} label={TEXT.r12_bewegung_entfernen(KASSEN_BEWEGUNGEN.find((x) => x.wert === b.art)!.text)} onPress={() => { weich(); setze({ bewegungen: form.bewegungen.filter((_, j) => j !== i) }); }} />}
          </Karte>
        ))}
        {nurLesen ? null : <TextKnopf symbol="plus" text={TEXT.r12_bewegung_neu} onPress={() => { weich(); setze({ bewegungen: [...form.bewegungen, { art: "transit", betrag: "", text: "" }] }); }} />}
      </View>
      {form.kassenbericht || form.geschlossen ? null : ersterTag ? betragFeld(TEXT.r12_anfang, form.anfang, (w) => setze({ anfang: w }), TEXT.r12_anfang_hilfe) : null}
      {form.kassenbericht || form.geschlossen ? null : betragFeld(TEXT.r12_gezaehlt, form.gezaehlt, (w) => setze({ gezaehlt: w }), TEXT.r12_gezaehlt_hilfe)}
      {/* Foto des Z-Bons als Beleg (verschlüsselt wie Belegdateien) */}
      {form.datei ? <Hinweis art="erfolg" text={TEXT.r12_foto_da} /> : nurLesen ? null : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {istIos ? <TextKnopf symbol="camera" text={TEXT.r12_foto} onPress={() => void foto(true)} /> : null}
          <TextKnopf symbol="doc" text={TEXT.r12_foto_datei} onPress={() => void foto(false)} />
        </View>
      )}
      {mehr || weitere || nurLesen ? (
        <View>
          {nurLesen || form.geschlossen || offeneLadenkasse(z.stand.profil) || form.kassenbericht ? null : <Schalter label={TEXT.r12_kassenbericht_schalter} hilfe={TEXT.r12_kassenbericht_hilfe} wert={form.kassenbericht} aendern={(w) => setze({ kassenbericht: w })} />}
          {form.kassenbericht ? <Feld label={TEXT.r12_zbon} hilfe={TEXT.r12_zbon_hilfe} wert={form.zbon} aendern={(w) => setze({ zbon: w })} editable={!nurLesen} /> : null}
          {form.geschlossen ? null : betragFeld(TEXT.r12_sonstige_feld, form.sonstige, (w) => setze({ sonstige: w }), TEXT.r12_sonstige_hilfe)}
          {form.geschlossen || form.kassenbericht || ku ? null : betragFeld(TEXT.r12_umsatz_0, form.u0, (w) => setze({ u0: w }))}
          {form.geschlossen ? null : betragFeld(TEXT.r12_rechnungen_feld, form.rechnungen, (w) => setze({ rechnungen: w }), TEXT.r12_rechnungen_hilfe)}
          <T v="klein" fett stil={{ marginTop: 16 }} accessibilityRole="header">{TEXT.r12_tse}</T>
          <Feld label={TEXT.r12_tse_serie} wert={form.tse_seriennr} aendern={(w) => setze({ tse_seriennr: w })} editable={!nurLesen} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}><Feld label={TEXT.r12_tse_von} wert={form.tse_von} aendern={(w) => setze({ tse_von: w })} editable={!nurLesen} /></View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}><Feld label={TEXT.r12_tse_bis} wert={form.tse_bis} aendern={(w) => setze({ tse_bis: w })} editable={!nurLesen} /></View>
          </View>
          <Feld label={TEXT.r12_bediener} hilfe={TEXT.r12_bediener_hilfe} wert={form.bediener} aendern={(w) => setze({ bediener: w })} editable={!nurLesen} />
          <Feld label={TEXT.r12_standort} hilfe={TEXT.r12_standort_hilfe} wert={form.standort} aendern={(w) => setze({ standort: w })} editable={!nurLesen && !alt} />
          <Feld label={TEXT.r12_notiz} wert={form.notiz} aendern={(w) => setze({ notiz: w })} mehrzeilig editable={!nurLesen} />
        </View>
      ) : (
        <TextKnopf symbol="chevron.down" text={TEXT.weitere_angaben(offeneLadenkasse(z.stand.profil) ? 9 : 10)} erweitert={false} onPress={() => { weich(); setMehr(true); }} />
      )}
      {alt?.historie?.length ? (
        <Gruppe titel={TEXT.r12_historie}>
          <Karte stil={{ paddingVertical: 8, gap: 6 }}>
            {[...alt.historie].reverse().map((h) => (
              <T key={`${h.bis}${h.grund}`} v="klein">{TEXT.r12_historie_zeile(datumDe(h.bis.slice(0, 10)), h.grund, euro(kassenSummen(h).brutto))}</T>
            ))}
          </Karte>
        </Gruppe>
      ) : null}
    </BuehnenBlatt>
  );
}
