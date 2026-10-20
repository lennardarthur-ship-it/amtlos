/**
 * Rechnungen ohne Datenbank und ohne PDF (E-120): Summen je Steuersatz, Vollständigkeit für die E-Rechnung und die
 * Zusammenfassung für die Umsatzsteuer-Voranmeldung. Vom Server (packages/server/src/finanzen.ts, apps/api) und vom
 * Demo-Modus der App genutzt.
 */
export { emailGueltig, ibanGueltig, ibanNormal, plzGueltig } from "./pruefen.js";
export interface Position {
  bezeichnung: string;
  menge: number;
  einheit: Einheit;
  preis_cent: number; // Nettopreis je Einheit
  ust_satz: number | null; // Prozent; null bei Kleinunternehmern
  /** UN/ECE-Code der Einheit, wenn die Einheit frei eingegeben wurde (App, E-128) – sonst aus `einheit` */
  einheit_code?: string;
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
  const zeilen = positionen.map((p) => rundeCent((Math.round(p.menge * 10_000) * p.preis_cent) / 10_000));
  const nachSatz = new Map<number | null, number>();
  positionen.forEach((p, i) => {
    const satz = kleinunternehmer ? null : p.ust_satz;
    nachSatz.set(satz, (nachSatz.get(satz) ?? 0) + zeilen[i]!);
  });
  const gruppen = [...nachSatz].map(([satz, netto]) => ({ satz, netto_cent: netto, ust_cent: satz === null ? 0 : rundeCent((netto * satz) / 100) }));
  const netto_cent = zeilen.reduce((a, b) => a + b, 0);
  const ust_cent = gruppen.reduce((a, g) => a + g.ust_cent, 0);
  return { zeilen, gruppen, netto_cent, ust_cent, brutto_cent: netto_cent + ust_cent };
}


export interface Steller {
  name: string; strasse: string; plz: string; ort: string; land: string; email: string; telefon?: string | null;
  steuernummer?: string | null; ust_idnr?: string | null; iban?: string | null; bic?: string | null;
}
export interface KundeDaten {
  name: string; strasse?: string | null; plz?: string | null; ort?: string | null; land: string; email?: string | null;
  ust_idnr?: string | null; kaeufer_referenz?: string | null; geschaeftskunde: boolean;
}
export interface RechnungsDaten {
  nummer: string; rechnungsdatum: string; leistungsdatum?: string | null; faellig_am?: string | null;
  /** Leistungszeitraum (BG-14, BT-73/74), wenn statt eines Leistungsdatums ein Zeitraum angegeben ist (§ 31 Abs. 4 UStDV) */
  leistungszeitraum?: { von: string; bis: string } | null;
  steller: Steller; kunde: KundeDaten; positionen: Position[]; kleinunternehmer: boolean; hinweis?: string | null;
  art?: "rechnung" | "storno"; storniert_nummer?: string | null;
  /** Grund für 0 %: Steuerschuldnerschaft des Empfängers, innergemeinschaftliche Lieferung oder Steuerbefreiung (E-129) */
  steuerart?: "standard" | "reverse_charge" | "igl" | "befreit";
  /** Hinweis auf die Steuerbefreiung (bei „befreit“) */
  befreiungsgrund?: string | null;
}

/** Was für eine gültige E-Rechnung (XRechnung) fehlt – als verständliche Liste. Leer = vollständig. */
export function fehlendFuerERechnung(r: RechnungsDaten): string[] {
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
  if (!r.leistungsdatum && !r.leistungszeitraum) f.push("leistungsdatum");
  // 0 % ohne Kleinunternehmer: Grund nötig; Reverse Charge und innergemeinschaftliche Lieferung brauchen beide USt-IdNr. (BR-AE-02/03, BR-IC-02/03)
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === 0)) {
    const art = r.steuerart ?? "standard";
    if (art === "standard") f.push("steuer.grund_null");
    if ((art === "reverse_charge" || art === "igl") && !s.ust_idnr) f.push("steller.ust_idnr");
    if ((art === "reverse_charge" || art === "igl") && !r.kunde.ust_idnr) f.push("kunde.ust_idnr");
    if (art === "befreit" && !r.befreiungsgrund) f.push("steuer.befreiungsgrund");
  }
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
