/**
 * Daten aus Rechnungen und Belegen weitergeben (E-133) – reine Funktionen ohne Gerät:
 * - EÜR übernehmen: Einnahmen nach Zahlungseingang, Ausgaben nach Zahlung, je Zeile der Anlage EÜR.
 * - Steuerberater-Paket: ZIP mit DATEV-Buchungsstapel, lesbarer Buchungsliste, Rechnungs- und Belegliste (CSV),
 *   E-Rechnungen (XRechnung) der Ausgangsrechnungen und den Originaldateien der Belege.
 * Fachlich zu prüfen: PRUEFLISTE T-79 (Zuordnung) und die Prüfpunkte in packages/fachlogik/src/buchungen.ts.
 */
import { zipSync } from "fflate";
import {
  KU_HINWEIS,
  buchungenAusBelegen,
  buchungenAusRechnungen,
  buchungslisteCsv,
  belegSummen,
  datevExtf,
  datevExtfBytes,
  eRechnungAus,
  euerFuer,
  kategorieFuer,
  summen,
  xrechnungUbl,
  zahltag,
  type AusgangsRechnungFuerBuchung,
  type Beleg,
  type Betrieb,
  type Einnahme,
  type Kontenrahmen,
} from "@amtlos/fachlogik";
import { utf8 } from "./sicherung";
import type { Stand, Unterlage } from "./speicher";

const betrag = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);
const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/** Festgeschriebene (geteilte) Rechnungen – nur sie gelten als gestellt. */
export const gestellteRechnungen = (s: Stand) => s.unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string");

/** Ausgangsrechnung in der Form, die die Buchungen brauchen. */
export function rechnungFuerBuchung(u: Unterlage, betrieb: Betrieb): AusgangsRechnungFuerBuchung {
  const { daten } = eRechnungAus(u.daten, betrieb);
  return { id: u.id, nummer: daten.nummer, datum: daten.rechnungsdatum, bezahlt: u.bezahlt ?? null, art: istStorno(u) ? "storno" : "rechnung", kleinunternehmer: daten.kleinunternehmer, kunde: daten.kunde.name, positionen: daten.positionen };
}

/** Einnahmen aus Rechnungen mit vermerktem Zahlungseingang (Zufluss, § 11 Abs. 1 EStG); Stornos negativ. */
export function einnahmenAusRechnungen(s: Stand): Einnahme[] {
  return gestellteRechnungen(s)
    .filter((u) => u.bezahlt)
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, s.betrieb);
      const sm = summen(daten.positionen, daten.kleinunternehmer);
      const vz = istStorno(u) ? -1 : 1;
      return { tag: u.bezahlt!, netto_cent: vz * sm.netto_cent, ust_cent: vz * sm.ust_cent, kleinunternehmer: daten.kleinunternehmer };
    });
}

/** Jahre mit Daten (Zahlungen von Rechnungen, Zahltage von Belegen), neueste zuerst. */
export function jahreMitDaten(s: Stand): string[] {
  const j = new Set<string>();
  for (const u of gestellteRechnungen(s)) if (u.bezahlt) j.add(u.bezahlt.slice(0, 4));
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
}

/** Einträge für die Vorlage „EÜR“ (Listen `einnahmen` und `ausgaben`) aus den Daten eines Jahres. */
export function euerUebernahme(s: Stand, jahr: string): EuerUebernahme {
  const einnahmen = einnahmenAusRechnungen(s);
  const e = euerFuer(einnahmen, s.belege, jahr);
  const ku = einnahmen.some((x) => x.kleinunternehmer && x.tag.startsWith(`${jahr}-`));
  const ein: Record<string, string>[] = [];
  if (e.einnahmen_netto_cent) ein.push({ datum: "", text: "Umsätze aus Rechnungen (netto)", kategorie: ku ? "Umsatzsteuerlicher Kleinunternehmer" : "Umsatzsteuerpflichtige Betriebseinnahmen", betrag: betrag(e.einnahmen_netto_cent) });
  if (e.ust_vereinnahmt_cent) ein.push({ datum: "", text: "Vereinnahmte Umsatzsteuer", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: betrag(e.ust_vereinnahmt_cent) });
  const aus: Record<string, string>[] = e.ausgaben.zeilen.map((z) => ({ datum: "", text: `${z.kategorie.titel} (${z.anzahl} ${z.anzahl === 1 ? "Beleg" : "Belege"})`, kategorie: z.kategorie.euer, betrag: betrag(z.netto_cent) }));
  if (e.ausgaben.vorsteuer_cent) aus.push({ datum: "", text: "Gezahlte Vorsteuer aus Belegen", kategorie: "Gezahlte Vorsteuerbeträge", betrag: betrag(e.ausgaben.vorsteuer_cent) });
  const imJahr = gestellteRechnungen(s).filter((u) => String(u.daten.datum).startsWith(`${jahr}-`));
  return { einnahmen: ein, ausgaben: aus, anlagen: e.ausgaben.anlagen.length, rechnungen: e.anzahl_einnahmen, belege: s.belege.filter((b) => zahltag(b).startsWith(`${jahr}-`)).length, unbezahlt: imJahr.filter((u) => !u.bezahlt && !u.storniertDurch && !istStorno(u)).length };
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
const csvFeld = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = (kopf: string[], zeilen: string[][]) => "﻿" + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(";")).join("\r\n") + "\r\n";
const sicher = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ohne-name";

/** Dateiname der Belegdatei im Paket: Datum_Lieferant_Nummer.endung */
export const belegDateiname = (b: Beleg) => `${b.datum}_${sicher(b.lieferant)}${b.nummer ? `_${sicher(b.nummer)}` : ""}.${(b.datei ?? "").split(".").pop() || "bin"}`;

export function rechnungenCsv(s: Stand, z: Zeitraum): string {
  const zeilen = gestellteRechnungen(s)
    .filter((u) => imZeitraum(String(u.daten.datum), z))
    .sort((a, b) => String(a.daten.datum).localeCompare(String(b.daten.datum)))
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, s.betrieb);
      const sm = summen(daten.positionen, daten.kleinunternehmer);
      const vz = istStorno(u) ? -1 : 1;
      const saetze = sm.gruppen.map((g) => (g.satz === null ? "§ 19" : `${g.satz} %`)).join(", ");
      return [daten.nummer, datumDe(daten.rechnungsdatum), daten.leistungsdatum ? datumDe(daten.leistungsdatum) : "", daten.kunde.name, betrag(vz * sm.netto_cent), betrag(vz * sm.ust_cent), betrag(vz * sm.brutto_cent), saetze, u.bezahlt ? datumDe(u.bezahlt) : "", istStorno(u) ? String(u.daten.storno_zu) : ""];
    });
  return csv(["Nummer", "Datum", "Leistungsdatum", "Kunde", "Netto", "USt", "Brutto", "Steuersätze", "Bezahlt am", "Storno zu"], zeilen);
}

export function belegeCsv(s: Stand, z: Zeitraum): string {
  const zeilen = s.belege
    .filter((b) => imZeitraum(b.datum, z))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map((b) => {
      const sm = belegSummen(b);
      return [datumDe(b.datum), b.lieferant, b.nummer ?? "", kategorieFuer(b.kategorie).titel, kategorieFuer(b.kategorie).euer, betrag(sm.netto_cent), betrag(sm.ust_cent), betrag(sm.vorsteuer_cent), betrag(sm.brutto_cent), b.steuer.map((x) => `${x.satz} %`).join(", "), b.bezahlt ? datumDe(b.bezahlt) : "", b.zahlung, b.datei ? belegDateiname(b) : "", (b.notiz ?? "").replace(/\s+/g, " ")];
    });
  return csv(["Datum", "Lieferant", "Nummer", "Kategorie", "Zeile Anlage EÜR", "Netto", "USt", "Vorsteuer", "Brutto", "Steuersätze", "Bezahlt am", "Zahlung", "Datei", "Notiz"], zeilen);
}

export interface PaketErgebnis {
  zip: Uint8Array;
  dateiname: string;
  rechnungen: number;
  belege: number;
  /** Rechnungen, für die keine E-Rechnung erzeugt werden konnte (Angaben fehlen) */
  ohneXml: number;
  buchungen: number;
}

/**
 * Das Paket für die Steuerberatung. `dateien` liefert die Bytes einer Belegdatei (verschlüsselt abgelegt, vom Aufrufer
 * entschlüsselt). `jetzt` als ISO-Zeitpunkt für den DATEV-Kopf.
 */
export function steuerpaket(s: Stand, z: Zeitraum, sb: Steuerberatung, dateien: Record<string, Uint8Array>, jetzt: string): PaketErgebnis {
  const rechnungen = gestellteRechnungen(s).filter((u) => imZeitraum(String(u.daten.datum), z));
  const belege = s.belege.filter((b) => imZeitraum(b.datum, z));
  const buchungen = [...buchungenAusRechnungen(rechnungen.map((u) => rechnungFuerBuchung(u, s.betrieb)), sb.kontenrahmen), ...buchungenAusBelegen(belege, sb.kontenrahmen)].sort((a, b) => a.datum.localeCompare(b.datum));
  const inhalt: Record<string, Uint8Array> = {};
  inhalt[`EXTF_Buchungsstapel_${z.name}.csv`] = datevExtfBytes(datevExtf(buchungen, { beraternummer: sb.beraternummer, mandantennummer: sb.mandantennummer, wjBeginn: `${z.von.slice(0, 4)}-01-01`, von: z.von, bis: z.bis, kontenrahmen: sb.kontenrahmen, bezeichnung: `Amtlos ${z.name}`, erzeugtAm: jetzt }));
  inhalt[`Buchungsliste_${z.name}.csv`] = utf8(buchungslisteCsv(buchungen));
  inhalt[`Rechnungen_${z.name}.csv`] = utf8(rechnungenCsv(s, z));
  inhalt[`Belege_${z.name}.csv`] = utf8(belegeCsv(s, z));
  let ohneXml = 0;
  for (const u of rechnungen) {
    const { daten, fehlt } = eRechnungAus(u.daten, s.betrieb);
    if (fehlt.length) {
      ohneXml++;
      continue;
    }
    inhalt[`E-Rechnungen/${sicher(daten.nummer)}.xml`] = utf8(xrechnungUbl(daten, KU_HINWEIS));
  }
  const vergeben = new Set<string>();
  for (const b of belege) {
    if (!b.datei || !dateien[b.datei]) continue;
    let name = belegDateiname(b);
    for (let i = 2; vergeben.has(name); i++) name = belegDateiname(b).replace(/(\.\w+)$/, `_${i}$1`);
    vergeben.add(name);
    inhalt[`Belege/${name}`] = dateien[b.datei]!;
  }
  inhalt["LIESMICH.txt"] = utf8(
    [
      `Amtlos – Unterlagen für die Steuerberatung`,
      `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
      `Zeitraum: ${datumDe(z.von)} bis ${datumDe(z.bis)}`,
      `Erstellt: ${datumDe(jetzt.slice(0, 10))}`,
      ``,
      `Inhalt`,
      `- EXTF_Buchungsstapel_${z.name}.csv: DATEV-Format „Buchungsstapel“ (${sb.kontenrahmen}), ${buchungen.length} Buchungen. Das Format ist noch nicht gegen den DATEV-Leitfaden geprüft – bitte vor dem Import kontrollieren.${sb.beraternummer && sb.mandantennummer ? "" : " Berater- und Mandantennummer fehlen und sind für den Import nötig."}`,
      `- Buchungsliste_${z.name}.csv: dieselben Buchungen zum Lesen (Semikolon, UTF-8).`,
      `- Rechnungen_${z.name}.csv: ${rechnungen.length} gestellte Rechnungen mit Netto, USt, Brutto und Zahlungseingang.`,
      `- Belege_${z.name}.csv: ${belege.length} Belege mit Kategorie, Vorsteuer und Zahlung.`,
      `- E-Rechnungen/: XRechnung der Ausgangsrechnungen${ohneXml ? ` (${ohneXml} ohne, weil Angaben fehlen)` : ""}.`,
      `- Belege/: Originaldateien (Fotos, PDFs, E-Rechnungen) – unverändert.`,
      ``,
      `Zuordnung: Rechnungen nach Rechnungsdatum, Belege nach Belegdatum. Die PDFs der Ausgangsrechnungen liegen beim Betrieb.`,
    ].join("\r\n"),
  );
  return { zip: zipSync(inhalt, { level: 6 }), dateiname: `Amtlos-Steuerberatung-${sicher(s.betrieb.name || "Betrieb")}-${z.name}.zip`, rechnungen: rechnungen.length, belege: belege.length, ohneXml, buchungen: buchungen.length };
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
