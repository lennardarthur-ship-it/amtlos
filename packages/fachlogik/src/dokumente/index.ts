/** Dokumentvorlagen (E-121): Verzeichnis und Hilfen für Formulare. */
import { betriebsanweisung, gefaehrdungsbeurteilung, gefahrstoffverzeichnis, unterweisung } from "./arbeitsschutz.js";
import { allergenAushang, haccp, hautschutzplan, hygieneplan, ifsgBelehrung } from "./branchen.js";
import { datenpanne, datenschutzDokumentation, datenschutzinformation } from "./datenschutz.js";
import { kiKompetenz, nachweisArbeitsbedingungen } from "./personal.js";
import { verfahrensdokumentation } from "./steuern.js";
import type { Bereich, Betrieb, Daten, EinfachesFeld, Eintrag, Feld, Vorlage } from "./typen.js";

export * from "./typen.js";
export { ALLERGENE, DATENPANNE_RISIKO, GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, SCHUTZZIELE } from "./konstanten.js";
export { PRUEFHINWEIS } from "./html.js";
export { berlinZuUtc } from "./datenschutz.js";

export const BEREICHE: { id: Bereich; titel: string }[] = [
  { id: "arbeitsschutz", titel: "Arbeitsschutz" },
  { id: "datenschutz", titel: "Datenschutz" },
  { id: "personal", titel: "Personal" },
  { id: "steuern", titel: "Steuern" },
  { id: "gastro", titel: "Gastronomie und Lebensmittel" },
  { id: "beauty", titel: "Beauty und Kosmetik" },
];

export const VORLAGEN: Vorlage[] = [
  gefaehrdungsbeurteilung,
  unterweisung,
  gefahrstoffverzeichnis,
  betriebsanweisung,
  datenschutzDokumentation,
  datenschutzinformation,
  datenpanne,
  nachweisArbeitsbedingungen,
  kiKompetenz,
  verfahrensdokumentation,
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
  if (f.wenn.ist !== undefined) return w === f.wenn.ist;
  return w === true || (typeof w === "string" && w !== "") || (Array.isArray(w) && w.length > 0);
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
    case "wahl":
      return f.vorbelegung ?? null;
    case "schalter":
      return f.vorbelegung ?? false;
    case "mehrfach":
      return [];
  }
}

/** Neuer Listeneintrag mit Startwerten. */
export function neuerEintrag(f: Extract<Feld, { art: "liste" }>, b: Betrieb, heute: string): Eintrag {
  return Object.fromEntries(f.felder.map((x) => [x.id, startwert(x, b, heute)]));
}

/** Startwerte einer neuen Unterlage, mit Angaben aus „Mein Betrieb“ und dem heutigen Datum. Listen beginnen mit einem Eintrag. */
export function leereDaten(v: Vorlage, b: Betrieb, heute: string): Daten {
  const d: Daten = {};
  for (const a of v.abschnitte) for (const f of a.felder) d[f.id] = f.art === "liste" ? [neuerEintrag(f, b, heute)] : startwert(f, b, heute);
  return d;
}

const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w !== null && w !== undefined);

/** Fehlende Pflichtangaben als lesbare Bezeichnungen („Gefährdung 2: Maßnahme“). Hindert das Erstellen nicht. */
export function fehlendeAngaben(v: Vorlage, d: Daten): string[] {
  const fehlt: string[] = [];
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (!sichtbar(f, d)) continue;
      if (f.art === "liste") {
        const eintraege = (Array.isArray(d[f.id]) ? d[f.id] : []) as Eintrag[];
        const benutzt = eintraege.filter((e) => f.felder.some((x) => x.art !== "wahl" && x.art !== "schalter" && x.art !== "datum" && gefuellt(e[x.id])));
        if (f.pflicht && !benutzt.length) fehlt.push(`mindestens ein Eintrag: ${f.eintrag}`);
        benutzt.forEach((e, i) => {
          for (const x of f.felder) if (x.pflicht && sichtbar(x, e) && !gefuellt(e[x.id])) fehlt.push(`${f.eintrag}${benutzt.length > 1 ? ` ${i + 1}` : ""}: ${x.label}`);
        });
      } else if (f.pflicht && !gefuellt(d[f.id])) fehlt.push(f.label);
    }
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

export function dokumentHtml(v: Vorlage, d: Daten, b: Betrieb): string {
  return v.html(d, b);
}
