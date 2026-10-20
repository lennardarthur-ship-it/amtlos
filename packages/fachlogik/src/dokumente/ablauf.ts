/**
 * Hilfen für den geführten Ablauf der App (E-124): Anlässe statt Rechtsgebiete, kurze Beschreibungen in Alltagssprache,
 * gespeicherte Personen (Mitarbeiter, Kunden), fortlaufende Nummern, kurze Titel für Vorschläge.
 */
import { STEUERKLASSEN } from "./lohn.js";
import type { Daten, EinfachesFeld, Person, PersonAngaben, PersonenArt, Vorlage } from "./typen.js";

/** Ein Satz je Vorlage, ohne Paragrafen – für Listen in der App. */
export const KURZ: Record<string, string> = {
  rechnung: "Rechnung an Kunden – mit allen Angaben, die das Finanzamt verlangt.",
  euer: "Einnahmen und Ausgaben eines Jahres – ergibt deinen Gewinn.",
  bilanz_guv: "Jahresabschluss für Kaufleute und Gesellschaften.",
  ust_voranmeldung: "Rechnet aus, wie viel Umsatzsteuer du ans Finanzamt zahlst.",
  steuererklaerung: "Alle Zahlen und Belege für die Steuererklärung an einem Ort.",
  verfahrensdokumentation: "Beschreibt, wie du Belege sammelst, buchst und aufbewahrst.",
  kassenbuch: "Bargeld-Einnahmen und -Ausgaben Tag für Tag.",
  kassenmeldung: "Angaben zu deiner Kasse für die Meldung ans Finanzamt.",
  aufbewahrung: "Welche Unterlagen du wie lange aufheben musst.",
  datenschutz_dokumentation: "Welche Daten du wofür nutzt und wie du sie schützt.",
  datenschutzerklaerung_website: "Text für deine Website: was mit den Daten der Besucher passiert.",
  avv: "Vertrag mit Dienstleistern, die für dich mit Kundendaten arbeiten.",
  datenschutzinformation: "Info-Blatt für Kunden oder Mitarbeiter, was du mit ihren Daten machst.",
  datenpanne: "Wenn Daten verloren gehen oder in falsche Hände geraten.",
  arbeitszeitnachweis: "Arbeitszeiten deiner Mitarbeiter – auch für Minijobs.",
  nachweis_arbeitsbedingungen: "Die wichtigsten Arbeitsbedingungen schriftlich für neue Mitarbeiter.",
  sv_meldedaten: "Alle Angaben, die du für die Anmeldung neuer Mitarbeiter brauchst.",
  lohnkonto: "Lohn und Abzüge je Mitarbeiter über das Jahr.",
  ki_kompetenz: "Nachweis, dass dein Team im Umgang mit KI-Werkzeugen geschult ist.",
  gefaehrdungsbeurteilung: "Welche Gefahren es am Arbeitsplatz gibt und was du dagegen tust.",
  unterweisung: "Nachweis, dass du dein Team über Sicherheit informiert hast.",
  gefahrstoffverzeichnis: "Liste aller gefährlichen Stoffe im Betrieb.",
  betriebsanweisung: "Aushang zum sicheren Umgang mit einem Gefahrstoff.",
  pruefprotokoll_elektro: "Prüfung der elektrischen Geräte im Betrieb.",
  impressum: "Pflichtangaben für deine Website.",
  gewerbeanmeldung: "Alle Angaben für die Anmeldung beim Gewerbeamt.",
  handelsregister: "Angaben für den Termin beim Notar.",
  transparenzregister: "Wer hinter deiner Gesellschaft steht.",
  ifsg_belehrung: "Wiederholte Hygiene-Belehrung für alle, die mit Lebensmitteln arbeiten.",
  allergene: "Welche Allergene in deinen Speisen und Getränken stecken.",
  haccp: "Kontrollen von Temperatur, Sauberkeit und Lieferungen.",
  hautschutzplan: "Wie dein Team die Haut bei der Arbeit schützt.",
  hygieneplan: "Was wann womit gereinigt und desinfiziert wird.",
};

export interface Anlass {
  id: string;
  titel: string;
  /** was dazugehört, in wenigen Worten */
  text: string;
  vorlagen: string[];
}

/**
 * Anlässe auf der Startseite: so denken Gründer – nicht in Rechtsgebieten. Eine Vorlage darf in mehreren stehen.
 * Hautschutz- und Hygieneplan sind Beauty-Vorlagen (Kopf, Rechtsgrundlage, Vorschläge): Sie stehen nur unter „Salon und
 * Kosmetik“, nicht in allgemeinen Anlässen und nicht bei Gastronomie (dort die HACCP-Eigenkontrollen).
 */
export const ANLAESSE: Anlass[] = [
  { id: "einstellen", titel: "Ich stelle jemanden ein", text: "Arbeitsbedingungen, Anmeldung, Lohn, Unterweisung", vorlagen: ["nachweis_arbeitsbedingungen", "sv_meldedaten", "lohnkonto", "arbeitszeitnachweis", "unterweisung", "gefaehrdungsbeurteilung", "datenschutzinformation", "ki_kompetenz", "ifsg_belehrung"] },
  { id: "gruenden", titel: "Ich gründe oder eröffne", text: "Gewerbe, Register, Kasse, Belege", vorlagen: ["gewerbeanmeldung", "handelsregister", "transparenzregister", "kassenmeldung", "verfahrensdokumentation", "aufbewahrung", "datenschutz_dokumentation", "gefaehrdungsbeurteilung"] },
  { id: "laufend", titel: "Im laufenden Betrieb", text: "Rechnungen, Kasse, Umsatzsteuer, Arbeitszeit", vorlagen: ["rechnung", "kassenbuch", "ust_voranmeldung", "arbeitszeitnachweis", "lohnkonto", "haccp"] },
  { id: "steuern", titel: "Jahresabschluss und Steuern", text: "EÜR, Bilanz, Steuererklärung, Aufbewahrung", vorlagen: ["euer", "bilanz_guv", "steuererklaerung", "ust_voranmeldung", "aufbewahrung"] },
  { id: "website", titel: "Ich mache eine Website", text: "Impressum, Datenschutzerklärung, Verträge", vorlagen: ["impressum", "datenschutzerklaerung_website", "avv"] },
  { id: "datenschutz", titel: "Kundendaten und Datenschutz", text: "Verzeichnis, Info-Blatt, Verträge", vorlagen: ["datenschutz_dokumentation", "datenschutzinformation", "avv", "datenschutzerklaerung_website", "datenpanne"] },
  { id: "sicherheit", titel: "Sicherheit am Arbeitsplatz", text: "Gefahren, Unterweisung, Gefahrstoffe, Geräte", vorlagen: ["gefaehrdungsbeurteilung", "unterweisung", "betriebsanweisung", "gefahrstoffverzeichnis", "pruefprotokoll_elektro"] },
  { id: "gastro", titel: "Café, Restaurant, Lebensmittel", text: "Allergene, Eigenkontrollen, Hygiene", vorlagen: ["allergene", "haccp", "ifsg_belehrung"] },
  { id: "beauty", titel: "Salon und Kosmetik", text: "Hautschutz, Hygiene, Gefahrstoffe", vorlagen: ["hautschutzplan", "hygieneplan", "gefaehrdungsbeurteilung", "gefahrstoffverzeichnis", "betriebsanweisung"] },
  { id: "panne", titel: "Daten verloren oder gestohlen", text: "Datenpanne festhalten und melden", vorlagen: ["datenpanne"] },
];

/** Felder der gespeicherten Personen – dieselben Feldarten wie in den Vorlagen. */
export const PERSONEN_FELDER: Record<PersonenArt, EinfachesFeld[]> = {
  mitarbeiter: [
    { id: "name", art: "text", label: "Vor- und Nachname", pflicht: true },
    { id: "anschrift", art: "mehrzeilig", label: "Anschrift" },
    { id: "geburtsdatum", art: "datum", label: "Geburtsdatum" },
    { id: "geburtsort", art: "text", label: "Geburtsort" },
    { id: "geburtsname", art: "text", label: "Geburtsname", hilfe: "falls abweichend", selten: true },
    { id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", vorschlaege: ["deutsch"] },
    { id: "taetigkeit", art: "text", label: "Tätigkeit" },
    { id: "beginn", art: "datum", label: "Beschäftigt seit" },
    { id: "steuer_id", art: "text", label: "Steuer-Identifikationsnummer" },
    { id: "steuerklasse", art: "wahl", label: "Steuerklasse", optionen: STEUERKLASSEN },
    { id: "sv_nummer", art: "text", label: "Sozialversicherungsnummer" },
    { id: "krankenkasse", art: "text", label: "Krankenkasse" },
    { id: "iban", art: "text", label: "IBAN für das Gehalt" },
  ],
  kunde: [
    { id: "name", art: "text", label: "Name oder Firma", pflicht: true },
    { id: "anschrift", art: "mehrzeilig", label: "Anschrift" },
    { id: "email", art: "text", label: "E-Mail", hilfe: "für die E-Rechnung" },
    { id: "ust_idnr", art: "text", label: "USt-IdNr.", hilfe: "nur bei Unternehmen im EU-Ausland oder Steuerschuldnerschaft", selten: true },
  ],
};

const wert = (d: Daten, k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");

/** Person aus einer ausgefüllten Unterlage (für „Mitarbeiter“ bzw. „Kunden“); null, wenn kein Name eingetragen ist. */
export function personAus(v: Vorlage, d: Daten): PersonAngaben | null {
  if (!v.person) return null;
  const name = wert(d, v.person.felder.name ?? "");
  if (!name) return null;
  const p: Record<string, string> = { name };
  for (const [k, feld] of Object.entries(v.person.felder)) if (k !== "name" && wert(d, feld)) p[k] = wert(d, feld);
  return p as PersonAngaben;
}

/** Angaben einer gespeicherten Person für die Felder der Vorlage (nur vorhandene Werte). */
export function personIn(v: Vorlage, p: Partial<Person>): Daten {
  const d: Daten = {};
  if (!v.person) return d;
  for (const [k, feld] of Object.entries(v.person.felder)) {
    const w = p[k];
    if (typeof w === "string" && w.trim()) d[feld] = w;
  }
  return d;
}

const gleicherName = (a: string, b: string) => a.trim().toLocaleLowerCase("de") === b.trim().toLocaleLowerCase("de");

/** Person merken: gleicher Name ergänzt den vorhandenen Eintrag (neue Werte gewinnen, leere überschreiben nichts). */
export function personMerken(liste: Person[], neu: PersonAngaben, id: string): Person[] {
  const alt = liste.find((p) => gleicherName(p.name, neu.name));
  const werte = Object.fromEntries(Object.entries(neu).filter(([, w]) => typeof w === "string" && w.trim()));
  if (!alt) return [...liste, { ...werte, id, name: neu.name.trim() } as Person];
  return liste.map((p) => (p === alt ? ({ ...p, ...werte, id: p.id, name: p.name } as Person) : p));
}

const JAHR = /(?:19|20)\d\d/;

interface NummerTeile {
  /** Text vor der laufenden Zahl */
  vor: string;
  zahl: number;
  breite: number;
  /** Text nach der laufenden Zahl, z. B. „/2026“ bei „12/2026“ */
  nach: string;
  /** Jahreszahl im Schema (vor oder nach der Zahl), sonst null */
  jahr: string | null;
}

/**
 * Zerlegt eine Nummer in Präfix, laufende Zahl und Rest. Steht vor der letzten Zahl schon eine Jahreszahl („2026-014“,
 * „RE-2026-0099“), ist die letzte Zahl die laufende. Sonst kann die letzte Zahl selbst das Jahr sein („12/2026“,
 * „001-2026“) – dann zählt die Zahl davor.
 */
function nummerTeile(n: string): NummerTeile | null {
  const m = /^(.*?)(\d+)$/.exec(n);
  if (!m) return null;
  const vor = m[1]!;
  const jahrVorn = JAHR.exec(vor);
  if (jahrVorn) return { vor, zahl: Number(m[2]), breite: m[2]!.length, nach: "", jahr: jahrVorn[0] };
  const h = /^(.*?)(\d+)(\D+)((?:19|20)\d\d)$/.exec(n);
  if (h) return { vor: h[1]!, zahl: Number(h[2]), breite: h[2]!.length, nach: h[3]! + h[4]!, jahr: h[4]! };
  return { vor, zahl: Number(m[2]), breite: m[2]!.length, nach: "", jahr: null };
}

const zusammen = (t: NummerTeile, zahl: number) => `${t.vor}${String(zahl).padStart(t.breite, "0")}${t.nach}`;

/**
 * Nächste fortlaufende Nummer, z. B. „2026-014“ → „2026-015“, „12/2026“ → „13/2026“. Zählt im Schema der höchsten Nummer
 * des Jahres weiter. Gibt es im Jahr noch keine, wird das Schema der jüngsten Vorjahresnummer übernommen – Jahr ersetzt,
 * Zahl auf 1 in gleicher Breite („RE-2026-0099“ → „RE-2027-0001“; ein Monat direkt nach dem Jahr wird „01“). Ohne
 * Vorjahr beginnt sie mit „JJJJ-001“. Nummern ohne Jahreszahl zählen weiter, wenn es nur solche gibt.
 */
export function naechsteNummer(vorhandene: string[], jahr: string): string {
  const teile = vorhandene.map((n) => nummerTeile(n.trim())).filter((t): t is NummerTeile => Boolean(t));
  const imJahr = teile.filter((t) => t.jahr === jahr);
  if (imJahr.length) {
    const max = imJahr.reduce((a, b) => (b.zahl > a.zahl ? b : a));
    return zusammen(max, max.zahl + 1);
  }
  const mitJahr = teile.filter((t) => t.jahr !== null);
  if (mitJahr.length) {
    // jüngstes Vorjahr, darin die höchste Zahl – dessen Schema mit dem neuen Jahr
    const vorlage = mitJahr.reduce((a, b) => (b.jahr! > a.jahr! || (b.jahr === a.jahr && b.zahl > a.zahl) ? b : a));
    const alt = vorlage.jahr!;
    const tausch = (s: string) => {
      const i = s.lastIndexOf(alt);
      if (i < 0) return s;
      // „2026-12-“: Monat nach dem Jahr gehört zum alten Jahr – im neuen beginnt er mit Januar
      const rest = s.slice(i + 4).replace(/^([-/.]?)(0[1-9]|1[0-2])(?=[-/.])/, (_, trenner: string) => `${trenner}01`);
      return s.slice(0, i) + jahr + rest;
    };
    const neu = { ...vorlage, vor: vorlage.nach ? vorlage.vor : tausch(vorlage.vor), nach: vorlage.nach ? tausch(vorlage.nach) : "" };
    return zusammen(neu, 1);
  }
  if (!teile.length) return `${jahr}-001`;
  const max = teile.reduce((a, b) => (b.zahl > a.zahl ? b : a));
  return zusammen(max, max.zahl + 1);
}

const TRENNER = [". ", "; ", " durch ", " (", ": ", " – ", ", "];

/**
 * Mögliche Schnittstellen eines Titels, aufsteigend: Trenner ab dem 12. Zeichen (davor wäre der Titel zu knapp), nie
 * innerhalb einer Klammer, und der Rest endet auf ein Hauptwort bzw. eine Zahl – „Spitze, scharfe“ wäre ein halber Titel.
 */
function schnitte(s: string): number[] {
  const tiefe: number[] = [];
  let t = 0;
  for (const z of s) {
    if (z === "(") t++;
    tiefe.push(t);
    if (z === ")") t = Math.max(0, t - 1);
  }
  const r = new Set<number>();
  for (const trenner of TRENNER)
    for (let i = s.indexOf(trenner); i >= 0; i = s.indexOf(trenner, i + 1)) {
      if (i < 12 || tiefe[i] !== 0) continue;
      const letztes = /(\S+)$/.exec(s.slice(0, i))?.[1] ?? "";
      // Satzende, keine Abkürzung („z. B.“, „Nr.“, „bzw.“)
      if (trenner === ". " && (letztes.length < 3 || /^(bzw|ggf|usw|etc|vgl|Abs|inkl|evtl|max|min|ca|Std|Tel)$/i.test(letztes))) continue;
      if (/^[\p{Lu}\d]/u.test(letztes) || /[)\d]$/.test(letztes)) r.add(i);
    }
  return [...r].sort((a, b) => a - b);
}

function gekuerzt(s: string, stufe: number): { text: string; weiter: boolean } {
  const l = schnitte(s);
  if (stufe < l.length) return { text: s.slice(0, l[stufe]), weiter: true };
  if (s.length <= 70 || stufe > l.length) return { text: s, weiter: false };
  // nicht in einer Klammer abschneiden („… hinterlegt (z. B. …“): dann vor der Klammer kürzen
  let t = s.slice(0, 60).replace(/\s+\S*$/, "");
  const klammer = t.lastIndexOf("(");
  if (klammer > 0 && !t.includes(")", klammer)) t = t.slice(0, klammer).trimEnd();
  return { text: `${t} …`, weiter: true };
}

/** Kurzer Titel für lange Vorschläge, z. B. „Ausrutschen, Stolpern und Stürzen durch glatte Böden …“ → „Ausrutschen, Stolpern und Stürzen“. */
export function kurztitel(t: string): string {
  return gekuerzt(t.trim().replace(/\.$/, ""), 0).text;
}

/**
 * Kurze Titel für eine ganze Liste: Ergeben zwei Titel denselben Kurztitel („Färben, Dauerwelle“ zweimal), werden beide
 * bis zum nächsten Trenner verlängert – so lange, bis sie sich unterscheiden (notfalls der volle Titel).
 */
export function kurztitelListe(titel: string[]): string[] {
  const s = titel.map((t) => t.trim().replace(/\.$/, ""));
  const stufe = s.map(() => 0);
  for (let runde = 0; runde < 20; runde++) {
    const r = s.map((x, i) => gekuerzt(x, stufe[i]!));
    const gruppen = new Map<string, number[]>();
    r.forEach((x, i) => gruppen.set(x.text, [...(gruppen.get(x.text) ?? []), i]));
    let geaendert = false;
    for (const [, idx] of gruppen) {
      // gleicher Volltitel: verlängern hilft nicht
      if (idx.length < 2 || new Set(idx.map((i) => s[i])).size < 2) continue;
      for (const i of idx)
        if (r[i]!.weiter) {
          stufe[i]!++;
          geaendert = true;
        }
    }
    if (!geaendert) return r.map((x) => x.text);
  }
  return s.map((x, i) => gekuerzt(x, stufe[i]!).text);
}
