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
 *   auch für Kleinunternehmer (ohne Kz 67); Vorsteuer aus Gutschriften.
 * - Kleinunternehmer je Zeitraum: Sind alle Rechnungen des Zeitraums Kleinunternehmer-Rechnungen (bzw. keine), gilt
 *   das für diesen Zeitraum – auch wenn der Pflichten-Check heute etwas anderes sagt (Wechsel zum Jahreswechsel).
 *
 * R11 (interne Prüfrunde Steuern – nicht von der Steuerberatung bestätigt, PRUEFLISTE T-117):
 * - Rechnungen mit Umsatzsteuer werden immer übernommen, auch in einem Zeitraum, der sonst als Kleinunternehmer-Zeitraum
 *   gilt (Überschreiten der 100.000 €, § 19 Abs. 1 Satz 2 UStG n. F.; sonst schuldet man die Steuer nach § 14c, Kz 69).
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
 */
import { sachentnahmenFuer, type Sachentnahme } from "@amtlos/fachlogik";
import { eRechnungAus, fehlendeTage, istEuAusland, kassenUmsatz, kennzahlBefreiung, restGruppen, steuerschuldFuer, summen, ustZeitraum, vorsteuerFuer, zahlungsAnteile, type Beleg, type Betrieb, type Kassenabschluss, type RechnungsDaten } from "@amtlos/fachlogik";
import { nichtZaehlend, type Unterlage } from "./speicher";
import { MARKE } from "@amtlos/marke";

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
const euArtVon = (u: Unterlage, betrieb: Betrieb) => (u.daten.kleinunternehmer === true || istGutschrift(u) ? null : euMeldeArt(eRechnungAus(u.daten, betrieb).daten));

function zuordnen(u: Unterlage, v: Versteuerung, betrieb: Betrieb, korr?: Map<string, string>): Zuordnung {
  const eu = euArtVon(u, betrieb);
  // E-208: Lieferung (ZM „L“) nach der Rechnung – ohne die Soll-Korrekturen für Storno und Ersatzrechnung, wie in der ZM;
  // sonstige Leistung (ZM „S“) wie bei Soll, auch bei Ist-Versteuerung
  if (eu === "L") return zuordnenEinfach(u, v, betrieb);
  const k = v === "soll" || eu === "S" ? korr?.get(u.id) : undefined;
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
    if (storno) return { u, tag: datum, ersatz: false };
    const lieferung = leistungVon(u, betrieb) ?? datum;
    const spaetestens = endeFolgemonat(lieferung);
    return { u, tag: datum < spaetestens ? datum : spaetestens, ersatz: false };
  }
  // E-208: sonstige Leistung an ein Unternehmen im EU-Ausland – Zeitraum der Ausführung (§ 18b Satz 3 UStG), auch bei Ist
  if (v === "ist" && eu !== "S") return { u, tag: u.bezahlt ?? null, ersatz: false };
  if (storno) return { u, tag: u.daten.datum as string, ersatz: false };
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

/** Steuergruppen einer Rechnung mit Vorzeichen (Storno negativ). */
const volleGruppen = (d: RechnungsDaten) => restGruppen(d).map((g) => ({ satz: g.satz, netto_cent: g.netto_cent * (d.art === "storno" ? -1 : 1) }));

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
  // R11: Rechnungen mit Umsatzsteuer immer übernehmen – auch im Kleinunternehmer-Zeitraum (§ 19 Abs. 1 Satz 2 n. F., § 14c)
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
  const kasseFehlend = kasse?.abschluesse.length ? fehlendeTage(kasse.abschluesse, z.von, z.bis, kasse.ruhetage ?? [], kasse.heute) : null;
  if (ku) return { werte: { zeitraum: periodeText(periode), ...rcWerte(false) }, anzahl: 0, ersatz: 0, offen: 0, vorsteuerBelege: 0, ohneVorsteuer: 0, kleinunternehmer: true, kuGemischt: false, gutschriften, vorsteuerPruefen: false, steuerschuldBelege: rc.anzahl, kasseTage: 0, kasseFehlend: null, minderungen: 0, ersatzNummern: [], oss: 0 };
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
  for (const u of festeRechnungen(unterlagen)) {
    if (kuRechnung(u) || istStornoU(u) || istOssRechnung(u) || !u.zahlungen?.length) continue;
    // E-208: ZM-Umsätze zählen auch bei Ist ganz im Zeitraum nach § 18b UStG (oben), nicht je Zahlung
    if (v === "ist" && euArtVon(u, betrieb)) continue;
    const daten = eRechnungAus(u.daten, betrieb).daten;
    // C-4: bei einer Schlussrechnung verteilen sich die Zahlungen auf den Rest nach den Abschlägen
    const anteile = zahlungsAnteile(restGruppen(daten), u.zahlungen);
    let mindert = false;
    for (const a of anteile) {
      if (!imZ(a.zahlung.datum)) continue;
      // Ist: je Zahlung der erhaltene Betrag; Soll: die Minderung (§ 17 UStG) im Zeitraum der Zahlung
      if (v === "ist") posten.push({ daten, gruppen: a.erhalten.map((x) => ({ satz: x.satz, netto_cent: x.netto_cent })) });
      else if (a.minderung.some((x) => x.brutto_cent)) {
        posten.push({ daten, gruppen: a.minderung.map((x) => ({ satz: x.satz, netto_cent: -x.netto_cent })) });
        mindert = true;
      }
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
  const annahmen = [
    ka?.tage ? `Kassenumsätze aus ${ka.tage} Tagesabschlüssen: Netto und Umsatzsteuer je Steuersatz aus dem Brutto herausgerechnet.` : "",
    ossImZeitraum ? `${ossImZeitraum} OSS-Rechnung(en) mit der Steuer des Bestimmungslands nicht übernommen – sie gehören in die OSS-Erklärung beim BZSt.` : "",
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
    kasseTage: ka?.tage ?? 0,
    kasseFehlend,
    minderungen,
    ersatzNummern: ersatzListe.map((x) => x.nummer),
    oss: ossImZeitraum,
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
      // 5.2: Zuordnungsannahmen stehen auf dem PDF der Voranmeldung (leer überschreibt Werte einer früheren Übernahme)
      nach_rechnungsdatum: ersatzListe.map((x) => x.zeile).join("\n"),
      annahmen: annahmen.join("\n"),
    },
  };
}
