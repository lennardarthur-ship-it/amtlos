/**
 * E-196: Ausprägungen einer Vorlage für die Prüfsumme (`vorlagenPruefstand`), in Gruppen je Variante.
 *
 * Bis E-196 rechnete die Prüfsumme nur mit leerem Betrieb und den Startwerten bzw. allen Vorschlägen. Was erst mit
 * Angaben aus „Mein Betrieb“ (Fußzeile, Komplementärin einer GmbH & Co. KG, Registerangaben), mit einer bestimmten
 * Auswahl (Kleinunternehmer, Steuerschuldnerschaft des Leistungsempfängers, Schlussrechnung) oder als Storno gedruckt
 * wird, änderte die Prüfsumme nicht – der Prüfvermerk blieb stehen, obwohl sich der gedruckte Text geändert hatte (E-193).
 *
 * Jetzt fließt jede Ausprägung in die Teilsumme ihrer Variantengruppe ein:
 *   - `basis`: Formular und Kurztext; Startwerte und „alles ausgewählt“ ohne Betrieb; Startwerte und „alles ausgewählt“
 *     mit einem neutralen Beispielbetrieb (Anschrift, Kontakt, Bank, Steuernummer – ohne Rechtsform, Register, Land);
 *     jede einzelne Auswahl (jede Option einer Wahl, jeder Schalter umgelegt, jeder Baustein bzw. jede Mehrfachoption
 *     allein) mit dem neutralen Betrieb; Listen ohne Vorschläge mit Beispieleinträgen (je Option einer Wahl im Eintrag),
 *   - `rf:<Rechtsform>`: Startwerte und „alles ausgewählt“ mit einem Beispielbetrieb dieser Rechtsform (Register,
 *     Vertretung, bei GmbH & Co. KG und UG & Co. KG die Komplementärin),
 *   - `land:<Land>`: Startwerte und „alles ausgewählt“ mit dem neutralen Betrieb in diesem Land (Landeszusätze),
 *   - `ku`: Kleinunternehmer mit Wechseldatum und Ist-Versteuerung,
 *   - eigene Gruppen der Rechnung: `schlussrechnung`, `storno`, `storno_schluss` (Storno einer Schlussrechnung mit
 *     den abgesetzten Abschlägen).
 * Eine Unterlage braucht die Gruppen, die zu ihr passen (`basis`, ihre Rechtsform, ihr Land, ggf. `ku` und die Gruppe der
 * Rechnungsart – `pruefGruppenFuer` in index.ts). Der Vermerk erscheint, wenn alle diese Teilsummen der freigegebenen
 * entsprechen. Jede Textänderung ändert genau die Teilsummen der Gruppen, in denen sie gedruckt wird.
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
  /** SHA-256 (hex) über alle Teilsummen */
  summe: string;
  /** Stellen mit „fachlich zu prüfen“ in Formular und gedruckten Ausprägungen */
  offen: number;
  /** Teilsumme je Variantengruppe (SHA-256, die ersten 24 Hexziffern) */
  teile: Record<string, string>;
}

/** Länge der gespeicherten Teilsummen (96 Bit – eine zufällige Übereinstimmung nach einer Änderung ist ausgeschlossen) */
export const TEILSUMME_LAENGE = 24;

/** Fester Stichtag – das Ergebnis hängt nicht vom heutigen Datum ab. */
export const PRUEFSUMME_TAG = "2026-01-01";

export const PRUEF_LAENDER = ["Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"];
/** Rechtsformen der Beispielbetriebe – feste Liste, damit eine neue Auswahl in der App nicht alle Prüfsummen ändert */
export const PRUEF_RECHTSFORMEN = ["GmbH & Co. KG", "UG (haftungsbeschränkt) & Co. KG", "Einzelunternehmen", "e. K.", "GbR", "eGbR", "OHG", "KG", "PartG", "PartG mbB", "GmbH", "UG (haftungsbeschränkt)"];
const REGISTER: Record<string, string> = { "e. K.": "HRA 1001", eGbR: "GsR 1001", OHG: "HRA 1002", KG: "HRA 1003", "GmbH & Co. KG": "HRA 1004", "UG (haftungsbeschränkt) & Co. KG": "HRA 1005", PartG: "PR 1001", "PartG mbB": "PR 1002", GmbH: "HRB 1001", "UG (haftungsbeschränkt)": "HRB 1002" };

/** Neutraler Beispielbetrieb: alle Angaben außer Rechtsform, Register, Vertretung und Land (erfunden). */
export function neutralerBetrieb(leer: Betrieb): Betrieb {
  return {
    ...leer, name: "Muster Betrieb", strasse: "Musterstraße 1", plz: "10115", ort: "Musterstadt", verantwortlich: "Alex Muster", telefon: "030 1234567", email: "info@muster.example",
    steuernummer: "12/345/67890", ust_idnr: "DE123456789", iban: "DE89370400440532013000", bank: "Musterbank", bic: "COBADEFFXXX", website: "www.muster.example", versteuerung: "soll", farbe: "#1d4f7a",
  };
}

/** Beispielbetrieb einer Rechtsform (erfunden). */
export function rechtsformBetrieb(leer: Betrieb, rf: string): Betrieb {
  const co = rf.includes("& Co. KG");
  return {
    ...neutralerBetrieb(leer), name: `Muster ${rf}`, rechtsform: rf, registergericht: REGISTER[rf] ? "Amtsgericht Musterstadt" : "", registernummer: REGISTER[rf] ?? "",
    vertretung: rf === "Einzelunternehmen" ? "" : "Alex Muster, Kim Beispiel",
    ...(co ? { komplementaer: rf.startsWith("UG") ? "Muster Verwaltungs UG (haftungsbeschränkt)" : "Muster Verwaltungs GmbH", komplementaer_rechtsform: rf.startsWith("UG") ? "UG (haftungsbeschränkt)" : "GmbH", komplementaer_sitz: "Musterstadt", komplementaer_registergericht: "Amtsgericht Musterstadt", komplementaer_registernummer: "HRB 2001" } : {}),
  };
}

/** Beispielbetriebe für die Prüfsumme je Rechtsform (bei einer Freigabe nur für bestimmte Rechtsformen nur diese). */
export function pruefBetriebe(leer: Betrieb, rechtsformen?: readonly string[]): Betrieb[] {
  return PRUEF_RECHTSFORMEN.filter((r) => !rechtsformen?.length || rechtsformen.includes(r)).map((rf) => rechtsformBetrieb(leer, rf));
}

const MUSTER: Record<string, string> = { text: "Beispieltext", mehrzeilig: "Beispielzeile 1\nBeispielzeile 2", datum: PRUEFSUMME_TAG, uhrzeit: "08:30", betrag: "123,45", zahl: "2" };

/** Beispielwert eines einfachen Felds (für Listen ohne Vorschläge). */
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

/**
 * Eigene Gruppen einzelner Vorlagen: eine Auswahl (Feld = Wert) bzw. verdeckte Angaben, die die App selbst setzt;
 * `negativ`: Feld einer Liste, dessen Vorzeichen die App dabei umkehrt (Storno: Preise der Positionen, speicher.ts).
 */
export const EIGENE_GRUPPEN: Record<string, { gruppe: string; auswahl?: Daten; verdeckt?: Daten; negativ?: { liste: string; feld: string } }[]> = {
  rechnung: [
    { gruppe: "schlussrechnung", auswahl: { schluss: true } },
    { gruppe: "storno", verdeckt: { storno_zu: "RE-2026-0001" }, negativ: { liste: "positionen", feld: "preis" } },
    { gruppe: "storno_schluss", verdeckt: { storno_zu: "RE-2026-0001", schluss: true, storno_abschlaege: true }, negativ: { liste: "positionen", feld: "preis" } },
  ],
};
const umkehren = (d: Daten, n: { liste: string; feld: string } | undefined): Daten => {
  const l = n ? d[n.liste] : undefined;
  if (!n || !Array.isArray(l)) return d;
  const neg = (x: unknown) => (typeof x === "string" && x.trim() ? (x.trim().startsWith("-") ? x.trim().slice(1) : `-${x.trim()}`) : x);
  return { ...d, [n.liste]: (l as Eintrag[]).map((e) => ({ ...e, [n.feld]: neg(e[n.feld]) })) as Daten[string] };
};

/** Sichtbarer Text eines Dokuments und die Meta-Angaben, die die App in Kopf- und Fußzeile druckt. */
export function gedruckterText(html: string, sichtbar: (h: string) => string): string {
  const ent = (s: string) => s.replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  // die Spalten der Fußzeile (Angaben des Betriebs) druckt die App nur bei Briefen (unterlagen/fusszeile.ts)
  const brief = /<meta name="amtlos-gestalt" content="brief"/.test(html);
  const meta = [...html.matchAll(/<meta name="amtlos-(fuss-links|fuss-rechts|fuss-spalten)" content="([^"]*)"/g)].filter((m) => brief || m[1] !== "fuss-spalten").map((m) => `${m[1]}=${ent(m[2]!)}`).join("|");
  // ebenso die Fußleiste im Dokument (`.fussleiste`): außerhalb von Briefen ausgeblendet (display: none), weder auf dem
  // Bildschirm noch im PDF zu sehen
  const text = brief ? html : html.replace(/<footer class="fussleiste">[\s\S]*?<\/footer>/g, " ");
  return `${sichtbar(text)}${meta ? ` ‖ ${meta}` : ""}`;
}

export interface Auspraegung {
  d: Daten;
  b: Betrieb;
  gruppe: string;
}

/**
 * Alle Ausprägungen einer Vorlage mit ihrer Gruppe (siehe oben). `abschnitte`: Abschnitte mit den Vorschlägen der
 * Freigabe (Gruppen), `fassung`: feste Angabe der Freigabe (wird nicht verändert), `rechtsformen`: nur Beispielbetriebe
 * dieser Rechtsformen (und ohne Kleinunternehmer).
 */
export function pruefAuspraegungen(v: Vorlage, abschnitte: Vorlage["abschnitte"], fassung: Daten, rechtsformen: readonly string[] | undefined, api: PruefsummenApi): Auspraegung[] {
  const felder = abschnitte.flatMap((a) => a.felder);
  const allesAus = (b: Betrieb, start: Daten): Daten => {
    const voll: Daten = { ...start };
    for (const f of felder) {
      if (f.art === "liste") voll[f.id] = f.vorschlaege?.length ? f.vorschlaege.map((x) => api.eintragAusVorschlag(f, x, b, PRUEFSUMME_TAG)) : musterEintraege(f);
      else if (f.art === "bausteine" || f.art === "mehrfach") voll[f.id] = f.optionen.map((o) => o.wert);
    }
    return { ...voll, ...fassung };
  };
  const startMit = (b: Betrieb): Daten => ({ ...api.leereDaten(v, b, PRUEFSUMME_TAG), ...fassung });
  const paar = (b: Betrieb, gruppe: string): Auspraegung[] => [{ d: startMit(b), b, gruppe }, { d: allesAus(b, startMit(b)), b, gruppe }];
  const leer = api.leererBetrieb;
  const neutral = neutralerBetrieb(leer);
  const aus: Auspraegung[] = [];
  // basis: ohne Betrieb wie bisher (nur Listen mit Vorschlägen und alle Bausteine), dazu der neutrale Betrieb
  const vollLeer: Daten = { ...startMit(leer) };
  for (const f of felder) {
    if (f.art === "liste" && f.vorschlaege?.length) vollLeer[f.id] = f.vorschlaege.map((x) => api.eintragAusVorschlag(f, x, leer, PRUEFSUMME_TAG));
    else if (f.art === "bausteine") vollLeer[f.id] = f.optionen.map((o) => o.wert);
  }
  aus.push({ d: startMit(leer), b: leer, gruppe: "basis" }, { d: vollLeer, b: leer, gruppe: "basis" }, ...paar(neutral, "basis"));
  // jede einzelne Auswahl auf dem Stand „alles ausgewählt“ mit dem neutralen Betrieb
  const voll0 = allesAus(neutral, startMit(neutral));
  const eigene = EIGENE_GRUPPEN[v.id] ?? [];
  const eigeneGruppe = (feld: string, wert: unknown) => eigene.find((g) => g.auswahl && g.auswahl[feld] === wert)?.gruppe;
  const fest = new Set(Object.keys(fassung));
  for (const f of felder) {
    if (fest.has(f.id)) continue;
    if (f.art === "wahl") {
      const optionen = f.id === "rechtsform" && rechtsformen?.length ? f.optionen.filter((o) => rechtsformen.includes(o.wert)) : f.optionen;
      for (const o of optionen) aus.push({ d: { ...voll0, [f.id]: o.wert }, b: neutral, gruppe: eigeneGruppe(f.id, o.wert) ?? "basis" });
    } else if (f.art === "schalter") {
      const wert = !(voll0[f.id] === true);
      aus.push({ d: { ...voll0, [f.id]: wert }, b: neutral, gruppe: eigeneGruppe(f.id, wert) ?? "basis" });
    } else if (f.art === "bausteine" || f.art === "mehrfach") for (const o of f.optionen) aus.push({ d: { ...voll0, [f.id]: [o.wert] }, b: neutral, gruppe: "basis" });
  }
  for (const g of eigene) if (g.verdeckt) aus.push({ d: { ...voll0, ...g.verdeckt }, b: neutral, gruppe: g.gruppe });
  // Eigene Gruppen zusätzlich auf dem Startstand mit gefüllten Listen: „alles ausgewählt“ schaltet z. B. bei der Rechnung
  // auch „Gutschrift“ ein, die Schlussrechnung und Storno überdeckt – so steht die Unterlage einmal so da, wie sie gedruckt wird
  const listenVoll: Daten = { ...startMit(neutral) };
  for (const f of felder) if (f.art === "liste" && !fest.has(f.id)) listenVoll[f.id] = voll0[f.id]!;
  for (const g of eigene) aus.push({ d: umkehren({ ...listenVoll, ...(g.auswahl ?? {}), ...(g.verdeckt ?? {}) }, g.negativ), b: neutral, gruppe: g.gruppe });
  // je Rechtsform, je Land, Kleinunternehmer
  for (const b of pruefBetriebe(leer, rechtsformen)) aus.push(...paar(b, `rf:${b.rechtsform}`));
  for (const land of PRUEF_LAENDER) aus.push(...paar({ ...neutral, bundesland: land }, `land:${land}`));
  if (!rechtsformen?.length) aus.push(...paar({ ...rechtsformBetrieb(leer, "Einzelunternehmen"), name: "Muster Kleinunternehmen", ust_idnr: "", ku_bis: "2026-06-30", versteuerung: "ist" }, "ku"));
  return aus;
}

/**
 * Die ganze Rechnung der Prüfsumme (siehe vorlagenPruefstand in index.ts) – hier, damit sie mit denselben Zeilen auch für
 * ältere Stände der Vorlagen läuft.
 */
type FreigabeParameter = { fassung?: { feld: string; wert: string }; gruppen?: readonly string[]; rechtsformen?: readonly string[] };

/** Abschnitte mit den Vorschlägen der Freigabe (Gruppen) und ihre feste Angabe (Fassung). */
function freigabeTeile(v: Vorlage, freigabe: FreigabeParameter | undefined): { abschnitte: Vorlage["abschnitte"]; fassung: Daten } {
  const passt = (x: Vorschlag) => !freigabe?.gruppen || freigabe.gruppen.includes(x.gruppe ?? "");
  const abschnitte = v.abschnitte.map((a) => ({ ...a, felder: a.felder.map((f) => (f.art === "liste" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.filter(passt) } : f)) }));
  return { abschnitte, fassung: freigabe?.fassung ? { [freigabe.fassung.feld]: freigabe.fassung.wert } : {} };
}

/** Alle Ausprägungen einer Vorlage für eine Freigabe (z. B. für Beispiel-PDFs der geänderten Varianten zur Nachprüfung). */
export function pruefAuspraegungenFuer(v: Vorlage, freigabe: FreigabeParameter | undefined, api: PruefsummenApi): Auspraegung[] {
  const { abschnitte, fassung } = freigabeTeile(v, freigabe);
  return pruefAuspraegungen(v, abschnitte, fassung, freigabe?.rechtsformen, api);
}

export function pruefstandBerechnen(v: Vorlage, freigabe: FreigabeParameter | undefined, api: PruefstandApi): PruefstandErgebnis {
  const { abschnitte, fassung } = freigabeTeile(v, freigabe);
  const formular = `vorlage:${api.kanonisch({ id: v.id, titel: v.titel, beschreibung: v.beschreibung, grundlage: v.grundlage, abschnitte })}`;
  const zeilen: Record<string, string[]> = { basis: [formular, `kurz:${api.kurz[v.id] ?? ""}`] };
  const stellen = new Set<string>();
  for (const m of formular.matchAll(/[^.;:\n]{0,80}fachlich zu prüfen/g)) stellen.add(m[0]);
  for (const a of pruefAuspraegungen(v, abschnitte, fassung, freigabe?.rechtsformen, api)) {
    const t = gedruckterText(api.dokumentHtml(v, a.d, a.b), api.sichtbarerText);
    (zeilen[a.gruppe] ??= []).push(t);
    for (const m of t.matchAll(/[^.;:\n]{0,80}fachlich zu prüfen/g)) stellen.add(m[0]);
  }
  const teile: Record<string, string> = {};
  for (const g of Object.keys(zeilen).sort()) teile[g] = api.sha256(zeilen[g]!.map((t, i) => `a${i}:${t}`).join("\n")).slice(0, TEILSUMME_LAENGE);
  return { summe: api.sha256(Object.entries(teile).map(([g, s]) => `${g}=${s}`).join("\n")), offen: stellen.size, teile };
}
