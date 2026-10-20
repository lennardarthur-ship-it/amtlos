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
 * R10 (Steuerberatung, Freiberuf, Elektro):
 * - Abschlagsrechnungen zählen bei Soll im Zeitraum des Zahlungseingangs (Mindest-Ist), unbezahlt noch gar nicht.
 * - Rein formales Storno mit Neuausstellung (gleiche Beträge, gleicher Kunde, gleiche Leistung): Storno und Ersatz-
 *   rechnung gehören in den Zeitraum der ursprünglichen Leistung – sie heben sich dort auf. Ändert sich das Entgelt,
 *   zählt die Ersatzrechnung im Zeitraum des Stornos, so dass dort nur die Differenz wirkt (§ 17 UStG).
 * - Kennzahlen 21 (EU-Leistung), 45 (Drittland), 43, 87 (Nullsteuersatz); § 13b-Belege in Kz 46/47, 84/85 und 67 –
 *   auch für Kleinunternehmer (ohne Kz 67); Vorsteuer aus Gutschriften.
 * - Kleinunternehmer je Zeitraum: Sind alle Rechnungen des Zeitraums Kleinunternehmer-Rechnungen (bzw. keine), gilt
 *   das für diesen Zeitraum – auch wenn der Pflichten-Check heute etwas anderes sagt (Wechsel zum Jahreswechsel).
 */
import { eRechnungAus, istEuAusland, kennzahlBefreiung, steuerschuldFuer, summen, umsaetzeNachSatz, ustZeitraum, vorsteuerFuer, type Beleg, type Betrieb } from "@amtlos/fachlogik";
import { nichtZaehlend, type Unterlage } from "./speicher";

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
export const GUTSCHRIFT_HINWEIS = "Gutschriften sind Ausgaben: Mit Zahlungsvermerk übernimmt Amtlos sie als „Bezogene Leistungen“ (EÜR) bzw. als Aufwand (Buchungsstapel) – bitte nicht zusätzlich als Beleg erfassen. Gutschriften ohne Zahlungsvermerk fehlen in der EÜR noch.";

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
 * Soll: abweichende Zuordnung bei Storno und Ersatzrechnung (siehe Kopf). Ersatzrechnung = geteilte Rechnung an denselben
 * Kunden mit derselben Leistung wie die stornierte, erstellt nach ihr. Liefert Unterlage-ID → Tag.
 */
function korrekturen(unterlagen: Unterlage[], betrieb: Betrieb): Map<string, string> {
  const aus = new Map<string, string>();
  const feste = festeRechnungen(unterlagen);
  for (const st of feste) {
    if (!istStornoU(st) || !st.stornoZuId) continue;
    const orig = feste.find((x) => x.id === st.stornoZuId);
    if (!orig || istStornoU(orig)) continue;
    const leistung = leistungVon(orig, betrieb);
    if (!leistung) continue;
    const betraege = betragsSchluessel(orig, betrieb);
    // gleicher Kunde oder (z. B. bei korrigiertem Empfängernamen) gleiche Beträge – immer dieselbe Leistung, erstellt nach dem Original
    const ersatz = feste.find((x) => x.id !== orig.id && !istStornoU(x) && !x.storniertDurch && x.erstellt > orig.erstellt && String(x.daten.datum) >= String(orig.daten.datum) && leistungVon(x, betrieb) === leistung && (kundeVon(x) === kundeVon(orig) || betragsSchluessel(x, betrieb) === betraege));
    if (!ersatz) continue;
    const origTag = zuordnenEinfach(orig, "soll", betrieb).tag;
    if (!origTag) continue;
    if (betragsSchluessel(ersatz, betrieb) === betraege) aus.set(st.id, origTag);
    // geändertes Entgelt: Ersatzrechnung im Zeitraum des Stornos – dort wirkt nur die Differenz (§ 17 UStG)
    else if (String(st.daten.datum) > origTag) aus.set(ersatz.id, String(st.daten.datum));
  }
  return aus;
}

function zuordnen(u: Unterlage, v: Versteuerung, betrieb: Betrieb, korr?: Map<string, string>): Zuordnung {
  const k = v === "soll" ? korr?.get(u.id) : undefined;
  if (k) return { u, tag: k, ersatz: false };
  return zuordnenEinfach(u, v, betrieb);
}

function zuordnenEinfach(u: Unterlage, v: Versteuerung, betrieb: Betrieb): Zuordnung {
  const storno = istStornoU(u);
  if (v === "ist") return { u, tag: u.bezahlt ?? null, ersatz: false };
  if (storno) return { u, tag: u.daten.datum as string, ersatz: false };
  // Abschlagsrechnung (Anzahlung): Steuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG) – unbezahlt noch nicht
  if (u.daten.abschlag === true) return { u, tag: u.bezahlt ?? null, ersatz: false };
  const leistung = leistungVon(u, betrieb);
  // Vorauszahlung: bezahlt vor der Leistung ⇒ Steuer entsteht mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG)
  if (leistung) return { u, tag: u.bezahlt && u.bezahlt < leistung ? u.bezahlt : leistung, ersatz: false };
  return { u, tag: u.daten.datum as string, ersatz: true };
}

const periodenVon = (tag: string) => [tag.slice(0, 7), `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`];

/** Tag der Zuordnung zur Steuerperiode je geteilter Rechnung (wie in der Voranmeldung) – für DATEV-Feld 116. */
export function zuordnungsTage(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll"): Map<string, string | null> {
  const korr = korrekturen(unterlagen, betrieb);
  return new Map(gestellt(unterlagen).map((u) => [u.id, zuordnen(u, v, betrieb, korr).tag]));
}

/** Monate und Quartale mit zuordenbaren Rechnungen – neueste zuerst. */
export function perioden(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = []): string[] {
  const set = new Set<string>();
  // Vorsteuer aus Belegen zählt nach Belegdatum (E-133) – auch Zeiträume nur mit Belegen
  for (const b of belege) for (const p of periodenVon(b.datum)) set.add(p);
  const korr = korrekturen(unterlagen, betrieb);
  for (const u of festeRechnungen(unterlagen)) {
    const z = zuordnen(u, v, betrieb, korr);
    if (z.tag) for (const p of periodenVon(z.tag)) set.add(p);
  }
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
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
  /** Gutschriften im Zeitraum – keine Umsätze, nicht übernommen */
  gutschriften: number;
  /**
   * Steuerfreie Umsätze ohne Vorsteuerabzug (Kz 48) und Vorsteuer aus Belegen im selben Zeitraum: Vorsteuer prüfen bzw.
   * aufteilen (§ 15 Abs. 2, 4 UStG) – Text VORSTEUER_AUFTEILEN; steht auch in der Voranmeldung.
   */
  vorsteuerPruefen: boolean;
  /** § 13b-Belege im Zeitraum (Kz 46/47, 84/85, 67) */
  steuerschuldBelege: number;
}

/**
 * Felder der Voranmeldung für einen Zeitraum („JJJJ-MM“ oder „JJJJ-Qn“). `kleinunternehmer`: Antwort im Pflichten-Check
 * („ust.kleinunternehmer“); ohne Antwort gilt als Kleinunternehmer, wessen Rechnungen im Zeitraum alle Kleinunternehmer-
 * Rechnungen sind. Dann wird nichts übernommen – auch keine Vorsteuer.
 */
export function umsaetzeFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = [], kleinunternehmer?: boolean): UstUebernahme | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const korr = korrekturen(unterlagen, betrieb);
  const imZeitraum = (u: Unterlage) => {
    const x = zuordnen(u, v, betrieb, korr);
    return x.tag !== null && x.tag >= z.von && x.tag <= z.bis;
  };
  const gutschriftenListe = gestellt(unterlagen).filter((u) => istGutschrift(u) && imZeitraum(u));
  const gutschriften = gutschriftenListe.length;
  const alle = festeRechnungen(unterlagen)
    .map((u) => zuordnen(u, v, betrieb, korr))
    .filter((x) => x.tag && x.tag >= z.von && x.tag <= z.bis);
  const ku = kuImZeitraum(alle.map((x) => x.u), kleinunternehmer) ?? false;
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
  if (ku) return { werte: { zeitraum: periodeText(periode), ...rcWerte(false) }, anzahl: 0, ersatz: 0, offen: 0, vorsteuerBelege: 0, ohneVorsteuer: 0, kleinunternehmer: true, gutschriften, vorsteuerPruefen: false, steuerschuldBelege: rc.anzahl };
  // einzelne Kleinunternehmer-Rechnungen (z. B. aus der Zeit vor dem Wechsel zur Regelbesteuerung) zählen nicht mit
  const im = alle.filter((x) => !kuRechnung(x.u));
  const rechnungen = im.map(({ u }) => eRechnungAus(u.daten, betrieb).daten);
  const gruppen = umsaetzeNachSatz(rechnungen.map((daten) => ({ art: daten.art ?? "rechnung", kleinunternehmer: daten.kleinunternehmer, positionen: daten.positionen })));
  const summe = (f: (s: number | null) => boolean) => gruppen.filter((g) => f(g.satz)).reduce((a, g) => a + g.netto_cent, 0);
  // Umsätze zu 0 % nach Kennzahl: igL → Kz 41; Steuerschuldnerschaft des Empfängers im Inland → Kz 60, an Unternehmen im
  // EU-Ausland → Kz 21, außerhalb der EU → Kz 45; Nullsteuersatz → Kz 87; Befreiung nach § 4 Nr. 8–29 → Kz 48, Nr. 1 a–7 → Kz 43
  const ohne = { igl: 0, rc: 0, kz21: 0, kz45: 0, kz87: 0, kz48: 0, kz43: 0 };
  for (const daten of rechnungen) {
    const null0 = summen(daten.positionen, daten.kleinunternehmer).gruppen.filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0) * (daten.art === "storno" ? -1 : 1);
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
  const vst = vorsteuerFuer(belege, z.von, z.bis);
  // Gutschriften: die ausgewiesene Umsatzsteuer des Leistenden ist für den Betrieb Vorsteuer (§ 15 Abs. 1 Nr. 1 UStG)
  const vstGutschriften = gutschriftenListe.reduce((a, u) => {
    const { daten } = eRechnungAus(u.daten, betrieb);
    return a + summen(daten.positionen, daten.kleinunternehmer).ust_cent * (daten.art === "storno" ? -1 : 1);
  }, 0);
  const verteilt = ohne.igl + ohne.rc + ohne.kz21 + ohne.kz45 + ohne.kz87 + ohne.kz48 + ohne.kz43;
  return {
    vorsteuerBelege: vst.anzahl,
    ohneVorsteuer: vst.ohne,
    anzahl: im.length,
    ersatz: im.filter((x) => x.ersatz).length,
    offen: v === "ist" ? offeneRechnungen(unterlagen).length : 0,
    kleinunternehmer: false,
    gutschriften,
    vorsteuerPruefen: ohne.kz48 > 0 && vst.cent > 0,
    steuerschuldBelege: rc.anzahl,
    werte: {
      zeitraum: periodeText(periode),
      umsatz_19: betragText(summe((s) => s === 19)),
      umsatz_7: betragText(summe((s) => s === 7)),
      umsatz_igl: betragText(ohne.igl),
      umsatz_48: betragText(ohne.kz48),
      umsatz_13b: betragText(ohne.rc),
      umsatz_21: betragText(ohne.kz21),
      umsatz_45: betragText(ohne.kz45),
      umsatz_87: betragText(ohne.kz87),
      umsatz_43: betragText(ohne.kz43),
      umsatz_frei: betragText(frei - verteilt),
      ...(belege.length || vstGutschriften ? { vorsteuer: betragText(vst.cent + vstGutschriften) } : {}),
      ...rcWerte(true),
    },
  };
}
