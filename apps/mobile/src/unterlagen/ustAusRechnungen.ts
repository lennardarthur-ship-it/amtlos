/**
 * Rechnungen speisen die Umsatzsteuer-Voranmeldung (E-128, seit E-129 nach dem richtigen Zeitpunkt):
 * - Soll (vereinbarte Entgelte, § 13 Abs. 1 Nr. 1 a UStG): Zeitraum, in dem die Leistung ausgeführt wurde –
 *   also nach dem Leistungsdatum der Rechnung, bei einem Leistungszeitraum nach dessen Ende. Ist die Zahlung vor der
 *   Leistung vermerkt, zählt der Zahltag (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG). Eine Stornorechnung mindert im Zeitraum
 *   des Stornos (§ 17 UStG).
 * - Ist (vereinnahmte Entgelte, § 13 Abs. 1 Nr. 1 b, § 20 UStG): Zeitraum, in dem das Geld eingegangen ist – nach dem
 *   Zahlungseingang, den du an der Rechnung vermerkst. Unbezahlte Rechnungen zählen nicht; eine Stornorechnung zählt
 *   erst, wenn du die Erstattung vermerkst.
 * Nur festgeschriebene (geteilte) Rechnungen zählen – Entwürfe sind nicht raus. Gutschriften zählen nicht: Der Betrieb
 * rechnet darin als Leistungsempfänger ab, sie sind keine eigenen Umsätze. Kleinunternehmer (§ 19 UStG) übernehmen
 * nichts – ihre Umsätze gehören in keine Kennzahl der Voranmeldung. Fachlich zu prüfen: T-70.
 *
 * R10 (interne Prüfrunde Steuern, Freiberuf, Elektro – nicht von der Steuerberatung bestätigt, PRUEFLISTE T-113):
 * - Abschlagsrechnungen zählen bei Soll im Zeitraum des Zahlungseingangs (Mindest-Ist), unbezahlt noch gar nicht.
 * - Rein formales Storno mit Neuausstellung (gleiche Beträge, gleicher Kunde, gleiche Leistung): Storno und Ersatz-
 *   rechnung gehören in den Zeitraum der ursprünglichen Leistung – sie heben sich dort auf. Ändert sich das Entgelt,
 *   zählt die Ersatzrechnung im Zeitraum des Stornos, so dass dort nur die Differenz wirkt (§ 17 UStG).
 * - Kennzahlen 21 (EU-Leistung), 45 (Drittland), 43, 87 (Nullsteuersatz); § 13b-Belege in Kz 46/47, 84/85 und 67 –
 *   auch für Kleinunternehmer (ohne Kz 67); Vorsteuer aus Gutschriften. E-222: Belege mit innergemeinschaftlichem
 *   Erwerb in Kz 89/93 (Bemessungsgrundlage) und Kz 61 (Vorsteuer, nur mit Abzug) nach Belegdatum – nicht für
 *   Kleinunternehmer (Erwerbsschwelle, § 1a Abs. 3 UStG, prüft die App nicht).
 * - Kleinunternehmer je Zeitraum: Sind alle Rechnungen des Zeitraums Kleinunternehmer-Rechnungen (bzw. keine), gilt
 *   das für diesen Zeitraum – auch wenn der Pflichten-Check heute etwas anderes sagt (Wechsel zum Jahreswechsel).
 *
 * R11 (interne Prüfrunde Steuern – nicht von der Steuerberatung bestätigt, PRUEFLISTE T-117):
 * - Rechnungen mit Umsatzsteuer werden immer übernommen, auch in einem Zeitraum, der sonst als Kleinunternehmer-Zeitraum
 *   gilt (Überschreiten der 100.000 €, § 19 Abs. 1 Satz 1 UStG, Abschnitt 19.1 UStAE; sonst schuldet man die Steuer nach § 14c, Kz 69).
 *   Vorsteuer dann erst aus Belegen ab der ersten solchen Rechnung.
 * - Vorsteuer aus Gutschriften zählt unabhängig von Soll/Ist ab Leistung und Gutschrift (§ 15 Abs. 1 Nr. 1 UStG; § 20
 *   betrifft nur die eigenen Umsätze).
 * - Ersatzrechnung nach Storno über die ausdrückliche Verknüpfung (`ersetzt`, gesetzt beim Kopieren aus der stornierten
 *   Rechnung); nur bei älteren Daten ohne Verknüpfung vorsichtig geraten: gleicher Kunde, gleicher Betrag, gleiche Leistung.
 *
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026):
 * - C-6: Ersatzrechnung auch über das Feld „Ersetzt die stornierte Rechnung Nr.“ – wirkt als Korrektur im Zeitraum des
 *   Stornos (Nettoeffekt dort), nicht als neue Leistung.
 * - C-4: Schlussrechnung zählt nur mit dem Rest nach den abgesetzten Abschlägen (die Abschläge sind mit ihrer Zahlung
 *   schon versteuert, § 13 Abs. 1 Nr. 1 a Satz 4 UStG).
 * - 5.2: OSS-Rechnungen (Steuer des Bestimmungslands) gehören nicht in die deutsche Voranmeldung – sie werden gezählt,
 *   nicht übernommen. Rechnungen, die mangels Leistungsdatum nach dem Rechnungsdatum zugeordnet sind, stehen je Rechnung
 *   in der Voranmeldung (Feld „nach_rechnungsdatum“), weitere Annahmen im Feld „annahmen“.
 *
 * E-208: Innergemeinschaftliche Lieferungen und sonstige Leistungen an Unternehmen im übrigen Gemeinschaftsgebiet, die
 * in die Zusammenfassende Meldung gehören (USt-IdNr. des Empfängers, Land im EU-Ausland), stehen in der Voranmeldung im
 * selben Zeitraum wie in der ZM – das BZSt gleicht beide ab. Nach § 18b Satz 1 Nr. 1 und 2, Satz 2 und 3 UStG:
 * Lieferungen (Kz 41) im Voranmeldungszeitraum, in dem die Rechnung ausgestellt wird, spätestens in dem, in dem der auf
 * die Lieferung folgende Monat endet; sonstige Leistungen (Kz 21) im Zeitraum, in dem sie ausgeführt wurden – beides auch
 * bei Ist-Versteuerung (vorher: Zahltag bzw. bei Soll für Lieferungen das Leistungsdatum, die ZM dagegen nach Rechnung).
 *
 * E-214 (Steuerberater, 26.10.2026, zu T-246) – gilt gleich für Voranmeldung (Kz 41/21) und ZM:
 * - Storno einer Rechnung mit EU-Umsatz: Beim Stornieren fragt die App nach dem Grund (`EU_STORNO_GRUND` in den Daten
 *   der Stornorechnung). „Betrag hat sich geändert“ (die ursprüngliche Meldung war richtig): Die Lieferung bzw. Leistung
 *   bleibt in ihrem Zeitraum; Storno und Ersatzrechnung zählen im Zeitraum des Stornos (die Ersatzrechnung frühestens im
 *   Zeitraum ihres Datums) und heben sich dort auf, ein Unterschied ist eine Änderung der Bemessungsgrundlage (§ 17,
 *   § 18b Satz 4 UStG). „Fehler in der Rechnung“ (falsche USt-IdNr., falscher Betrag, falscher Zeitraum): Die Meldung
 *   des ursprünglichen Zeitraums war falsch – das Storno zählt dort, die Ersatzrechnung in dem Zeitraum, in den die
 *   berichtigte Rechnung gehört (Rechnungsdatum der ursprünglichen Rechnung, frühestens die Lieferung, Leistung laut
 *   Ersatzrechnung; liegt das in einem anderen Zeitraum, ist auch dieser zu berichtigen). Die App
 *   rechnet so die berichtigten Werte des ursprünglichen Zeitraums aus und meldet, dass ZM (innerhalb eines Monats,
 *   § 18a Abs. 10 UStG) und Voranmeldung dieses Zeitraums zu berichtigen sind (`euBerichtigungen`); abgeben muss der
 *   Betrieb sie selbst. Ohne Grund (ältere Daten): Lieferungen wie „Betrag hat sich geändert“, Leistungen wie bisher.
 * - Anzahlungen und Abschläge auf EU-Umsätze werden nicht gemeldet; gemeldet wird die Lieferung bzw. Leistung mit dem
 *   vollen Entgelt (§ 18b Satz 2 und 3 UStG) – bei einer Schlussrechnung also einschließlich der abgesetzten Abschläge;
 *   eine Zahlung vor der Leistung verschiebt den Zeitraum nicht. Teilleistungen zählen, wenn sie ausgeführt sind (eigene
 *   Rechnung mit eigenem Leistungsdatum).
 * - Skonto bzw. Minderung auf EU-Umsätze mindert Kz 41 bzw. 21 und die ZM im Zeitraum der Zahlung (§ 17, § 18b Satz 4
 *   UStG), auch bei Ist-Versteuerung; die ursprüngliche Meldung bleibt.
 *
 * E-218 (Steuerberater, 27.10.2026, zu T-273):
 * - „Fehler in der Rechnung“ bestätigt; war die Voranmeldung bzw. ZM des ursprünglichen Zeitraums schon abgegeben, ist
 *   sie zu berichtigen – die Voranmeldung für denselben Zeitraum wie die ZM (das Finanzamt gleicht Kz 41 und ZM je
 *   Zeitraum ab), eine Korrektur in der laufenden Voranmeldung genügt nicht. Die Monatsfrist der ZM-Berichtigung
 *   (§ 18a Abs. 10 UStG) läuft ab dem Tag, an dem der Fehler erkannt wurde (`euFehlerErkannt`, Eingabe beim Storno,
 *   vorbelegt mit dem Datum des Stornos).
 * - Skonto auf eine Anzahlung auf einen EU-Umsatz, abgezogen bevor die Lieferung bzw. Leistung gemeldet ist: keine
 *   eigene Minderung in einem früheren Zeitraum, sondern Minderung des mit der Schlussrechnung gemeldeten Entgelts
 *   (§ 10 Abs. 1 UStG, `euMinderungsTage`); nur ein Skonto nach der Meldung mindert im Zeitraum der Zahlung.
 */
import { sachentnahmenFuer, type Sachentnahme } from "@amtlos/fachlogik";
import { eRechnungAus, fehlendeTage, istEuAusland, kassenUmsatz, kennzahlBefreiung, restGruppen, steuerschuldFuer, summen, ustZeitraum, vorsteuerFuer, zahlungsAnteile, type Beleg, type Betrieb, type Kassenabschluss, type RechnungsDaten } from "@amtlos/fachlogik";
import { EU_STORNO_GRUND, nichtZaehlend, type EuStornoGrund, type Unterlage } from "./speicher";
import { MARKE } from "@amtlos/marke";
import { T as TEXT } from "../texte";

export type Versteuerung = "soll" | "ist";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function periodeText(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${MONATE[Number(m[2]) - 1]} ${m[1]}`;
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  return q ? `${q[2]}. Quartal ${q[1]}` : p;
}

const betragText = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);

/**
 * Gutschrift (Hinweis „gutschrift“, § 14 Abs. 2 Satz 2 UStG): Der Betrieb rechnet als Leistungsempfänger selbst ab –
 * für ihn ist das eine Ausgabe, keine Einnahme. Gutschriften (und ihre Stornos) zählen deshalb nicht als Umsatz.
 */
export const istGutschrift = (u: Unterlage) => Array.isArray(u.daten.hinweise) && u.daten.hinweise.some((h) => h === "gutschrift");

/** Steht bei der EÜR-Übernahme und im Steuerberater-Paket, sobald Gutschriften dabei sind. */
export const GUTSCHRIFT_HINWEIS = `Gutschriften sind Ausgaben: Mit Zahlungsvermerk übernimmt ${MARKE.name} sie als „Bezogene Leistungen“ (EÜR) bzw. als Aufwand (Buchungsstapel) – bitte nicht zusätzlich als Beleg erfassen. Gutschriften ohne Zahlungsvermerk fehlen in der EÜR noch.`;

/** Gestellte Rechnungen – ohne Konfliktkopien und doppelte Stornos (K1, K2: je Rechnung zählt nur das Storno aus `storniertDurch`). */
const gestellt = (unterlagen: Unterlage[]) => {
  const aus = nichtZaehlend(unterlagen);
  return unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string" && !aus.has(u.id));
};
/** Geteilte Rechnungen, die Umsätze sind (ohne Gutschriften). */
const festeRechnungen = (unterlagen: Unterlage[]) => gestellt(unterlagen).filter((u) => !istGutschrift(u));
const kuRechnung = (u: Unterlage) => u.daten.kleinunternehmer === true;

interface Zuordnung {
  u: Unterlage;
  /** Tag, nach dem die Rechnung einem Zeitraum zugeordnet wird – null: zählt (noch) nicht */
  tag: string | null;
  /** Soll ohne eindeutiges Leistungsdatum: nach Rechnungsdatum zugeordnet */
  ersatz: boolean;
}

/** Leistung einer Rechnung: Leistungsdatum, sonst Ende des Leistungszeitraums (die Leistung ist mit ihrem Abschluss ausgeführt). */
function leistungVon(u: Unterlage, betrieb: Betrieb): string | null {
  const { daten } = eRechnungAus(u.daten, betrieb);
  return daten.leistungsdatum ?? daten.leistungszeitraum?.bis ?? null;
}

/** Summen je Steuersatz einer Rechnung als vergleichbarer Schlüssel (ohne Vorzeichen) */
function betragsSchluessel(u: Unterlage, betrieb: Betrieb): string {
  const { daten } = eRechnungAus(u.daten, betrieb);
  return summen(daten.positionen, daten.kleinunternehmer)
    .gruppen.map((g) => `${g.satz}:${Math.abs(g.netto_cent)}`)
    .sort()
    .join("|");
}

/**
 * E-214: Grund eines Stornos einer Rechnung mit EU-Umsatz (Steuerberater 26.10.2026) – steht in den Daten der
 * Stornorechnung, wird nicht gedruckt. „rechnung“: Fehler in der Rechnung (die ursprüngliche Meldung war falsch);
 * „betrag“: Betrag hat sich geändert (die ursprüngliche Meldung war richtig).
 */
export { EU_STORNO_GRUND, type EuStornoGrund } from "./speicher";
export const euStornoGrund = (u: Unterlage): EuStornoGrund | null => (u.daten[EU_STORNO_GRUND] === "rechnung" || u.daten[EU_STORNO_GRUND] === "betrag" ? u.daten[EU_STORNO_GRUND] : (u.euStorno?.grund ?? null));
/** E-218: Grund steht in den Daten der Stornorechnung (beim Stornieren gewählt) – dann lässt er sich nicht mehr ändern. */
export const euStornoGrundFest = (u: Unterlage) => u.daten[EU_STORNO_GRUND] === "rechnung" || u.daten[EU_STORNO_GRUND] === "betrag";
/** E-218 (Steuerberater 27.10.2026): Tag, an dem der Fehler erkannt wurde – ohne Angabe das Datum des Stornos. */
export const euFehlerErkannt = (u: Unterlage) => u.euStorno?.erkannt ?? String(u.daten.datum);

const kundeVon = (u: Unterlage) => (typeof u.daten.kunde_name === "string" ? u.daten.kunde_name.trim().toLocaleLowerCase("de") : "");
const istStornoU = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/**
 * Soll: abweichende Zuordnung bei Storno und Ersatzrechnung (siehe Kopf). Ersatzrechnung = geteilte Rechnung mit
 * `ersetzt` = stornierte Rechnung (R11). Ohne Verknüpfung (ältere Daten) nur bei gleichem Kunden, gleichen Beträgen und
 * gleicher Leistung, erstellt nach dem Original – dann ein rein formales Storno. Liefert Unterlage-ID → Tag.
 */
function korrekturen(unterlagen: Unterlage[], betrieb: Betrieb): Map<string, string> {
  const aus = new Map<string, string>();
  const feste = festeRechnungen(unterlagen);
  // Originale, auf die irgendeine Rechnung (auch ein Entwurf) ausdrücklich verweist – für sie wird nicht geraten
  const verknuepft = new Set(unterlagen.map((u) => u.ersetzt).filter((x): x is string => !!x));
  // C-6: Ersatzrechnung über die eingetragene Nummer der stornierten Rechnung
  const ersetztNr = (x: Unterlage) => (typeof x.daten.ersetzt_nummer === "string" ? x.daten.ersetzt_nummer.trim() : "");
  const nrVon = (x: Unterlage) => (typeof x.daten.nummer === "string" ? x.daten.nummer.trim() : "");
  for (const st of feste) {
    if (!istStornoU(st) || !st.stornoZuId) continue;
    const orig = feste.find((x) => x.id === st.stornoZuId);
    if (!orig || istStornoU(orig)) continue;
    // E-214: EU-Umsätze (ZM) nach dem Grund des Stornos
    if (euArtVon(orig, betrieb) && euKorrektur(st, orig, feste, verknuepft, betrieb, aus)) continue;
    const leistung = leistungVon(orig, betrieb);
    if (!leistung) continue;
    const betraege = betragsSchluessel(orig, betrieb);
    const kandidat = (x: Unterlage) => x.id !== orig.id && !istStornoU(x) && !x.storniertDurch;
    const perNummer = nrVon(orig) ? feste.filter((x) => kandidat(x) && ersetztNr(x) === nrVon(orig)) : [];
    const ersatz = verknuepft.has(orig.id) || perNummer.length
      ? feste.filter((x) => kandidat(x) && (x.ersetzt === orig.id || (nrVon(orig) !== "" && ersetztNr(x) === nrVon(orig)))).sort((a, b) => (a.festgeschrieben ?? "").localeCompare(b.festgeschrieben ?? ""))[0]
      : feste.find((x) => kandidat(x) && x.erstellt > orig.erstellt && String(x.daten.datum) >= String(orig.daten.datum) && leistungVon(x, betrieb) === leistung && kundeVon(x) === kundeVon(orig) && betragsSchluessel(x, betrieb) === betraege);
    if (!ersatz) continue;
    const origTag = zuordnenEinfach(orig, "soll", betrieb).tag;
    if (!origTag) continue;
    if (betragsSchluessel(ersatz, betrieb) === betraege) aus.set(st.id, origTag);
    // geändertes Entgelt: Ersatzrechnung im Zeitraum des Stornos – dort wirkt nur die Differenz (§ 17 UStG)
    else if (String(st.daten.datum) > origTag) aus.set(ersatz.id, String(st.daten.datum));
  }
  return aus;
}

/** Ersatzrechnung zu einer stornierten Rechnung: ausdrücklich verknüpft (`ersetzt`) oder über die eingetragene Nummer (C-6). */
function ersatzVon(orig: Unterlage, feste: Unterlage[], verknuepft: Set<string>): Unterlage | undefined {
  const nr = typeof orig.daten.nummer === "string" ? orig.daten.nummer.trim() : "";
  const ersetztNr = (x: Unterlage) => (typeof x.daten.ersetzt_nummer === "string" ? x.daten.ersetzt_nummer.trim() : "");
  const kandidat = (x: Unterlage) => x.id !== orig.id && !istStornoU(x) && !x.storniertDurch;
  if (!verknuepft.has(orig.id) && !(nr && feste.some((x) => kandidat(x) && ersetztNr(x) === nr))) return undefined;
  return feste.filter((x) => kandidat(x) && (x.ersetzt === orig.id || (nr !== "" && ersetztNr(x) === nr))).sort((a, b) => (a.festgeschrieben ?? "").localeCompare(b.festgeschrieben ?? ""))[0];
}

/**
 * E-214 (Steuerberater 26.10.2026): Zuordnung von Storno und Ersatzrechnung einer Rechnung mit EU-Umsatz (siehe Kopf).
 * Ohne Eintrag bleibt die Zuordnung nach § 18b UStG (`zuordnenEinfach`): Storno im Zeitraum des Stornos. Liefert false,
 * wenn die bisherige Regel gilt (sonstige Leistung ohne Grund, ältere Daten).
 */
function euKorrektur(st: Unterlage, orig: Unterlage, feste: Unterlage[], verknuepft: Set<string>, betrieb: Betrieb, aus: Map<string, string>): boolean {
  const grund = euStornoGrund(st);
  const ersatz = ersatzVon(orig, feste, verknuepft);
  const origTag = zuordnenEinfach(orig, "soll", betrieb).tag;
  const stornoTag = String(st.daten.datum);
  if (grund === "rechnung") {
    // die ursprüngliche Meldung war falsch: Storno im ursprünglichen Zeitraum, Ersatzrechnung dort, wo die berichtigte
    // Rechnung hingehört (Datum der ursprünglichen Rechnung, Leistung laut Ersatzrechnung)
    if (!origTag) return true;
    aus.set(st.id, origTag);
    if (ersatz) {
      const ersatzEu = euArtVon(ersatz, betrieb);
      const leistung = leistungVon(ersatz, betrieb);
      const origDatum = String(orig.daten.datum);
      if (ersatzEu === "L") {
        // als wäre die berichtigte Rechnung am Tag der ursprünglichen ausgestellt – aber nicht vor der Lieferung
        const ausgestellt = leistung && leistung > origDatum ? leistung : origDatum;
        const spaetestens = endeFolgemonat(leistung ?? origDatum);
        aus.set(ersatz.id, ausgestellt < spaetestens ? ausgestellt : spaetestens);
      } else if (ersatzEu === "S" && leistung) aus.set(ersatz.id, leistung);
    }
    return true;
  }
  // Betrag hat sich geändert (bzw. ohne Grund bei einer Lieferung): Storno und Ersatzrechnung im Zeitraum des Stornos –
  // die Ersatzrechnung frühestens in dem ihres Datums (nichts wird zurückdatiert)
  if (grund === "betrag" || euArtVon(orig, betrieb) === "L") {
    if (!ersatz || !euArtVon(ersatz, betrieb) || ersatz.daten.abschlag === true) return true;
    const ersatzDatum = String(ersatz.daten.datum);
    aus.set(ersatz.id, ersatzDatum > stornoTag ? ersatzDatum : stornoTag);
    return true;
  }
  // ohne Grund (ältere Daten), sonstige Leistung: wie bisher (rein formales Storno im Zeitraum der Leistung, geändertes
  // Entgelt: Ersatzrechnung im Zeitraum des Stornos)
  return false;
}

/** letzter Tag des Monats nach dem Tag (ISO) */
const endeFolgemonat = (tag: string) => new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) + 1, 0)).toISOString().slice(0, 10);

/**
 * E-208: Art in der Zusammenfassenden Meldung (§ 18a UStG) – „L“ innergemeinschaftliche Lieferung, „S“ sonstige Leistung
 * an ein Unternehmen im übrigen Gemeinschaftsgebiet mit Steuerschuldnerschaft des Empfängers; sonst null (auch bei
 * Kleinunternehmer-Rechnungen und ohne USt-IdNr. des Empfängers).
 */
export function euMeldeArt(daten: RechnungsDaten): "L" | "S" | null {
  if (daten.kleinunternehmer || !daten.kunde.ust_idnr || !istEuAusland((daten.kunde.land ?? "DE").toUpperCase())) return null;
  return daten.steuerart === "igl" ? "L" : daten.steuerart === "reverse_charge" ? "S" : null;
}
/** E-214: Art des EU-Umsatzes (ZM) einer Unterlage – „L“, „S“ oder null (auch für Gutschriften und Kleinunternehmer). */
export const euMeldeArtVon = (u: Unterlage, betrieb: Betrieb) => euArtVon(u, betrieb);
const euArtVon = (u: Unterlage, betrieb: Betrieb) => (u.daten.kleinunternehmer === true || istGutschrift(u) ? null : euMeldeArt(eRechnungAus(u.daten, betrieb).daten));

function zuordnen(u: Unterlage, v: Versteuerung, betrieb: Betrieb, korr?: Map<string, string>): Zuordnung {
  const eu = euArtVon(u, betrieb);
  // E-208/E-214: EU-Umsätze (ZM) – Storno und Ersatzrechnung nach dem Grund des Stornos, auch bei Ist-Versteuerung;
  // Anzahlungen und Abschläge werden nicht gemeldet
  if (eu && u.daten.abschlag === true) return { u, tag: null, ersatz: false };
  const k = v === "soll" || eu ? korr?.get(u.id) : undefined;
  if (k) return { u, tag: k, ersatz: false };
  return zuordnenEinfach(u, v, betrieb);
}

function zuordnenEinfach(u: Unterlage, v: Versteuerung, betrieb: Betrieb): Zuordnung {
  const storno = istStornoU(u);
  const eu = euArtVon(u, betrieb);
  // E-208: innergemeinschaftliche Lieferung – Zeitraum der Rechnung, spätestens der Monat nach der Lieferung (§ 18b Satz 2
  // UStG, ebenso § 18a Abs. 8 UStG für die ZM), unabhängig von Soll/Ist; Storno im Zeitraum des Stornos
  if (eu === "L") {
    const datum = u.daten.datum as string;
    // E-214: Anzahlungen bzw. Abschläge (und ihr Storno) werden nicht gemeldet – erst die Lieferung mit dem vollen Entgelt
    if (u.daten.abschlag === true) return { u, tag: null, ersatz: false };
    if (storno) return { u, tag: datum, ersatz: false };
    const lieferung = leistungVon(u, betrieb) ?? datum;
    const spaetestens = endeFolgemonat(lieferung);
    return { u, tag: datum < spaetestens ? datum : spaetestens, ersatz: false };
  }
  // E-208: sonstige Leistung an ein Unternehmen im EU-Ausland – Zeitraum der Ausführung (§ 18b Satz 3 UStG), auch bei Ist
  if (v === "ist" && eu !== "S") return { u, tag: u.bezahlt ?? null, ersatz: false };
  if (storno) return { u, tag: u.daten.datum as string, ersatz: false };
  // E-214: EU-Leistung – keine Meldung mit der (An-)Zahlung, nur mit der Ausführung (§ 18b Satz 3 UStG)
  if (eu === "S") {
    if (u.daten.abschlag === true) return { u, tag: null, ersatz: false };
    const leistung = leistungVon(u, betrieb);
    return leistung ? { u, tag: leistung, ersatz: false } : { u, tag: u.daten.datum as string, ersatz: true };
  }
  // Abschlagsrechnung (Anzahlung): Steuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG) – unbezahlt noch nicht
  if (u.daten.abschlag === true) return { u, tag: u.bezahlt ?? null, ersatz: false };
  const leistung = leistungVon(u, betrieb);
  // Vorauszahlung: bezahlt vor der Leistung ⇒ Steuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG)
  if (leistung) return { u, tag: u.bezahlt && u.bezahlt < leistung ? u.bezahlt : leistung, ersatz: false };
  return { u, tag: u.daten.datum as string, ersatz: true };
}

/**
 * Gutschrift (R11): Vorsteuer ab Leistung und Gutschrift – unabhängig von Soll/Ist (§ 15 Abs. 1 Nr. 1 UStG); es zählt
 * der spätere der beiden Tage, beim Storno der Gutschrift ihr Datum.
 */
function gutschriftTag(u: Unterlage, betrieb: Betrieb): string {
  const datum = String(u.daten.datum);
  if (istStornoU(u)) return datum;
  const leistung = leistungVon(u, betrieb);
  return leistung && leistung > datum ? leistung : datum;
}

const periodenVon = (tag: string) => [tag.slice(0, 7), `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`];

/** Tag der Zuordnung zur Steuerperiode je geteilter Rechnung (wie in der Voranmeldung) – für DATEV-Feld 116. */
export function zuordnungsTage(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll"): Map<string, string | null> {
  const korr = korrekturen(unterlagen, betrieb);
  return new Map(gestellt(unterlagen).map((u) => [u.id, zuordnen(u, v, betrieb, korr).tag]));
}

/** E-214: Schlüssel in `Stand.erledigt`, mit dem der Betrieb eine Berichtigung als abgegeben vermerkt. */
export const euBerichtigungSchluessel = (stornoId: string) => `eu-berichtigung:${stornoId}`;

/** ein Monat nach dem Tag (ISO); fehlt der Tag im Folgemonat, dessen letzter Tag (§ 188 Abs. 2 und 3 BGB) */
export function einMonatNach(tag: string): string {
  const j = Number(tag.slice(0, 4));
  const m = Number(tag.slice(5, 7));
  const d = Number(tag.slice(8, 10));
  const letzter = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(j, m, Math.min(d, letzter))).toISOString().slice(0, 10);
}

/** E-214: Storno einer Rechnung mit EU-Umsatz wegen eines Fehlers in der Rechnung – der ursprüngliche Zeitraum ist zu berichtigen. */
export interface EuBerichtigung {
  stornoId: string;
  stornoNr: string;
  rechnungNr: string;
  ersatzNr: string | null;
  art: "L" | "S";
  /** Tag, nach dem die ursprüngliche Rechnung gemeldet war (§ 18b UStG) */
  tag: string;
  /** Tag, dem die Ersatzrechnung zugeordnet ist (null: keine Ersatzrechnung) – anderer Zeitraum: auch diesen berichtigen */
  ersatzTag: string | null;
  monat: string;
  quartal: string;
  stornoDatum: string;
  /** E-218: Tag, an dem der Fehler erkannt wurde (Eingabe beim Storno, vorbelegt mit dem Datum des Stornos) */
  erkannt: string;
  /**
   * ZM berichtigen „innerhalb eines Monats“, nachdem der Fehler erkannt wurde (§ 18a Abs. 10 UStG) – E-218: ab `erkannt`
   */
  zmFrist: string;
  /** als berichtigt vermerkt am (`Stand.erledigt`) */
  erledigt: string | null;
}

/**
 * E-214: Berichtigungen, die Stornos „Fehler in der Rechnung“ auslösen – je geteilter Stornorechnung einer Rechnung mit
 * EU-Umsatz (ZM) der Zeitraum der ursprünglichen Meldung, für den ZM und Voranmeldung zu berichtigen sind. Was die App
 * rechnet: die berichtigten Werte dieses Zeitraums (Storno und Ersatzrechnung zählen dort). Was sie nicht kann: wissen,
 * ob und wann die ursprüngliche Meldung abgegeben wurde, und die Berichtigung abgeben – das vermerkt der Betrieb.
 */
export function euBerichtigungen(unterlagen: Unterlage[], betrieb: Betrieb, erledigt: Record<string, string> = {}): EuBerichtigung[] {
  const feste = festeRechnungen(unterlagen);
  const korr = korrekturen(unterlagen, betrieb);
  const nr = (u: Unterlage | undefined) => (u && typeof u.daten.nummer === "string" ? u.daten.nummer : "");
  const aus: EuBerichtigung[] = [];
  for (const st of feste) {
    if (!istStornoU(st) || euStornoGrund(st) !== "rechnung" || !st.stornoZuId) continue;
    const orig = feste.find((x) => x.id === st.stornoZuId);
    const art = orig ? euArtVon(orig, betrieb) : null;
    const tag = korr.get(st.id);
    if (!orig || !art || !tag) continue;
    const ersatz = feste.find((x) => !istStornoU(x) && (x.ersetzt === orig.id || (nr(orig) !== "" && typeof x.daten.ersetzt_nummer === "string" && x.daten.ersetzt_nummer.trim() === nr(orig).trim())));
    const stornoDatum = String(st.daten.datum);
    const erkannt = euFehlerErkannt(st);
    const [monat, quartal] = periodenVon(tag) as [string, string];
    aus.push({ stornoId: st.id, stornoNr: nr(st), rechnungNr: nr(orig), ersatzNr: ersatz ? nr(ersatz) : null, art, tag, ersatzTag: ersatz ? (korr.get(ersatz.id) ?? zuordnenEinfach(ersatz, "soll", betrieb).tag) : null, monat, quartal, stornoDatum, erkannt, zmFrist: einMonatNach(erkannt), erledigt: erledigt[euBerichtigungSchluessel(st.id)] ?? null });
  }
  return aus.sort((a, b) => a.stornoDatum.localeCompare(b.stornoDatum) || a.stornoNr.localeCompare(b.stornoNr));
}

/** E-218: Schlüssel in `Stand.erledigt`, mit dem der einmalige Hinweis auf ältere Stornos ohne Grund ausgeblendet ist. */
export const EU_STORNO_ALT_HINWEIS = "eu-storno-grund-hinweis";

/**
 * E-218 (Steuerberater 27.10.2026, T-273 (4)): geteilte Stornos innergemeinschaftlicher Lieferungen ohne Grund (ältere
 * Daten von vor E-214) – für den einmaligen Hinweis, den Grund nachzutragen (`euStornoSetzen`). Ohne Grund gilt bei
 * Lieferungen „Betrag hat sich geändert“.
 */
export function euStornosOhneGrund(unterlagen: Unterlage[], betrieb: Betrieb): Unterlage[] {
  const feste = festeRechnungen(unterlagen);
  return feste.filter((st) => {
    if (!istStornoU(st) || !st.stornoZuId || euStornoGrund(st)) return false;
    const orig = feste.find((x) => x.id === st.stornoZuId);
    return !!orig && euArtVon(orig, betrieb) === "L";
  });
}

/** E-214: Berichtigungen, deren ursprünglicher Zeitraum in `periode` liegt (Monat bzw. Quartal), und Stornos dieses Zeitraums, die anderswo zählen. */
export function euBerichtigungenFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb): { hier: EuBerichtigung[]; anderswo: EuBerichtigung[] } {
  const z = ustZeitraum(periode);
  if (!z) return { hier: [], anderswo: [] };
  const l = euBerichtigungen(unterlagen, betrieb);
  const im = (t: string) => t >= z.von && t <= z.bis;
  return { hier: l.filter((b) => im(b.tag) || (!!b.ersatzTag && b.ersatzTag.slice(0, 7) < b.stornoDatum.slice(0, 7) && im(b.ersatzTag))), anderswo: l.filter((b) => im(b.stornoDatum) && !im(b.tag)) };
}

/**
 * E-214: Zeitraum, dem ein Storno einer Rechnung mit EU-Umsatz zählt – auch schon für den Entwurf der Stornorechnung
 * (zur Anzeige). „rechnung“: der Tag der ursprünglichen Meldung; „betrag“: das Datum des Stornos.
 */
export function euStornoTag(unterlagen: Unterlage[], betrieb: Betrieb, st: Unterlage): string | null {
  const grund = euStornoGrund(st);
  const orig = st.stornoZuId ? unterlagen.find((x) => x.id === st.stornoZuId) : undefined;
  if (!grund || !orig || !euArtVon(orig, betrieb)) return null;
  return grund === "rechnung" ? zuordnenEinfach(orig, "soll", betrieb).tag : String(st.daten.datum);
}

/**
 * Text für Voranmeldung bzw. ZM: „Storno 2026-0042 (Fehler in Rechnung 2026-0017) berichtigt diesen Zeitraum“ – E-218
 * (Steuerberater 27.10.2026): Berichtigung in genau diesem Zeitraum, nicht in der laufenden Voranmeldung.
 */
export const berichtigungText = (b: EuBerichtigung) => `Storno ${b.stornoNr} (Fehler in Rechnung ${b.rechnungNr}${b.ersatzNr ? `, ersetzt durch ${b.ersatzNr}` : ""}) berichtigt den Zeitraum der ursprünglichen Meldung – war sie schon abgegeben, ist sie für diesen Zeitraum zu berichtigen (Voranmeldung im selben Zeitraum wie die ZM, nicht in der laufenden Voranmeldung).`;

/**
 * E-218: Schlussrechnung, die eine Abschlagsrechnung absetzt (ihre Nummer steht unter „Abgesetzte Abschlagsrechnungen“) –
 * geteilt, keine Stornorechnung und nicht storniert. Ohne Nummer keine Zuordnung.
 */
export function schlussZuAbschlag(unterlagen: Unterlage[], abschlag: Unterlage): Unterlage | undefined {
  const nr = typeof abschlag.daten.nummer === "string" ? abschlag.daten.nummer.trim() : "";
  if (!nr || abschlag.daten.abschlag !== true) return undefined;
  const setztAb = (x: Unterlage) => x.daten.schluss === true && Array.isArray(x.daten.abschlaege) && (x.daten.abschlaege as unknown[]).some((a) => !!a && typeof a === "object" && typeof (a as { nummer?: unknown }).nummer === "string" && (a as { nummer: string }).nummer.trim() === nr);
  return festeRechnungen(unterlagen)
    .filter((x) => x.id !== abschlag.id && !istStornoU(x) && !x.storniertDurch && x.daten.abschlag !== true && setztAb(x))
    .sort((a, b) => (a.festgeschrieben ?? "").localeCompare(b.festgeschrieben ?? ""))[0];
}

/**
 * E-218 (Steuerberater 27.10.2026, T-273 (5) geändert): Tag, an dem ein Skonto bzw. eine Minderung Kz 41/21 und die ZM
 * mindert. Sonst der Zahltag (§ 17, § 18b Satz 4 UStG). Bei einer Abschlagsrechnung auf einen EU-Umsatz: Wird das Skonto
 * abgezogen, bevor die Lieferung bzw. Leistung gemeldet ist (Zahltag nicht nach dem Tag, nach dem die Schlussrechnung
 * gemeldet wird), entsteht keine eigene Minderung in einem früheren Zeitraum – es mindert das Entgelt, das mit der
 * Schlussrechnung gemeldet wird (§ 10 Abs. 1 UStG), also deren Tag; gibt es die Schlussrechnung noch nicht, mindert es
 * noch nirgends (null). Erst ein Skonto nach der Meldung mindert im Zeitraum der Zahlung.
 */
export function euMinderungsTage(unterlagen: Unterlage[], betrieb: Betrieb): (u: Unterlage, zahltag: string) => string | null {
  const korr = korrekturen(unterlagen, betrieb);
  return (u, zahltag) => {
    if (u.daten.abschlag !== true || istStornoU(u) || !euArtVon(u, betrieb)) return zahltag;
    const schluss = schlussZuAbschlag(unterlagen, u);
    const gemeldet = schluss ? zuordnen(schluss, "soll", betrieb, korr).tag : null;
    if (!gemeldet) return null;
    return zahltag <= gemeldet ? gemeldet : zahltag;
  };
}

/** Monate und Quartale mit zuordenbaren Rechnungen – neueste zuerst. */
export function perioden(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = [], kasse: Kassenabschluss[] = []): string[] {
  const set = new Set<string>();
  // R12: Zeiträume mit Kassenabschlüssen und mit Zahlungen (Skonto, Teilzahlungen)
  for (const k of kasse) if (!k.geschlossen) for (const p of periodenVon(k.datum)) set.add(p);
  for (const u of unterlagen) for (const z of u.zahlungen ?? []) for (const p of periodenVon(z.datum)) set.add(p);
  // Vorsteuer aus Belegen zählt nach Belegdatum (E-133) – auch Zeiträume nur mit Belegen
  for (const b of belege) for (const p of periodenVon(b.datum)) set.add(p);
  const korr = korrekturen(unterlagen, betrieb);
  for (const u of festeRechnungen(unterlagen)) {
    const z = zuordnen(u, v, betrieb, korr);
    if (z.tag) for (const p of periodenVon(z.tag)) set.add(p);
  }
  for (const u of gestellt(unterlagen)) if (istGutschrift(u)) for (const p of periodenVon(gutschriftTag(u, betrieb))) set.add(p);
  // R11 (Kosmetik #10): keine Voranmeldung für Zeiträume, die ganz in der Kleinunternehmerzeit liegen („Mein Betrieb“)
  const kuBis = (betrieb.ku_bis ?? "").trim();
  if (kuBis) for (const p of [...set]) if ((ustZeitraum(p)?.bis ?? "") <= kuBis) set.delete(p);
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
}

/**
 * R11: Der Betrieb hat bisher nur steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8–29 UStG): alle geteilten
 * Rechnungen (ohne Gutschriften und Kleinunternehmer-Rechnungen) nur zu 0 % mit Steuerbefreiung, Kz 48. Dann ist die
 * Vorsteuer beim Einlesen einer E-Rechnung zunächst aus (§ 15 Abs. 2 UStG).
 */
export function nurSteuerfreieUmsaetze(unterlagen: Unterlage[], betrieb: Betrieb): boolean {
  const r = festeRechnungen(unterlagen).filter((u) => !kuRechnung(u) && !istStornoU(u));
  return (
    r.length > 0 &&
    r.every((u) => {
      const { daten } = eRechnungAus(u.daten, betrieb);
      return daten.steuerart === "befreit" && kennzahlBefreiung(daten.befreiungsgrund) === "48" && daten.positionen.every((p) => p.ust_satz === 0);
    })
  );
}

/**
 * E-165 (StB-Prüfung 5.2): Der Betrieb hat steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8–29 UStG, Kz 48) UND
 * steuerpflichtige Umsätze (z. B. Praxis mit Heilbehandlungen und Wellness) – dann ist die Vorsteuer aus gemischt
 * genutzten Eingangsleistungen nur anteilig abziehbar (§ 15 Abs. 4 UStG). Die Vorsteuerquote aus „Mein Betrieb“ zählt
 * als Angabe des Betriebs: ist sie gesetzt, gilt der Betrieb ebenfalls als gemischt.
 */
export function gemischteUmsaetze(unterlagen: Unterlage[], betrieb: Betrieb): boolean {
  if (vorsteuerquoteAus(betrieb) !== null) return true;
  const r = festeRechnungen(unterlagen).filter((u) => !kuRechnung(u) && !istStornoU(u));
  let frei = false;
  let pflichtig = false;
  for (const u of r) {
    const { daten } = eRechnungAus(u.daten, betrieb);
    if (daten.steuerart === "befreit" && kennzahlBefreiung(daten.befreiungsgrund) === "48") frei = true;
    if (daten.positionen.some((p) => (p.ust_satz ?? 0) > 0)) pflichtig = true;
  }
  return frei && pflichtig;
}

/** E-165: Vorsteuerquote aus „Mein Betrieb“ in Prozent (0 < x < 100), sonst null. */
export function vorsteuerquoteAus(betrieb: Pick<Betrieb, "vorsteuerquote">): number | null {
  const n = Number((betrieb.vorsteuerquote ?? "").replace(",", ".").replace(/[%\s]/g, ""));
  return (betrieb.vorsteuerquote ?? "").trim() && Number.isFinite(n) && n > 0 && n < 100 ? Math.round(n * 100) / 100 : null;
}

/** Festgeschriebene Rechnungen ohne vermerkten Zahlungseingang (nicht storniert, keine Stornorechnung, keine Gutschrift). */
export const offeneRechnungen = (unterlagen: Unterlage[]) => festeRechnungen(unterlagen).filter((u) => !u.bezahlt && !u.storniertDurch && !(typeof u.daten.storno_zu === "string" && u.daten.storno_zu));

/**
 * Kleinunternehmer für einen Zeitraum (Lea, Befund 4): Rechnungen des Zeitraums, die alle Kleinunternehmer-Rechnungen
 * bzw. alle keine sind, entscheiden – ein Statuswechsel zum Jahreswechsel wirkt so je Zeitraum. Ohne eindeutige
 * Rechnungen gilt die Antwort im Pflichten-Check (`profilKu`).
 */
export function kuImZeitraum(rechnungen: Unterlage[], profilKu: boolean | undefined): boolean | undefined {
  const r = rechnungen.filter((u) => !istGutschrift(u));
  if (r.length && r.every(kuRechnung)) return true;
  if (r.length && r.every((u) => !kuRechnung(u))) return false;
  return profilKu;
}

export interface UstUebernahme {
  werte: Record<string, string>;
  anzahl: number;
  /** Soll: so viele Rechnungen ohne eindeutiges Leistungsdatum, nach Rechnungsdatum zugeordnet */
  ersatz: number;
  /** Ist: so viele geteilte Rechnungen ohne Zahlungseingang (zählen nicht) */
  offen: number;
  /** Belege mit Vorsteuer im Zeitraum und solche mit Umsatzsteuer, aber ohne Vorsteuerabzug (E-133) */
  vorsteuerBelege: number;
  ohneVorsteuer: number;
  /** Kleinunternehmer: nichts übernommen (`werte` enthält nur den Zeitraum) */
  kleinunternehmer: boolean;
  /**
   * R11: Zeitraum gilt als Kleinunternehmer-Zeitraum, enthält aber Rechnungen mit Umsatzsteuer – diese sind übernommen
   * (Überschreiten der Umsatzgrenze bzw. § 14c UStG, Text TEXT.ust_ku_gemischt).
   */
  kuGemischt: boolean;
  /** Gutschriften im Zeitraum – keine Umsätze, nicht übernommen */
  gutschriften: number;
  /**
   * Steuerfreie Umsätze ohne Vorsteuerabzug (Kz 48) und Vorsteuer aus Belegen im selben Zeitraum: Vorsteuer prüfen bzw.
   * aufteilen (§ 15 Abs. 2, 4 UStG) – Text VORSTEUER_AUFTEILEN; steht auch in der Voranmeldung.
   */
  vorsteuerPruefen: boolean;
  /** § 13b-Belege im Zeitraum (Kz 46/47, 84/85, 67) */
  steuerschuldBelege: number;
  /** E-222: Belege mit innergemeinschaftlichem Erwerb im Zeitraum, übernommen in Kz 89/93 und Kz 61 */
  igeBelege: number;
  /**
   * E-222: Kleinunternehmer-Zeitraum – innergemeinschaftliche Erwerbe nicht übernommen: Ob sie steuerbar sind, hängt von
   * der Erwerbsschwelle bzw. dem Verzicht darauf ab (§ 1a Abs. 3, 4 UStG) – das prüft die App nicht (PRUEFLISTE T-309).
   */
  igeKu: number;
  /** E-222: Bemessungsgrundlage innergemeinschaftlicher Erwerbe zu anderen Sätzen als 19 %/7 % – ohne Kennzahl, nicht übernommen */
  igeAndere: number;
  /**
   * E-224: Belege ohne Euro-Betrag im Zeitraum (fremde Währung ohne Umrechnung, E-221) – innergemeinschaftlicher Erwerb bzw.
   * § 13b; nicht übernommen, Warnung (TEXT.e224_*) und Zeile auf dem PDF
   */
  igeOhneEuro: number;
  rcOhneEuro: number;
  /** R12: Kassenabschlüsse mit Umsatz im Zeitraum (übernommen) */
  kasseTage: number;
  /** R12: Tage im Zeitraum ohne Kassenabschluss – null, wenn es noch gar keinen Kassenabschluss gibt */
  kasseFehlend: string[] | null;
  /** R12: Rechnungen mit Skonto bzw. Minderung, die im Zeitraum mindern */
  minderungen: number;
  /** StB-Prüfung (5.2): Nummern der Rechnungen ohne erkennbares Leistungsdatum (nach Rechnungsdatum zugeordnet) */
  ersatzNummern: string[];
  /** StB-Prüfung (5.2): OSS-Rechnungen im Zeitraum – nicht übernommen (OSS-Erklärung beim BZSt) */
  oss: number;
  /**
   * E-214: Stornos „Fehler in der Rechnung“, die diesen Zeitraum berichtigen (die Werte sind die berichtigten), und
   * Stornos dieses Zeitraums, die als Berichtigung in einem früheren Zeitraum zählen
   */
  berichtigungen: EuBerichtigung[];
  berichtigungenAnderswo: EuBerichtigung[];
}

/** R12: Kassenabschlüsse für die Voranmeldung – Ruhetage (Wochentage 0–6) und heutiger Tag für die fehlenden Tage. */
export interface KasseFuerUst {
  abschluesse: Kassenabschluss[];
  ruhetage?: number[];
  heute?: string;
  /** R12 GoBD: Kassenüberschüsse laut Zählung (im Stapel als Erlös 19 % gebucht) */
  ueberschuesse?: { datum: string; cent: number }[];
  /** R12 GoBD: Sachentnahmen (unentgeltliche Wertabgaben, § 3 Abs. 1b UStG) – Kz 86/81 */
  sachentnahmen?: Sachentnahme[];
}

/**
 * E-222: Zuordnungsannahme für innergemeinschaftliche Erwerbe – nach dem Belegdatum (Rechnungsdatum des Lieferanten); die
 * Steuer entsteht mit der Ausstellung der Rechnung, spätestens mit Ablauf des dem Erwerb folgenden Monats (§ 13 Abs. 1
 * Nr. 6 UStG) – den Tag des Erwerbs kennt der Beleg nicht.
 */
export const IGE_ANNAHME = (n: number) => `Innergemeinschaftliche Erwerbe aus ${n} ${n === 1 ? "Beleg" : "Belegen"} nach dem Belegdatum zugeordnet – die Steuer entsteht mit der Rechnung, spätestens mit Ablauf des Monats nach dem Erwerb (§ 13 Abs. 1 Nr. 6 UStG). Kam eine Rechnung später, gehört der Erwerb in den früheren Zeitraum.`;

/** Steuergruppen einer Rechnung mit Vorzeichen (Storno negativ). */
const volleGruppen = (d: RechnungsDaten) => meldeGruppen(d).map((g) => ({ satz: g.satz, netto_cent: g.netto_cent * (d.art === "storno" ? -1 : 1) }));

/**
 * Steuergruppen einer Rechnung für Voranmeldung und ZM (ohne Vorzeichen): der Rest nach den abgesetzten Abschlägen
 * (C-4, die Abschläge sind mit ihrer Zahlung schon versteuert) – E-214: bei EU-Umsätzen (ZM) das volle Entgelt, weil
 * Anzahlungen dort nicht gemeldet werden (§ 18b Satz 2 und 3 UStG).
 */
export const meldeGruppen = (d: RechnungsDaten) => (euMeldeArt(d) ? summen(d.positionen, d.kleinunternehmer).gruppen : restGruppen(d));

/** 5.2: OSS-Rechnung (Steuer des Bestimmungslands) – nicht in der deutschen Voranmeldung */
export const istOssRechnung = (u: Unterlage) => u.daten.oss === true;

const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Felder der Voranmeldung für einen Zeitraum („JJJJ-MM“ oder „JJJJ-Qn“). `kleinunternehmer`: Antwort im Pflichten-Check
 * („ust.kleinunternehmer“); ohne Antwort gilt als Kleinunternehmer, wessen Rechnungen im Zeitraum alle Kleinunternehmer-
 * Rechnungen sind. Dann wird nichts übernommen – auch keine Vorsteuer.
 */
export function umsaetzeFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = [], kleinunternehmer?: boolean, kasse?: KasseFuerUst): UstUebernahme | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const korr = korrekturen(unterlagen, betrieb);
  const gutschriftenListe = gestellt(unterlagen).filter((u) => {
    if (!istGutschrift(u)) return false;
    const tag = gutschriftTag(u, betrieb);
    return tag >= z.von && tag <= z.bis;
  });
  const gutschriften = gutschriftenListe.length;
  const alle = festeRechnungen(unterlagen)
    // R12: Ist mit einzelnen Zahlungen – die Zahlungen zählen je für sich (unten), nicht die ganze Rechnung
    .filter((u) => !(v === "ist" && u.zahlungen?.length && !istStornoU(u) && !euArtVon(u, betrieb)))
    .map((u) => zuordnen(u, v, betrieb, korr))
    .filter((x) => x.tag && x.tag >= z.von && x.tag <= z.bis);
  const kuZeitraum = kuImZeitraum(alle.map((x) => x.u), kleinunternehmer) ?? false;
  // R11: Rechnungen mit Umsatzsteuer immer übernehmen – auch im Kleinunternehmer-Zeitraum (§ 19 Abs. 1 Satz 1 UStG, Abschnitt 19.1 UStAE; § 14c)
  const mitUst = alle.filter((x) => !kuRechnung(x.u));
  const kuGemischt = kuZeitraum && mitUst.length > 0;
  const ku = kuZeitraum && !kuGemischt;
  // § 13b-Eingangsleistungen: die Steuer schulden auch Kleinunternehmer (Kz 46/47, 84/85), Vorsteuer (Kz 67) nur mit Abzug
  const rc = steuerschuldFuer(belege, z.von, z.bis);
  const rcWerte = (mitVorsteuer: boolean): Record<string, string> =>
    rc.anzahl
      ? {
          ...(rc.eu_netto_cent ? { rc_eu_netto: betragText(rc.eu_netto_cent), rc_eu_steuer: betragText(rc.eu_steuer_cent) } : {}),
          ...(rc.bau_netto_cent ? { rc_bau_netto: betragText(rc.bau_netto_cent), rc_bau_steuer: betragText(rc.bau_steuer_cent) } : {}),
          ...(mitVorsteuer && rc.vorsteuer_cent ? { vorsteuer_13b: betragText(rc.vorsteuer_cent) } : {}),
        }
      : {};
  // E-222: innergemeinschaftliche Erwerbe (Kz 89/93, Vorsteuer Kz 61) – nur außerhalb der Kleinunternehmerzeit; nur
  // gesetzt, wenn es solche Belege gibt (von Hand eingetragene Erwerbe bleiben sonst stehen)
  const igeWerte: Record<string, string> = rc.ige_anzahl ? { ige_19: betragText(rc.ige_19_netto_cent), ige_7: betragText(rc.ige_7_netto_cent), vorsteuer_ige: rc.ige_vorsteuer_cent ? betragText(rc.ige_vorsteuer_cent) : "" } : {};
  const kasseFehlend = kasse?.abschluesse.length ? fehlendeTage(kasse.abschluesse, z.von, z.bis, kasse.ruhetage ?? [], kasse.heute) : null;
  if (ku) return { werte: { zeitraum: periodeText(periode), ...rcWerte(false) }, anzahl: 0, ersatz: 0, offen: 0, vorsteuerBelege: 0, ohneVorsteuer: 0, kleinunternehmer: true, kuGemischt: false, gutschriften, vorsteuerPruefen: false, steuerschuldBelege: rc.anzahl, igeBelege: 0, igeKu: rc.ige_anzahl + rc.ige_ohne_euro, igeAndere: 0, igeOhneEuro: 0, rcOhneEuro: rc.ohne_euro, kasseTage: 0, kasseFehlend: null, minderungen: 0, ersatzNummern: [], oss: 0, berichtigungen: [], berichtigungenAnderswo: [] };
  // einzelne Kleinunternehmer-Rechnungen (z. B. aus der Zeit vor dem Wechsel zur Regelbesteuerung) zählen nicht mit;
  // 5.2: OSS-Rechnungen gehören in die OSS-Erklärung, nicht in die Voranmeldung
  const ossImZeitraum = alle.filter((x) => !kuRechnung(x.u) && istOssRechnung(x.u)).length;
  const im = alle.filter((x) => !kuRechnung(x.u) && !istOssRechnung(x.u));
  // R12: Posten je Rechnung – ganze Rechnung, Zahlung (Ist) oder Minderung (Soll) – mit Steuergruppen und Vorzeichen
  const posten: { daten: RechnungsDaten; gruppen: { satz: number | null; netto_cent: number }[] }[] = im.map(({ u }) => {
    const daten = eRechnungAus(u.daten, betrieb).daten;
    return { daten, gruppen: volleGruppen(daten) };
  });
  const imZ = (tag: string) => tag >= z.von && tag <= z.bis;
  let minderungen = 0;
  const minderungsTag = euMinderungsTage(unterlagen, betrieb);
  for (const u of festeRechnungen(unterlagen)) {
    if (kuRechnung(u) || istStornoU(u) || istOssRechnung(u) || !u.zahlungen?.length) continue;
    // E-208: ZM-Umsätze zählen auch bei Ist ganz im Zeitraum nach § 18b UStG (oben), nicht je Zahlung – E-214: ein
    // Skonto bzw. eine Minderung mindert aber auch bei Ist im Zeitraum der Zahlung (§ 17, § 18b Satz 4 UStG)
    const euIst = v === "ist" && !!euArtVon(u, betrieb);
    const daten = eRechnungAus(u.daten, betrieb).daten;
    // C-4: bei einer Schlussrechnung verteilen sich die Zahlungen auf den Rest nach den Abschlägen
    const anteile = zahlungsAnteile(restGruppen(daten), u.zahlungen);
    let mindert = false;
    for (const a of anteile) {
      // Ist: je Zahlung der erhaltene Betrag; Soll: die Minderung (§ 17 UStG) im Zeitraum der Zahlung
      if (v === "ist" && !euIst) {
        if (imZ(a.zahlung.datum)) posten.push({ daten, gruppen: a.erhalten.map((x) => ({ satz: x.satz, netto_cent: x.netto_cent })) });
        continue;
      }
      if (!a.minderung.some((x) => x.brutto_cent)) continue;
      // E-218: Skonto auf eine Anzahlung auf einen EU-Umsatz vor dessen Meldung mindert mit der Schlussrechnung
      const tag = minderungsTag(u, a.zahlung.datum);
      if (!tag || !imZ(tag)) continue;
      posten.push({ daten, gruppen: a.minderung.map((x) => ({ satz: x.satz, netto_cent: -x.netto_cent })) });
      mindert = true;
    }
    if (mindert) minderungen++;
  }
  const summe = (f: (s: number | null) => boolean) => posten.reduce((a, p) => a + p.gruppen.filter((g) => f(g.satz)).reduce((b, g) => b + g.netto_cent, 0), 0);
  // Umsätze zu 0 % nach Kennzahl: igL → Kz 41; Steuerschuldnerschaft des Empfängers im Inland → Kz 60, an Unternehmen im
  // EU-Ausland → Kz 21, außerhalb der EU → Kz 45; Nullsteuersatz → Kz 87; Befreiung nach § 4 Nr. 8–29 → Kz 48, Nr. 1 a–7 → Kz 43
  const ohne = { igl: 0, rc: 0, kz21: 0, kz45: 0, kz87: 0, kz48: 0, kz43: 0 };
  for (const { daten, gruppen } of posten) {
    const null0 = gruppen.filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0);
    const land = (daten.kunde.land ?? "DE").toUpperCase();
    if (daten.steuerart === "igl") ohne.igl += null0;
    else if (daten.steuerart === "reverse_charge") {
      if (land === "DE") ohne.rc += null0;
      else if (istEuAusland(land)) ohne.kz21 += null0;
      else ohne.kz45 += null0;
    } else if (daten.steuerart === "nullsatz") ohne.kz87 += null0;
    else if (daten.steuerart === "befreit") {
      const kz = kennzahlBefreiung(daten.befreiungsgrund);
      if (kz === "48") ohne.kz48 += null0;
      else if (kz === "43") ohne.kz43 += null0;
    }
  }
  const frei = summe((s) => s === null || s === 0);
  // gemischter Zeitraum: Vorsteuer erst aus Belegen ab der ersten Rechnung mit Umsatzsteuer (vorher Kleinunternehmer)
  const vstAb = kuGemischt ? mitUst.map((x) => x.tag!).sort()[0]! : z.von;
  const vst = vorsteuerFuer(belege, vstAb > z.von ? vstAb : z.von, z.bis);
  // Gutschriften: die ausgewiesene Umsatzsteuer des Leistenden ist für den Betrieb Vorsteuer (§ 15 Abs. 1 Nr. 1 UStG)
  const vstGutschriften = gutschriftenListe.reduce((a, u) => {
    const { daten } = eRechnungAus(u.daten, betrieb);
    return a + summen(daten.positionen, daten.kleinunternehmer).ust_cent * (daten.art === "storno" ? -1 : 1);
  }, 0);
  const verteilt = ohne.igl + ohne.rc + ohne.kz21 + ohne.kz45 + ohne.kz87 + ohne.kz48 + ohne.kz43;
  // R12: Kassenumsätze nach dem Tag des Abschlusses (Netto je Monat aus dem Brutto)
  const ka = kasse?.abschluesse.length ? kassenUmsatz(kasse.abschluesse, z.von, z.bis, false, { ueberschuesse: kasse.ueberschuesse }) : null;
  const se = sachentnahmenFuer(kasse?.sachentnahmen ?? [], z.von, z.bis);
  // 5.2: je Rechnung, die nach dem Rechnungsdatum zugeordnet ist – Nummer | Datum | Kunde | Netto
  const ersatzListe = im.filter((x) => x.ersatz).map(({ u }) => {
    const daten = eRechnungAus(u.daten, betrieb).daten;
    return { nummer: daten.nummer, zeile: [daten.nummer, datumDe(daten.rechnungsdatum), daten.kunde.name.replace(/\s*\|\s*/g, " "), betragText(volleGruppen(daten).reduce((a, g) => a + g.netto_cent, 0))].join(" | ") };
  });
  const ber = euBerichtigungenFuer(unterlagen, periode, betrieb);
  const annahmen = [
    ...ber.hier.map(berichtigungText),
    ka?.tage ? `Kassenumsätze aus ${ka.tage} Tagesabschlüssen: Netto und Umsatzsteuer je Steuersatz aus dem Brutto herausgerechnet.` : "",
    ossImZeitraum ? `${ossImZeitraum} OSS-Rechnung(en) mit der Steuer des Bestimmungslands nicht übernommen – sie gehören in die OSS-Erklärung beim BZSt.` : "",
    rc.ige_anzahl ? IGE_ANNAHME(rc.ige_anzahl) : "",
    rc.ige_ohne_euro ? TEXT.e224_ige_ohne_euro_pdf(rc.ige_ohne_euro) : "",
    rc.ohne_euro ? TEXT.e224_13b_ohne_euro_pdf(rc.ohne_euro) : "",
    rc.ige_andere_cent ? `Innergemeinschaftliche Erwerbe zu anderen Steuersätzen als 19 % und 7 % (${betragText(rc.ige_andere_cent)} €) nicht übernommen – bitte im ELSTER-Formular prüfen.` : "",
  ].filter(Boolean);
  return {
    vorsteuerBelege: vst.anzahl,
    ohneVorsteuer: vst.ohne,
    anzahl: im.length,
    ersatz: im.filter((x) => x.ersatz).length,
    offen: v === "ist" ? offeneRechnungen(unterlagen).length : 0,
    kleinunternehmer: false,
    kuGemischt,
    gutschriften,
    vorsteuerPruefen: ohne.kz48 > 0 && vst.cent > 0,
    steuerschuldBelege: rc.anzahl,
    igeBelege: rc.ige_anzahl,
    igeKu: 0,
    igeAndere: rc.ige_andere_cent,
    igeOhneEuro: rc.ige_ohne_euro,
    rcOhneEuro: rc.ohne_euro,
    kasseTage: ka?.tage ?? 0,
    kasseFehlend,
    minderungen,
    ersatzNummern: ersatzListe.map((x) => x.nummer),
    oss: ossImZeitraum,
    berichtigungen: ber.hier,
    berichtigungenAnderswo: ber.anderswo,
    werte: {
      zeitraum: periodeText(periode),
      umsatz_19: betragText(summe((s) => s === 19) + (ka?.je[19].netto ?? 0) + se.netto19),
      umsatz_7: betragText(summe((s) => s === 7) + (ka?.je[7].netto ?? 0) + se.netto7),
      umsatz_igl: betragText(ohne.igl),
      umsatz_48: betragText(ohne.kz48),
      umsatz_13b: betragText(ohne.rc),
      umsatz_21: betragText(ohne.kz21),
      umsatz_45: betragText(ohne.kz45),
      umsatz_87: betragText(ohne.kz87),
      umsatz_43: betragText(ohne.kz43),
      umsatz_frei: betragText(frei - verteilt + (ka?.je[0].netto ?? 0)),
      ...(belege.length || vstGutschriften ? { vorsteuer: betragText(vst.cent + vstGutschriften) } : {}),
      ...rcWerte(true),
      ...igeWerte,
      // 5.2: Zuordnungsannahmen stehen auf dem PDF der Voranmeldung (leer überschreibt Werte einer früheren Übernahme)
      nach_rechnungsdatum: ersatzListe.map((x) => x.zeile).join("\n"),
      annahmen: annahmen.join("\n"),
    },
  };
}
