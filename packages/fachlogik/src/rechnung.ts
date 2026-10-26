/**
 * Rechnungen ohne Datenbank und ohne PDF (E-120): Summen je Steuersatz, Vollständigkeit für die E-Rechnung und die
 * Zusammenfassung für die Umsatzsteuer-Voranmeldung. Vom Server (packages/server/src/finanzen.ts, apps/api) und vom
 * Demo-Modus der App genutzt.
 */
export { emailGueltig, ibanGueltig, ibanNormal, plzGueltig } from "./pruefen.js";
import type { Steuerart } from "./steuerart.js";
export interface Position {
  bezeichnung: string;
  menge: number;
  einheit: Einheit;
  preis_cent: number; // Nettopreis je Einheit
  ust_satz: number | null; // Prozent; null bei Kleinunternehmern
  /** UN/ECE-Code der Einheit, wenn die Einheit frei eingegeben wurde (App, E-128) – sonst aus `einheit` */
  einheit_code?: string;
  /**
   * R11: Bruttopreis je Einheit, wenn die Rechnung mit Preisen inkl. Umsatzsteuer geschrieben ist (B2C). Dann rechnet
   * `summen` vom Brutto aus: der Bruttobetrag stimmt genau, Netto und Steuer werden je Steuersatz daraus abgeleitet
   * (die Steuer weicht von Netto × Satz höchstens um 1 Cent ab – zulässig nach BR-CO-17). `preis_cent` ist dann der
   * daraus gerundete Nettopreis.
   */
  brutto_cent?: number;
}
export type Einheit = "stueck" | "stunde" | "tag" | "monat" | "pauschal" | "kilogramm";
/** UN/ECE Recommendation 20 – technische Codes für die E-Rechnung */
export const EINHEIT_CODE: Record<Einheit, string> = { stueck: "C62", stunde: "HUR", tag: "DAY", monat: "MON", pauschal: "LS", kilogramm: "KGM" };

/**
 * Hinweis für Kleinunternehmer auf Rechnungen (Server, API, App). Seit 2025 sind die Umsätze steuerfrei; Wortlaut
 * nach den Hinweisen des LfSt Bayern (Stand Januar 2026), E-123.
 */
/** Mehrzahl gängiger Zähleinheiten (klein geschrieben); Maßeinheiten (kg, m, l …) und „Stück“ bleiben unverändert. */
const EINHEIT_MEHRZAHL: Record<string, string> = {
  stunde: "stunden",
  minute: "minuten",
  tag: "tage",
  woche: "wochen",
  monat: "monate",
  pauschale: "pauschalen",
  person: "personen",
  paket: "pakete",
  kilowattstunde: "kilowattstunden",
  seite: "seiten",
  karte: "karten",
  nacht: "nächte",
  portion: "portionen",
  flasche: "flaschen",
  kiste: "kisten",
  fahrt: "fahrten",
  lieferung: "lieferungen",
  einheit: "einheiten",
  lizenz: "lizenzen",
  behandlung: "behandlungen",
  besuch: "besuche",
  hausbesuch: "hausbesuche",
  sitzung: "sitzungen",
  termin: "termine",
  anfahrt: "anfahrten",
  kurs: "kurse",
  einsatz: "einsätze",
};

/** Einheit passend zur Menge gebeugt: „1 Stunde“, aber „1,5 Stunden“, „2 Pauschalen“ – unbekannte Einheiten wie eingegeben. */
export function einheitFuerMenge(einheit: string, menge: number): string {
  const e = einheit.trim();
  const mehr = EINHEIT_MEHRZAHL[e.toLocaleLowerCase("de")];
  if (!mehr || Math.abs(menge) === 1) return e;
  // Schreibweise des ersten Buchstabens übernehmen („Stunde“ → „Stunden“, „stunde“ → „stunden“)
  return e[0] === e[0]!.toLocaleUpperCase("de") ? mehr[0]!.toLocaleUpperCase("de") + mehr.slice(1) : mehr;
}

export const KU_HINWEIS = "Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.";

/**
 * Obergrenze für eine Plausibilitätswarnung (G6): Beträge über 10 Mio. € sind bei Kleinbetrieben fast immer ein
 * Tippfehler (Menge und Preis vertauscht, Komma vergessen). Nur ein Hinweis – gerechnet wird trotzdem exakt.
 */
export const PLAUSIBEL_BIS_CENT = 1_000_000_000;
export const betragUnplausibel = (c: number) => Math.abs(c) > PLAUSIBEL_BIS_CENT;

/** Menge einer Position, die keine gültige Rechnungszeile ergibt (0 oder negativ, M6) – wie die E-Rechnung prüft. */
export const mengeUngueltig = (menge: number) => !(menge > 0);

export const rundeCent = (x: number) => Math.sign(x) * Math.round(Math.abs(x)); // kaufmännisch, symmetrisch

export interface Summen {
  zeilen: number[]; // Netto je Position in Cent
  gruppen: { satz: number | null; netto_cent: number; ust_cent: number }[];
  netto_cent: number;
  ust_cent: number;
  brutto_cent: number;
}

export function summen(positionen: Position[], kleinunternehmer: boolean): Summen {
  // Mengen haben höchstens vier Nachkommastellen: als ganze Zehntausendstel rechnen, sonst rundet Gleitkomma falsch (0,57 × 1,50 € = 0,8549…)
  const mal = (menge: number, cent: number) => rundeCent((Math.round(menge * 10_000) * cent) / 10_000);
  const satzVon = (p: Position) => (kleinunternehmer ? null : p.ust_satz);
  // R11: Bruttopreise (nur mit Steuersatz > 0): Zeilen-Brutto genau, Netto je Satz aus dem Brutto der Gruppe
  const brutto = (p: Position) => p.brutto_cent !== undefined && (satzVon(p) ?? 0) > 0;
  const zeilenBrutto = positionen.map((p) => (brutto(p) ? mal(p.menge, p.brutto_cent!) : 0));
  const zeilen = positionen.map((p, i) => (brutto(p) ? rundeCent((zeilenBrutto[i]! * 100) / (100 + satzVon(p)!)) : mal(p.menge, p.preis_cent)));
  const bruttoJeSatz = new Map<number, number>();
  positionen.forEach((p, i) => {
    if (brutto(p)) bruttoJeSatz.set(satzVon(p)!, (bruttoJeSatz.get(satzVon(p)!) ?? 0) + zeilenBrutto[i]!);
  });
  // Netto der Gruppe aus dem Brutto; die Rundungsdifferenz der Zeilen trägt die betragsmäßig größte Zeile (BR-S-08: Summe der Zeilen = Gruppe)
  for (const [satz, b] of bruttoJeSatz) {
    const idx = positionen.map((p, i) => i).filter((i) => brutto(positionen[i]!) && satzVon(positionen[i]!) === satz);
    const ziel = rundeCent((b * 100) / (100 + satz));
    const diff = ziel - idx.reduce((a, i) => a + zeilen[i]!, 0);
    if (diff) {
      const gross = idx.reduce((m, i) => (Math.abs(zeilen[i]!) > Math.abs(zeilen[m]!) ? i : m), idx[0]!);
      zeilen[gross] = zeilen[gross]! + diff;
    }
  }
  const nachSatz = new Map<number | null, number>();
  positionen.forEach((p, i) => {
    const satz = satzVon(p);
    nachSatz.set(satz, (nachSatz.get(satz) ?? 0) + zeilen[i]!);
  });
  const gruppen = [...nachSatz].map(([satz, netto]) => {
    // Gruppen nur aus Bruttopreisen: Steuer = Brutto − Netto; gemischt (selten): Brutto-Anteil genau, Netto-Anteil wie bisher
    const b = satz !== null && satz > 0 ? (bruttoJeSatz.get(satz) ?? 0) : 0;
    const nettoAusBrutto = satz !== null && satz > 0 ? positionen.reduce((a, p, i) => a + (brutto(p) && satzVon(p) === satz ? zeilen[i]! : 0), 0) : 0;
    const ust = satz === null ? 0 : b ? b - nettoAusBrutto + rundeCent(((netto - nettoAusBrutto) * satz) / 100) : rundeCent((netto * satz) / 100);
    return { satz, netto_cent: netto, ust_cent: ust };
  });
  const netto_cent = zeilen.reduce((a, b) => a + b, 0);
  const ust_cent = gruppen.reduce((a, g) => a + g.ust_cent, 0);
  return { zeilen, gruppen, netto_cent, ust_cent, brutto_cent: netto_cent + ust_cent };
}


export interface Steller {
  name: string; strasse: string; plz: string; ort: string; land: string; email: string; telefon?: string | null;
  steuernummer?: string | null; ust_idnr?: string | null; iban?: string | null; bic?: string | null;
  /**
   * StB-Prüfung (C-14): Registerangaben einer Gesellschaft – BT-30 „Seller legal registration identifier“ (z. B.
   * „HRB 12345“) und BT-33 „Seller additional legal information“ (Rechtsform, Sitz, Registergericht, Geschäftsführung).
   */
  register?: string | null;
  rechtliches?: string | null;
}
export interface KundeDaten {
  name: string; strasse?: string | null; plz?: string | null; ort?: string | null; land: string; email?: string | null;
  ust_idnr?: string | null; kaeufer_referenz?: string | null; geschaeftskunde: boolean;
  /** R11: bei einer Gutschrift ist der Kunde der Leistende (Verkäufer, BG-4) – seine Steuernummer und Telefon (BG-6) */
  steuernummer?: string | null; telefon?: string | null;
}
export interface RechnungsDaten {
  nummer: string; rechnungsdatum: string; leistungsdatum?: string | null; faellig_am?: string | null;
  /** Leistungszeitraum (BG-14, BT-73/74), wenn statt eines Leistungsdatums ein Zeitraum angegeben ist (§ 31 Abs. 4 UStDV) */
  leistungszeitraum?: { von: string; bis: string } | null;
  steller: Steller; kunde: KundeDaten; positionen: Position[]; kleinunternehmer: boolean; hinweis?: string | null;
  art?: "rechnung" | "storno"; storniert_nummer?: string | null;
  /** Grund für 0 %: Steuerschuldnerschaft des Empfängers, innergemeinschaftliche Lieferung, Steuerbefreiung oder Nullsteuersatz (E-129, steuerart.ts) */
  steuerart?: Steuerart;
  /** Bestellnummer des Käufers (BT-13) */
  bestellnummer?: string | null;
  /** Abschlagsrechnung vor Ausführung der Leistung: Leistungsdatum ist noch offen (§ 14 Abs. 4 Nr. 6 UStG) */
  abschlag?: boolean;
  /** Hinweis auf die Steuerbefreiung (bei „befreit“) */
  befreiungsgrund?: string | null;
  /**
   * R11: Gutschrift (§ 14 Abs. 2 Satz 2 UStG) – der Betrieb (`steller`) rechnet als Leistungsempfänger ab. In der
   * XRechnung ist der Leistende (`kunde`) der Verkäufer (BG-4) und der Betrieb der Käufer (BG-7), Typ 389.
   */
  gutschrift?: boolean;
  /**
   * R12: im Voraus vereinbarte Minderung des Entgelts (§ 14 Abs. 4 Satz 1 Nr. 7 UStG) – Skonto in Prozent bei Zahlung
   * innerhalb von `tage` Tagen ab Rechnungsdatum, bis `bis` (ISO). In der XRechnung als Zahlungsbedingung (BT-20).
   */
  skonto?: { prozent: number; tage: number; bis: string } | null;
  /**
   * StB-Prüfung (C-4): Schlussrechnung – die vorher gestellten Abschlagsrechnungen mit Entgelt und Steuer je Steuersatz
   * werden abgesetzt (§ 14 Abs. 5 Satz 2 UStG, A 14.8 Abs. 10 UStAE). Die Positionen nennen die gesamte Leistung; zu
   * zahlen ist der Rest. In der XRechnung als vorausbezahlter Betrag (BT-113) mit Verweis auf die Abschläge (BG-3).
   */
  abschlaege?: Abschlag[];
  /** StB-Prüfung (C-6): Ersatzrechnung – Nummer der stornierten Rechnung, die diese Rechnung ersetzt (BG-3) */
  ersetzt_nummer?: string | null;
  /**
   * StB-Prüfung (5.2, C-9): Fernverkauf bzw. Leistung an eine Privatperson im übrigen Gemeinschaftsgebiet mit der
   * Umsatzsteuer des Bestimmungslands (§ 3c, § 3a Abs. 5 UStG) – gehört in die OSS-Erklärung (§ 18j UStG), nicht in die
   * deutsche Voranmeldung. Die Positionen tragen dann den Steuersatz des Bestimmungslands.
   */
  oss?: { land: string; satz: number } | null;
  /**
   * E-193 (5): Zahlungsbedingung als Text (BT-20), wenn es kein Fälligkeitsdatum aus einem Zahlungsziel in Tagen gibt –
   * „Zahlbar sofort ohne Abzug.“ bzw. „Der Rechnungsbetrag wurde am … bezahlt.“, wörtlich wie auf dem PDF. Ohne BT-9
   * und BT-20 verletzt eine Rechnung mit positivem Zahlbetrag BR-CO-25.
   */
  zahlungsbedingung?: string | null;
  /**
   * E-200: Tag der Zahlung einer schon bezahlten Rechnung (am oder vor dem Rechnungsdatum; das PDF sagt „Der
   * Rechnungsbetrag wurde am … bezahlt.“). In der XRechnung ist dann der ganze Betrag bezahlt (BT-113) und nichts mehr
   * zu zahlen (BT-115 = 0,00) – passend zum PDF ohne Zahlungsaufforderung.
   */
  bezahlt_am?: string | null;
}

/** Eine abgesetzte Abschlagsrechnung (Schlussrechnung, C-4): Nummer, Datum, Entgelt und Steuer je Steuersatz. */
export interface Abschlag {
  nummer: string;
  datum?: string | null;
  satz: number | null;
  netto_cent: number;
  ust_cent: number;
}

/** Summe der abgesetzten Abschläge (brutto, netto, Steuer). */
export function abschlagsSumme(abschlaege: readonly Abschlag[] | null | undefined): { netto_cent: number; ust_cent: number; brutto_cent: number } {
  const netto_cent = (abschlaege ?? []).reduce((a, x) => a + x.netto_cent, 0);
  const ust_cent = (abschlaege ?? []).reduce((a, x) => a + x.ust_cent, 0);
  return { netto_cent, ust_cent, brutto_cent: netto_cent + ust_cent };
}

/**
 * Steuergruppen, die eine Rechnung noch zu versteuern hat: bei einer Schlussrechnung die Gruppen der gesamten Leistung
 * abzüglich der Abschläge je Steuersatz (die Abschläge sind mit ihrer Zahlung schon versteuert, § 13 Abs. 1 Nr. 1 a
 * Satz 4 UStG); sonst die Gruppen der Rechnung. Ohne Vorzeichen des Stornos.
 */
export function restGruppen(r: Pick<RechnungsDaten, "positionen" | "kleinunternehmer" | "abschlaege">): Summen["gruppen"] {
  const g = summen(r.positionen, r.kleinunternehmer).gruppen.map((x) => ({ ...x }));
  for (const a of r.abschlaege ?? []) {
    const satz = r.kleinunternehmer ? null : a.satz;
    const z = g.find((x) => x.satz === satz);
    if (z) {
      z.netto_cent -= a.netto_cent;
      z.ust_cent -= a.ust_cent;
    } else g.push({ satz, netto_cent: -a.netto_cent, ust_cent: -a.ust_cent });
  }
  return g;
}

/** Zu zahlender Betrag einer Rechnung: Rechnungsbetrag abzüglich abgesetzter Abschläge (Schlussrechnung). */
export const zahlbetrag = (r: Pick<RechnungsDaten, "positionen" | "kleinunternehmer" | "abschlaege">) => summen(r.positionen, r.kleinunternehmer).brutto_cent - abschlagsSumme(r.abschlaege).brutto_cent;

/** Was für eine gültige E-Rechnung (XRechnung) fehlt – als verständliche Liste. Leer = vollständig. */
export function fehlendFuerERechnung(r: RechnungsDaten): string[] {
  if (r.gutschrift) return fehlendFuerGutschrift(r);
  const f: string[] = [];
  const s = r.steller;
  if (!s.name || !s.strasse || !s.plz || !s.ort) f.push("steller.anschrift");
  if (!s.email) f.push("steller.email");
  if (!s.telefon) f.push("steller.telefon");
  if (!s.steuernummer && !s.ust_idnr) f.push("steller.steuernummer_oder_ust_idnr");
  if (!s.iban) f.push("steller.iban");
  if (!r.kunde.name || !r.kunde.strasse || !r.kunde.plz || !r.kunde.ort) f.push("kunde.anschrift");
  if (r.kunde.geschaeftskunde && !r.kunde.email) f.push("kunde.email");
  if (!r.positionen.length) f.push("positionen");
  if (r.positionen.some((p) => !p.bezeichnung || !(p.menge > 0) || !Number.isInteger(p.preis_cent))) f.push("positionen.ungueltig");
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === null)) f.push("positionen.steuersatz");
  if (!r.leistungsdatum && !r.leistungszeitraum && !r.abschlag) f.push("leistungsdatum");
  // 0 % ohne Kleinunternehmer: Grund nötig; Reverse Charge und innergemeinschaftliche Lieferung brauchen beide USt-IdNr. (BR-AE-02/03, BR-IC-02/03)
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === 0)) {
    const art = r.steuerart ?? "standard";
    if (art === "standard") f.push("steuer.grund_null");
    if ((art === "reverse_charge" || art === "igl") && !s.ust_idnr) f.push("steller.ust_idnr");
    if ((art === "reverse_charge" || art === "igl") && !r.kunde.ust_idnr) f.push("kunde.ust_idnr");
    if ((art === "befreit" || art === "nullsatz") && !r.befreiungsgrund) f.push("steuer.befreiungsgrund");
  }
  return f;
}

/**
 * R11: Was der E-Rechnung einer Gutschrift fehlt. Verkäufer ist der Leistende: Anschrift, E-Mail (BT-34), Telefon
 * (BR-DE-6) und Steuernummer oder USt-IdNr. (§ 14 Abs. 4 Nr. 2 UStG, BR-CO-26); Käufer ist der Betrieb (Anschrift, E-Mail).
 * Eine IBAN des Betriebs braucht es nicht – er zahlt selbst.
 */
function fehlendFuerGutschrift(r: RechnungsDaten): string[] {
  const f: string[] = [];
  const l = r.kunde;
  if (!l.name || !l.strasse || !l.plz || !l.ort) f.push("leistender.anschrift");
  if (!l.email) f.push("leistender.email");
  if (!l.telefon) f.push("leistender.telefon");
  if (!l.steuernummer && !l.ust_idnr) f.push("leistender.steuernummer_oder_ust_idnr");
  if (!r.steller.name || !r.steller.strasse || !r.steller.plz || !r.steller.ort) f.push("steller.anschrift");
  if (!r.steller.email) f.push("steller.email");
  if (!r.positionen.length) f.push("positionen");
  if (r.positionen.some((p) => !p.bezeichnung || !(p.menge > 0) || !Number.isInteger(p.preis_cent))) f.push("positionen.ungueltig");
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === null)) f.push("positionen.steuersatz");
  if (!r.leistungsdatum && !r.leistungszeitraum) f.push("leistungsdatum");
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === 0) && (r.steuerart ?? "standard") === "standard") f.push("steuer.grund_null");
  return f;
}


/** Zeitraum einer Voranmeldung: „JJJJ-MM“ oder „JJJJ-Qn“ → erster und letzter Tag (ISO). null bei falschem Format. */
export function ustZeitraum(periode: string): { von: string; bis: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2]|Q[1-4])$/.exec(periode);
  if (!m) return null;
  const jahr = Number(m[1]);
  const [von, bis] = m[2]!.startsWith("Q")
    ? [new Date(Date.UTC(jahr, (Number(m[2]![1]) - 1) * 3, 1)), new Date(Date.UTC(jahr, Number(m[2]![1]) * 3, 0))]
    : [new Date(Date.UTC(jahr, Number(m[2]) - 1, 1)), new Date(Date.UTC(jahr, Number(m[2]), 0))];
  return { von: von.toISOString().slice(0, 10), bis: bis.toISOString().slice(0, 10) };
}

/** Umsätze und Umsatzsteuer je Satz aus gestellten Rechnungen; Stornos zählen negativ. Höchster Satz zuerst. */
export function umsaetzeNachSatz(rechnungen: { art: string; kleinunternehmer: boolean; positionen: Position[] }[]) {
  const nachSatz = new Map<string, { satz: number | null; netto_cent: number; ust_cent: number }>();
  for (const r of rechnungen) {
    const vz = r.art === "storno" ? -1 : 1;
    for (const g of summen(r.positionen, r.kleinunternehmer).gruppen) {
      const key = String(g.satz);
      const e = nachSatz.get(key) ?? { satz: g.satz, netto_cent: 0, ust_cent: 0 };
      e.netto_cent += vz * g.netto_cent;
      e.ust_cent += vz * g.ust_cent;
      nachSatz.set(key, e);
    }
  }
  return [...nachSatz.values()].sort((a, b) => (b.satz ?? -1) - (a.satz ?? -1));
}
