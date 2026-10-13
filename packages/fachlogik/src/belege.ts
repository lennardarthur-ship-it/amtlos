/**
 * Belege und Ausgaben (E-133): reine Funktionen ohne Gerät. Ein Beleg ist eine Eingangsrechnung, ein Kassenbon oder
 * ein Eigenbeleg – mit Bruttobetrag je Steuersatz, Kategorie (Zeile der Anlage EÜR, Konto SKR03/SKR04) und dem Tag der
 * Zahlung (Abfluss, § 11 Abs. 2 EStG). Daraus entstehen die Vorsteuer der Umsatzsteuer-Voranmeldung (Kz 66) und die
 * Betriebsausgaben der EÜR. Fachlich zu prüfen: PRUEFLISTE T-79.
 */
import { rundeCent } from "./rechnung.js";

export type Zahlungsweg = "bank" | "bar" | "privat";
export type BelegQuelle = "hand" | "foto" | "erechnung";

/** Bruttobetrag je Steuersatz – ein Beleg kann mehrere Sätze haben (Restaurant: Speisen 7 %, Getränke 19 %). */
export interface BelegSteuer {
  /** Steuersatz in Prozent: 19, 7 oder 0 */
  satz: number;
  brutto_cent: number;
}

export interface Beleg {
  id: string;
  /** Belegdatum (Rechnungsdatum des Lieferanten), ISO */
  datum: string;
  lieferant: string;
  /** Rechnungs- oder Belegnummer des Lieferanten */
  nummer?: string | null;
  kategorie: string;
  steuer: BelegSteuer[];
  /** Vorsteuer abziehbar (ordnungsgemäße Rechnung mit Steuerausweis liegt vor, § 15 Abs. 1 UStG) */
  vorsteuer: boolean;
  zahlung: Zahlungsweg;
  /** Tag der Zahlung (ISO). Ohne Angabe gilt das Belegdatum. */
  bezahlt?: string | null;
  notiz?: string | null;
  /** Dateiname des Fotos oder der E-Rechnung im Ordner der App */
  datei?: string | null;
  quelle?: BelegQuelle;
  erstellt: string;
  geaendert: string;
}

export interface Kategorie {
  id: string;
  /** in Alltagssprache */
  titel: string;
  /** Zeile der Anlage EÜR (Wortlaut) – fachlich zu prüfen */
  euer: string;
  /** Standardkonten je Steuersatz (Automatikkonten mit Vorsteuer) – fachlich zu prüfen */
  skr03: Record<number, string>;
  skr04: Record<number, string>;
  hinweis?: string;
  /** keine sofortige Betriebsausgabe (Anlagevermögen, Abschreibung) */
  anlage?: boolean;
  /** nur zum Teil abziehbar (Anteil in Prozent) */
  abziehbar?: number;
}

const konto = (k: string) => ({ 19: k, 7: k, 0: k });

/** Kategorien in Alltagssprache mit Zuordnung zur Anlage EÜR und Standardkonten (T-79). */
export const KATEGORIEN: Kategorie[] = [
  { id: "waren", titel: "Waren und Material", euer: "Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten", skr03: { 19: "3400", 7: "3300", 0: "3200" }, skr04: { 19: "5400", 7: "5300", 0: "5200" } },
  { id: "fremdleistungen", titel: "Fremdleistungen", euer: "Bezogene Leistungen", skr03: konto("3100"), skr04: konto("5900") },
  { id: "personal", titel: "Personal (Löhne, Gehälter, Sozialabgaben)", euer: "Ausgaben für eigenes Personal", skr03: konto("4120"), skr04: konto("6020"), hinweis: "ohne Vorsteuer" },
  { id: "miete", titel: "Miete und Nebenkosten", euer: "Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke", skr03: konto("4210"), skr04: konto("6310") },
  { id: "buero", titel: "Büro, Porto, Telefon, Software", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4930"), skr04: konto("6815") },
  { id: "werbung", titel: "Werbung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4600"), skr04: konto("6600") },
  { id: "reise", titel: "Reisekosten", euer: "Übernachtungs- und Reisenebenkosten bei Geschäftsreisen", skr03: konto("4670"), skr04: konto("6670") },
  { id: "bewirtung", titel: "Bewirtung", euer: "Bewirtungsaufwendungen", skr03: konto("4650"), skr04: konto("6640"), abziehbar: 70, hinweis: "70 % abziehbar (§ 4 Abs. 5 Nr. 2 EStG), Bewirtungsbeleg mit Anlass und Teilnehmern" },
  { id: "geschenke", titel: "Geschenke", euer: "Geschenke", skr03: konto("4630"), skr04: konto("6610"), hinweis: "bis 50 € je Person und Jahr abziehbar (§ 4 Abs. 5 Nr. 1 EStG)" },
  { id: "fahrzeug", titel: "Fahrzeug (Kraftstoff, Reparatur, Versicherung)", euer: "Kraftfahrzeugkosten und andere Fahrtkosten", skr03: konto("4530"), skr04: konto("6530") },
  { id: "versicherungen", titel: "Versicherungen und Beiträge", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4360"), skr04: konto("6400"), hinweis: "meist ohne Vorsteuer" },
  { id: "beratung", titel: "Steuerberatung, Rechtsberatung, Buchführung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4950"), skr04: konto("6825") },
  { id: "fortbildung", titel: "Fortbildung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4945"), skr04: konto("6821") },
  { id: "gwg", titel: "Geräte und Ausstattung bis 800 € netto", euer: "Aufwendungen für geringwertige Wirtschaftsgüter nach § 6 Absatz 2 EStG", skr03: konto("4855"), skr04: konto("6260"), hinweis: "sofort abziehbar (§ 6 Abs. 2 EStG)" },
  { id: "anlage", titel: "Anschaffung über 800 € netto (wird abgeschrieben)", euer: "AfA auf unbewegliche Wirtschaftsgüter / bewegliche Wirtschaftsgüter / immaterielle Wirtschaftsgüter", skr03: konto("0420"), skr04: konto("0650"), anlage: true, hinweis: "keine sofortige Betriebsausgabe – Abschreibung über die Nutzungsdauer" },
  { id: "sonstiges", titel: "Sonstiges", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4900"), skr04: konto("6300") },
];

export const kategorieFuer = (id: string): Kategorie => KATEGORIEN.find((k) => k.id === id) ?? KATEGORIEN[KATEGORIEN.length - 1]!;

export const ZAHLUNGSWEGE: { wert: Zahlungsweg; text: string }[] = [
  { wert: "bank", text: "Überweisung oder Karte" },
  { wert: "bar", text: "Bar" },
  { wert: "privat", text: "Privat bezahlt (Einlage)" },
];

export const STEUERSAETZE = [19, 7, 0] as const;

/** Netto und Umsatzsteuer aus einem Bruttobetrag (kaufmännisch gerundet). */
export function ausBrutto(brutto_cent: number, satz: number): { netto_cent: number; ust_cent: number } {
  const netto = rundeCent((brutto_cent * 100) / (100 + satz));
  return { netto_cent: netto, ust_cent: brutto_cent - netto };
}

export interface BelegSummen {
  brutto_cent: number;
  netto_cent: number;
  /** ausgewiesene Umsatzsteuer – als Vorsteuer nur zählbar, wenn `vorsteuer` gesetzt ist */
  ust_cent: number;
  vorsteuer_cent: number;
}

export function belegSummen(b: Pick<Beleg, "steuer" | "vorsteuer">): BelegSummen {
  let brutto = 0;
  let netto = 0;
  let ust = 0;
  for (const s of b.steuer) {
    const a = ausBrutto(s.brutto_cent, s.satz);
    brutto += s.brutto_cent;
    netto += a.netto_cent;
    ust += a.ust_cent;
  }
  return { brutto_cent: brutto, netto_cent: netto, ust_cent: ust, vorsteuer_cent: b.vorsteuer ? ust : 0 };
}

/** Tag, nach dem ein Beleg der EÜR zugeordnet wird: Zahlung (Abfluss), sonst Belegdatum. */
export const zahltag = (b: Pick<Beleg, "datum" | "bezahlt">) => b.bezahlt || b.datum;

/** Vorsteuer eines Zeitraums (nach Belegdatum – die Rechnung liegt vor, § 15 Abs. 1 Nr. 1 UStG; T-79). */
export function vorsteuerFuer(belege: Beleg[], von: string, bis: string): { cent: number; anzahl: number; ohne: number } {
  let cent = 0;
  let anzahl = 0;
  let ohne = 0;
  for (const b of belege) {
    if (b.datum < von || b.datum > bis) continue;
    const s = belegSummen(b);
    if (b.vorsteuer && s.ust_cent) {
      cent += s.ust_cent;
      anzahl++;
    } else if (s.ust_cent) ohne++;
  }
  return { cent, anzahl, ohne };
}

export interface EuerAusgabenZeile {
  kategorie: Kategorie;
  netto_cent: number;
  anzahl: number;
}

/** Betriebsausgaben eines Jahres nach Kategorie – nach Zahltag (§ 11 Abs. 2 EStG), netto; Vorsteuer separat. */
export function ausgabenFuer(belege: Beleg[], jahr: string): { zeilen: EuerAusgabenZeile[]; vorsteuer_cent: number; anlagen: Beleg[]; summe_cent: number } {
  const nach = new Map<string, EuerAusgabenZeile>();
  let vorsteuer = 0;
  const anlagen: Beleg[] = [];
  for (const b of belege) {
    if (!zahltag(b).startsWith(`${jahr}-`)) continue;
    const k = kategorieFuer(b.kategorie);
    const s = belegSummen(b);
    vorsteuer += s.vorsteuer_cent;
    if (k.anlage) {
      anlagen.push(b);
      continue;
    }
    // ohne Vorsteuerabzug ist der Bruttobetrag die Betriebsausgabe
    const betrag = b.vorsteuer ? s.netto_cent : s.brutto_cent;
    const z = nach.get(k.id) ?? { kategorie: k, netto_cent: 0, anzahl: 0 };
    z.netto_cent += betrag;
    z.anzahl++;
    nach.set(k.id, z);
  }
  const zeilen = [...nach.values()].sort((a, b) => b.netto_cent - a.netto_cent);
  return { zeilen, vorsteuer_cent: vorsteuer, anlagen, summe_cent: zeilen.reduce((a, z) => a + z.netto_cent, 0) };
}

export interface Einnahme {
  /** Tag des Zahlungseingangs (Zufluss) */
  tag: string;
  netto_cent: number;
  ust_cent: number;
  /** Stornos negativ */
  kleinunternehmer: boolean;
}

/** EÜR eines Jahres: Einnahmen nach Zufluss (§ 11 Abs. 1 EStG), Ausgaben nach Abfluss; Umsatzsteuer als eigene Zeilen. */
export function euerFuer(einnahmen: Einnahme[], belege: Beleg[], jahr: string) {
  const im = einnahmen.filter((e) => e.tag.startsWith(`${jahr}-`));
  const einnahmen_netto = im.reduce((a, e) => a + e.netto_cent, 0);
  const ust_vereinnahmt = im.reduce((a, e) => a + e.ust_cent, 0);
  const ausgaben = ausgabenFuer(belege, jahr);
  const summe_einnahmen = einnahmen_netto + ust_vereinnahmt;
  const summe_ausgaben = ausgaben.summe_cent + ausgaben.vorsteuer_cent;
  return {
    einnahmen_netto_cent: einnahmen_netto,
    ust_vereinnahmt_cent: ust_vereinnahmt,
    summe_einnahmen_cent: summe_einnahmen,
    ausgaben,
    summe_ausgaben_cent: summe_ausgaben,
    ergebnis_cent: summe_einnahmen - summe_ausgaben,
    anzahl_einnahmen: im.length,
  };
}

/** Gespeicherten Beleg prüfen und bereinigen (unbekannte Felder fallen weg); null, wenn Kernangaben fehlen. */
export function belegAus(roh: unknown): Beleg | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  if (!s("id") || !/^\d{4}-\d{2}-\d{2}$/.test(s("datum"))) return null;
  const steuer = Array.isArray(r.steuer)
    ? (r.steuer as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .map((x) => ({ satz: Number(x.satz), brutto_cent: Number(x.brutto_cent) }))
        .filter((x) => Number.isInteger(x.brutto_cent) && [19, 7, 0].includes(x.satz))
    : [];
  const zahlung = (["bank", "bar", "privat"] as const).find((z) => z === r.zahlung) ?? "bank";
  const quelle = (["hand", "foto", "erechnung"] as const).find((q) => q === r.quelle);
  return {
    id: s("id"),
    datum: s("datum"),
    lieferant: s("lieferant"),
    nummer: s("nummer") || null,
    kategorie: kategorieFuer(s("kategorie")).id,
    steuer,
    vorsteuer: r.vorsteuer === true,
    zahlung,
    bezahlt: /^\d{4}-\d{2}-\d{2}$/.test(s("bezahlt")) ? s("bezahlt") : null,
    notiz: s("notiz") || null,
    datei: s("datei") || null,
    ...(quelle ? { quelle } : {}),
    erstellt: s("erstellt") || s("datum"),
    geaendert: s("geaendert") || s("erstellt") || s("datum"),
  };
}
