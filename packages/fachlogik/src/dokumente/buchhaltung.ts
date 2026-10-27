/**
 * Steuern und Buchhaltung (E-121): Rechnung, EÜR, Bilanz/GuV, USt-Voranmeldung, Steuererklärung (Zusammenstellung),
 * Kassenbuch, Kassenmeldung, Aufbewahrung. Was elektronisch ans Finanzamt geht (Voranmeldung, Anlage EÜR, Erklärungen,
 * E-Bilanz, Kassenmeldung), erstellt die App als ausgefüllte Unterlage zum Übertragen – sie übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-58).
 */
import { KU_HINWEIS, abschlagsSumme, einheitFuerMenge, fehlendFuerERechnung, mengeUngueltig, nettoEinzelpreis, rundeCent, summen, type Abschlag, type Position, type RechnungsDaten } from "../rechnung.js";
import { einheitBekannt, einheitCode } from "../erechnung.js";
import { giroCodeSvg } from "../girocode.js";
import { BUNDESLAENDER, StandardKalender, verschiebe, type Bundesland } from "@amtlos/fristen";
import { EUER_ZEILE_STEUERFREI, EUER_ZEILE_STEUERPFLICHTIG, KATEGORIEN } from "../belege.js";
import { istEuAusland } from "../buchungen.js";
import { prozentText, skontoAus, skontoBetrag } from "../skonto.js";
import { STEUERART_NULLSATZ } from "../steuerart.js";
import { KUNDEN_ARTEN } from "./kundenarten.js";
import { formImNamen, istKapitalgesellschaft } from "./betrieb.js";
import { AUFBEWAHRUNG, EINHEITEN, EUER_AUSGABEN, EUER_EINNAHMEN, KASSEN_ARTEN, RECHNUNGS_HINWEISE, TSE_ARTEN } from "./bausteine.js";
import { KOPF_LINIE, LINIE_MITTEL, ZELLE_LINIE, abschnitt, istCoKg, komplementaerZeile, CO_KG_GESCHAEFTSFUEHRER, absatz, angaben, ankreuzen, anschrift, auswahl, brief, cent, datumDe, dokument, esc, euro, felder, ibanText, kennzahlen, nachsatz, preisCent, steuerHinweis, uebertragung, ja, liste, neufassung, summe, tabelle, text, unterschriften, zahl, zahlText, zelle } from "./html.js";
import type { Betrieb, Daten, Eintrag, Option, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";


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

/**
 * StB-Prüfung (B-2, C-12, Prio 1): eigener Wert für den Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaik) – steuerpflichtig
 * zu 0 % (Kz 87, XRechnung „Z“), nicht steuerfrei. Steuerart dazu: STEUERART_NULLSATZ („nullsatz“, steuerart.ts).
 */
export const SATZ_NULLSATZ = "nullsatz";
const SAETZE = [
  { wert: "19", text: "19 %" },
  { wert: "7", text: "7 %" },
  { wert: "0", text: "0 % / steuerfrei" },
  { wert: SATZ_NULLSATZ, text: "0 % (§ 12 Abs. 3 UStG)" },
];
/** Steuersatz einer Position aus dem gespeicherten Wert: „19“, „7“, „0“, „nullsatz“ (= 0 %); leer = 19. */
export const satzZahl = (w: string | null | undefined): number => (w === SATZ_NULLSATZ ? 0 : Number(w || "19"));
/** Position zum Nullsteuersatz (§ 12 Abs. 3 UStG)? */
const nullsatzPos = (e: Eintrag) => text(e, "satz") === SATZ_NULLSATZ;
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
/**
 * StB-Prüfung C-2 (Nachtrag 22.10.2026): Bei § 13b und igL steht statt „Umsatzsteuer 0 % … 0,00 €“ eine Zeile ohne
 * Steuersatz und ohne Betrag – sonst könnte sie als Steuerausweis bzw. Steuersatz missverstanden werden.
 */
export const UST_ENTFAELLT_13B = "Umsatzsteuer: entfällt (§ 13b UStG)";
export const UST_ENTFAELLT_IGL = "Umsatzsteuer: entfällt (steuerfreie innergemeinschaftliche Lieferung, § 4 Nr. 1b UStG)";
/** C-2: Summenzeile „Umsatzsteuer: entfällt …“ statt 0 % – null, wenn die Rechnung weder § 13b noch igL ist. */
function ustEntfaellt(hinweise: string[]): string | null {
  if (hinweise.includes("reverse_charge")) return UST_ENTFAELLT_13B;
  if (hinweise.includes("igl")) return UST_ENTFAELLT_IGL;
  return null;
}
/** Bezeichnung der 0-%-Zeile in der Summe: mit dem gewählten Grund statt pauschal „steuerfrei“ (Texte wie in den Pflichthinweisen). */
function nullProzentText(hinweise: string[], befreiung: string): string {
  // der eigene Text (z. B. Steuerbefreiung nach § 4 UStG oder Nullsteuersatz) – kein pauschales „steuerfrei“
  if (befreiungInSumme(befreiung)) return `Umsatzsteuer 0 % (${befreiung.replace(/\.$/, "")})`;
  if (befreiung) return "Umsatzsteuer 0 % (siehe Hinweis)";
  return "Steuerfrei bzw. 0 %";
}
const ZIEL: Record<string, string> = { sofort: "sofort ohne Abzug", "7": "innerhalb von 7 Tagen", "14": "innerhalb von 14 Tagen", "30": "innerhalb von 30 Tagen" };

/** Hinweis auf die Steuerbefreiung – nur, wenn eine Position mit 0 % abgerechnet wird (sonst stünde er bei reinen 19-%-Rechnungen). */
function befreiungText(d: Daten): string {
  const pos = liste(d, "positionen").filter((e) => text(e, "bezeichnung") || text(e, "preis"));
  const nullProzent = pos.some((e) => satzZahl(text(e, "satz")) === 0);
  // Nullsteuersatz gewählt: der Hinweis steht auch ohne eigenen Text auf der Rechnung (Prio 1)
  return nullProzent ? text(d, "befreiung") || (pos.some(nullsatzPos) && !kuFuer(d) ? NULLSATZ_HINWEIS : "") : "";
}

/**
 * R12: Skonto der Rechnung (Schalter „Skonto“, Prozent, Tage) mit dem letzten Tag der Skontofrist – Rechnungsdatum plus
 * Tage, auf den nächsten Werktag verschoben wie das Zahlungsziel. Nicht bei Storno und Gutschrift.
 */
export function skontoFuer(d: Daten, bundesland = ""): { prozent: number; tage: number; bis: string } | null {
  if (!ja(d, "skonto") || text(d, "storno_zu") || auswahl(d, "hinweise").includes("gutschrift")) return null;
  const b = skontoAus(text(d, "skonto_prozent"), text(d, "skonto_tage"));
  const datum = text(d, "datum");
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  return { ...b, bis: faelligAm(datum, b.tage, bundesland) };
}
export const RECHNUNG_SKONTO_FALSCH = "Skonto: Prozent (über 0, unter 100, z. B. 2 oder 2,5) und Tage (z. B. 10) angeben";
export const RECHNUNG_SKONTO_FRIST = "Die Skontofrist ist nicht kürzer als das Zahlungsziel – bitte Tage prüfen.";
export const RECHNUNG_SKONTO_HOCH = "Skonto über 10 % ist ungewöhnlich hoch – bitte prüfen.";

// ---------------------------------------------------------------- R10 Steuer: Steuerart, Gutschrift, Ausland

/** „§ 13b“ im Freitext des Befreiungshinweises: gemeint ist die Steuerschuldnerschaft des Leistungsempfängers. */
const RC_IM_TEXT = /(?:§\s*)?13\s*b(?![a-z])/i;
/** Nullsteuersatz (§ 12 Abs. 3 UStG, Photovoltaik) im Hinweistext – kein steuerfreier Umsatz, eigene Kennzahl 87. */
const NULLSATZ_IM_TEXT = /§\s*12\s*Abs\.?\s*3/;
/** Vorschlag für den Hinweis bei Photovoltaik zum Nullsteuersatz */
export const NULLSATZ_HINWEIS = "Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaikanlage)";
/** Nullsteuersatz und eine steuerfreie 0-%-Position auf derselben Rechnung: Kz 87 und Kz 48/43 lassen sich so nicht trennen. */
export const RECHNUNG_NULLSATZ_GEMISCHT = "Nullsteuersatz (§ 12 Abs. 3 UStG) und steuerfreie Positionen auf derselben Rechnung – bitte getrennte Rechnungen schreiben, damit Voranmeldung (Kz 87) und E-Rechnung (Kategorie Z) stimmen.";
export const istNullsatzText = (t: string | null | undefined) => NULLSATZ_IM_TEXT.test(t ?? "");

/** Ist die Unterlage eine Gutschrift (Abrechnung durch den Leistungsempfänger)? */
/**
 * Kleinbetragsrechnung (§ 33 UStDV, R11): Gesamtbetrag bis 250 € brutto – Name und Anschrift des Empfängers sind dann
 * keine Pflichtangabe; auf der Rechnung genügen Entgelt und Steuer in einer Summe mit dem Steuersatz. Nicht bei Storno
 * und Gutschrift. § 33 Satz 3 UStDV: „Die Sätze 1 und 2 gelten nicht für Rechnungen über Leistungen im Sinne der
 * §§ 3c, 6a und 13b des Gesetzes.“ – also nicht bei Steuerschuldnerschaft des Empfängers (auch „§ 13b“ im
 * Befreiungshinweis, wie `steuerartAus`), innergemeinschaftlicher Lieferung und Fernverkauf. E-220: Fernverkauf = OSS
 * eingeschaltet (Steuer des Bestimmungslands, § 3c UStG); vorsorglich auch jede Privatperson im EU-Ausland ohne OSS
 * (Fernverkauf unter der Schwelle des § 3c Abs. 4 UStG – ob § 33 Satz 3 dann greift, klärt T-299). Die App trennt
 * Waren und Dienstleistungen nicht; die vollen Angaben nach § 14 Abs. 4 UStG sind in jedem Fall zulässig.
 */
export const KLEINBETRAG_CENT = 25000;
export function kleinbetrag(d: Daten): boolean {
  if (text(d, "storno_zu") || auswahl(d, "hinweise").includes("gutschrift")) return false;
  const art = steuerartAus(d);
  if (art === "reverse_charge" || art === "igl") return false;
  if ((ja(d, "oss") && !kuFuer(d)) || euPrivatLand(d)) return false;
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
  if ((befreiung && NULLSATZ_IM_TEXT.test(befreiung)) || (!kuFuer(d) && positionenRoh(d).some(nullsatzPos))) return STEUERART_NULLSATZ;
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
/** R12 (Coach #6): Vorauszahlung (10er-Karte, Gutschein, Anzahlung) – die Leistung folgt erst, das Leistungsdatum ist nicht das Rechnungsdatum. */
const vorauszahlungD = (d: Daten) => ja(d, "vorauszahlung") && !text(d, "storno_zu");
/** Leistungsdatum gleich dem Rechnungsdatum? Nicht bei einer Vorauszahlung (R12). */
const leistungGleich = (d: Daten) => ja(d, "leistung_gleich") && !vorauszahlungD(d);

/**
 * R12 (Kfz #6): Angaben auf Geschäftsbriefen einer GmbH bzw. UG (§ 35a GmbHG): Rechtsform, Sitz, Registergericht,
 * Registernummer und alle Geschäftsführer. Fehlt etwas in „Mein Betrieb“, steht es unter „Fehlt noch“ – mit dem
 * Zusatz „(Mein Betrieb, § 35a GmbHG)“, damit die App gleich die Gesellschaftsangaben öffnet.
 */
export const GMBH_ANGABEN = "§ 35a GmbHG";
export const GMBH_REGISTERGERICHT = `Registergericht (Mein Betrieb, ${GMBH_ANGABEN})`;
export const GMBH_REGISTERNUMMER = `Registernummer, z. B. HRB 12345 (Mein Betrieb, ${GMBH_ANGABEN})`;
export const GMBH_GESCHAEFTSFUEHRUNG = `Alle Geschäftsführerinnen und Geschäftsführer (Mein Betrieb, ${GMBH_ANGABEN})`;
export const GMBH_SITZ = `Ort des Betriebs als Sitz der Gesellschaft (Mein Betrieb, ${GMBH_ANGABEN})`;
export function gmbhAngabenFehlen(b: Betrieb): string[] {
  // E-193 (8a): eine UG (haftungsbeschränkt) & Co. KG ist eine KG – ihre Angaben prüft `komplementaerAngabenFehlen`
  if (istCoKg(b) || !istKapitalgesellschaft(b.rechtsform, b.name) || (formImNamen(b.rechtsform ?? "") ?? formImNamen(b.name)) === "AG") return [];
  const t = (x: string | undefined) => (x ?? "").trim();
  return [!t(b.registergericht) ? GMBH_REGISTERGERICHT : "", !t(b.registernummer) ? GMBH_REGISTERNUMMER : "", !t(b.vertretung) ? GMBH_GESCHAEFTSFUEHRUNG : "", !t(b.ort) ? GMBH_SITZ : ""].filter(Boolean);
}

/**
 * E-193 (8a): Angaben auf Geschäftsbriefen einer GmbH & Co. KG bzw. UG (haftungsbeschränkt) & Co. KG: die der KG selbst
 * (Rechtsform, Sitz, Registergericht, Registernummer – § 125 Abs. 1 Satz 1, § 177a HGB) und, weil keine natürliche
 * Person persönlich haftet, die Firma der Komplementärin mit den Angaben nach § 35a GmbHG (Rechtsform, Sitz,
 * Registergericht, Registernummer, alle Geschäftsführer – § 125 Abs. 1 Satz 2 HGB). Zusatz „(Mein Betrieb, §§ 125, 177a
 * HGB)“, damit die App gleich die Gesellschaftsangaben öffnet.
 */
export const KG_ANGABEN = "§§ 125, 177a HGB";
export const KG_REGISTERGERICHT = `Registergericht der KG (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_REGISTERNUMMER = `Registernummer der KG, z. B. HRA 12345 (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_SITZ = `Ort des Betriebs als Sitz der KG (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_KOMPLEMENTAER = `Firma der persönlich haftenden Gesellschafterin (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_KOMPLEMENTAER_RECHTSFORM = `Rechtsform der persönlich haftenden Gesellschafterin (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_KOMPLEMENTAER_SITZ = `Sitz der persönlich haftenden Gesellschafterin (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_KOMPLEMENTAER_REGISTERGERICHT = `Registergericht der persönlich haftenden Gesellschafterin (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_KOMPLEMENTAER_REGISTERNUMMER = `Registernummer der persönlich haftenden Gesellschafterin, z. B. HRB 12345 (Mein Betrieb, ${KG_ANGABEN})`;
export const KG_GESCHAEFTSFUEHRUNG = `Alle Geschäftsführerinnen und Geschäftsführer der persönlich haftenden Gesellschafterin (Mein Betrieb, ${KG_ANGABEN})`;
export function komplementaerAngabenFehlen(b: Betrieb): string[] {
  if (!istCoKg(b)) return [];
  const t = (x: string | undefined) => (x ?? "").trim();
  // Rechtsform der Komplementärin: eigenes Feld oder Zusatz in ihrer Firma („Holzbau Verwaltungs-GmbH“)
  const rfKomplementaer = t(b.komplementaer_rechtsform) || /\b(GmbH|UG)\b/.test(t(b.komplementaer));
  return [
    !t(b.registergericht) ? KG_REGISTERGERICHT : "",
    !t(b.registernummer) ? KG_REGISTERNUMMER : "",
    !t(b.ort) ? KG_SITZ : "",
    !t(b.komplementaer) ? KG_KOMPLEMENTAER : "",
    t(b.komplementaer) && !rfKomplementaer ? KG_KOMPLEMENTAER_RECHTSFORM : "",
    !t(b.komplementaer_sitz) ? KG_KOMPLEMENTAER_SITZ : "",
    !t(b.komplementaer_registergericht) ? KG_KOMPLEMENTAER_REGISTERGERICHT : "",
    !t(b.komplementaer_registernummer) ? KG_KOMPLEMENTAER_REGISTERNUMMER : "",
    !t(b.vertretung) ? KG_GESCHAEFTSFUEHRUNG : "",
  ].filter(Boolean);
}

/** R12 (UX #15): Empfänger, der wie eine Privatperson heißt („Lea Schmitz“) – kein Firmenzusatz, keine Behörde, zwei bis vier Wörter. */
const FIRMA = /\b(gmbh|ug|ag|kg|ohg|gbr|e\.\s?k\.?|e\.\s?v\.?|mbh|se|ltd|inc|co\.?|gesellschaft|firma|praxis|kanzlei|apotheke|verlag|verein|stiftung|schule|kita|hotel|restaurant|café|cafe|salon|studio|agentur|werkstatt|bäckerei|service|handel|bau|technik|logistik|spedition|klinik|zentrum|institut|gruppe|holding)\b/i;
export function istPrivatperson(name: string): boolean {
  const n = name.trim();
  if (!n || /\d/.test(n) || FIRMA.test(n) || istOeffentlicherEmpfaenger(n) || /[&+@]/.test(n)) return false;
  const woerter = n.split(/\s+/);
  return woerter.length >= 2 && woerter.length <= 4 && woerter.every((w) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(w) || /^(von|van|de|der|den|zu|da|di|del|la|le)$/i.test(w));
}
/** Anrede, wenn keine eigene angegeben ist: an Privatpersonen „Guten Tag Lea Schmitz“, sonst „Sehr geehrte Damen und Herren“. */
export function standardAnrede(kunde: string): string {
  return istPrivatperson(kunde) ? `Guten Tag ${kunde.trim().replace(/\s+/g, " ")}` : ANREDE_STANDARD;
}

/** R12 (Kfz #11): Fahrzeug-Leistungen (Werkstatt) – dann passt der Grundstücks-Hinweis nicht. */
const FAHRZEUG = /\b(kfz|pkw|lkw|auto|fahrzeug|reifen|inspektion|ölwechsel|bremse|bremsen|hauptuntersuchung|abgasuntersuchung|karosserie|werkstatt|motor|getriebe|kupplung|auspuff)/i;
/** R12 (Bäckerei #15): Monat in einer Position („Lieferung Oktober“), obwohl das Leistungsdatum das Rechnungsdatum ist. */
const MONAT_IM_TEXT = /\b(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i;
export const RECHNUNG_MONAT_ZEITRAUM = (monat: string) => `In einer Position steht „${monat}“: Ist das der Zeitraum der Leistung? Dann „Leistungsdatum entspricht dem Rechnungsdatum“ ausschalten und den Zeitraum eintragen (z. B. „${monat} ${new Date().getFullYear()}“) – sonst steht das Rechnungsdatum als Leistungsdatum auf der Rechnung.`;
export const RECHNUNG_KU_GUTSCHEIN = "10er-Karte oder Gutschein als Kleinunternehmer: Für die Umsatzgrenze (§ 19 UStG) zählt beim Einzweck-Gutschein bzw. bei der Karte für eine bestimmte Leistung in der Regel schon der Verkauf, beim Mehrzweck-Gutschein erst die Einlösung (§ 3 Abs. 14 und 15 UStG) – im Zweifel mit der Steuerberatung klären.";

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

/**
 * E-208: Einzelpreis in der Tabelle der Rechnung – derselbe Nettopreis wie in der E-Rechnung (`nettoEinzelpreis`): bis
 * vier Nachkommastellen, bei Bruttopreisen so genau, dass Menge × Preis den Betrag der Zeile ergibt. Ganze Cent wie bisher.
 */
function einzelpreisText(p: Position, zeile: number): string {
  const t = nettoEinzelpreis(p, zeile);
  const stellen = Math.max(2, t.split(".")[1]?.length ?? 0);
  const n = Number(t) * (p.preis_cent < 0 ? -1 : 1);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: stellen }).format(n).replace(/^-/, "\u2212");
}

const positionenRoh = (d: Daten) => liste(d, "positionen").filter((e) => text(e, "bezeichnung") || text(e, "preis"));
/** Steuersatz einer Position – bei OSS (5.2) der Satz des Bestimmungslands statt 19 % bzw. 7 %. */
function satzFuer(d: Daten, e: Eintrag): number {
  const s = satzZahl(text(e, "satz"));
  const oss = ossSatz(d);
  return oss !== null && s > 0 ? oss : s;
}

function positionen(d: Daten): { e: Eintrag; p: Position }[] {
  const ku = kuFuer(d);
  return positionenRoh(d).map((e) => {
    const satz = satzFuer(d, e);
    return { e, p: { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck", ...preisFelder(d, preisCent(text(e, "preis")) ?? 0, ku ? null : satz), ust_satz: satz } };
  });
}

// ---------------------------------------------------------------- StB-Prüfung Steuerberatungskanzlei (21.10.2026): Rechnungen

/**
 * C-3/C-13: Art des Empfängers am Kunden gemerkt – Unternehmen, Privatperson oder öffentliche Stelle. Privatperson mit
 * Leistung an einem Grundstück: Hinweis auf die Aufbewahrungspflicht (§ 14 Abs. 4 Satz 1 Nr. 9, § 14b Abs. 1 Satz 5
 * UStG) steht von selbst auf der Rechnung; öffentliche Stelle: Leitweg-ID als Käuferreferenz (BT-10) nötig.
 */
export { KUNDEN_ARTEN };
const kundeArt = (d: Daten) => text(d, "kunde_art");
/** Aufbewahrungshinweis aus dem Schalter „Leistung an einem Grundstück“ (nur Privatpersonen, nicht bei Kleinunternehmern). */
const grundstueckAuto = (d: Daten) => kundeArt(d) === "privat" && ja(d, "grundstueck_bezug") && !kuFuer(d) && !text(d, "storno_zu") && !gutschriftD(d);
/** Hinweis „Aufbewahrungspflicht“ – gewählt oder aus dem Schalter */
export const mitGrundstueckHinweis = (d: Daten) => auswahl(d, "hinweise").includes("grundstueck") || grundstueckAuto(d);
export const RECHNUNG_LEITWEG_FEHLT = "Leitweg-ID der öffentlichen Stelle (Käuferreferenz, BT-10)";
/** Leitweg-ID: Grobadressierung (2–12 Ziffern), optional Feinadressierung, zweistellige Prüfziffer – z. B. 05913000-00012-37 */
export const leitwegFormatOk = (t: string) => /^\d{2,12}(?:-[0-9A-Za-z]{1,30})?-\d{2}$/.test(t.trim());
export const RECHNUNG_LEITWEG_FORMAT = "Die Leitweg-ID hat nicht das übliche Format (z. B. 05913000-00012-37: Grobadressierung, Feinadressierung, zweistellige Prüfziffer) – bitte mit der Angabe des Auftraggebers vergleichen.";

/**
 * 5.2/C-9: Fernverkauf bzw. Leistung an eine Privatperson im übrigen Gemeinschaftsgebiet mit der Umsatzsteuer des
 * Bestimmungslands (One-Stop-Shop, § 3c, § 18j UStG). Satz in Prozent mit höchstens zwei Nachkommastellen, 0 < x < 50.
 */
export function ossSatz(d: Daten): number | null {
  if (!ja(d, "oss") || kuFuer(d)) return null;
  const t = text(d, "oss_satz").trim().replace(/\s*%$/, "").replace(",", ".");
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(t)) return null;
  const x = Number(t);
  return x > 0 && x < 50 ? x : null;
}
/** Land einer Privatperson im übrigen Gemeinschaftsgebiet (ohne USt-IdNr.) – sonst null. */
export function euPrivatLand(d: Daten): string | null {
  if (text(d, "kunde_ust_idnr").trim() || kundeArt(d) === "unternehmen" || kundeArt(d) === "oeffentlich") return null;
  const a = anschriftZerlegen(text(d, "kunde_anschrift"));
  return a.land && istEuAusland(a.land) ? a.land : null;
}
export const RECHNUNG_OSS_SATZ = "Steuersatz des Bestimmungslands (OSS) in Prozent, z. B. 20 für Österreich";
export const RECHNUNG_OSS_LAND = "OSS nur für Privatpersonen im EU-Ausland: Land in der letzten Zeile der Anschrift (z. B. Österreich) prüfen; mit USt-IdNr. ist der Empfänger ein Unternehmen.";
export const RECHNUNG_OSS_VORSCHLAG = (land: string) => `Empfänger ist eine Privatperson in ${land}: Liegen deine Fernverkäufe bzw. Leistungen an Privatpersonen im EU-Ausland im Vorjahr und im laufenden Jahr zusammen bei höchstens 10.000 € (§ 3c Abs. 4 UStG), gilt die deutsche Umsatzsteuer. Darüber – oder wenn du darauf verzichtest – gilt die Steuer von ${land}: dann „OSS“ einschalten und den Steuersatz dort angeben. OSS-Umsätze gehören in die OSS-Erklärung beim BZSt, nicht in die deutsche Voranmeldung.`;

/** C-4: Schlussrechnung – die gestellten Abschlagsrechnungen werden abgesetzt (§ 14 Abs. 5 Satz 2 UStG, A 14.8 Abs. 10 UStAE). */
const schlussD = (d: Daten) => ja(d, "schluss") && !text(d, "storno_zu") && !gutschriftD(d) && !ja(d, "abschlag");
/**
 * E-193 (8b): Stornorechnung zu einer Schlussrechnung, die die abgesetzten Abschläge spiegelt (Merker
 * `storno_abschlaege`, gesetzt beim Stornieren). Ohne Merker (Stornos aus früheren Versionen) wie bisher ohne Abschläge –
 * ein schon geteiltes Storno-PDF soll beim erneuten Teilen nicht anders aussehen als das verschickte.
 */
export const STORNO_ABSCHLAEGE = "storno_abschlaege";
const stornoSchlussD = (d: Daten) => ja(d, "schluss") && !!text(d, "storno_zu") && ja(d, STORNO_ABSCHLAEGE) && !gutschriftD(d) && !ja(d, "abschlag");
/**
 * Abgesetzte Abschläge aus der Liste „abschlaege“; Umsatzsteuer aus dem Entgelt, wenn nicht eingetragen. Bei der
 * Stornorechnung einer Schlussrechnung (E-193) mit umgekehrtem Vorzeichen wie ihre Positionen – das Storno hebt nur den
 * Rest auf, die Abschlagsrechnungen bleiben bestehen.
 */
/**
 * E-200: Satz auf dem Storno einer Schlussrechnung – storniert wird nur der mit der Schlussrechnung abgerechnete Rest, die
 * Abschlagsrechnungen (Nummer, Datum, Betrag brutto) bleiben bestehen.
 */
export function stornoSchlussSatz(schlussNummer: string, ab: Abschlag[]): string {
  const liste = ab.map((a) => `Nr. ${a.nummer}${a.datum ? ` vom ${datumDe(a.datum)}` : ""} über ${euro(-(a.netto_cent + a.ust_cent))}`);
  const und = liste.length > 1 ? `${liste.slice(0, -1).join(", ")} und ${liste.at(-1)}` : (liste[0] ?? "");
  return `Storniert wird nur der Restbetrag der Schlussrechnung Nr. ${schlussNummer}. ${liste.length > 1 ? "Die Abschlagsrechnungen" : "Die Abschlagsrechnung"} ${und} ${liste.length > 1 ? "bleiben" : "bleibt"} bestehen.`;
}
/** Satz unter dem Betreff einer Stornorechnung: „Diese Rechnung storniert die Rechnung Nr. … vom ….“ */
export function stornoBetreffSatz(nummer: string, datum: string): string {
  return `Diese Rechnung storniert die Rechnung Nr. ${nummer}${datum ? ` vom ${datumDe(datum)}` : ""}.`;
}
export function abschlaegeAus(d: Daten): Abschlag[] {
  if (stornoSchlussD(d)) return abschlaegeListe(d).map((a) => ({ ...a, netto_cent: 0 - a.netto_cent, ust_cent: 0 - a.ust_cent }));
  if (!schlussD(d)) return [];
  return abschlaegeListe(d);
}
function abschlaegeListe(d: Daten): Abschlag[] {
  const ku = kuFuer(d);
  return liste(d, "abschlaege")
    .filter((e) => text(e, "nummer") || text(e, "netto"))
    .map((e) => {
      const netto = cent(text(e, "netto")) ?? 0;
      const satz = ku ? null : satzZahl(text(e, "satz"));
      const ust = ku ? 0 : (cent(text(e, "ust")) ?? rundeCent((netto * (satz ?? 0)) / 100));
      return { nummer: text(e, "nummer").trim(), datum: isoAus(text(e, "datum")) ?? null, satz, netto_cent: netto, ust_cent: ust };
    });
}
export const RECHNUNG_SCHLUSS_LEER = "Schlussrechnung: Abschlagsrechnungen mit Nummer und Entgelt angeben (oder den Schalter „Schlussrechnung“ ausschalten)";
export const RECHNUNG_SCHLUSS_HOCH = "Schlussrechnung: Die abgesetzten Abschläge sind höher als der Rechnungsbetrag – bitte prüfen.";
export const RECHNUNG_SCHLUSS_SATZ = "Schlussrechnung: Ein Abschlag hat einen Steuersatz, der in den Positionen nicht vorkommt – bitte prüfen.";

/** B-12/C-8: Gutschriften mit eigenem Nummernkreis („GS-“), getrennt von den Rechnungsnummern. */
export const GUTSCHRIFT_PRAEFIX = "GS-";
export const istGutschriftNummer = (n: string) => /^GS[-/ ]/i.test(n.trim());
export const RECHNUNG_GUTSCHRIFT_NUMMER = `Für Gutschriften empfiehlt sich ein eigener Nummernkreis, z. B. ${GUTSCHRIFT_PRAEFIX}${new Date().getFullYear()}-001 – getrennt von deinen Rechnungsnummern. Die nächste Gutschrift zählt dann darin weiter.`;
/** C-17: Einheiten ohne eigenen Code in der E-Rechnung (dort Stück, C62). */
export const RECHNUNG_EINHEIT_CODE = (e: string[]) => `Einheit ${e.map((x) => `„${x}“`).join(", ")} kennt die E-Rechnung nicht – sie wird dort als Stück (C62) übertragen. Übliche Einheiten wie Stunde, Tag, Meter, Pauschale, kg oder Liter haben einen eigenen Code.`;

/** C-6: Ersatzrechnung – ersetzt eine stornierte Rechnung; die Änderung wirkt im Zeitraum des Stornos (§ 17 UStG). */
const ersetztNummer = (d: Daten) => (!text(d, "storno_zu") ? text(d, "ersetzt_nummer").trim() : "");

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
  // R12: bei einer Vorauszahlung der Tag der Zahlung, wenn er feststeht (§ 14 Abs. 4 Satz 1 Nr. 6 UStG), sonst der angegebene Zeitraum
  const leistungsdatum = leistungGleich(d) ? datum || null : vorauszahlungD(d) && !text(d, "leistung").trim() ? isoAus(text(d, "bezahlt_am")) : isoAus(text(d, "leistung"));
  // Gutschrift und ihr Storno: in der E-Rechnung ist der Leistende der Verkäufer (R11)
  const gutschrift = gutschriftD(d);
  // E-193 (5): Zahlungsbedingung wörtlich wie auf dem PDF – schon bezahlt („Der Rechnungsbetrag wurde am … bezahlt.“)
  // bzw. „Zahlbar sofort ohne Abzug.“; ein Zahlungsziel in Tagen steht als Fälligkeitsdatum (BT-9) darin
  const bezahltVorher = isoAus(text(d, "bezahlt_am"));
  const schonBezahlt = !storno && !gutschrift && !!bezahltVorher && !!datum && bezahltVorher <= datum;
  const zahlungsbedingung = storno ? null : schonBezahlt ? `Der Rechnungsbetrag wurde am ${datumDe(bezahltVorher!)} bezahlt.` : ziel === "sofort" ? `Zahlbar ${ZIEL.sofort}.` : null;
  const daten: RechnungsDaten = {
    nummer: text(d, "nummer"),
    rechnungsdatum: datum,
    leistungsdatum,
    ...(leistungsdatum ? {} : { leistungszeitraum: leistungszeitraumAus(text(d, "leistung")) }),
    // E-193 (5): „Sofort“ – fällig am Rechnungsdatum (BT-9), dazu der Satz vom PDF als Zahlungsbedingung (BT-20, unten)
    faellig_am: datum && ziel === "sofort" ? (storno ? null : datum) : datum && ziel ? faelligAm(datum, Number(ziel), b.bundesland) || null : null,
    ...(zahlungsbedingung ? { zahlungsbedingung } : {}),
    // E-200: schon bezahlt – in der XRechnung bezahlter Betrag (BT-113) = Rechnungsbetrag, Zahlbetrag (BT-115) = 0,00
    ...(schonBezahlt ? { bezahlt_am: bezahltVorher } : {}),
    steller: { name: b.name.trim(), strasse: b.strasse.trim(), plz: b.plz.trim(), ort: b.ort.trim(), land: "DE", email: b.email.trim(), telefon: b.telefon.trim() || null, steuernummer: b.steuernummer.trim() || null, ust_idnr: b.ust_idnr.trim() || null, iban: b.iban.trim() || null, ...registerAngaben(b) },
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
      const preis = preisCent(text(e, "preis")) ?? 0;
      // Storno: die Positionen tragen schon das umgedrehte Vorzeichen; `art: "storno"` dreht es für USt und XRechnung zurück
      const satz = ku ? null : satzFuer(d, e);
      return { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck" as const, einheit_code: einheitCode(text(e, "einheit")), ...preisFelder(d, storno ? -preis : preis, satz), ust_satz: satz };
    }),
    kleinunternehmer: ku,
    hinweis: [befreiung, ...text(d, "hinweis").split("\n").filter((h) => !(storno && h.trim() === ZAHLUNGS_HINWEIS))].filter(Boolean).join("\n") || null,
    ...(storno ? { art: "storno" as const, storniert_nummer: storno } : {}),
    // E-202 (Steuerberater, 26.10.2026): Datum der stornierten Rechnung im Verweis (BT-26) und beim Storno einer
    // Schlussrechnung als Anmerkung (BT-22) dieselben Sätze wie auf dem PDF – nicht die Anmerkung der Schlussrechnung
    ...(storno && isoAus(text(d, "storno_zu_datum")) ? { storniert_datum: isoAus(text(d, "storno_zu_datum")) } : {}),
    ...(storno && stornoSchlussD(d) && abschlaegeAus(d).length ? { storno_anmerkung: `${stornoBetreffSatz(storno, text(d, "storno_zu_datum"))} ${stornoSchlussSatz(storno, abschlaegeAus(d))}`.replace(/\u00a0/g, " ") } : {}),
    steuerart,
    befreiungsgrund: befreiung || null,
    // R12: Skonto (BT-20) – nicht für schon Bezahltes
    ...(skontoFuer(d, b.bundesland) && !(isoAus(text(d, "bezahlt_am")) && isoAus(text(d, "bezahlt_am"))! <= datum) ? { skonto: skontoFuer(d, b.bundesland) } : {}),
    // StB-Prüfung: Schlussrechnung (C-4), Ersatzrechnung (C-6), OSS (5.2)
    // E-193 (8b): beim Storno tragen die Positionen hier das ursprüngliche Vorzeichen (siehe oben) – die Abschläge ebenso
    ...(abschlaegeAus(d).length ? { abschlaege: storno ? abschlaegeAus(d).map((a) => ({ ...a, netto_cent: 0 - a.netto_cent, ust_cent: 0 - a.ust_cent })) : abschlaegeAus(d) } : {}),
    ...(ersetztNummer(d) ? { ersetzt_nummer: ersetztNummer(d) } : {}),
    ...(ossSatz(d) !== null && a.land ? { oss: { land: a.land, satz: ossSatz(d)! } } : {}),
  };
  const fehlt = fehlendFuerERechnung(daten).map((c) => E_FEHLT[c] ?? c);
  // C-13: öffentliche Stelle ohne Leitweg-ID – die Eingangsplattformen weisen die XRechnung zurück
  if (kundeArt(d) === "oeffentlich" && !gutschrift && !text(d, "kunde_leitweg_id").trim()) fehlt.push(RECHNUNG_LEITWEG_FEHLT);
  if (!a.land && a.plz) fehlt.push(E_LAND_FEHLT);
  // E-193 (5): ohne Zahlungsziel, Skonto oder Zahlungsvermerk hätte die E-Rechnung weder Fälligkeit (BT-9) noch
  // Zahlungsbedingung (BT-20) – BR-CO-25; erfunden wird keine, das Zahlungsziel ist zu wählen
  if (!storno && !ziel && !zahlungsbedingung && !daten.skonto) fehlt.push(E_ZAHLUNGSZIEL_FEHLT);
  if (!daten.nummer) fehlt.unshift("Rechnungsnummer");
  if (!datum) fehlt.unshift("Rechnungsdatum");
  return { daten, fehlt };
}

/** Art der Rechnung aus den Daten: Stornorechnung (storniert eine andere), Gutschrift (Hinweis „gutschrift“) oder Rechnung. */
export function rechnungsTitel(d: Daten): "Rechnung" | "Stornorechnung" | "Gutschrift" | "Abschlagsrechnung" | "Schlussrechnung" {
  return text(d, "storno_zu") ? "Stornorechnung" : auswahl(d, "hinweise").includes("gutschrift") ? "Gutschrift" : ja(d, "abschlag") ? "Abschlagsrechnung" : schlussD(d) ? "Schlussrechnung" : "Rechnung";
}

/**
 * C-14: Registerangaben einer Gesellschaft für die E-Rechnung – BT-30 (Registernummer) und BT-33 (Rechtsform, Sitz,
 * Registergericht, Geschäftsführung, § 35a GmbHG). Nur mit eingetragener Registernummer.
 */
function registerAngaben(b: Betrieb): { register?: string; rechtliches?: string } {
  const nr = (b.registernummer ?? "").trim();
  if (!nr) return {};
  const form = (formImNamen(b.rechtsform ?? "") ?? formImNamen(b.name) ?? (b.rechtsform ?? "").trim()) || "";
  // E-193 (8a): GmbH & Co. KG – mit der Komplementärin und ihren Angaben (§§ 125, 177a HGB), vor ihren Geschäftsführern (E-200: „Geschäftsführer der Komplementärin“)
  const teile = [form, b.ort.trim() ? `Sitz ${b.ort.trim()}` : "", [(b.registergericht ?? "").trim(), nr].filter(Boolean).join(" "), komplementaerZeile(b), (b.vertretung ?? "").trim() ? `${istCoKg(b) ? CO_KG_GESCHAEFTSFUEHRER : "Geschäftsführung"}: ${(b.vertretung ?? "").trim().replace(/\s*\n\s*/g, ", ")}` : ""].filter(Boolean);
  return { register: nr, rechtliches: teile.join(", ") };
}


/** E-193 (5): E-Rechnung ohne Zahlungsziel (BR-CO-25) – Bezeichnung des Felds, damit „Ergänzen“ den Schritt öffnet. */
export const E_ZAHLUNGSZIEL_FEHLT = "Zahlungsziel";

/** Meldungen der Rechnungsprüfung (auch für die Zuordnung zu einem Feld im Abschluss). */
export const RECHNUNG_PLZ_FEHLT = "PLZ und Ort des Empfängers fehlen (letzte Zeile der Anschrift, z. B. 10115 Berlin)";
export const RECHNUNG_NULL = "Rechnungsbetrag ist 0,00 € – bitte die Preise prüfen";
/** Position mit Menge 0 oder negativ (M6) – die E-Rechnung lehnt sie ab; Rabatte als negativer Preis eintragen. */
export const RECHNUNG_MENGE = "Menge einer Position ist 0 oder negativ – bitte die Menge prüfen (Rabatte als negativen Preis eintragen)";
export const RECHNUNG_NEGATIV = "Rechnungsbetrag ist negativ – bitte die Preise prüfen (eine geteilte Rechnung korrigierst du mit „Stornieren“)";

/** Anrede der Rechnung, wenn keine eigene angegeben ist. */
const ANREDE_STANDARD = "Sehr geehrte Damen und Herren";

/** R12: Einheiten zur Auswahl in Rechnungspositionen – Dienstleistungen zuerst, dazu Termin und Kilometer. */
const RECHNUNG_EINHEITEN = ["Stück", "Stunde", "Pauschale", "Termin", "Tag", "Monat", "Kilometer", ...EINHEITEN.filter((e) => !["Stück", "Stunde", "Pauschale", "Tag", "Monat", "Kilometer", "Minute", "Woche"].includes(e)).slice(0, 3)];
/** R12 (Coach #18): Pflichthinweise, die Kleinunternehmer nur in besonderen Fällen brauchen (eine Bedingung genügt). */
const KU_OHNE: Record<string, Option["wenn"]> = {
  igl: { feld: "kleinunternehmer", nicht: true },
  reverse_charge: [{ feld: "kleinunternehmer", nicht: true }, { feld: "kunde_ust_idnr" }],
};

export const rechnung: Vorlage = {
  id: "rechnung",
  gestalt: "brief",
  titel: "Rechnung",
  // StB-Prüfung (C-1): „mit den Pflichtangaben nach § 14 UStG“ – Voraussetzung ist, dass Kundenart und Leistung richtig gewählt sind
  beschreibung: "Rechnung mit den Pflichtangaben nach § 14 UStG – Positionen, Steuersätze, Zahlungsziel und Pflichthinweise zum Auswählen.",
  bereich: "steuern",
  pflichten: ["steuern.rechnungen_pflichtangaben"],
  person: { art: "kunde", felder: { name: "kunde_name", anschrift: "kunde_anschrift", email: "kunde_email", ust_idnr: "kunde_ust_idnr", leitweg_id: "kunde_leitweg_id", steuernummer: "kunde_steuernummer", art: "kunde_art" } },
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
      // R12 (Coach #19): Kleinunternehmer dürfen weiter Papier- bzw. PDF-Rechnungen ausstellen (§ 34a UStDV)
      hilfe: "Am Ende teilst du die Rechnung als PDF. An Unternehmen geht sie zusätzlich als E-Rechnung (XRechnung) – für Kleinunternehmer möglich, aber keine Pflicht (§ 34a UStDV).",
      felder: [
        { id: "nummer", art: "text", label: "Rechnungsnummer", hilfe: "fortlaufend und nur einmal vergeben, z. B. 2026-001", pflicht: true },
        { id: "datum", art: "datum", label: "Rechnungsdatum", vorbelegung: "heute", pflicht: true },
        { id: "leistung_gleich", art: "schalter", label: "Leistungsdatum entspricht dem Rechnungsdatum", vorbelegung: true, wenn: { feld: "vorauszahlung", nicht: true } },
        { id: "leistung", art: "text", label: "Datum oder Zeitraum der Leistung", hilfe: "z. B. 12.10.2026 oder Oktober 2026; bei einer Vorauszahlung, soweit schon bekannt", pflicht: true, wenn: { feld: "leistung_gleich", nicht: true } },
        // R12 (Coach #6): 10er-Karte, Gutschein, Anzahlung – das Rechnungsdatum ist dann nicht das Leistungsdatum (§ 14 Abs. 4 Satz 1 Nr. 6 UStG)
        { id: "vorauszahlung", selten: true, art: "schalter", label: "Vorauszahlung (Leistung folgt)", hilfe: "z. B. 10er-Karte, Gutschein oder Anzahlung: Auf der Rechnung steht dann kein Leistungsdatum, sondern „Leistung folgt“ – mit dem Zeitraum, falls schon bekannt, und dem Zahlungstag aus „Schon bezahlt am“." },
        { id: "zahlungsziel", art: "wahl", label: "Zahlungsziel", optionen: [{ wert: "7", text: "7 Tage" }, { wert: "14", text: "14 Tage" }, { wert: "30", text: "30 Tage" }, { wert: "sofort", text: "Sofort" }], vorbelegung: "14", hilfe: "Steht auf der Rechnung als „Zahlbar innerhalb von … Tagen“ mit dem Datum." },
        // R12: Skonto als im Voraus vereinbarte Minderung des Entgelts (§ 14 Abs. 4 Satz 1 Nr. 7 UStG)
        { id: "skonto", selten: true, art: "schalter", label: "Skonto bei schneller Zahlung", hilfe: "Steht im Zahlungsblock als Bedingung (§ 14 Abs. 4 Satz 1 Nr. 7 UStG) und in der E-Rechnung. Der Satz „2 % Skonto bei Zahlung bis …“ genügt, der Betrag muss nicht dastehen (A 14.5 Abs. 19 UStAE). Der GiroCode enthält den vollen Betrag. Zieht der Kunde Skonto ab, vermerkst du beim Zahlungseingang den erhaltenen Betrag." },
        { id: "skonto_prozent", art: "zahl", label: "Skonto in Prozent", hilfe: "z. B. 2 oder 2,5", vorbelegung: "2", pflicht: true, wenn: { feld: "skonto" } },
        { id: "skonto_tage", art: "zahl", label: "bei Zahlung innerhalb von … Tagen", hilfe: "ab Rechnungsdatum, z. B. 10", vorbelegung: "10", pflicht: true, wenn: { feld: "skonto" } },
        { id: "bezahlt_am", selten: true, art: "datum", label: "Schon bezahlt am", hilfe: "z. B. bei Barzahlung, Vorkasse oder Zahlung im Onlineshop – bezahlt am oder vor dem Rechnungsdatum, entfällt die Zahlungsaufforderung" },
        { id: "bestellnummer", selten: true, art: "text", label: "Bestellnummer des Kunden", hilfe: "steht auf der Rechnung und in der E-Rechnung (BT-13)" },
        { id: "anlage", selten: true, art: "text", label: "Anlage", hilfe: "steht als „Anlage: …“ unter der Rechnung, z. B. Tourenliste oder Stundenzettel – die Datei selbst schickst du mit", vorschlaege: ["Tourenliste", "Stundenzettel", "Aufmaß", "Leistungsnachweis"] },
        { id: "abschlag", selten: true, art: "schalter", label: "Abschlagsrechnung (Anzahlung vor Fertigstellung)", hilfe: "Die Umsatzsteuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG) – in der Voranmeldung zählt die Rechnung im Zeitraum des Zahlungseingangs. Als Leistungsdatum das voraussichtliche Datum angeben, nicht das Rechnungsdatum." },
        // StB-Prüfung (C-4): Schlussrechnung setzt die Abschläge mit Entgelt und Steuer ab (§ 14 Abs. 5 Satz 2 UStG)
        { id: "schluss", selten: true, art: "schalter", label: "Schlussrechnung (Abschläge absetzen)", hilfe: "Die Positionen nennen die gesamte Leistung; darunter werden die Abschlagsrechnungen mit Entgelt und Umsatzsteuer abgesetzt (§ 14 Abs. 5 Satz 2 UStG, A 14.8 Abs. 10 UStAE) – sonst schuldest du die Steuer der Abschläge doppelt (§ 14c UStG). In der Voranmeldung zählt nur der Rest; die Abschläge sind mit ihrer Zahlung schon versteuert.", wenn: { feld: "abschlag", nicht: true } },
        {
          id: "abschlaege", art: "liste", label: "Abgesetzte Abschlagsrechnungen", eintrag: "Abschlagsrechnung", titelFeld: "nummer", leerStarten: true, wenn: { feld: "schluss" },
          hilfe: "je Abschlagsrechnung Nummer, Datum, Entgelt (netto) und Steuersatz – die Umsatzsteuer rechnet die App, wenn du sie nicht einträgst",
          felder: [
            { id: "nummer", art: "text", label: "Nummer der Abschlagsrechnung", pflicht: true },
            { id: "datum", art: "datum", label: "Datum der Abschlagsrechnung" },
            { id: "netto", art: "betrag", label: "Entgelt netto (€)", pflicht: true },
            { id: "satz", art: "wahl", label: "Umsatzsteuer", optionen: SAETZE.filter((x) => x.wert !== SATZ_NULLSATZ), vorbelegung: "19" },
            { id: "ust", art: "betrag", label: "Umsatzsteuer (€)", hilfe: "wie auf der Abschlagsrechnung; leer: Entgelt × Steuersatz" },
          ],
        },
        // StB-Prüfung (C-6): Ersatzrechnung nach Storno – die Korrektur wirkt im Zeitraum des Stornos (§ 17 UStG)
        { id: "ersetzt_nummer", selten: true, art: "text", label: "Ersetzt die stornierte Rechnung Nr.", hilfe: "Bei einer korrigierten Rechnung nach einem Storno: In der Voranmeldung zählt sie als Korrektur im Zeitraum des Stornos, nicht als neue Leistung (§ 17 UStG). Beim „Kopieren“ einer stornierten Rechnung trägt die App die Nummer selbst ein." },
      ],
    },
    {
      titel: "Rechnungsempfänger",
      felder: [
        { id: "kunde_name", art: "text", label: "Name oder Firma", pflicht: true },
        { id: "kunde_anschrift", art: "mehrzeilig", label: "Anschrift", hilfe: "Straße und Hausnummer, PLZ und Ort – im Ausland das Land in die letzte Zeile", pflicht: true },
        { id: "kunde_email", art: "text", label: "E-Mail des Empfängers", hilfe: "nötig für die E-Rechnung an Unternehmen" },
        // StB-Prüfung (C-3, C-13): Art des Empfängers – wird beim Kunden gemerkt
        { id: "kunde_art", art: "wahl", label: "Empfänger ist", optionen: KUNDEN_ARTEN, hilfe: "Privatperson: bei Leistungen an einem Grundstück steht der Hinweis auf die zweijährige Aufbewahrungspflicht auf der Rechnung (§ 14 Abs. 4 Satz 1 Nr. 9 UStG). Öffentliche Stelle: Für die E-Rechnung ist die Leitweg-ID Pflicht. Wird beim Kunden gemerkt." },
        { id: "grundstueck_bezug", art: "schalter", label: "Leistung an einem Grundstück (Haus, Wohnung, Garten)", hilfe: "z. B. Elektroinstallation, Reparatur, Einbau, Gartenanlage, Reinigung einer Wohnung: Dann steht der Hinweis auf die zweijährige Aufbewahrungspflicht der Privatperson auf der Rechnung (§ 14b Abs. 1 Satz 5 UStG).", vorbelegungJe: { handwerk_allgemein: true, gebaeudereinigung: true }, wenn: { feld: "kunde_art", ist: "privat" } },
        { id: "anrede", selten: true, art: "text", label: "Anrede", hilfe: `Steht über dem Text der Rechnung; leer: an Privatpersonen „Guten Tag“ mit dem Namen, sonst „${ANREDE_STANDARD}“`, vorschlaege: [ANREDE_STANDARD, "Sehr geehrte Frau …", "Sehr geehrter Herr …", "Guten Tag …", "Hallo …"] },
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
        // R12 (UX #5): sichtbar über den Positionen und im Salon, Café bzw. bei reinen Privatkunden vorbelegt (profilStart); nicht bei Kleinunternehmern
        { id: "preise_brutto", art: "schalter", label: "Preise inkl. Umsatzsteuer (brutto)", hilfe: `Unter „Einzelpreis“ steht der Endpreis (z. B. 45,00 €) – Netto und Umsatzsteuer rechnet ${MARKE.name} genau daraus.`, vorbelegungJe: { friseur: true, kosmetik: true, gastro_cafe: true }, wenn: { feld: "kleinunternehmer", nicht: true } },
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
            // R12 (UX #14): Dienstleistungen meist als Pauschale bzw. Stunde – je Branche vorbelegt
            { id: "einheit", art: "text", label: "Einheit", vorschlaege: RECHNUNG_EINHEITEN, vorbelegung: { text: "Stück" }, vorbelegungJe: { friseur: "Pauschale", kosmetik: "Pauschale", handwerk_allgemein: "Stunde", gebaeudereinigung: "Pauschale", unterricht: "Termin" } },
            { id: "preis", art: "betrag", label: "Einzelpreis netto (€)", hilfe: "mit „Preise inkl. Umsatzsteuer“ der Bruttopreis", pflicht: true },
            // R12 (Bäckerei #15): eine neue Position übernimmt den Steuersatz der letzten
            { id: "satz", art: "wahl", label: "Umsatzsteuer", optionen: SAETZE, vorbelegung: "19", wieVorher: true },
          ],
        },
      ],
    },
    {
      titel: "Steuer und Hinweise",
      felder: [
        // aus dem Pflichten-Check vorbelegt (ausProfil) – daher unter „Weitere Angaben“; eingeschaltet steht er ohnehin da
        { id: "kleinunternehmer", selten: true, art: "schalter", label: "Kleinunternehmer (§ 19 UStG)", hilfe: "Dann wird keine Umsatzsteuer ausgewiesen; der Hinweis auf die Steuerbefreiung steht auf der Rechnung." },
        // StB-Prüfung (5.2, C-9): Fernverkauf an Privatpersonen im EU-Ausland über der Schwelle – Steuer des Bestimmungslands
        { id: "oss", selten: true, art: "schalter", label: "OSS – Umsatzsteuer des Bestimmungslands (Privatperson im EU-Ausland)", hilfe: "Für Fernverkäufe und bestimmte Leistungen an Privatpersonen im EU-Ausland, wenn sie EU-weit im Vorjahr oder im laufenden Jahr über 10.000 € liegen (§ 3c Abs. 4 UStG) oder du auf die Schwelle verzichtest. Die Positionen mit Umsatzsteuer tragen dann den Steuersatz des Bestimmungslands; die Rechnung gehört in die OSS-Erklärung beim BZSt, nicht in die deutsche Voranmeldung.", wenn: { feld: "kleinunternehmer", nicht: true } },
        { id: "oss_satz", art: "zahl", label: "Steuersatz im Bestimmungsland (%)", hilfe: "z. B. 20 (Österreich), 21 (Niederlande, Belgien), 20 (Frankreich) – ermäßigte Sätze je nach Ware", pflicht: true, wenn: { feld: "oss" } },
        { id: "leistender_steuer", selten: true, art: "wahl", label: "Umsatzsteuer des Leistenden (bei Gutschrift)", optionen: [{ wert: "regel", text: "weist Umsatzsteuer aus" }, { wert: "ku", text: "Kleinunternehmer (§ 19 UStG)" }], hilfe: "Bei einer Gutschrift richtet sich die Umsatzsteuer nach dem Leistenden, nicht nach dir. Ohne Auswahl gilt der Schalter „Kleinunternehmer“.", wenn: { feld: "hinweise", ist: "gutschrift" } },
        // R12 (Coach #18): bei Kleinunternehmern keine innergemeinschaftliche Lieferung; Steuerschuldnerschaft nur mit USt-IdNr. des Empfängers (EU-Ausland)
        { id: "hinweise", selten: true, art: "bausteine", label: "Pflichthinweise, falls zutreffend", optionen: [...RECHNUNGS_HINWEISE.filter((h) => h.wert !== "steuerfrei").map((h): Option => ({ wert: h.wert, text: h.wert === "gutschrift" ? GUTSCHRIFT_AUSWAHL : h.text, quelle: h.quelle, ...(KU_OHNE[h.wert] ? { wenn: KU_OHNE[h.wert] } : {}) })), { wert: "grundstueck", text: GRUNDSTUECK_HINWEIS, quelle: "§ 14 Abs. 4 Nr. 9, § 14b Abs. 1 Satz 5 UStG", wenn: { feld: "kleinunternehmer", nicht: true } }] },
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
    [RECHNUNG_SKONTO_FALSCH]: "skonto_prozent",
    [RECHNUNG_SKONTO_FRIST]: "skonto_tage",
    [RECHNUNG_SKONTO_HOCH]: "skonto_prozent",
    [RECHNUNG_NULLSATZ_GEMISCHT]: "positionen",
    [RECHNUNG_OSS_SATZ]: "oss_satz",
    [RECHNUNG_OSS_LAND]: "kunde_anschrift",
    [RECHNUNG_SCHLUSS_LEER]: "abschlaege",
    [RECHNUNG_SCHLUSS_HOCH]: "abschlaege",
    [RECHNUNG_LEITWEG_FEHLT]: "kunde_leitweg_id",
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
  nichtPflicht: (d) => [...(kleinbetrag(d) ? ["kunde_name", "kunde_anschrift"] : []), ...(vorauszahlungD(d) ? ["leistung"] : [])],
  // R12 (UX #5): Bruttopreise auch, wenn laut Pflichten-Check nur Privatpersonen kaufen (nicht bei Kleinunternehmern)
  profilStart(profil) {
    const seg = profil["kunden.segmente"];
    const start: Daten = Array.isArray(seg) && seg.length === 1 && seg[0] === "b2c" && profil["ust.kleinunternehmer"] !== true ? { preise_brutto: true } : {};
    return start;
  },
  pruefen(d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift des Betriebs (Mein Betrieb)");
    // Gutschrift: die Steuerdaten des Leistenden gehören auf das Dokument (§ 14 Abs. 4 Nr. 2 UStG), nicht die eigenen
    if (istGutschriftD(d)) {
      if (!text(d, "kunde_steuernummer").trim() && !text(d, "kunde_ust_idnr").trim()) f.push(RECHNUNG_GUTSCHRIFT_STEUER);
    } else if (!b.steuernummer.trim() && !b.ust_idnr.trim()) f.push("Steuernummer oder USt-IdNr. (Mein Betrieb)");
    // R12 (Kfz #6): GmbH bzw. UG ohne Registerangaben – Pflicht auf jedem Geschäftsbrief (§ 35a GmbHG)
    f.push(...gmbhAngabenFehlen(b));
    // E-193 (8a): GmbH & Co. KG – Angaben der KG und der Komplementärin (§§ 125, 177a HGB)
    f.push(...komplementaerAngabenFehlen(b));
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
    // Nullsteuersatz trägt seinen Hinweis selbst – Pflicht ist der Befreiungshinweis nur für steuerfreie 0-%-Positionen
    const nullProzent = positionenRoh(d).some((e) => satzZahl(text(e, "satz")) === 0 && !nullsatzPos(e));
    if (nullProzent && !kuFuer(d) && !text(d, "befreiung") && !auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl")) f.push("Hinweis auf die Steuerbefreiung (bei 0 %)");
    // StB-Prüfung: Nullsteuersatz nicht mit steuerfreien Positionen mischen; OSS mit Satz und Land; Schlussrechnung mit Abschlägen
    if (!kuFuer(d) && nullProzent && positionenRoh(d).some(nullsatzPos)) f.push(RECHNUNG_NULLSATZ_GEMISCHT);
    if (ja(d, "oss") && !kuFuer(d) && !text(d, "storno_zu")) {
      if (ossSatz(d) === null && text(d, "oss_satz").trim()) f.push(RECHNUNG_OSS_SATZ);
      if (text(d, "kunde_anschrift").trim() && !euPrivatLand(d)) f.push(RECHNUNG_OSS_LAND);
    }
    if (schlussD(d)) {
      const ab = abschlaegeAus(d);
      if (!ab.length) f.push(RECHNUNG_SCHLUSS_LEER);
      else if (pos.length && abschlagsSumme(ab).brutto_cent > summen(pos.map((x) => x.p), kuFuer(d)).brutto_cent) f.push(RECHNUNG_SCHLUSS_HOCH);
    }
    // R11: Steuerschuldnerschaft bzw. igL mit Umsatzsteuer in den Positionen – Widerspruch (§ 14c Abs. 1 UStG); nicht bei Gutschriften und Kleinunternehmern
    if (!kuFuer(d) && !gutschriftD(d) && auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl") && pos.some((x) => (x.p.ust_satz ?? 0) > 0)) f.push(RECHNUNG_RC_MIT_UST);
    if (ja(d, "abschlag") && leistungGleich(d) && !text(d, "storno_zu")) f.push(RECHNUNG_ABSCHLAG_LEISTUNG);
    // R12: Skonto nur mit lesbaren Angaben – sonst stünde eine unklare Bedingung auf der Rechnung
    if (ja(d, "skonto") && !text(d, "storno_zu") && (text(d, "skonto_prozent") || text(d, "skonto_tage")) && !skontoAus(text(d, "skonto_prozent"), text(d, "skonto_tage"))) f.push(RECHNUNG_SKONTO_FALSCH);
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
    if (!gutschrift && kundeArt(d) !== "oeffentlich" && kundeArt(d) !== "privat" && istOeffentlicherEmpfaenger(text(d, "kunde_name")) && !text(d, "kunde_leitweg_id").trim()) h.push(RECHNUNG_LEITWEG);
    // StB-Prüfung (C-13): Leitweg-ID im üblichen Format; (B-12) eigener Nummernkreis für Gutschriften; (C-17) Einheiten ohne Code
    if (!gutschrift && text(d, "kunde_leitweg_id").trim() && kundeArt(d) === "oeffentlich" && !leitwegFormatOk(text(d, "kunde_leitweg_id"))) h.push(RECHNUNG_LEITWEG_FORMAT);
    if (gutschrift && text(d, "nummer").trim() && !istGutschriftNummer(text(d, "nummer"))) h.push(RECHNUNG_GUTSCHRIFT_NUMMER);
    const ohneCode = [...new Set(positionenRoh(d).map((e) => text(e, "einheit").trim()).filter((x) => x && !einheitBekannt(x)))];
    if (ohneCode.length && kundeArt(d) !== "privat") h.push(RECHNUNG_EINHEIT_CODE(ohneCode));
    if (schlussD(d) && abschlaegeAus(d).some((a) => !positionen(d).some((x) => (kuFuer(d) ? null : x.p.ust_satz) === a.satz))) h.push(RECHNUNG_SCHLUSS_SATZ);
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
      const tag = leistungGleich(d) ? isoAus(text(d, "datum")) : (isoAus(text(d, "leistung")) ?? leistungszeitraumAus(text(d, "leistung"))?.bis ?? null);
      if (kuBis && tag && !text(d, "storno_zu")) {
        if (tag <= kuBis && !ku) h.push(RECHNUNG_KU_ZEIT(datumDe(kuBis)));
        else if (tag > kuBis && ku) h.push(RECHNUNG_NACH_KU_ZEIT(datumDe(kuBis)));
      }
      if (gutscheinZuNull(d)) h.push(RECHNUNG_GUTSCHEIN);
      const sk = ja(d, "skonto") ? skontoAus(text(d, "skonto_prozent"), text(d, "skonto_tage")) : null;
      if (sk && /^\d+$/.test(text(d, "zahlungsziel")) && sk.tage >= Number(text(d, "zahlungsziel"))) h.push(RECHNUNG_SKONTO_FRIST);
      if (sk && sk.prozent > 10) h.push(RECHNUNG_SKONTO_HOCH);
      // R12 (Kfz #11, Bäckerei #14): nur Bau und Ausbau, nur an Privatpersonen, nicht bei Fahrzeug-Leistungen
      // 5.2: Privatperson im EU-Ausland ohne OSS – auf die Lieferschwelle hinweisen
      const euPrivat = euPrivatLand(d);
      if (!ku && euPrivat && !ja(d, "oss") && !text(d, "storno_zu") && positionen(d).some((x) => (x.p.ust_satz ?? 0) > 0)) h.push(RECHNUNG_OSS_VORSCHLAG(euPrivat));
      // C-3: mit „Empfänger ist Privatperson“ entscheidet der Schalter „Leistung an einem Grundstück“ – kein Vorschlag mehr
      if (extra?.handwerk && !ku && !hw.includes("grundstueck") && !kundeArt(d) && !text(d, "kunde_ust_idnr").trim() && !text(d, "storno_zu") && !istOeffentlicherEmpfaenger(text(d, "kunde_name")) && !FIRMA.test(text(d, "kunde_name")) && !FAHRZEUG.test(b.name) && !positionen(d).some((x) => FAHRZEUG.test(x.p.bezeichnung)) && positionen(d).some((x) => (x.p.ust_satz ?? 0) > 0)) h.push(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
      // R12 (Bäckerei #15): „Lieferung Oktober“ – Leistungszeitraum statt Rechnungsdatum?
      const monat = leistungGleich(d) && !text(d, "storno_zu") ? positionen(d).map((x) => MONAT_IM_TEXT.exec(x.p.bezeichnung)?.[1]).find(Boolean) : undefined;
      if (monat) h.push(RECHNUNG_MONAT_ZEITRAUM(monat[0]!.toLocaleUpperCase("de") + monat.slice(1).toLocaleLowerCase("de")));
      // R12 (Coach #7): Kleinunternehmer mit 10er-Karte oder Gutschein – welches Jahr für die Umsatzgrenze zählt
      if (ku && (vorauszahlungD(d) || positionen(d).some((x) => /gutschein|\d+er[-\s]?karte|zehnerkarte/i.test(x.p.bezeichnung)))) h.push(RECHNUNG_KU_GUTSCHEIN);
    }
    return h;
  },
  ergebnis(d) {
    const ku = kuFuer(d);
    const s = summen(positionen(d).map((x) => x.p), ku);
    // Kleinunternehmer: ohne Umsatzsteuer gibt es kein „Netto“ (R10, Befund Freiberuf)
    const ab = abschlagsSumme(abschlaegeAus(d));
    const basis: [string, string][] = ku ? [["Rechnungsbetrag", euro(s.brutto_cent)]] : [["Netto", euro(s.netto_cent)], ["Umsatzsteuer", euro(s.ust_cent)], ["Rechnungsbetrag", euro(s.brutto_cent)]];
    // C-4: Schlussrechnung – abgesetzte Abschläge und Rest; E-200: beim Storno gespiegelt (die Abschläge bleiben bestehen)
    if (ab.brutto_cent && stornoSchlussD(d)) return [...basis, ["zuzüglich Abschläge (bleiben bestehen)", euro(-ab.brutto_cent)], ["Stornobetrag", euro(s.brutto_cent - ab.brutto_cent)]];
    return ab.brutto_cent ? [...basis, ["abzüglich Abschläge", euro(-ab.brutto_cent)], ["Noch zu zahlen", euro(s.brutto_cent - ab.brutto_cent)]] : basis;
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
    // C-4: Schlussrechnung – abgesetzte Abschläge und der Rest, der noch zu zahlen ist
    const ab = abschlaegeAus(d);
    const abSumme = abschlagsSumme(ab);
    const zuZahlen = s.brutto_cent - abSumme.brutto_cent;
    // E-200: Storno einer Schlussrechnung – nur der Rest wird storniert, die Abschlagsrechnungen bleiben bestehen
    const stornoSchluss = stornoSchlussD(d) && ab.length > 0;
    const zeilenHtml = pos.map(({ e, p }, i) => [
      String(i + 1),
      zelle(p.bezeichnung),
      `${zahlText(p.menge, 4)}${text(e, "einheit") ? ` ${esc(einheitFuerMenge(text(e, "einheit"), p.menge))}` : ""}`,
      einzelpreisText(ku ? { ...p, ust_satz: null } : p, s.zeilen[i]!),
      ...(ku ? [] : [p.ust_satz === 0 ? "0 %" : `${p.ust_satz} %`]),
      euro(s.zeilen[i]!),
    ]);
    const summenZeilen = [
      // Kleinunternehmer: ohne Umsatzsteuer gibt es kein „netto“
      `<tr><td>${ku ? "Summe" : "Summe netto"}</td><td>${betrag(s.netto_cent)}</td></tr>`,
      ...(ku
        ? []
        : s.gruppen.map((g) => {
            // C-2: § 13b bzw. igL ohne Satz und Betrag („entfällt“), sonst der Satz mit Bemessungsgrundlage und Steuer
            const entfaellt = g.satz === 0 ? ustEntfaellt(auswahl(d, "hinweise")) : null;
            return entfaellt ? `<tr><td>${entfaellt}</td><td></td></tr>` : `<tr><td>${g.satz === 0 ? nullProzentText(auswahl(d, "hinweise"), befreiungText(d)) : `Umsatzsteuer ${g.satz} %`} auf ${euro(g.netto_cent)}</td><td>${euro(g.ust_cent)}</td></tr>`;
          })),
      // leere Vorlage: Zeile für die Umsatzsteuer mit Steuersatz zum Eintragen
      ...(leer && !ku ? [`<tr><td>Umsatzsteuer <span class="fuellen kurz"></span> %</td><td>&nbsp;</td></tr>`] : []),
      // Kleinbetragsrechnung (§ 33 Satz 1 Nr. 4 UStDV): der Steuersatz steht beim Gesamtbetrag („inkl. 19 % USt“)
      ab.length
        ? `<tr><td>Gesamtbetrag der Leistung</td><td>${betrag(s.brutto_cent)}</td></tr>`
        : `<tr class="gesamt"><td>${gutschrift ? "Gutschriftsbetrag" : !ku && !leer && kleinbetrag(d) && s.gruppen.length === 1 && (s.gruppen[0]!.satz ?? 0) > 0 ? `Rechnungsbetrag inkl. ${s.gruppen[0]!.satz} % USt` : "Rechnungsbetrag"}</td><td>${betrag(s.brutto_cent)}</td></tr>`,
      // C-4: Schlussrechnung – je Abschlag Entgelt und Umsatzsteuer getrennt absetzen (§ 14 Abs. 5 Satz 2 UStG).
      // E-200: Beim Storno einer Schlussrechnung stehen die Abschläge mit gespiegeltem Vorzeichen da („zuzüglich … bleibt
      // bestehen“, positiver Betrag), damit jede Zeile so gerechnet wird, wie sie dasteht: −11.900 + 6.000 + 1.140 = −4.760.
      ...ab.flatMap((a) => [
        `<tr><td>${stornoSchluss ? "zuzüglich" : "abzüglich"} Abschlagsrechnung Nr. ${esc(a.nummer)}${a.datum ? ` vom ${datumDe(a.datum)}` : ""}${stornoSchluss ? " (bleibt bestehen)" : ""}: Entgelt</td><td>${euro(-a.netto_cent)}</td></tr>`,
        ...(ku ? [] : [`<tr><td>${stornoSchluss ? "zuzüglich" : "abzüglich"} darauf entfallende Umsatzsteuer${a.satz !== null ? ` ${a.satz} %` : ""}</td><td>${euro(-a.ust_cent)}</td></tr>`]),
      ]),
      ...(ab.length
        ? [
            ...(ku ? [] : [`<tr><td>${stornoSchluss ? "Storniertes" : "Verbleibendes"} Entgelt ${euro(s.netto_cent - abSumme.netto_cent)}, darauf Umsatzsteuer</td><td>${euro(s.ust_cent - abSumme.ust_cent)}</td></tr>`]),
            `<tr class="gesamt"><td>${stornoSchluss ? "Stornobetrag" : "Noch zu zahlen"}</td><td>${euro(zuZahlen)}</td></tr>`,
          ]
        : []),
    ].join("");
    const leistung = text(d, "leistung");
    const datum = text(d, "datum");
    const vorauszahlung = vorauszahlungD(d);
    // schon bezahlt (am oder vor dem Rechnungsdatum, z. B. bar oder im Onlineshop): keine Zahlungsaufforderung
    const bezahltAm = isoAus(text(d, "bezahlt_am"));
    const schonBezahlt = !storno && !gutschrift && !leer && !!bezahltAm && !!datum && bezahltAm <= datum;
    const zahlbar = !storno && !gutschrift && !schonBezahlt;
    // Zahlungsaufforderung mit Verwendungszweck „Rechnung <Nummer>“ (unten, bei hinterlegter IBAN)
    const mitVerwendungszweck = zahlbar && !!b.iban.trim() && (zuZahlen > 0 || leer);
    const befreiung = befreiungText(d);
    // Kleinunternehmer mit Leistung an ein Unternehmen im EU-Ausland: Hinweis auf die Steuerschuldnerschaft statt § 19 (der Baustein steht unten)
    const kuRc = ku && auswahl(d, "hinweise").includes("reverse_charge");
    // Pflichthinweise stehen direkt unter den Summen und rücken nicht ohne sie auf eine Folgeseite
    const pflichtHinweise = [
      ...(ku && !kuRc ? [KU_HINWEIS] : []),
      // „Gutschrift“ steht schon als Titel im Betreff
      ...auswahl(d, "hinweise").filter((w) => !(w === "gutschrift" && !storno)).map((w) => (w === "grundstueck" ? GRUNDSTUECK_HINWEIS : (RECHNUNGS_HINWEISE.find((h) => h.wert === w)?.text ?? ""))),
      // C-3: Privatperson mit Leistung an einem Grundstück – Aufbewahrungshinweis ohne eigene Auswahl
      grundstueckAuto(d) && !auswahl(d, "hinweise").includes("grundstueck") ? GRUNDSTUECK_HINWEIS : "",
      // ein kurzer Befreiungshinweis steht schon in der Summenzeile
      befreiungInSumme(befreiung) && !ku ? "" : befreiung,
      schonBezahlt ? `Der Rechnungsbetrag wurde am ${datumDe(bezahltAm)} bezahlt.` : "",
      // E-200: Storno einer Schlussrechnung – was storniert wird und was bestehen bleibt, in einem Satz
      stornoSchluss ? stornoSchlussSatz(storno, ab) : "",
    ].filter((x) => x.trim());
    // R12: Skonto als Bedingung im Zahlungsblock (§ 14 Abs. 4 Satz 1 Nr. 7 UStG) – der GiroCode bleibt beim vollen Betrag
    const sk = zahlbar && !leer && zuZahlen > 0 ? skontoFuer(d, b.bundesland) : null;
    const skBetrag = sk ? skontoBetrag(zuZahlen, sk.prozent) : 0;
    const skontoSatz = sk ? `Bei Zahlung bis zum ${datumDe(sk.bis)} gewähren wir ${prozentText(sk.prozent)} % Skonto (${euro(skBetrag)}); zu überweisen sind dann ${euro(zuZahlen - skBetrag)}.` : "";
    const hinweise = [
      // leere Vorlage: statt „Zahlbar …“ die Zahlungsaufforderung mit Linie für das Datum (unten)
      text(d, "zahlungsziel") && zahlbar && !b.iban.trim() && !leer ? `Zahlbar ${ZIEL[text(d, "zahlungsziel")]}${text(d, "zahlungsziel") !== "sofort" && text(d, "datum") ? ` (bis ${datumDe(faelligAm(text(d, "datum"), Number(text(d, "zahlungsziel")), b.bundesland))})` : ""}.` : "",
      // ohne IBAN (kein Zahlungsblock): die Skonto-Bedingung bei den Hinweisen
      skontoSatz && !b.iban.trim() ? skontoSatz : "",
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
    const qr = zahlbar && iban && zuZahlen > 0 && !drittlandLand(d) ? giroCodeSvg({ name: b.name.trim(), iban, bic: b.bic ?? null, betragCent: zuZahlen, verwendungszweck: `Rechnung ${text(d, "nummer")}` }, 25) : null;
    // Kontoinhaber vor der IBAN; Einzelunternehmen mit der Inhaberin bzw. dem Inhaber (Gesellschaften: nur die Firma)
    const empfaenger = b.name.trim() ? `Empfänger: ${esc(b.name.trim())}${b.verantwortlich.trim() && !(b.vertretung ?? "").trim() && !b.name.includes(b.verantwortlich.trim()) ? ` (${esc(b.verantwortlich.trim())})` : ""}<br>` : "";
    // BIC und Bank in einer Zeile („BIC … · Sparkasse …“) – spart eine Zeile im Zahlungsblock
    const bicBank = [b.bic?.trim() ? `BIC ${esc(b.bic.trim())}` : "", b.bank?.trim() ? esc(b.bank.trim()) : ""].filter(Boolean).join(" · ");
    const zahlung =
      zahlbar && iban && zuZahlen > 0
        ? `<div class="zahlung">${qr ? `<div class="qr">${qr}<small>${sk ? "GiroCode über den vollen Betrag" : "GiroCode – mit der Banking-App scannen"}</small></div>` : ""}<div class="text"><p>Bitte überweisen Sie <strong>${euro(zuZahlen)}</strong>${faellig ? ` bis zum <strong>${esc(faellig)}</strong>` : ziel === "sofort" ? " sofort ohne Abzug" : ""} auf das Konto</p><p>${empfaenger}<strong>IBAN ${esc(ibanText(iban))}</strong>${bicBank ? `<br>${bicBank}` : ""}<br>Verwendungszweck: Rechnung ${esc(text(d, "nummer"))}</p>${sk ? `<p>${esc(skontoSatz)}</p>` : ""}</div></div>`
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
      // C-6: Ersatzrechnung – Bezug auf die stornierte Rechnung, wenn er nicht schon in den Hinweisen steht
      unterBetreff: storno ? stornoBetreffSatz(storno, text(d, "storno_zu_datum")) : ersetztNummer(d) && !/ersetzt/i.test(text(d, "hinweis")) ? `Diese Rechnung ersetzt die stornierte Rechnung Nr. ${ersetztNummer(d)}.` : undefined,
      betrieb: b,
      stand: datumDe(datum),
      // Schweizer UID (CHE-…) heißt „UID/MWST-Nr.“, nicht USt-IdNr.
      empfaenger: { name: text(d, "kunde_name"), anschrift: text(d, "kunde_anschrift"), zusatz: text(d, "kunde_ust_idnr") ? `${/^\s*CHE/i.test(text(d, "kunde_ust_idnr")) ? "UID/MWST-Nr." : "USt-IdNr."} ${text(d, "kunde_ust_idnr")}` : undefined },
      // R12 (UX #16): Nummer, Rechnungsdatum, Leistungsdatum, Steuernummer – die Daten der Rechnung zusammen oben, Kontakt darunter
      info: [
        ["Rechnungsnummer", text(d, "nummer"), true],
        ["Rechnungsdatum", datumDe(datum), true, true],
        // ein einzelnes Datum heißt „Leistungsdatum“, alles andere (z. B. „Oktober 2026“, „02.03. – 27.03.2026“) „Leistungszeitraum“;
        // R12: Vorauszahlung – „Leistung folgt“ (mit Zeitraum, falls bekannt); Kleinbetragsrechnung ohne Leistungsdatum (§ 33 UStDV)
        ...((vorauszahlung
          ? [[leistung.trim() ? (isoAus(leistung) ? "Leistungsdatum" : "Leistungszeitraum") : "Leistung", leistung.trim() ? `${leistung.trim()} (Leistung folgt)` : "folgt (Vorauszahlung)"], ...(bezahltAm ? [["Zahlung erhalten", datumDe(bezahltAm)]] : [])]
          : leistungGleich(d) && !leer && kleinbetrag(d)
            ? []
            : [[leistungGleich(d) || isoAus(leistung) || !leistung.trim() ? "Leistungsdatum" : "Leistungszeitraum", leistungGleich(d) ? datumDe(datum) : leistung]]) as [string, string][]),
        ...(text(d, "bestellnummer").trim() ? ([["Ihre Bestellnummer", text(d, "bestellnummer").trim()]] as [string, string][]) : []),
        ...(text(d, "kunde_leitweg_id").trim() ? ([["Leitweg-ID", text(d, "kunde_leitweg_id").trim()]] as [string, string][]) : []),
        // Gutschrift: Steuernummer bzw. USt-IdNr. des Leistenden (§ 14 Abs. 4 Nr. 2 UStG) – nicht die des ausstellenden Betriebs
        ...(gutschrift && !storno
          ? ([["Steuernr. Leistender", text(d, "kunde_steuernummer").trim()], ["USt-IdNr. Leistender", text(d, "kunde_ust_idnr").trim()]] as [string, string][])
          : ([["Steuernummer", b.steuernummer.trim()], ["USt-IdNr.", b.ust_idnr.trim()]] as [string, string][])),
        null,
        ["Ansprechperson", b.verantwortlich.trim()],
        ["Telefon", b.telefon.trim()],
        ["E-Mail", b.email.trim()],
      ],
      // R12 (UX #15): Privatperson ohne eigene Anrede – „Guten Tag Lea Schmitz“
      anrede: anrede ? `${(text(d, "anrede") || standardAnrede(text(d, "kunde_name"))).replace(/[,\s]+$/, "")},` : undefined,
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
        `<p class="gruss"${kurzerSchluss ? ' style="margin-top:2.4mm"' : ""}>${kurzerSchluss ? hinweise.map((h) => `${esc(h)}<br>`).join("") : ""}Mit freundlichen Grüßen<br>${esc(b.verantwortlich.trim() || b.name.trim())}</p>` +
        // R12 (Kurier #21): Anlage als Vermerk – die Datei selbst geht mit der E-Mail bzw. Nachricht
        (text(d, "anlage").trim() ? `<p class="gruss" style="margin-top:3mm">Anlage: ${esc(text(d, "anlage").trim())}</p>` : "") +
        `</div></div>`,
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
        steuerHinweis("euer", MARKE.name) +
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

/** StB GoBD (E-5): Angaben unter der Bilanz einer Kleinstkapitalgesellschaft statt Anhang (§ 264 Abs. 1 Satz 5 HGB). */
export const BILANZ_KLEINST = "Die Gesellschaft ist eine Kleinstkapitalgesellschaft (§ 267a HGB) und stellt keinen Anhang auf (§ 264 Abs. 1 Satz 5 HGB). Angaben unter der Bilanz:";
/** StB GoBD (E-4/E-5): Kapitalgesellschaften bilanzieren – diese Vorlage statt der EÜR. */
export const BILANZ_STATT_EUER = "GmbH, UG und andere Kaufleute mit Buchführungspflicht (§ 238 HGB, § 140 AO) stellen eine Bilanz mit Gewinn- und Verlustrechnung auf – keine EÜR. Die Werte kommen aus der Buchführung der Kanzlei bzw. dem Buchhaltungsprogramm.";

/** GmbH & Co. KG nach der Rechtsform aus „Mein Betrieb“ bzw. dem Zusatz im Namen. */
const istGmbhCoKg = (b: Betrieb) => (formImNamen(b.rechtsform ?? "") ?? formImNamen(b.name)) === "GmbH & Co. KG";

/**
 * StB GoBD (E-5, § 245 HGB): wer den Jahresabschluss unterschreibt – alle Geschäftsführer bzw. alle persönlich haftenden
 * Gesellschafter. Steuerberater (24.10.2026): bei der GmbH & Co. KG die Geschäftsführer der Komplementär-GmbH.
 */
export function bilanzUnterzeichner(b: Betrieb): string[] {
  const namen = (b.vertretung ?? "")
    .split(/\s*(?:,|;|\n|\bund\b|\bsowie\b)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (istKapitalgesellschaft(b.rechtsform, b.name)) return namen.length ? namen.map((n) => `${n} (Geschäftsführung)`) : ["Geschäftsführer/in", "Geschäftsführer/in"];
  if (istGmbhCoKg(b)) return namen.length ? namen.map((n) => `${n} (Geschäftsführung der Komplementär-GmbH)`) : ["Geschäftsführer/in der Komplementär-GmbH", "Geschäftsführer/in der Komplementär-GmbH"];
  if (istPersonengesellschaft(b.rechtsform, b.name)) return namen.length ? namen.map((n) => `${n} (persönlich haftende/r Gesellschafter/in)`) : ["Persönlich haftende/r Gesellschafter/in", "Persönlich haftende/r Gesellschafter/in"];
  return [b.verantwortlich.trim() ? `${b.verantwortlich.trim()} (Kaufmann/Kauffrau)` : "Kaufmann/Kauffrau"];
}

/** Kapitalgesellschaft oder GmbH & Co. KG (§§ 264, 264a HGB): Anhang bzw. Angaben unter der Bilanz, §§ 264, 266, 275 HGB. */
const bilanzKapital = (b: Betrieb) => istKapitalgesellschaft(b.rechtsform, b.name) || istGmbhCoKg(b);
/** OHG, KG und e. K. nach der Rechtsform aus „Mein Betrieb“ bzw. dem Zusatz im Namen – sie stellen keinen Anhang auf. */
const bilanzOhneAnhang = (b: Betrieb) => ["OHG", "KG", "e. K."].includes(formImNamen(b.rechtsform ?? "") ?? formImNamen(b.name) ?? "");
/**
 * Steuerberater (24.10.2026): Die Angaben unter der Bilanz (§ 264 Abs. 1 Satz 5 HGB) erscheinen im Formular nur bei
 * Kapitalgesellschaften und der GmbH & Co. KG. Startwert aus „Mein Betrieb“ (profilStart); ohne Angabe (ältere Unterlagen)
 * entscheidet die Rechtsform in „Mein Betrieb“ wie bisher.
 */
export const BILANZ_FORM: Option[] = [
  { wert: "kapital", text: "GmbH, UG oder GmbH & Co. KG – Anhang bzw. Angaben unter der Bilanz" },
  { wert: "personen", text: "OHG, KG oder e. K. – kein Anhang" },
];
const bilanzFormAus = (b: Betrieb): string | null => (bilanzKapital(b) ? "kapital" : bilanzOhneAnhang(b) ? "personen" : null);
/**
 * Steuerberater (Durchsicht 23.10.2026): Anhang nur bei Kapitalgesellschaften und GmbH & Co. KG – Kleinstkapitalgesellschaften
 * brauchen keinen, wenn die Angaben unter der Bilanz stehen; OHG, KG und e. K. stellen keinen Anhang auf.
 */
export const BILANZ_ANHANG = "Zum Jahresabschluss gehört ein Anhang (§§ 264, 284 ff. HGB) – er kommt aus der Buchführung der Kanzlei. Kleinstkapitalgesellschaften brauchen keinen Anhang, wenn die Angaben nach § 264 Abs. 1 Satz 5 HGB unter der Bilanz stehen.";
export const BILANZ_OHNE_ANHANG = "OHG, KG und e. K. stellen keinen Anhang auf.";
/** Steuerberater (Durchsicht 23.10.2026, § 245 HGB): wer unterschreibt, je Rechtsform. */
export const BILANZ_UNTERSCHRIFT = "Den Jahresabschluss unterschreiben mit Datum: bei GmbH und UG alle Geschäftsführer, bei der GmbH & Co. KG alle Geschäftsführer der Komplementär-GmbH, bei OHG und KG alle persönlich haftenden Gesellschafter, beim e. K. der Kaufmann bzw. die Kauffrau (§ 245 HGB).";
/** Steuerberater (24.10.2026, § 245 HGB): Unterschrift bei der GmbH & Co. KG – sein Wortlaut, ergänzt um das Datum wie bei den anderen Rechtsformen. */
export const BILANZ_UNTERSCHRIFT_GMBH_CO_KG = "Zu unterschreiben von allen Geschäftsführern der Komplementär-GmbH, mit dem Datum der Aufstellung (§ 245 HGB).";

export const bilanzGuv: Vorlage = {
  id: "bilanz_guv",
  gestalt: "formular",
  titel: "Bilanz und Gewinn- und Verlustrechnung",
  beschreibung: "Vorlage – Werte aus der Buchführung der Kanzlei: Erträge, Aufwendungen und Ertragsteuern, Vermögen und Kapital, Angaben unter der Bilanz und Unterschriften – mit Prüfung, ob Aktiva und Passiva aufgehen.",
  bereich: "steuern",
  pflichten: ["steuern.buchfuehrungspflicht", "steuern.e_bilanz"],
  // Steuerberater (Durchsicht 23.10.2026): §§ 264, 266, 275 HGB nur bei Kapitalgesellschaften und GmbH & Co. KG
  grundlage: "§§ 238, 242, 245 HGB; § 5b EStG",
  grundlageFuer: (_d, b) => (bilanzKapital(b) ? "§§ 238, 242, 245, 264, 266, 275 HGB; § 5b EStG" : ""),
  namensFeld: "stichtag",
  abschnitte: [
    { titel: "Stichtag",
      hilfe: `Vorlage – Werte aus der Buchführung der Kanzlei. ${BILANZ_STATT_EUER} Die E-Bilanz ans Finanzamt (§ 5b EStG) erstellt die Kanzlei bzw. das Buchhaltungsprogramm.`,
      felder: [
        { id: "stichtag", art: "datum", label: "Bilanzstichtag", pflicht: true },
        { id: "aufgestellt", art: "datum", label: "Tag der Aufstellung", hilfe: BILANZ_UNTERSCHRIFT },
      ],
    },
    {
      titel: "Gewinn- und Verlustrechnung",
      hilfe: "Kleinstkapitalgesellschaften dürfen die GuV verkürzt gliedern (§ 275 Abs. 5 HGB): Umsatzerlöse, sonstige Erträge, Materialaufwand, Personalaufwand, Abschreibungen, sonstige Aufwendungen, Steuern, Jahresüberschuss bzw. -fehlbetrag.",
      felder: [
        posten("ertraege", "Erträge", "Ertrag", "z. B. Umsatzerlöse"),
        posten("aufwendungen", "Aufwendungen", "Aufwand", "z. B. Materialaufwand, Personalaufwand"),
        { id: "ertragsteuern", art: "betrag", label: "Steuern vom Einkommen und vom Ertrag (€)", hilfe: "Steuern des Jahres laut Kanzlei – steht vor dem Jahresüberschuss (§ 275 HGB). Kapitalgesellschaften: Körperschaft- und Gewerbesteuer; e. K., OHG, KG und GmbH & Co. KG: nur Gewerbesteuer (die Einkommensteuer der Inhaber ist kein Aufwand des Unternehmens; Steuerberater 25.10.2026)" },
      ],
    },
    { titel: "Bilanz", felder: [posten("aktiva", "Aktiva", "Aktivposten", "z. B. Betriebs- und Geschäftsausstattung, Bank"), posten("passiva", "Passiva", "Passivposten", "z. B. Eigenkapital, Verbindlichkeiten")] },
    {
      titel: "Angaben unter der Bilanz",
      hilfe: "Nur für GmbH, UG, AG und GmbH & Co. KG – OHG, KG und e. K. stellen keinen Anhang auf. Eine Kleinstkapitalgesellschaft (höchstens eine der Grenzen überschritten: 450.000 € Bilanzsumme, 900.000 € Umsatzerlöse, 10 Beschäftigte im Jahresdurchschnitt; § 267a HGB) braucht keinen Anhang, wenn diese Angaben unter der Bilanz stehen (§ 264 Abs. 1 Satz 5 HGB).",
      felder: [
        // Steuerberater (24.10.2026): nur bei Kapitalgesellschaften und GmbH & Co. KG – Startwert aus „Mein Betrieb“
        { id: "anhang_form", art: "wahl", label: "Rechtsform (Anhang)", optionen: BILANZ_FORM, hilfe: "Aus „Mein Betrieb“. Nur Kapitalgesellschaften und die GmbH & Co. KG stellen einen Anhang auf bzw. machen die Angaben unter der Bilanz." },
        { id: "kleinst", art: "schalter", label: "Kleinstkapitalgesellschaft – Angaben unter der Bilanz statt Anhang", vorbelegung: true, wenn: { feld: "anhang_form", ist: "personen", nicht: true } },
        // § 264 Abs. 1 Satz 5 Nr. 1 und 2 HGB: von diesen Angaben hängt die Befreiung vom Anhang ab
        { id: "haftung", art: "mehrzeilig", label: "Haftungsverhältnisse (§ 251, § 268 Abs. 7 HGB)", hilfe: "Angabe unter der Bilanz nach § 264 Abs. 1 Satz 5 Nr. 1 HGB – ohne sie entfällt der Anhang nicht. z. B. Bürgschaften, Gewährleistungsverträge, Sicherheiten für fremde Verbindlichkeiten – sonst „Keine“", vorbelegung: { text: "Keine" }, wenn: { feld: "kleinst" } },
        { id: "organkredite", art: "mehrzeilig", label: "Vorschüsse und Kredite an Geschäftsführung bzw. Aufsichtsrat (§ 285 Nr. 9 Buchst. c HGB)", hilfe: "Angabe unter der Bilanz nach § 264 Abs. 1 Satz 5 Nr. 2 HGB – ohne sie entfällt der Anhang nicht. Betrag, Zinssatz, wesentliche Bedingungen und Rückzahlungen – sonst „Keine“", vorbelegung: { text: "Keine" }, wenn: { feld: "kleinst" } },
      ],
    },
  ],
  // Steuerberater (24.10.2026): Rechtsform für Anhang und Angaben unter der Bilanz aus „Mein Betrieb“
  profilStart(_profil, b): Daten {
    const form = b ? bilanzFormAus(b) : null;
    return form ? { anhang_form: form } : {};
  },
  pruefen(_d, b) {
    // Hinweis bleibt im Formular: Personenunternehmen ohne Buchführungspflicht ermitteln den Gewinn per EÜR
    if (b.vertretung?.trim()) return [];
    if (istKapitalgesellschaft(b.rechtsform, b.name)) return ["Geschäftsführung in „Mein Betrieb“ eintragen – alle Geschäftsführer unterschreiben den Jahresabschluss (§ 245 HGB)."];
    if (istGmbhCoKg(b)) return ["Geschäftsführer der Komplementär-GmbH in „Mein Betrieb“ eintragen – sie unterschreiben alle den Jahresabschluss (§ 245 HGB)."];
    // Steuerberater (Durchsicht 23.10.2026): bei OHG und KG alle persönlich haftenden Gesellschafter
    return istPersonengesellschaft(b.rechtsform, b.name) ? ["Persönlich haftende Gesellschafter in „Mein Betrieb“ eintragen – sie unterschreiben alle den Jahresabschluss (§ 245 HGB)."] : [];
  },
  ergebnis(d) {
    const st = cent(text(d, "ertragsteuern")) ?? 0;
    const j = summe(liste(d, "ertraege"), "betrag") - summe(liste(d, "aufwendungen"), "betrag") - st;
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
    const kapital = istKapitalgesellschaft(b.rechtsform, b.name);
    const st = cent(text(d, "ertragsteuern")) ?? 0;
    const vorSteuern = summe(l("ertraege"), "betrag") - summe(l("aufwendungen"), "betrag");
    const j = vorSteuern - st;
    // Vorlage zum Ausfüllen: kein errechnetes Ergebnis „0,00 €“
    const guvLeer = !l("ertraege").length && !l("aufwendungen").length;
    // E-5: Ertragsteuern vor dem Jahresüberschuss – bei Kapitalgesellschaften immer, sonst wenn eingetragen (Gewerbesteuer)
    const mitSteuern = kapital || guvLeer || Boolean(text(d, "ertragsteuern"));
    const akt = summe(l("aktiva"), "betrag");
    const pas = summe(l("passiva"), "betrag");
    // Anhang bzw. Angaben unter der Bilanz: Kapitalgesellschaften und GmbH & Co. KG (Steuerberater 23.10.2026)
    // Steuerberater (24.10.2026): die Angabe in der Unterlage geht vor, ohne sie die Rechtsform aus „Mein Betrieb“
    const form = text(d, "anhang_form") || bilanzFormAus(b);
    const mitAnhang = form === "kapital";
    const kleinst = mitAnhang && ja(d, "kleinst");
    // Blatt zum Ausfüllen (keine Zahlen): Linien statt des Startwerts „Keine“
    const blattLeer = guvLeer && !l("aktiva").length && !l("passiva").length;
    const angabe = (k: string) => (blattLeer ? "" : text(d, k) || "Keine");
    const aufgestellt = datumDe(text(d, "aufgestellt"));
    const schluss = nachsatz(
      !kapital && istGmbhCoKg(b)
        ? BILANZ_UNTERSCHRIFT_GMBH_CO_KG
        : `Zu unterschreiben mit dem Datum der Aufstellung von ${kapital ? "allen Geschäftsführern" : istPersonengesellschaft(b.rechtsform, b.name) ? "allen persönlich haftenden Gesellschaftern" : "der Kauffrau bzw. dem Kaufmann"} (§ 245 HGB).`,
    );
    return dokument({
      titel: "Jahresabschluss",
      betrieb: b,
      // in der Reihenfolge der Abschnitte: erst die GuV, dann die Bilanz; E-5: klar als Vorlage mit Werten der Kanzlei
      unter: `${text(d, "stichtag") ? `Gewinn- und Verlustrechnung und Bilanz zum ${datumDe(text(d, "stichtag"))}` : "Gewinn- und Verlustrechnung und Bilanz"} · Vorlage – Werte aus der Buchführung der Kanzlei`,
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Bilanzstichtag: ${datumDe(text(d, "stichtag")) || KOPF_LINIE}`, `Aufgestellt am: ${aufgestellt || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Gewinn- und Verlustrechnung",
          `<h3>Erträge</h3>${t("ertraege")}<h3>Aufwendungen</h3>${t("aufwendungen")}${kennzahlen([
            ...(mitSteuern
              ? [
                  { text: "Ergebnis vor Steuern vom Einkommen und vom Ertrag", betrag: guvLeer ? "&nbsp;" : euro(vorSteuern) },
                  { text: "Steuern vom Einkommen und vom Ertrag", hinweis: kapital ? "Körperschaft- und Gewerbesteuer" : "Gewerbesteuer", betrag: guvLeer && !text(d, "ertragsteuern") ? "&nbsp;" : euro(st) },
                ]
              : []),
            { text: guvLeer ? "Jahresüberschuss bzw. Jahresfehlbetrag" : j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", betrag: guvLeer ? "&nbsp;" : euro(Math.abs(j)), fett: true },
          ])}`,
        ) +
        // Hinweis und Satz zu § 245 HGB im letzten Abschnitt: so bleibt er mit den Unterschriften zusammen (Schlussblock)
        abschnitt("Bilanz", `${bilanz()}${akt !== pas ? `<p class="nachsatz"><strong>Aktiva und Passiva weichen um ${euro(akt - pas)} ab – bitte prüfen.</strong></p>` : ""}${kleinst ? "" : (mitAnhang ? nachsatz(BILANZ_ANHANG) : form === "personen" ? nachsatz(BILANZ_OHNE_ANHANG) : "") + schluss}`) +
        (kleinst ? abschnitt("Angaben unter der Bilanz", `<p>${esc(BILANZ_KLEINST)}</p>${angaben([["Haftungsverhältnisse (§ 251, § 268 Abs. 7 HGB)", angabe("haftung")], ["Vorschüsse und Kredite an Mitglieder der Geschäftsführung bzw. des Aufsichtsrats (§ 285 Nr. 9 Buchst. c HGB)", angabe("organkredite")]])}${schluss}`, { rand: "§ 264 Abs. 1 Satz 5 HGB" }) : "") +
        unterschriften(bilanzUnterzeichner(b), { ortDatum: true }),
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
  // Steuerberater (Durchsicht 23.10.2026): innergemeinschaftliche Erwerbe Kz 89 (19 %) und Kz 93 (7 %) mit Steuer, Vorsteuer Kz 61
  const g19 = cent(text(d, "ige_19")) ?? 0;
  const g7 = cent(text(d, "ige_7")) ?? 0;
  const v61 = cent(text(d, "vorsteuer_ige")) ?? 0;
  const steuer = s19 + s7 + s47 + s85 + rundeCent((g19 * 19) / 100) + rundeCent((g7 * 7) / 100);
  // StB-Prüfung (5.2): Bemessungsgrundlagen im Vordruck in vollen Euro (Cent bleiben weg), die Steuer daraus – so rechnet ELSTER
  const e19 = vollEuro(u19);
  const e7 = vollEuro(u7);
  const es19 = rundeCent((e19 * 19) / 100);
  const es7 = rundeCent((e7 * 7) / 100);
  const eg19 = vollEuro(g19);
  const eg7 = vollEuro(g7);
  const es89 = rundeCent((eg19 * 19) / 100);
  const es93 = rundeCent((eg7 * 7) / 100);
  const elsterSteuer = es19 + es7 + s47 + s85 + es89 + es93;
  const abzug = vst + v67 + v61 + svz;
  return { u19, u7, s19, s7, vst, s47, s85, v67, v61, svz, steuer, zahllast: steuer - abzug, e19, e7, es19, es7, g19, g7, eg19, eg7, es89, es93, elsterSteuer, elsterZahllast: elsterSteuer - abzug };
}

/** Betrag in Cent ohne die Cent (volle Euro, zur Null hin abgeschnitten) – wie im Vordruck der Voranmeldung. */
export const vollEuro = (c: number) => Math.trunc(c / 100) * 100;
/** Volle Euro ohne Nachkommastellen: „15.427 €“ */
const euroVoll = (c: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.trunc(c / 100))} €`;
/** Zeilen „Nr | Datum | Kunde | Netto“ der nach Rechnungsdatum zugeordneten Rechnungen (aus der Übernahme) */
const zuordnungZeilen = (d: Daten) => text(d, "nach_rechnungsdatum").split("\n").map((z) => z.split(" | ").map((x) => x.trim())).filter((z) => z[0]);

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

/**
 * Steuerberater (Durchsicht 23.10.2026): ausdrücklicher Hinweis, wenn keine innergemeinschaftlichen Erwerbe eingetragen sind.
 * E-222: Die App übernimmt sie jetzt aus Belegen, die als „Waren aus dem EU-Ausland“ erfasst sind – Wortlaut angepasst
 * (gedruckter Text: Vermerk der Vorlage entfällt bis zur Bestätigung, PRUEFLISTE T-308).
 */
export const UST_OHNE_IGE = "Innergemeinschaftliche Erwerbe (Kz 89 bzw. 93 mit Steuer, Vorsteuer Kz 61) sind nicht enthalten. Die App übernimmt sie nur aus Belegen, die als „Waren aus dem EU-Ausland (innergemeinschaftlicher Erwerb)“ erfasst sind. Wer Waren aus anderen EU-Ländern bezieht, erfasst sie so oder trägt sie im Formular ein.";
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
      hilfe: `Die Voranmeldung übermittelst du elektronisch über ELSTER. Diese Unterlage rechnet die Zahlen dafür aus – aus deinen Rechnungen in ${MARKE.name} oder von Hand – und bleibt bei deinen Unterlagen.`,
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
      // Steuerberater (Durchsicht 23.10.2026): betrifft jeden Betrieb, der Waren aus anderen EU-Ländern bezieht – aus den
      // Ausgangsrechnungen nicht ableitbar; E-222: aus Belegen mit der Art „innergemeinschaftlicher Erwerb“ übernommen
      titel: "Innergemeinschaftliche Erwerbe",
      // E-222: „Aus Rechnungen übernehmen“ trägt Belege ein, die als innergemeinschaftlicher Erwerb erfasst sind
      hilfe: "Wenn du Waren von Unternehmen aus anderen EU-Ländern bezogen hast: Bemessungsgrundlage nach Steuersatz, darauf schuldest du die Umsatzsteuer; die Vorsteuer daraus steht in Kz 61. „Aus Rechnungen übernehmen“ trägt Belege ein, die als „Waren aus dem EU-Ausland (innergemeinschaftlicher Erwerb)“ erfasst sind – sonst bitte von Hand eintragen.",
      felder: [
        { id: "ige_19", selten: true, art: "betrag", label: "Innergemeinschaftliche Erwerbe zum Steuersatz 19 % (Kz 89) (€)", hilfe: "Bemessungsgrundlage ohne Umsatzsteuer" },
        { id: "ige_7", selten: true, art: "betrag", label: "Innergemeinschaftliche Erwerbe zum Steuersatz 7 % (Kz 93) (€)", hilfe: "Bemessungsgrundlage ohne Umsatzsteuer" },
        { id: "vorsteuer_ige", selten: true, art: "betrag", label: "Vorsteuer aus innergemeinschaftlichen Erwerben (Kz 61) (€)", hilfe: "die Steuer aus Kz 89/93 – nur mit Vorsteuerabzug, also nicht als Kleinunternehmer (§ 15 Abs. 1 Satz 1 Nr. 3 UStG)" },
      ],
    },
    {
      titel: "Vorsteuer",
      felder: [
        { id: "vorsteuer", art: "betrag", label: "Vorsteuer aus Eingangsrechnungen (€)", pflicht: true },
        { id: "vorsteuer_13b", selten: true, art: "betrag", label: "Vorsteuer aus Leistungen nach § 13b UStG (Kz 67) (€)", hilfe: "die selbst geschuldete Steuer aus Kz 47/85 – nur mit Vorsteuerabzug, also nicht als Kleinunternehmer" },
        { id: "sondervorauszahlung", selten: true, art: "betrag", label: "Abzug der Sondervorauszahlung (Kz 39) (€)", hilfe: "nur für Monatszahler mit Dauerfristverlängerung, in der Voranmeldung für Dezember (§§ 46–48 UStDV) – wer vierteljährlich abgibt, leistet keine Sondervorauszahlung" },
        { id: "notiz", selten: true, art: "mehrzeilig", label: "Notiz", hilfe: "z. B. Besonderheiten in diesem Zeitraum" },
        // StB-Prüfung (5.2, Abschnitt 8): Zuordnungsannahmen der Übernahme – stehen auf dem PDF
        { id: "nach_rechnungsdatum", selten: true, art: "mehrzeilig", label: "Nach Rechnungsdatum zugeordnete Rechnungen", hilfe: "trägt „Aus Rechnungen übernehmen“ ein: Rechnungen ohne erkennbares Leistungsdatum, je Zeile „Nummer | Rechnungsdatum | Kunde | Netto“" },
        { id: "annahmen", selten: true, art: "mehrzeilig", label: "Weitere Zuordnungsannahmen", hilfe: "trägt „Aus Rechnungen übernehmen“ ein, z. B. Kassenumsätze aus dem Brutto aufgeteilt" },
      ],
    },
  ],
  ergebnis(d) {
    const x = ust(d);
    // 5.2: weicht die Zahllast aus vollen Euro ab, steht sie als letzte Zeile da – sie ist der Betrag, den ELSTER errechnet
    const elster: [string, string][] = x.elsterZahllast !== x.zahllast ? [[`${x.elsterZahllast >= 0 ? "Zahllast" : "Erstattung"} laut ELSTER (volle Euro)`, euro(Math.abs(x.elsterZahllast))]] : [];
    return [["Umsatzsteuer", euro(x.steuer)], ["Vorsteuer", euro(x.vst + x.v67 + x.v61)], ...(x.svz ? ([["Sondervorauszahlung", euro(x.svz)]] as [string, string][]) : []), [x.zahllast >= 0 ? "Zahllast" : "Erstattung", euro(Math.abs(x.zahllast))], ...elster];
  },
  html(d, b) {
    const x = ust(d);
    const ohneSteuer = UST_OHNE_STEUER.map((f) => ({ ...f, cent: cent(text(d, f.id)) ?? 0 })).filter((f) => f.cent);
    const ist = text(d, "versteuerung") === "ist";
    // Vorlage zum Ausfüllen (keine Beträge eingegeben): Beträge leer statt „0,00 €“
    const leer = !["umsatz_19", "umsatz_7", "vorsteuer", "rc_eu_netto", "rc_bau_netto", "vorsteuer_13b", "sondervorauszahlung", "ige_19", "ige_7", "vorsteuer_ige", ...UST_OHNE_STEUER.map((f) => f.id)].some((k) => text(d, k));
    const dfv = ja(d, "dauerfrist");
    const rc = [
      { kz: "46", text: "Sonstige Leistungen von Unternehmen aus dem übrigen Gemeinschaftsgebiet (§ 13b Abs. 1 UStG)", hinweis: "Bemessungsgrundlage", c: cent(text(d, "rc_eu_netto")) ?? 0 },
      { kz: "47", text: "darauf Umsatzsteuer", c: x.s47 },
      { kz: "84", text: "Andere Leistungen, z. B. Bauleistungen (§ 13b Abs. 2 Nr. 1, 2, 4 bis 12 UStG)", hinweis: "Bemessungsgrundlage", c: cent(text(d, "rc_bau_netto")) ?? 0 },
      { kz: "85", text: "darauf Umsatzsteuer", c: x.s85 },
    ];
    const mitRc = rc.some((z) => z.c);
    const mitIge = Boolean(x.g19 || x.g7);
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    // 5.2: Bemessungsgrundlagen in vollen Euro
    const voll = (c: number) => (leer ? "&nbsp;" : euroVoll(c));
    const ueberschuss = !leer && x.elsterZahllast < 0;
    const zuordnung = zuordnungZeilen(d);
    const annahmen = text(d, "annahmen").split("\n").map((z) => z.trim()).filter(Boolean);
    return dokument({
      titel: "Umsatzsteuer-Voranmeldung",
      betrieb: b,
      unter: [text(d, "zeitraum"), "Übertragungshilfe für ELSTER"].filter(Boolean).join(", "),
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Zeitraum: ${text(d, "zeitraum") || KOPF_LINIE}`, `Besteuerung: ${ist ? "nach vereinnahmten Entgelten (§ 20 UStG)" : "nach vereinbarten Entgelten"}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Steuerpflichtige Umsätze",
          kennzahlen([
            { kz: "81", text: "Umsätze zum Steuersatz 19 %", hinweis: `Bemessungsgrundlage ohne Umsatzsteuer in vollen Euro${!leer && x.u19 !== x.e19 ? ` (erfasst ${euro(x.u19)})` : ""}`, betrag: voll(x.u19) },
            { text: "darauf Umsatzsteuer 19 % (rechnet ELSTER aus vollen Euro)", betrag: betrag(x.es19) },
            { kz: "86", text: "Umsätze zum Steuersatz 7 %", hinweis: `Bemessungsgrundlage ohne Umsatzsteuer in vollen Euro${!leer && x.u7 !== x.e7 ? ` (erfasst ${euro(x.u7)})` : ""}`, betrag: voll(x.u7) },
            { text: "darauf Umsatzsteuer 7 % (rechnet ELSTER aus vollen Euro)", betrag: betrag(x.es7) },
          ]),
        ) +
        (ohneSteuer.length
          ? abschnitt("Umsätze ohne Umsatzsteuer", kennzahlen(ohneSteuer.map((f) => ({ ...(f.kz ? { kz: f.kz } : {}), text: f.text, hinweis: f.hinweis, betrag: f.kz ? euroVoll(f.cent) : euro(f.cent) }))))
          : "") +
        // Kz 46/84 sind Bemessungsgrundlagen (volle Euro), Kz 47/85 Steuerbeträge (mit Cent)
        (mitRc ? abschnitt("Steuerschuldnerschaft als Leistungsempfänger", kennzahlen(rc.map((z) => ({ kz: z.kz, text: z.text, ...(z.hinweis ? { hinweis: z.hinweis } : {}), betrag: z.hinweis ? euroVoll(z.c) : euro(z.c) })))) : "") +
        // Steuerberater (Durchsicht 23.10.2026): innergemeinschaftliche Erwerbe – Bemessungsgrundlage in vollen Euro, Steuer daraus
        (mitIge
          ? abschnitt(
              "Innergemeinschaftliche Erwerbe",
              kennzahlen([
                { kz: "89", text: "Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz 19 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer in vollen Euro", betrag: euroVoll(x.g19) },
                { text: "darauf Umsatzsteuer 19 % (rechnet ELSTER aus vollen Euro)", betrag: euro(x.es89) },
                { kz: "93", text: "Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz 7 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer in vollen Euro", betrag: euroVoll(x.g7) },
                { text: "darauf Umsatzsteuer 7 % (rechnet ELSTER aus vollen Euro)", betrag: euro(x.es93) },
              ]),
            )
          : "") +
        abschnitt(
          "Vorsteuer und Zahllast",
          kennzahlen([
            { text: "Umsatzsteuer gesamt (aus vollen Euro)", betrag: betrag(x.elsterSteuer) },
            { kz: "66", text: "Vorsteuerbeträge aus Rechnungen anderer Unternehmer", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 1 UStG", betrag: betrag(x.vst) },
            ...(x.v61 ? [{ kz: "61", text: "Vorsteuerbeträge aus dem innergemeinschaftlichen Erwerb von Gegenständen", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 3 UStG", betrag: euro(x.v61) }] : []),
            ...(x.v67 ? [{ kz: "67", text: "Vorsteuerbeträge aus Leistungen im Sinne des § 13b UStG", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 4 UStG", betrag: euro(x.v67) }] : []),
            ...(x.svz ? [{ kz: "39", text: "Abzug der festgesetzten Sondervorauszahlung für Dauerfristverlängerung", hinweis: "nur Monatszahler, in der Voranmeldung für Dezember (§§ 46–48 UStDV)", betrag: euro(x.svz) }] : []),
            {
              kz: "83",
              text: leer ? "Verbleibende Umsatzsteuer-Vorauszahlung bzw. Überschuss" : ueberschuss ? "Verbleibender Überschuss (Erstattung)" : "Verbleibende Umsatzsteuer-Vorauszahlung",
              hinweis: ueberschuss ? "Überschuss: Betrag mit Minuszeichen übertragen" : leer ? `Vorauszahlung ${dfv ? UST_FRIST_DFV : "bis zum 10. Tag nach Ablauf des Zeitraums (§ 18 Abs. 1 UStG)"}; Überschuss mit Minuszeichen übertragen` : dfv ? UST_FRIST_DFV : UST_FRIST,
              betrag: betrag(x.elsterZahllast),
              fett: true,
            },
          ]),
        ) +
        // 5.2: rechnerisch aus den Cent-Beträgen – die Abweichung ist die Rundung des Vordrucks
        (!leer && x.elsterZahllast !== x.zahllast ? nachsatz(`Aus den Cent-Beträgen gerechnet: ${x.zahllast >= 0 ? "Zahllast" : "Überschuss"} ${euro(Math.abs(x.zahllast))} (Abweichung ${euro(x.elsterZahllast - x.zahllast)} durch die Bemessungsgrundlagen in vollen Euro).`) : "") +
        // 5.2, Abschnitt 8: Zuordnungsannahmen der Übernahme – je Rechnung, die nach dem Rechnungsdatum zugeordnet ist
        (zuordnung.length || annahmen.length
          ? abschnitt(
              "Zuordnungsannahmen",
              (zuordnung.length ? `<p>Ohne erkennbares Leistungsdatum nach dem Rechnungsdatum zugeordnet (bitte prüfen, ob die Leistung in diesem Zeitraum ausgeführt wurde):</p>${tabelle(["Rechnung", "Rechnungsdatum", "Kunde", "Netto"], zuordnung.map((z) => [zelle(z[0] ?? ""), zelle(z[1] ?? ""), zelle(z[2] ?? ""), zelle(z[3] ? `${z[3]} €` : "")]), { breiten: ["18%", "18%", "44%", "20%"], zahlen: [3] })}` : "") +
                (annahmen.length ? `<ul>${annahmen.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""),
            )
          : "") +
        // steuerfreie Umsätze ohne Vorsteuerabzug und Vorsteuer im selben Zeitraum: an die Aufteilung erinnern
        ((cent(text(d, "umsatz_48")) ?? 0) && x.vst > 0 ? nachsatz(VORSTEUER_AUFTEILEN) : "") +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        nachsatz("Kennzahlen nach dem Vordruckmuster USt 1 A für 2026. Bemessungsgrundlagen in vollen Euro (Cent bleiben weg), Steuer- und Vorsteuerbeträge mit Cent. Vor dem Übertragen gegen das aktuelle ELSTER-Formular prüfen; das Formular rechnet die Steuerbeträge selbst – maßgeblich ist der Betrag, den ELSTER errechnet. OSS-Umsätze (Fernverkäufe mit der Steuer des Bestimmungslands) gehören nicht in diese Voranmeldung, sondern in die OSS-Erklärung beim BZSt.") +
        (mitIge || x.v61 ? "" : nachsatz(UST_OHNE_IGE)) +
        steuerHinweis("va", MARKE.name) +
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

/** Steuerart einer Vorauszahlung (Steuerberater 23.10.2026: Summe je Steuerart getrennt). */
const VORAUSZAHLUNG_ARTEN: Option[] = [
  { wert: "est", text: "Einkommensteuer" },
  { wert: "kst", text: "Körperschaftsteuer" },
  { wert: "soli", text: "Solidaritätszuschlag" },
  { wert: "gewst", text: "Gewerbesteuer" },
  { wert: "ust", text: "Umsatzsteuer" },
  { wert: "andere", text: "Andere Steuer" },
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
      // Steuerberater (Durchsicht 23.10.2026): Summe je Steuerart getrennt – deshalb die Steuerart zur Auswahl
      felder: [{ id: "vorauszahlungen", art: "liste", label: "Vorauszahlungen", eintrag: "Vorauszahlung", titelFeld: "art", felder: [{ id: "steuerart", art: "wahl", label: "Steuerart", optionen: VORAUSZAHLUNG_ARTEN, pflicht: true }, { id: "art", art: "text", label: "Zeitraum bzw. Bezeichnung", hilfe: "z. B. Q1 oder 10.03.", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
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
    const vz = liste(d, "vorauszahlungen").filter((x) => text(x, "art") || text(x, "steuerart"));
    const we = liste(d, "weiteres").filter((x) => text(x, "was"));
    // Blatt zum Ausfüllen (keine Zahlen eingegeben): Erklärungen zum Ankreuzen, alle Zeilen und Tabellen zum Eintragen
    const leer = !["gewinn", "umsatz", "ust_jahr", "vorsteuer_jahr"].some((k) => text(d, k)) && !vz.length && !we.length;
    // Steuerberater (Durchsicht 23.10.2026): je Steuerart getrennt summieren, nie über verschiedene Steuerarten. Steuerart aus
    // der Auswahl; ältere Einträge ohne Auswahl: das erste Wort der Bezeichnung („Einkommensteuer Q1“ → „einkommensteuer“)
    const artText = (x: Eintrag) => VORAUSZAHLUNG_ARTEN.find((o) => o.wert === text(x, "steuerart"))?.text ?? "";
    const steuerart = (x: Eintrag) => text(x, "steuerart") || (text(x, "art").trim().split(/\s+/)[0] ?? "").toLocaleLowerCase("de");
    const gruppenName = (x: Eintrag) => artText(x) || text(x, "art").trim().split(/\s+/)[0] || "Ohne Steuerart";
    const bezeichnung = (x: Eintrag) => [artText(x), text(x, "art")].filter(Boolean).join(" ");
    const arten_ = [...new Set(vz.map(steuerart))];
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
              // keine Gesamtsumme über verschiedene Steuern (Einkommen- und Umsatzsteuer zusammenzuzählen, sagt nichts), sondern je Steuerart
              tabelle(["Steuer", "Betrag"], vz.map((x) => [zelle(bezeichnung(x)), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["70%", "30%"], zahlen: [1] }) +
                kennzahlen(
                  arten_.map((art) => {
                    const je = vz.filter((x) => steuerart(x) === art);
                    return { text: `Summe ${gruppenName(je[0]!)}`, betrag: euro(summe(je, "betrag")), fett: true };
                  }),
                ),
            )
          : leer
            ? abschnitt("Geleistete Vorauszahlungen", tabelle(["Steuerart und Zeitraum", "Betrag"], [], { breiten: ["70%", "30%"], zahlen: [1], mindestens: 4, hoch: true }) + nachsatz("Je Steuerart getrennt summieren – nicht über verschiedene Steuerarten."))
            : "") +
        (we.length
          ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], we.map((x) => [zelle(text(x, "was")), text(x, "betrag") ? euro(cent(text(x, "betrag")) ?? 0) : "", ja(x, "beleg") ? "liegt vor" : "<strong>fehlt</strong>"]), { breiten: ["55%", "25%", "20%"], zahlen: [1] }))
          : leer
            ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], [], { breiten: ["55%", "25%", "20%"], zahlen: [1], mindestens: 5, hoch: true }))
            : "") +
        (text(d, "notiz") ? abschnitt("Notizen", absatz(text(d, "notiz"))) : "") +
        steuerHinweis("erklaerung", MARKE.name) +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)", "Bescheid vom"]),
    });
  },
};

// ---------------------------------------------------------------- Kassenbuch

/** Steuerberater (Durchsicht 23.10.2026): Regeln für das Kassenbuch (§ 146 Abs. 1 Satz 2 AO). */
export const KASSENBUCH_REGELN = "Der Kassenbestand darf nie negativ werden. Korrekturen nicht als negative Einnahme oder Ausgabe, sondern als Gegenbuchung mit Beleg. Einträge täglich (§ 146 Abs. 1 Satz 2 AO).";
export const KASSENBUCH_ELEKTRONISCH = "Für Betriebe mit elektronischer Kasse ist das Kassenbuch nur ergänzend; die Einzelaufzeichnung bleibt beim Kassensystem.";
export const KASSENBUCH_NEGATIV = "Negativer Betrag: Korrekturen nicht als negative Einnahme oder Ausgabe eintragen, sondern als Gegenbuchung mit Beleg.";
export const KASSENBUCH_BESTAND_NEGATIV = "Der Kassenbestand wird negativ – das darf nicht sein. Bitte Einträge und Anfangsbestand prüfen.";

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
  // StB GoBD (D-9): kein „Vorlage zum Ausdrucken“ – das Kassenbuch ist die Aufzeichnung selbst
  titel: "Kassenbuch",
  beschreibung: `Bargeld-Einnahmen und -Ausgaben mit laufendem Bestand. Führst du die Kasse in ${MARKE.name}, entsteht das Kassenbuch unter „Kasse“ aus den Tagesabschlüssen (nur lesbar, mit Fassung). Hier mit eigenen Einträgen, z. B. für eine offene Ladenkasse – geteilt bzw. gedruckt wird es festgeschrieben.`,
  festschreiben: true,
  bereich: "steuern",
  pflichten: [],
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum und Anfangsbestand",
      hilfe: `Sobald du das Kassenbuch teilst oder druckst, schreibt ${MARKE.name} es fest – danach lässt es sich nicht mehr ändern. Führst du die Kasse in ${MARKE.name}, nimm das Kassenbuch unter „Kasse“: Es entsteht aus den festgeschriebenen Tagesabschlüssen.`,
      felder: [
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "anfang", art: "betrag", label: "Anfangsbestand (€)", pflicht: true },
      ],
    },
    {
      titel: "Einträge",
      hilfe: `Jeder Vorgang einzeln, in zeitlicher Reihenfolge, mit Beleg. ${KASSENBUCH_REGELN}`,
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
  // Steuerberater (Durchsicht 23.10.2026): negative Beträge und negativer Bestand nicht ohne Hinweis annehmen
  hinweise(d) {
    const k = kasse(d);
    return [...(k.zeilen.some((z) => z.ein < 0 || z.aus < 0) ? [KASSENBUCH_NEGATIV] : []), ...(k.negativ ? [KASSENBUCH_BESTAND_NEGATIV] : [])];
  },
  ergebnis(d) {
    const k = kasse(d);
    return [["Endbestand", euro(k.ende)], ...(k.negativ ? ([["Achtung", "Bestand zwischendurch negativ – bitte prüfen"]] as [string, string][]) : [])];
  },
  html(d, b) {
    const k = kasse(d);
    const anfang = cent(text(d, "anfang")) ?? 0;
    // ohne Einträge: Blatt zum Eintragen von Hand mit hohen Leerzeilen
    const leer = !k.zeilen.length;
    // StB GoBD (D-1, D-9): aus den Tagesabschlüssen der App erzeugt – nur lesbar, Fassung und Erstellungszeitpunkt auf jeder
    // Seite (Fußzeile); die Einzelaufzeichnungen liegen beim Kassensystem. Die App setzt `quelle`, `kb_fassung`,
    // `kb_erstellt` und `kb_einzel` nur zum Anzeigen (nicht in den festgeschriebenen Daten).
    const ausKasse = text(d, "quelle") === "tagesabschluesse";
    const fassung = ausKasse && text(d, "kb_fassung") ? `Fassung ${text(d, "kb_fassung")}${text(d, "kb_erstellt") ? ` · erstellt ${text(d, "kb_erstellt")}` : ""}` : "";
    return dokument({
      titel: "Kassenbuch",
      betrieb: b,
      unter: [text(d, "zeitraum"), ausKasse ? KASSENBUCH_AUS_KASSE : leer ? "Blatt zum Führen von Hand" : ""].filter(Boolean).join(" · ") || undefined,
      ...(fassung ? { fussRechts: fassung } : {}),
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
        (ausKasse ? nachsatz(kassenbuchEinzel(text(d, "kb_einzel"))) : "") +
        nachsatz(`${KASSENBUCH_REGELN} ${KASSENBUCH_ELEKTRONISCH}`) +
        unterschriften(["Geprüft am", "Unterschrift"]),
    });
  },
};

/** StB GoBD (D-9): Unterzeile des Kassenbuchs, das die App aus den Tagesabschlüssen erzeugt. */
export const KASSENBUCH_AUS_KASSE = "aus den Tagesabschlüssen, nur lesbar";
/**
 * StB GoBD (D-1): Wo die Einzelaufzeichnungen liegen – `system`: Kassensystem mit TSE (aus Kassenmeldung bzw.
 * Verfahrensdokumentation), leer: allgemein. Das Kassenbuch selbst führt nur den Bargeldbestand aus den Tagessummen.
 */
export const kassenbuchEinzel = (system: string) =>
  `Einzelaufzeichnungen: ${system.trim() ? `Kassensystem ${system.trim()}` : "im Kassensystem"}, Export DSFinV-K und TSE-Export (§ 146 Abs. 1 Satz 1, § 146a AO). Dieses Kassenbuch zeigt nur den Bargeldbestand aus den festgeschriebenen Tagesabschlüssen (Tagessummen laut Z-Bon bzw. Kassenbericht); bei einer Kassen-Nachschau gehören Z-Bon, TSE-Export und Kassenbuch zusammen.`;

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
      // R12 (Bäckerei #3): weitere Betriebsstätten (Filialen) – je Betriebsstätte ein eigenes Blatt mit ihren Kassen
      titel: "Betriebsstätten",
      hilfe: `Nur bei Filialen: Die Meldung geht je Betriebsstätte. ${MARKE.name} übernimmt sie aus „Mein Betrieb“. Kassen ohne Betriebsstätte gehören zum Betrieb unter der Anschrift aus „Mein Betrieb“.`,
      felder: [
        {
          id: "betriebsstaetten",
          art: "liste",
          label: "Weitere Betriebsstätten",
          eintrag: "Betriebsstätte",
          titelFeld: "name",
          leerStarten: true,
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true, hilfe: "z. B. Filiale Marktplatz" },
            { id: "anschrift", art: "mehrzeilig", label: "Anschrift", pflicht: true },
          ],
        },
      ],
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
            { id: "betriebsstaette", art: "text", label: "Betriebsstätte", hilfe: "Leer: Betrieb unter der Anschrift aus „Mein Betrieb“", vorschlaegeAus: { liste: "betriebsstaetten", feld: "name" } },
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
    // R12 (Bäckerei #3): je Betriebsstätte ein Blatt mit ihrer Anschrift und ihren Kassen (§ 146a Abs. 4 AO) – Kassen
    // ohne Betriebsstätte gehören zum Betrieb (Anschrift aus „Mein Betrieb“)
    const staetten = liste(d, "betriebsstaetten").filter((x) => text(x, "name"));
    const schluessel = (n: string) => n.trim().toLocaleLowerCase("de");
    const gruppen = new Map<string, { name: string; anschrift: string; idx: number[] }>();
    k.forEach((x, i) => {
      const n = text(x, "betriebsstaette");
      const key = n && schluessel(n) !== schluessel(b.name) ? schluessel(n) : "";
      if (!gruppen.has(key)) {
        const st = staetten.find((y) => schluessel(text(y, "name")) === key);
        gruppen.set(key, key ? { name: st ? text(st, "name") : n, anschrift: st ? text(st, "anschrift").replace(/\n+/g, ", ") : "", idx: [] } : { name: b.name, anschrift: anschrift(b), idx: [] });
      }
      gruppen.get(key)!.idx.push(i);
    });
    // ohne Kasse: ein Blatt für den Betrieb
    const blaetter = gruppen.size ? [...gruppen.entries()].sort(([x], [y]) => (x === "" ? -1 : y === "" ? 1 : 0)).map(([, g]) => g) : [{ name: b.name, anschrift: anschrift(b), idx: [] as number[] }];
    const blatt = (g: (typeof blaetter)[number], erstes: boolean) => {
      // Feldnummern laufen je Blatt durch – gezählt werden nur die tatsächlich gedruckten Zeilen (Betriebsstätte: 01–03)
      let nr = 4;
      const eigene = g.idx.length ? g.idx.map((i) => bloecke[i]!).map((x, j) => ({ ...x, titel: x.titel.replace(/^Aufzeichnungssystem \d+/, `Aufzeichnungssystem ${j + 1}`) })) : k.length ? [] : bloecke;
      return (
        (erstes ? "" : '<div style="break-before:page;page-break-before:always"></div>') +
        abschnitt(blaetter.length > 1 ? `Betriebsstätte ${blaetter.indexOf(g) + 1} von ${blaetter.length}` : "Betriebsstätte", felder([["Steuernummer", b.steuernummer], ["Name und Anschrift", [g.name, g.anschrift].filter((x) => x.trim()).join(", ")], ["Anzahl der Aufzeichnungssysteme", g.idx.length ? String(g.idx.length) : ""]])) +
        eigene
          .map((x) => {
            const start = nr;
            nr += x.zeilen.filter(([, w]) => w !== null).length;
            // jedes Aufzeichnungssystem bleibt mit seiner Überschrift auf einer Seite
            return `<div class="zusammen">${abschnitt(x.titel, felder(x.zeilen, { start }))}</div>`;
          })
          .join("") +
        uebertragung(["Gemeldet über Mein ELSTER am", "Transferticket"])
      );
    };
    return dokument({
      titel: "Kassenmeldung – Datenblatt",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        `<p class="klein">Zum Übertragen in „Mein ELSTER“ (Mitteilung über elektronische Aufzeichnungssysteme nach § 146a Abs. 4 AO). Je Betriebsstätte eine Mitteilung mit allen Kassen${blaetter.length > 1 ? ` – hier ${blaetter.length} Blätter, eines je Betriebsstätte` : ""}.</p>` +
        blaetter.map((g, i) => blatt(g, i === 0)).join(""),
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
        // Steuerberater (Durchsicht 23.10.2026): „aufgestellt“ wie in § 147 Abs. 4 AO (nicht „festgestellt“)
        nachsatz("Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die letzte Eintragung gemacht, das Inventar bzw. der Jahresabschluss aufgestellt, der Brief empfangen oder abgesandt oder der Buchungsbeleg entstanden ist (§ 147 Abs. 4 AO). Sie läuft nicht ab, solange die Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO)."),
    });
  },
};
