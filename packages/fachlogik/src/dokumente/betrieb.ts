/**
 * Betrieb und Register (E-121): Gewerbeanmeldung, Handelsregister, Transparenzregister – als ausgefüllte Datenblätter.
 * Angemeldet wird beim Gewerbeamt, über den Notar bzw. im Transparenzregister; die App übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-60).
 */
import { abschnitt, absatz, anschrift, cent, datumDe, dokument, esc, euro, felder, liste, nachsatz, tabelle, text, uebertragung, unterschriften, zelle } from "./html.js";
import { INTERESSE, RECHTSFORMEN } from "./bausteine.js";
import type { Betrieb, Daten, Eintrag, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";

const formNorm = (t: string) => t.toLocaleLowerCase("de").replace(/[\s.]/g, "");
/**
 * Rechtsform aus „Mein Betrieb“ (Freitext, z. B. „GmbH“, „UG“, „e.K.“) als Wert einer Auswahl: gleiche Schreibweise
 * ohne Leerzeichen und Punkte, sonst die erste Option, die damit beginnt; passt keine, der Text wie eingegeben.
 */
export function rechtsformAus(wert: string | undefined, formen: string[]): string {
  const w = formNorm(wert ?? "");
  if (!w) return "";
  return formen.find((f) => formNorm(f) === w) ?? formen.find((f) => formNorm(f).startsWith(w)) ?? (wert ?? "").trim();
}
/** Rechtsform-Zusätze im Namen des Betriebs (längere zuerst: „GmbH & Co. KG“ vor „GmbH“ und „KG“). */
const FORM_IM_NAMEN: [RegExp, string][] = [
  [/GmbH\s*&\s*Co\.?\s*KG\b/, "GmbH & Co. KG"],
  [/\bUG\b/, "UG (haftungsbeschränkt)"],
  [/\bGmbH\b/, "GmbH"],
  [/\bAG\b/, "AG"],
  [/\be\.\s?(?:K|Kfm|Kfr)\./, "e. K."],
  [/\bOHG\b/, "OHG"],
  [/\bKG\b/, "KG"],
  [/\be?GbR\b/, "GbR"],
  [/\bPartG\b/, "PartG"],
];
/** Rechtsform, die der Name des Betriebs nennt (oder null). */
export function formImNamen(name: string): string | null {
  return FORM_IM_NAMEN.find(([re]) => re.test(name))?.[1] ?? null;
}
/** Gleiche Rechtsform trotz anderer Schreibweise („e. K.“/„e.K.“, „GbR“/„eGbR“)? */
export const formGleich = (a: string, b: string) => {
  const n = (t: string) => t.toLocaleLowerCase("de").replace(/[\s.]/g, "").replace(/^e(?=gbr)/, "");
  return n(a) === n(b);
};

/**
 * Kapitalgesellschaft (GmbH, UG, AG) nach der Rechtsform aus „Mein Betrieb“ – ohne Angabe dort nach dem Zusatz im
 * Namen des Betriebs. Eine GmbH & Co. KG ist eine Kommanditgesellschaft und zählt nicht dazu.
 */
export function istKapitalgesellschaft(rechtsform: string | undefined, name = ""): boolean {
  const rf = (rechtsform ?? "").trim();
  const form = rf ? formImNamen(rf) : formImNamen(name);
  return form === "GmbH" || form === "UG (haftungsbeschränkt)" || form === "AG";
}

/**
 * Vertragspartei bzw. Arbeitgeber als Text: bei einer Kapitalgesellschaft mit Geschäftsführung in „Mein Betrieb“
 * „Firma, vertreten durch …“, sonst nur der Name.
 */
export function mitVertretung(b: Betrieb, name = b.name.trim()): string {
  const v = (b.vertretung ?? "").trim();
  return name && v && istKapitalgesellschaft(b.rechtsform, b.name) ? `${name}, vertreten durch ${v}` : name;
}

/** Registergericht und -nummer aus „Mein Betrieb“ in einer Zeile. */
export const registerAus = (b: Betrieb) => [b.registergericht ?? "", b.registernummer ?? ""].map((x) => x.trim()).filter(Boolean).join(", ");

/** Rechtsformen mit Eintrag im Handels- bzw. Gesellschaftsregister */
export const REGISTER_FORMEN = ["e. K.", "eGbR", "OHG", "KG", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "GmbH"];

const PERSON = [
  { id: "name", art: "text" as const, label: "Vor- und Nachname", pflicht: true },
  { id: "geburtsdatum", art: "datum" as const, label: "Geburtsdatum", pflicht: true },
  { id: "wohnort", art: "text" as const, label: "Wohnort", pflicht: true },
];

export const gewerbeanmeldung: Vorlage = {
  id: "gewerbeanmeldung",
  gestalt: "formular",
  titel: "Gewerbeanmeldung (Datenblatt)",
  beschreibung: "Alle Angaben für die Gewerbeanmeldung an einem Ort – zum Übertragen in das Online-Formular deiner Stadt oder zum Mitnehmen aufs Amt.",
  bereich: "betrieb",
  pflichten: ["gruendung.gewerbeanzeige"],
  grundlage: "§ 14 GewO; Gewerbeanzeigeverordnung (Vordruck GewA 1)",
  ausBetrieb: { rechtsform: "rechtsform" },
  abschnitte: [
    {
      titel: "Angaben zur Person",
      hilfe: "Angemeldet wird beim Gewerbeamt deiner Stadt oder Gemeinde, oft auch online.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", vorbelegung: "verantwortlich", pflicht: true },
        { id: "geburtsname", selten: true, art: "text", label: "Geburtsname", hilfe: "falls abweichend" },
        { id: "geburtsdatum", art: "datum", label: "Geburtsdatum", pflicht: true },
        { id: "geburtsort", art: "text", label: "Geburtsort", pflicht: true },
        { id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", pflicht: true, vorschlaege: ["deutsch"] },
        { id: "wohnanschrift", art: "mehrzeilig", label: "Wohnanschrift", pflicht: true },
      ],
    },
    {
      titel: "Angaben zum Betrieb",
      hilfe: `Name, Anschrift und Kontakt übernimmt ${MARKE.name} aus „Mein Betrieb“.`,
      felder: [
        { id: "rechtsform", art: "wahl", label: "Rechtsform", optionen: RECHTSFORMEN.map((r) => ({ wert: r, text: r })), hilfe: "ohne Auswahl die Rechtsform aus „Mein Betrieb“, sonst Einzelunternehmen" },
        { id: "taetigkeit", art: "mehrzeilig", label: "Angemeldete Tätigkeit", hilfe: "so genau wie möglich, z. B. „Friseurhandwerk und Verkauf von Haarpflegeprodukten“", pflicht: true },
        { id: "beginn", art: "datum", label: "Beginn der Tätigkeit", pflicht: true },
        { id: "erwerb", art: "wahl", label: "Haupt- oder Nebenerwerb", optionen: [{ wert: "haupt", text: "Haupterwerb" }, { wert: "neben", text: "Nebenerwerb" }], vorbelegung: "haupt" },
        { id: "beschaeftigte", art: "text", label: "Zahl der Beschäftigten", hilfe: "z. B. 1 Vollzeit, 2 Teilzeit – oder keine" },
        { id: "erlaubnis", selten: true, art: "text", label: "Erlaubnis oder Handwerkskarte", hilfe: "nur falls nötig: welche, von wem, vom" },
      ],
    },
  ],
  pruefen(d, b) {
    // Hinweis: Name mit Rechtsform-Zusatz, der nicht zur gewählten Rechtsform passt (wie im Impressum)
    const imNamen = formImNamen(b.name);
    const rf = rechtsformAus(text(d, "rechtsform") || b.rechtsform, RECHTSFORMEN) || "Einzelunternehmen";
    return imNamen && !formGleich(imNamen, rf) ? [`Der Name des Betriebs enthält die Rechtsform „${imNamen}“, gewählt ist „${rf}“ – bitte prüfen.`] : [];
  },
  html(d, b) {
    const rechtsform = rechtsformAus(text(d, "rechtsform") || b.rechtsform, RECHTSFORMEN) || "Einzelunternehmen";
    // Registereintrag nur bei eingetragenen Rechtsformen (aus „Mein Betrieb“, sonst Linie); ein Einzelunternehmen hat
    // keinen – auch wenn in „Mein Betrieb“ noch ein Register steht, entfällt die Zeile
    const register = REGISTER_FORMEN.includes(rechtsform) ? registerAus(b) : null;
    // leeres Blatt (zum Ausfüllen von Hand): auch die selten nötigen Felder als Linie, Startauswahl nicht vordrucken
    const leer = !text(d, "taetigkeit") && !text(d, "beginn");
    const erwerb = text(d, "erwerb") === "neben" ? "Nebenerwerb" : leer ? "" : "Haupterwerb";
    const geburtsname = text(d, "geburtsname") || (leer ? "" : null);
    return dokument({
      titel: "Gewerbeanmeldung – Datenblatt",
      betrieb: b,
      inhalt:
        `<p class="klein">Zum Übertragen in das Formular GewA 1 bzw. das Online-Formular der Gemeinde. Die Feldnummern sind die Reihenfolge dieses Blatts, nicht die des amtlichen Vordrucks.</p>` +
        abschnitt(
          "Angaben zur Person",
          felder([
            ["Name", text(d, "name")],
            ["Geburtsname (falls abweichend)", geburtsname],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Geburtsort", text(d, "geburtsort")],
            ["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")],
            ["Wohnanschrift", text(d, "wohnanschrift")],
          ]),
        ) +
        abschnitt(
          "Angaben zum Betrieb",
          felder(
            [
              ["Name des Betriebs", b.name],
              ["Rechtsform", rechtsform],
              ["Registereintrag", register],
              ["Betriebsstätte", anschrift(b)],
              ["Telefon, E-Mail", [b.telefon, b.email].filter((x) => x.trim()).join(", ")],
              ["Angemeldete Tätigkeit", text(d, "taetigkeit")],
              ["Beginn der Tätigkeit", datumDe(text(d, "beginn"))],
              ["Haupt- oder Nebenerwerb", erwerb],
              ["Zahl der Beschäftigten", text(d, "beschaeftigte")],
              ["Erlaubnis, Handwerkskarte", text(d, "erlaubnis") || (leer ? "" : null)],
            ],
            { start: 7 - (geburtsname === null ? 1 : 0) },
          ),
        ) +
        uebertragung(["Angemeldet am", "Gewerbeamt", "Gebühr, Aktenzeichen"]),
    });
  },
};

export const HR_KAPITAL_GMBH = "Stammkapital: bei einer GmbH mindestens 25.000 € (§ 5 Abs. 1 GmbHG)";
export const HR_KAPITAL_UG = "Stammkapital: bei einer UG mindestens 1 € (§ 5a Abs. 1 GmbHG)";
export const HR_KAPITAL_EURO = "Stammkapital und Geschäftsanteile in vollen Euro (§ 5 Abs. 2 GmbHG)";

const HR_FORMEN = ["GmbH", "UG (haftungsbeschränkt)", "e. K.", "OHG", "KG", "GmbH & Co. KG"].map((r) => ({ wert: r, text: r }));
/**
 * Nachprüfung Rechtsanwalt (23.10.2026): für OHG und KG Rechtsform-abhängige Abschnitte – Kommanditisten mit Hafteinlage
 * (§ 162 Abs. 1 HGB), Vertretungsregelung der Gesellschafter (§ 106 Abs. 2 Nr. 3 HGB) und der Hinweis, dass alle
 * Gesellschafter anmelden (§ 106 Abs. 7 HGB).
 */
const HR_PERSONENGESELLSCHAFT = ["OHG", "KG", "GmbH & Co. KG"];
const HR_KG = ["KG", "GmbH & Co. KG"];
const HR_STELLUNG = [
  { wert: "phg", text: "persönlich haftend" },
  { wert: "kommandit", text: "Kommanditist/in" },
];
export const HR_ALLE_MELDEN = "Bei OHG und KG melden alle Gesellschafter die Gesellschaft zur Eintragung an (§ 106 Abs. 7 HGB).";
export const HR_HAFTEINLAGE = "Bei einer KG je Kommanditistin bzw. Kommanditist den Betrag der Hafteinlage angeben (§ 162 Abs. 1 HGB).";
const hrRechtsform = (d: Daten, b?: Betrieb) => rechtsformAus(text(d, "rechtsform") || b?.rechtsform, HR_FORMEN.map((o) => o.wert));

export const handelsregister: Vorlage = {
  id: "handelsregister",
  gestalt: "formular",
  titel: "Handelsregister (Vorbereitung)",
  beschreibung: "Die Angaben für die Anmeldung zum Handelsregister – Firma, Sitz, Gegenstand, Kapital, Gesellschafter, Geschäftsführung und Vertretung, bei OHG und KG mit Kommanditisten und Hafteinlage – zum Termin beim Notar.",
  bereich: "betrieb",
  pflichten: ["gesellschaft.handelsregister_anmeldung"],
  namensFeld: "firma",
  ausBetrieb: { firma: "name", rechtsform: "rechtsform" },
  abschnitte: [
    { titel: "Gesellschaft",
      hilfe: "Die Anmeldung zum Handelsregister macht der Notar. Mit diesem Blatt hast du alle Angaben beisammen.",
      felder: [
        { id: "firma", art: "text", label: "Firma (Name im Register)", pflicht: true },
        { id: "rechtsform", art: "wahl", label: "Rechtsform", optionen: HR_FORMEN, hilfe: "ohne Auswahl die Rechtsform aus „Mein Betrieb“" },
        { id: "sitz", art: "text", label: "Sitz (Ort)", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Inländische Geschäftsanschrift", pflicht: true },
        { id: "gegenstand", art: "mehrzeilig", label: "Gegenstand des Unternehmens", pflicht: true },
        // „Stammkapital“: zur Auswahl stehen nur GmbH und UG als Kapitalgesellschaften (keine AG)
        { id: "kapital", art: "betrag", label: "Stammkapital (€)", hilfe: "nur bei GmbH und UG" },
      ],
    },
    {
      titel: "Gesellschafter",
      hilfe: `Bei OHG und KG alle Gesellschafter. ${HR_ALLE_MELDEN}`,
      felder: [
        {
          id: "gesellschafter",
          art: "liste",
          label: "Gesellschafter",
          eintrag: "Gesellschafter/in",
          titelFeld: "name",
          felder: [
            ...PERSON,
            { id: "anteil", art: "text", label: "Anteil", hilfe: "z. B. 12.500 € bzw. 50 %" },
            { id: "stellung", art: "wahl", label: "Stellung in der OHG bzw. KG", optionen: HR_STELLUNG, hilfe: "nur bei OHG und KG" },
            { id: "hafteinlage", art: "betrag", label: "Hafteinlage (€)", hilfe: "Betrag der Einlage der Kommanditistin bzw. des Kommanditisten (§ 162 Abs. 1 HGB)", wenn: { feld: "stellung", ist: "kommandit" } },
          ],
        },
      ],
    },
    { titel: "Geschäftsführung bzw. Inhaber/in", felder: [{ id: "fuehrung", art: "liste", label: "Geschäftsführung", eintrag: "Person", titelFeld: "name", pflicht: true, felder: PERSON }, { id: "vertretung", art: "mehrzeilig", label: "Vertretungsregelung", hilfe: "z. B. vertritt allein; bei mehreren: gemeinsam oder einzeln. Bei OHG und KG: wie die Gesellschafter die Gesellschaft vertreten (§ 106 Abs. 2 Nr. 3 HGB)" }] },
  ],
  // R12 (Recht #16): Stammkapital der GmbH mindestens 25.000 €, in vollen Euro (§ 5 Abs. 1, 2 GmbHG); UG ab 1 € (§ 5a Abs. 1 GmbHG)
  // OHG und KG: vertreten durch die Gesellschafter – eine eigene Geschäftsführung ist keine Pflichtangabe
  nichtPflicht: (d) => (HR_PERSONENGESELLSCHAFT.includes(hrRechtsform(d)) ? ["fuehrung"] : []),
  pruefen(d, b) {
    const rechtsform = hrRechtsform(d, b);
    const f: string[] = [];
    if (HR_KG.includes(rechtsform) && liste(d, "gesellschafter").some((x) => text(x, "name") && text(x, "stellung") === "kommandit" && !text(x, "hafteinlage").trim())) f.push(HR_HAFTEINLAGE);
    const c = cent(text(d, "kapital"));
    if (c === null || !text(d, "kapital").trim()) return f;
    if (rechtsform === "GmbH" && c < 2_500_000) f.push(HR_KAPITAL_GMBH);
    if (rechtsform === "UG (haftungsbeschränkt)" && c < 100) f.push(HR_KAPITAL_UG);
    if ((rechtsform === "GmbH" || rechtsform === "UG (haftungsbeschränkt)") && c % 100 !== 0) f.push(HR_KAPITAL_EURO);
    return f;
  },
  pruefenZu: { [HR_KAPITAL_GMBH]: "kapital", [HR_KAPITAL_UG]: "kapital", [HR_KAPITAL_EURO]: "kapital" },
  html(d, b) {
    const ges = liste(d, "gesellschafter").filter((x) => text(x, "name"));
    const gf = liste(d, "fuehrung").filter((x) => text(x, "name"));
    const firma = text(d, "firma") || b.name.trim();
    const rechtsform = hrRechtsform(d, b);
    // Kapitalgesellschaft: Gesellschafter und Stammkapital gehören immer dazu (leer als Zeilen zum Ausfüllen)
    const kapitalgesellschaft = rechtsform === "GmbH" || rechtsform === "UG (haftungsbeschränkt)";
    // Rechtsanwalt (23.10.2026): OHG und KG – Gesellschafter mit Stellung und Hafteinlage, Vertretungsregelung, alle melden an
    const personengesellschaft = HR_PERSONENGESELLSCHAFT.includes(rechtsform);
    const kg = HR_KG.includes(rechtsform);
    const stellung = (x: Eintrag) => {
      const st = HR_STELLUNG.find((o) => o.wert === text(x, "stellung"))?.text ?? "";
      const he = text(x, "stellung") === "kommandit" && text(x, "hafteinlage") ? `Hafteinlage ${euro(cent(text(x, "hafteinlage")) ?? 0)}` : "";
      return [st, he].filter(Boolean).join(", ");
    };
    const gesellschafterTabelle = () =>
      tabelle(["Name", "Geburtsdatum", "Wohnort", ...(kg ? ["Stellung, Hafteinlage"] : [])], ges.map((x) => [zelle(text(x, "name")), datumDe(text(x, "geburtsdatum")), zelle(text(x, "wohnort")), ...(kg ? [zelle(stellung(x))] : [])]), { breiten: kg ? ["32%", "18%", "22%", "28%"] : ["32%", "18%", "50%"], ...(ges.length ? {} : { mindestens: 3, hoch: true }) });
    // Name und Geburtsdatum in beiden Tabellen gleich breit, damit die Spalten untereinander stehen
    const person = (l: typeof ges, extra = false, mindestens = 0) =>
      tabelle(["Name", "Geburtsdatum", "Wohnort", ...(extra ? ["Anteil"] : [])], l.map((x) => [zelle(text(x, "name")), datumDe(text(x, "geburtsdatum")), zelle(text(x, "wohnort")), ...(extra ? [zelle(text(x, "anteil"))] : [])]), { breiten: extra ? ["32%", "18%", "28%", "22%"] : ["32%", "18%", "50%"], ...(l.length ? {} : { mindestens, hoch: true }) });
    return dokument({
      titel: "Anmeldung zum Handelsregister – Vorbereitung",
      betrieb: b,
      unter: firma || undefined,
      inhalt:
        `<p class="klein">Für den Termin beim Notar: Die Anmeldung zum Handelsregister reicht der Notar elektronisch ein; dieses Blatt hält die nötigen Angaben bereit.${personengesellschaft ? ` ${esc(HR_ALLE_MELDEN)}` : ""}</p>` +
        abschnitt(
          "Gesellschaft",
          felder([
            ["Firma", firma],
            ["Rechtsform", rechtsform],
            ["Sitz", text(d, "sitz")],
            ["Inländische Geschäftsanschrift", text(d, "anschrift")],
            ["Gegenstand des Unternehmens", text(d, "gegenstand")],
            ["Stammkapital", text(d, "kapital") ? euro(cent(text(d, "kapital")) ?? 0) : kapitalgesellschaft ? "" : null],
          ]),
        ) +
        (personengesellschaft
          ? abschnitt(kg ? "Gesellschafter (persönlich haftende und Kommanditisten)" : "Gesellschafter", gesellschafterTabelle() + (kg ? nachsatz(HR_HAFTEINLAGE) : ""))
          : ges.length || kapitalgesellschaft
            ? abschnitt("Gesellschafter", person(ges, true, 3))
            : "") +
        // OHG und KG: Geschäftsführung nur, wenn eingetragen (die Gesellschafter vertreten)
        (personengesellschaft && !gf.length ? "" : abschnitt(kapitalgesellschaft ? "Geschäftsführung" : "Geschäftsführung bzw. Inhaber/in", person(gf, false, 2))) +
        // GmbH/UG und OHG/KG: Vertretungsregelung gehört dazu – leer als Linien zum Ausfüllen
        (text(d, "vertretung") || kapitalgesellschaft || personengesellschaft ? abschnitt(personengesellschaft ? "Vertretungsregelung der Gesellschafter" : "Vertretungsregelung", absatz(text(d, "vertretung")), personengesellschaft ? { rand: "§ 106 Abs. 2 Nr. 3 HGB" } : "") : "") +
        uebertragung(["Notartermin am", "Notar/in", "Eingetragen am, Registernummer"]),
    });
  },
};

/** Kurzbezeichnung der Art des wirtschaftlichen Interesses für die Tabelle (die Auswahltexte sind dafür zu lang). */
const INTERESSE_KURZ: Record<string, string> = {
  beteiligung: "Kapitalanteile",
  stimmrechte: "Stimmrechte",
  kontrolle_sonstige: "Kontrolle auf sonstige Weise",
  fiktiv: "Fiktiv wirtschaftlich Berechtigte/r (gesetzliche Vertretung)",
};
/** „Kapitalanteile: 60 %“ – reine Zahlen bei Kapitalanteilen und Stimmrechten mit „%“, wie in der Auswahl angegeben. */
function interesseText(art: string, umfang: string): string {
  const u = umfang.trim();
  const mitEinheit = (art === "beteiligung" || art === "stimmrechte") && /^\d+(?:[.,]\d+)?$/.test(u) ? `${u} %` : u.replace(/(\d)\s*%/g, "$1 %");
  return [INTERESSE_KURZ[art] ?? INTERESSE.find((o) => o.wert === art)?.text ?? "", mitEinheit].filter(Boolean).join(": ");
}

/** Spaltenbreiten der Tabelle „Wirtschaftlich Berechtigte“ (Geburtsdatum schmal, Staatsangehörigkeiten breiter). */
const TR_BREITEN = ["24%", "11%", "20%", "17%", "28%"];

export const transparenzregister: Vorlage = {
  id: "transparenzregister",
  gestalt: "formular",
  titel: "Transparenzregister: wirtschaftlich Berechtigte",
  beschreibung: "Wer hinter der Gesellschaft steht – Name, Geburtsdatum, Wohnort, Staatsangehörigkeit, Art und Umfang des Interesses. Für die Meldung und deine Unterlagen.",
  bereich: "betrieb",
  pflichten: ["gesellschaft.transparenzregister"],
  grundlage: "§§ 19, 20 GwG",
  ausBetrieb: { rechtsform: "rechtsform" },
  abschnitte: [
    { titel: "Gesellschaft",
      hilfe: "Gemeldet wird online beim Transparenzregister. Dieses Blatt hält fest, was du gemeldet hast.",
      felder: [
        { id: "rechtsform", art: "text", label: "Rechtsform", hilfe: "z. B. GmbH" },
        { id: "register", art: "text", label: "Registergericht und Nummer", hilfe: "ohne Angabe aus „Mein Betrieb“" },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
    {
      titel: "Wirtschaftlich Berechtigte",
      felder: [
        {
          id: "berechtigte",
          art: "liste",
          label: "Wirtschaftlich Berechtigte",
          eintrag: "Person",
          titelFeld: "name",
          pflicht: true,
          felder: [...PERSON, { id: "staatsangehoerigkeit", art: "text", label: "Alle Staatsangehörigkeiten", pflicht: true }, { id: "interesse_art", art: "wahl", label: "Art des wirtschaftlichen Interesses", optionen: INTERESSE, vorbelegung: "beteiligung" }, { id: "interesse", art: "text", label: "Umfang", hilfe: "z. B. 60 % der Kapitalanteile", pflicht: true }],
        },
      ],
    },
    { titel: "Meldung", felder: [{ id: "gemeldet", art: "datum", label: "Gemeldet am" }] },
  ],
  html(d, b) {
    const l = liste(d, "berechtigte").filter((x) => text(x, "name"));
    return dokument({
      titel: "Wirtschaftlich Berechtigte",
      betrieb: b,
      unter: "Angaben zum Transparenzregister",
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        abschnitt("Gesellschaft", felder([["Gesellschaft", b.name], ["Rechtsform", text(d, "rechtsform") || (b.rechtsform ?? "").trim()], ["Registergericht und Nummer", text(d, "register") || registerAus(b) || null], ["Gemeldet am", datumDe(text(d, "gemeldet"))]])) +
        abschnitt("Wirtschaftlich Berechtigte (§ 3 GwG)", l.length ? tabelle(["Name", "Geburtsdatum", "Wohnort", "Staatsangehörigkeiten", "Interesse"], l.map((x) => [zelle(text(x, "name")), datumDe(text(x, "geburtsdatum")), zelle(text(x, "wohnort")), zelle(text(x, "staatsangehoerigkeit")), zelle(interesseText(text(x, "interesse_art"), text(x, "interesse")))]), { breiten: TR_BREITEN }) : tabelle(["Name", "Geburtsdatum", "Wohnort", "Staatsangehörigkeiten", "Interesse"], [], { breiten: TR_BREITEN, mindestens: 4, hoch: true })) +
        // das Meldedatum steht in Feld 04 (leer als Linie), nicht noch einmal unten
        uebertragung(["Bestätigung, Vorgangsnummer"]) +
        unterschriften(["Geschäftsführung"], { ortDatum: true }),
    });
  },
};
