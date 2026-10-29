/**
 * E-239: Ergebnis der Übernahme „Aus Rechnungen übernehmen“ (Umsatzsteuer-Voranmeldung) bzw. „Aus Rechnungen übernehmen“
 * der OSS-Erklärung und der Zusammenfassenden Meldung in Stufen (ui/hinweisStufen.ts). Die Texte sind dieselben wie
 * vorher; neu ist nur, welche sofort stehen:
 * - Blocker: Voranmeldung als Kleinunternehmer (§ 18 Abs. 4a UStG), Berichtigungen, „Schlussrechnung fehlt – trotzdem
 *   melden“, Belege ohne Euro-Betrag, fehlende Kassenumsätze, Sondervorauszahlung im Dezember, Rechnungen mit Steuer im
 *   Kleinunternehmer-Zeitraum, Uneinbringlichkeit im Kleinunternehmer-Zeitraum;
 * - Hinweise: was nicht mitzählt oder zu prüfen ist (offene Rechnungen, Gutschriften, Zeitraum statt Datum, OSS, Stornos
 *   in anderen Zeiträumen, Vorsteuer aufteilen, Erwerbe unter der Schwelle);
 * - Erklärungen: was übernommen ist (Vorsteuer, Kasse, Skonti, § 13b, Erwerbe, Dauerfristverlängerung, zugeordnete Nummern).
 */
import { VORSTEUER_AUFTEILEN } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { blocker, hinweis, info, ordnen, type Geordnet } from "../ui/hinweisStufen";
import { periodeText, type EuBerichtigung, type EuSchlussFehlt, type UstUebernahme } from "../unterlagen/ustAusRechnungen";

const BETRAG_DE = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumDe = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** E-235: Warnung „Schlussrechnung fehlt – trotzdem melden“ (§ 18b Satz 2 bzw. 3 UStG) */
export const schlussFehltText = (x: EuSchlussFehlt) => TEXT.e235_schluss_fehlt(x.art, x.nummer, x.kunde, datumDe(x.leistung), `${periodeText(x.monat)} bzw. ${periodeText(x.quartal)}`, BETRAG_DE.format(x.anzahlungNetto / 100));

/** E-214: je ursprünglichem Zeitraum ein Satz „Storno … zählt als Berichtigung in …“ */
export function anderswoTexte(l: EuBerichtigung[]): string[] {
  const je = new Map<string, string[]>();
  for (const b of l) {
    const z = `${periodeText(b.monat)} bzw. ${periodeText(b.quartal)}`;
    je.set(z, [...(je.get(z) ?? []), b.stornoNr]);
  }
  return [...je].map(([z, nr]) => TEXT.e214_va_anderswo(nr, z));
}

/** Ergebniszeile der Übernahme (Stand, keine Warnung) – bei Kleinunternehmern mit Voranmeldungspflicht keine (Blocker). */
export function ustErgebnis(r: UstUebernahme): string | null {
  if (r.kleinunternehmer) return r.kuVoranmeldungPflicht ? null : r.steuerschuldBelege ? TEXT.ust_ku_13b : TEXT.aus_rechnungen_ku;
  return TEXT.aus_rechnungen_ok(r.anzahl);
}

/** Meldungen der Übernahme in Stufen. `kasse`: Kassenhinweis (kassenHinweisMit), `dfv`: Dauerfristverlängerung laut Check, `dezember`: Zeitraum endet im Dezember. */
export function ustMeldungen(r: UstUebernahme, o: { kasse: { text: string; warnung: boolean } | null; dfv: boolean; dezember: boolean }): Geordnet {
  const dfv = !r.kleinunternehmer && o.dfv;
  return ordnen([
    r.kleinunternehmer && r.kuVoranmeldungPflicht ? blocker(TEXT.e227_ku_va_pflicht) : null,
    r.kuGemischt ? blocker(TEXT.ust_ku_gemischt) : null,
    r.uneinbringlichNicht.length ? blocker(TEXT.e229_uneinbringlich_ku(r.uneinbringlichNicht.length)) : null,
    o.kasse ? (o.kasse.warnung ? blocker(o.kasse.text, { symbol: "banknote" }) : info(o.kasse.text, { symbol: "banknote" })) : null,
    r.berichtigungen.length ? blocker(TEXT.e214_va_berichtigung(r.berichtigungen.map((b) => b.stornoNr))) : null,
    ...r.schlussFehlt.map((x) => blocker(schlussFehltText(x))),
    r.igeOhneEuro ? blocker(TEXT.e224_ige_ohne_euro(r.igeOhneEuro)) : null,
    r.rcOhneEuro ? blocker(TEXT.e224_13b_ohne_euro(r.rcOhneEuro)) : null,
    dfv && o.dezember ? blocker(TEXT.ust_sondervorauszahlung) : null,
    r.offen ? hinweis(TEXT.aus_rechnungen_offen(r.offen)) : null,
    r.gutschriften ? hinweis(TEXT.aus_rechnungen_gutschriften(r.gutschriften)) : null,
    r.ersatz ? hinweis(TEXT.aus_rechnungen_ersatz(r.ersatz)) : null,
    r.oss ? hinweis(TEXT.stb_oss_nicht_va(r.oss)) : null,
    ...anderswoTexte(r.berichtigungenAnderswo).map((t) => hinweis(t)),
    r.vorsteuerPruefen ? hinweis(VORSTEUER_AUFTEILEN) : null,
    r.igeKu ? hinweis(TEXT.e227_ige_nicht(r.igeKu, r.erwerbsschwelle?.status !== "nein")) : null,
    r.kasseTage ? info(TEXT.r12_kasse_uebernommen(r.kasseTage)) : null,
    r.minderungen ? info(TEXT.r12_minderungen(r.minderungen)) : null,
    r.ersatzNummern.length ? info(TEXT.stb_ersatz_nummern(r.ersatzNummern)) : null,
    r.vorsteuerBelege || r.ohneVorsteuer ? info(TEXT.aus_rechnungen_vorsteuer(r.vorsteuerBelege, r.ohneVorsteuer)) : null,
    r.steuerschuldBelege ? info(TEXT.ust_13b_belege(r.steuerschuldBelege)) : null,
    r.igeBelege ? info(r.kleinunternehmer ? TEXT.e227_ige_ku_uebernommen(r.igeBelege) : TEXT.ust_ige_belege(r.igeBelege)) : null,
    dfv ? info(TEXT.ust_dfv) : null,
  ]);
}

/** Ansage für VoiceOver: Ergebnis, alle Blocker und die Zahl der Hinweise (statt aller Texte hintereinander). */
export function ustAnsage(r: UstUebernahme, g: Geordnet): string {
  return [ustErgebnis(r) ?? "", ...g.blocker.map((m) => m.text), g.hinweise.length ? TEXT.e239_hinweise(g.hinweise.length) : ""].filter(Boolean).join(" ");
}

/** OSS-Erklärung bzw. Zusammenfassende Meldung: Berichtigung und fehlende Schlussrechnung sind Blocker, die Frist ein Hinweis. */
export function euMeldungen(art: "oss" | "zm", e: { berichtigungen?: EuBerichtigung[]; anderswo?: EuBerichtigung[]; minderungen?: number; schlussFehlt?: EuSchlussFehlt[] } | null): Geordnet {
  const ber = e?.berichtigungen ?? [];
  return ordnen([
    ber.length ? blocker(`${TEXT.e214_va_berichtigung(ber.map((b) => b.stornoNr))} ${TEXT.e214_zm_berichtigung(datumDe(ber.map((b) => b.zmFrist).sort()[0]))}`) : null,
    ...(e?.schlussFehlt ?? []).map((x) => blocker(schlussFehltText(x))),
    hinweis(art === "oss" ? TEXT.stb_oss_frist : TEXT.stb_zm_frist),
    ...anderswoTexte(e?.anderswo ?? []).map((t) => hinweis(t)),
    e?.minderungen ? info(TEXT.e214_zm_minderung(e.minderungen)) : null,
  ]);
}
