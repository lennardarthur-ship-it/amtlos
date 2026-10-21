/** Dokumentvorlagen (E-121): Verzeichnis und Hilfen für Formulare. */
import { betriebsanweisung, elektroPruefung, gefaehrdungsbeurteilung, gefahrstoffverzeichnis, unterweisung } from "./arbeitsschutz.js";
import { gewerbeanmeldung, handelsregister, transparenzregister } from "./betrieb.js";
import { aufbewahrung, bilanzGuv, euer, kassenbuch, kassenmeldung, rechnung, steuererklaerung, ustVoranmeldung } from "./buchhaltung.js";
import { arbeitszeitnachweis, lohnkonto, svMeldedaten } from "./lohn.js";
import { auftragsverarbeitung, datenschutzerklaerungWebsite, impressum } from "./website.js";
import { allergenAushang, haccp, hautschutzplan, hygieneplan, ifsgBelehrung } from "./branchen.js";
import { anamnese, datenpanne, datenschutzDokumentation, datenschutzinformation } from "./datenschutz.js";
import { ausweisHinweis, kiKompetenz, nachweisArbeitsbedingungen, schluesselquittung } from "./personal.js";
import { verfahrensdokumentation } from "./steuern.js";
import { pdfDateiname } from "../dateinamen.js";
import { GESTALT_MARKE, GRUNDLAGE_MARKE, RAENDER, RAENDER_MARKE, SEITE_MARKE, cent, esc, festeLeerzeichen, kennungFassen, seiteCss, zahl } from "./html.js";
import type { Bereich, Betrieb, Daten, EinfachesFeld, Eintrag, Feld, Vorlage, Vorschlag } from "./typen.js";

export * from "./typen.js";
export { ALLERGENE, DATENPANNE_RISIKO, GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, SCHUTZZIELE } from "./konstanten.js";
export { HAUSFARBEN, PRUEFHINWEIS, RAENDER, akzent, fussSpalten, type Gestalt } from "./html.js";
export { BUNDESLAENDER, aufsichtFuer, berlinZuUtc } from "./datenschutz.js";
export { mindestlohnAm, mindesturlaub, minijobGrenzeAm, stundenlohn } from "./personal.js";
export { bausteinText } from "./website.js";
export { EUER_KAPITALGESELLSCHAFT, GUTSCHRIFT_AUSWAHL, RECHNUNG_NEGATIV, RECHNUNG_NULL, RECHNUNG_PLZ_FEHLT, VERSTEUERUNG, VORSTEUER_AUFTEILEN, aufbewahrenBis, eRechnungAus, faelligAm, kennzahlBefreiung, leistungszeitraumAus, rechnungsTitel } from "./buchhaltung.js";
// R10 Steuer
export { NULLSATZ_HINWEIS, RECHNUNG_13B_TEXT, RECHNUNG_EU_19, RECHNUNG_GUTSCHRIFT_STEUER, RECHNUNG_KU_DRITTLAND, RECHNUNG_KU_EU, RECHNUNG_KU_IGL, RECHNUNG_KU_PROFIL, RECHNUNG_KU_RC, RECHNUNG_LEITWEG, UST_FRIST, UST_FRIST_DFV, drittlandLand, euUnternehmenLand, istNullsatzText, istOeffentlicherEmpfaenger, kuFuer } from "./buchhaltung.js";
export { RECHNUNG_SKONTO_FALSCH, RECHNUNG_SKONTO_FRIST, RECHNUNG_SKONTO_HOCH, skontoFuer } from "./buchhaltung.js";
export { istKapitalgesellschaft, mitVertretung } from "./betrieb.js";
export { STEUERKLASSEN, arbeitsminuten, monatAus } from "./lohn.js";
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
  ausweisHinweis,
  schluesselquittung,
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
  anamnese,
];

export function vorlageFuer(id: string): Vorlage | undefined {
  return VORLAGEN.find((v) => v.id === id);
}

/**
 * Branchengruppen der Bausteine (R10) je Branche aus dem Pflichten-Check („taetigkeit.branchen“). Ohne passende
 * Branche (z. B. Transport, Gesundheit, Andere) filtert die App nicht.
 */
export const BRANCHEN_GRUPPEN: Record<string, string[]> = {
  gastronomie_lebensmittel: ["gastro_cafe"],
  beauty_kosmetik: ["friseur", "kosmetik"],
  handwerk: ["handwerk_allgemein"],
  bau: ["handwerk_allgemein"],
  onlinehandel: ["buero_laden"],
  it_agentur_freelancer: ["buero_laden"],
  immobilien_finanzen: ["buero_laden"],
  // R11 (Reinigung): eigene Gruppe für Bausteine und Vorbelegungen der Gebäudereinigung
  gebaeudereinigung: ["gebaeudereinigung"],
};

/** Branchengruppen eines Betriebs aus den Branchen im Pflichten-Check. */
export function gruppenAusBranchen(branchen: unknown): string[] {
  return Array.isArray(branchen) ? [...new Set(branchen.flatMap((b) => BRANCHEN_GRUPPEN[String(b)] ?? []))] : [];
}

/** Passt ein Baustein mit diesen Gruppen zum Betrieb? Ohne Gruppen am Baustein oder ohne bekannte Branche: ja. */
export function passtZuGruppen(baustein: string[] | undefined, meine: readonly string[]): boolean {
  return !baustein?.length || !meine.length || baustein.includes("alle") || baustein.some((g) => meine.includes(g));
}

/** Platzhalter „…“ in einem Vorschlag (z. B. „Guten Tag …“): wer ihn wählt, ergänzt den Namen. */
export const PLATZHALTER = "…";
/** Steht in einem Textfeld noch ein Platzhalter aus einem Vorschlag (z. B. „Sehr geehrte Frau …“)? */
export function platzhalterOffen(f: Feld, w: unknown): boolean {
  return (f.art === "text" || f.art === "mehrzeilig") && Boolean(f.vorschlaege?.some((x) => x.includes(PLATZHALTER))) && typeof w === "string" && w.includes(PLATZHALTER);
}
/** Bezeichnung für „Fehlt noch“, z. B. „Anrede: Name statt „…“ eintragen“. */
export const platzhalterText = (f: Feld) => `${f.label}: Name statt „${PLATZHALTER}“ eintragen`;
/** „Fehlt noch“, wenn der Betrieb keinen Namen hat (R10): Ohne ihn bleibt der Kopf jedes PDFs leer. */
export const BETRIEBSNAME_FEHLT = "Name des Betriebs (Mein Betrieb)";

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

function startwert(f: EinfachesFeld, b: Betrieb, heute: string, gruppen?: readonly string[]): string | boolean | string[] | null {
  switch (f.art) {
    case "text":
    case "mehrzeilig":
      // Vorbelegung nur für bestimmte Branchen (z. B. Inhaber als prüfende Elektrofachkraft im Handwerk)
      if (f.vorbelegungGruppen && !f.vorbelegungGruppen.some((g) => gruppen?.includes(g))) return "";
      if (typeof f.vorbelegung === "object") return f.vorbelegung.text;
      return f.vorbelegung === "verantwortlich" ? b.verantwortlich : f.vorbelegung === "betrieb_kontakt" ? [b.verantwortlich, b.telefon, b.email].filter((x) => x.trim()).join(", ") : "";
    case "datum":
      return f.vorbelegung === "heute" ? heute : null;
    case "uhrzeit":
      return "";
    case "betrag":
    case "zahl":
      return f.vorbelegung ?? "";
    case "wahl": {
      const je = f.vorbelegungJe ? gruppen?.map((g) => f.vorbelegungJe![g]).find((w) => w !== undefined) : undefined;
      return je ?? f.vorbelegung ?? null;
    }
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

/**
 * Startwerte einer neuen Unterlage, mit Angaben aus „Mein Betrieb“ und dem heutigen Datum. Listen beginnen mit einem
 * Eintrag. `gruppen`: Branchengruppen des Betriebs (für Vorbelegungen, die nur in bestimmten Branchen passen).
 */
export function leereDaten(v: Vorlage, b: Betrieb, heute: string, gruppen?: readonly string[]): Daten {
  const d: Daten = {};
  for (const a of v.abschnitte)
    for (const f of a.felder) d[f.id] = f.art === "liste" ? (f.start ? f.start.map((e) => ({ ...neuerEintrag(f, b, heute), ...e })) : f.leerStarten ? [] : [neuerEintrag(f, b, heute)]) : startwert(f, b, heute, gruppen);
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
  const frei = new Set(v.nichtPflicht?.(d) ?? []);
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (!sichtbar(f, sichtbar_)) continue;
      if (f.art === "liste") {
        const eintraege = (Array.isArray(d[f.id]) ? d[f.id] : []) as Eintrag[];
        const genutzt = eintraege.filter((e) => benutzt(f, e));
        // R11 (UX #15): ohne zweiten Doppelpunkt hinter „Fehlt:“
        if (f.pflicht && !genutzt.length) fehlt.push(`mindestens ein Eintrag „${f.eintrag}“`);
        genutzt.forEach((e, i) => {
          const vor = `${f.eintrag}${genutzt.length > 1 ? ` ${i + 1}` : ""}: `;
          for (const x of f.felder) {
            if (!sichtbar(x, ohneVerdeckteFelder(f.felder, e))) continue;
            if (x.pflicht && !gefuellt(e[x.id])) fehlt.push(`${vor}${x.label}`);
            else if (unlesbar(x, e[x.id])) fehlt.push(`${vor}${unlesbarText(x)}`);
            else if (platzhalterOffen(x, e[x.id])) fehlt.push(`${vor}${platzhalterText(x)}`);
          }
        });
      } else if (f.pflicht && !frei.has(f.id) && !gefuellt(d[f.id])) fehlt.push(f.label);
      else if (unlesbar(f, d[f.id])) fehlt.push(unlesbarText(f));
      // „Guten Tag …“ (R10): ein nicht ersetzter Platzhalter stünde wörtlich auf dem PDF
      else if (platzhalterOffen(f, d[f.id])) fehlt.push(platzhalterText(f));
    }
  if (b && v.pruefen) fehlt.push(...v.pruefen(d, b));
  // ohne Namen des Betriebs bleibt der Kopf leer (R10) – eine Kontrolle kann das Blatt keinem Betrieb zuordnen. Prüfungen
  // der Vorlage, die den Namen schon nennen („Name und Anschrift …“), reichen.
  if (b && !b.name.trim() && !fehlt.some((x) => /^Name\b.*\(Mein Betrieb\)/.test(x))) fehlt.push(BETRIEBSNAME_FEHLT);
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
