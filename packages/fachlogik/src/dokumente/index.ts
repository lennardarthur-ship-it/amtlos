/** Dokumentvorlagen (E-121): Verzeichnis und Hilfen für Formulare. */
import { betriebsanweisung, elektroPruefung, gefaehrdungsbeurteilung, gefahrstoffverzeichnis, unterweisung } from "./arbeitsschutz.js";
import { gewerbeanmeldung, handelsregister, transparenzregister } from "./betrieb.js";
import { aufbewahrung, bilanzGuv, euer, kassenbuch, kassenmeldung, rechnung, steuererklaerung, ustVoranmeldung } from "./buchhaltung.js";
import { arbeitszeitnachweis, lohnkonto, svMeldedaten } from "./lohn.js";
import { auftragsverarbeitung, datenschutzerklaerungWebsite, impressum } from "./website.js";
import { allergenAushang, haccp, hautschutzplan, hygieneplan, ifsgBelehrung } from "./branchen.js";
import { datenpanne, datenschutzDokumentation, datenschutzinformation } from "./datenschutz.js";
import { kiKompetenz, nachweisArbeitsbedingungen } from "./personal.js";
import { verfahrensdokumentation } from "./steuern.js";
import { GRUNDLAGE_MARKE, esc } from "./html.js";
import type { Bereich, Betrieb, Daten, EinfachesFeld, Eintrag, Feld, Vorlage, Vorschlag } from "./typen.js";

export * from "./typen.js";
export { ALLERGENE, DATENPANNE_RISIKO, GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, SCHUTZZIELE } from "./konstanten.js";
export { PRUEFHINWEIS } from "./html.js";
export { BUNDESLAENDER, aufsichtFuer, berlinZuUtc } from "./datenschutz.js";
export { mindestlohnAm, mindesturlaub, stundenlohn } from "./personal.js";
export { bausteinText } from "./website.js";
export { aufbewahrenBis, eRechnungAus } from "./buchhaltung.js";
export { STEUERKLASSEN, arbeitsminuten } from "./lohn.js";
export { ANLAESSE, KURZ, PERSONEN_FELDER, kurztitel, naechsteNummer, personAus, personIn, personMerken, type Anlass } from "./ablauf.js";
export { cent } from "./html.js";

export const BEREICHE: { id: Bereich; titel: string }[] = [
  { id: "steuern", titel: "Steuern und Buchhaltung" },
  { id: "datenschutz", titel: "Datenschutz" },
  { id: "personal", titel: "Personal" },
  { id: "arbeitsschutz", titel: "Arbeitsschutz" },
  { id: "betrieb", titel: "Betrieb, Register und Website" },
  { id: "gastro", titel: "Gastronomie und Lebensmittel" },
  { id: "beauty", titel: "Beauty und Kosmetik" },
];

export const VORLAGEN: Vorlage[] = [
  // Steuern und Buchhaltung
  rechnung,
  euer,
  bilanzGuv,
  ustVoranmeldung,
  steuererklaerung,
  verfahrensdokumentation,
  kassenbuch,
  kassenmeldung,
  aufbewahrung,
  // Datenschutz
  datenschutzDokumentation,
  datenschutzerklaerungWebsite,
  auftragsverarbeitung,
  datenschutzinformation,
  datenpanne,
  // Personal
  arbeitszeitnachweis,
  nachweisArbeitsbedingungen,
  svMeldedaten,
  lohnkonto,
  kiKompetenz,
  // Arbeitsschutz
  gefaehrdungsbeurteilung,
  unterweisung,
  gefahrstoffverzeichnis,
  betriebsanweisung,
  elektroPruefung,
  // Betrieb, Register, Website
  impressum,
  gewerbeanmeldung,
  handelsregister,
  transparenzregister,
  // Branchen
  ifsgBelehrung,
  allergenAushang,
  haccp,
  hautschutzplan,
  hygieneplan,
];

export function vorlageFuer(id: string): Vorlage | undefined {
  return VORLAGEN.find((v) => v.id === id);
}

/** Ist ein Feld angesichts der übrigen Eingaben sichtbar? */
export function sichtbar(f: Feld, d: Daten | Eintrag): boolean {
  if (!f.wenn) return true;
  const w = d[f.wenn.feld];
  const erfuellt =
    f.wenn.ist !== undefined ? (Array.isArray(w) ? (w as unknown[]).includes(f.wenn.ist) : w === f.wenn.ist) : w === true || (typeof w === "string" && w !== "") || (Array.isArray(w) && w.length > 0);
  return f.wenn.nicht ? !erfuellt : erfuellt;
}

function startwert(f: EinfachesFeld, b: Betrieb, heute: string): string | boolean | string[] | null {
  switch (f.art) {
    case "text":
    case "mehrzeilig":
      return f.vorbelegung === "verantwortlich" ? b.verantwortlich : f.vorbelegung === "betrieb_kontakt" ? [b.verantwortlich, b.telefon, b.email].filter((x) => x.trim()).join(", ") : "";
    case "datum":
      return f.vorbelegung === "heute" ? heute : null;
    case "uhrzeit":
      return "";
    case "betrag":
    case "zahl":
      return f.vorbelegung ?? "";
    case "wahl":
      return f.vorbelegung ?? null;
    case "schalter":
      return f.vorbelegung ?? false;
    case "mehrfach":
      return [];
    case "bausteine":
      return f.vorbelegung ? [...f.vorbelegung] : [];
  }
}

/** Neuer Listeneintrag mit Startwerten. */
export function neuerEintrag(f: Extract<Feld, { art: "liste" }>, b: Betrieb, heute: string): Eintrag {
  return Object.fromEntries(f.felder.map((x) => [x.id, startwert(x, b, heute)]));
}

/** Startwerte einer neuen Unterlage, mit Angaben aus „Mein Betrieb“ und dem heutigen Datum. Listen beginnen mit einem Eintrag. */
export function leereDaten(v: Vorlage, b: Betrieb, heute: string): Daten {
  const d: Daten = {};
  for (const a of v.abschnitte)
    for (const f of a.felder) d[f.id] = f.art === "liste" ? (f.start ? f.start.map((e) => ({ ...neuerEintrag(f, b, heute), ...e })) : f.leerStarten ? [] : [neuerEintrag(f, b, heute)]) : startwert(f, b, heute);
  return d;
}

const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w !== null && w !== undefined);

/** Hat der Nutzer in einem Listeneintrag etwas eingetragen? Vorbelegte Felder (Datum, Auswahl, Menge …) zählen nicht. */
function benutzt(f: Extract<Feld, { art: "liste" }>, e: Eintrag): boolean {
  return f.felder.some((x) => (x.art === "text" || x.art === "mehrzeilig" || x.art === "betrag" || x.art === "zahl" || x.art === "uhrzeit" || x.art === "mehrfach" || x.art === "bausteine") && !("vorbelegung" in x && x.vorbelegung) && gefuellt(e[x.id]));
}

/** Fehlende Pflichtangaben als lesbare Bezeichnungen („Gefährdung 2: Maßnahme“). Hindert das Erstellen nicht. */
export function fehlendeAngaben(v: Vorlage, d: Daten, b?: Betrieb): string[] {
  const fehlt: string[] = [];
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (!sichtbar(f, d)) continue;
      if (f.art === "liste") {
        const eintraege = (Array.isArray(d[f.id]) ? d[f.id] : []) as Eintrag[];
        const genutzt = eintraege.filter((e) => benutzt(f, e));
        if (f.pflicht && !genutzt.length) fehlt.push(`mindestens ein Eintrag: ${f.eintrag}`);
        genutzt.forEach((e, i) => {
          for (const x of f.felder) if (x.pflicht && sichtbar(x, e) && !gefuellt(e[x.id])) fehlt.push(`${f.eintrag}${genutzt.length > 1 ? ` ${i + 1}` : ""}: ${x.label}`);
        });
      } else if (f.pflicht && !gefuellt(d[f.id])) fehlt.push(f.label);
    }
  if (b && v.pruefen) fehlt.push(...v.pruefen(d, b));
  return fehlt;
}

/** Name einer Unterlage in der Übersicht, z. B. „Gefährdungsbeurteilung · Küche“. */
export function unterlagenName(v: Vorlage, d: Daten): string {
  const zusatz = v.namensFeld && typeof d[v.namensFeld] === "string" ? (d[v.namensFeld] as string).trim().split("\n")[0]!.slice(0, 40) : "";
  return zusatz ? `${v.titel} · ${zusatz}` : v.titel;
}

/** Dateiname für das PDF, nur mit unbedenklichen Zeichen. */
export function dateiname(v: Vorlage, d: Daten, datum: string): string {
  const roh = `${unterlagenName(v, d).replace(" · ", " ")} ${datum}`;
  const s = roh.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss");
  return `${s.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)}.pdf`;
}

/** Vorschlag als Listeneintrag mit Startwerten für alle Felder. */
export function eintragAusVorschlag(f: Extract<Feld, { art: "liste" }>, vorschlag: Vorschlag, b: Betrieb, heute: string): Eintrag {
  return { ...neuerEintrag(f, b, heute), ...vorschlag.werte };
}

/** Das fertige Dokument: Vorlage + Rechtsgrundlage und Bereich im Kopf. Die App erstellt das PDF hieraus. */
export function dokumentHtml(v: Vorlage, d: Daten, b: Betrieb): string {
  const grundlage = v.grundlage && !v.kundendokument ? `<div><dt>Rechtsgrundlage</dt><dd>${esc(v.grundlage)}</dd></div>` : "";
  const art = v.kundendokument ? "" : (BEREICHE.find((x) => x.id === v.bereich)?.titel ?? "");
  return v.html(d, b).replace(GRUNDLAGE_MARKE, grundlage).replace('<div class="art"></div>', `<div class="art">${esc(art)}</div>`);
}
