/** Protokolle als PDF (Unterweisungen). Eingebettete Schrift wie bei Rechnungen. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@cantoo/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";

const SCHRIFTEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schriften");
const datumDe = (d: string) => d.slice(0, 10).split("-").reverse().join(".");
const zeitDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));

export interface UnterweisungsProtokoll {
  unternehmen: string;
  thema: string;
  inhalt: string;
  datum: string;
  durchgefuehrt_von: string;
  inhalt_sha256: string;
  teilnahmen: { name: string; bestaetigt_am: string; name_bestaetigt: string }[];
}

function umbrechen(text: string, font: PDFFont, groesse: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.split(/\r?\n/)) {
    let zeile = "";
    for (const wort of absatz.split(/\s+/)) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, groesse) <= breite) zeile = probe;
      else {
        if (zeile) zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

export async function unterweisungsprotokollPdf(p: UnterweisungsProtokoll): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans.ttf")), { subset: true });
  const fett = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans-Bold.ttf")), { subset: true });
  doc.setTitle(`Unterweisung: ${p.thema}`);
  doc.setAuthor(p.unternehmen);
  doc.setProducer("Amtlos");
  let seite: PDFPage = doc.addPage([595.28, 841.89]);
  let y = 790;
  const text = (t: string, x: number, g = 10, f: PDFFont = normal) => seite.drawText(t, { x, y, size: g, font: f, color: rgb(0.1, 0.12, 0.15) });
  const zeile = (a = 14) => {
    y -= a;
    if (y < 70) {
      seite = doc.addPage([595.28, 841.89]);
      y = 790;
    }
  };
  text(p.unternehmen, 50, 9, fett);
  zeile(30);
  text("Unterweisungsprotokoll", 50, 16, fett);
  zeile(24);
  for (const [k, v] of [["Thema", p.thema], ["Datum", datumDe(p.datum)], ["Durchgeführt von", p.durchgefuehrt_von]]) {
    text(k!, 50);
    text(v!, 170);
    zeile();
  }
  zeile(10);
  text("Inhalt", 50, 11, fett);
  zeile(16);
  for (const z of umbrechen(p.inhalt, normal, 10, 495)) {
    text(z, 50);
    zeile();
  }
  zeile(10);
  text("Bestätigungen", 50, 11, fett);
  zeile(16);
  text("Name", 50, 9, fett); text("bestätigt als", 230, 9, fett); text("am", 420, 9, fett);
  zeile(14);
  for (const t of p.teilnahmen) {
    text(t.name, 50, 9); text(t.name_bestaetigt, 230, 9); text(zeitDe(t.bestaetigt_am), 420, 9);
    zeile();
  }
  if (!p.teilnahmen.length) {
    text("Keine Bestätigungen.", 50, 9);
    zeile();
  }
  zeile(16);
  for (const z of umbrechen(`Bestätigt wurde der Inhalt mit der Prüfsumme SHA-256 ${p.inhalt_sha256}. Die Bestätigung ist eine einfache elektronische Signatur (Name, Zeitpunkt, Inhalt).`, normal, 8, 495)) {
    text(z, 50, 8);
    zeile(11);
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

// ------------------------------------------------------------ gemeinsamer Satz für weitere Protokolle

async function satz(titel: string, autor: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans.ttf")), { subset: true });
  const fett = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans-Bold.ttf")), { subset: true });
  doc.setTitle(titel);
  doc.setAuthor(autor);
  doc.setProducer("Amtlos");
  const s = { seite: doc.addPage([595.28, 841.89]) as PDFPage, y: 790 };
  const text = (t: string, x: number, g = 10, f: PDFFont = normal) => s.seite.drawText(t, { x, y: s.y, size: g, font: f, color: rgb(0.1, 0.12, 0.15) });
  const zeile = (a = 14) => {
    s.y -= a;
    if (s.y < 70) {
      s.seite = doc.addPage([595.28, 841.89]);
      s.y = 790;
    }
  };
  /** Absatz mit Umbruch ab x, Breite bis zum rechten Rand. */
  const absatz = (t: string, x = 50, g = 10, f: PDFFont = normal, abstand = g + 4) => {
    for (const z of umbrechen(t, f, g, 545 - x)) {
      text(z, x, g, f);
      zeile(abstand);
    }
  };
  const platz = (benoetigt: number) => {
    if (s.y - benoetigt < 70) {
      s.seite = doc.addPage([595.28, 841.89]);
      s.y = 790;
    }
  };
  const fertig = async () => Buffer.from(await doc.save({ useObjectStreams: false }));
  return { text, zeile, absatz, platz, fertig, normal, fett };
}

/** Gefährdungsfaktoren in der Reihenfolge von § 5 Abs. 3 ArbSchG (Wortlaut fachlich zu prüfen, T-18). */
export const GEFAEHRDUNGSFAKTOREN: Record<string, string> = {
  arbeitsstaette: "Gestaltung und Einrichtung der Arbeitsstätte und des Arbeitsplatzes",
  einwirkungen: "Physikalische, chemische und biologische Einwirkungen",
  arbeitsmittel: "Arbeitsmittel, Maschinen, Geräte und Anlagen und der Umgang damit",
  ablaeufe_arbeitszeit: "Arbeitsverfahren, Arbeitsabläufe und Arbeitszeit",
  qualifikation: "Unzureichende Qualifikation und Unterweisung",
  psychisch: "Psychische Belastungen bei der Arbeit",
  sonstiges: "Sonstige Gefährdungen",
};
const RISIKO: Record<string, string> = { gering: "gering", mittel: "mittel", hoch: "hoch" };

export interface GefaehrdungsbeurteilungDaten {
  unternehmen: string;
  arbeitsbereich: string;
  taetigkeiten: string;
  beurteilt_von: string;
  datum: string;
  mutterschutz: boolean;
  gefaehrdungen: { faktor: string; beschreibung: string; risiko: string; massnahme: string; verantwortlich: string | null; umsetzen_bis: string | null; umgesetzt_am: string | null }[];
}

export async function gefaehrdungsbeurteilungPdf(g: GefaehrdungsbeurteilungDaten): Promise<Buffer> {
  const s = await satz(`Gefährdungsbeurteilung: ${g.arbeitsbereich}`, g.unternehmen);
  s.text(g.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text("Gefährdungsbeurteilung", 50, 16, s.fett);
  s.zeile(24);
  for (const [k, v] of [["Arbeitsbereich", g.arbeitsbereich], ["Datum", datumDe(g.datum)], ["Beurteilt von", g.beurteilt_von], ["Mutterschutz", g.mutterschutz ? "berücksichtigt (anlassunabhängige Beurteilung)" : "nicht gesondert erfasst"]] as const) {
    s.text(k, 50);
    s.text(v, 170);
    s.zeile();
  }
  if (g.taetigkeiten.trim()) {
    s.zeile(6);
    s.text("Tätigkeiten", 50, 11, s.fett);
    s.zeile(16);
    s.absatz(g.taetigkeiten);
  }
  for (const [faktor, titel] of Object.entries(GEFAEHRDUNGSFAKTOREN)) {
    const liste = g.gefaehrdungen.filter((x) => x.faktor === faktor);
    if (!liste.length) continue;
    s.zeile(8);
    s.platz(60);
    s.text(titel, 50, 11, s.fett);
    s.zeile(18);
    for (const x of liste) {
      s.platz(70);
      s.absatz(`Gefährdung: ${x.beschreibung}`, 60, 10, s.normal);
      s.absatz(`Risiko: ${RISIKO[x.risiko] ?? x.risiko}`, 60, 9);
      s.absatz(`Maßnahme: ${x.massnahme}`, 60, 10);
      const wer = [x.verantwortlich ? `verantwortlich: ${x.verantwortlich}` : null, x.umsetzen_bis ? `bis ${datumDe(x.umsetzen_bis)}` : null, x.umgesetzt_am ? `umgesetzt am ${datumDe(x.umgesetzt_am)}` : "noch nicht umgesetzt"].filter(Boolean).join(" · ");
      s.absatz(wer, 60, 9);
      s.zeile(6);
    }
  }
  if (!g.gefaehrdungen.length) {
    s.zeile(8);
    s.absatz("Keine Gefährdungen erfasst.");
  }
  s.zeile(10);
  s.absatz("Die Umsetzung und Wirksamkeit der Maßnahmen wird in Amtlos weiter dokumentiert. Bei neuen Arbeitsplätzen, Tätigkeiten oder nach Unfällen ist die Beurteilung zu überprüfen.", 50, 8, s.normal, 11);
  return s.fertig();
}

export interface GefahrstoffVerzeichnis {
  unternehmen: string;
  stand: string;
  stoffe: { bezeichnung: string; hersteller: string | null; verwendung: string | null; arbeitsbereich: string | null; menge: string | null; sdb_stand: string | null; sdb_vorhanden: boolean }[];
}

export async function gefahrstoffverzeichnisPdf(v: GefahrstoffVerzeichnis): Promise<Buffer> {
  const s = await satz("Gefahrstoffverzeichnis", v.unternehmen);
  s.text(v.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text("Gefahrstoffverzeichnis", 50, 16, s.fett);
  s.zeile(20);
  s.text(`Stand: ${datumDe(v.stand)}`, 50, 9);
  s.zeile(24);
  for (const x of v.stoffe) {
    s.platz(60);
    s.text(x.bezeichnung, 50, 11, s.fett);
    s.zeile(15);
    const zeilen = [
      ["Hersteller", x.hersteller], ["Verwendung", x.verwendung], ["Arbeitsbereich", x.arbeitsbereich], ["Menge", x.menge],
      ["Sicherheitsdatenblatt", x.sdb_vorhanden ? `liegt vor${x.sdb_stand ? ` (Stand ${datumDe(x.sdb_stand)})` : ""}` : "fehlt"],
    ] as const;
    for (const [k, w] of zeilen) {
      if (!w) continue;
      s.text(k, 60, 9);
      s.absatz(w, 170, 9, s.normal, 12);
    }
    s.zeile(8);
  }
  if (!v.stoffe.length) s.absatz("Keine Gefahrstoffe erfasst.");
  return s.fertig();
}

// ------------------------------------------------------------ Datenschutz (Abschnitt 6)

/** Schutzziele nach Art. 32 Abs. 1 DSGVO (Wortlaut fachlich zu prüfen, T-22). */
export const SCHUTZZIELE: Record<string, string> = {
  pseudonymisierung_verschluesselung: "Pseudonymisierung und Verschlüsselung",
  vertraulichkeit: "Vertraulichkeit",
  integritaet: "Integrität",
  verfuegbarkeit_belastbarkeit: "Verfügbarkeit und Belastbarkeit",
  wiederherstellung: "Rasche Wiederherstellung nach einem Zwischenfall",
  ueberpruefung: "Regelmäßige Überprüfung der Wirksamkeit",
  sonstiges: "Sonstige Maßnahmen",
};

export interface DatenschutzDokumentation {
  unternehmen: string;
  stand: string;
  verarbeitungen: { bezeichnung: string; zweck: string; rechtsgrundlage: string; betroffene: string; datenarten: string; empfaenger: string; drittland: string; loeschfrist: string; tom_hinweis: string }[];
  tom: { schutzziel: string; massnahme: string; umgesetzt_am: string | null; verantwortlich: string | null }[];
  dienstleister: { name: string; leistung: string; auftragsverarbeitung: boolean; avv_datum: string | null; avv_vorhanden: boolean; drittland: string }[];
}

/** Verzeichnis der Verarbeitungstätigkeiten mit TOM und Dienstleistern in einem Dokument. */
export async function datenschutzDokumentationPdf(d: DatenschutzDokumentation): Promise<Buffer> {
  const s = await satz("Verzeichnis der Verarbeitungstätigkeiten", d.unternehmen);
  s.text(d.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text("Verzeichnis der Verarbeitungstätigkeiten", 50, 16, s.fett);
  s.zeile(20);
  s.text(`Stand: ${datumDe(d.stand)} · Verantwortlicher: ${d.unternehmen}`, 50, 9);
  s.zeile(24);
  for (const v of d.verarbeitungen) {
    s.platz(90);
    s.text(v.bezeichnung, 50, 11, s.fett);
    s.zeile(15);
    for (const [k, w] of [["Zweck", v.zweck], ["Rechtsgrundlage", v.rechtsgrundlage], ["Betroffene", v.betroffene], ["Datenarten", v.datenarten], ["Empfänger", v.empfaenger], ["Drittland", v.drittland || "keine Übermittlung angegeben"], ["Löschfrist", v.loeschfrist], ["TOM", v.tom_hinweis]] as const) {
      s.text(k, 60, 9);
      s.absatz(w || "– (noch nicht angegeben)", 170, 9, s.normal, 12);
    }
    s.zeile(8);
  }
  if (!d.verarbeitungen.length) s.absatz("Keine Verarbeitungstätigkeiten erfasst.");
  s.zeile(10);
  s.platz(60);
  s.text("Technische und organisatorische Maßnahmen", 50, 13, s.fett);
  s.zeile(20);
  for (const [ziel, titel] of Object.entries(SCHUTZZIELE)) {
    const liste = d.tom.filter((x) => x.schutzziel === ziel);
    if (!liste.length) continue;
    s.platz(40);
    s.text(titel, 50, 10, s.fett);
    s.zeile(15);
    for (const m of liste) s.absatz(`• ${m.massnahme}${m.umgesetzt_am ? ` (umgesetzt ${datumDe(m.umgesetzt_am)})` : " (geplant)"}${m.verantwortlich ? ` – ${m.verantwortlich}` : ""}`, 60, 9, s.normal, 12);
    s.zeile(4);
  }
  if (!d.tom.length) s.absatz("Keine Maßnahmen erfasst.");
  s.zeile(10);
  s.platz(60);
  s.text("Dienstleister", 50, 13, s.fett);
  s.zeile(20);
  for (const x of d.dienstleister) {
    s.platz(30);
    const avv = x.auftragsverarbeitung ? (x.avv_vorhanden || x.avv_datum ? `AVV ${x.avv_datum ? `vom ${datumDe(x.avv_datum)}` : "liegt vor"}` : "AVV fehlt") : "keine Auftragsverarbeitung";
    s.absatz(`${x.name}${x.leistung ? ` – ${x.leistung}` : ""} · ${avv}${x.drittland ? ` · Drittland: ${x.drittland}` : ""}`, 50, 9, s.normal, 12);
  }
  if (!d.dienstleister.length) s.absatz("Keine Dienstleister erfasst.");
  return s.fertig();
}

export interface DatenpanneMeldung {
  unternehmen: string;
  entdeckt_am: string;
  beschreibung: string;
  datenarten: string;
  betroffene_anzahl: string;
  folgen: string;
  massnahmen: string;
  risiko: string | null;
  begruendung: string | null;
  gemeldet_am: string | null;
  aktenzeichen: string | null;
  kontakt: string;
}

/**
 * Meldeentwurf bzw. Dokumentation einer Datenpanne, gegliedert nach den Mindestangaben des Art. 33 Abs. 3 DSGVO
 * (Gliederung fachlich zu prüfen, T-23). Gemeldet wird über das Portal der Aufsichtsbehörde.
 */
export async function datenpanneMeldungPdf(m: DatenpanneMeldung): Promise<Buffer> {
  const s = await satz("Datenpanne", m.unternehmen);
  const RISIKO: Record<string, string> = { kein_risiko: "voraussichtlich kein Risiko – keine Meldung, nur Dokumentation", risiko: "Risiko – Meldung an die Aufsichtsbehörde", hohes_risiko: "hohes Risiko – Meldung und Benachrichtigung der Betroffenen prüfen" };
  s.text(m.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text(m.gemeldet_am ? "Meldung einer Datenpanne (Dokumentation)" : "Datenpanne – Meldeentwurf und Dokumentation", 50, 15, s.fett);
  s.zeile(24);
  for (const [k, w] of [
    ["Entdeckt am", zeitDe(m.entdeckt_am)],
    ["Frist (72 Stunden)", zeitDe(new Date(new Date(m.entdeckt_am).getTime() + 72 * 3600_000).toISOString())],
    ["Bewertung", m.risiko ? RISIKO[m.risiko] ?? m.risiko : "noch offen"],
    ["Gemeldet am", m.gemeldet_am ? `${zeitDe(m.gemeldet_am)}${m.aktenzeichen ? ` · Aktenzeichen ${m.aktenzeichen}` : ""}` : "noch nicht gemeldet"],
  ] as const) {
    s.text(k, 50, 9);
    s.absatz(w, 170, 9, s.normal, 12);
  }
  s.zeile(8);
  for (const [titel, inhalt] of [
    ["Art der Verletzung", m.beschreibung],
    ["Kategorien der Daten", m.datenarten],
    ["Betroffene Personen und Datensätze (ungefähre Zahl)", m.betroffene_anzahl],
    ["Kontakt für Rückfragen", m.kontakt],
    ["Wahrscheinliche Folgen", m.folgen],
    ["Ergriffene und vorgeschlagene Maßnahmen", m.massnahmen],
    ...(m.risiko === "kein_risiko" ? [["Begründung, warum keine Meldung nötig ist", m.begruendung ?? ""]] : []),
  ] as const) {
    s.platz(50);
    s.text(titel, 50, 10, s.fett);
    s.zeile(15);
    s.absatz(inhalt || "– (noch nicht angegeben)", 50, 10);
    s.zeile(6);
  }
  return s.fertig();
}

// ------------------------------------------------------------ Branchen (Abschnitt 8)

/** Die 14 Hauptallergene nach Anhang II der LMIV (Bezeichnungen fachlich zu prüfen, E-099). */
export const ALLERGENE: Record<string, string> = {
  gluten: "Glutenhaltiges Getreide",
  krebstiere: "Krebstiere",
  eier: "Eier",
  fische: "Fische",
  erdnuesse: "Erdnüsse",
  soja: "Soja",
  milch: "Milch (einschließlich Laktose)",
  schalenfruechte: "Schalenfrüchte",
  sellerie: "Sellerie",
  senf: "Senf",
  sesam: "Sesamsamen",
  schwefeldioxid: "Schwefeldioxid und Sulphite",
  lupinen: "Lupinen",
  weichtiere: "Weichtiere",
};

export interface AllergenAushang {
  unternehmen: string;
  stand: string;
  gerichte: { name: string; kategorie: string; allergene: string[] }[];
}

/** Allergenübersicht zum Aushängen oder Auslegen: je Gericht die enthaltenen Hauptallergene. */
export async function allergenAushangPdf(a: AllergenAushang): Promise<Buffer> {
  const s = await satz("Allergene", a.unternehmen);
  s.text(a.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text("Allergene in unseren Speisen und Getränken", 50, 15, s.fett);
  s.zeile(18);
  s.text(`Stand: ${datumDe(a.stand)}`, 50, 9);
  s.zeile(22);
  const kategorien = [...new Set(a.gerichte.map((g) => g.kategorie))];
  for (const k of kategorien) {
    if (k) {
      s.platz(40);
      s.text(k, 50, 11, s.fett);
      s.zeile(16);
    }
    for (const g of a.gerichte.filter((x) => x.kategorie === k)) {
      s.platz(28);
      s.text(g.name, 60, 10, s.fett);
      s.zeile(13);
      s.absatz(g.allergene.length ? g.allergene.map((x) => ALLERGENE[x] ?? x).join(", ") : "keine der 14 Hauptallergene angegeben", 70, 9, s.normal, 12);
      s.zeile(4);
    }
  }
  if (!a.gerichte.length) s.absatz("Keine Gerichte erfasst.");
  s.zeile(8);
  s.absatz("Bei Fragen zu Allergenen und Zutaten sprechen Sie uns gern an.", 50, 9, s.normal, 12);
  return s.fertig();
}

export interface EigenkontrollProtokoll {
  unternehmen: string;
  monat: string;
  messungen: { gemessen_am: string; messpunkt: string; einheit: string; wert: number; grenze_min: number | null; grenze_max: number | null; in_ordnung: boolean; massnahme: string | null }[];
}

/** Monatsprotokoll der Eigenkontrollen (HACCP). */
export async function eigenkontrollProtokollPdf(p: EigenkontrollProtokoll): Promise<Buffer> {
  const s = await satz(`Eigenkontrollen ${p.monat}`, p.unternehmen);
  const z = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
  s.text(p.unternehmen, 50, 9, s.fett);
  s.zeile(30);
  s.text(`Eigenkontrollen ${p.monat.slice(5)}/${p.monat.slice(0, 4)}`, 50, 15, s.fett);
  s.zeile(24);
  const grenze = (m: EigenkontrollProtokoll["messungen"][number]) =>
    m.grenze_min !== null && m.grenze_max !== null ? `${z(m.grenze_min)} bis ${z(m.grenze_max)}` : m.grenze_min !== null ? `ab ${z(m.grenze_min)}` : m.grenze_max !== null ? `bis ${z(m.grenze_max)}` : "–";
  s.text("Zeitpunkt", 50, 8, s.fett); s.text("Messpunkt", 145, 8, s.fett); s.text("Wert", 300, 8, s.fett); s.text("Grenzen", 355, 8, s.fett); s.text("OK", 440, 8, s.fett); s.text("Maßnahme", 470, 8, s.fett);
  s.zeile(13);
  for (const m of p.messungen) {
    s.platz(24);
    s.text(zeitDe(m.gemessen_am), 50, 8);
    s.text(m.messpunkt.slice(0, 30), 145, 8);
    s.text(`${z(m.wert)} ${m.einheit === "sonstige" ? "" : m.einheit}`, 300, 8);
    s.text(grenze(m), 355, 8);
    s.text(m.in_ordnung ? "ja" : "NEIN", 440, 8, m.in_ordnung ? s.normal : s.fett);
    if (m.massnahme) s.absatz(m.massnahme, 470, 8, s.normal, 11);
    else s.zeile(11);
  }
  if (!p.messungen.length) s.absatz("Keine Messungen in diesem Monat.");
  return s.fertig();
}
