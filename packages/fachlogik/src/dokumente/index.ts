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
import { pdfDateiname } from "../dateinamen.js";
import { GESTALT_MARKE, GRUNDLAGE_MARKE, RAENDER, RAENDER_MARKE, SEITE_MARKE, cent, esc, festeLeerzeichen, kennungFassen, seiteCss, zahl } from "./html.js";
import type { Bereich, Betrieb, Daten, EinfachesFeld, Eintrag, Feld, Vorlage, Vorschlag } from "./typen.js";

export * from "./typen.js";
export { ALLERGENE, DATENPANNE_RISIKO, GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, SCHUTZZIELE } from "./konstanten.js";
export { HAUSFARBEN, PRUEFHINWEIS, RAENDER, akzent, fussSpalten, type Gestalt } from "./html.js";
export { BUNDESLAENDER, aufsichtFuer, berlinZuUtc } from "./datenschutz.js";
export { mindestlohnAm, mindesturlaub, stundenlohn } from "./personal.js";
export { bausteinText } from "./website.js";
export { EUER_KAPITALGESELLSCHAFT, GUTSCHRIFT_AUSWAHL, RECHNUNG_NEGATIV, RECHNUNG_NULL, RECHNUNG_PLZ_FEHLT, VERSTEUERUNG, VORSTEUER_AUFTEILEN, aufbewahrenBis, eRechnungAus, faelligAm, kennzahlBefreiung, leistungszeitraumAus, rechnungsTitel } from "./buchhaltung.js";
export { istKapitalgesellschaft, mitVertretung } from "./betrieb.js";
export { STEUERKLASSEN, arbeitsminuten } from "./lohn.js";
export { ANLAESSE, KURZ, PERSONEN_FELDER, kurztitel, kurztitelListe, naechsteNummer, personAus, personIn, personMerken, type Anlass } from "./ablauf.js";
export { cent, zahl } from "./html.js";

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
  const werte = f.wenn.ist === undefined ? undefined : Array.isArray(f.wenn.ist) ? f.wenn.ist : [f.wenn.ist];
  const erfuellt =
    werte !== undefined ? werte.some((ist) => (Array.isArray(w) ? (w as unknown[]).includes(ist) : w === ist)) : w === true || (typeof w === "string" && w !== "") || (Array.isArray(w) && w.length > 0);
  return f.wenn.nicht ? !erfuellt : erfuellt;
}

/**
 * Eingaben einer Feldliste (Schritt oder Listeneintrag) ohne verdeckte Felder – mit Kaskade: Hängt ein Feld an einem
 * verdeckten Feld, ist es selbst verdeckt. Formular, Papieransicht, Prüfung und Dokument sehen so dasselbe.
 */
export function ohneVerdeckteFelder<T extends Daten | Eintrag>(felder: Feld[], d: T): T {
  const r = { ...d } as Record<string, unknown>;
  for (const f of felder) if (!sichtbar(f, r as T)) delete r[f.id];
  return r as T;
}

function startwert(f: EinfachesFeld, b: Betrieb, heute: string): string | boolean | string[] | null {
  switch (f.art) {
    case "text":
    case "mehrzeilig":
      if (typeof f.vorbelegung === "object") return f.vorbelegung.text;
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

/** Betrag oder Zahl eingetragen, aber nicht lesbar („45 Euro“, „1,234.56“) – im Dokument stünde sonst 0,00 €. */
export function unlesbar(f: Feld, w: unknown): boolean {
  if (f.art !== "betrag" && f.art !== "zahl") return false;
  return typeof w === "string" && w.trim() !== "" && (f.art === "betrag" ? cent(w) : zahl(w)) === null;
}
/** Bezeichnung für „Fehlt noch“, z. B. „Preis nicht lesbar (z. B. 45,00)“. */
export function unlesbarText(f: Feld): string {
  if (f.id === "preis") return "Preis nicht lesbar (z. B. 45,00)";
  const name = f.label.replace(/\s*\(€\)\s*$/, "");
  return f.art === "zahl" ? `${name} nicht lesbar (z. B. 1,5)` : `${name} nicht lesbar (z. B. 12,50)`;
}

/** Fehlende Pflichtangaben als lesbare Bezeichnungen („Gefährdung 2: Maßnahme“). Hindert das Erstellen nicht. */
export function fehlendeAngaben(v: Vorlage, d: Daten, b?: Betrieb): string[] {
  const fehlt: string[] = [];
  const sichtbar_ = ohneVerdeckte(v, d);
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (!sichtbar(f, sichtbar_)) continue;
      if (f.art === "liste") {
        const eintraege = (Array.isArray(d[f.id]) ? d[f.id] : []) as Eintrag[];
        const genutzt = eintraege.filter((e) => benutzt(f, e));
        if (f.pflicht && !genutzt.length) fehlt.push(`mindestens ein Eintrag: ${f.eintrag}`);
        genutzt.forEach((e, i) => {
          const vor = `${f.eintrag}${genutzt.length > 1 ? ` ${i + 1}` : ""}: `;
          for (const x of f.felder) {
            if (!sichtbar(x, ohneVerdeckteFelder(f.felder, e))) continue;
            if (x.pflicht && !gefuellt(e[x.id])) fehlt.push(`${vor}${x.label}`);
            else if (unlesbar(x, e[x.id])) fehlt.push(`${vor}${unlesbarText(x)}`);
          }
        });
      } else if (f.pflicht && !gefuellt(d[f.id])) fehlt.push(f.label);
      else if (unlesbar(f, d[f.id])) fehlt.push(unlesbarText(f));
    }
  if (b && v.pruefen) fehlt.push(...v.pruefen(d, b));
  return fehlt;
}

/** Text auf höchstens `max` Zeichen, am Wortende gekürzt mit „…“ (ein einzelnes zu langes Wort hart). */
function kuerzen(t: string, max: number): string {
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max);
  const leer = schnitt.lastIndexOf(" ");
  return `${(leer >= max / 2 ? schnitt.slice(0, leer) : schnitt).replace(/[\s,;:–-]+$/, "")}…`;
}

/** Name einer Unterlage in der Übersicht, z. B. „Gefährdungsbeurteilung · Küche“. */
export function unterlagenName(v: Vorlage, d: Daten): string {
  const roh = v.namensFeld && typeof d[v.namensFeld] === "string" ? (d[v.namensFeld] as string).trim().split("\n")[0]! : "";
  // Datum deutsch (TT.MM.JJJJ); lange Namen am Wortende kürzen („…“) statt mitten im Wort
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(roh);
  const zusatz = iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : kuerzen(roh, 40);
  const titel = v.titelFuer?.(d) ?? v.titel;
  return zusatz ? `${titel} · ${zusatz}` : titel;
}

/** Dateiname für das PDF – siehe `pdfDateiname` (Umlaute umgeschrieben, Datum genau einmal und nie gekürzt). */
export const dateiname = (v: Vorlage, d: Daten, datum: string): string => pdfDateiname(v, d, datum);

/** Vorschlag als Listeneintrag mit Startwerten für alle Felder. */
export function eintragAusVorschlag(f: Extract<Feld, { art: "liste" }>, vorschlag: Vorschlag, b: Betrieb, heute: string): Eintrag {
  return { ...neuerEintrag(f, b, heute), ...vorschlag.werte };
}

/**
 * Eingaben ohne verdeckte Felder: Was die App gerade nicht zeigt (Bedingung `wenn` nicht erfüllt), gehört nicht ins
 * Dokument – auch wenn noch ein früher eingegebener Wert gespeichert ist. In Listen gilt das je Eintrag; Felder, die an
 * einem verdeckten Feld hängen, entfallen mit. Nur für die Ausgabe; gespeicherte Daten und die Prüfung bleiben unverändert.
 */
export function ohneVerdeckte(v: Vorlage, d: Daten): Daten {
  const r: Daten = { ...d };
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      // gegen die bereits bereinigten Angaben prüfen: hängt ein Feld an einem verdeckten Feld, ist es selbst verdeckt
      if (!sichtbar(f, r)) {
        delete r[f.id];
        continue;
      }
      if (f.art === "liste" && Array.isArray(d[f.id]) && f.felder.some((x) => x.wenn))
        r[f.id] = (d[f.id] as Eintrag[]).map((e) => {
          if (!e || typeof e !== "object") return e;
          const n: Eintrag = { ...e };
          for (const x of f.felder) if (!sichtbar(x, n)) delete n[x.id];
          return n;
        });
    }
  return r;
}

/** Das fertige Dokument: Vorlage + Rechtsgrundlage und Bereich im Kopf. Die App erstellt das PDF hieraus. */
export function dokumentHtml(v: Vorlage, d: Daten, b: Betrieb): string {
  // Kundendokumente und Aushänge für Gäste: ohne Rechtsgrundlage und Bereich – das ist für die eigenen Unterlagen
  const fuerAndere = v.kundendokument || v.ohneKopfangaben;
  const rg = v.grundlageFuer?.(d, b) || v.grundlage;
  const grundlage = rg && !fuerAndere ? `<div><dt>Rechtsgrundlage</dt><dd>${festeLeerzeichen(esc(rg))}</dd></div>` : "";
  // Aushänge: ohne Bereich der App (z. B. „Beauty und Kosmetik“ auf dem Hygieneplan eines Cafés) – er sagt dem Leser
  // an der Wand nichts und passt nicht immer zur Branche
  const art = fuerAndere || v.gestalt === "aushang" ? "" : (BEREICHE.find((x) => x.id === v.bereich)?.titel ?? "");
  return kennungFassen(v.html(ohneVerdeckte(v, d), b).replace(GRUNDLAGE_MARKE, grundlage)).replace('<div class="art"></div>', `<div class="art">${esc(art)}</div>`).split(GESTALT_MARKE).join(v.gestalt ?? "nachweis").replace(SEITE_MARKE, seiteCss(v.gestalt ?? "nachweis", v.querformat))
    .replace(RAENDER_MARKE, RAENDER[v.gestalt ?? "nachweis"].join(","));
}
