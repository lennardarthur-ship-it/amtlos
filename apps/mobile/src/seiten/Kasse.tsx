import { useMemo, useState } from "react";
import { View } from "react-native";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { KASSEN_BEWEGUNGEN, STUECKELUNG, bestandVor, belegGezahlt, belegNummern, cent, dokumentHtml, grundGenuegt, kassenFehler, kassenInhaltGeaendert, kassenSummen, kassenVerlauf, kassenbuchDaten, nacherfasstTage, retrogradeBareinnahmen, standortVon, stueckelungSumme, vorlageFuer, zeitDe, type BarRechnung, type Daten, type GutscheinArt, type KassenBewegung, type KassenBewegungsArt, type KassenGutschein, type KassenInhalt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { ChipLeiste, DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, MehrfachWahl, Schalter, T, TextKnopf, Wahl, Zeile, useGrosseSchrift } from "../ui/bausteine";
import { bestaetigen } from "../ui/bestaetigen";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { istIos, useFarben, weich } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { belegFoto } from "../unterlagen/belegfoto";
import { kassenMonat, kassenMonate, offeneLadenkasse, ruhetage } from "../unterlagen/kasse";
import { pdfTeilen } from "../unterlagen/pdf";
import { utf8 } from "../unterlagen/sicherung";
import { dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { HAUPT_STAETTE, alleStaetten, heute, kassenbuchFest, offenerBetrag, vaAbgegebenFuer } from "../unterlagen/speicher";
import { istKleinunternehmer } from "../unterlagen/steuerpaket";
import { offeneRechnungen } from "../unterlagen/ustAusRechnungen";
import { useAmtlos } from "../zustand";
import { BuehnenBlatt, GrosserBetrag, Gruppe, Leer } from "./gemeinsam";

/**
 * Kasse (R12): Tagesabschlüsse laut Z-Bon bzw. Kassenbericht, Monatsübersicht mit Bargeldbestand und Warnungen
 * (negativer Bestand, fehlende Tage, Lücken in der Z-Bon-Folge, Kassendifferenzen), Kassenbuch als PDF. Erfassen ist
 * immer kostenlos (Pflicht-Nachweis).
 *
 * R12 GoBD: Kassenbuch nur lesbar und beim ersten Teilen festgeschrieben; kein Tag in der Zukunft; Nacherfassung mit
 * Grund; Trinkgeld, App, „auf Rechnung“, Gutscheine und bar kassierte Rechnungen aus Amtlos getrennt; Eigenbeleg-Nummer
 * und Foto je Bewegung; Kassenbericht nur bei offener Ladenkasse; Kassensturz mit Zählprotokoll; Sachentnahmen.
 */

const EURO = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FELD = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const MONAT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const euro = (c: number) => `${EURO.format(c / 100)} €`;
const feld = (c: number | null | undefined) => (c ? FELD.format(c / 100) : "");
const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const tagText = (iso: string) => `${TEXT.r12_wochentage[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${datumDe(iso)}`;
const monatText = (m: string) => MONAT.format(new Date(`${m}-15T12:00:00Z`));
/** Gastronomie, Bäckerei, Lebensmittel laut Check – dort sind Sachentnahmen üblich */
const mitSachentnahmen = (profil: Record<string, unknown>) => Array.isArray(profil["taetigkeit.branchen"]) && (profil["taetigkeit.branchen"] as string[]).includes("gastronomie_lebensmittel");

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
  // R12 GoBD: Kassenbuch nur lesbar – je Standort ein Kassenbuch; hier der Hauptbetrieb bzw. der erste Standort des Monats
  const st = m.abschluesse.length ? standortVon(m.abschluesse[0]!) : "";
  const kassenbuch = () => nav.oeffnen(`kassenbuch-${monat}`, () => <KassenbuchSeite monat={monat} standort={st} />, true);
  const zeilen: [string, string, string?][] = [
    ...([19, 7, 0] as const).filter((s) => s !== 0 || m.je[0].brutto).map((s): [string, string, string] => [TEXT.r12_brutto_satz(s), euro(m.je[s].brutto), s ? TEXT.r12_netto_ust(euro(m.je[s].netto), euro(m.je[s].ust)) : ""]),
    [TEXT.r12_bar, euro(m.bar)],
    [TEXT.r12_karte, euro(m.karte)],
    ...(m.trinkgeld ? [[TEXT.r12g_trinkgeld_zeile, euro(-m.trinkgeld)] as [string, string]] : []),
    ...(m.app ? [[TEXT.r12g_app_zeile, euro(m.app)] as [string, string]] : []),
    ...(m.aufrechnung ? [[TEXT.r12g_aufrechnung_zeile, euro(m.aufrechnung)] as [string, string]] : []),
    ...(m.gutscheinVerkauf ? [[TEXT.r12g_gutschein_verkauf_zeile, euro(m.gutscheinVerkauf)] as [string, string]] : []),
    ...(m.gutscheinEinloesung ? [[TEXT.r12g_gutschein_einl_zeile, euro(m.gutscheinEinloesung)] as [string, string]] : []),
    ...(m.sonstige ? [[TEXT.r12_sonstige, euro(m.sonstige)] as [string, string]] : []),
    ...(m.ausgabenBar ? [[TEXT.r12_barausgaben, euro(-m.ausgabenBar)] as [string, string]] : []),
    ...(m.entnahmen ? [[TEXT.r12_entnahmen, euro(-m.entnahmen)] as [string, string]] : []),
    ...(m.einlagen ? [[TEXT.r12_einlagen, euro(m.einlagen)] as [string, string]] : []),
    ...(m.transit ? [[TEXT.r12_transit, euro(-m.transit)] as [string, string]] : []),
    ...m.endeJe.map((e): [string, string] => [e.standort ? `${TEXT.r12_bestand_ende} · ${e.standort}` : TEXT.r12_bestand_ende, euro(e.cent)]),
  ];
  const se = z.stand.sachentnahmen;
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
      {m.differenzen.length ? <Hinweis art="info" text={TEXT.r12g_differenzen(m.differenzen.length, euro(m.differenzen.reduce((a, d) => a + d.cent, 0)))} /> : null}
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
                  const nach = nacherfasstTage(k.datum, k.erstellt);
                  return <Zeile key={k.id} symbol={k.geschlossen ? "moon" : "doc.text"} titel={tagText(k.datum)} text={[standortVon(k), k.geschlossen ? TEXT.r12_geschlossen : k.zbon ? `Z ${k.zbon}` : "", nach ? TEXT.r12g_nacherfasst_kurz(nach, null) : "", k.historie?.length ? TEXT.r12_korrigiert(k.historie.length) : TEXT.r12_festgeschrieben].filter(Boolean).join(" · ")} wert={k.geschlossen ? undefined : euro(s.brutto)} onPress={() => oeffnen(k.id)} letzte={i === l.length - 1} />;
                })}
              </Karte>
            ) : (
              <T leise>{TEXT.r12_kassenbuch_leer}</T>
            )}
          </Gruppe>
          {m.abschluesse.length ? (
            <View style={{ marginTop: 14 }}>
              <Knopf ton symbol="doc.richtext" text={TEXT.r12g_kassenbuch_knopf(monatText(monat))} onPress={kassenbuch} />
              <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.r12g_kassenbuch_text}</T>
            </View>
          ) : null}
        </View>
      )}
      <View style={{ marginTop: 14 }}>
        <Knopf ton symbol="eurosign.circle" text={TEXT.r12g_kassensturz} onPress={() => nav.oeffnen("kassensturz", () => <KassensturzSeite />, true)} />
        <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.r12g_kassensturz_text}</T>
      </View>
      {mitSachentnahmen(z.stand.profil) || se.length ? (
        <Gruppe titel={TEXT.r12g_sachentnahmen}>
          <Karte>
            <Zeile symbol="cup.and.saucer" titel={TEXT.r12g_se_oeffnen} text={TEXT.r12g_sachentnahmen_text(se.length)} onPress={() => nav.oeffnen("sachentnahmen", () => <SachentnahmenSeite />, true)} letzte />
          </Karte>
        </Gruppe>
      ) : null}
      <MehrfachWahl label={TEXT.r12_ruhetage} hilfe={TEXT.r12_ruhetage_hilfe} werte={ruhe.map(String)} aendern={(w) => z.profilSetzen({ "kasse.ruhetage": w })} optionen={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ wert: String(d), text: TEXT.r12_wochentage_lang[d]! }))} />
      <T v="caption" leise stil={{ marginTop: 16 }}>{TEXT.r12_kostenlos}</T>
    </BuehnenBlatt>
  );
}

/**
 * R12 GoBD: Kassenbuch eines Monats – nur lesbar aus den Tagesabschlüssen erzeugt (keine bearbeitbare Unterlage).
 * Beim ersten Teilen wird der Inhalt mit SHA-256 festgeschrieben; nach einer Korrektur entsteht beim Teilen eine neue
 * Fassung, die alte bleibt.
 */
function KassenbuchSeite({ monat, standort }: { monat: string; standort: string }) {
  const z = useAmtlos();
  const melden = useMeldung();
  const [laedt, setLaedt] = useState(false);
  const v = vorlageFuer("kassenbuch")!;
  const daten = useMemo(() => kassenbuchDaten(z.stand.kasse, z.stand.belege, monat, belegNummern([...z.stand.belege, ...z.stand.belegArchiv]), standort) as unknown as Daten | null, [z.stand, monat, standort]);
  const fest = kassenbuchFest(z.stand, monat, standort);
  if (!daten) return <Unterseite titel={TEXT.r12g_kassenbuch_titel(monatText(monat))}>{null}</Unterseite>;
  const gleich = fest && JSON.stringify(fest.daten) === JSON.stringify(daten);
  const html = dokumentHtml(v, daten, z.stand.betrieb);
  const teilen = async () => {
    setLaedt(true);
    try {
      const ok = await pdfTeilen(html, `Kassenbuch-${monat}${standort ? `-${standort.replace(/[^A-Za-z0-9]/g, "")}` : ""}.pdf`, true);
      if (!ok) return;
      z.kassenbuchFestschreiben(monat, standort, daten, bytesToHex(sha256(utf8(JSON.stringify(daten)))));
      melden(TEXT.r12g_kassenbuch_geteilt);
    } catch {
      melden(TEXT.pdf_fehler, "info");
    } finally {
      setLaedt(false);
    }
  };
  return (
    <Unterseite titel={TEXT.r12g_kassenbuch_titel(`${monatText(monat)}${standort ? ` · ${standort}` : ""}`)} unter={TEXT.r12g_kassenbuch_unter}>
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        {fest ? <Hinweis art={gleich ? "erfolg" : "warnung"} text={gleich ? TEXT.r12g_kassenbuch_fest(zeitDe(fest.festgeschrieben!)) : TEXT.r12g_kassenbuch_neu_fassung(zeitDe(fest.festgeschrieben!))} /> : null}
        <View style={{ flex: 1, minHeight: 360, borderRadius: 12, overflow: "hidden", backgroundColor: "#ffffff" }}>
          <Vorschau html={html} quer />
        </View>
      </View>
      <Fuss>
        <Knopf text={TEXT.r12g_kassenbuch_teilen} symbol="square.and.arrow.up" laedt={laedt} onPress={() => void teilen()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

type GutscheinForm = { vorgang: KassenGutschein["vorgang"]; art: GutscheinArt; satz: "19" | "7" | "0"; betrag: string };
type Form = {
  datum: string;
  geschlossen: boolean;
  kassenbericht: boolean;
  zbon: string;
  u19: string;
  u7: string;
  u0: string;
  karte: string;
  trinkgeld: string;
  app: string;
  aufrechnung: string;
  sonstige: string;
  rechnungen: string;
  rechnungenBar: { id: string; nummer: string; betrag: string }[];
  gutscheine: GutscheinForm[];
  anfang: string;
  gezaehlt: string;
  bewegungen: { art: KassenBewegungsArt; betrag: string; text: string; beleg_nr: string | null; datei: string | null }[];
  tse_seriennr: string;
  tse_von: string;
  tse_bis: string;
  bediener: string;
  standort: string;
  notiz: string;
  datei: string | null;
  nacherfasst_grund: string;
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
  trinkgeld: feld(k?.trinkgeld_cent),
  app: feld(k?.app_cent),
  aufrechnung: feld(k?.aufrechnung_cent),
  sonstige: feld(k?.sonstige_cent),
  rechnungen: k?.rechnungen_bar?.length ? "" : feld(k?.rechnungen_cent),
  rechnungenBar: (k?.rechnungen_bar ?? []).map((r) => ({ id: r.id, nummer: r.nummer, betrag: feld(r.betrag_cent) })),
  gutscheine: (k?.gutscheine ?? []).map((g) => ({ vorgang: g.vorgang, art: g.art, satz: String(g.satz ?? 19) as GutscheinForm["satz"], betrag: feld(g.betrag_cent) })),
  anfang: feld(k?.anfang_cent),
  gezaehlt: typeof k?.gezaehlt_cent === "number" ? FELD.format(k.gezaehlt_cent / 100) : "",
  bewegungen: (k?.bewegungen ?? []).map((b) => ({ art: b.art, betrag: feld(b.betrag_cent), text: b.text ?? "", beleg_nr: b.beleg_nr ?? null, datei: b.datei ?? null })),
  tse_seriennr: k?.tse_seriennr ?? "",
  tse_von: k?.tse_von ?? "",
  tse_bis: k?.tse_bis ?? "",
  bediener: k?.bediener ?? "",
  standort: k?.standort ?? "",
  notiz: k?.notiz ?? "",
  datei: k?.datei ?? null,
  nacherfasst_grund: k?.nacherfasst_grund ?? "",
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
  const offen = offeneLadenkasse(z.stand.profil);
  const [korrektur, setKorrektur] = useState(false);
  const [grund, setGrund] = useState("");
  const [mehr, setMehr] = useState(false);
  const [form, setForm] = useState<Form>(() => formAus(alt, offen, heute()));
  const [fehler, setFehler] = useState<string | null>(null);
  const ku = istKleinunternehmer(z.stand);
  const nurLesen = Boolean(alt && !korrektur);
  const setze = (w: Partial<Form>) => setForm((x) => ({ ...x, ...w }));
  const nummern = useMemo(() => belegNummern([...z.stand.belege, ...z.stand.belegArchiv]), [z.stand.belege, z.stand.belegArchiv]);
  const tag = heute();
  const nachTage = alt ? nacherfasstTage(alt.datum, alt.erstellt) : nacherfasstTage(form.datum, tag);
  const vaZeitraum = alt && korrektur ? vaAbgegebenFuer(z.stand, alt.datum) : null;
  // offene Rechnungen aus Amtlos für „bar kassiert“ (ohne die schon gewählten)
  const offeneRe = useMemo(() => offeneRechnungen(z.stand.unterlagen).filter((u) => !form.rechnungenBar.some((r) => r.id === u.id)), [z.stand.unterlagen, form.rechnungenBar]);

  // Bestand vor dem Tag (ohne diesen Abschluss), Barbelege des Tages
  const andere = z.stand.kasse.filter((k) => k.id !== id);
  const standort = form.standort.trim();
  const vorher = kassenVerlauf(andere.filter((k) => k.datum < form.datum || (k.datum === form.datum && k.erstellt < (alt?.erstellt ?? "9"))), z.stand.belege.filter((b) => (b.bezahlt || b.datum) < form.datum), standort);
  const bestand = bestandVor(vorher, form.datum) ?? (vorher.tage.length ? vorher.tage[vorher.tage.length - 1]!.ende : null);
  const ersterTag = bestand === null;
  const barbelege = z.stand.belege.filter((b) => !b.ungueltig && b.zahlung === "bar" && (b.bezahlt || b.datum) === form.datum && !standort);
  const ausgaben = barbelege.reduce((a, b) => a + belegGezahlt(b), 0);
  const bew = (art: KassenBewegungsArt) => form.bewegungen.filter((b) => b.art === art).reduce((a, b) => a + (c(b.betrag) ?? 0), 0);
  const anfang = ersterTag ? (c(form.anfang) ?? 0) : (bestand ?? 0);

  const karte = c(form.karte) ?? 0;
  const trinkgeld = c(form.trinkgeld) ?? 0;
  const app = c(form.app) ?? 0;
  const aufrechnung = c(form.aufrechnung) ?? 0;
  const sonstige = c(form.sonstige) ?? 0;
  const rechnungenBar: BarRechnung[] = form.rechnungenBar.map((r) => ({ id: r.id, nummer: r.nummer, betrag_cent: c(r.betrag) ?? 0 })).filter((r) => r.betrag_cent > 0);
  const rechnungen = rechnungenBar.length ? rechnungenBar.reduce((a, r) => a + r.betrag_cent, 0) : (c(form.rechnungen) ?? 0);
  const gutscheine: KassenGutschein[] = form.gutscheine.map((g): KassenGutschein => ({ vorgang: g.vorgang, art: g.art, betrag_cent: c(g.betrag) ?? 0, ...(g.art === "einzweck" ? { satz: ku ? 0 : Number(g.satz) } : {}) })).filter((g) => g.betrag_cent > 0);
  const gs = (vorgang: KassenGutschein["vorgang"]) => gutscheine.filter((g) => g.vorgang === vorgang).reduce((a, g) => a + g.betrag_cent, 0);
  const gezaehlt = form.gezaehlt.trim() ? cent(form.gezaehlt) : null;
  // Kassenbericht: Bareinnahmen retrograd; Umsatz = bar + unbar − Gutscheinverkauf + Gutscheineinlösung; 19 % = Rest
  const barBericht = form.kassenbericht && gezaehlt !== null ? retrogradeBareinnahmen({ anfang, gezaehlt, ausgaben, entnahmen: bew("entnahme"), transit: bew("transit") + trinkgeld, einlagen: bew("einlage") }) - rechnungen : 0;
  const u7 = c(form.u7) ?? 0;
  const u0 = c(form.u0) ?? 0;
  const u19 = form.kassenbericht ? barBericht + (karte - trinkgeld) + app + aufrechnung + sonstige - gs("verkauf") + gs("einloesung") - u7 - u0 : (c(form.u19) ?? 0);
  const inhalt: KassenInhalt = {
    datum: form.datum,
    ...(form.geschlossen ? { geschlossen: true } : {}),
    zbon: form.zbon.trim() || null,
    umsatz: form.geschlossen ? [] : ku ? [{ satz: 0, brutto_cent: u19 + u7 + u0 }].filter((u) => u.brutto_cent) : [{ satz: 19, brutto_cent: u19 }, { satz: 7, brutto_cent: u7 }, { satz: 0, brutto_cent: u0 }].filter((u) => u.brutto_cent),
    karte_cent: form.geschlossen ? 0 : karte,
    sonstige_cent: form.geschlossen ? 0 : sonstige,
    ...(trinkgeld && !form.geschlossen ? { trinkgeld_cent: trinkgeld } : {}),
    ...(app && !form.geschlossen ? { app_cent: app } : {}),
    ...(aufrechnung && !form.geschlossen ? { aufrechnung_cent: aufrechnung } : {}),
    ...(gutscheine.length && !form.geschlossen ? { gutscheine } : {}),
    ...(rechnungenBar.length ? { rechnungen_bar: rechnungenBar } : {}),
    ...(rechnungen ? { rechnungen_cent: rechnungen } : {}),
    bewegungen: form.bewegungen.map((b): KassenBewegung | null => (c(b.betrag) ? { art: b.art, betrag_cent: c(b.betrag)!, ...(b.text.trim() ? { text: b.text.trim() } : {}), ...(b.beleg_nr ? { beleg_nr: b.beleg_nr } : {}), ...(b.datei ? { datei: b.datei } : {}) } : null)).filter((b): b is KassenBewegung => b !== null),
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
    ...(form.nacherfasst_grund.trim() ? { nacherfasst_grund: form.nacherfasst_grund.trim() } : {}),
  };
  const s = kassenSummen(inhalt);
  const soll = anfang + s.einlagen + s.bar + s.rechnungen - ausgaben - s.entnahmen - s.transit - s.trinkgeld;
  const fehlerListe = kassenFehler(inhalt, alt ? undefined : tag);
  const betragFalsch = [form.u19, form.u7, form.u0, form.karte, form.trinkgeld, form.app, form.aufrechnung, form.sonstige, form.rechnungen, form.anfang, form.gezaehlt, ...form.bewegungen.map((b) => b.betrag), ...form.gutscheine.map((g) => g.betrag), ...form.rechnungenBar.map((r) => r.betrag)].some(falsch);

  const speichern = async () => {
    setFehler(null);
    if (betragFalsch) return setFehler(TEXT.betrag_falsch);
    if (fehlerListe.includes("zukunft")) return setFehler(TEXT.r12g_zukunft);
    if (fehlerListe.includes("trinkgeld_zu_hoch")) return setFehler(TEXT.r12g_trinkgeld_zu_hoch);
    if (fehlerListe.includes("unbar_zu_hoch")) return setFehler(TEXT.r12_unbar_zu_hoch);
    if (fehlerListe.includes("gutschein_zu_hoch")) return setFehler(TEXT.r12g_gutschein_zu_hoch);
    if (form.kassenbericht && !form.geschlossen && gezaehlt === null) return setFehler(TEXT.r12_gezaehlt_pflicht);
    if (alt && !grund.trim()) return setFehler(TEXT.r12_grund_fehlt);
    if (alt && !grundGenuegt(grund)) return setFehler(TEXT.r12g_grund_kurz);
    if (!alt && nachTage && !grundGenuegt(form.nacherfasst_grund)) return setFehler(TEXT.r12g_nacherfasst_fehlt);
    // kein negativer Bestand (§ 146 Abs. 1 Satz 2 AO) – nur nach ausdrücklicher Bestätigung
    if (soll < 0 && !(await bestaetigen({ titel: TEXT.r12_negativ_frage_titel, text: TEXT.r12_negativ_frage(euro(soll)), ja: TEXT.r12_trotzdem }))) return;
    if (!alt && andere.some((k) => k.datum === form.datum && standortVon(k) === standort) && !(await bestaetigen({ titel: TEXT.r12_schon_da(datumDe(form.datum)), ja: TEXT.r12_trotzdem }))) return;
    if (alt) {
      if (!kassenInhaltGeaendert(alt, inhalt)) {
        melden(TEXT.r12_unveraendert, "info");
        return setKorrektur(false);
      }
      z.kasseKorrigieren(alt.id, inhalt, grund);
      melden(vaZeitraum ? TEXT.r12g_va_berichtigen(vaZeitraum) : TEXT.r12_korrigiert_meldung, vaZeitraum ? "info" : undefined);
      setKorrektur(false);
      setGrund("");
      return;
    }
    z.kasseSpeichern(inhalt);
    melden(TEXT.r12_gespeichert(datumDe(form.datum), euro(s.brutto)));
    z.erfolg();
    nav.zurueck();
  };
  const dateiHolen = async (kamera: boolean) => {
    const bytes = kamera ? await belegFoto(true) : (await dateiWaehlenBytes(["image/*", "application/pdf"]))?.bytes;
    return bytes ? z.dateiSpeichern(bytes, kamera ? "jpg" : "pdf") : null;
  };
  const foto = async (kamera: boolean, bewegung?: number) => {
    try {
      const name = await dateiHolen(kamera);
      if (!name) return;
      if (bewegung === undefined) setze({ datei: name });
      else setForm((x) => ({ ...x, bewegungen: x.bewegungen.map((b, j) => (j === bewegung ? { ...b, datei: name } : b)) }));
    } catch {
      melden(TEXT.beleg_fehler, "info");
    }
  };
  const betragFeld = (label: string, wert: string, aendern: (w: string) => void, hilfe?: string) => <Feld label={label} hilfe={hilfe} wert={wert} aendern={aendern} keyboardType="decimal-pad" placeholder="0,00" editable={!nurLesen} fehler={falsch(wert) ? TEXT.betrag_falsch : null} />;
  const weitere = [form.zbon && form.kassenbericht, form.app, form.aufrechnung, form.gutscheine.length, form.rechnungen, form.rechnungenBar.length, form.u0, form.tse_seriennr, form.tse_von, form.tse_bis, form.bediener, form.standort, form.notiz].filter(Boolean).length;
  const setGutschein = (i: number, w: Partial<GutscheinForm>) => setze({ gutscheine: form.gutscheine.map((x, j) => (j === i ? { ...x, ...w } : x)) });

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
      {/* R12 GoBD: Erfassung und Festschreibung sichtbar, Nacherfassung gekennzeichnet */}
      {alt ? <T v="klein" leise stil={{ marginTop: 4 }}>{TEXT.r12g_erfasst(zeitDe(alt.erstellt), alt.festgeschrieben ? zeitDe(alt.festgeschrieben) : null)}</T> : null}
      {alt && nachTage ? <Hinweis art="warnung" symbol="clock" text={TEXT.r12g_nacherfasst_kurz(nachTage, alt.nacherfasst_grund ?? null)} /> : null}
      {vaZeitraum ? <Hinweis art="warnung" text={TEXT.r12g_va_berichtigen(vaZeitraum)} /> : null}
      {korrektur ? <Feld label={TEXT.r12_grund} hilfe={TEXT.r12_grund_hilfe} wert={grund} aendern={setGrund} fehler={grund.trim() && !grundGenuegt(grund) ? TEXT.r12g_grund_kurz : null} /> : null}
      {alt ? null : <DatumFeld label={TEXT.r12_datum} wert={form.datum} aendern={(d) => d && setze({ datum: d })} />}
      {!alt && fehlerListe.includes("zukunft") ? <Hinweis art="fehler" text={TEXT.r12g_zukunft} /> : null}
      {!alt && nachTage ? (
        <View>
          <Hinweis art="warnung" symbol="clock" text={TEXT.r12g_nacherfasst(nachTage)} />
          <Feld label={TEXT.r12g_nacherfasst_grund} hilfe={TEXT.r12g_nacherfasst_hilfe} wert={form.nacherfasst_grund} aendern={(w) => setze({ nacherfasst_grund: w })} />
        </View>
      ) : null}
      {nurLesen ? null : <Schalter label={form.datum === tag ? TEXT.r12g_geschlossen_heute : TEXT.r12g_geschlossen_tag} wert={form.geschlossen} aendern={(w) => setze({ geschlossen: w })} />}
      {form.geschlossen ? null : (
        <View>
          {/* R12 GoBD: Kassenbericht (retrograd) nur bei offener Ladenkasse laut Check – bei elektronischer Kasse nie */}
          {nurLesen || !offen ? null : <Schalter label={TEXT.r12_kassenbericht_schalter} hilfe={TEXT.r12_kassenbericht_hilfe} wert={form.kassenbericht} aendern={(w) => setze({ kassenbericht: w })} />}
          {form.kassenbericht && !offen ? <Hinweis text={TEXT.r12g_kassenbericht_nur_offen} /> : null}
          {form.kassenbericht ? (
            <View>
              {ersterTag ? betragFeld(TEXT.r12_anfang, form.anfang, (w) => setze({ anfang: w }), TEXT.r12_anfang_hilfe) : <T v="klein" leise stil={{ marginTop: 14 }}>{TEXT.r12_anfang_auto(euro(anfang))}</T>}
              {betragFeld(TEXT.r12_gezaehlt_pflicht, form.gezaehlt, (w) => setze({ gezaehlt: w }))}
              {betragFeld(TEXT.r12_karte_feld, form.karte, (w) => setze({ karte: w }), TEXT.r12_karte_hilfe)}
              {karte || form.trinkgeld ? betragFeld(TEXT.r12g_trinkgeld, form.trinkgeld, (w) => setze({ trinkgeld: w }), TEXT.r12g_trinkgeld_hilfe) : null}
              {ku ? null : betragFeld(TEXT.r12_kassenbericht_7, form.u7, (w) => setze({ u7: w }), TEXT.r12_kassenbericht_7_hilfe)}
              <T v="klein" stil={{ marginTop: 10 }}>{`${TEXT.r12_kassenbericht_bar}: ${euro(barBericht)}`}</T>
            </View>
          ) : (
            <View>
              {betragFeld(ku ? TEXT.r12_umsatz_ku : TEXT.r12_umsatz_19, form.u19, (w) => setze({ u19: w }), TEXT.r12_umsatz_hilfe)}
              {ku ? null : betragFeld(TEXT.r12_umsatz_7, form.u7, (w) => setze({ u7: w }))}
              {betragFeld(TEXT.r12_karte_feld, form.karte, (w) => setze({ karte: w }), TEXT.r12_karte_hilfe)}
              {karte || form.trinkgeld ? betragFeld(TEXT.r12g_trinkgeld, form.trinkgeld, (w) => setze({ trinkgeld: w }), TEXT.r12g_trinkgeld_hilfe) : null}
              <Feld label={TEXT.r12_zbon} hilfe={TEXT.r12_zbon_hilfe} wert={form.zbon} aendern={(w) => setze({ zbon: w })} keyboardType="number-pad" editable={!nurLesen} />
            </View>
          )}
          <Karte stil={{ marginTop: 14, paddingVertical: 10, gap: 4 }}>
            <T fett>{TEXT.r12_bar_ergebnis(euro(s.bar))}</T>
            {fehlerListe.includes("unbar_zu_hoch") ? <T v="klein" farbe={f.frist}>{TEXT.r12_unbar_zu_hoch}</T> : null}
            {fehlerListe.includes("trinkgeld_zu_hoch") ? <T v="klein" farbe={f.frist}>{TEXT.r12g_trinkgeld_zu_hoch}</T> : null}
            {fehlerListe.includes("gutschein_zu_hoch") ? <T v="klein" farbe={f.frist}>{TEXT.r12g_gutschein_zu_hoch}</T> : null}
            {barbelege.length ? <T v="klein" leise>{TEXT.r12_belege_tag(barbelege.length, barbelege.map((b) => `${b.lieferant.trim() || nummern.get(b.id)} ${euro(belegGezahlt(b))}`).join(", "))}</T> : null}
            <T v="klein" farbe={soll < 0 ? f.frist : undefined} leise={soll >= 0}>{TEXT.r12_soll(euro(soll))}</T>
            {gezaehlt !== null && !form.kassenbericht && gezaehlt !== soll ? <T v="klein" leise>{TEXT.r12_differenz(euro(gezaehlt - soll))}</T> : null}
          </Karte>
        </View>
      )}
      {/* Geld rein oder raus: Bank, Privatentnahme, Einlage – mit Eigenbeleg-Nummer und Foto der Quittung */}
      <View style={{ marginTop: 14 }}>
        {form.bewegungen.length ? <T v="klein" fett accessibilityRole="header">{TEXT.r12_bewegungen}</T> : null}
        {form.bewegungen.map((b, i) => (
          <Karte key={i} stil={{ marginTop: 8, paddingVertical: 8 }}>
            <T v="caption" leise>{b.beleg_nr ? TEXT.r12g_eigenbeleg(b.beleg_nr) : TEXT.r12g_eigenbeleg_neu}</T>
            <Wahl label={TEXT.r12_bewegung_art} wert={b.art} aendern={(w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, art: w } : x)) })} optionen={KASSEN_BEWEGUNGEN} />
            {betragFeld(TEXT.r12_bewegung_betrag, b.betrag, (w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, betrag: w } : x)) }))}
            <Feld label={TEXT.r12_bewegung_text} wert={b.text} aendern={(w) => setze({ bewegungen: form.bewegungen.map((x, j) => (j === i ? { ...x, text: w } : x)) })} editable={!nurLesen} />
            {b.datei ? <T v="klein" leise stil={{ marginTop: 6 }}>{TEXT.r12g_bewegung_foto_da}</T> : nurLesen ? null : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {istIos ? <TextKnopf symbol="camera" text={TEXT.r12g_bewegung_foto} onPress={() => void foto(true, i)} /> : null}
                <TextKnopf symbol="doc" text={TEXT.r12g_bewegung_datei} onPress={() => void foto(false, i)} />
              </View>
            )}
            {nurLesen || b.beleg_nr ? null : <TextKnopf symbol="xmark" leise text={TEXT.entfernen} label={TEXT.r12_bewegung_entfernen(KASSEN_BEWEGUNGEN.find((x) => x.wert === b.art)!.text)} onPress={() => { weich(); setze({ bewegungen: form.bewegungen.filter((_, j) => j !== i) }); }} />}
          </Karte>
        ))}
        {nurLesen ? null : <TextKnopf symbol="plus" text={TEXT.r12_bewegung_neu} onPress={() => { weich(); setze({ bewegungen: [...form.bewegungen, { art: "transit", betrag: "", text: "", beleg_nr: null, datei: null }] }); }} />}
      </View>
      {form.kassenbericht || form.geschlossen ? null : ersterTag ? betragFeld(TEXT.r12_anfang, form.anfang, (w) => setze({ anfang: w }), TEXT.r12_anfang_hilfe) : null}
      {form.kassenbericht || form.geschlossen ? null : betragFeld(TEXT.r12_gezaehlt, form.gezaehlt, (w) => setze({ gezaehlt: w }), TEXT.r12_gezaehlt_hilfe)}
      {/* R12 (Bäckerei #3): Betriebsstätte aus „Mein Betrieb“ statt freiem Text – gespeichert wird weiter der Name */}
      {z.stand.betriebsstaetten.length && !alt ? <KassenStaette wert={form.standort} aendern={(w) => setze({ standort: w })} /> : null}
      {/* Foto des Z-Bons als Beleg (verschlüsselt wie Belegdateien) – nur bei elektronischer Kasse, sonst des Kassenberichts */}
      {form.datei ? <Hinweis art="erfolg" text={TEXT.r12_foto_da} /> : nurLesen || form.kassenbericht ? null : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {istIos ? <TextKnopf symbol="camera" text={TEXT.r12_foto} onPress={() => void foto(true)} /> : null}
          <TextKnopf symbol="doc" text={TEXT.r12_foto_datei} onPress={() => void foto(false)} />
        </View>
      )}
      {mehr || weitere || nurLesen ? (
        <View>
          {form.kassenbericht ? <Feld label={TEXT.r12_zbon} hilfe={TEXT.r12_zbon_hilfe} wert={form.zbon} aendern={(w) => setze({ zbon: w })} editable={!nurLesen} /> : null}
          {form.geschlossen ? null : betragFeld(TEXT.r12g_app, form.app, (w) => setze({ app: w }))}
          {form.geschlossen ? null : betragFeld(TEXT.r12g_aufrechnung, form.aufrechnung, (w) => setze({ aufrechnung: w }), TEXT.r12g_aufrechnung_hilfe)}
          {form.geschlossen || !form.sonstige ? null : betragFeld(TEXT.r12g_sonstige_alt, form.sonstige, (w) => setze({ sonstige: w }), TEXT.r12_sonstige_hilfe)}
          {form.geschlossen || form.kassenbericht || ku ? null : betragFeld(TEXT.r12_umsatz_0, form.u0, (w) => setze({ u0: w }))}
          {form.geschlossen ? null : (
            <View style={{ marginTop: 16 }}>
              <T v="klein" fett accessibilityRole="header">{TEXT.r12g_gutscheine}</T>
              <T v="caption" leise>{TEXT.r12g_gutschein_hilfe}</T>
              {form.gutscheine.map((g, i) => (
                <Karte key={i} stil={{ marginTop: 8, paddingVertical: 8 }}>
                  <Wahl label={TEXT.r12g_gutschein_vorgang} wert={g.vorgang} aendern={(w) => setGutschein(i, { vorgang: w })} optionen={[{ wert: "verkauf", text: TEXT.r12g_gutschein_verkauf }, { wert: "einloesung", text: TEXT.r12g_gutschein_einloesung }]} />
                  <Wahl label={TEXT.r12g_gutschein_art} wert={g.art} aendern={(w) => setGutschein(i, { art: w })} optionen={[{ wert: "einzweck", text: TEXT.r12g_einzweck }, { wert: "mehrzweck", text: TEXT.r12g_mehrzweck }]} />
                  {g.art === "einzweck" && !ku ? <Wahl label={TEXT.r12g_gutschein_satz} wert={g.satz} aendern={(w) => setGutschein(i, { satz: w })} optionen={[{ wert: "19", text: "19 %" }, { wert: "7", text: "7 %" }]} /> : null}
                  {betragFeld(TEXT.r12_bewegung_betrag, g.betrag, (w) => setGutschein(i, { betrag: w }))}
                  {nurLesen ? null : <TextKnopf symbol="xmark" leise text={TEXT.entfernen} label={TEXT.r12g_gutschein_entfernen} onPress={() => setze({ gutscheine: form.gutscheine.filter((_, j) => j !== i) })} />}
                </Karte>
              ))}
              {nurLesen ? null : <TextKnopf symbol="plus" text={TEXT.r12g_gutschein_neu} onPress={() => setze({ gutscheine: [...form.gutscheine, { vorgang: "verkauf", art: "mehrzweck", satz: "19", betrag: "" }] })} />}
            </View>
          )}
          {/* R12 GoBD: bar kassierte Rechnungen aus Amtlos wählen statt eines freien Betrags */}
          <View style={{ marginTop: 16 }}>
            <T v="klein" fett accessibilityRole="header">{TEXT.r12g_rechnungen_titel}</T>
            <T v="caption" leise>{TEXT.r12g_rechnung_wahl_hilfe}</T>
            {form.rechnungenBar.map((r, i) => (
              <Karte key={r.id} stil={{ marginTop: 8, paddingVertical: 8 }}>
                <T fett>{`RE ${r.nummer}`}</T>
                {betragFeld(TEXT.r12_bewegung_betrag, r.betrag, (w) => setze({ rechnungenBar: form.rechnungenBar.map((x, j) => (j === i ? { ...x, betrag: w } : x)) }))}
                {nurLesen ? null : <TextKnopf symbol="xmark" leise text={TEXT.entfernen} onPress={() => setze({ rechnungenBar: form.rechnungenBar.filter((_, j) => j !== i) })} />}
              </Karte>
            ))}
            {nurLesen ? null : offeneRe.length ? (
              <Wahl label={TEXT.r12g_rechnung_neu} wert={null} aendern={(rid: string) => {
                const u = offeneRe.find((x) => x.id === rid);
                if (u) setze({ rechnungenBar: [...form.rechnungenBar, { id: u.id, nummer: String(u.daten.nummer ?? ""), betrag: feld(offenerBetrag(z.stand, u)) }] });
              }} optionen={offeneRe.slice(0, 12).map((u) => ({ wert: u.id, text: TEXT.r12g_rechnung_zeile(String(u.daten.nummer ?? ""), String(u.daten.kunde_name ?? ""), euro(offenerBetrag(z.stand, u))) }))} />
            ) : !form.rechnungenBar.length ? <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.r12g_keine_offenen}</T> : null}
            {form.rechnungen ? betragFeld(TEXT.r12_rechnungen_feld, form.rechnungen, (w) => setze({ rechnungen: w }), TEXT.r12_rechnungen_hilfe) : null}
          </View>
          <T v="klein" fett stil={{ marginTop: 16 }} accessibilityRole="header">{TEXT.r12_tse}</T>
          <Feld label={TEXT.r12_tse_serie} wert={form.tse_seriennr} aendern={(w) => setze({ tse_seriennr: w })} editable={!nurLesen} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}><Feld label={TEXT.r12_tse_von} wert={form.tse_von} aendern={(w) => setze({ tse_von: w })} editable={!nurLesen} /></View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}><Feld label={TEXT.r12_tse_bis} wert={form.tse_bis} aendern={(w) => setze({ tse_bis: w })} editable={!nurLesen} /></View>
          </View>
          <Feld label={TEXT.r12_bediener} hilfe={TEXT.r12_bediener_hilfe} wert={form.bediener} aendern={(w) => setze({ bediener: w })} editable={!nurLesen} />
          {z.stand.betriebsstaetten.length && !alt ? null : <Feld label={TEXT.r12_standort} hilfe={TEXT.r12_standort_hilfe} wert={form.standort} aendern={(w) => setze({ standort: w })} editable={!nurLesen && !alt} />}
          <Feld label={TEXT.r12_notiz} wert={form.notiz} aendern={(w) => setze({ notiz: w })} mehrzeilig editable={!nurLesen} />
        </View>
      ) : (
        <TextKnopf symbol="chevron.down" text={TEXT.weitere_angaben(11)} erweitert={false} onPress={() => { weich(); setMehr(true); }} />
      )}
      {alt?.historie?.length ? (
        <Gruppe titel={TEXT.r12_historie}>
          <Karte stil={{ paddingVertical: 8, gap: 6 }}>
            {[...alt.historie].reverse().map((h) => (
              <T key={`${h.bis}${h.grund}`} v="klein">{TEXT.r12_historie_zeile(zeitDe(h.bis), h.grund, euro(kassenSummen(h).brutto))}</T>
            ))}
          </Karte>
        </Gruppe>
      ) : null}
    </BuehnenBlatt>
  );
}

/** R12 GoBD: Kassensturz mit Zählprotokoll (z. B. bei einer Kassennachschau) – Zeitpunkt, Stückelung, Bezug zum Vortag. */
function KassensturzSeite() {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const [stueck, setStueck] = useState(false);
  const [anzahl, setAnzahl] = useState<Record<string, string>>({});
  const [summe, setSumme] = useState("");
  const [anwesend, setAnwesend] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const v = kassenVerlauf(z.stand.kasse, z.stand.belege);
  const letzter = v.tage[v.tage.length - 1];
  const stueckelung = Object.fromEntries(Object.entries(anzahl).map(([w, n]) => [w, Number(n.trim())]).filter(([, n]) => Number.isInteger(n) && (n as number) > 0)) as Record<string, number>;
  const gezaehlt = stueck ? stueckelungSumme(stueckelung) : (summe.trim() ? cent(summe) : null);
  const wertText = (w: number) => (w >= 100 ? `${w / 100} €` : `${w} ct`);
  const speichern = () => {
    if (gezaehlt === null || gezaehlt < 0) return setFehler(TEXT.betrag_falsch);
    z.kassensturzSpeichern({ gezaehlt_cent: gezaehlt, ...(stueck ? { stueckelung } : {}), ...(letzter ? { vortag_cent: letzter.ende } : {}), ...(anwesend.trim() ? { anwesend: anwesend.trim() } : {}), ...(notiz.trim() ? { notiz: notiz.trim() } : {}) });
    melden(TEXT.r12g_kassensturz_gespeichert(euro(gezaehlt)));
    nav.zurueck();
  };
  return (
    <BuehnenBlatt
      titel={TEXT.r12g_kassensturz_titel}
      unter={TEXT.r12g_kassensturz_unter}
      fuss={
        <Fuss ueber={fehler ? <T v="klein">{fehler}</T> : undefined}>
          <Knopf symbol="checkmark" text={TEXT.r12g_kassensturz_speichern} onPress={speichern} stil={{ flex: 1 }} />
        </Fuss>
      }
    >
      {letzter ? <Hinweis text={TEXT.r12g_vortag(euro(letzter.ende), datumDe(letzter.datum))} /> : null}
      <Schalter label={TEXT.r12g_stueckelung} hilfe={TEXT.r12g_stueckelung_hilfe} wert={stueck} aendern={setStueck} />
      {stueck ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {STUECKELUNG.map((w) => (
            <View key={w} style={{ flexGrow: 1, flexBasis: 96 }}>
              <Feld label={TEXT.r12g_stueck(wertText(w))} wert={anzahl[String(w)] ?? ""} aendern={(t) => setAnzahl((x) => ({ ...x, [String(w)]: t.replace(/\D/g, "") }))} keyboardType="number-pad" placeholder="0" />
            </View>
          ))}
        </View>
      ) : (
        <Feld label={TEXT.r12g_gezaehlt_summe} wert={summe} aendern={setSumme} keyboardType="decimal-pad" placeholder="0,00" fehler={falsch(summe) ? TEXT.betrag_falsch : null} />
      )}
      <Karte stil={{ marginTop: 14, paddingVertical: 10 }}>
        <T fett>{`${TEXT.r12g_gezaehlt_summe}: ${euro(gezaehlt ?? 0)}`}</T>
      </Karte>
      <Feld label={TEXT.r12g_anwesend} hilfe={TEXT.r12g_anwesend_hilfe} wert={anwesend} aendern={setAnwesend} />
      <Feld label={TEXT.r12_notiz} wert={notiz} aendern={setNotiz} mehrzeilig />
      {z.stand.kassenstuerze.length ? (
        <Gruppe titel={TEXT.r12g_kassenstuerze}>
          <Karte stil={{ paddingVertical: 8, gap: 6 }}>
            {[...z.stand.kassenstuerze].reverse().slice(0, 5).map((k) => <T key={k.id} v="klein">{TEXT.r12g_kassensturz_zeile(zeitDe(k.zeitpunkt), euro(k.gezaehlt_cent))}</T>)}
          </Karte>
        </Gruppe>
      ) : null}
    </BuehnenBlatt>
  );
}

/** R12 GoBD: Sachentnahmen (unentgeltliche Wertabgaben) – Beträge laut BMF-Pauschbeträgen selbst eingetragen. */
function SachentnahmenSeite() {
  const z = useAmtlos();
  const melden = useMeldung();
  const jahr = heute().slice(0, 4);
  const [datum, setDatum] = useState(`${jahr}-12-31`);
  const [n7, setN7] = useState("");
  const [n19, setN19] = useState("");
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = () => {
    setFehler(null);
    if (falsch(n7) || falsch(n19)) return setFehler(TEXT.betrag_falsch);
    if (!c(n7) && !c(n19)) return setFehler(TEXT.r12g_se_leer);
    z.sachentnahmeSpeichern({ datum, netto7_cent: c(n7) ?? 0, netto19_cent: c(n19) ?? 0, ...(text.trim() ? { text: text.trim() } : {}) });
    setN7("");
    setN19("");
    setText("");
    melden(TEXT.r12g_se_gespeichert);
  };
  return (
    <BuehnenBlatt
      titel={TEXT.r12g_sachentnahme_titel}
      unter={TEXT.r12g_sachentnahme_unter}
      fuss={
        <Fuss ueber={fehler ? <T v="klein">{fehler}</T> : undefined}>
          <Knopf symbol="checkmark" text={TEXT.r12g_se_speichern} onPress={speichern} stil={{ flex: 1 }} />
        </Fuss>
      }
    >
      <Hinweis text={TEXT.r12g_sachentnahme_hinweis} />
      <DatumFeld label={TEXT.r12g_se_datum} wert={datum} aendern={(d) => d && setDatum(d)} />
      <Feld label={TEXT.r12g_se_7} wert={n7} aendern={setN7} keyboardType="decimal-pad" placeholder="0,00" fehler={falsch(n7) ? TEXT.betrag_falsch : null} />
      <Feld label={TEXT.r12g_se_19} wert={n19} aendern={setN19} keyboardType="decimal-pad" placeholder="0,00" fehler={falsch(n19) ? TEXT.betrag_falsch : null} />
      <Feld label={TEXT.r12g_se_text} hilfe={TEXT.r12g_se_text_hilfe} wert={text} aendern={setText} />
      {z.stand.sachentnahmen.length ? (
        <Gruppe titel={TEXT.r12g_sachentnahmen}>
          <Karte>
            {[...z.stand.sachentnahmen].reverse().map((e, i, l) => (
              <Zeile key={e.id} symbol="cup.and.saucer" titel={`${datumDe(e.datum)}${e.text ? ` · ${e.text}` : ""}`} text={TEXT.r12g_se_zeile(euro(e.netto7_cent), euro(e.netto19_cent))} onPress={() => void bestaetigen({ titel: TEXT.r12g_se_loeschen, text: TEXT.r12g_se_loeschen_frage, ja: TEXT.loeschen_ja }).then((ok) => ok && z.sachentnahmeLoeschen(e.id))} letzte={i === l.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
    </BuehnenBlatt>
  );
}

/**
 * R12 (Bäckerei #3): Standort einer Kasse aus den Betriebsstätten wählen. Gespeichert wird wie bisher der Name (leer =
 * Betrieb), damit ältere Abschlüsse mit frei eingetragenem Standort gültig bleiben.
 */
function KassenStaette({ wert, aendern }: { wert: string; aendern: (name: string) => void }) {
  const z = useAmtlos();
  const l = alleStaetten(z.stand);
  const gewaehlt = l.find((x, i) => (i === 0 ? !wert.trim() || x.name === wert.trim() : x.name.toLocaleLowerCase("de") === wert.trim().toLocaleLowerCase("de")));
  return <Wahl label={TEXT.r12p_staette_label} hilfe={TEXT.r12p_kasse_staette_hilfe} wert={gewaehlt?.id ?? null} aendern={(id) => aendern(id === HAUPT_STAETTE ? "" : (l.find((x) => x.id === id)?.name ?? ""))} optionen={l.map((x) => ({ wert: x.id, text: x.name }))} />;
}
