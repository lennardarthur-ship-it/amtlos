/**
 * Vorbereitung des Fragebogens zur steuerlichen Erfassung (Katalog A.5, Spezifikation 6.2: „Formulare werden aus dem
 * Profil vorausgefüllt“). Wir zeigen die Angaben aus dem Profil, die der Fragebogen laut Spezifikation braucht
 * (Wahl der Kleinunternehmerregelung, Umsatz- und Gewinnprognose), plus Stammdaten. Die Zuordnung zu den Feldern
 * des amtlichen Formulars ist fachlich zu prüfen (PRUEFLISTE T-03); Feldnummern erfinden wir nicht.
 */
type Sprache = "de" | "en";
type T = Record<Sprache, string>;

export interface Angabe {
  feld: string;
  label: string;
  wert: string | null;
  schritt: string; // Onboarding-Schritt zum Ergänzen
}
export interface Abschnitt {
  titel: string;
  angaben: Angabe[];
}

const RECHTSFORM: Record<string, T> = {
  einzelunternehmen: { de: "Einzelunternehmen", en: "Sole proprietorship" }, freiberuf: { de: "Freiberuflich", en: "Freelance" },
  gbr: { de: "GbR", en: "GbR" }, ek: { de: "e. K.", en: "e. K." }, ohg: { de: "OHG", en: "OHG" }, kg: { de: "KG", en: "KG" }, ug: { de: "UG (haftungsbeschränkt)", en: "UG" }, gmbh: { de: "GmbH", en: "GmbH" },
  gmbh_co_kg: { de: "GmbH & Co. KG", en: "GmbH & Co. KG" }, partg: { de: "PartG", en: "PartG" }, partg_mbb: { de: "PartG mbB", en: "PartG mbB" }, sonstige: { de: "Andere", en: "Other" },
};
const EINORDNUNG: Record<string, T> = {
  freiberuf: { de: "Freier Beruf", en: "Liberal profession" }, gewerbe: { de: "Gewerbe", en: "Trade" },
  land_forstwirtschaft: { de: "Land- und Forstwirtschaft", en: "Agriculture and forestry" }, unklar: { de: "Noch unklar", en: "Unclear" },
};

const L: Record<string, T> = {
  stamm: { de: "Unternehmen", en: "Business" },
  name: { de: "Name", en: "Name" },
  rechtsform: { de: "Rechtsform", en: "Legal form" },
  beginn: { de: "Beginn der Tätigkeit", en: "Start of activity" },
  taetigkeit: { de: "Art der Tätigkeit", en: "Type of activity" },
  ort: { de: "Gemeindeschlüssel / Land", en: "Municipality key / state" },
  ust: { de: "Umsatzsteuer", en: "VAT" },
  ku: { de: "Kleinunternehmerregelung", en: "Small business scheme" },
  umsatz: { de: "Erwarteter Umsatz in diesem Jahr", en: "Expected turnover this year" },
  gewinn_t: { de: "Gewinn", en: "Profit" },
  gewinn: { de: "Erwarteter Gewinn in diesem Jahr", en: "Expected profit this year" },
  stb: { de: "Steuerberatung", en: "Tax adviser" },
  ja: { de: "Ja", en: "Yes" },
  nein: { de: "Nein", en: "No" },
  ku_ja: { de: "Ja, ich nutze sie", en: "Yes, I use it" },
  ku_nein: { de: "Nein, ich verzichte", en: "No, I opt out" },
};

const euro = (n: unknown, s: Sprache) =>
  typeof n === "number" ? new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : null;
const datum = (d: unknown, s: Sprache) => {
  if (typeof d !== "string") return null;
  const [j, m, t] = d.split("-");
  return s === "de" ? `${Number(t)}.${Number(m)}.${j}` : `${j}-${m}-${t}`;
};

export function fragebogenVorbereitung(name: string, p: Record<string, unknown>, s: Sprache) {
  const l = (k: string) => L[k]![s];
  const janein = (v: unknown, ja = "ja", nein = "nein") => (v === true ? l(ja) : v === false ? l(nein) : null);
  const abschnitte: Abschnitt[] = [
    {
      titel: l("stamm"),
      angaben: [
        { feld: "name", label: l("name"), wert: name, schritt: "" },
        { feld: "rechtsform", label: l("rechtsform"), wert: RECHTSFORM[p.rechtsform as string]?.[s] ?? null, schritt: "rechtsform" },
        // StB Busch 22.10.2026: Beginn der Tätigkeit – bei eingetragenen Gesellschaften die eigene Angabe, sonst das Startdatum
        { feld: "gruendungsdatum", label: l("beginn"), wert: datum(p.taetigkeit_beginn ?? p.gruendungsdatum, s), schritt: "start" },
        { feld: "taetigkeit.einordnung", label: l("taetigkeit"), wert: EINORDNUNG[p["taetigkeit.einordnung"] as string]?.[s] ?? null, schritt: "taetigkeit" },
        { feld: "gemeinde_ags", label: l("ort"), wert: p.gemeinde_ags ? `${p.gemeinde_ags as string}${p.bundesland ? ` (${p.bundesland as string})` : ""}` : null, schritt: "ort" },
      ],
    },
    {
      titel: l("ust"),
      angaben: [
        { feld: "ust.kleinunternehmer", label: l("ku"), wert: janein(p["ust.kleinunternehmer"], "ku_ja", "ku_nein"), schritt: "umsatzsteuer" },
        { feld: "umsatz.prognose_laufendes_jahr", label: l("umsatz"), wert: euro(p["umsatz.prognose_laufendes_jahr"], s), schritt: "umsatzsteuer" },
      ],
    },
    {
      titel: l("gewinn_t"),
      angaben: [{ feld: "gewinn.prognose_laufendes_jahr", label: l("gewinn"), wert: euro(p["gewinn.prognose_laufendes_jahr"], s), schritt: "umsatzsteuer" }],
    },
    { titel: l("stb"), angaben: [{ feld: "steuerberater", label: l("stb"), wert: janein(p.steuerberater), schritt: "umsatzsteuer" }] },
  ];
  const fehlend = abschnitte.flatMap((a) => a.angaben).filter((a) => a.wert === null).map((a) => a.feld);
  return {
    abschnitte,
    fehlend,
    // Spezifikation C.23: Verzicht auf die Kleinunternehmerregelung bindet fünf Jahre
    hinweise: p["ust.kleinunternehmer"] === false ? ["verzicht_bindet"] : [],
  };
}
