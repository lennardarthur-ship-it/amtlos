/**
 * E-239 (externe Rückmeldung 29.10.2026, „zu breit“): Fortgeschrittene Möglichkeiten erscheinen nur, wenn das Profil
 * sie nahelegt – gelöscht wird nichts. Was ausgeblendet ist, bleibt hinter genau einer Aufklappzeile („Weitere Angaben“
 * bzw. „Weitere Optionen“) erreichbar, und was schon Daten hat, steht immer da. Gerechnet wird wie bisher – diese Regeln
 * entscheiden nur, was auf dem Bildschirm sofort sichtbar ist.
 *
 * Grundlage sind nur vorhandene Antworten des Pflichten-Checks und vorhandene Daten:
 * - „Wo sitzen deine Kunden?“ (`kunden.regionen`) mit anderen EU-Ländern → EU-Kunde, USt-IdNr. des Empfängers, ZM;
 *   dazu Privatkunden (`kunden.segmente` b2c, oder nicht gefragt) und keine Kleinunternehmerregelung → OSS.
 * - „Einkauf im Ausland“ (`einkauf.ausland_unternehmen`, nur Kleinunternehmer gefragt) → „Ich schulde die Umsatzsteuer“
 *   (innergemeinschaftlicher Erwerb, § 13b). Ohne Antwort (auch bei allen, die nicht gefragt werden) bleibt der Schalter
 *   sichtbar – Werbung und Software aus dem Ausland sind bei kleinen Betrieben häufig.
 * - Bilanz statt EÜR (`bilanzierendeGewinnermittlung`) → Bilanz-Vorlage.
 * - Beschäftigte (`beschaeftigte.gesamt`, unbekannt = sichtbar) → Mitarbeiter, Lohnkonto, Arbeitszeitnachweis.
 * - Steuerberatung laut Check oder Bilanz → Kontenvorgaben der Kanzlei.
 * - Kleinunternehmer → keine Versteuerungsart; „Kleinunternehmer bis“ nur, wenn die Regelung nicht (mehr) gilt.
 */
import type { Daten, Feld } from "@amtlos/fachlogik";
import type { Beleg } from "@amtlos/fachlogik";
import type { Stand, Unterlage } from "../unterlagen/speicher";
import { bilanzierendeGewinnermittlung, istKleinunternehmer } from "../unterlagen/steuerpaket";

/** Was das Profil nahelegt – je Bereich ein Ja/Nein. */
export interface Relevanz {
  /** Kunden in anderen EU-Ländern laut Check */
  euKunden: boolean;
  /** OSS: EU-Kunden mit Privatpersonen (oder ohne Angabe dazu), keine Kleinunternehmerregelung */
  oss: boolean;
  /** Einkauf bei Unternehmen im Ausland (innergemeinschaftlicher Erwerb, § 13b) – ohne Antwort: ja */
  einkaufAusland: boolean;
  /** Bilanz statt EÜR */
  bilanz: boolean;
  /** Beschäftigte laut Check (unbekannt: ja) */
  personal: boolean;
  /** Kleinunternehmerregelung laut Check bzw. Rechnungen */
  kleinunternehmer: boolean;
  /** Steuerberatung laut Check */
  steuerberatung: boolean;
  /** Branchen laut Check (leer: unbekannt) */
  branchen: readonly string[];
}

const liste = (p: Record<string, unknown>, k: string): string[] | null => (Array.isArray(p[k]) ? (p[k] as string[]) : null);

/** Relevanz aus dem Profil (Antworten des Checks) und dem Stand. */
export function relevanz(s: Pick<Stand, "profil" | "unterlagen" | "betrieb" | "steuerberatung" | "mitarbeiter">): Relevanz {
  const p = s.profil;
  const regionen = liste(p, "kunden.regionen");
  const segmente = liste(p, "kunden.segmente");
  const ku = istKleinunternehmer(s as Stand);
  const euKunden = Boolean(regionen?.includes("eu"));
  const anzahl = p["beschaeftigte.gesamt"];
  return {
    euKunden,
    oss: euKunden && !ku && (!segmente || segmente.includes("b2c")),
    // „nein“ gilt nur, wenn die Frage beantwortet ist; „Einkauf in der EU: ja“ schließt Ausland ein
    einkaufAusland: p["einkauf.ausland_unternehmen"] !== false || p["einkauf.eu_unternehmen"] === true,
    bilanz: bilanzierendeGewinnermittlung(s as Stand),
    personal: anzahl !== 0 || s.mitarbeiter.length > 0,
    kleinunternehmer: ku,
    steuerberatung: p.steuerberater === true,
    branchen: liste(p, "taetigkeit.branchen") ?? [],
  };
}

const text = (d: Daten, k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
const auswahl = (d: Daten, k: string) => (Array.isArray(d[k]) ? (d[k] as string[]) : []);

/** Branchen, in denen Leistungen an Grundstücken typisch sind (Hinweis § 14 Abs. 4 Satz 1 Nr. 9 UStG auf der Rechnung). */
const GRUNDSTUECK_BRANCHEN = ["handwerk", "bau", "gebaeudereinigung", "immobilien_finanzen", "sonstige"];

/**
 * Felder der Rechnung, die nur bei passendem Profil sofort sichtbar sind. `true`: passt zum Profil (bzw. hat schon Daten
 * oder ist für diese Rechnung nötig). Für alle anderen Felder gilt wie bisher nur `selten`.
 */
export function rechnungFeldPasst(id: string, r: Relevanz, d: Daten): boolean {
  switch (id) {
    case "oss":
    case "oss_satz":
      return r.oss || d.oss === true;
    case "kunde_ust_idnr": {
      const hw = auswahl(d, "hinweise");
      return r.euKunden || hw.includes("gutschrift") || hw.includes("igl") || hw.includes("reverse_charge") || Boolean(text(d, "kunde_ust_idnr"));
    }
    case "grundstueck_bezug":
      return !r.branchen.length || r.branchen.some((b) => GRUNDSTUECK_BRANCHEN.includes(b)) || d.grundstueck_bezug === true;
    default:
      return true;
  }
}

/** Für `Felder`: welches Feld einer Vorlage nicht zum Profil passt (dann hinter „Weitere Angaben“). */
export function nebensacheFuer(vorlage: string, r: Relevanz, d: Daten): ((f: Feld) => boolean) | undefined {
  if (vorlage !== "rechnung") return undefined;
  return (f) => !rechnungFeldPasst(f.id, r, d);
}

/**
 * Aufteilung der Felder eines Schritts (wie `Felder` sie zeichnet). Zugeklappt (`besondereIds` null): sichtbar ist, was
 * weder selten ist noch zum Profil unpassend (`nebensache`) – außer ausgefüllt oder unter „Fehlt noch“ genannt; der Rest
 * steht hinter „Weitere Angaben (n)“. Aufgeklappt: alles, die beim Aufklappen unpassenden Felder (`besondereIds`, auch
 * noch nicht sichtbare wie der OSS-Steuersatz) am Ende unter „Für besondere Fälle“ – so springt beim Tippen nichts.
 */
export function felderAufteilen<F extends { id: string; label: string; selten?: boolean }>(
  da: F[],
  werte: Record<string, unknown>,
  fehlt: string[],
  besondereIds: readonly string[] | null,
  nebensache?: (f: F) => boolean,
): { zeigen: F[]; versteckt: F[]; besondere: F[] } {
  const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w === true);
  const genannt = (x: F) => fehlt.some((l) => l === x.label || l.endsWith(`: ${x.label}`) || l.startsWith(`${x.label}: `));
  const ausblendbar = (x: F) => (Boolean(x.selten) || Boolean(nebensache?.(x))) && !gefuellt(werte[x.id]) && !genannt(x);
  if (besondereIds) {
    const besondere = da.filter((x) => besondereIds.includes(x.id));
    return { zeigen: da.filter((x) => !besondereIds.includes(x.id)), versteckt: [], besondere };
  }
  return { zeigen: da.filter((x) => !ausblendbar(x)), versteckt: da.filter(ausblendbar), besondere: [] };
}

/** Beleg: „Ich schulde die Umsatzsteuer“ (innergemeinschaftlicher Erwerb, § 13b) sofort sichtbar? */
export const belegSteuerschuldSichtbar = (r: Relevanz, b: Pick<Beleg, "steuerschuld">) => r.einkaufAusland || Boolean(b.steuerschuld);
/** Beleg: Skonto beim Bezahlen sofort sichtbar? (seltener Fall; mit Betrag immer) */
export const belegSkontoSichtbar = (b: Pick<Beleg, "skonto_cent">) => Boolean(b.skonto_cent);

/** „Mein Betrieb“ – Steuer und Bank: USt-IdNr. sofort sichtbar? */
export const betriebUstIdSichtbar = (r: Relevanz, p: Record<string, unknown>, ustIdnr: string) => r.euKunden || p["einkauf.eu_unternehmen"] === true || Boolean(ustIdnr.trim());
/** „Mein Betrieb“: Soll/Ist sofort sichtbar? Kleinunternehmer geben keine Voranmeldung ab – außer Ist ist schon gewählt. */
export const betriebVersteuerungSichtbar = (r: Relevanz, versteuerung: string) => !r.kleinunternehmer || versteuerung === "ist";
/** „Mein Betrieb“: „Kleinunternehmer bis“ sofort sichtbar? Nur, wenn die Regelung laut Check nicht gilt (Wechsel) – oder schon eingetragen. */
export const betriebKuBisSichtbar = (p: Record<string, unknown>, kuBis: string) => p["ust.kleinunternehmer"] !== true || Boolean(kuBis.trim());
/** „Mein Betrieb“: Zeile „Mitarbeiter“ sofort sichtbar? */
export const mitarbeiterSichtbar = (r: Relevanz) => r.personal;
/** Paket für die Steuerberatung: Kontenvorgaben der Kanzlei sofort sichtbar? */
export const kontenvorgabenSichtbar = (r: Relevanz, anzahl: number) => r.steuerberatung || r.bilanz || anzahl > 0;

/** Rechnung, Zahlung: „Forderung uneinbringlich“ sofort sichtbar – erst ab Fälligkeit (oder schon vermerkt). */
export const uneinbringlichSichtbar = (u: Pick<Unterlage, "uneinbringlich">, faellig: string | null, heute: string) => Boolean(u.uneinbringlich) || Boolean(faellig && faellig < heute);

/**
 * Vorlagen der Anlässe „Im laufenden Betrieb“ und „Jahresabschluss und Steuern“, die nicht zum Profil passen (hinter
 * „Weitere Vorlagen“ – mit eigenen Unterlagen immer sichtbar). Andere Anlässe (z. B. „Ich stelle jemanden ein“) zeigen alles.
 */
export function vorlagePasst(anlass: string, id: string, r: Relevanz, s: Pick<Stand, "unterlagen">): boolean {
  if (anlass !== "laufend" && anlass !== "steuern") return true;
  if (s.unterlagen.some((u) => u.vorlage === id)) return true;
  switch (id) {
    case "oss_meldung":
      return r.oss;
    case "zm_meldung":
      return r.euKunden && !r.kleinunternehmer;
    case "bilanz_guv":
      return r.bilanz;
    case "lohnkonto":
    case "arbeitszeitnachweis":
      return r.personal;
    default:
      return true;
  }
}
