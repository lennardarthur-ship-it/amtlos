/**
 * E-196: Ausprägungen einer Vorlage für die Prüfsumme (`vorlagenPruefsumme`).
 *
 * Bis E-196 rechnete die Prüfsumme nur mit leerem Betrieb und den Startwerten bzw. allen Vorschlägen. Was erst mit
 * Angaben aus „Mein Betrieb“ (Fußzeile, Komplementärin einer GmbH & Co. KG, Registerangaben), mit einer bestimmten
 * Auswahl (Kleinunternehmer, Steuerschuldnerschaft des Leistungsempfängers, Schlussrechnung) oder als Storno gedruckt
 * wird, änderte die Prüfsumme nicht – der Prüfvermerk blieb stehen, obwohl sich der gedruckte Text geändert hatte (E-193).
 * Jetzt fließen ein:
 *   - Startwerte und „alles ausgewählt“ ohne Betrieb (wie bisher),
 *   - Startwerte und „alles ausgewählt“ für je einen erfundenen Beispielbetrieb je Rechtsform (alle 16 Länder kommen vor,
 *     dazu Kleinunternehmer mit Wechseldatum und Ist-Versteuerung) – samt Fußzeile und Kopfangaben (Meta-Angaben),
 *   - jede einzelne Auswahl (jede Option einer Wahl, jeder Schalter umgelegt, jeder Baustein bzw. jede Mehrfachoption
 *     allein) auf dem Stand „alles ausgewählt“ mit dem Beispielbetrieb GmbH & Co. KG,
 *   - Listen ohne Vorschläge mit je einem Beispieleintrag und je einem Eintrag für jede Option einer Wahl im Eintrag,
 *   - verdeckte Angaben, die die App selbst setzt (Rechnung: Storno, Storno einer Schlussrechnung mit Abschlägen).
 * Jede Textänderung, die in irgendeiner dieser Ausprägungen gedruckt wird, ändert damit die Prüfsumme.
 *
 * Das Modul hängt nur von den übergebenen Funktionen ab (kein Import aus index.ts), damit dieselbe Rechnung auch für
 * ältere Stände der Vorlagen laufen kann (Abgleich der freigegebenen Fassungen, E-196).
 */
import type { Betrieb, Daten, Eintrag, Feld, Vorlage, Vorschlag } from "./typen.js";

export interface PruefsummenApi {
  dokumentHtml(v: Vorlage, d: Daten, b: Betrieb): string;
  leereDaten(v: Vorlage, b: Betrieb, heute: string): Daten;
  eintragAusVorschlag(f: Extract<Feld, { art: "liste" }>, x: Vorschlag, b: Betrieb, heute: string): Eintrag;
  leererBetrieb: Betrieb;
}

/** Für die ganze Rechnung zusätzlich: Kurztexte, kanonisches JSON, SHA-256 und sichtbarer Text. */
export interface PruefstandApi extends PruefsummenApi {
  kurz: Readonly<Record<string, string>>;
  kanonisch(x: unknown): string;
  sha256(text: string): string;
  sichtbarerText(html: string): string;
}

export interface PruefstandErgebnis {
  /** SHA-256 (hex) über alle Ausprägungen */
  summe: string;
  /** Stellen mit „fachlich zu prüfen“ in Formular und gedruckten Ausprägungen */
  offen: number;
}

/**
 * Die ganze Rechnung der Prüfsumme (siehe vorlagenPruefstand in index.ts) – hier, damit sie mit denselben Zeilen auch für
 * ältere Stände der Vorlagen läuft.
 */
export function pruefstandBerechnen(v: Vorlage, freigabe: { fassung?: { feld: string; wert: string }; gruppen?: readonly string[]; rechtsformen?: readonly string[] } | undefined, api: PruefstandApi): PruefstandErgebnis {
  const passt = (x: Vorschlag) => !freigabe?.gruppen || freigabe.gruppen.includes(x.gruppe ?? "");
  const abschnitte = v.abschnitte.map((a) => ({ ...a, felder: a.felder.map((f) => (f.art === "liste" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.filter(passt) } : f)) }));
  const fassung: Daten = freigabe?.fassung ? { [freigabe.fassung.feld]: freigabe.fassung.wert } : {};
  const texte = pruefAuspraegungen(v, abschnitte, fassung, freigabe?.rechtsformen, api).map(({ d, b }) => gedruckterText(api.dokumentHtml(v, d, b), api.sichtbarerText));
  const formular = `vorlage:${api.kanonisch({ id: v.id, titel: v.titel, beschreibung: v.beschreibung, grundlage: v.grundlage, abschnitte })}`;
  const teile = [formular, `kurz:${api.kurz[v.id] ?? ""}`, ...texte.map((t, i) => `a${i}:${t}`)];
  const stellen = new Set<string>();
  for (const t of [formular, ...texte]) for (const m of t.matchAll(/[^.;:\n]{0,80}fachlich zu prüfen/g)) stellen.add(m[0]);
  return { summe: api.sha256(teile.join("\n")), offen: stellen.size };
}

/** Fester Stichtag – das Ergebnis hängt nicht vom heutigen Datum ab. */
export const PRUEFSUMME_TAG = "2026-01-01";

const LAENDER = ["Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"];
/** Rechtsformen der Beispielbetriebe – feste Liste, damit eine neue Auswahl in der App nicht alle Prüfsummen ändert */
export const PRUEF_RECHTSFORMEN = ["GmbH & Co. KG", "UG (haftungsbeschränkt) & Co. KG", "Einzelunternehmen", "e. K.", "GbR", "eGbR", "OHG", "KG", "PartG", "PartG mbB", "GmbH", "UG (haftungsbeschränkt)"];
const REGISTER: Record<string, string> = { "e. K.": "HRA 1001", eGbR: "GsR 1001", OHG: "HRA 1002", KG: "HRA 1003", "GmbH & Co. KG": "HRA 1004", "UG (haftungsbeschränkt) & Co. KG": "HRA 1005", PartG: "PR 1001", "PartG mbB": "PR 1002", GmbH: "HRB 1001", "UG (haftungsbeschränkt)": "HRB 1002" };

/** Erfundene Beispielbetriebe für die Prüfsumme (keine echten Namen). */
export function pruefBetriebe(leer: Betrieb, rechtsformen?: readonly string[]): Betrieb[] {
  const formen = PRUEF_RECHTSFORMEN.filter((r) => !rechtsformen?.length || rechtsformen.includes(r));
  const basis = (i: number): Betrieb => ({
    ...leer,
    strasse: `Musterstraße ${i + 1}`, plz: String(10115 + i * 3), ort: `Musterstadt ${i + 1}`, verantwortlich: "Alex Muster", telefon: "030 1234567", email: "info@muster.example",
    steuernummer: "12/345/67890", ust_idnr: "DE123456789", iban: "DE89370400440532013000", bank: "Musterbank", bic: "COBADEFFXXX", website: "www.muster.example",
    bundesland: LAENDER[i % LAENDER.length]!, versteuerung: "soll", farbe: "#1d4f7a",
  });
  const liste = formen.map((rf, i): Betrieb => {
    const co = rf.includes("& Co. KG");
    return {
      ...basis(i), name: `Muster ${rf}`, rechtsform: rf, registergericht: REGISTER[rf] ? "Amtsgericht Musterstadt" : "", registernummer: REGISTER[rf] ?? "",
      vertretung: rf === "Einzelunternehmen" ? "" : "Alex Muster, Kim Beispiel",
      ...(co ? { komplementaer: rf.startsWith("UG") ? "Muster Verwaltungs UG (haftungsbeschränkt)" : "Muster Verwaltungs GmbH", komplementaer_rechtsform: rf.startsWith("UG") ? "UG (haftungsbeschränkt)" : "GmbH", komplementaer_sitz: "Musterstadt", komplementaer_registergericht: "Amtsgericht Musterstadt", komplementaer_registernummer: "HRB 2001" } : {}),
    };
  });
  // übrige Länder (Landeszusätze) sowie Kleinunternehmer mit Wechsel und Ist-Versteuerung
  if (!rechtsformen?.length) {
    for (let i = liste.length; i < LAENDER.length; i++) liste.push({ ...basis(i), name: "Muster Einzelunternehmen", rechtsform: "Einzelunternehmen" });
    liste.push({ ...basis(2), name: "Muster Kleinunternehmen", rechtsform: "Einzelunternehmen", ust_idnr: "", ku_bis: "2026-06-30", versteuerung: "ist" });
  }
  return liste;
}

const MUSTER: Record<string, string> = { text: "Beispieltext", mehrzeilig: "Beispielzeile 1\nBeispielzeile 2", datum: PRUEFSUMME_TAG, uhrzeit: "08:30", betrag: "123,45", zahl: "2" };

/** Beispielwert eines einfachen Felds (für Listen ohne Vorschläge und für verdeckte Angaben). */
function musterWert(f: Feld): Daten[string] {
  switch (f.art) {
    case "wahl":
      return f.optionen[0]?.wert ?? "";
    case "schalter":
      return true;
    case "mehrfach":
    case "bausteine":
      return f.optionen.map((o) => o.wert);
    case "liste":
      return [];
    default:
      return MUSTER[f.art] ?? "Beispiel";
  }
}

/** Listeneinträge ohne Vorschläge: ein Beispieleintrag und je einer für jede Option einer Wahl im Eintrag. */
function musterEintraege(f: Extract<Feld, { art: "liste" }>): Eintrag[] {
  const grund: Eintrag = {};
  for (const x of f.felder) grund[x.id] = musterWert(x) as Eintrag[string];
  const mehr: Eintrag[] = [];
  for (const x of f.felder) if (x.art === "wahl") for (const o of x.optionen.slice(1)) mehr.push({ ...grund, [x.id]: o.wert });
  return [grund, ...mehr];
}

/** Verdeckte Angaben, die die App selbst setzt (nicht im Formular). */
const VERDECKT: Record<string, Daten[]> = {
  rechnung: [{ storno_zu: "RE-2026-0001" }, { storno_zu: "RE-2026-0001", schluss: true, storno_abschlaege: true }],
};

/** Sichtbarer Text eines Dokuments und die Meta-Angaben, die die App in Kopf- und Fußzeile druckt. */
export function gedruckterText(html: string, sichtbar: (h: string) => string): string {
  const ent = (s: string) => s.replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const meta = [...html.matchAll(/<meta name="amtlos-(fuss-links|fuss-rechts|fuss-spalten)" content="([^"]*)"/g)].map((m) => `${m[1]}=${ent(m[2]!)}`).join("|");
  return `${sichtbar(html)}${meta ? ` ‖ ${meta}` : ""}`;
}

/**
 * Alle Ausprägungen einer Vorlage (siehe oben). `abschnitte`: Abschnitte mit den Vorschlägen der Freigabe (Gruppen),
 * `fassung`: feste Angabe der Freigabe (wird nicht verändert), `rechtsformen`: nur Beispielbetriebe dieser Rechtsformen.
 */
export function pruefAuspraegungen(v: Vorlage, abschnitte: Vorlage["abschnitte"], fassung: Daten, rechtsformen: readonly string[] | undefined, api: PruefsummenApi): { d: Daten; b: Betrieb }[] {
  const felder = abschnitte.flatMap((a) => a.felder);
  const allesAus = (b: Betrieb, start: Daten): Daten => {
    const voll: Daten = { ...start };
    for (const f of felder) {
      if (f.art === "liste") voll[f.id] = f.vorschlaege?.length ? f.vorschlaege.map((x) => api.eintragAusVorschlag(f, x, b, PRUEFSUMME_TAG)) : musterEintraege(f);
      else if (f.art === "bausteine" || f.art === "mehrfach") voll[f.id] = f.optionen.map((o) => o.wert);
    }
    return voll;
  };
  const leer = api.leererBetrieb;
  const startLeer: Daten = { ...api.leereDaten(v, leer, PRUEFSUMME_TAG), ...fassung };
  const vollLeer: Daten = { ...startLeer };
  // wie bisher: ohne Betrieb nur Listen mit Vorschlägen und alle Bausteine
  for (const f of felder) {
    if (f.art === "liste" && f.vorschlaege?.length) vollLeer[f.id] = f.vorschlaege.map((x) => api.eintragAusVorschlag(f, x, leer, PRUEFSUMME_TAG));
    else if (f.art === "bausteine") vollLeer[f.id] = f.optionen.map((o) => o.wert);
  }
  const aus: { d: Daten; b: Betrieb }[] = [{ d: startLeer, b: leer }, { d: vollLeer, b: leer }];
  const betriebe = pruefBetriebe(leer, rechtsformen);
  for (const b of betriebe) {
    const start: Daten = { ...api.leereDaten(v, b, PRUEFSUMME_TAG), ...fassung };
    aus.push({ d: start, b }, { d: { ...allesAus(b, start), ...fassung }, b });
  }
  // jede einzelne Auswahl auf dem Stand „alles ausgewählt“ (Beispielbetrieb GmbH & Co. KG bzw. erste erlaubte Rechtsform)
  const b0 = betriebe[0]!;
  const voll0: Daten = { ...allesAus(b0, { ...api.leereDaten(v, b0, PRUEFSUMME_TAG), ...fassung }), ...fassung };
  const fest = new Set(Object.keys(fassung));
  for (const f of felder) {
    if (fest.has(f.id)) continue;
    if (f.art === "wahl") {
      const optionen = f.id === "rechtsform" && rechtsformen?.length ? f.optionen.filter((o) => rechtsformen.includes(o.wert)) : f.optionen;
      for (const o of optionen) aus.push({ d: { ...voll0, [f.id]: o.wert }, b: b0 });
    } else if (f.art === "schalter") aus.push({ d: { ...voll0, [f.id]: !(voll0[f.id] === true) }, b: b0 });
    else if (f.art === "bausteine" || f.art === "mehrfach") for (const o of f.optionen) aus.push({ d: { ...voll0, [f.id]: [o.wert] }, b: b0 });
  }
  for (const x of VERDECKT[v.id] ?? []) aus.push({ d: { ...voll0, ...x }, b: b0 });
  return aus;
}
