/**
 * Steuern und Buchhaltung (E-121): Rechnung, EÜR, Bilanz/GuV, USt-Voranmeldung, Steuererklärung (Zusammenstellung),
 * Kassenbuch, Kassenmeldung, Aufbewahrung. Was elektronisch ans Finanzamt geht (Voranmeldung, Anlage EÜR, Erklärungen,
 * E-Bilanz, Kassenmeldung), erstellt die App als ausgefüllte Unterlage zum Übertragen – sie übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-58).
 */
import { KU_HINWEIS, einheitFuerMenge, fehlendFuerERechnung, mengeUngueltig, rundeCent, summen, type Position, type RechnungsDaten } from "../rechnung.js";
import { einheitCode } from "../erechnung.js";
import { giroCodeSvg } from "../girocode.js";
import { BUNDESLAENDER, StandardKalender, verschiebe, type Bundesland } from "@amtlos/fristen";
import { EUER_ZEILE_STEUERFREI, EUER_ZEILE_STEUERPFLICHTIG, KATEGORIEN } from "../belege.js";
import { istEuAusland } from "../buchungen.js";
import { formImNamen, istKapitalgesellschaft } from "./betrieb.js";
import { AUFBEWAHRUNG, EINHEITEN, EUER_AUSGABEN, EUER_EINNAHMEN, KASSEN_ARTEN, RECHNUNGS_HINWEISE, TSE_ARTEN } from "./bausteine.js";
import { KOPF_LINIE, LINIE_MITTEL, ZELLE_LINIE, abschnitt, absatz, ankreuzen, anschrift, auswahl, brief, cent, datumDe, dokument, esc, euro, felder, ibanText, kennzahlen, nachsatz, uebertragung, ja, liste, neufassung, summe, tabelle, text, unterschriften, zahl, zahlText, zelle } from "./html.js";
import type { Betrieb, Daten, Eintrag, Option, Vorlage } from "./typen.js";


const KALENDER = new StandardKalender();
/**
 * Fälligkeit nach Zahlungsziel (ISO): fällt der letzte Tag auf einen Samstag, Sonntag oder Feiertag (am Sitz laut „Mein
 * Betrieb“, sonst bundeseinheitlich), ist es der nächste Werktag (§ 193 BGB). Leer bei falschem Datum.
 */
export function faelligAm(iso: string, tage: number, bundesland = ""): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || !Number.isFinite(tage)) return "";
  const roh = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + tage)).toISOString().slice(0, 10);
  const land = (BUNDESLAENDER as readonly string[]).includes(bundesland.trim()) ? (bundesland.trim() as Bundesland) : undefined;
  return verschiebe(roh, { regel: "naechster_werktag", kalender: land ? "bundesland" : "bundeseinheitlich" }, { bundesland: land }, KALENDER).datum;
}

const SAETZE = [
  { wert: "19", text: "19 %" },
  { wert: "7", text: "7 %" },
  { wert: "0", text: "0 % / steuerfrei" },
];
/** Hinweis bei steuerpflichtigen Leistungen im Zusammenhang mit einem Grundstück an Privatpersonen (§ 14 Abs. 4 Nr. 9 UStG). */
const GRUNDSTUECK_HINWEIS = "Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).";
const ZAHLUNGS_HINWEIS = "Bitte geben Sie bei der Zahlung die Rechnungsnummer an.";
/**
 * Auswahltext für den Hinweis „Gutschrift“: gemeint ist die Abrechnung durch den Leistungsempfänger (§ 14 Abs. 2 Satz 2
 * UStG), nicht die im Handel „Gutschrift“ genannte Rechnungskorrektur. Gedruckt wird weiter nur das Wort „Gutschrift“.
 */
export const GUTSCHRIFT_AUSWAHL = "Gutschrift – Abrechnung durch den Leistungsempfänger (§ 14 Abs. 2 Satz 2 UStG), keine Rechnungskorrektur; eine eigene Rechnung korrigierst du mit „Stornieren“";
/**
 * Befreiungshinweis bis zu dieser Länge steht direkt in der Summenzeile („Umsatzsteuer 0 % (Steuerfreie Heilbehandlung
 * nach § 4 Nr. 14 Buchst. a UStG)“) statt unter „Hinweise“ – so kann er nicht ohne die Beträge auf eine Folgeseite rücken.
 */
const BEFREIUNG_IN_SUMME = 90;
const befreiungInSumme = (befreiung: string) => !!befreiung && !befreiung.includes("\n") && befreiung.length <= BEFREIUNG_IN_SUMME;
/** Bezeichnung der 0-%-Zeile in der Summe: mit dem gewählten Grund statt pauschal „steuerfrei“ (Texte wie in den Pflichthinweisen). */
function nullProzentText(hinweise: string[], befreiung: string): string {
  if (hinweise.includes("reverse_charge")) return `Umsatzsteuer 0 % (${RECHNUNGS_HINWEISE.find((h) => h.wert === "reverse_charge")!.text})`;
  if (hinweise.includes("igl")) return "Umsatzsteuer 0 % (steuerfreie innergemeinschaftliche Lieferung)";
  // der eigene Text (z. B. Steuerbefreiung nach § 4 UStG oder Nullsteuersatz) – kein pauschales „steuerfrei“
  if (befreiungInSumme(befreiung)) return `Umsatzsteuer 0 % (${befreiung.replace(/\.$/, "")})`;
  if (befreiung) return "Umsatzsteuer 0 % (siehe Hinweis)";
  return "Steuerfrei bzw. 0 %";
}
const ZIEL: Record<string, string> = { sofort: "sofort ohne Abzug", "7": "innerhalb von 7 Tagen", "14": "innerhalb von 14 Tagen", "30": "innerhalb von 30 Tagen" };

/** Hinweis auf die Steuerbefreiung – nur, wenn eine Position mit 0 % abgerechnet wird (sonst stünde er bei reinen 19-%-Rechnungen). */
function befreiungText(d: Daten): string {
  const nullProzent = liste(d, "positionen").some((e) => (text(e, "bezeichnung") || text(e, "preis")) && Number(text(e, "satz") || "19") === 0);
  return nullProzent ? text(d, "befreiung") : "";
}

// ---------------------------------------------------------------- R10 Steuer: Steuerart, Gutschrift, Ausland

/** „§ 13b“ im Freitext des Befreiungshinweises: gemeint ist die Steuerschuldnerschaft des Leistungsempfängers. */
const RC_IM_TEXT = /(?:§\s*)?13\s*b(?![a-z])/i;
/** Nullsteuersatz (§ 12 Abs. 3 UStG, Photovoltaik) im Hinweistext – kein steuerfreier Umsatz, eigene Kennzahl 87. */
const NULLSATZ_IM_TEXT = /§\s*12\s*Abs\.?\s*3/;
/** Vorschlag für den Hinweis bei Photovoltaik zum Nullsteuersatz */
export const NULLSATZ_HINWEIS = "Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaikanlage)";
export const istNullsatzText = (t: string | null | undefined) => NULLSATZ_IM_TEXT.test(t ?? "");

/** Ist die Unterlage eine Gutschrift (Abrechnung durch den Leistungsempfänger)? */
/**
 * Kleinbetragsrechnung (§ 33 UStDV, R11): Gesamtbetrag bis 250 € brutto – Name und Anschrift des Empfängers sind dann
 * keine Pflichtangabe; auf der Rechnung genügen Entgelt und Steuer in einer Summe mit dem Steuersatz. Nicht bei Storno,
 * Gutschrift, Steuerschuldnerschaft des Empfängers oder innergemeinschaftlicher Lieferung (§ 33 Satz 3 UStDV).
 */
export const KLEINBETRAG_CENT = 25000;
export function kleinbetrag(d: Daten): boolean {
  if (text(d, "storno_zu") || auswahl(d, "hinweise").some((h) => h === "gutschrift" || h === "reverse_charge" || h === "igl")) return false;
  const pos = positionen(d);
  if (!pos.length) return false;
  const brutto = summen(pos.map((x) => x.p), kuFuer(d)).brutto_cent;
  return brutto > 0 && brutto <= KLEINBETRAG_CENT;
}

const istGutschriftD = (d: Daten) => !text(d, "storno_zu") && auswahl(d, "hinweise").includes("gutschrift");
const gutschriftD = (d: Daten) => auswahl(d, "hinweise").includes("gutschrift");

/**
 * Kleinunternehmerregelung dieser Rechnung. Bei einer Gutschrift kommt es auf den Leistenden an (`leistender_steuer`);
 * fehlt die Angabe (ältere Gutschriften), gilt der Schalter „Kleinunternehmer“ wie bisher.
 */
export function kuFuer(d: Daten): boolean {
  const l = text(d, "leistender_steuer");
  if (gutschriftD(d) && (l === "ku" || l === "regel")) return l === "ku";
  return ja(d, "kleinunternehmer");
}

/**
 * Land des Empfängers, wenn er ein Unternehmen im übrigen Gemeinschaftsgebiet ist: ausländische USt-IdNr. und Land der
 * Anschrift (bzw. der USt-IdNr.) in der EU außer Deutschland – sonst null.
 */
export function euUnternehmenLand(d: Daten): string | null {
  const ust = text(d, "kunde_ust_idnr").replace(/\s/g, "").toUpperCase();
  if (!ust || ust.startsWith("DE")) return null;
  const a = anschriftZerlegen(text(d, "kunde_anschrift"), ust);
  return a.land && istEuAusland(a.land) ? a.land : null;
}

/** Land des Empfängers außerhalb der EU (z. B. CH) – sonst null. */
export function drittlandLand(d: Daten): string | null {
  const a = anschriftZerlegen(text(d, "kunde_anschrift"), text(d, "kunde_ust_idnr"));
  return a.land && a.land !== "DE" && !istEuAusland(a.land) ? a.land : null;
}

/** Steuerart der Rechnung aus Pflichthinweisen und Befreiungstext (auch „§ 13b“ im Freitext, Nullsteuersatz). */
function steuerartAus(d: Daten): NonNullable<RechnungsDaten["steuerart"]> {
  const hw = auswahl(d, "hinweise");
  const befreiung = befreiungText(d);
  if (hw.includes("reverse_charge") || (befreiung && RC_IM_TEXT.test(befreiung))) return "reverse_charge";
  if (hw.includes("igl")) return "igl";
  if (befreiung && NULLSATZ_IM_TEXT.test(befreiung)) return "nullsatz";
  return befreiung ? "befreit" : "standard";
}

/** Behörde, Kommune oder andere öffentliche Stelle als Empfänger (Leitweg-ID nötig) – grobe Erkennung am Namen. */
const OEFFENTLICH = /\b(stadt|gemeinde|landkreis|kreis|markt|amt|landratsamt|bezirksamt|ministerium|behörde|bundesamt|landesamt|regierungspräsidium|kreisverwaltung|stadtverwaltung|verbandsgemeinde|samtgemeinde|bundesanstalt|landesbetrieb|bundesrepublik|freistaat|land)\b/i;
export const istOeffentlicherEmpfaenger = (name: string) => OEFFENTLICH.test(name.trim());

/** Hinweise der Rechnung, die nicht am Teilen hindern (Abschluss: gelbe Hinweise). */
export const RECHNUNG_LEITWEG = "Der Empfänger klingt nach einer öffentlichen Stelle: Für E-Rechnungen an Behörden und Kommunen ist die Leitweg-ID Pflicht (Käuferreferenz, BT-10) – bitte unter „Leitweg-ID bzw. Käuferreferenz“ eintragen.";
export const RECHNUNG_13B_TEXT = "Im Hinweis auf die Steuerbefreiung steht „13b“: Die Rechnung wird als Steuerschuldnerschaft des Leistungsempfängers behandelt (Kz 60, E-Rechnung „AE“). Besser den Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ wählen – dieser Wortlaut ist vorgeschrieben (§ 14a Abs. 5 UStG).";
export const RECHNUNG_EU_19 = (land: string) => `Empfänger ist ein Unternehmen in ${land} (ausländische USt-IdNr.): Bei Dienstleistungen liegt der Ort der Leistung dort (§ 3a Abs. 2 UStG) – dann 0 % und den Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ wählen; bei Warenlieferungen „innergemeinschaftliche Lieferung“. Weist du trotzdem deutsche Umsatzsteuer aus, schuldest du sie (§ 14c UStG).`;
export const RECHNUNG_KU_EU = (land: string) => `Empfänger ist ein Unternehmen in ${land}: Bei Dienstleistungen liegt der Ort der Leistung dort (§ 3a Abs. 2 UStG), der Umsatz ist in Deutschland nicht steuerbar. Statt „steuerfrei nach § 19 UStG“ gehört dann der Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ auf die Rechnung – unter „Pflichthinweise“ wählen.`;
export const RECHNUNG_KU_RC = "Kleinunternehmer und Steuerschuldnerschaft des Leistungsempfängers: passt bei Dienstleistungen an Unternehmen im EU-Ausland – die Rechnung trägt dann den Hinweis auf die Steuerschuldnerschaft statt des § 19-Hinweises. Bei Kunden in Deutschland bitte abwählen (dort gilt § 19 UStG).";
export const RECHNUNG_KU_IGL = "Widerspruch: Kleinunternehmer und innergemeinschaftliche Lieferung. Die Steuerbefreiung für innergemeinschaftliche Lieferungen gilt für Kleinunternehmer in der Regel nicht – Empfehlung: den Hinweis „innergemeinschaftliche Lieferung“ abwählen und mit der Steuerberatung klären.";
export const RECHNUNG_KU_DRITTLAND = "Empfänger außerhalb der EU: Dienstleistungen an Unternehmen sind dort steuerbar, in Deutschland nicht (§ 3a Abs. 2 UStG). „Steuerfrei nach § 19 UStG“ ist dann ungenau – den Hinweis bitte mit der Steuerberatung klären.";
export const RECHNUNG_KU_PROFIL = (profil: boolean) => `Der Schalter „Kleinunternehmer“ weicht vom Pflichten-Check ab (dort: ${profil ? "Kleinunternehmer" : "kein Kleinunternehmer"}) – bitte prüfen, welcher Stand für diese Rechnung gilt.`;
export const RECHNUNG_GUTSCHRIFT_STEUER = "Steuernummer oder USt-IdNr. des Leistenden (bei Gutschrift)";
/**
 * R11 (Gebäudereinigung, Befund 1): Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ bzw. „innergemein-
 * schaftliche Lieferung“, aber Positionen mit Umsatzsteuer – die ausgewiesene Steuer würde nach § 14c Abs. 1 UStG
 * geschuldet. Hindert am Teilen.
 */
/** R11 (Kosmetik #2): Leistung aus der Kleinunternehmerzeit, aber die Rechnung weist Umsatzsteuer aus – und umgekehrt. */
export const RECHNUNG_KU_ZEIT = (bis: string) => `Die Leistung stammt aus deiner Kleinunternehmerzeit (bis ${bis}, siehe „Mein Betrieb“): Dann gehört keine Umsatzsteuer auf die Rechnung, sondern der Hinweis nach § 19 UStG – Schalter „Kleinunternehmer“ einschalten. Weist du sie trotzdem aus, schuldest du sie (§ 14c Abs. 2 UStG).`;
export const RECHNUNG_NACH_KU_ZEIT = (bis: string) => `Die Leistung liegt nach deiner Kleinunternehmerzeit (bis ${bis}, siehe „Mein Betrieb“): Dann gilt die Regelbesteuerung – Schalter „Kleinunternehmer“ bitte prüfen.`;
/** R11 (Kosmetik #5): Gutschein zu 0 % – kein steuerfreier Umsatz (§ 3 Abs. 13–15 UStG). */
export const RECHNUNG_GUTSCHEIN = "Gutschein zu 0 %: Ein Gutschein ist kein steuerfreier Umsatz. Einzweck-Gutschein (Leistung und Steuersatz stehen fest): Umsatzsteuer schon beim Verkauf (§ 3 Abs. 14 UStG) – also mit 19 % bzw. 7 % abrechnen. Mehrzweck-Gutschein: beim Verkauf keine Rechnung mit Umsatzsteuer, versteuert wird erst die Einlösung (§ 3 Abs. 15 UStG). Bitte mit der Steuerberatung klären; im Buchungsstapel steht diese Rechnung nicht.";
/** R11 (Tischlerei #14): Handwerk/Bau an Privatkunden – Hinweis auf die Aufbewahrungspflicht vorschlagen. */
export const RECHNUNG_GRUNDSTUECK_VORSCHLAG = "Leistung an einem Grundstück (z. B. Einbau, Reparatur am Haus) an eine Privatperson? Dann gehört der Hinweis auf die zweijährige Aufbewahrungspflicht auf die Rechnung (§ 14 Abs. 4 Satz 1 Nr. 9 UStG) – unter „Pflichthinweise“ wählen.";
/** R11 (Tischlerei #13): Abschlagsrechnung mit „Leistungsdatum entspricht dem Rechnungsdatum“ – die Leistung ist noch nicht erbracht. */
export const RECHNUNG_ABSCHLAG_LEISTUNG = "Abschlagsrechnung: Die Leistung ist noch nicht erbracht – „Leistungsdatum entspricht dem Rechnungsdatum“ ausschalten und das voraussichtliche Datum bzw. den Zeitraum der Leistung angeben, bei einer Anzahlung den Tag der Vereinnahmung, wenn er feststeht (§ 14 Abs. 4 Satz 1 Nr. 6 UStG).";
/** Gutschein in einer Position zu 0 % (R11) – nicht als steuerfreier Erlös buchen */
export const gutscheinZuNull = (d: Daten) => !kuFuer(d) && positionen(d).some((x) => x.p.ust_satz === 0 && /gutschein/i.test(x.p.bezeichnung));
export const RECHNUNG_RC_MIT_UST = "Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ bzw. „innergemeinschaftliche Lieferung“ gewählt, aber Positionen mit 19 % oder 7 % – bitte diese Positionen auf „0 % / steuerfrei“ stellen oder den Hinweis abwählen. Ausgewiesene Umsatzsteuer schuldest du sonst trotzdem (§ 14c Abs. 1 UStG).";

/**
 * R11 (Kosmetik #4): Preise inkl. Umsatzsteuer – der eingetragene Preis ist brutto; `summen` rechnet davon aus, so dass
 * der Rechnungsbetrag genau stimmt. Nettopreis je Einheit gerundet (für Tabelle und E-Rechnung). Nicht bei Kleinunternehmern.
 */
function preisFelder(d: Daten, roh: number, satz: number | null): Pick<Position, "preis_cent" | "brutto_cent"> {
  if (!ja(d, "preise_brutto") || satz === null || satz <= 0) return { preis_cent: roh };
  return { preis_cent: rundeCent((roh * 100) / (100 + satz)), brutto_cent: roh };
}

function positionen(d: Daten): { e: Eintrag; p: Position }[] {
  const ku = kuFuer(d);
  return liste(d, "positionen")
    .filter((e) => text(e, "bezeichnung") || text(e, "preis"))
    .map((e) => {
      const satz = Number(text(e, "satz") || "19");
      return { e, p: { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck", ...preisFelder(d, cent(text(e, "preis")) ?? 0, ku ? null : satz), ust_satz: satz } };
    });
}

/** Verständliche Bezeichnungen für fehlendFuerERechnung */
const E_FEHLT: Record<string, string> = {
  "steller.anschrift": "Name und Anschrift des Betriebs (Mein Betrieb)",
  "steller.email": "E-Mail des Betriebs (Mein Betrieb)",
  "steller.telefon": "Telefon des Betriebs (Mein Betrieb)",
  "steller.steuernummer_oder_ust_idnr": "Steuernummer oder USt-IdNr. (Mein Betrieb)",
  "steller.iban": "IBAN (Mein Betrieb)",
  "kunde.anschrift": "Anschrift des Empfängers: Straße in der ersten, PLZ und Ort in der letzten Zeile",
  "kunde.email": "E-Mail des Empfängers",
  positionen: "mindestens eine Position",
  "positionen.ungueltig": "Positionen mit Bezeichnung, Menge und Preis",
  "positionen.steuersatz": "Umsatzsteuersatz je Position",
  leistungsdatum: "Leistungsdatum als Datum (TT.MM.JJJJ) oder Zeitraum (TT.MM.–TT.MM.JJJJ bzw. Monat und Jahr)",
  "steuer.grund_null": "Grund für 0 % Umsatzsteuer (Hinweis: Steuerschuldnerschaft des Empfängers, innergemeinschaftliche Lieferung oder Steuerbefreiung)",
  "steuer.befreiungsgrund": "Hinweis auf die Steuerbefreiung",
  "steller.ust_idnr": "USt-IdNr. des Betriebs (Mein Betrieb)",
  "kunde.ust_idnr": "USt-IdNr. des Empfängers",
  // R11: Gutschrift – Verkäufer in der E-Rechnung ist der Leistende (ohne diese Angaben entsteht nur das PDF)
  "leistender.anschrift": "Anschrift des Leistenden (Empfänger der Gutschrift): Straße in der ersten, PLZ und Ort in der letzten Zeile",
  "leistender.email": "E-Mail des Leistenden (Empfänger der Gutschrift)",
  "leistender.telefon": "Telefon des Leistenden (Empfänger der Gutschrift)",
  "leistender.steuernummer_oder_ust_idnr": "Steuernummer oder USt-IdNr. des Leistenden",
};

const E_LAND_FEHLT = "Land des Empfängers in der letzten Zeile der Anschrift (z. B. Österreich)";

const isoAus = (t: string) => {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(t);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(t.trim()) ? t.trim() : null;
};

const MONATSNAMEN = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const gueltigIso = (j: number, m: number, t: number) => {
  const d = new Date(Date.UTC(j, m - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t ? d.toISOString().slice(0, 10) : null;
};
/**
 * Leistungszeitraum aus dem Freitext der Rechnung: „12.01.–11.02.2026“, „02.03.2026 – 27.03.2026“, „01.06. bis
 * 30.06.2026“ oder ein Kalendermonat („Oktober 2026“). null, wenn der Text kein eindeutiger Zeitraum ist.
 */
export function leistungszeitraumAus(t: string): { von: string; bis: string } | null {
  const z = t.replace(/\s+/g, " ").trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})? ?(?:–|—|-|bis) ?(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(z);
  if (m) {
    const [t1, m1, t2, m2, j2] = [m[1], m[2], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number];
    // ohne Jahr am Anfang: dasselbe Jahr wie am Ende, über den Jahreswechsel („15.12.–15.01.2027“) das Vorjahr
    const j1 = m[3] ? Number(m[3]) : m1 > m2 ? j2 - 1 : j2;
    const von = gueltigIso(j1, m1, t1);
    const bis = gueltigIso(j2, m2, t2);
    return von && bis && von <= bis ? { von, bis } : null;
  }
  const mo = /^([a-zäöü]+) (\d{4})$/i.exec(z);
  const i = mo ? MONATSNAMEN.indexOf(mo[1]!.toLocaleLowerCase("de")) : -1;
  if (mo && i >= 0) {
    const j = Number(mo[2]);
    return { von: gueltigIso(j, i + 1, 1)!, bis: new Date(Date.UTC(j, i + 1, 0)).toISOString().slice(0, 10) };
  }
  return null;
}

/**
 * Kennzahl der Voranmeldung für eine Steuerbefreiung nach dem Hinweistext: § 4 Nr. 8 bis 29 UStG → Kz 48 (steuerfrei
 * ohne Vorsteuerabzug); § 4 Nr. 1 Buchst. a und Nr. 2 bis 7 → Kz 43; sonst (ohne Vorschrift) null – dann „weitere Umsätze“.
 */
export function kennzahlBefreiung(befreiungsgrund: string | null | undefined): "48" | "43" | null {
  const m = /§\s*4\s+Nr\.\s*(\d+)\s*(?:Buchst\.\s*)?([a-z])?/.exec(befreiungsgrund ?? "");
  const nr = m ? Number(m[1]) : NaN;
  if (nr >= 8 && nr <= 29) return "48";
  // R10: Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a) und § 4 Nr. 2 bis 7 – steuerfrei mit Vorsteuerabzug (Kz 43); Nr. 1 b ist die igL (Kz 41)
  if ((nr === 1 && m?.[2] === "a") || (nr >= 2 && nr <= 7)) return "43";
  return null;
}

/** Länder für die Anschrift: Name (deutsch/englisch/landessprachlich) oder Kürzel → ISO 3166-1 alpha-2. */
const LAENDER: Record<string, string> = {
  deutschland: "DE", germany: "DE", de: "DE", d: "DE",
  österreich: "AT", oesterreich: "AT", austria: "AT", at: "AT", a: "AT",
  schweiz: "CH", switzerland: "CH", suisse: "CH", svizzera: "CH", ch: "CH",
  liechtenstein: "LI", li: "LI", fl: "LI",
  belgien: "BE", belgium: "BE", belgique: "BE", belgië: "BE", be: "BE", b: "BE",
  niederlande: "NL", netherlands: "NL", nederland: "NL", holland: "NL", nl: "NL",
  luxemburg: "LU", luxembourg: "LU", lu: "LU", l: "LU",
  frankreich: "FR", france: "FR", fr: "FR", f: "FR",
  italien: "IT", italy: "IT", italia: "IT", it: "IT", i: "IT",
  spanien: "ES", spain: "ES", españa: "ES", es: "ES", e: "ES",
  portugal: "PT", pt: "PT", p: "PT",
  dänemark: "DK", daenemark: "DK", denmark: "DK", danmark: "DK", dk: "DK",
  schweden: "SE", sweden: "SE", sverige: "SE", se: "SE", s: "SE",
  finnland: "FI", finland: "FI", suomi: "FI", fi: "FI",
  polen: "PL", poland: "PL", polska: "PL", pl: "PL",
  tschechien: "CZ", czechia: "CZ", "czech republic": "CZ", česko: "CZ", cz: "CZ",
  slowakei: "SK", slovakia: "SK", slovensko: "SK", sk: "SK",
  ungarn: "HU", hungary: "HU", magyarország: "HU", hu: "HU",
  slowenien: "SI", slovenia: "SI", slovenija: "SI", si: "SI",
  kroatien: "HR", croatia: "HR", hrvatska: "HR", hr: "HR",
  irland: "IE", ireland: "IE", ie: "IE",
  griechenland: "GR", greece: "GR", gr: "GR", el: "GR",
  rumänien: "RO", rumaenien: "RO", romania: "RO", ro: "RO",
  bulgarien: "BG", bulgaria: "BG", bg: "BG",
  estland: "EE", estonia: "EE", ee: "EE",
  lettland: "LV", latvia: "LV", lv: "LV",
  litauen: "LT", lithuania: "LT", lt: "LT",
  malta: "MT", mt: "MT",
  zypern: "CY", cyprus: "CY", cy: "CY",
  "vereinigtes königreich": "GB", großbritannien: "GB", grossbritannien: "GB", "united kingdom": "GB", uk: "GB", gb: "GB",
  norwegen: "NO", norway: "NO", norge: "NO", no: "NO",
};
/** USt-IdNr.-Präfix → Land (Griechenland: EL). */
const UST_LAND: Record<string, string> = { EL: "GR", XI: "GB" };

/**
 * Anschrift aus Zeilen zerlegen (E-129): erste Zeile Straße, dann „PLZ Ort“ (auch „A-1010 Wien“, „1012 AB Amsterdam“),
 * optional eine letzte Zeile mit dem Land. Ohne Land: aus PLZ-Präfix, USt-IdNr. oder fünfstelliger PLZ (Deutschland).
 */
export function anschriftZerlegen(text_: string, ustIdnr = ""): { strasse: string | null; plz: string | null; ort: string | null; land: string | null } {
  const zeilen = text_.split("\n").map((z) => z.trim()).filter(Boolean);
  let land: string | null = null;
  const letzte = (zeilen.at(-1) ?? "").toLocaleLowerCase("de").replace(/\.$/, "");
  if (zeilen.length > 1 && LAENDER[letzte] && !/\d/.test(letzte)) {
    land = LAENDER[letzte]!;
    zeilen.pop();
  }
  const m = /^(?:([A-Za-z]{1,3})\s?-\s?)?(\d{4,5}(?:\s?[A-Z]{2})?)\s+(.+)$/.exec(zeilen.at(-1) ?? "");
  const praefix = m?.[1] ? LAENDER[m[1].toLowerCase()] : undefined;
  const ust = /^([A-Z]{2})/.exec(ustIdnr.replace(/\s/g, "").toUpperCase())?.[1];
  land ??= praefix ?? (ust ? (UST_LAND[ust] ?? ust) : null) ?? (m && /^\d{5}$/.test(m[2]!) ? "DE" : null);
  return { strasse: zeilen.length > 1 ? zeilen[0]! : null, plz: m?.[2] ?? null, ort: m?.[3] ?? null, land };
}

/**
 * Rechnung aus der App → Daten für die E-Rechnung (E-128) und was dafür noch fehlt. Unterstützt 19 %, 7 % und
 * Kleinunternehmer; 0 % aus anderen Gründen (z. B. Reverse Charge) noch nicht.
 */
export function eRechnungAus(d: Daten, b: Betrieb): { daten: RechnungsDaten; fehlt: string[] } {
  const a = anschriftZerlegen(text(d, "kunde_anschrift"), text(d, "kunde_ust_idnr"));
  const ku = kuFuer(d);
  const befreiung = befreiungText(d);
  const steuerart = steuerartAus(d);
  const storno = text(d, "storno_zu");
  const pos = liste(d, "positionen").filter((e) => text(e, "bezeichnung") || text(e, "preis"));
  const datum = text(d, "datum");
  const ziel = text(d, "zahlungsziel");
  const leistungsdatum = ja(d, "leistung_gleich") ? datum || null : isoAus(text(d, "leistung"));
  // Gutschrift und ihr Storno: in der E-Rechnung ist der Leistende der Verkäufer (R11)
  const gutschrift = gutschriftD(d);
  const daten: RechnungsDaten = {
    nummer: text(d, "nummer"),
    rechnungsdatum: datum,
    leistungsdatum,
    ...(leistungsdatum ? {} : { leistungszeitraum: leistungszeitraumAus(text(d, "leistung")) }),
    faellig_am: datum && ziel && ziel !== "sofort" ? faelligAm(datum, Number(ziel), b.bundesland) || null : null,
    steller: { name: b.name.trim(), strasse: b.strasse.trim(), plz: b.plz.trim(), ort: b.ort.trim(), land: "DE", email: b.email.trim(), telefon: b.telefon.trim() || null, steuernummer: b.steuernummer.trim() || null, ust_idnr: b.ust_idnr.trim() || null, iban: b.iban.trim() || null },
    // Leitweg-ID bzw. Käuferreferenz (BT-10), ohne sie wie bisher die Rechnungsnummer
    kunde: {
      name: text(d, "kunde_name"), strasse: a.strasse, plz: a.plz, ort: a.ort, land: a.land ?? "DE", email: text(d, "kunde_email") || null, ust_idnr: text(d, "kunde_ust_idnr") || null, kaeufer_referenz: text(d, "kunde_leitweg_id").trim() || null, geschaeftskunde: true,
      // R11: bei einer Gutschrift ist der Empfänger der Leistende – Verkäufer in der E-Rechnung
      ...(gutschrift ? { steuernummer: text(d, "kunde_steuernummer").trim() || null, telefon: text(d, "kunde_telefon").trim() || null } : {}),
    },
    ...(gutschrift ? { gutschrift: true } : {}),
    ...(text(d, "bestellnummer").trim() ? { bestellnummer: text(d, "bestellnummer").trim() } : {}),
    ...(ja(d, "abschlag") && !storno ? { abschlag: true } : {}),
    positionen: pos.map((e) => {
      const preis = cent(text(e, "preis")) ?? 0;
      // Storno: die Positionen tragen schon das umgedrehte Vorzeichen; `art: "storno"` dreht es für USt und XRechnung zurück
      const satz = ku ? null : Number(text(e, "satz") || "19");
      return { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck" as const, einheit_code: einheitCode(text(e, "einheit")), ...preisFelder(d, storno ? -preis : preis, satz), ust_satz: satz };
    }),
    kleinunternehmer: ku,
    hinweis: [befreiung, ...text(d, "hinweis").split("\n").filter((h) => !(storno && h.trim() === ZAHLUNGS_HINWEIS))].filter(Boolean).join("\n") || null,
    ...(storno ? { art: "storno" as const, storniert_nummer: storno } : {}),
    steuerart,
    befreiungsgrund: befreiung || null,
  };
  const fehlt = fehlendFuerERechnung(daten).map((c) => E_FEHLT[c] ?? c);
  if (!a.land && a.plz) fehlt.push(E_LAND_FEHLT);
  if (!daten.nummer) fehlt.unshift("Rechnungsnummer");
  if (!datum) fehlt.unshift("Rechnungsdatum");
  return { daten, fehlt };
}

/** Art der Rechnung aus den Daten: Stornorechnung (storniert eine andere), Gutschrift (Hinweis „gutschrift“) oder Rechnung. */
export function rechnungsTitel(d: Daten): "Rechnung" | "Stornorechnung" | "Gutschrift" | "Abschlagsrechnung" {
  return text(d, "storno_zu") ? "Stornorechnung" : auswahl(d, "hinweise").includes("gutschrift") ? "Gutschrift" : ja(d, "abschlag") ? "Abschlagsrechnung" : "Rechnung";
}


/** Meldungen der Rechnungsprüfung (auch für die Zuordnung zu einem Feld im Abschluss). */
export const RECHNUNG_PLZ_FEHLT = "PLZ und Ort des Empfängers fehlen (letzte Zeile der Anschrift, z. B. 10115 Berlin)";
export const RECHNUNG_NULL = "Rechnungsbetrag ist 0,00 € – bitte die Preise prüfen";
/** Position mit Menge 0 oder negativ (M6) – die E-Rechnung lehnt sie ab; Rabatte als negativer Preis eintragen. */
export const RECHNUNG_MENGE = "Menge einer Position ist 0 oder negativ – bitte die Menge prüfen (Rabatte als negativen Preis eintragen)";
export const RECHNUNG_NEGATIV = "Rechnungsbetrag ist negativ – bitte die Preise prüfen (eine geteilte Rechnung korrigierst du mit „Stornieren“)";

/** Anrede der Rechnung, wenn keine eigene angegeben ist. */
const ANREDE_STANDARD = "Sehr geehrte Damen und Herren";

export const rechnung: Vorlage = {
  id: "rechnung",
  gestalt: "brief",
  titel: "Rechnung",
  beschreibung: "Rechnung mit allen Pflichtangaben nach § 14 Abs. 4 UStG – Positionen, Steuersätze, Zahlungsziel und Pflichthinweise zum Auswählen.",
  bereich: "steuern",
  pflichten: ["steuern.rechnungen_pflichtangaben"],
  person: { art: "kunde", felder: { name: "kunde_name", anschrift: "kunde_anschrift", email: "kunde_email", ust_idnr: "kunde_ust_idnr", leitweg_id: "kunde_leitweg_id", steuernummer: "kunde_steuernummer" } },
  fortlaufend: "nummer",
  kundendokument: true,
  festschreiben: true,
  storno: true,
  eRechnung: true,
  ausProfil: { kleinunternehmer: "ust.kleinunternehmer" },
  grundlage: "§ 14 Abs. 4 UStG",
  namensFeld: "nummer",
  titelFuer: rechnungsTitel,
  abschnitte: [
    { titel: "Eckdaten",
      hilfe: "Am Ende teilst du die Rechnung als PDF – an Unternehmen zusätzlich als E-Rechnung (XRechnung).",
      felder: [
        { id: "nummer", art: "text", label: "Rechnungsnummer", hilfe: "fortlaufend und nur einmal vergeben, z. B. 2026-001", pflicht: true },
        { id: "datum", art: "datum", label: "Rechnungsdatum", vorbelegung: "heute", pflicht: true },
        { id: "leistung_gleich", art: "schalter", label: "Leistungsdatum entspricht dem Rechnungsdatum", vorbelegung: true },
        { id: "leistung", art: "text", label: "Datum oder Zeitraum der Leistung", hilfe: "z. B. 12.10.2026 oder Oktober 2026", pflicht: true, wenn: { feld: "leistung_gleich", nicht: true } },
        { id: "zahlungsziel", art: "wahl", label: "Zahlungsziel", optionen: [{ wert: "7", text: "7 Tage" }, { wert: "14", text: "14 Tage" }, { wert: "30", text: "30 Tage" }, { wert: "sofort", text: "Sofort" }], vorbelegung: "14", hilfe: "Steht auf der Rechnung als „Zahlbar innerhalb von … Tagen“ mit dem Datum." },
        { id: "bezahlt_am", selten: true, art: "datum", label: "Schon bezahlt am", hilfe: "z. B. bei Barzahlung, Vorkasse oder Zahlung im Onlineshop – bezahlt am oder vor dem Rechnungsdatum, entfällt die Zahlungsaufforderung" },
        { id: "bestellnummer", selten: true, art: "text", label: "Bestellnummer des Kunden", hilfe: "steht auf der Rechnung und in der E-Rechnung (BT-13)" },
        { id: "abschlag", selten: true, art: "schalter", label: "Abschlagsrechnung (Anzahlung vor Fertigstellung)", hilfe: "Die Umsatzsteuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG) – in der Voranmeldung zählt die Rechnung im Zeitraum des Zahlungseingangs. Als Leistungsdatum das voraussichtliche Datum angeben, nicht das Rechnungsdatum." },
      ],
    },
    {
      titel: "Rechnungsempfänger",
      felder: [
        { id: "kunde_name", art: "text", label: "Name oder Firma", pflicht: true },
        { id: "kunde_anschrift", art: "mehrzeilig", label: "Anschrift", hilfe: "Straße und Hausnummer, PLZ und Ort – im Ausland das Land in die letzte Zeile", pflicht: true },
        { id: "kunde_email", art: "text", label: "E-Mail des Empfängers", hilfe: "nötig für die E-Rechnung an Unternehmen" },
        { id: "anrede", selten: true, art: "text", label: "Anrede", hilfe: `Steht über dem Text der Rechnung; leer: „${ANREDE_STANDARD}“`, vorschlaege: [ANREDE_STANDARD, "Sehr geehrte Frau …", "Sehr geehrter Herr …", "Guten Tag …", "Hallo …"] },
        { id: "kunde_ust_idnr", selten: true, art: "text", label: "USt-IdNr. des Empfängers", hilfe: "nur bei innergemeinschaftlichen Leistungen oder Steuerschuldnerschaft des Empfängers; bei Gutschriften die des Leistenden" },
        { id: "kunde_leitweg_id", selten: true, art: "text", label: "Leitweg-ID bzw. Käuferreferenz", hilfe: "bei Behörden und Kommunen Pflicht für die E-Rechnung (z. B. 05913000-00012-37); wird beim Kunden gemerkt" },
        { id: "kunde_steuernummer", selten: true, art: "text", label: "Steuernummer des Leistenden (bei Gutschrift)", hilfe: "Bei einer Gutschrift stehen Steuernummer oder USt-IdNr. des Leistenden auf dem Dokument (§ 14 Abs. 4 Nr. 2 UStG)", wenn: { feld: "hinweise", ist: "gutschrift" } },
        // R11: die E-Rechnung einer Gutschrift nennt den Leistenden als Verkäufer – mit Telefon (BR-DE-6)
        { id: "kunde_telefon", selten: true, art: "text", label: "Telefon des Leistenden (bei Gutschrift)", hilfe: "nur für die E-Rechnung der Gutschrift nötig; das PDF geht auch ohne", wenn: { feld: "hinweise", ist: "gutschrift" } },
      ],
    },
    {
      titel: "Positionen",
      felder: [
        // R11 (Kosmetik #4): Bruttopreise für Privatkunden – die Summe trifft den Endpreis genau
        { id: "preise_brutto", selten: true, art: "schalter", label: "Preise inkl. Umsatzsteuer (brutto)", hilfe: "Dann trägst du unter „Einzelpreis“ den Endpreis mit Umsatzsteuer ein (z. B. 45,00 €); Amtlos rechnet Netto und Umsatzsteuer daraus, der Rechnungsbetrag stimmt genau. Nicht bei Kleinunternehmern." },
        {
          id: "positionen",
          art: "liste",
          label: "Positionen",
          eintrag: "Position",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Leistung oder Ware", hilfe: "handelsübliche Bezeichnung bzw. Art und Umfang der Leistung", pflicht: true },
            { id: "menge", art: "zahl", label: "Menge", vorbelegung: "1" },
            { id: "einheit", art: "text", label: "Einheit", vorschlaege: EINHEITEN.slice(0, 8), vorbelegung: { text: "Stück" } },
            { id: "preis", art: "betrag", label: "Einzelpreis netto (€)", hilfe: "mit „Preise inkl. Umsatzsteuer“ der Bruttopreis", pflicht: true },
            { id: "satz", art: "wahl", label: "Umsatzsteuer", optionen: SAETZE, vorbelegung: "19" },
          ],
        },
      ],
    },
    {
      titel: "Steuer und Hinweise",
      felder: [
        // aus dem Pflichten-Check vorbelegt (ausProfil) – daher unter „Weitere Angaben“; eingeschaltet steht er ohnehin da
        { id: "kleinunternehmer", selten: true, art: "schalter", label: "Kleinunternehmer (§ 19 UStG)", hilfe: "Dann wird keine Umsatzsteuer ausgewiesen; der Hinweis auf die Steuerbefreiung steht auf der Rechnung." },
        { id: "leistender_steuer", selten: true, art: "wahl", label: "Umsatzsteuer des Leistenden (bei Gutschrift)", optionen: [{ wert: "regel", text: "weist Umsatzsteuer aus" }, { wert: "ku", text: "Kleinunternehmer (§ 19 UStG)" }], hilfe: "Bei einer Gutschrift richtet sich die Umsatzsteuer nach dem Leistenden, nicht nach dir. Ohne Auswahl gilt der Schalter „Kleinunternehmer“.", wenn: { feld: "hinweise", ist: "gutschrift" } },
        { id: "hinweise", selten: true, art: "bausteine", label: "Pflichthinweise, falls zutreffend", optionen: [...RECHNUNGS_HINWEISE.filter((h) => h.wert !== "steuerfrei").map((h) => ({ wert: h.wert, text: h.wert === "gutschrift" ? GUTSCHRIFT_AUSWAHL : h.text, quelle: h.quelle })), { wert: "grundstueck", text: GRUNDSTUECK_HINWEIS, quelle: "§ 14 Abs. 4 Nr. 9, § 14b Abs. 1 Satz 5 UStG" }] },
        { id: "befreiung", selten: true, art: "text", label: "Hinweis auf die Steuerbefreiung (bei 0 %)", hilfe: "Pflicht, wenn eine Position steuerfrei ist – mit der Vorschrift. Bei Bauleistungen an Bauunternehmen und bei Gebäudereinigung an Gebäudereiniger (§ 13b Abs. 2 Nr. 4 und 8, Abs. 5 Satz 2 und 5 UStG) stattdessen den Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ wählen und die Positionen auf 0 % stellen. Gutscheine sind keine steuerfreien Umsätze (Einzweck-Gutschein: mit Umsatzsteuer abrechnen).", vorschlaege: ["Steuerfreie Leistung nach § 4 Nr. … UStG", NULLSATZ_HINWEIS] },
        { id: "hinweis", art: "mehrzeilig", label: "Weitere Hinweise", vorschlaege: ["Vielen Dank für Ihren Auftrag.", ZAHLUNGS_HINWEIS] },
      ],
    },
  ],
  pruefenZu: {
    [RECHNUNG_PLZ_FEHLT]: "kunde_anschrift",
    [RECHNUNG_NULL]: "positionen",
    [RECHNUNG_NEGATIV]: "positionen",
    [RECHNUNG_MENGE]: "positionen",
    [RECHNUNG_RC_MIT_UST]: "positionen",
    [RECHNUNG_ABSCHLAG_LEISTUNG]: "leistung_gleich",
    // was der E-Rechnung fehlt (eRechnungAus) – für „Ergänzen“ unter „Für die E-Rechnung fehlt noch“
    [E_FEHLT["kunde.anschrift"]!]: "kunde_anschrift",
    [E_LAND_FEHLT]: "kunde_anschrift",
    [E_FEHLT["kunde.email"]!]: "kunde_email",
    [E_FEHLT["kunde.ust_idnr"]!]: "kunde_ust_idnr",
    [E_FEHLT.positionen!]: "positionen",
    [E_FEHLT["positionen.ungueltig"]!]: "positionen",
    [E_FEHLT["positionen.steuersatz"]!]: "positionen",
    [E_FEHLT.leistungsdatum!]: "leistung_gleich",
    [E_FEHLT["steuer.grund_null"]!]: "befreiung",
    [E_FEHLT["steuer.befreiungsgrund"]!]: "befreiung",
    [E_FEHLT["leistender.anschrift"]!]: "kunde_anschrift",
    [E_FEHLT["leistender.email"]!]: "kunde_email",
    [E_FEHLT["leistender.telefon"]!]: "kunde_telefon",
    [E_FEHLT["leistender.steuernummer_oder_ust_idnr"]!]: "kunde_steuernummer",
  },
  // Kleinbetragsrechnung bis 250 € (§ 33 UStDV): Name und Anschrift des Empfängers sind keine Pflicht (R11)
  nichtPflicht: (d) => (kleinbetrag(d) ? ["kunde_name", "kunde_anschrift"] : []),
  pruefen(d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift des Betriebs (Mein Betrieb)");
    // Gutschrift: die Steuerdaten des Leistenden gehören auf das Dokument (§ 14 Abs. 4 Nr. 2 UStG), nicht die eigenen
    if (istGutschriftD(d)) {
      if (!text(d, "kunde_steuernummer").trim() && !text(d, "kunde_ust_idnr").trim()) f.push(RECHNUNG_GUTSCHRIFT_STEUER);
    } else if (!b.steuernummer.trim() && !b.ust_idnr.trim()) f.push("Steuernummer oder USt-IdNr. (Mein Betrieb)");
    // Anschrift des Empfängers: PLZ und Ort in der letzten Zeile (im Ausland: Land in der Zeile danach – dort keine Prüfung)
    const anschrift_ = text(d, "kunde_anschrift");
    if (anschrift_) {
      const a = anschriftZerlegen(anschrift_, text(d, "kunde_ust_idnr"));
      if ((!a.land || a.land === "DE") && (!a.plz || !a.ort)) f.push(RECHNUNG_PLZ_FEHLT);
    }
    // Rechnungsbetrag 0 € oder negativ (z. B. Preis nicht lesbar): so nicht teilen – Korrekturen laufen über das Storno
    const pos = positionen(d);
    if (pos.length && !text(d, "storno_zu")) {
      const brutto = summen(pos.map((x) => x.p), kuFuer(d)).brutto_cent;
      if (brutto === 0) f.push(RECHNUNG_NULL);
      else if (brutto < 0) f.push(RECHNUNG_NEGATIV);
    }
    if (pos.some((x) => mengeUngueltig(x.p.menge))) f.push(RECHNUNG_MENGE);
    const nullProzent = positionen(d).some((x) => x.p.ust_satz === 0);
    if (nullProzent && !kuFuer(d) && !text(d, "befreiung") && !auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl")) f.push("Hinweis auf die Steuerbefreiung (bei 0 %)");
    // R11: Steuerschuldnerschaft bzw. igL mit Umsatzsteuer in den Positionen – Widerspruch (§ 14c Abs. 1 UStG); nicht bei Gutschriften und Kleinunternehmern
    if (!kuFuer(d) && !gutschriftD(d) && auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl") && pos.some((x) => (x.p.ust_satz ?? 0) > 0)) f.push(RECHNUNG_RC_MIT_UST);
    if (ja(d, "abschlag") && ja(d, "leistung_gleich") && !text(d, "storno_zu")) f.push(RECHNUNG_ABSCHLAG_LEISTUNG);
    return f;
  },
  // Hinweise, die nicht am Teilen hindern (Kleinunternehmer mit Steuerschuldnerschaft war vorher ein Hindernis – R10)
  hinweise(d, b, extra) {
    const h: string[] = [];
    const ku = kuFuer(d);
    const hw = auswahl(d, "hinweise");
    const gutschrift = istGutschriftD(d);
    const befreiung = befreiungText(d);
    if (befreiung && RC_IM_TEXT.test(befreiung) && !hw.includes("reverse_charge")) h.push(RECHNUNG_13B_TEXT);
    if (!gutschrift && istOeffentlicherEmpfaenger(text(d, "kunde_name")) && !text(d, "kunde_leitweg_id").trim()) h.push(RECHNUNG_LEITWEG);
    const eu = euUnternehmenLand(d);
    const rcOderIgl = hw.includes("reverse_charge") || hw.includes("igl");
    if (!gutschrift) {
      if (ku && hw.includes("igl")) h.push(RECHNUNG_KU_IGL);
      else if (ku && hw.includes("reverse_charge")) h.push(RECHNUNG_KU_RC);
      else if (ku && eu) h.push(RECHNUNG_KU_EU(eu));
      else if (ku && drittlandLand(d) && text(d, "kunde_ust_idnr").trim()) h.push(RECHNUNG_KU_DRITTLAND);
      else if (!ku && eu && !rcOderIgl && positionen(d).some((x) => (x.p.ust_satz ?? 0) > 0)) h.push(RECHNUNG_EU_19(eu));
      if (typeof extra?.kleinunternehmer === "boolean" && extra.kleinunternehmer !== ja(d, "kleinunternehmer")) h.push(RECHNUNG_KU_PROFIL(extra.kleinunternehmer));
      // R11: Leistung vor bzw. nach dem Wechsel von der Kleinunternehmerregelung („Mein Betrieb“)
      const kuBis = isoAus(b.ku_bis ?? "");
      const tag = ja(d, "leistung_gleich") ? isoAus(text(d, "datum")) : (isoAus(text(d, "leistung")) ?? leistungszeitraumAus(text(d, "leistung"))?.bis ?? null);
      if (kuBis && tag && !text(d, "storno_zu")) {
        if (tag <= kuBis && !ku) h.push(RECHNUNG_KU_ZEIT(datumDe(kuBis)));
        else if (tag > kuBis && ku) h.push(RECHNUNG_NACH_KU_ZEIT(datumDe(kuBis)));
      }
      if (gutscheinZuNull(d)) h.push(RECHNUNG_GUTSCHEIN);
      if (extra?.handwerk && !ku && !hw.includes("grundstueck") && !text(d, "kunde_ust_idnr").trim() && !text(d, "storno_zu") && positionen(d).some((x) => (x.p.ust_satz ?? 0) > 0)) h.push(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
    }
    return h;
  },
  ergebnis(d) {
    const ku = kuFuer(d);
    const s = summen(positionen(d).map((x) => x.p), ku);
    // Kleinunternehmer: ohne Umsatzsteuer gibt es kein „Netto“ (R10, Befund Freiberuf)
    return ku ? [["Rechnungsbetrag", euro(s.brutto_cent)]] : [["Netto", euro(s.netto_cent)], ["Umsatzsteuer", euro(s.ust_cent)], ["Rechnungsbetrag", euro(s.brutto_cent)]];
  },
  html(d, b) {
    const ku = kuFuer(d);
    const pos = positionen(d);
    const s = summen(pos.map((x) => x.p), ku);
    // Vorlage zum Ausfüllen (noch keine Position): Beträge leer statt „0,00 €“
    const leer = !pos.length;
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const storno = text(d, "storno_zu");
    // Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Leistungsempfänger rechnet ab und zahlt – keine Zahlungsaufforderung
    const gutschrift = auswahl(d, "hinweise").includes("gutschrift");
    const zeilenHtml = pos.map(({ e, p }, i) => [
      String(i + 1),
      zelle(p.bezeichnung),
      `${zahlText(p.menge, 4)}${text(e, "einheit") ? ` ${esc(einheitFuerMenge(text(e, "einheit"), p.menge))}` : ""}`,
      euro(p.preis_cent),
      ...(ku ? [] : [p.ust_satz === 0 ? "0 %" : `${p.ust_satz} %`]),
      euro(s.zeilen[i]!),
    ]);
    const summenZeilen = [
      // Kleinunternehmer: ohne Umsatzsteuer gibt es kein „netto“
      `<tr><td>${ku ? "Summe" : "Summe netto"}</td><td>${betrag(s.netto_cent)}</td></tr>`,
      ...(ku ? [] : s.gruppen.map((g) => `<tr><td>${g.satz === 0 ? nullProzentText(auswahl(d, "hinweise"), befreiungText(d)) : `Umsatzsteuer ${g.satz} %`} auf ${euro(g.netto_cent)}</td><td>${euro(g.ust_cent)}</td></tr>`)),
      // leere Vorlage: Zeile für die Umsatzsteuer mit Steuersatz zum Eintragen
      ...(leer && !ku ? [`<tr><td>Umsatzsteuer <span class="fuellen kurz"></span> %</td><td>&nbsp;</td></tr>`] : []),
      // Kleinbetragsrechnung (§ 33 Satz 1 Nr. 4 UStDV): der Steuersatz steht beim Gesamtbetrag („inkl. 19 % USt“)
      `<tr class="gesamt"><td>${gutschrift ? "Gutschriftsbetrag" : !ku && !leer && kleinbetrag(d) && s.gruppen.length === 1 && (s.gruppen[0]!.satz ?? 0) > 0 ? `Rechnungsbetrag inkl. ${s.gruppen[0]!.satz} % USt` : "Rechnungsbetrag"}</td><td>${betrag(s.brutto_cent)}</td></tr>`,
    ].join("");
    const leistung = text(d, "leistung");
    const datum = text(d, "datum");
    // schon bezahlt (am oder vor dem Rechnungsdatum, z. B. bar oder im Onlineshop): keine Zahlungsaufforderung
    const bezahltAm = isoAus(text(d, "bezahlt_am"));
    const schonBezahlt = !storno && !gutschrift && !leer && !!bezahltAm && !!datum && bezahltAm <= datum;
    const zahlbar = !storno && !gutschrift && !schonBezahlt;
    // Zahlungsaufforderung mit Verwendungszweck „Rechnung <Nummer>“ (unten, bei hinterlegter IBAN)
    const mitVerwendungszweck = zahlbar && !!b.iban.trim() && (s.brutto_cent > 0 || leer);
    const befreiung = befreiungText(d);
    // Kleinunternehmer mit Leistung an ein Unternehmen im EU-Ausland: Hinweis auf die Steuerschuldnerschaft statt § 19 (der Baustein steht unten)
    const kuRc = ku && auswahl(d, "hinweise").includes("reverse_charge");
    // Pflichthinweise stehen direkt unter den Summen und rücken nicht ohne sie auf eine Folgeseite
    const pflichtHinweise = [
      ...(ku && !kuRc ? [KU_HINWEIS] : []),
      // „Gutschrift“ steht schon als Titel im Betreff
      ...auswahl(d, "hinweise").filter((w) => !(w === "gutschrift" && !storno)).map((w) => (w === "grundstueck" ? GRUNDSTUECK_HINWEIS : (RECHNUNGS_HINWEISE.find((h) => h.wert === w)?.text ?? ""))),
      // ein kurzer Befreiungshinweis steht schon in der Summenzeile
      befreiungInSumme(befreiung) && !ku ? "" : befreiung,
      schonBezahlt ? `Der Rechnungsbetrag wurde am ${datumDe(bezahltAm)} bezahlt.` : "",
    ].filter((x) => x.trim());
    const hinweise = [
      // leere Vorlage: statt „Zahlbar …“ die Zahlungsaufforderung mit Linie für das Datum (unten)
      text(d, "zahlungsziel") && zahlbar && !b.iban.trim() && !leer ? `Zahlbar ${ZIEL[text(d, "zahlungsziel")]}${text(d, "zahlungsziel") !== "sofort" && text(d, "datum") ? ` (bis ${datumDe(faelligAm(text(d, "datum"), Number(text(d, "zahlungsziel")), b.bundesland))})` : ""}.` : "",
      // Stornorechnung: der Hinweis zur Zahlung aus der ursprünglichen Rechnung passt nicht mehr; mit Zahlungsaufforderung
      // steht die Rechnungsnummer schon als Verwendungszweck darin – der Satz wäre doppelt und kostete eine Zeile
      ...text(d, "hinweis").split("\n").filter((h) => !((text(d, "storno_zu") || mitVerwendungszweck || schonBezahlt) && h.trim() === ZAHLUNGS_HINWEIS)),
    ].filter((x) => x.trim());
    // ein bis zwei kurze Hinweise: mit dem Gruß in einem Absatz (R10)
    const kurzerSchluss = hinweise.length > 0 && hinweise.length <= 2 && hinweise.every((h) => h.length <= 90);
    const ziel = text(d, "zahlungsziel");
    const faellig = ziel && ziel !== "sofort" && datum ? datumDe(faelligAm(datum, Number(ziel), b.bundesland)) : "";
    const iban = b.iban.trim();
    // Zahlungsaufforderung mit Bankverbindung und GiroCode – nur aus den Angaben in „Mein Betrieb“ und der Rechnung
    // kein GiroCode für Empfänger außerhalb der EU (z. B. Schweiz) – dort zahlt kaum jemand per SEPA-Überweisung aus der Banking-App
    const qr = zahlbar && iban && s.brutto_cent > 0 && !drittlandLand(d) ? giroCodeSvg({ name: b.name.trim(), iban, bic: b.bic ?? null, betragCent: s.brutto_cent, verwendungszweck: `Rechnung ${text(d, "nummer")}` }, 25) : null;
    // Kontoinhaber vor der IBAN; Einzelunternehmen mit der Inhaberin bzw. dem Inhaber (Gesellschaften: nur die Firma)
    const empfaenger = b.name.trim() ? `Empfänger: ${esc(b.name.trim())}${b.verantwortlich.trim() && !(b.vertretung ?? "").trim() && !b.name.includes(b.verantwortlich.trim()) ? ` (${esc(b.verantwortlich.trim())})` : ""}<br>` : "";
    // BIC und Bank in einer Zeile („BIC … · Sparkasse …“) – spart eine Zeile im Zahlungsblock
    const bicBank = [b.bic?.trim() ? `BIC ${esc(b.bic.trim())}` : "", b.bank?.trim() ? esc(b.bank.trim()) : ""].filter(Boolean).join(" · ");
    const zahlung =
      zahlbar && iban && s.brutto_cent > 0
        ? `<div class="zahlung">${qr ? `<div class="qr">${qr}<small>GiroCode – mit der Banking-App scannen</small></div>` : ""}<div class="text"><p>Bitte überweisen Sie <strong>${euro(s.brutto_cent)}</strong>${faellig ? ` bis zum <strong>${esc(faellig)}</strong>` : ziel === "sofort" ? " sofort ohne Abzug" : ""} auf das Konto</p><p>${empfaenger}<strong>IBAN ${esc(ibanText(iban))}</strong>${bicBank ? `<br>${bicBank}` : ""}<br>Verwendungszweck: Rechnung ${esc(text(d, "nummer"))}</p></div></div>`
        : // leere Vorlage: Zahlungsaufforderung mit Linie für das Datum, mit Bankverbindung nur, wenn eine IBAN hinterlegt ist
          leer && !storno && !gutschrift
          ? `<div class="zahlung"><div class="text"><p>Bitte überweisen Sie den Rechnungsbetrag bis zum ${LINIE_MITTEL}${iban ? " auf das Konto" : "."}</p>${iban ? `<p>${empfaenger}<strong>IBAN ${esc(ibanText(iban))}</strong>${bicBank ? `<br>${bicBank}` : ""}<br>Verwendungszweck: Rechnung ${text(d, "nummer") ? esc(text(d, "nummer")) : LINIE_MITTEL}</p>` : ""}</div></div>`
          : "";
    const anrede = text(d, "kunde_name") ? (storno ? `wir stornieren hiermit die oben genannte Rechnung und schreiben Ihnen den Betrag wie folgt gut:` : gutschrift ? `wir rechnen über die folgenden Leistungen ab und schreiben Ihnen den Betrag gut:` : schonBezahlt ? `für die folgenden Leistungen, die Sie bereits bezahlt haben, erhalten Sie diese Rechnung:` : `wie vereinbart berechnen wir Ihnen folgende Leistungen:`) : "";
    const titel = `${rechnungsTitel(d)} ${text(d, "nummer")}`.trim();
    return brief({
      titel,
      betreff: titel,
      // der Leistungszeitraum steht im Informationsblock („Leistungsdatum“ bzw. „Leistungszeitraum“), nicht noch einmal unter dem Betreff
      unterBetreff: storno ? `Diese Rechnung storniert die Rechnung Nr. ${storno}${text(d, "storno_zu_datum") ? ` vom ${datumDe(text(d, "storno_zu_datum"))}` : ""}.` : undefined,
      betrieb: b,
      stand: datumDe(datum),
      // Schweizer UID (CHE-…) heißt „UID/MWST-Nr.“, nicht USt-IdNr.
      empfaenger: { name: text(d, "kunde_name"), anschrift: text(d, "kunde_anschrift"), zusatz: text(d, "kunde_ust_idnr") ? `${/^\s*CHE/i.test(text(d, "kunde_ust_idnr")) ? "UID/MWST-Nr." : "USt-IdNr."} ${text(d, "kunde_ust_idnr")}` : undefined },
      // Reihenfolge nach DIN 5008: Bezugszeichen oben, das Datum abgesetzt als letzte Zeile (halbfett)
      info: [
        ["Rechnungsnummer", text(d, "nummer"), true],
        // ein einzelnes Datum heißt „Leistungsdatum“, alles andere (z. B. „Oktober 2026“, „02.03. – 27.03.2026“) „Leistungszeitraum“
        [ja(d, "leistung_gleich") || isoAus(leistung) || !leistung.trim() ? "Leistungsdatum" : "Leistungszeitraum", ja(d, "leistung_gleich") ? datumDe(datum) : leistung],
        ...(text(d, "bestellnummer").trim() ? ([["Ihre Bestellnummer", text(d, "bestellnummer").trim()]] as [string, string][]) : []),
        ...(text(d, "kunde_leitweg_id").trim() ? ([["Leitweg-ID", text(d, "kunde_leitweg_id").trim()]] as [string, string][]) : []),
        // Gutschrift: Steuernummer bzw. USt-IdNr. des Leistenden (§ 14 Abs. 4 Nr. 2 UStG) – nicht die des ausstellenden Betriebs
        ...(gutschrift && !storno
          ? ([["Steuernr. Leistender", text(d, "kunde_steuernummer").trim()], ["USt-IdNr. Leistender", text(d, "kunde_ust_idnr").trim()]] as [string, string][])
          : ([["Steuernummer", b.steuernummer.trim()], ["USt-IdNr.", b.ust_idnr.trim()]] as [string, string][])),
        ["Ansprechperson", b.verantwortlich.trim()],
        ["Telefon", b.telefon.trim()],
        ["E-Mail", b.email.trim()],
        null,
        ["Rechnungsdatum", datumDe(datum), false, true],
      ],
      anrede: anrede ? `${(text(d, "anrede") || ANREDE_STANDARD).replace(/[,\s]+$/, "")},` : undefined,
      inhalt:
        (anrede ? `<p>${esc(anrede)}</p>` : "") +
        `<section>${tabelle(["Pos.", "Leistung", "Menge", "Einzelpreis", ...(ku ? [] : ["USt"]), "Betrag"], zeilenHtml, { breiten: ku ? ["5%", "54%", "13%", "13%", "15%"] : ["5%", "47%", "13%", "13%", "7%", "15%"], zahlen: ku ? [2, 3, 4] : [2, 3, 4, 5], ...(leer ? { mindestens: 5, hoch: true } : {}) })}</section>` +
        // Summenblock beginnt an der Mengenspalte (CSS .g-brief .summen bzw. .summen.ku)
        `<table class="summen${ku ? " ku" : ""}">${summenZeilen}</table>` +
        // Pflichthinweise (Steuerbefreiung, Steuerschuldnerschaft, § 19 …) gehören zu den Beträgen: direkt darunter, ohne Umbruch davor
        (pflichtHinweise.length ? `<div class="pflichthinweise">${pflichtHinweise.map((h) => `<p>${esc(h)}</p>`).join("")}</div>` : "") +
        // Die Zahlungsaufforderung bleibt bei den Summen (CSS: kein Umbruch davor und darin); passt der Schluss nicht mehr
        // auf die Seite, rücken nur weitere Hinweise und Gruß auf die Folgeseite
        `<div class="abschluss">` +
        zahlung +
        `<div class="schluss">` +
        // R10 (Seite 2 nur mit Gruß): kurze Hinweise (z. B. „Vielen Dank für Ihren Auftrag.“) stehen im selben Absatz wie der
        // Gruß, und die Firma steht nicht noch einmal darunter (sie steht im Briefkopf) – so passt der Schluss öfter auf Seite 1
        (kurzerSchluss ? "" : hinweise.length ? `<div class="gruss">${hinweise.map((h) => `<p>${esc(h)}</p>`).join("")}</div>` : "") +
        `<p class="gruss"${kurzerSchluss ? ' style="margin-top:2.4mm"' : ""}>${kurzerSchluss ? hinweise.map((h) => `${esc(h)}<br>`).join("") : ""}Mit freundlichen Grüßen<br>${esc(b.verantwortlich.trim() || b.name.trim())}</p></div></div>`,
    });
  },
};

// ---------------------------------------------------------------- EÜR

/**
 * Zeilen der Anlage EÜR zum Auswählen: die Liste aus der Recherche, ergänzt um jede Zeile, die „EÜR übernehmen“ aus den
 * Belegkategorien (belege.ts) einträgt – wortgleich, damit übernommene Zeilen in der Vorschlagsliste stehen. Fehlende
 * Zeilen stehen vor der Zeile, bei der sie im Vordruck einsortiert sind (sonst am Ende).
 */
function zeilenMit(liste: string[], dazu: string[], vor: Record<string, string> = {}): string[] {
  const r = [...liste];
  for (const z of new Set(dazu)) {
    if (r.includes(z)) continue;
    const i = vor[z] ? r.indexOf(vor[z]) : -1;
    if (i >= 0) r.splice(i, 0, z);
    else r.push(z);
  }
  return r;
}
const EUER_AUSGABEN_ZEILEN = zeilenMit(
  EUER_AUSGABEN,
  KATEGORIEN.map((k) => k.euer),
  {
    "Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke": "Miete/Aufwendungen für doppelte Haushaltsführung",
    "Kraftfahrzeugkosten und andere Fahrtkosten": "Fahrtkosten für nicht zum Betriebsvermögen gehörende Fahrzeuge",
  },
);
const EUER_EINNAHMEN_ZEILEN = zeilenMit(EUER_EINNAHMEN, [EUER_ZEILE_STEUERPFLICHTIG, EUER_ZEILE_STEUERFREI]);

/** Warnung bei der EÜR, wenn „Mein Betrieb“ eine Kapitalgesellschaft ist (Rechtsform bzw. Zusatz im Namen). */
export const EUER_KAPITALGESELLSCHAFT = "Kapitalgesellschaften erstellen eine Bilanz statt einer EÜR – bitte prüfen.";

export const euer: Vorlage = {
  id: "euer",
  gestalt: "formular",
  titel: "Einnahmen-Überschuss-Rechnung (EÜR)",
  beschreibung: "Einnahmen und Ausgaben eines Jahres mit Überschuss – als Aufstellung für deine Unterlagen und zum Übertragen in die Anlage EÜR.",
  bereich: "steuern",
  pflichten: ["steuern.euer"],
  grundlage: "§ 4 Abs. 3 EStG; § 60 Abs. 4 EStDV",
  namensFeld: "jahr",
  abschnitte: [
    { titel: "Jahr",
      hilfe: "Die Anlage EÜR übermittelst du elektronisch über ELSTER. Diese Aufstellung sammelt die Zahlen dafür.",
      felder: [{ id: "jahr", art: "text", label: "Jahr", hilfe: "z. B. 2026", pflicht: true }],
    },
    {
      titel: "Einnahmen",
      hilfe: "Was im Jahr eingegangen ist.",
      felder: [{ id: "einnahmen", art: "liste", label: "Einnahmen", eintrag: "Einnahme", titelFeld: "text", pflicht: true, felder: [{ id: "datum", art: "datum", label: "Datum" }, { id: "text", art: "text", label: "Bezeichnung", hilfe: "z. B. Umsätze Oktober", pflicht: true }, { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_EINNAHMEN_ZEILEN }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
    },
    {
      titel: "Ausgaben",
      hilfe: "Was im Jahr bezahlt wurde.",
      felder: [
        {
          id: "ausgaben",
          art: "liste",
          label: "Ausgaben",
          eintrag: "Ausgabe",
          titelFeld: "text",
          felder: [
            { id: "datum", art: "datum", label: "Datum" },
            { id: "text", art: "text", label: "Bezeichnung", hilfe: "z. B. Miete Oktober", pflicht: true },
            { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_AUSGABEN_ZEILEN },
            { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true },
          ],
        },
      ],
    },
    {
      titel: "Abschreibungen",
      hilfe: "Für größere Anschaffungen, die über mehrere Jahre abgeschrieben werden: nur der Betrag für dieses Jahr. Computer, Notebooks, Tablets, Peripherie und Software darfst du statt über 3 Jahre auch über 1 Jahr abschreiben – dann der volle Betrag im Jahr der Anschaffung (BMF-Schreiben vom 22.02.2022).",
      felder: [{ id: "afa", art: "liste", label: "Abschreibungen", eintrag: "Abschreibung", titelFeld: "text", felder: [{ id: "text", art: "text", label: "Wirtschaftsgut", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag dieses Jahr (€)", pflicht: true }] }],
    },
  ],
  pruefen(_d, b) {
    // Hinweis, kein Hindernis: die Vorlage bleibt nutzbar (z. B. für eine Gesellschaft, die die Rechtsform noch wechselt)
    return istKapitalgesellschaft(b.rechtsform, b.name) ? [EUER_KAPITALGESELLSCHAFT] : [];
  },
  ergebnis(d) {
    // wie im Dokument: Betriebsausgaben ohne AfA, AfA eigens, Ergebnis nach Abzug beider
    const e = summe(liste(d, "einnahmen"), "betrag");
    const a = summe(liste(d, "ausgaben"), "betrag");
    const f = summe(liste(d, "afa"), "betrag");
    const g = e - a - f;
    return [["Einnahmen", euro(e)], ["Ausgaben", euro(a)], ["AfA", euro(f)], [g >= 0 ? "Gewinn" : "Verlust", euro(Math.abs(g))]];
  },
  html(d, b) {
    const ein = liste(d, "einnahmen").filter((x) => text(x, "text") || text(x, "betrag"));
    const aus = liste(d, "ausgaben").filter((x) => text(x, "text") || text(x, "betrag"));
    const afa = liste(d, "afa").filter((x) => text(x, "text") || text(x, "betrag"));
    const e = summe(ein, "betrag");
    const a = summe(aus, "betrag");
    const f = summe(afa, "betrag");
    const kategorie = (x: Eintrag) => text(x, "kategorie") || "ohne Kategorie";
    const kategorien = [...new Set(aus.map(kategorie))];
    const kategorienEin = [...new Set(ein.map(kategorie))];
    // Summen je Zeile der Anlage EÜR (nur bei mehr als einer Zeile – sonst stünde dieselbe Summe zweimal da)
    const nachZeilen = (titel: string, l: Eintrag[], k: string[]) => (k.length > 1 ? abschnitt(titel, kennzahlen(k.map((z) => ({ text: z, betrag: euro(summe(l.filter((x) => kategorie(x) === z), "betrag")) })))) : "");
    const z = (l: Eintrag[]) => l.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "text")), zelle(text(x, "kategorie")), euro(cent(text(x, "betrag")) ?? 0)]);
    const ergebnis = e - a - f;
    // Vorlage zum Ausfüllen (nichts erfasst): Beträge leer statt „0,00 €“, Tabellen mit Zeilen zum Eintragen
    const leer = !ein.length && !aus.length && !afa.length;
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const kopfZeile = ["Datum", "Bezeichnung", "Zeile der Anlage EÜR", "Betrag"];
    const breiten = ["14%", "42%", "26%", "18%"];
    // leere Tabelle: Summenzeile mit Linie zum Eintragen
    const summeLeer = ["<strong>Summe</strong>", "", "", ZELLE_LINIE];
    return dokument({
      titel: "Einnahmen-Überschuss-Rechnung",
      betrieb: b,
      unter: text(d, "jahr") ? `Gewinnermittlung nach § 4 Abs. 3 EStG für ${text(d, "jahr")}` : undefined,
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Jahr: ${text(d, "jahr") || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Ergebnis",
          kennzahlen([
            { text: "Summe der Betriebseinnahmen", betrag: betrag(e) },
            { text: "Summe der Betriebsausgaben", betrag: betrag(a) },
            { text: "Absetzungen für Abnutzung (AfA)", betrag: betrag(f) },
            { text: leer ? "Gewinn bzw. Verlust" : ergebnis >= 0 ? "Gewinn" : "Verlust", hinweis: "Betriebseinnahmen abzüglich Betriebsausgaben und AfA", betrag: betrag(Math.abs(ergebnis)), fett: true },
          ]),
        ) +
        nachZeilen("Betriebseinnahmen nach Zeilen der Anlage EÜR", ein, kategorienEin) +
        nachZeilen("Betriebsausgaben nach Zeilen der Anlage EÜR", aus, kategorien) +
        abschnitt("Betriebseinnahmen", ein.length ? tabelle(kopfZeile, z(ein), { breiten, zahlen: [3], summe: ["<strong>Summe</strong>", "", "", `<strong>${euro(e)}</strong>`] }) : leer ? tabelle(kopfZeile, [], { breiten, zahlen: [3], mindestens: EUER_LEER_EINNAHMEN, hoch: true, summe: summeLeer }) : absatz("", "Keine Einnahmen erfasst.")) +
        abschnitt("Betriebsausgaben", aus.length ? tabelle(kopfZeile, z(aus), { breiten, zahlen: [3], summe: ["<strong>Summe</strong>", "", "", `<strong>${euro(a)}</strong>`] }) : leer ? tabelle(kopfZeile, [], { breiten, zahlen: [3], mindestens: EUER_LEER_AUSGABEN, hoch: true, summe: summeLeer }) : absatz("", "Keine Ausgaben erfasst.")) +
        (leer ? abschnitt("Absetzungen für Abnutzung", tabelle(["Wirtschaftsgut", "Betrag dieses Jahr"], [], { breiten: ["75%", "25%"], zahlen: [1], mindestens: 3, hoch: true, summe: ["<strong>Summe</strong>", ZELLE_LINIE] })) : "") +
        (afa.length ? abschnitt("Absetzungen für Abnutzung", tabelle(["Wirtschaftsgut", "Betrag dieses Jahr"], afa.map((x) => [zelle(text(x, "text")), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["75%", "25%"], zahlen: [1], summe: ["<strong>Summe</strong>", `<strong>${euro(f)}</strong>`] })) : "") +
        uebertragung(["Anlage EÜR übermittelt am", "Transferticket (ELSTER)"]),
    });
  },
};

/** Leere EÜR: Zeilen zum Eintragen – so viele, dass auch Seite 2 (Ausgaben, AfA) gefüllt ist. */
const EUER_LEER_EINNAHMEN = 8;
const EUER_LEER_AUSGABEN = 24;

// ---------------------------------------------------------------- Bilanz und GuV

const posten = (id: string, label: string, eintrag: string, hilfe: string) => ({
  id,
  art: "liste" as const,
  label,
  eintrag,
  titelFeld: "posten",
  felder: [{ id: "posten", art: "text" as const, label: "Posten", hilfe, pflicht: true }, { id: "betrag", art: "betrag" as const, label: "Betrag (€)", pflicht: true }],
});

export const bilanzGuv: Vorlage = {
  id: "bilanz_guv",
  gestalt: "formular",
  titel: "Bilanz und Gewinn- und Verlustrechnung",
  beschreibung: "Vorläufige Übersicht – kein Jahresabschluss: Erträge und Aufwendungen, Vermögen und Kapital – mit Prüfung, ob Aktiva und Passiva aufgehen.",
  bereich: "steuern",
  pflichten: ["steuern.buchfuehrungspflicht", "steuern.e_bilanz"],
  grundlage: "§§ 238, 242 HGB; § 5b EStG",
  namensFeld: "stichtag",
  abschnitte: [
    { titel: "Stichtag",
      hilfe: "Vorläufige Übersicht – kein Jahresabschluss. Die Zahlen kommen aus deiner Buchführung; den Jahresabschluss und die E-Bilanz ans Finanzamt erstellst du meist mit Buchhaltungsprogramm oder Steuerberatung.",
      felder: [{ id: "stichtag", art: "datum", label: "Bilanzstichtag", pflicht: true }],
    },
    { titel: "Gewinn- und Verlustrechnung", felder: [posten("ertraege", "Erträge", "Ertrag", "z. B. Umsatzerlöse"), posten("aufwendungen", "Aufwendungen", "Aufwand", "z. B. Materialaufwand, Personalaufwand")] },
    { titel: "Bilanz", felder: [posten("aktiva", "Aktiva", "Aktivposten", "z. B. Betriebs- und Geschäftsausstattung, Bank"), posten("passiva", "Passiva", "Passivposten", "z. B. Eigenkapital, Verbindlichkeiten")] },
  ],
  ergebnis(d) {
    const j = summe(liste(d, "ertraege"), "betrag") - summe(liste(d, "aufwendungen"), "betrag");
    const akt = summe(liste(d, "aktiva"), "betrag");
    const pas = summe(liste(d, "passiva"), "betrag");
    return [[j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", euro(Math.abs(j))], ["Summe Aktiva", euro(akt)], ["Summe Passiva", euro(pas)], ...(akt !== pas ? ([["Differenz – bitte prüfen", euro(akt - pas)]] as [string, string][]) : [])];
  },
  html(d, b) {
    const l = (k: string) => liste(d, k).filter((x) => text(x, "posten") || text(x, "betrag"));
    const t = (k: string) => {
      const x = l(k);
      // leer (Vorlage zum Ausfüllen): 8 hohe Leerzeilen, Summenzeile mit Linie zum Eintragen statt „0,00 €“
      if (!x.length) return tabelle(["Posten", "Betrag"], [], { breiten: ["72%", "28%"], zahlen: [1], mindestens: 8, hoch: true, summe: ["<strong>Summe</strong>", ZELLE_LINIE] });
      return tabelle(["Posten", "Betrag"], x.map((e) => [zelle(text(e, "posten")), euro(cent(text(e, "betrag")) ?? 0)]), { breiten: ["72%", "28%"], zahlen: [1], summe: ["<strong>Summe</strong>", `<strong>${euro(summe(x, "betrag"))}</strong>`] });
    };
    // Bilanz als eine Tabelle (Aktiva links, Passiva rechts): jede Zeile gleich hoch, die Summen stehen auf einer Linie
    // (mit Doppellinie). Leer: 12 hohe Zeilen zum Ausfüllen, Summen als Linie
    const bilanz = () => {
      const a = l("aktiva");
      const p = l("passiva");
      const n = Math.max(a.length, p.length);
      const seite = (x: Eintrag[], i: number) => (x[i] ? [zelle(text(x[i]!, "posten")), euro(cent(text(x[i]!, "betrag")) ?? 0)] : ["&nbsp;", ""]);
      const s_ = (x: Eintrag[]) => (x.length ? `<strong>${euro(summe(x, "betrag"))}</strong>` : ZELLE_LINIE);
      return tabelle(["Aktiva", "Betrag", "Passiva", "Betrag"], Array.from({ length: n }, (_, i) => [...seite(a, i), ...seite(p, i)]), {
        breiten: ["33%", "17%", "33%", "17%"],
        zahlen: [1, 3],
        summe: ["<strong>Summe</strong>", s_(a), "<strong>Summe</strong>", s_(p)],
        klasse: "doppelt bilanz",
        ...(n ? {} : { mindestens: 12, hoch: true }),
      });
    };
    const j = summe(l("ertraege"), "betrag") - summe(l("aufwendungen"), "betrag");
    // Vorlage zum Ausfüllen: kein errechnetes Ergebnis „0,00 €“
    const guvLeer = !l("ertraege").length && !l("aufwendungen").length;
    const akt = summe(l("aktiva"), "betrag");
    const pas = summe(l("passiva"), "betrag");
    return dokument({
      titel: "Jahresabschluss",
      betrieb: b,
      // in der Reihenfolge der Abschnitte: erst die GuV, dann die Bilanz
      unter: text(d, "stichtag") ? `Gewinn- und Verlustrechnung und Bilanz zum ${datumDe(text(d, "stichtag"))}` : "Gewinn- und Verlustrechnung und Bilanz",
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Bilanzstichtag: ${datumDe(text(d, "stichtag")) || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt("Gewinn- und Verlustrechnung", `<h3>Erträge</h3>${t("ertraege")}<h3>Aufwendungen</h3>${t("aufwendungen")}${kennzahlen([{ text: guvLeer ? "Jahresüberschuss bzw. Jahresfehlbetrag" : j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", betrag: guvLeer ? "&nbsp;" : euro(Math.abs(j)), fett: true }])}`) +
        abschnitt("Bilanz", `${bilanz()}${akt !== pas ? `<p class="nachsatz"><strong>Aktiva und Passiva weichen um ${euro(akt - pas)} ab – bitte prüfen.</strong></p>` : ""}`) +
        unterschriften(["Unterschrift"], { ortDatum: true }),
    });
  },
};

// ---------------------------------------------------------------- Umsatzsteuer-Voranmeldung

function ust(d: Daten) {
  const u19 = cent(text(d, "umsatz_19")) ?? 0;
  const u7 = cent(text(d, "umsatz_7")) ?? 0;
  const s19 = rundeCent((u19 * 19) / 100);
  const s7 = rundeCent((u7 * 7) / 100);
  const vst = cent(text(d, "vorsteuer")) ?? 0;
  // § 13b als Leistungsempfänger (R10): Steuer Kz 47/85, Vorsteuer daraus Kz 67; Sondervorauszahlung Kz 39
  const s47 = cent(text(d, "rc_eu_steuer")) ?? 0;
  const s85 = cent(text(d, "rc_bau_steuer")) ?? 0;
  const v67 = cent(text(d, "vorsteuer_13b")) ?? 0;
  const svz = cent(text(d, "sondervorauszahlung")) ?? 0;
  const steuer = s19 + s7 + s47 + s85;
  return { u19, u7, s19, s7, vst, s47, s85, v67, svz, steuer, zahllast: steuer - vst - v67 - svz };
}

/** Welche Kennzahl für übrige Umsätze ohne Umsatzsteuer gilt (Vordruckmuster USt 1 A). */
const KZ_FREI_HINWEIS = "welche Kennzahl gilt (z. B. 43 steuerfreie Umsätze mit Vorsteuerabzug, 21 nicht steuerbare sonstige Leistungen nach § 18b UStG, 45 übrige nicht steuerbare Umsätze, 87 Umsätze zum Nullsteuersatz nach § 12 Abs. 3 UStG), hängt von der Art des Umsatzes ab";
/** Felder der Voranmeldung mit Umsätzen ohne Umsatzsteuer und ihre Kennzahl. */
const UST_OHNE_STEUER: { id: string; kz?: string; text: string; hinweis?: string }[] = [
  { id: "umsatz_igl", kz: "41", text: "Innergemeinschaftliche Lieferungen an Abnehmer mit USt-IdNr.", hinweis: "§ 4 Nr. 1 Buchst. b, § 6a UStG – auch in der Zusammenfassenden Meldung" },
  { id: "umsatz_43", kz: "43", text: "Weitere steuerfreie Umsätze mit Vorsteuerabzug", hinweis: "z. B. Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a, Nr. 2 bis 7 UStG)" },
  { id: "umsatz_48", kz: "48", text: "Steuerfreie Umsätze ohne Vorsteuerabzug", hinweis: "§ 4 Nr. 8 bis 29 UStG; Vorsteuer aus Eingangsleistungen für diese Umsätze ist nicht abziehbar (§ 15 Abs. 2 UStG)" },
  { id: "umsatz_87", kz: "87", text: "Umsätze zum Nullsteuersatz", hinweis: "§ 12 Abs. 3 UStG, z. B. Photovoltaikanlagen" },
  { id: "umsatz_13b", kz: "60", text: "Steuerpflichtige Umsätze im Inland, für die der Leistungsempfänger die Steuer schuldet", hinweis: "§ 13b Abs. 5 UStG, z. B. Bauleistungen an Bauunternehmen" },
  { id: "umsatz_21", kz: "21", text: "Nicht steuerbare sonstige Leistungen an Unternehmen im übrigen Gemeinschaftsgebiet", hinweis: "§ 3a Abs. 2, § 18b Satz 1 Nr. 2 UStG – der Empfänger schuldet die Steuer; auch in der Zusammenfassenden Meldung" },
  { id: "umsatz_45", kz: "45", text: "Übrige nicht steuerbare Umsätze (Leistungsort nicht im Inland)", hinweis: "z. B. Dienstleistungen an Unternehmen außerhalb der EU" },
  { id: "umsatz_frei", text: "Weitere steuerfreie oder nicht steuerbare Umsätze", hinweis: `${KZ_FREI_HINWEIS[0]!.toUpperCase()}${KZ_FREI_HINWEIS.slice(1)}` },
];

/** Hinweis bei steuerfreien Umsätzen ohne Vorsteuerabzug (Voranmeldung, Steuerberater-Paket). */
export const VORSTEUER_AUFTEILEN = "Steuerfreie Umsätze ohne Vorsteuerabzug und Vorsteuer im selben Zeitraum: Vorsteuer aus Eingangsleistungen, die diesen Umsätzen dienen, ist nicht abziehbar (§ 15 Abs. 2 UStG); dienen sie beiden Arten von Umsätzen, ist sie aufzuteilen (§ 15 Abs. 4 UStG). Bitte die Vorsteuer prüfen.";

export const VERSTEUERUNG: Option[] = [
  { wert: "soll", text: "Soll – der Normalfall" },
  // freie Berufe dürfen auf Antrag nach vereinnahmten Entgelten versteuern (§ 20 Satz 1 Nr. 3 UStG) – dort der übliche Fall
  { wert: "ist", text: "Ist – auf Antrag, bei freien Berufen üblich" },
];

/** Hinweis zur Frist mit Dauerfristverlängerung (§ 18 Abs. 6 UStG, §§ 46–48 UStDV) bzw. ohne. */
export const UST_FRIST = "bis zum 10. Tag nach Ablauf des Zeitraums zu übermitteln und zu zahlen (§ 18 Abs. 1 UStG)";
export const UST_FRIST_DFV = "mit Dauerfristverlängerung einen Monat später: bis zum 10. Tag des zweiten Monats nach Ablauf des Zeitraums (§ 18 Abs. 6 UStG, § 46 UStDV)";

export const ustVoranmeldung: Vorlage = {
  id: "ust_voranmeldung",
  gestalt: "formular",
  titel: "Umsatzsteuer-Voranmeldung",
  beschreibung: "Umsätze nach Steuersatz und Vorsteuer – die App rechnet Umsatzsteuer und Zahllast aus, du überträgst die Zahlen in ELSTER.",
  bereich: "steuern",
  pflichten: ["steuern.ust_voranmeldung"],
  ausRechnungen: true,
  ausBetrieb: { versteuerung: "versteuerung" },
  ausProfil: { dauerfrist: "ust.dauerfristverlaengerung" },
  grundlage: "§ 18 Abs. 1 UStG",
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum",
      hilfe: "Die Voranmeldung übermittelst du elektronisch über ELSTER. Diese Unterlage rechnet die Zahlen dafür aus – aus deinen Rechnungen in Amtlos oder von Hand – und bleibt bei deinen Unterlagen.",
      felder: [
        { id: "versteuerung", art: "wahl", label: "Wie versteuerst du?", optionen: VERSTEUERUNG, vorbelegung: "soll", hilfe: "Soll: Umsätze zählen im Zeitraum, in dem du die Leistung erbracht hast (§ 13 Abs. 1 Nr. 1 a UStG). Ist: im Zeitraum, in dem das Geld eingegangen ist (§ 13 Abs. 1 Nr. 1 b, § 20 UStG) – nur, wenn das Finanzamt es dir genehmigt hat; für freie Berufe (§ 20 Satz 1 Nr. 3 UStG) und bei Umsatz bis 800.000 € im Vorjahr ist das auf Antrag der übliche Weg." },
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026 oder 3. Quartal 2026", pflicht: true },
        { id: "dauerfrist", selten: true, art: "schalter", label: "Dauerfristverlängerung", hilfe: "Dann gibst du die Voranmeldung einen Monat später ab (§ 18 Abs. 6 UStG). Monatszahler leisten dafür eine Sondervorauszahlung." },
      ],
    },
    {
      titel: "Umsätze (netto)",
      felder: [
        { id: "umsatz_19", art: "betrag", label: "Umsätze zu 19 % (€)" },
        { id: "umsatz_7", art: "betrag", label: "Umsätze zu 7 % (€)", hilfe: "seit 2026 auch Speisen in Restaurant und Café (ohne Getränke)" },
        { id: "umsatz_igl", selten: true, art: "betrag", label: "Innergemeinschaftliche Lieferungen an Abnehmer mit USt-IdNr. (Kz 41) (€)", hilfe: "aus Rechnungen mit dem Hinweis „innergemeinschaftliche Lieferung“" },
        { id: "umsatz_48", selten: true, art: "betrag", label: "Steuerfreie Umsätze ohne Vorsteuerabzug (Kz 48) (€)", hilfe: "Steuerbefreiungen nach § 4 Nr. 8 bis 29 UStG, z. B. Heilbehandlungen (§ 4 Nr. 14 UStG)" },
        { id: "umsatz_13b", selten: true, art: "betrag", label: "Umsätze im Inland, für die der Leistungsempfänger die Steuer schuldet (Kz 60) (€)", hilfe: "aus Rechnungen mit dem Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ an Kunden in Deutschland (§ 13b Abs. 5 UStG)" },
        { id: "umsatz_21", selten: true, art: "betrag", label: "Sonstige Leistungen an Unternehmen im EU-Ausland (Kz 21) (€)", hilfe: "aus Rechnungen mit Steuerschuldnerschaft des Leistungsempfängers an Kunden im EU-Ausland (§ 3a Abs. 2, § 18b UStG)" },
        { id: "umsatz_87", selten: true, art: "betrag", label: "Umsätze zum Nullsteuersatz (Kz 87) (€)", hilfe: "z. B. Photovoltaikanlagen (§ 12 Abs. 3 UStG)" },
        { id: "umsatz_43", selten: true, art: "betrag", label: "Weitere steuerfreie Umsätze mit Vorsteuerabzug (Kz 43) (€)", hilfe: "z. B. Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a UStG)" },
        { id: "umsatz_45", selten: true, art: "betrag", label: "Übrige nicht steuerbare Umsätze (Kz 45) (€)", hilfe: "Leistungsort nicht im Inland, z. B. Dienstleistungen an Unternehmen außerhalb der EU" },
        { id: "umsatz_frei", selten: true, art: "betrag", label: "Weitere Umsätze ohne Umsatzsteuer (€)", hilfe: `z. B. steuerfreie Umsätze – ${KZ_FREI_HINWEIS}` },
      ],
    },
    {
      titel: "Steuerschuldnerschaft als Leistungsempfänger (§ 13b UStG)",
      hilfe: "Wenn du Leistungen bezogen hast, für die du die Umsatzsteuer schuldest – z. B. ein Abo bei einem Anbieter aus dem EU-Ausland oder die Bauleistung eines Subunternehmers. Das gilt auch für Kleinunternehmer.",
      felder: [
        { id: "rc_eu_netto", selten: true, art: "betrag", label: "Sonstige Leistungen von Unternehmen aus dem EU-Ausland (Kz 46) (€)", hilfe: "Bemessungsgrundlage (§ 13b Abs. 1 UStG)" },
        { id: "rc_eu_steuer", selten: true, art: "betrag", label: "Darauf Umsatzsteuer (Kz 47) (€)" },
        { id: "rc_bau_netto", selten: true, art: "betrag", label: "Andere Leistungen, z. B. Bauleistungen (Kz 84) (€)", hilfe: "Bemessungsgrundlage (§ 13b Abs. 2 Nr. 1, 2, 4 bis 12 UStG)" },
        { id: "rc_bau_steuer", selten: true, art: "betrag", label: "Darauf Umsatzsteuer (Kz 85) (€)" },
      ],
    },
    {
      titel: "Vorsteuer",
      felder: [
        { id: "vorsteuer", art: "betrag", label: "Vorsteuer aus Eingangsrechnungen (€)", pflicht: true },
        { id: "vorsteuer_13b", selten: true, art: "betrag", label: "Vorsteuer aus Leistungen nach § 13b UStG (Kz 67) (€)", hilfe: "die selbst geschuldete Steuer aus Kz 47/85 – nur mit Vorsteuerabzug, also nicht als Kleinunternehmer" },
        { id: "sondervorauszahlung", selten: true, art: "betrag", label: "Abzug der Sondervorauszahlung (Kz 39) (€)", hilfe: "nur für Monatszahler mit Dauerfristverlängerung, in der Voranmeldung für Dezember (§§ 46–48 UStDV) – wer vierteljährlich abgibt, leistet keine Sondervorauszahlung" },
        { id: "notiz", selten: true, art: "mehrzeilig", label: "Notiz", hilfe: "z. B. Besonderheiten in diesem Zeitraum" },
      ],
    },
  ],
  ergebnis(d) {
    const x = ust(d);
    return [["Umsatzsteuer", euro(x.steuer)], ["Vorsteuer", euro(x.vst + x.v67)], ...(x.svz ? ([["Sondervorauszahlung", euro(x.svz)]] as [string, string][]) : []), [x.zahllast >= 0 ? "Zahllast" : "Erstattung", euro(Math.abs(x.zahllast))]];
  },
  html(d, b) {
    const x = ust(d);
    const ohneSteuer = UST_OHNE_STEUER.map((f) => ({ ...f, cent: cent(text(d, f.id)) ?? 0 })).filter((f) => f.cent);
    const ist = text(d, "versteuerung") === "ist";
    // Vorlage zum Ausfüllen (keine Beträge eingegeben): Beträge leer statt „0,00 €“
    const leer = !["umsatz_19", "umsatz_7", "vorsteuer", "rc_eu_netto", "rc_bau_netto", "vorsteuer_13b", "sondervorauszahlung", ...UST_OHNE_STEUER.map((f) => f.id)].some((k) => text(d, k));
    const dfv = ja(d, "dauerfrist");
    const rc = [
      { kz: "46", text: "Sonstige Leistungen von Unternehmen aus dem übrigen Gemeinschaftsgebiet (§ 13b Abs. 1 UStG)", hinweis: "Bemessungsgrundlage", c: cent(text(d, "rc_eu_netto")) ?? 0 },
      { kz: "47", text: "darauf Umsatzsteuer", c: x.s47 },
      { kz: "84", text: "Andere Leistungen, z. B. Bauleistungen (§ 13b Abs. 2 Nr. 1, 2, 4 bis 12 UStG)", hinweis: "Bemessungsgrundlage", c: cent(text(d, "rc_bau_netto")) ?? 0 },
      { kz: "85", text: "darauf Umsatzsteuer", c: x.s85 },
    ];
    const mitRc = rc.some((z) => z.c);
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const ueberschuss = !leer && x.zahllast < 0;
    return dokument({
      titel: "Umsatzsteuer-Voranmeldung",
      betrieb: b,
      unter: [text(d, "zeitraum"), "Übertragungshilfe für ELSTER"].filter(Boolean).join(", "),
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Zeitraum: ${text(d, "zeitraum") || KOPF_LINIE}`, `Besteuerung: ${ist ? "nach vereinnahmten Entgelten (§ 20 UStG)" : "nach vereinbarten Entgelten"}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Steuerpflichtige Umsätze",
          kennzahlen([
            { kz: "81", text: "Umsätze zum Steuersatz 19 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer, im Vordruck in vollen Euro", betrag: betrag(x.u19) },
            { text: "darauf Umsatzsteuer 19 % (rechnet ELSTER)", betrag: betrag(x.s19) },
            { kz: "86", text: "Umsätze zum Steuersatz 7 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer, im Vordruck in vollen Euro", betrag: betrag(x.u7) },
            { text: "darauf Umsatzsteuer 7 % (rechnet ELSTER)", betrag: betrag(x.s7) },
          ]),
        ) +
        (ohneSteuer.length
          ? abschnitt("Umsätze ohne Umsatzsteuer", kennzahlen(ohneSteuer.map((f) => ({ ...(f.kz ? { kz: f.kz } : {}), text: f.text, hinweis: f.hinweis, betrag: euro(f.cent) }))))
          : "") +
        (mitRc ? abschnitt("Steuerschuldnerschaft als Leistungsempfänger", kennzahlen(rc.map((z) => ({ kz: z.kz, text: z.text, ...(z.hinweis ? { hinweis: z.hinweis } : {}), betrag: euro(z.c) })))) : "") +
        abschnitt(
          "Vorsteuer und Zahllast",
          kennzahlen([
            { text: "Umsatzsteuer gesamt", betrag: betrag(x.steuer) },
            { kz: "66", text: "Vorsteuerbeträge aus Rechnungen anderer Unternehmer", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 1 UStG", betrag: betrag(x.vst) },
            ...(x.v67 ? [{ kz: "67", text: "Vorsteuerbeträge aus Leistungen im Sinne des § 13b UStG", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 4 UStG", betrag: euro(x.v67) }] : []),
            ...(x.svz ? [{ kz: "39", text: "Abzug der festgesetzten Sondervorauszahlung für Dauerfristverlängerung", hinweis: "nur Monatszahler, in der Voranmeldung für Dezember (§§ 46–48 UStDV)", betrag: euro(x.svz) }] : []),
            {
              kz: "83",
              text: leer ? "Verbleibende Umsatzsteuer-Vorauszahlung bzw. Überschuss" : ueberschuss ? "Verbleibender Überschuss (Erstattung)" : "Verbleibende Umsatzsteuer-Vorauszahlung",
              hinweis: ueberschuss ? "Überschuss: Betrag mit Minuszeichen übertragen" : leer ? `Vorauszahlung ${dfv ? UST_FRIST_DFV : "bis zum 10. Tag nach Ablauf des Zeitraums (§ 18 Abs. 1 UStG)"}; Überschuss mit Minuszeichen übertragen` : dfv ? UST_FRIST_DFV : UST_FRIST,
              betrag: betrag(x.zahllast),
              fett: true,
            },
          ]),
        ) +
        // steuerfreie Umsätze ohne Vorsteuerabzug und Vorsteuer im selben Zeitraum: an die Aufteilung erinnern
        ((cent(text(d, "umsatz_48")) ?? 0) && x.vst > 0 ? nachsatz(VORSTEUER_AUFTEILEN) : "") +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        nachsatz("Kennzahlen nach dem Vordruckmuster USt 1 A für 2026. Vor dem Übertragen gegen das aktuelle ELSTER-Formular prüfen; das Formular rechnet die Steuerbeträge selbst. ELSTER rechnet aus vollen Euro; maßgeblich ist der Betrag, den ELSTER errechnet.") +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)", ueberschuss ? "Erstattung erhalten am" : "Gezahlt am"]),
    });
  },
};

// ---------------------------------------------------------------- Steuererklärung (Zusammenstellung)

const ERKLAERUNGEN = [
  { wert: "est", text: "Einkommensteuer" },
  { wert: "gewst", text: "Gewerbesteuer" },
  { wert: "ust", text: "Umsatzsteuer (Jahr)" },
  { wert: "kst", text: "Körperschaftsteuer" },
  // R10: Personengesellschaften (GbR, OHG, KG, GmbH & Co. KG, PartG) – Gewinnfeststellung statt Einkommensteuer der Gesellschaft
  { wert: "feststellung", text: "Feststellungserklärung (Personengesellschaft)" },
];

/** Personengesellschaft nach der Rechtsform aus „Mein Betrieb“ bzw. dem Zusatz im Namen (GbR, OHG, KG, GmbH & Co. KG, PartG). */
export function istPersonengesellschaft(rechtsform: string | undefined, name = ""): boolean {
  const rf = (rechtsform ?? "").trim();
  const form = rf ? formImNamen(rf) : formImNamen(name);
  return form === "GbR" || form === "OHG" || form === "KG" || form === "GmbH & Co. KG" || form === "PartG";
}
/** Hinweis, wenn bei einer Personengesellschaft die Einkommensteuer gewählt ist (§ 180 AO). */
export const ERKLAERUNG_PERSONENGESELLSCHAFT = "Bei einer Personengesellschaft gibt die Gesellschaft die Feststellungserklärung ab (§ 180 Abs. 1 Nr. 2 Buchst. a AO); die Einkommensteuererklärung gibt jede Gesellschafterin und jeder Gesellschafter selbst ab – nicht die Gesellschaft.";

export const steuererklaerung: Vorlage = {
  id: "steuererklaerung",
  gestalt: "formular",
  titel: "Unterlagen zur Steuererklärung",
  beschreibung: "Alle Zahlen und Belege für die Jahreserklärungen an einem Ort – zum Übertragen in ELSTER oder für die Steuerberatung.",
  bereich: "steuern",
  pflichten: ["steuern.est_erklaerung", "steuern.gewst_erklaerung", "steuern.ust_jahreserklaerung", "steuern.kst_erklaerung", "steuern.feststellungserklaerung"],
  grundlage: "§ 25 EStG; § 31 KStG; §§ 180, 181 AO; § 14a GewStG; § 18 Abs. 3 UStG",
  // nur die Gesetze der gewählten Erklärungen; ohne Auswahl: KStG nur für Kapitalgesellschaften, Feststellung (§§ 180, 181 AO)
  // nur für Personengesellschaften, EStG nur für die übrigen
  grundlageFuer(d, b) {
    const je: Record<string, string> = { est: "§ 25 EStG", kst: "§ 31 KStG", feststellung: "§§ 180, 181 AO", gewst: "§ 14a GewStG", ust: "§ 18 Abs. 3 UStG" };
    const arten = auswahl(d, "arten").filter((a) => je[a]);
    const reihe = ["est", "kst", "feststellung", "gewst", "ust"];
    const kapital = istKapitalgesellschaft(b.rechtsform, b.name);
    const personen = istPersonengesellschaft(b.rechtsform, b.name);
    const passt = (a: string) => (a === "est" ? !kapital && !personen : a === "kst" ? kapital : a === "feststellung" ? personen : true);
    const gewaehlt = arten.length ? reihe.filter((a) => arten.includes(a)) : reihe.filter(passt);
    return gewaehlt.map((a) => je[a]).join("; ");
  },
  hinweise(d, b) {
    return istPersonengesellschaft(b.rechtsform, b.name) && auswahl(d, "arten").includes("est") ? [ERKLAERUNG_PERSONENGESELLSCHAFT] : [];
  },
  namensFeld: "jahr",
  abschnitte: [
    { titel: "Jahr und Erklärungen",
      hilfe: "Die Erklärungen übermittelst du elektronisch über ELSTER. Diese Zusammenstellung sammelt, was du dafür brauchst.",
      felder: [
        { id: "jahr", art: "text", label: "Jahr", pflicht: true },
        { id: "arten", art: "mehrfach", label: "Welche Erklärungen", optionen: ERKLAERUNGEN, hilfe: "Personengesellschaften (GbR, OHG, KG, GmbH & Co. KG, PartG) geben die Feststellungserklärung ab – ohne Steuerberatung bis 31. Juli des Folgejahres, mit Steuerberatung bis Ende Februar des übernächsten Jahres; die Einkommensteuer erklären die Gesellschafter selbst." },
      ],
    },
    {
      titel: "Zahlen",
      felder: [
        { id: "gewinn", art: "betrag", label: "Gewinn oder Verlust (aus EÜR bzw. Bilanz) (€)", pflicht: true },
        { id: "umsatz", art: "betrag", label: "Umsätze im Jahr (netto) (€)" },
        { id: "ust_jahr", art: "betrag", label: "Umsatzsteuer im Jahr (€)", wenn: { feld: "arten", ist: "ust" } },
        { id: "vorsteuer_jahr", art: "betrag", label: "Vorsteuer im Jahr (€)", wenn: { feld: "arten", ist: "ust" } },
      ],
    },
    {
      titel: "Vorauszahlungen",
      felder: [{ id: "vorauszahlungen", art: "liste", label: "Vorauszahlungen", eintrag: "Vorauszahlung", titelFeld: "art", felder: [{ id: "art", art: "text", label: "Steuer", hilfe: "z. B. Einkommensteuer Q1", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
    },
    {
      titel: "Weitere Angaben und Belege",
      hilfe: "z. B. Krankenversicherung, Altersvorsorge, Spenden, Arbeitszimmer – was für deine Erklärung wichtig ist.",
      felder: [
        { id: "weiteres", art: "liste", label: "Weitere Angaben", eintrag: "Angabe", titelFeld: "was", felder: [{ id: "was", art: "text", label: "Was", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag (€)" }, { id: "beleg", art: "schalter", label: "Beleg liegt vor" }] },
        { id: "notiz", art: "mehrzeilig", label: "Notizen" },
      ],
    },
  ],
  html(d, b) {
    const arten = auswahl(d, "arten").map((a) => ERKLAERUNGEN.find((x) => x.wert === a)?.text ?? a);
    const vz = liste(d, "vorauszahlungen").filter((x) => text(x, "art"));
    const we = liste(d, "weiteres").filter((x) => text(x, "was"));
    // Blatt zum Ausfüllen (keine Zahlen eingegeben): Erklärungen zum Ankreuzen, alle Zeilen und Tabellen zum Eintragen
    const leer = !["gewinn", "umsatz", "ust_jahr", "vorsteuer_jahr"].some((k) => text(d, k)) && !vz.length && !we.length;
    // Steuerart einer Vorauszahlung: das erste Wort („Einkommensteuer Q1“ → „einkommensteuer“)
    const steuerart = (t: string) => t.trim().split(/\s+/)[0]!.toLocaleLowerCase("de");
    const verschiedene = new Set(vz.map((x) => steuerart(text(x, "art")))).size > 1;
    return dokument({
      titel: "Unterlagen zur Steuererklärung",
      betrieb: b,
      unter: [text(d, "jahr") ? `Jahr ${text(d, "jahr")}` : "", arten.join(", ")].filter(Boolean).join(": "),
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Jahr: ${text(d, "jahr") || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Kennzahlen",
          // leeres Blatt: die Erklärungen zum Ankreuzen (ohne eigenen Abschnitt, damit alles auf eine Seite passt)
          (leer && !arten.length ? `<p class="klein">Erklärungen:</p>${ankreuzen(ERKLAERUNGEN.map((x) => x.text), { nebeneinander: true })}` : "") +
          kennzahlen([
            { text: "Gewinn oder Verlust", hinweis: "aus EÜR bzw. Bilanz", betrag: text(d, "gewinn") ? euro(cent(text(d, "gewinn")) ?? 0) : "&nbsp;" },
            ...(text(d, "umsatz") || leer ? [{ text: "Umsätze im Jahr (netto)", betrag: text(d, "umsatz") ? euro(cent(text(d, "umsatz")) ?? 0) : "&nbsp;" }] : []),
            ...(text(d, "ust_jahr") || leer ? [{ text: "Umsatzsteuer im Jahr", betrag: text(d, "ust_jahr") ? euro(cent(text(d, "ust_jahr")) ?? 0) : "&nbsp;" }] : []),
            ...(text(d, "vorsteuer_jahr") || leer ? [{ text: "Vorsteuer im Jahr", betrag: text(d, "vorsteuer_jahr") ? euro(cent(text(d, "vorsteuer_jahr")) ?? 0) : "&nbsp;" }] : []),
          ]),
        ) +
        (vz.length
          ? abschnitt(
              "Geleistete Vorauszahlungen",
              // verschiedene Steuern: keine Gesamtsumme (Einkommen- und Umsatzsteuer zusammenzuzählen, sagt nichts), sondern je Steuer
              verschiedene
                ? tabelle(["Steuer", "Betrag"], vz.map((x) => [zelle(text(x, "art")), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["70%", "30%"], zahlen: [1] }) +
                    kennzahlen([...new Set(vz.map((x) => steuerart(text(x, "art"))))].map((art) => {
                      const je = vz.filter((x) => steuerart(text(x, "art")) === art);
                      return { text: `Summe ${text(je[0]!, "art").trim().split(/\s+/)[0]}`, betrag: euro(summe(je, "betrag")), fett: true };
                    }))
                : tabelle(["Steuer", "Betrag"], vz.map((x) => [zelle(text(x, "art")), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["70%", "30%"], zahlen: [1], summe: ["<strong>Summe</strong>", `<strong>${euro(summe(vz, "betrag"))}</strong>`] }),
            )
          : leer
            ? abschnitt("Geleistete Vorauszahlungen", tabelle(["Steuer", "Betrag"], [], { breiten: ["70%", "30%"], zahlen: [1], mindestens: 4, hoch: true }))
            : "") +
        (we.length
          ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], we.map((x) => [zelle(text(x, "was")), text(x, "betrag") ? euro(cent(text(x, "betrag")) ?? 0) : "", ja(x, "beleg") ? "liegt vor" : "<strong>fehlt</strong>"]), { breiten: ["55%", "25%", "20%"], zahlen: [1] }))
          : leer
            ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], [], { breiten: ["55%", "25%", "20%"], zahlen: [1], mindestens: 5, hoch: true }))
            : "") +
        (text(d, "notiz") ? abschnitt("Notizen", absatz(text(d, "notiz"))) : "") +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)", "Bescheid vom"]),
    });
  },
};

// ---------------------------------------------------------------- Kassenbuch

function kasse(d: Daten) {
  let bestand = cent(text(d, "anfang")) ?? 0;
  const zeilen = liste(d, "eintraege")
    .filter((x) => text(x, "text") || text(x, "einnahme") || text(x, "ausgabe"))
    .map((x) => {
      const ein = cent(text(x, "einnahme")) ?? 0;
      const aus = cent(text(x, "ausgabe")) ?? 0;
      bestand += ein - aus;
      return { x, ein, aus, bestand };
    });
  return { zeilen, ende: bestand, negativ: zeilen.some((z) => z.bestand < 0) };
}

export const kassenbuch: Vorlage = {
  id: "kassenbuch",
  grundlage: "§ 146 Abs. 1 AO",
  querformat: true,
  titel: "Kassenbuch (Vorlage zum Ausdrucken)",
  beschreibung: "Bargeld-Einnahmen und -Ausgaben mit laufendem Bestand – für Betriebe mit offener Ladenkasse. Ausgedruckt bzw. geteilt wird es festgeschrieben; ein laufend geführtes elektronisches Kassenbuch ersetzt es nicht.",
  festschreiben: true,
  bereich: "steuern",
  pflichten: [],
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum und Anfangsbestand",
      hilfe: "Vorlage zum Ausdrucken: Sobald du das Kassenbuch teilst oder druckst, schreibt Amtlos es fest – danach lässt es sich nicht mehr ändern. Ein laufend geführtes, unveränderbares elektronisches Kassenbuch ist es nicht.",
      felder: [
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "anfang", art: "betrag", label: "Anfangsbestand (€)", pflicht: true },
      ],
    },
    {
      titel: "Einträge",
      hilfe: "Jeder Vorgang einzeln, in zeitlicher Reihenfolge, mit Beleg.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Einträge",
          eintrag: "Eintrag",
          titelFeld: "text",
          pflicht: true,
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            { id: "beleg", art: "text", label: "Beleg-Nr." },
            { id: "text", art: "text", label: "Vorgang", hilfe: "z. B. Tageseinnahmen, Einkauf Milch", pflicht: true },
            { id: "einnahme", art: "betrag", label: "Einnahme (€)" },
            { id: "ausgabe", art: "betrag", label: "Ausgabe (€)" },
          ],
        },
      ],
    },
  ],
  ergebnis(d) {
    const k = kasse(d);
    return [["Endbestand", euro(k.ende)], ...(k.negativ ? ([["Achtung", "Bestand zwischendurch negativ – bitte prüfen"]] as [string, string][]) : [])];
  },
  html(d, b) {
    const k = kasse(d);
    const anfang = cent(text(d, "anfang")) ?? 0;
    // ohne Einträge: Blatt zum Eintragen von Hand mit hohen Leerzeilen
    const leer = !k.zeilen.length;
    return dokument({
      titel: "Kassenbuch",
      betrieb: b,
      unter: [text(d, "zeitraum"), leer ? "Vorlage zum Ausdrucken" : ""].filter(Boolean).join(" · ") || undefined,
      // ohne Zeitraum: Linie zum Eintragen in der Kennungsleiste
      meta: text(d, "zeitraum") ? undefined : `Zeitraum: ${KOPF_LINIE}`,
      quer: true,
      inhalt:
        tabelle(
          ["Datum", "Beleg", "Vorgang", "Einnahme", "Ausgabe", "Bestand"],
          [["", "", "<strong>Anfangsbestand</strong>", "", "", text(d, "anfang") ? `<strong>${euro(anfang)}</strong>` : ""], ...k.zeilen.map((z) => [datumDe(text(z.x, "datum")), zelle(text(z.x, "beleg")), zelle(text(z.x, "text")), z.ein ? euro(z.ein) : "", z.aus ? euro(z.aus) : "", z.bestand < 0 ? `<strong>${euro(z.bestand)}</strong>` : euro(z.bestand)])],
          { breiten: ["11%", "10%", "39%", "13%", "13%", "14%"], zahlen: [3, 4, 5], ...(leer ? { mindestens: KASSENBUCH_LEER, hoch: true } : {}), summe: ["", "", `Summen und Endbestand ${esc(text(d, "zeitraum"))}`, ...(leer ? [ZELLE_LINIE, ZELLE_LINIE, ZELLE_LINIE] : [euro(k.zeilen.reduce((a, z) => a + z.ein, 0)), euro(k.zeilen.reduce((a, z) => a + z.aus, 0)), euro(k.ende)])] },
        ) +
        (k.negativ ? `<p><strong>Der Bestand war zwischendurch negativ – bitte prüfen.</strong></p>` : "") +
        unterschriften(["Geprüft am", "Unterschrift"]),
    });
  },
};

/** Leeres Kassenbuch: Zeilen (samt Anfangsbestand) für zwei volle Querformatseiten – Seite 2 endet mit Summe und Unterschriften. */
const KASSENBUCH_LEER = 29;

// ---------------------------------------------------------------- Kassenmeldung

export const kassenmeldung: Vorlage = {
  id: "kassenmeldung",
  gestalt: "formular",
  titel: "Kassenmeldung (Datenblatt)",
  beschreibung: "Alle Angaben zu deinen elektronischen Kassen und Sicherheitseinrichtungen (TSE) für die Meldung ans Finanzamt – auch bei Außerbetriebnahme.",
  bereich: "steuern",
  pflichten: ["steuern.kassenmeldung", "steuern.kassenmeldung_ausserbetriebnahme"],
  grundlage: "§ 146a Abs. 4 AO",
  abschnitte: [
    { titel: "Stand",
      hilfe: "Die Meldung selbst geht elektronisch über „Mein ELSTER“. Die Angaben stehen auf der Kasse, in der Rechnung und in den Unterlagen zur TSE.",
      felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" }],
    },
    {
      titel: "Kassen",
      felder: [
        {
          id: "kassen",
          art: "liste",
          label: "Kassen",
          eintrag: "Kasse",
          titelFeld: "modell",
          pflicht: true,
          felder: [
            { id: "art", art: "text", label: "Art des elektronischen Aufzeichnungssystems", pflicht: true, vorschlaege: KASSEN_ARTEN },
            { id: "hersteller", art: "text", label: "Hersteller", pflicht: true },
            { id: "modell", art: "text", label: "Modell", pflicht: true },
            { id: "seriennummer", art: "text", label: "Seriennummer der Kasse", pflicht: true },
            { id: "software", selten: true, art: "text", label: "Software und Version" },
            { id: "anschaffung", art: "datum", label: "Angeschafft am", pflicht: true },
            { id: "tse_art", art: "text", label: "Art der zertifizierten technischen Sicherheitseinrichtung (TSE)", pflicht: true, vorschlaege: TSE_ARTEN },
            { id: "tse_seriennummer", art: "text", label: "Seriennummer der TSE", pflicht: true },
            { id: "tse_zertifikat", selten: true, art: "text", label: "Zertifizierungs-ID der TSE", hilfe: "z. B. BSI-K-TR-…" },
            { id: "ausser_betrieb", selten: true, art: "datum", label: "Außer Betrieb genommen am", hilfe: "nur bei Außerbetriebnahme" },
            { id: "grund", selten: true, art: "text", label: "Grund der Außerbetriebnahme", wenn: { feld: "ausser_betrieb" } },
          ],
        },
      ],
    },
  ],
  pruefen: (_d, b) => (b.steuernummer.trim() ? [] : ["Steuernummer (Mein Betrieb)"]),
  html(d, b) {
    const k = liste(d, "kassen").filter((x) => text(x, "modell") || text(x, "seriennummer"));
    // je Aufzeichnungssystem die Feldzeilen; ohne Kasse ein leerer Block zum Ausfüllen von Hand
    const bloecke: { titel: string; zeilen: [string, string | null][] }[] = k.length
      ? k.map((x, i) => ({
          titel: `Aufzeichnungssystem ${i + 1}${text(x, "ausser_betrieb") ? " (außer Betrieb)" : ""}`,
          zeilen: [
            ["Art", neufassung(text(x, "art"))],
            ["Hersteller / Modell", [text(x, "hersteller"), text(x, "modell")].filter(Boolean).join(", ")],
            ["Seriennummer", text(x, "seriennummer")],
            ["Software", text(x, "software") || null],
            ["Angeschafft am", datumDe(text(x, "anschaffung"))],
            ["TSE", [text(x, "tse_art"), text(x, "tse_seriennummer") ? `Seriennummer ${text(x, "tse_seriennummer")}` : ""].filter(Boolean).join(" · ")],
            ["Zertifizierungs-ID", text(x, "tse_zertifikat") || null],
            ["Außer Betrieb genommen", text(x, "ausser_betrieb") ? `${datumDe(text(x, "ausser_betrieb"))}${text(x, "grund") ? `, ${text(x, "grund")}` : ""}` : null],
          ],
        }))
      : // leeres Blatt: ein Aufzeichnungssystem zum Ausfüllen von Hand (ein zweiter Block passt nicht mehr auf die Seite),
        // die TSE mit Art und Seriennummer in eigenen Zeilen
        [1].map((i) => ({ titel: `Aufzeichnungssystem ${i}`, zeilen: ["Art", "Hersteller / Modell", "Seriennummer", "Software", "Angeschafft am", "TSE – Art", "TSE – Seriennummer", "Zertifizierungs-ID", "Außer Betrieb genommen"].map((t): [string, string] => [t, ""]) }));
    // Feldnummern laufen durch – gezählt werden nur die tatsächlich gedruckten Zeilen (Betriebsstätte: 01–03)
    let nr = 4;
    return dokument({
      titel: "Kassenmeldung – Datenblatt",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        `<p class="klein">Zum Übertragen in „Mein ELSTER“ (Mitteilung über elektronische Aufzeichnungssysteme nach § 146a Abs. 4 AO). Je Betriebsstätte eine Mitteilung mit allen Kassen.</p>` +
        abschnitt("Betriebsstätte", felder([["Steuernummer", b.steuernummer], ["Name und Anschrift", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")], ["Anzahl der Aufzeichnungssysteme", k.length ? String(k.length) : ""]])) +
        bloecke
          .map((x) => {
            const start = nr;
            nr += x.zeilen.filter(([, w]) => w !== null).length;
            // jedes Aufzeichnungssystem bleibt mit seiner Überschrift auf einer Seite
            return `<div class="zusammen">${abschnitt(x.titel, felder(x.zeilen, { start }))}</div>`;
          })
          .join("") +
        uebertragung(["Gemeldet über Mein ELSTER am", "Transferticket"]),
    });
  },
};

// ---------------------------------------------------------------- Aufbewahrung

/** Fristen nach § 147 AO / § 257 HGB in der Fassung ab 2025 (BEG IV), aus der Recherche (T-58). */
const AUFBEWAHRUNG_START: Eintrag[] = AUFBEWAHRUNG.map((x) => ({ art: x.art.replace(/^§[^:]*:\s*/, ""), jahre: x.jahre }));

/** Aufbewahren bis Ende des Jahres „letzte Eintragung + Frist“ (Frist beginnt mit Ende des Kalenderjahres). */
export function aufbewahrenBis(letzteJahr: string, jahre: string): string | null {
  const j = Number(letzteJahr);
  const f = Number(jahre);
  if (!Number.isInteger(j) || j < 1900 || !Number.isInteger(f) || f <= 0) return null;
  return `31.12.${j + f}`;
}

export const aufbewahrung: Vorlage = {
  id: "aufbewahrung",
  gestalt: "handbuch",
  titel: "Aufbewahrungsplan",
  beschreibung: "Welche Unterlagen wie lange aufzubewahren sind, wo sie liegen und ab wann sie frühestens weg dürfen.",
  bereich: "steuern",
  pflichten: ["steuern.aufbewahrung"],
  grundlage: "§ 147 AO; § 257 HGB",
  abschnitte: [
    {
      titel: "Unterlagen",
      hilfe: "Die Frist beginnt mit dem Ende des Kalenderjahres der letzten Eintragung. Die vorgeschlagenen Fristen bitte prüfen.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Unterlagen",
          eintrag: "Unterlagenart",
          titelFeld: "art",
          pflicht: true,
          start: AUFBEWAHRUNG_START,
          felder: [
            { id: "art", art: "text", label: "Unterlagen", pflicht: true },
            { id: "jahre", art: "zahl", label: "Aufbewahrungsfrist (Jahre)", pflicht: true },
            { id: "letzte", art: "zahl", label: "Jahr, in dem die Frist beginnt", hilfe: "Jahr der letzten Eintragung, der Aufstellung, des Belegs oder des Briefs, z. B. 2026" },
            { id: "ort", art: "text", label: "Wo aufbewahrt", hilfe: "z. B. Ordner im Büro, Buchhaltungsprogramm" },
          ],
        },
      ],
    },
  ],
  pruefen(d) {
    // Fristbeginn eingetragen, aber kein Jahr: dann bleibt „Aufbewahren mindestens bis“ leer
    return liste(d, "eintraege")
      .filter((x) => text(x, "letzte") && !(/^\d{4}$/.test(text(x, "letzte")) && Number(text(x, "letzte")) >= 1900))
      .map((x) => `Fristbeginn „${text(x, "letzte")}“${text(x, "art") ? ` bei „${text(x, "art").slice(0, 60)}${text(x, "art").length > 60 ? "…" : ""}“` : ""} ist kein Jahr – bitte vierstellig eintragen (z. B. 2026)`);
  },
  html(d, b) {
    const l = liste(d, "eintraege").filter((x) => text(x, "art"));
    // Blatt zum Ausfüllen (noch kein Jahr und kein Ort eingetragen): drei leere Zeilen für weitere Unterlagen
    const leer = !l.some((x) => text(x, "letzte") || text(x, "ort"));
    return dokument({
      titel: "Aufbewahrungsplan",
      betrieb: b,
      inhalt:
        tabelle(["Unterlagen", "Frist", "Jahr der letzten Eintragung bzw. des Belegs", "Aufbewahren mindestens bis", "Wo"], l.map((x) => [zelle(text(x, "art")), text(x, "jahre") ? `${esc(text(x, "jahre"))} ${zahl(text(x, "jahre")) === 1 ? "Jahr" : "Jahre"}` : ZELLE_LINIE, text(x, "letzte") ? zelle(text(x, "letzte")) : ZELLE_LINIE, aufbewahrenBis(text(x, "letzte"), text(x, "jahre")) ?? ZELLE_LINIE, text(x, "ort") ? zelle(text(x, "ort")) : ZELLE_LINIE]), { breiten: ["42%", "10%", "17%", "14%", "17%"], leerzeilen: leer ? 3 : 0 }) +
        nachsatz("Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die letzte Eintragung gemacht, das Inventar aufgestellt, der Jahresabschluss festgestellt, der Brief empfangen oder abgesandt oder der Buchungsbeleg entstanden ist (§ 147 Abs. 4 AO). Sie läuft nicht ab, solange die Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO)."),
    });
  },
};
