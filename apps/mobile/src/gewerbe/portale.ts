/**
 * Gewerbe online anmelden (§ 14 GewO): Einstiegsseiten der Online-Gewerbeanzeige je Bundesland und das Bundesland aus
 * der Postleitzahl des Betriebs. Einzige Stelle für diese Adressen – jede mit Quelle und Prüfdatum. Eine Adresse steht
 * hier nur, wenn sie auf einer amtlichen Seite nachgelesen ist; ohne geprüfte Landesadresse führt der Knopf zum
 * Bundesportal (Leistung „Gewerbe anmelden“, Ort dort wählen). Test: apps/mobile/test/gewerbe-online.test.ts.
 *
 * Die App übermittelt nichts: Der Antrag läuft im Portal mit dem Konto der Nutzerin bzw. des Nutzers.
 */

export type Land = "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV" | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export const LAENDER: Record<Land, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

export interface Portal {
  /** Bundesland oder „bund“ (Bundesportal für alle Länder ohne geprüfte Landesadresse) */
  land: Land | "bund";
  /** Name des Portals, wie er auf dem Knopf steht */
  name: string;
  /** Einstiegsseite; `{plz}` wird durch die Postleitzahl des Betriebs ersetzt (nur wo die Quelle das so zeigt) */
  url: string;
  /** Was man zum Anmelden im Portal braucht – nur, was die Quelle sagt */
  zugang: string;
  /** Gebühr, wenn sie für das ganze Land feststeht (sonst „je nach Gemeinde“) – nur aus der Quelle */
  gebuehr?: string;
  /** Wo die Adresse (und der Zugang) nachgelesen ist */
  quelle: string;
  /** Quelle in wenigen Wörtern – so steht sie in der App */
  quelleKurz: string;
  /** Tag der Prüfung (ISO) */
  geprueftAm: string;
}

/** Hosts, auf die der Knopf „Zum Online-Antrag“ führen darf (der Test prüft jede Adresse dagegen). */
export const ERLAUBTE_HOSTS = ["www.service-bw.de", "service.berlin.de", "service.wirtschaft.nrw", "verwaltung.bund.de"] as const;

/** Bundesportal: Leistung „Gewerbe anmelden“ (Leistungsschlüssel 99050012104000) mit Ortswahl und Online-Antrag. */
export const BUNDESPORTAL: Portal = {
  land: "bund",
  name: "Bundesportal",
  url: "https://verwaltung.bund.de/leistungsverzeichnis/DE/leistung/99050012104000",
  zugang: "Im Bundesportal wählst du deinen Ort, dann führt es dich zum Online-Antrag deiner Gemeinde. Wie du dich dort ausweist, legt die Gemeinde fest – zum Beispiel mit dem Online-Ausweis.",
  quelle: "verwaltung.bund.de, Leistung „Gewerbe anmelden“ (99050012104000): „Online-Antrag“, „Bitte wählen Sie aus, wo Sie die Leistung beantragen möchten“; Identifizierung u. a. per elektronischem Personalausweis laut FIM-Stammtext (fimportal.de, L100022/496-99050012104000)",
  quelleKurz: "verwaltung.bund.de, fimportal.de",
  geprueftAm: "2026-10-21",
};

/** Geprüfte Landesportale – alle übrigen Länder nutzen das Bundesportal. */
export const LANDESPORTALE: Partial<Record<Land, Portal>> = {
  BW: {
    land: "BW",
    name: "service-bw",
    url: "https://www.service-bw.de/zufi/leistungen/496?plz={plz}",
    zugang: "Ein Konto bei service-bw: das Servicekonto BW oder – seit Oktober 2024 – die BundID bzw. „Mein Unternehmenskonto“.",
    quelle: "Gemeinde Hüttlingen, Seite „Service-BW“ (Link „Gewerbe anmelden“: service-bw.de/zufi/leistungen/496?plz=73460); Gemeinde Reute, „Onlinedienste“ (…/zufi/leistungen/496?plz=79276); firma.de, Gewerbeamt Reutlingen, Stand 19.10.2026 („Für die Online-Gewerbeanmeldung über service-bw ist ein Servicekonto BW erforderlich.“); Innenministerium BW, Pressemitteilung vom 22.10.2024 „service-bw erleichtert Anmeldung mit BundID und Mein Unternehmenskonto“",
    quelleKurz: "Gemeinden Hüttlingen und Reute, firma.de, Innenministerium BW",
    geprueftAm: "2026-10-21",
  },
  BE: {
    land: "BE",
    name: "Service-Portal Berlin",
    url: "https://service.berlin.de/dienstleistung/121921/",
    zugang: "Einzelunternehmen, e. K., GbR aus natürlichen Personen, GmbH und UG melden online mit einem BundID-Konto an. Für andere Rechtsformen (z. B. KG, OHG, GmbH & Co. KG) gibt es ein Online-Verfahren ohne Registrierung – beide Wege stehen auf der Seite.",
    gebuehr: "Online 15 €, nur mit Kreditkarte.",
    quelle: "service.berlin.de, Dienstleistung 121921 „Gewerbe anmelden“ (Online-Verfahren mit BundID bzw. ohne Registrierung je nach Rechtsform; Gebühr „15,00 Euro für eine Online-Anmeldung“, online nur Kreditkarte)",
    quelleKurz: "service.berlin.de",
    geprueftAm: "2026-10-21",
  },
  NW: {
    land: "NW",
    name: "Wirtschafts-Service-Portal.NRW",
    url: "https://service.wirtschaft.nrw/",
    zugang: "Ein Nutzerkonto im Wirtschafts-Service-Portal.NRW – du registrierst dich dort einmal.",
    quelle: "IHK Nord Westfalen, „Gewerbeanmeldung online“ (Link service.wirtschaft.nrw); IHK Düsseldorf, „Gewerbeanmeldung“ (Wirtschafts-Service-Portal.NRW: „Um die digitale Anmeldung nutzen zu können, muss man sich einmal registrieren.“)",
    quelleKurz: "IHK Nord Westfalen, IHK Düsseldorf",
    geprueftAm: "2026-10-21",
  },
};

/** Gebühr einzelner Gemeinden (nur geprüfte; erkannt am Ort in „Mein Betrieb“ und am Bundesland). */
export interface GemeindeGebuehr {
  ort: string;
  land: Land;
  text: string;
  quelle: string;
  quelleKurz: string;
  geprueftAm: string;
}
export const GEMEINDE_GEBUEHREN: GemeindeGebuehr[] = [
  {
    ort: "Reutlingen",
    land: "BW",
    text: "In Reutlingen 40 € (50 € bei überwachungsbedürftigen oder erlaubnispflichtigen Tätigkeiten), für GmbH und UG 50 €.",
    quelle: "firma.de, Gewerbeamt Reutlingen, Angaben der Stadt, Stand 19.10.2026",
    quelleKurz: "firma.de (Angaben der Stadt, Stand 19.10.2026)",
    geprueftAm: "2026-10-21",
  },
];

/** Geprüfte Gebühr der Gemeinde (Ort wie in „Mein Betrieb“, ohne Groß-/Kleinschreibung) – sonst undefined. */
export function gemeindeGebuehr(ort: string, land: Land | null): GemeindeGebuehr | undefined {
  const o = ort.trim().toLocaleLowerCase("de");
  return GEMEINDE_GEBUEHREN.find((g) => g.land === land && g.ort.toLocaleLowerCase("de") === o);
}

/** Alle Portale (für Tests und die Übersicht). */
export const ALLE_PORTALE: Portal[] = [...Object.values(LANDESPORTALE), BUNDESPORTAL];

/** Portal für ein Bundesland (ohne geprüfte Landesadresse: das Bundesportal). */
export const portalFuer = (land: Land | null): Portal => (land && LANDESPORTALE[land]) || BUNDESPORTAL;

/** Adresse zum Öffnen: `{plz}` mit der Postleitzahl des Betriebs (fünf Ziffern), sonst ohne diesen Teil. */
export function portalUrl(p: Portal, plz: string): string {
  const z = plz.trim();
  if (!p.url.includes("{plz}")) return p.url;
  return /^\d{5}$/.test(z) ? p.url.replace("{plz}", z) : p.url.replace(/[?&][^?&]*=\{plz\}/, "");
}

/**
 * Leitregionen (erste zwei Ziffern der PLZ): das Land, in dem die Region überwiegend liegt, und weitere Länder, in die
 * sie hineinreicht. Postleitzahlen folgen nicht den Landesgrenzen – deshalb `weitere` und die genaueren Bereiche unten.
 */
const LEITREGION: Record<string, [Land, ...Land[]]> = {
  "01": ["SN", "BB"], "02": ["SN"], "03": ["BB", "SN"], "04": ["SN", "ST", "TH", "BB"], "06": ["ST", "TH", "SN"], "07": ["TH", "SN"], "08": ["SN", "TH"], "09": ["SN"],
  "10": ["BE"], "12": ["BE"], "13": ["BE"], "14": ["BB", "BE"], "15": ["BB"], "16": ["BB"], "17": ["MV", "BB"], "18": ["MV"], "19": ["MV", "BB", "NI", "SH"],
  "20": ["HH"], "21": ["NI", "HH", "SH"], "22": ["HH", "SH"], "23": ["SH", "MV"], "24": ["SH"], "25": ["SH"], "26": ["NI"], "27": ["NI", "HB"], "28": ["HB", "NI"], "29": ["NI", "ST"],
  "30": ["NI"], "31": ["NI"], "32": ["NW", "NI"], "33": ["NW"], "34": ["HE", "NI", "NW"], "35": ["HE"], "36": ["HE", "TH", "BY"], "37": ["NI", "HE", "TH", "NW"], "38": ["NI", "ST"], "39": ["ST"],
  "40": ["NW"], "41": ["NW"], "42": ["NW"], "44": ["NW"], "45": ["NW"], "46": ["NW"], "47": ["NW"], "48": ["NW", "NI"], "49": ["NI", "NW"],
  "50": ["NW"], "51": ["NW"], "52": ["NW"], "53": ["NW", "RP"], "54": ["RP"], "55": ["RP"], "56": ["RP"], "57": ["NW", "RP", "HE"], "58": ["NW"], "59": ["NW"],
  "60": ["HE"], "61": ["HE"], "63": ["HE", "BY"], "64": ["HE"], "65": ["HE", "RP"], "66": ["SL", "RP"], "67": ["RP"], "68": ["BW", "HE"], "69": ["BW", "HE"],
  "70": ["BW"], "71": ["BW"], "72": ["BW"], "73": ["BW"], "74": ["BW"], "75": ["BW"], "76": ["BW", "RP"], "77": ["BW"], "78": ["BW"], "79": ["BW"],
  "80": ["BY"], "81": ["BY"], "82": ["BY"], "83": ["BY"], "84": ["BY"], "85": ["BY"], "86": ["BY"], "87": ["BY"], "88": ["BW", "BY"], "89": ["BW", "BY"],
  "90": ["BY"], "91": ["BY"], "92": ["BY"], "93": ["BY"], "94": ["BY"], "95": ["BY"], "96": ["BY", "TH"], "97": ["BY", "BW"], "98": ["TH"], "99": ["TH"],
};

/** Genauere Bereiche (erste drei Ziffern), die ganz in einem anderen Land liegen als ihre Leitregion. */
const BEREICH: Record<string, Land> = {
  "140": "BE", "141": "BE",
  "210": "HH", "211": "HH",
  "228": "SH", "229": "SH",
  "288": "NI",
  "364": "TH",
  "388": "ST", "389": "ST",
  "534": "RP", "535": "RP",
  "637": "BY", "638": "BY", "639": "BY",
  "686": "HE",
  "768": "RP", "769": "RP",
  "892": "BY", "893": "BY", "894": "BY",
  "965": "TH",
};

const KENNUNG = Object.fromEntries((Object.entries(LAENDER) as [Land, string][]).map(([k, v]) => [v.toLocaleLowerCase("de"), k])) as Record<string, Land>;

/** Bundesland aus Kürzel („BW“) oder Name („Baden-Württemberg“) – sonst null. */
export function landAus(wert: unknown): Land | null {
  if (typeof wert !== "string" || !wert.trim()) return null;
  const w = wert.trim();
  if (w.toUpperCase() in LAENDER) return w.toUpperCase() as Land;
  return KENNUNG[w.toLocaleLowerCase("de")] ?? null;
}

export interface LandErmittelt {
  land: Land | null;
  /** Woher: Postleitzahl (eindeutig), Postleitzahl und Angabe des Bundeslands zusammen, nur die Angabe, nichts */
  herkunft: "plz" | "plz_angabe" | "angabe" | "keins";
  /** Die PLZ liegt in einer Region über Landesgrenzen hinweg und keine Angabe klärt das – bitte prüfen */
  unsicher: boolean;
}

/**
 * Bundesland des Betriebs: aus der Postleitzahl der Betriebsstätte; reicht ihre Region über Landesgrenzen, entscheidet
 * das Bundesland aus „Mein Betrieb“ bzw. dem Pflichten-Check, sofern es dazu passt. Ohne gültige PLZ zählt die Angabe.
 */
export function landErmitteln(plz: string, angabe?: unknown, nochEine?: unknown): LandErmittelt {
  const z = (plz ?? "").trim();
  const angegeben = landAus(angabe) ?? landAus(nochEine);
  if (/^\d{5}$/.test(z)) {
    const genau = BEREICH[z.slice(0, 3)];
    if (genau) return { land: genau, herkunft: "plz", unsicher: false };
    const region = LEITREGION[z.slice(0, 2)];
    if (region) {
      if (region.length === 1) return { land: region[0], herkunft: "plz", unsicher: false };
      if (angegeben && region.includes(angegeben)) return { land: angegeben, herkunft: "plz_angabe", unsicher: false };
      return { land: region[0], herkunft: "plz", unsicher: true };
    }
  }
  return angegeben ? { land: angegeben, herkunft: "angabe", unsicher: false } : { land: null, herkunft: "keins", unsicher: false };
}
