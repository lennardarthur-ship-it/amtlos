/**
 * Daten aus Rechnungen und Belegen weitergeben (E-133) – reine Funktionen ohne Gerät:
 * - EÜR übernehmen: Einnahmen nach Zahlungseingang, Ausgaben nach Zahlung, je Zeile der Anlage EÜR.
 * - Steuerberater-Paket: ZIP mit DATEV-Buchungsstapel, lesbarer Buchungsliste, Rechnungs- und Belegliste (CSV),
 *   Fragen an den Betrieb, E-Rechnungen (XRechnung) der Ausgangsrechnungen, den Originaldateien der Belege und – wenn
 *   der Aufrufer sie mitgibt – den PDFs der Rechnungen.
 * Fachlich zu prüfen: PRUEFLISTE T-79 (Zuordnung) und die Prüfpunkte in packages/fachlogik/src/buchungen.ts.
 */
import { zipSync, type Zippable } from "fflate";
import {
  EUER_KAPITALGESELLSCHAFT,
  EUER_ZEILE_STEUERFREI,
  EUER_ZEILE_STEUERPFLICHTIG,
  KU_HINWEIS,
  buchungenAusBelegen,
  buchungenAusRechnungen,
  buchungslisteCsv,
  belegImStapel,
  belegKennung,
  belegNummern,
  belegSummen,
  belegnummerNormal,
  dateinamenTeil,
  datevExtf,
  datevExtfBytes,
  eRechnungAus,
  drittlandLand,
  euUnternehmenLand,
  euerFuer,
  kennzahlBefreiung,
  steuerschuldBetrag,
  VORSTEUER_AUFTEILEN,
  istKapitalgesellschaft,
  kategorieFuer,
  summen,
  xrechnungUbl,
  zahltag,
  ZAHLUNGSWEGE,
  type AusgangsRechnungFuerBuchung,
  type Beleg,
  type Betrieb,
  type Einnahme,
  type Kontenrahmen,
  type RechnungsDaten,
} from "@amtlos/fachlogik";
import { APP_VERSION } from "../version";
import { T as TEXT } from "../texte";
import { utf8 } from "./sicherung";
import { GUTSCHRIFT_HINWEIS, istGutschrift, kuImZeitraum, zuordnungsTage } from "./ustAusRechnungen";
import { nichtZaehlend, type Stand, type Unterlage } from "./speicher";

// 0 statt -0: ein Storno über 0,00 € steht als „0,00“ da, nicht als „-0,00“
const betrag = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent === 0 ? 0 : cent / 100);
const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
export { GUTSCHRIFT_HINWEIS, istGutschrift };


/**
 * Festgeschriebene (geteilte) Rechnungen – nur sie gelten als gestellt (inkl. Stornorechnungen und Gutschriften).
 * Konfliktkopien und doppelte Stornos zählen nicht (K1, K2) – so auch nicht in EÜR und DATEV-Export.
 */
export const gestellteRechnungen = (s: Stand) => {
  const aus = nichtZaehlend(s.unterlagen);
  return s.unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string" && !aus.has(u.id));
};
/** Gestellte Rechnungen ohne Gutschriften – nur sie sind Umsätze des Betriebs. */
export const umsatzRechnungen = (s: Stand) => gestellteRechnungen(s).filter((u) => !istGutschrift(u));

/**
 * Kasse laut Pflichten-Check („kasse.elektronisch“): „kasse“ (ja), „keine“ (nein) oder „unbekannt“ (nicht beantwortet).
 * Amtlos kennt nur Rechnungen und Belege – mit Kasse fehlen die Kassenumsätze in allem, was daraus gerechnet wird
 * (Voranmeldung, EÜR, Steuerberater-Paket). Dasselbe gilt für Umsätze über Onlineshop, Online-Marktplätze, App oder
 * Marktstand („vertrieb.kanaele“): dann „shop“ bzw. mit Kasse „kasse_shop“.
 */
export type KassenLage = "kasse" | "keine" | "unbekannt" | "shop" | "kasse_shop";
/** Verkaufswege, deren Umsätze ohne Rechnung aus Amtlos entstehen (Shop- und Plattformberichte, Marktkasse). */
export const SHOP_KANAELE = ["onlineshop", "marktplatz", "app", "marktstand"];
export function kassenLage(profil: Stand["profil"]): KassenLage {
  const w = profil["kasse.elektronisch"];
  const k = profil["vertrieb.kanaele"];
  const shop = Array.isArray(k) && k.some((x) => SHOP_KANAELE.includes(String(x)));
  if (shop) return w === true ? "kasse_shop" : "shop";
  return w === true ? "kasse" : w === false ? "keine" : "unbekannt";
}

/** Hinweis in der App nach einer Übernahme: mit Kasse bzw. Shop laut Check als Warnung, ohne Antwort ruhiger („Falls du …“). */
export function kassenHinweis(lage: KassenLage, art: "ust" | "euer"): { text: string; warnung: boolean } | null {
  if (lage === "keine") return null;
  if (lage === "shop") return { text: art === "ust" ? TEXT.shop_ust : TEXT.shop_euer, warnung: true };
  if (lage === "kasse_shop") return { text: art === "ust" ? TEXT.kasse_shop_ust : TEXT.kasse_shop_euer, warnung: true };
  if (art === "ust") return lage === "kasse" ? { text: TEXT.kasse_ust, warnung: true } : { text: TEXT.kasse_ust_vielleicht, warnung: false };
  return lage === "kasse" ? { text: TEXT.kasse_euer, warnung: true } : { text: TEXT.kasse_euer_vielleicht, warnung: false };
}

/** Satz für LIESMICH und Fragen im Paket – null, wenn der Betrieb laut Check weder Kasse noch Shop/Marktstand hat. */
export function kassenSatzPaket(lage: KassenLage): string | null {
  if (lage === "keine") return null;
  const satz = "Kassenumsätze fehlen in diesem Paket. Die Umsätze laut Tagesabschlüssen (Z-Bons) bzw. Kassenexport bitte zusätzlich liefern.";
  const shop = "Betrieb mit Onlineshop, Online-Marktplatz, App oder Marktstand (laut Pflichten-Check): Diese Umsätze fehlen in diesem Paket. Bitte die Shop-, Plattform- und Zahlungsberichte (z. B. Monatsabrechnungen, Auszahlungsübersichten) bzw. das Kassenbuch des Marktstands zusätzlich liefern.";
  if (lage === "shop") return shop;
  if (lage === "kasse_shop") return `Betrieb mit Kasse: ${satz}\r\n${shop}`;
  return lage === "kasse" ? `Betrieb mit Kasse: ${satz}` : `Falls der Betrieb eine Kasse nutzt: ${satz}`;
}

/**
 * Kleinunternehmer (§ 19 UStG): laut Pflichten-Check („ust.kleinunternehmer“); ohne Antwort dort, wenn alle
 * gestellten Rechnungen als Kleinunternehmer-Rechnung geschrieben sind.
 */
export function istKleinunternehmer(s: Stand): boolean {
  const p = s.profil["ust.kleinunternehmer"];
  if (typeof p === "boolean") return p;
  const r = gestellteRechnungen(s);
  return r.length > 0 && r.every((u) => u.daten.kleinunternehmer === true);
}

/** Rechtsform laut Pflichten-Check (Wert der Antwort) als Text – für LIESMICH, wenn „Mein Betrieb“ keine hat (R10). */
const RECHTSFORM_TEXT: Record<string, string> = { einzelunternehmen: "Einzelunternehmen", freiberuf: "Freiberuflich (Einzelunternehmen)", gbr: "GbR", ek: "e. K.", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG", partg: "PartG", partg_mbb: "PartG mbB" };
/** Rechtsform aus „Mein Betrieb“, sonst aus dem Pflichten-Check (mit Herkunft). */
export function rechtsformFuer(s: Stand): { text: string; ausCheck: boolean } | null {
  const b = s.betrieb.rechtsform?.trim();
  if (b) return { text: b, ausCheck: false };
  const p = s.profil.rechtsform;
  return typeof p === "string" && RECHTSFORM_TEXT[p] ? { text: RECHTSFORM_TEXT[p]!, ausCheck: true } : null;
}
/** Kapitalgesellschaft laut „Mein Betrieb“ oder Pflichten-Check */
export const kapitalgesellschaft = (s: Stand) => istKapitalgesellschaft(rechtsformFuer(s)?.text, s.betrieb.name);

/** Ausgangsrechnung in der Form, die die Buchungen brauchen. `tage`: Zuordnung zur Steuerperiode (zuordnungsTage). */
export function rechnungFuerBuchung(u: Unterlage, betrieb: Betrieb, o: { tage?: Map<string, string | null>; betriebKu?: boolean } = {}): AusgangsRechnungFuerBuchung {
  const { daten } = eRechnungAus(u.daten, betrieb);
  const leistung = daten.leistungsdatum ?? daten.leistungszeitraum?.bis ?? null;
  return {
    id: u.id,
    nummer: daten.nummer,
    datum: daten.rechnungsdatum,
    bezahlt: u.bezahlt ?? null,
    art: istStorno(u) ? "storno" : "rechnung",
    storniert_nummer: daten.storniert_nummer ?? null,
    gutschrift: istGutschrift(u),
    kleinunternehmer: daten.kleinunternehmer,
    kunde: daten.kunde.name,
    positionen: daten.positionen,
    steuerart: daten.steuerart,
    kunde_land: daten.kunde.land,
    kunde_ust_idnr: daten.kunde.ust_idnr ?? null,
    leistungsdatum: istStorno(u) ? null : leistung,
    steuerperiode: o.tage?.get(u.id) ?? null,
    empfaenger_ku: o.betriebKu ?? false,
  };
}

/**
 * Einnahmen aus Rechnungen mit vermerktem Zahlungseingang (Zufluss, § 11 Abs. 1 EStG); Stornos negativ. Positionen zu
 * 0 % einer Rechnung mit Steuerart „igl“, „reverse_charge“ oder „befreit“ zählen als steuerfrei (eigene EÜR-Zeile).
 */
export function einnahmenAusRechnungen(s: Stand): Einnahme[] {
  return umsatzRechnungen(s)
    .filter((u) => u.bezahlt)
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, s.betrieb);
      const sm = summen(daten.positionen, daten.kleinunternehmer);
      const vz = istStorno(u) ? -1 : 1;
      // Nullsteuersatz (§ 12 Abs. 3 UStG) ist steuerpflichtig zu 0 % – Zeile „umsatzsteuerpflichtig“, nicht „steuerfrei“ (R10)
      const frei = daten.steuerart && daten.steuerart !== "standard" && daten.steuerart !== "nullsatz" ? sm.gruppen.filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0) : 0;
      // Kleinunternehmer: Leistungen an Unternehmen im Ausland sind nicht steuerbar – eigene „davon“-Zeile der Anlage EÜR
      const nichtSteuerbar = daten.kleinunternehmer && (daten.steuerart === "reverse_charge" || euUnternehmenLand(u.daten) || drittlandLand(u.daten)) ? sm.netto_cent : 0;
      return { tag: u.bezahlt!, netto_cent: vz * sm.netto_cent, ust_cent: vz * sm.ust_cent, steuerfrei_cent: vz * frei, nicht_steuerbar_cent: vz * nichtSteuerbar, kleinunternehmer: daten.kleinunternehmer };
    });
}

/** Gutschriften mit Zahlungsvermerk im Jahr – Ausgaben des Betriebs (bezogene Leistungen), R10. */
function gutschriftAusgaben(s: Stand, jahr: string): { netto: number; ust: number; anzahl: number } {
  let netto = 0;
  let ust = 0;
  let anzahl = 0;
  for (const u of gestellteRechnungen(s)) {
    if (!istGutschrift(u) || !u.bezahlt?.startsWith(`${jahr}-`)) continue;
    const { daten } = eRechnungAus(u.daten, s.betrieb);
    const sm = summen(daten.positionen, daten.kleinunternehmer);
    const vz = istStorno(u) ? -1 : 1;
    netto += vz * sm.netto_cent;
    ust += vz * sm.ust_cent;
    anzahl++;
  }
  return { netto, ust, anzahl };
}

/** Jahre mit Daten (Zahlungen von Rechnungen, Zahltage von Belegen), neueste zuerst. */
export function jahreMitDaten(s: Stand): string[] {
  const j = new Set<string>();
  for (const u of umsatzRechnungen(s)) if (u.bezahlt) j.add(u.bezahlt.slice(0, 4));
  for (const b of s.belege) j.add(zahltag(b).slice(0, 4));
  return [...j].sort((a, b) => b.localeCompare(a));
}

export interface EuerUebernahme {
  einnahmen: Record<string, string>[];
  ausgaben: Record<string, string>[];
  /** Anschaffungen über 800 € netto: keine sofortige Ausgabe – Abschreibung selbst eintragen */
  anlagen: number;
  rechnungen: number;
  belege: number;
  /** geteilte Rechnungen des Jahres ohne vermerkten Zahlungseingang */
  unbezahlt: number;
  /** Gutschriften des Jahres – nicht als Einnahme übernommen */
  gutschriften: number;
  /** was die Übernahme nicht enthält und von Hand ergänzt werden muss (bei Kapitalgesellschaften mit Warnung vorab) */
  hinweis: string;
}

/** Steht nach jeder Übernahme sichtbar da: Amtlos rechnet diese Posten nicht aus. */
export const EUER_NICHT_ENTHALTEN =
  "Nicht enthalten: die an das Finanzamt gezahlten Umsatzsteuer-Vorauszahlungen (Zeile „An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer“), eine Erstattung vom Finanzamt und die Abschreibungen (AfA) – bitte selbst ergänzen.";
/** Zusatz mit Onlineshop, Marktplatz, App oder Marktstand laut Pflichten-Check: diese Einnahmen kennt Amtlos nicht. */
export const EUER_SHOP_NICHT_ENTHALTEN =
  "Ebenfalls nicht enthalten: Einnahmen aus Onlineshop, Online-Marktplätzen, App und Marktstand (laut Shop-, Plattform- und Zahlungsberichten bzw. Kassenbuch), auch Fernverkäufe in andere EU-Länder (OSS) und die dafür gezahlte Umsatzsteuer – bitte selbst ergänzen.";

/** Einträge für die Vorlage „EÜR“ (Listen `einnahmen` und `ausgaben`) aus den Daten eines Jahres. */
export function euerUebernahme(s: Stand, jahr: string): EuerUebernahme {
  const einnahmen = einnahmenAusRechnungen(s);
  const e = euerFuer(einnahmen, s.belege, jahr);
  const ku = einnahmen.some((x) => x.kleinunternehmer && x.tag.startsWith(`${jahr}-`));
  const ein: Record<string, string>[] = [];
  const pflichtig = e.einnahmen_netto_cent - e.einnahmen_steuerfrei_cent;
  if (ku) {
    // ohne „(netto)“: bei Kleinunternehmern gibt es keine Umsatzsteuer, der Betrag ist der Rechnungsbetrag. Nicht steuerbare
    // Umsätze (Ausland) als eigene Zeile – in der Anlage EÜR die „davon“-Zeile zur Kleinunternehmer-Zeile
    const ns = e.einnahmen_nicht_steuerbar_cent;
    if (e.einnahmen_netto_cent - ns) ein.push({ datum: "", text: "Umsätze aus Rechnungen", kategorie: "Umsatzsteuerlicher Kleinunternehmer", betrag: betrag(e.einnahmen_netto_cent - ns) });
    if (ns) ein.push({ datum: "", text: "Nicht steuerbare Umsätze aus Rechnungen (Leistungen an Unternehmen im Ausland; in der Anlage EÜR „davon“ zur Kleinunternehmer-Zeile)", kategorie: "Nicht steuerbare Umsätze sowie Umsätze nach § 19 Absatz 3 Satz 1 Nummer 1 und 2 UStG", betrag: betrag(ns) });
  } else {
    if (pflichtig) ein.push({ datum: "", text: "Umsätze aus Rechnungen (netto)", kategorie: EUER_ZEILE_STEUERPFLICHTIG, betrag: betrag(pflichtig) });
    // ohne Beispiel: die Zeile sammelt igL, § 13b-Umsätze und Steuerbefreiungen (z. B. Heilbehandlungen)
    if (e.einnahmen_steuerfrei_cent) ein.push({ datum: "", text: "Steuerfreie und nicht steuerbare Umsätze aus Rechnungen", kategorie: EUER_ZEILE_STEUERFREI, betrag: betrag(e.einnahmen_steuerfrei_cent) });
  }
  if (e.ust_vereinnahmt_cent) ein.push({ datum: "", text: "Vereinnahmte Umsatzsteuer", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: betrag(e.ust_vereinnahmt_cent) });
  const aus: Record<string, string>[] = e.ausgaben.zeilen.map((z) => ({ datum: "", text: `${z.kategorie.titel} (${z.anzahl} ${z.anzahl === 1 ? "Beleg" : "Belege"})`, kategorie: z.kategorie.euer, betrag: betrag(z.netto_cent) }));
  // Gutschriften (bezahlt im Jahr) sind Ausgaben: bezogene Leistungen; ausgewiesene Steuer des Leistenden als Vorsteuer, außer als Kleinunternehmer
  const gs = gutschriftAusgaben(s, jahr);
  const betriebKu = istKleinunternehmer(s);
  if (gs.netto || gs.ust) aus.push({ datum: "", text: `Gutschriften an Leistende (${gs.anzahl} ${gs.anzahl === 1 ? "Gutschrift" : "Gutschriften"})`, kategorie: "Bezogene Leistungen", betrag: betrag(betriebKu ? gs.netto + gs.ust : gs.netto) });
  const vorsteuer = e.ausgaben.vorsteuer_cent + (betriebKu ? 0 : gs.ust);
  if (vorsteuer) aus.push({ datum: "", text: gs.ust && !betriebKu ? "Gezahlte Vorsteuer aus Belegen und Gutschriften" : "Gezahlte Vorsteuer aus Belegen", kategorie: "Gezahlte Vorsteuerbeträge", betrag: betrag(vorsteuer) });
  const imJahr = gestellteRechnungen(s).filter((u) => String(u.daten.datum).startsWith(`${jahr}-`));
  const gutschriften = imJahr.filter(istGutschrift).length;
  const lage = kassenLage(s.profil);
  const hinweis = [kapitalgesellschaft(s) ? EUER_KAPITALGESELLSCHAFT : "", gutschriften ? GUTSCHRIFT_HINWEIS : "", EUER_NICHT_ENTHALTEN, lage === "shop" || lage === "kasse_shop" ? EUER_SHOP_NICHT_ENTHALTEN : ""].filter(Boolean).join(" ");
  return {
    einnahmen: ein,
    ausgaben: aus,
    anlagen: e.ausgaben.anlagen.length,
    rechnungen: e.anzahl_einnahmen,
    belege: s.belege.filter((b) => zahltag(b).startsWith(`${jahr}-`)).length,
    unbezahlt: imJahr.filter((u) => !u.bezahlt && !u.storniertDurch && !istStorno(u) && !istGutschrift(u)).length,
    gutschriften,
    hinweis,
  };
}

// ---------------------------------------------------------------- Steuerberater-Paket

export interface Zeitraum {
  von: string;
  bis: string;
  /** für Dateinamen und Anzeige, z. B. „2026“, „2026-Q3“, „2026-10“ */
  name: string;
}

export interface Steuerberatung {
  kontenrahmen: Kontenrahmen;
  beraternummer: string;
  mandantennummer: string;
}
export const LEERE_STEUERBERATUNG: Steuerberatung = { kontenrahmen: "SKR03", beraternummer: "", mandantennummer: "" };

const imZeitraum = (iso: string, z: Zeitraum) => iso >= z.von && iso <= z.bis;
/** Ganzes Kalenderjahr (Jahrespaket) – dann enthält es dieselben Buchungen wie die Monats-/Quartalspakete */
const istJahr = (z: Zeitraum) => z.von.slice(5) === "01-01" && z.bis.slice(5) === "12-31" && z.von.slice(0, 4) === z.bis.slice(0, 4);
// Text, den Excel als Formel lesen würde (=, +, @, - ohne Zahl), bekommt ein Hochkomma davor; Beträge wie „-12,50“ bleiben
const entschaerft = (s: string) => (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-[\d.,]+$/.test(s)) ? `'${s}` : s);
const csvFeld = (roh: string) => {
  const s = entschaerft(roh);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (kopf: string[], zeilen: string[][]) => "﻿" + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(";")).join("\r\n") + "\r\n";
/** Teil eines Dateinamens im Paket: Umlaute umgeschrieben („Söhne“ → „Soehne“), höchstens 60 Zeichen */
const sicher = (s: string) => dateinamenTeil(s, 60, "._-") || "ohne-name";
/** Nummern wie „2026-002“ und „2026-010“ in natürlicher Reihenfolge */
const nachNummer = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true });

const STEUERART_TEXT: Record<NonNullable<RechnungsDaten["steuerart"]>, string> = { standard: "Standard", igl: "igL", reverse_charge: "Reverse Charge", befreit: "befreit", nullsatz: "Nullsteuersatz (§ 12 Abs. 3 UStG)" };
/** Steuerart einer Rechnung für die Listen: Standard, igL, Reverse Charge, § 19 oder befreit */
const steuerartText = (d: RechnungsDaten) => (d.kleinunternehmer ? "§ 19" : STEUERART_TEXT[d.steuerart ?? "standard"]);

/** Dateiname der Belegdatei im Paket: AmtlosNr_Datum_Lieferant_Nummer.endung (Nummer normalisiert wie in DATEV und Belegliste) */
export const belegDateiname = (b: Beleg, amtlosNr = "") => {
  const nr = belegnummerNormal(b.nummer);
  return `${amtlosNr ? `${amtlosNr}_` : ""}${b.datum}_${sicher(b.lieferant)}${nr ? `_${nr}` : ""}.${(b.datei ?? "").split(".").pop() || "bin"}`;
};

/** Dateiname des Rechnungs-PDFs im Paket: Nummer_Kunde.pdf */
export const rechnungDateiname = (nummer: string, kunde: string) => `${sicher(nummer)}_${dateinamenTeil(kunde, 40, "._-") || "ohne-name"}.pdf`;

/** Offener Betrag einer Rechnung zum Stichtag: ohne Zahlungseingang bis dahin, nicht storniert, keine Stornorechnung. */
function offenAm(s: Stand, u: Unterlage, bis: string, brutto: number): number {
  if (istStorno(u) || (u.bezahlt && u.bezahlt <= bis)) return 0;
  const storno = u.storniertDurch ? s.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
  if (storno && String(storno.daten.datum) <= bis) return 0;
  return brutto;
}

/** Leistungszeitraum, wie in der Rechnung eingetragen – nur wenn er nicht schon als Leistungsdatum dasteht. */
function leistungszeitraum(u: Unterlage, leistungsdatum: string | null | undefined): string {
  if (u.daten.leistung_gleich === true) return "";
  const t = typeof u.daten.leistung === "string" ? u.daten.leistung.replace(/\s+/g, " ").trim() : "";
  return leistungsdatum && t === datumDe(leistungsdatum) ? "" : t;
}

/**
 * Rechnungsliste (ohne Gutschriften) bzw. mit `gutschriften` die Liste der Gutschriften – gleiche Spalten. Sortiert nach
 * Datum und Nummer; am Ende Summenzeilen je Steuersatz („Summe 19 %“ …) und „Summe gesamt“. Mit `pdfs` (Rechnungs-ID →
 * Dateiname im Paket) zusätzlich die Spalte „Datei“.
 */
export function rechnungenCsv(s: Stand, z: Zeitraum, gutschriften = false, pdfs?: Map<string, string>): string {
  const summe = new Map<string, { netto: number; ust: number; brutto: number }>();
  let offenGesamt = 0;
  const zeilen = gestellteRechnungen(s)
    .filter((u) => istGutschrift(u) === gutschriften && imZeitraum(String(u.daten.datum), z))
    .sort((a, b) => String(a.daten.datum).localeCompare(String(b.daten.datum)) || nachNummer(String(a.daten.nummer ?? ""), String(b.daten.nummer ?? "")))
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, s.betrieb);
      const sm = summen(daten.positionen, daten.kleinunternehmer);
      const vz = istStorno(u) ? -1 : 1;
      const art = steuerartText(daten);
      for (const g of sm.gruppen) {
        const schluessel = g.satz === null ? "§ 19" : `${g.satz} %${g.satz === 0 && art !== "Standard" ? ` (${art})` : ""}`;
        const w = summe.get(schluessel) ?? { netto: 0, ust: 0, brutto: 0 };
        w.netto += vz * g.netto_cent;
        w.ust += vz * g.ust_cent;
        w.brutto += vz * (g.netto_cent + g.ust_cent);
        summe.set(schluessel, w);
      }
      const offen = offenAm(s, u, z.bis, vz * sm.brutto_cent);
      offenGesamt += offen;
      const saetze = sm.gruppen.map((g) => (g.satz === null ? "§ 19" : `${g.satz} %`)).join(", ");
      return [
        daten.nummer,
        datumDe(daten.rechnungsdatum),
        daten.leistungsdatum ? datumDe(daten.leistungsdatum) : "",
        leistungszeitraum(u, daten.leistungsdatum),
        daten.kunde.name,
        daten.kunde.ust_idnr ?? "",
        art,
        betrag(vz * sm.netto_cent),
        betrag(vz * sm.ust_cent),
        betrag(vz * sm.brutto_cent),
        saetze,
        daten.faellig_am && !istStorno(u) ? datumDe(daten.faellig_am) : "",
        u.bezahlt ? datumDe(u.bezahlt) : "",
        betrag(offen),
        istStorno(u) ? String(u.daten.storno_zu) : "",
        ...(pdfs ? [pdfs.get(u.id) ?? ""] : []),
      ];
    });
  const leer = (n: number) => new Array<string>(n).fill("");
  const breite = 15 + (pdfs ? 1 : 0);
  const summenZeile = (titel: string, satz: string, w: { netto: number; ust: number; brutto: number }, offen = "") => {
    const r = leer(breite);
    r[0] = titel;
    r[7] = betrag(w.netto);
    r[8] = betrag(w.ust);
    r[9] = betrag(w.brutto);
    r[10] = satz;
    r[13] = offen;
    return r;
  };
  const gesamt = { netto: 0, ust: 0, brutto: 0 };
  const summenZeilen = [...summe]
    .sort(([a], [b]) => nachNummer(b, a))
    .map(([satz, w]) => {
      gesamt.netto += w.netto;
      gesamt.ust += w.ust;
      gesamt.brutto += w.brutto;
      return summenZeile(`Summe ${satz}`, satz, w);
    });
  if (zeilen.length) summenZeilen.push(summenZeile("Summe gesamt", "", gesamt, betrag(offenGesamt)));
  return csv(
    [
      "Nummer",
      "Datum",
      "Leistungsdatum",
      "Leistungszeitraum",
      gutschriften ? "Leistender (Empfänger der Gutschrift)" : "Kunde",
      gutschriften ? "USt-IdNr. Leistender" : "USt-IdNr. Kunde",
      "Steuerart",
      "Netto",
      "USt",
      "Brutto",
      "Steuersätze",
      "Fällig am",
      "Bezahlt am",
      `Offener Betrag zum ${datumDe(z.bis)}`,
      "Storno zu",
      ...(pdfs ? ["Datei"] : []),
    ],
    [...zeilen, ...summenZeilen],
  );
}

/** Belege des Zeitraums nach Belegdatum, bei gleichem Datum in der Reihenfolge der Erfassung. */
const belegeImZeitraum = (s: Stand, z: Zeitraum) => s.belege.filter((b) => imZeitraum(b.datum, z)).sort((a, b) => a.datum.localeCompare(b.datum) || a.erstellt.localeCompare(b.erstellt) || a.id.localeCompare(b.id));

/** Belegkategorien, bei denen ein Beleg ohne Umsatzsteuer auf § 13b UStG hindeuten kann (Frage im Paket). */
const STEUERSCHULD_KATEGORIEN = ["waren", "fremdleistungen", "buero", "werbung", "sonstiges"];

/** Hinweis in der Belegliste, wenn der Zahltag fehlt und die EÜR das Belegdatum nimmt */
export const ZAHLTAG_FEHLT = "fehlt – Belegdatum verwendet";

/**
 * Belegliste mit Amtlos-Belegnummer, Belegfeld 1 wie im DATEV-Stapel, Aufwandskonto, Zahltag (für die EÜR) und einer
 * Summenzeile am Ende. `nummern` aus `belegNummern([...s.belege, ...s.belegArchiv])` – ohne Angabe selbst abgeleitet.
 */
export function belegeCsv(s: Stand, z: Zeitraum, dateinamen: Map<string, string> = new Map(), kontenrahmen: Kontenrahmen = s.steuerberatung.kontenrahmen, nummern: Map<string, string> = belegNummern([...s.belege, ...s.belegArchiv])): string {
  const summe = { netto: 0, ust: 0, vorsteuer: 0, brutto: 0 };
  const zeilen = belegeImZeitraum(s, z).map((b) => {
    const sm = belegSummen(b);
    summe.netto += sm.netto_cent;
    summe.ust += sm.ust_cent;
    summe.vorsteuer += sm.vorsteuer_cent;
    summe.brutto += sm.brutto_cent;
    const kat = kategorieFuer(b.kategorie);
    const konten = kontenrahmen === "SKR03" ? kat.skr03 : kat.skr04;
    // dasselbe Konto wie im Stapel (auch § 13b-Konten); Belege, die nicht in den Stapel gehen, mit Vermerk
    const imStapel = belegImStapel(b, { kapitalgesellschaft: kapitalgesellschaft(s) });
    const gebucht = buchungenAusBelegen([b], kontenrahmen).map((x) => x.konto);
    const konto = [...new Set(gebucht.length ? gebucht : b.steuer.filter((x) => x.brutto_cent).map((x) => konten[x.satz] ?? konten[19] ?? ""))].join(", ");
    const nr = nummern.get(b.id) ?? "";
    return [
      nr,
      datumDe(b.datum),
      b.lieferant,
      belegnummerNormal(b.nummer),
      belegKennung(b, nr),
      kat.titel,
      kat.euer,
      konto,
      betrag(sm.netto_cent),
      betrag(sm.ust_cent),
      betrag(sm.vorsteuer_cent),
      betrag(sm.brutto_cent),
      b.steuer.map((x) => `${x.satz} %`).join(", "),
      ZAHLUNGSWEGE.find((w) => w.wert === b.zahlung)?.text ?? b.zahlung,
      b.bezahlt ? datumDe(b.bezahlt) : `${datumDe(b.datum)} (${ZAHLTAG_FEHLT})`,
      dateinamen.get(b.id) ?? "",
      (b.notiz ?? "").replace(/\s+/g, " "),
      b.steuerschuld ? `§ 13b (${b.steuerschuld === "eu" ? "sonstige Leistung EU" : "Bauleistung Inland"}), Steuer ${betrag(steuerschuldBetrag(b))}` : "",
      imStapel ? "ja" : b.kategorie === "personal" ? "nein – Lohnbuchhaltung" : "nein – Gesellschafter-Verrechnung",
    ];
  });
  const summenZeile = ["Summe", "", "", "", "", "", "", "", betrag(summe.netto), betrag(summe.ust), betrag(summe.vorsteuer), betrag(summe.brutto), "", "", "", "", "", "", ""];
  return csv(
    ["Amtlos-Belegnr.", "Datum", "Lieferant", "Belegnummer (Lieferant)", "Belegfeld 1 (DATEV)", "Kategorie", "Zeile Anlage EÜR", "Konto (DATEV)", "Netto", "USt", "Vorsteuer", "Brutto", "Steuersätze", "Zahlung", "Zahltag (für EÜR verwendet)", "Datei", "Notiz", "Steuerschuldnerschaft", "Im Buchungsstapel"],
    zeilen.length ? [...zeilen, summenZeile] : [],
  );
}

/** Grund, warum eine Rechnung keine E-Rechnung im Paket hat – Privatkunde (nur die E-Mail fehlt) oder fehlende Angaben. */
export function grundOhneXml(fehlt: string[], kundeUstId: string | null | undefined): string {
  if (fehlt.length === 1 && fehlt[0] === "E-Mail des Empfängers" && !kundeUstId) return "Privatkunde (ohne E-Mail erfasst) – keine E-Rechnung nötig; falls Unternehmen: E-Mail ergänzen";
  return `Angaben fehlen: ${fehlt.join(", ")}`;
}

/**
 * Fragen an den Betrieb, die sich aus den Daten ergeben – nur Sachverhalte, keine steuerliche Bewertung. Abschnitte ohne
 * Einträge entfallen; ohne Fragen ein Satz „Keine offenen Punkte“.
 */
export function fragenText(s: Stand, z: Zeitraum, nummern: Map<string, string> = belegNummern([...s.belege, ...s.belegArchiv])): { text: string; anzahl: number } {
  const belege = belegeImZeitraum(s, z);
  const bz = (b: Beleg, zusatz = "") => `- ${nummern.get(b.id) ?? ""} · ${datumDe(b.datum)} · ${b.lieferant.trim() || "ohne Lieferant"} · ${betrag(belegSummen(b).brutto_cent)} € brutto${b.notiz ? ` · Notiz: ${b.notiz.replace(/\s+/g, " ").trim()}` : ""}${zusatz}`;
  const rz = (u: Unterlage, zusatz = "") => {
    const { daten } = eRechnungAus(u.daten, s.betrieb);
    const sm = summen(daten.positionen, daten.kleinunternehmer);
    return `- ${daten.nummer} · ${datumDe(daten.rechnungsdatum)} · ${daten.kunde.name || "ohne Namen"} · ${betrag((istStorno(u) ? -1 : 1) * sm.brutto_cent)} € brutto${zusatz}`;
  };
  const abschnitte: { titel: string; zeilen: string[] }[] = [];
  const dazu = (titel: string, zeilen: string[]) => zeilen.length && abschnitte.push({ titel, zeilen });

  dazu("Belege mit Zahlungsweg Überweisung/Karte ohne Zahltag – für die EÜR wurde das Belegdatum verwendet. Wann wurde bezahlt?", belege.filter((b) => b.zahlung === "bank" && !b.bezahlt).map((b) => bz(b)));
  dazu("Belege ohne Belegnummer des Lieferanten – im Buchungsstapel steht die Amtlos-Belegnummer. Hat der Beleg eine Nummer?", belege.filter((b) => !belegnummerNormal(b.nummer)).map((b) => bz(b)));
  const offen = gestellteRechnungen(s)
    .filter((u) => !istGutschrift(u) && String(u.daten.datum) <= z.bis)
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, s.betrieb);
      return { u, daten, offen: offenAm(s, u, z.bis, summen(daten.positionen, daten.kleinunternehmer).brutto_cent) };
    })
    .filter((x) => x.offen)
    .sort((a, b) => a.daten.rechnungsdatum.localeCompare(b.daten.rechnungsdatum) || nachNummer(a.daten.nummer, b.daten.nummer));
  dazu(
    `Rechnungen ohne vermerkten Zahlungseingang zum ${datumDe(z.bis)}:`,
    offen.map((x) => rz(x.u, `${x.daten.faellig_am ? ` · fällig ${datumDe(x.daten.faellig_am)}` : ""}${x.u.bezahlt ? ` · bezahlt erst am ${datumDe(x.u.bezahlt)}` : ""}${x.daten.rechnungsdatum < z.von ? " · aus früherem Zeitraum" : ""}`)),
  );
  dazu(
    kapitalgesellschaft(s) ? "Privat ausgelegte Belege (Kapitalgesellschaft – nicht im Buchungsstapel, da es keine Privatkonten gibt): Wer hat ausgelegt, auf welches Verrechnungskonto?" : "Privat bezahlte Belege (Zahlungsweg „privat bezahlt“):",
    belege.filter((b) => b.zahlung === "privat").map((b) => bz(b)),
  );
  dazu("Kfz-Kosten: Fahrzeug und privater Anteil?", belege.filter((b) => b.kategorie === "fahrzeug").map((b) => bz(b)));
  dazu("Bewirtung: Anlass und Teilnehmer?", belege.filter((b) => b.kategorie === "bewirtung").map((b) => bz(b)));
  dazu(
    "Anschaffungen über 800 € netto: Was wurde angeschafft, Nutzungsdauer? (Computerhardware und Software: auch 1 Jahr möglich, BMF 22.02.2022)",
    // Kategorie „Anschaffung über 800 €“ oder als GWG erfasst, aber über 800 € netto
    belege.filter((b) => kategorieFuer(b.kategorie).anlage || (b.kategorie === "gwg" && belegSummen(b).netto_cent > 80000)).map((b) => bz(b, ` · ${betrag(belegSummen(b).netto_cent)} € netto · Kategorie „${kategorieFuer(b.kategorie).titel}“`)),
  );
  dazu(
    "Gutschriften (der Betrieb rechnet als Leistungsempfänger ab; im Stapel als Aufwand „bezogene Leistungen“). Art der Leistung – passt das Konto?",
    gestellteRechnungen(s).filter((u) => istGutschrift(u) && imZeitraum(String(u.daten.datum), z)).map((u) => rz(u, u.bezahlt ? ` · bezahlt am ${datumDe(u.bezahlt)}` : " · ohne Zahlungsvermerk")),
  );
  const stornoZeilen: string[] = [];
  for (const u of gestellteRechnungen(s)) {
    const datum = String(u.daten.datum);
    if (istStorno(u) && imZeitraum(datum, z)) {
      const orig = typeof u.daten.storno_zu_datum === "string" ? u.daten.storno_zu_datum : "";
      if (orig && !imZeitraum(orig, z)) stornoZeilen.push(rz(u, ` · storniert RE ${String(u.daten.storno_zu)} vom ${datumDe(orig)} (anderer Zeitraum)`));
    } else if (!istStorno(u) && u.storniertDurch && imZeitraum(datum, z)) {
      const st = s.unterlagen.find((x) => x.id === u.storniertDurch);
      const sd = st && typeof st.daten.datum === "string" ? st.daten.datum : "";
      if (st?.festgeschrieben && sd && !imZeitraum(sd, z)) stornoZeilen.push(rz(u, ` · storniert durch ${String(st.daten.nummer ?? "")} vom ${datumDe(sd)} (anderer Zeitraum)`));
    }
  }
  dazu("Stornos mit Bezug zu einem anderen Zeitraum – gibt es eine Ersatzrechnung, und in welchem Zeitraum?", stornoZeilen);
  // steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8–29 UStG) und Belege mit Vorsteuer: abziehbar nur, soweit sie nicht diesen Umsätzen dienen
  const kz48 = umsatzRechnungen(s).some((u) => {
    if (!imZeitraum(String(u.daten.datum), z)) return false;
    const { daten } = eRechnungAus(u.daten, s.betrieb);
    return daten.steuerart === "befreit" && kennzahlBefreiung(daten.befreiungsgrund) === "48";
  });
  if (kz48) dazu(`${VORSTEUER_AUFTEILEN} Belege mit Vorsteuer im Zeitraum – wofür werden sie verwendet?`, belege.filter((b) => belegSummen(b).vorsteuer_cent > 0).map((b) => bz(b, ` · Vorsteuer ${betrag(belegSummen(b).vorsteuer_cent)} €`)));
  // Belege ohne Umsatzsteuer für Leistungen, bei denen der Empfänger die Steuer schulden kann (Subunternehmer, ausländische Anbieter)
  dazu(
    "Belege ohne Umsatzsteuer (Waren, Fremdleistungen, Büro/Software, Werbung, Sonstiges): Schuldet der Betrieb die Umsatzsteuer als Leistungsempfänger (§ 13b UStG, z. B. Bauleistung eines Subunternehmers oder Leistung eines Unternehmens aus dem Ausland)?",
    belege.filter((b) => !b.steuerschuld && STEUERSCHULD_KATEGORIEN.includes(b.kategorie) && b.steuer.some((x) => x.brutto_cent) && b.steuer.every((x) => !x.brutto_cent || x.satz === 0)).map((b) => bz(b)),
  );
  // als § 13b erfasst: Konto steht im Stapel nur für SKR03 fest (3120/3123), Kleinunternehmer ohne Vorsteuer
  dazu(
    `Belege mit Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) – Kz 46/47 bzw. 84/85${istKleinunternehmer(s) ? " (Kleinunternehmer: ohne Vorsteuerabzug)" : ", Vorsteuer Kz 67"}. Bitte Art der Leistung und Konto prüfen:`,
    belege.filter((b) => b.steuerschuld).map((b) => bz(b, ` · ${b.steuerschuld === "eu" ? "sonstige Leistung EU" : "Bauleistung Inland"} · Steuer ${betrag(steuerschuldBetrag(b))} €`)),
  );

  const anzahl = abschnitte.reduce((a, x) => a + x.zeilen.length, 0);
  const text = [
    `Amtlos – Fragen zum Zeitraum ${datumDe(z.von)} bis ${datumDe(z.bis)}`,
    `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
    ``,
    `Automatisch aus den erfassten Daten zusammengestellt: nur Sachverhalte, keine steuerliche Bewertung. Belege mit Amtlos-Belegnummer (wie in Belege_${z.name}.csv und im Dateinamen unter Belege/).`,
    // Kasse/Shop: steht einmal im LIESMICH unter „Wichtig“ (R10 – nicht doppelt)
    ...(abschnitte.length ? abschnitte.flatMap((a) => ["", a.titel, ...a.zeilen]) : ["", "Keine offenen Punkte gefunden."]),
  ].join("\r\n");
  return { text: text + "\r\n", anzahl };
}

export interface PaketErgebnis {
  zip: Uint8Array;
  dateiname: string;
  rechnungen: number;
  /** Gutschriften im Zeitraum – eigene Liste, nicht als Erlös gebucht */
  gutschriften: number;
  belege: number;
  /** Rechnungen, für die keine E-Rechnung erzeugt werden konnte (Angaben fehlen oder Privatkunde) */
  ohneXml: number;
  buchungen: number;
  /** Einträge in Fragen_<Zeitraum>.txt */
  fragen: number;
  /** Rechnungs-PDFs im Paket (nur mit `rechnungsPdfs`) */
  pdfs: number;
}

export interface PaketOptionen {
  /**
   * PDFs der Rechnungen und Gutschriften des Zeitraums, Schlüssel = ID der Unterlage. Sie entstehen auf dem Gerät
   * (expo-print) und damit nur asynchron – der Aufrufer erzeugt sie vorab; fehlt eines, bleibt die Spalte „Datei“ leer.
   */
  rechnungsPdfs?: Record<string, Uint8Array>;
}

const ja = (b: boolean) => (b ? "ja" : "nein");

/**
 * ZIP des Pakets (R9 Performance): Fotos, PDFs und andere schon komprimierte Dateien unkomprimiert ablegen (Level 0) –
 * sie werden mit Level 6 kaum kleiner, das Komprimieren kostete aber rund 90 % der Zeit. Texte (CSV, XML, TXT) wie
 * bisher mit Level 6. Der Inhalt des ZIP bleibt derselbe.
 */
const SCHON_KOMPRIMIERT = /\.(jpe?g|png|heic|heif|webp|gif|pdf|zip)$/i;
export function paketZippen(inhalt: Record<string, Uint8Array>): Uint8Array {
  const z: Zippable = {};
  for (const [name, bytes] of Object.entries(inhalt)) z[name] = SCHON_KOMPRIMIERT.test(name) ? [bytes, { level: 0 }] : [bytes, { level: 6 }];
  return zipSync(z);
}

/**
 * Das Paket für die Steuerberatung. `dateien` liefert die Bytes einer Belegdatei (verschlüsselt abgelegt, vom Aufrufer
 * entschlüsselt). `jetzt` als ISO-Zeitpunkt für den DATEV-Kopf. Mit `o.rechnungsPdfs` kommen die Rechnungs-PDFs dazu.
 */
export function steuerpaket(s: Stand, z: Zeitraum, sb: Steuerberatung, dateien: Record<string, Uint8Array>, jetzt: string, o: PaketOptionen = {}): PaketErgebnis {
  const alle = gestellteRechnungen(s)
    .filter((u) => imZeitraum(String(u.daten.datum), z))
    .sort((a, b) => String(a.daten.datum).localeCompare(String(b.daten.datum)) || nachNummer(String(a.daten.nummer ?? ""), String(b.daten.nummer ?? "")));
  // Gutschriften sind Ausgaben des Betriebs: nicht in Rechnungsliste und Erlösbuchungen, sondern in einer eigenen Liste
  const rechnungen = alle.filter((u) => !istGutschrift(u));
  const gutschriften = alle.filter(istGutschrift);
  // Kleinunternehmer je Zeitraum: die Rechnungen des Zeitraums entscheiden, sonst der Pflichten-Check (Lea, Befund 4)
  const profilKu = s.profil["ust.kleinunternehmer"];
  const ku = kuImZeitraum(rechnungen, typeof profilKu === "boolean" ? profilKu : undefined) ?? istKleinunternehmer(s);
  const ist = s.betrieb.versteuerung === "ist";
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  const belege = belegeImZeitraum(s, z);
  const kapital = kapitalgesellschaft(s);
  const tage = zuordnungsTage(s.unterlagen, s.betrieb, ist ? "ist" : "soll");
  // Gutschriften gehen als Aufwand in den Stapel (R10), Rechnungen als Erlös
  const buchungen = [...buchungenAusRechnungen(alle.map((u) => rechnungFuerBuchung(u, s.betrieb, { tage, betriebKu: ku })), sb.kontenrahmen), ...buchungenAusBelegen(belege, sb.kontenrahmen, { nummern, kapitalgesellschaft: kapital })].sort((a, b) => a.datum.localeCompare(b.datum));
  const nichtImStapel = belege.filter((b) => !belegImStapel(b, { kapitalgesellschaft: kapital }));
  const mit13b = belege.filter((b) => b.steuerschuld).length;
  const rechtsform = rechtsformFuer(s);
  const dfv = s.profil["ust.dauerfristverlaengerung"] === true;
  const inhalt: Record<string, Uint8Array> = {};
  inhalt[`EXTF_Buchungsstapel_${z.name}.csv`] = datevExtfBytes(datevExtf(buchungen, { beraternummer: sb.beraternummer, mandantennummer: sb.mandantennummer, wjBeginn: `${z.von.slice(0, 4)}-01-01`, von: z.von, bis: z.bis, kontenrahmen: sb.kontenrahmen, bezeichnung: `Amtlos ${z.name}`, erzeugtAm: jetzt }));
  inhalt[`Buchungsliste_${z.name}.csv`] = utf8(buchungslisteCsv(buchungen));
  // Rechnungs-PDFs (vom Aufrufer erzeugt): Rechnungen/<Nummer>_<Kunde>.pdf, dieselben Namen in der Spalte „Datei“
  const pdfs = o.rechnungsPdfs ? new Map<string, string>() : undefined;
  if (o.rechnungsPdfs && pdfs) {
    for (const u of alle) {
      const bytes = o.rechnungsPdfs[u.id];
      if (!bytes) continue;
      const basis = rechnungDateiname(String(u.daten.nummer ?? ""), String(u.daten.kunde_name ?? ""));
      let name = basis;
      for (let i = 2; inhalt[`Rechnungen/${name}`]; i++) name = basis.replace(/\.pdf$/, `_${i}.pdf`);
      inhalt[`Rechnungen/${name}`] = bytes;
      pdfs.set(u.id, name);
    }
  }
  inhalt[`Rechnungen_${z.name}.csv`] = utf8(rechnungenCsv(s, z, false, pdfs));
  if (gutschriften.length) inhalt[`Gutschriften_${z.name}.csv`] = utf8(rechnungenCsv(s, z, true, pdfs));
  // Dateinamen einmal vergeben (doppelte durchnummeriert) – dieselben stehen in der Belegliste
  const dateinamen = new Map<string, string>();
  const vergeben = new Set<string>();
  for (const b of belege) {
    if (!b.datei || !dateien[b.datei]) continue;
    const basis = belegDateiname(b, nummern.get(b.id));
    let name = basis;
    for (let i = 2; vergeben.has(name); i++) name = basis.replace(/(\.\w+)$/, `_${i}$1`);
    vergeben.add(name);
    dateinamen.set(b.id, name);
    inhalt[`Belege/${name}`] = dateien[b.datei]!;
  }
  inhalt[`Belege_${z.name}.csv`] = utf8(belegeCsv(s, z, dateinamen, sb.kontenrahmen, nummern));
  const fragen = fragenText(s, z, nummern);
  inhalt[`Fragen_${z.name}.txt`] = utf8(fragen.text);
  const ohneXmlListe: string[] = [];
  for (const u of alle) {
    const { daten, fehlt } = eRechnungAus(u.daten, s.betrieb);
    if (fehlt.length) {
      ohneXmlListe.push(`- ${daten.nummer || "ohne Nummer"} (${daten.kunde.name || "ohne Namen"}): ${grundOhneXml(fehlt, daten.kunde.ust_idnr)}`);
      continue;
    }
    let pfad = `E-Rechnungen/${sicher(daten.nummer)}.xml`;
    for (let i = 2; inhalt[pfad]; i++) pfad = `E-Rechnungen/${sicher(daten.nummer)}_${i}.xml`; // „2026/001“ und „2026-001“
    inhalt[pfad] = utf8(xrechnungUbl(daten, KU_HINWEIS));
  }
  const ohneXml = ohneXmlListe.length;
  const versteuerung = s.betrieb.versteuerung === "ist" ? "Ist (vereinnahmte Entgelte, § 20 UStG)" : s.betrieb.versteuerung === "soll" ? "Soll (vereinbarte Entgelte)" : "nicht angegeben (Soll angenommen)";
  const uhrzeit = /T(\d{2}):(\d{2})/.exec(jetzt);
  const kassenSatz = kassenSatzPaket(kassenLage(s.profil));
  // „Wichtig“: an fester Stelle direkt nach den Mandantendaten, jeder Punkt nur einmal (R10)
  const wichtig = [
    ...(kassenSatz ? kassenSatz.split("\r\n") : []),
    ...(nichtImStapel.length ? [`${nichtImStapel.length} ${nichtImStapel.length === 1 ? "Beleg steht" : "Belege stehen"} nur in der Belegliste, nicht im Buchungsstapel: Personal (Lohn bucht die Lohnbuchhaltung)${kapital ? " und privat ausgelegte Belege der Gesellschaft (Verrechnungskonto Gesellschafter bitte festlegen)" : ""}.`] : []),
    ...(mit13b ? [`${mit13b} ${mit13b === 1 ? "Beleg" : "Belege"} mit Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)${sb.kontenrahmen === "SKR03" ? " – im Stapel auf 3120 (Bauleistung Inland) bzw. 3123 (sonstige Leistung EU)" : " – im Stapel auf dem Kategorie-Konto ohne Steuer, bitte auf das § 13b-Konto umbuchen"}${ku ? "; Kleinunternehmer: ohne Vorsteuerabzug, bitte Konto prüfen" : ""}.`] : []),
    ...(ku ? [] : [`Nullsteuersatz-Umsätze (§ 12 Abs. 3 UStG, Kz 87) stehen vorerst auf dem Konto für steuerfreie Umsätze (${sb.kontenrahmen === "SKR03" ? "8100" : "4100"}) – bitte bei Bedarf umbuchen.`].filter(() => alle.some((u) => eRechnungAus(u.daten, s.betrieb).daten.steuerart === "nullsatz"))),
  ];
  inhalt["LIESMICH.txt"] = utf8(
    [
      `Amtlos – Unterlagen für die Steuerberatung`,
      `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
      `Zeitraum: ${datumDe(z.von)} bis ${datumDe(z.bis)}`,
      `Erstellt: ${datumDe(jetzt.slice(0, 10))}`,
      ``,
      `Mandant (Angaben aus der App)`,
      `- Name: ${s.betrieb.name.trim() || "nicht angegeben"}`,
      `- Rechtsform: ${rechtsform ? `${rechtsform.text}${rechtsform.ausCheck ? " (laut Pflichten-Check)" : ""}` : "nicht angegeben"}`,
      `- Steuernummer: ${s.betrieb.steuernummer.trim() || "nicht angegeben"}`,
      `- USt-IdNr.: ${s.betrieb.ust_idnr.trim() || "nicht angegeben"}`,
      `- Kleinunternehmer (§ 19 UStG): ${ja(ku)}`,
      `- Versteuerung: ${versteuerung}`,
      ...(ku ? [] : [`- Dauerfristverlängerung (laut Pflichten-Check): ${s.profil["ust.dauerfristverlaengerung"] === undefined ? "nicht angegeben" : ja(dfv)}`]),
      `- Kontenrahmen: ${sb.kontenrahmen}`,
      `- Berater-/Mandantennummer: ${sb.beraternummer || "fehlt"} / ${sb.mandantennummer || "fehlt"}`,
      `- Zeitraum: ${datumDe(z.von)} bis ${datumDe(z.bis)} (${z.name})`,
      `- App: Amtlos ${APP_VERSION}`,
      `- Erstellt am: ${datumDe(jetzt.slice(0, 10))}${uhrzeit ? ` ${uhrzeit[1]}:${uhrzeit[2]} Uhr${/Z$|[+-]00:?00$/.test(jetzt) ? " (UTC)" : ""}` : ""}`,
      ``,
      ...(wichtig.length ? [`Wichtig`, ...wichtig.map((w) => `- ${w}`), ``] : []),
      `Inhalt`,
      `- EXTF_Buchungsstapel_${z.name}.csv: DATEV-Format „Buchungsstapel“ (${sb.kontenrahmen}), ${buchungen.length} Buchungen. Das Format ist noch nicht gegen den DATEV-Leitfaden geprüft – bitte vor dem Import kontrollieren.${sb.beraternummer && sb.mandantennummer ? "" : " Berater- und Mandantennummer fehlen und sind für den Import nötig."}`,
      `- Buchungsliste_${z.name}.csv: dieselben Buchungen zum Lesen (Semikolon, UTF-8), mit stabiler Buchungs-GUID je Buchung.`,
      `- Rechnungen_${z.name}.csv: ${rechnungen.length} gestellte Rechnungen mit Steuerart, Netto, USt, Brutto, Fälligkeit, Zahlungseingang und offenem Betrag; Summen je Steuersatz am Ende.`,
      ...(gutschriften.length ? [`- Gutschriften_${z.name}.csv: ${gutschriften.length} ${gutschriften.length === 1 ? "Gutschrift" : "Gutschriften"}, die der Betrieb als Leistungsempfänger ausgestellt hat – nicht in der Rechnungsliste; im Buchungsstapel als Aufwand (bezogene Leistungen).`] : []),
      `- Belege_${z.name}.csv: ${belege.length} Belege mit Amtlos-Belegnummer, Kategorie, Konto, Vorsteuer und Zahltag; Summe am Ende.`,
      `- Fragen_${z.name}.txt: ${fragen.anzahl ? `${fragen.anzahl} ${fragen.anzahl === 1 ? "Punkt" : "Punkte"} zum Klären (nur Sachverhalte aus den Daten)` : "keine offenen Punkte gefunden"}.`,
      `- E-Rechnungen/: XRechnung der Ausgangsrechnungen${gutschriften.length ? " und Gutschriften" : ""}${ohneXml ? ` (${ohneXml} ohne, siehe unten)` : ""}.`,
      ...(pdfs ? [`- Rechnungen/: PDFs der Rechnungen${gutschriften.length ? " und Gutschriften" : ""} (${pdfs.size}), Name = Nummer_Kunde.`] : []),
      `- Belege/: Originaldateien (Fotos, PDFs, E-Rechnungen) – unverändert. Der Dateiname beginnt mit der Amtlos-Belegnummer (z. B. B${z.von.slice(0, 4)}-001); im Buchungsstapel steht in Belegfeld 1 die Belegnummer des Lieferanten, ohne sie die Amtlos-Belegnummer – genauso in der Belegliste.`,
      ...(istJahr(z) ? [``, `Jahrespaket: Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren – gleiche Buchungen.`] : []),
      ...(ohneXml ? [``, `Rechnungen ohne E-Rechnung (XRechnung)`, ...ohneXmlListe] : []),
      ``,
      `Nicht enthalten – bitte zusätzlich liefern`,
      // Kassenumsätze: einmal unter „Wichtig“ (R10)
      `- Kontoauszüge – Zahlungen sind nicht gebucht.`,
      `- Privatentnahmen und Privateinlagen (außer privat bezahlten Belegen).`,
      `- An das Finanzamt gezahlte Umsatzsteuer-Vorauszahlungen und Erstattungen.`,
      `- Abschreibungen (AfA) und Anlagenverzeichnis.`,
      `- Lohnjournal bzw. Lohnabrechnungen.`,
      ``,
      `Zuordnung: Rechnungen nach Rechnungsdatum, Belege nach Belegdatum. Im Buchungsstapel stehen bei Rechnungen das Leistungsdatum (Feld „Leistungsdatum“) und der Tag, nach dem die App die Umsatzsteuer zuordnet (Feld „Datum Zuord. Steuerperiode“). Forderungen und Verbindlichkeiten gehen auf die Konten ohne Kontokorrent (${sb.kontenrahmen === "SKR03" ? "1410/1610" : "1210/3310"}).${pdfs ? "" : " Die PDFs der Ausgangsrechnungen liegen beim Betrieb."}`,
      // Kleinunternehmer geben in der Regel keine Voranmeldung ab – dann kein Satz dazu; sonst nach „Mein Betrieb“ (Soll/Ist)
      ...(ku
        ? []
        : [
            ist
              ? `Die Umsatzsteuer-Voranmeldung ordnet Rechnungen dagegen nach dem Zahlungseingang zu (Ist-Versteuerung, § 20 UStG); eine Stornorechnung zählt mit der vermerkten Erstattung – an den Grenzen eines Zeitraums können die Summen dieses Pakets deshalb von der Voranmeldung abweichen.`
              : `Die Umsatzsteuer-Voranmeldung ordnet Rechnungen dagegen nach dem Leistungsdatum zu (Soll-Versteuerung) – an den Grenzen eines Zeitraums können die Summen dieses Pakets deshalb von der Voranmeldung abweichen.`,
          ]),
    ].join("\r\n"),
  );
  return { zip: paketZippen(inhalt), dateiname: `Amtlos-Steuerberatung-${sicher(s.betrieb.name || "Betrieb")}-${z.name}.zip`, rechnungen: rechnungen.length, gutschriften: gutschriften.length, belege: belege.length, ohneXml, buchungen: buchungen.length, fragen: fragen.anzahl, pdfs: pdfs?.size ?? 0 };
}

/** Zeiträume zur Auswahl: aktuelles und letztes Jahr, Quartale und Monate des laufenden Jahres bis heute. */
export function zeitraeume(heute: string): Zeitraum[] {
  const j = Number(heute.slice(0, 4));
  const m = Number(heute.slice(5, 7));
  const ende = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10);
  const zwei = (n: number) => String(n).padStart(2, "0");
  const z: Zeitraum[] = [];
  // laufender und zwei vorherige Monate, über den Jahreswechsel hinweg (im Januar gehört der Dezember dazu)
  for (let i = 0; i < 3; i++) {
    const jahr = m - i >= 1 ? j : j - 1;
    const monat = ((m - i - 1 + 12) % 12) + 1;
    z.push({ von: `${jahr}-${zwei(monat)}-01`, bis: ende(jahr, monat), name: `${jahr}-${zwei(monat)}` });
  }
  // laufendes und drei vorherige Quartale, ebenfalls über den Jahreswechsel (im Januar: Q4 des Vorjahrs)
  const q0 = Math.ceil(m / 3);
  for (let i = 0; i < 4; i++) {
    const jahr = q0 - i >= 1 ? j : j - 1;
    const q = ((q0 - i - 1 + 4) % 4) + 1;
    z.push({ von: `${jahr}-${zwei(q * 3 - 2)}-01`, bis: ende(jahr, q * 3), name: `${jahr}-Q${q}` });
  }
  z.push({ von: `${j}-01-01`, bis: `${j}-12-31`, name: String(j) }, { von: `${j - 1}-01-01`, bis: `${j - 1}-12-31`, name: String(j - 1) });
  return z;
}

/** Vorauswahl: das zuletzt abgeschlossene Quartal – das braucht die Steuerberatung für die Voranmeldung. */
export function standardZeitraum(heute: string): string {
  const j = Number(heute.slice(0, 4));
  const q = Math.ceil(Number(heute.slice(5, 7)) / 3) - 1;
  return q >= 1 ? `${j}-Q${q}` : `${j - 1}-Q4`;
}
