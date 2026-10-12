/** Datenschutz: Verzeichnis der Verarbeitungstätigkeiten mit TOM, Datenpanne, Datenschutzinformation. */
import { abschnitt, absatz, angaben, anschrift, datumDe, dokument, esc, ja, liste, tabelle, text, zelle } from "./html.js";
import { DATENPANNE_RISIKO, SCHUTZZIELE, optionen } from "./konstanten.js";
import type { Vorlage } from "./typen.js";

export const datenschutzDokumentation: Vorlage = {
  id: "datenschutz_dokumentation",
  titel: "Verzeichnis der Verarbeitungstätigkeiten mit TOM",
  beschreibung: "Welche Daten über Menschen du wofür verarbeitest, wie du sie schützt (TOM) und welche Dienstleister Daten für dich verarbeiten.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.vvt", "datenschutz.tom"],
  abschnitte: [
    {
      felder: [
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
        { id: "verantwortlich", art: "text", label: "Verantwortliche Person", vorbelegung: "verantwortlich", pflicht: true },
        { id: "dsb", art: "text", label: "Datenschutzbeauftragte/r", hilfe: "nur falls benannt: Name und Kontakt" },
      ],
    },
    {
      titel: "Verarbeitungstätigkeiten",
      hilfe: "Je Zweck ein Eintrag, z. B. Kundenkartei, Terminbuchung, Lohnabrechnung, Videoüberwachung.",
      felder: [
        {
          id: "verarbeitungen",
          art: "liste",
          label: "Verarbeitungstätigkeiten",
          eintrag: "Verarbeitung",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung", hilfe: "z. B. Kundenkartei", pflicht: true },
            { id: "zweck", art: "mehrzeilig", label: "Zweck", pflicht: true },
            { id: "rechtsgrundlage", art: "text", label: "Rechtsgrundlage", pflicht: true },
            { id: "betroffene", art: "text", label: "Betroffene Personen", hilfe: "z. B. Kundinnen und Kunden, Beschäftigte", pflicht: true },
            { id: "datenarten", art: "mehrzeilig", label: "Datenarten", hilfe: "z. B. Name, Telefonnummer, Termine", pflicht: true },
            { id: "empfaenger", art: "text", label: "Empfänger", hilfe: "wer die Daten bekommt, z. B. Steuerberatung, Lohnbüro" },
            { id: "drittland", art: "text", label: "Übermittlung in Drittländer", hilfe: "falls Daten das EU-Ausland verlassen, z. B. durch einen Cloud-Dienst" },
            { id: "loeschfrist", art: "text", label: "Löschfrist", pflicht: true },
            { id: "tom_hinweis", art: "text", label: "Schutzmaßnahmen", hilfe: "kurz oder Verweis auf die TOM unten" },
          ],
        },
      ],
    },
    {
      titel: "Technische und organisatorische Maßnahmen (TOM)",
      hilfe: "Wie du die Daten schützt – z. B. Passwörter, Verschlüsselung, abschließbarer Schrank, Datensicherung.",
      felder: [
        {
          id: "tom",
          art: "liste",
          label: "Maßnahmen",
          eintrag: "Maßnahme",
          titelFeld: "massnahme",
          pflicht: true,
          felder: [
            { id: "schutzziel", art: "wahl", label: "Schutzziel", optionen: optionen(SCHUTZZIELE), vorbelegung: "vertraulichkeit" },
            { id: "massnahme", art: "mehrzeilig", label: "Maßnahme", pflicht: true },
            { id: "umgesetzt_am", art: "datum", label: "Umgesetzt am", hilfe: "leer lassen, wenn noch geplant" },
            { id: "verantwortlich", art: "text", label: "Verantwortlich" },
          ],
        },
      ],
    },
    {
      titel: "Dienstleister",
      hilfe: "Wer für dich Daten verarbeitet, z. B. Buchungssystem, Cloud-Speicher, Lohnbüro.",
      felder: [
        {
          id: "dienstleister",
          art: "liste",
          label: "Dienstleister",
          eintrag: "Dienstleister",
          titelFeld: "name",
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "leistung", art: "text", label: "Leistung" },
            { id: "auftragsverarbeitung", art: "schalter", label: "Verarbeitet Daten in meinem Auftrag" },
            { id: "avv_vorhanden", art: "schalter", label: "Vertrag zur Auftragsverarbeitung liegt vor", wenn: { feld: "auftragsverarbeitung" } },
            { id: "avv_datum", art: "datum", label: "Vertrag vom", wenn: { feld: "avv_vorhanden" } },
            { id: "drittland", art: "text", label: "Drittland", hilfe: "falls außerhalb der EU" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const v = liste(d, "verarbeitungen").filter((x) => text(x, "bezeichnung"));
    const tom = liste(d, "tom").filter((x) => text(x, "massnahme"));
    const dl = liste(d, "dienstleister").filter((x) => text(x, "name"));
    const verarbeitungen = v.length
      ? v
          .map(
            (x) =>
              `<div class="eintrag"><h3>${esc(text(x, "bezeichnung"))}</h3>${angaben([
                ["Zweck", text(x, "zweck")],
                ["Rechtsgrundlage", text(x, "rechtsgrundlage")],
                ["Betroffene Personen", text(x, "betroffene")],
                ["Datenarten", text(x, "datenarten")],
                ["Empfänger", text(x, "empfaenger") || "keine angegeben"],
                ["Drittland", text(x, "drittland") || "keine Übermittlung angegeben"],
                ["Löschfrist", text(x, "loeschfrist")],
                ["Schutzmaßnahmen", text(x, "tom_hinweis") || "siehe TOM"],
              ])}</div>`,
          )
          .join("")
      : absatz("", "Keine Verarbeitungstätigkeiten erfasst.");
    const massnahmen = tom.length
      ? Object.entries(SCHUTZZIELE)
          .map(([ziel, titel]) => {
            const l = tom.filter((x) => (text(x, "schutzziel") || "sonstiges") === ziel);
            if (!l.length) return "";
            return `<h3>${esc(titel)}</h3>${tabelle(["Maßnahme", "Stand", "Verantwortlich"], l.map((m) => [zelle(text(m, "massnahme")), text(m, "umgesetzt_am") ? `umgesetzt ${datumDe(text(m, "umgesetzt_am"))}` : "geplant", zelle(text(m, "verantwortlich"))]), { breiten: ["60%", "20%", "20%"] })}`;
          })
          .join("")
      : absatz("", "Keine Maßnahmen erfasst.");
    const dienstleister = dl.length
      ? tabelle(
          ["Dienstleister", "Leistung", "Auftragsverarbeitung", "Drittland"],
          dl.map((x) => [
            `<strong>${zelle(text(x, "name"))}</strong>`,
            zelle(text(x, "leistung")),
            ja(x, "auftragsverarbeitung") ? (ja(x, "avv_vorhanden") ? `Vertrag liegt vor${text(x, "avv_datum") ? ` (vom ${datumDe(text(x, "avv_datum"))})` : ""}` : "<strong>Vertrag fehlt</strong>") : "nein",
            zelle(text(x, "drittland")) || "–",
          ]),
          { breiten: ["25%", "30%", "28%", "17%"] },
        )
      : absatz("", "Keine Dienstleister erfasst.");
    return dokument({
      titel: "Verzeichnis der Verarbeitungstätigkeiten",
      betrieb: b,
      unter: "mit technischen und organisatorischen Maßnahmen und Dienstleistern",
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        angaben([
          ["Verantwortlicher", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")],
          ["Verantwortliche Person", text(d, "verantwortlich")],
          ["Datenschutzbeauftragte/r", text(d, "dsb") || null],
          ["Kontakt", [b.telefon, b.email].filter((x) => x.trim()).join(" · ") || null],
        ]) +
        abschnitt("Verarbeitungstätigkeiten", verarbeitungen) +
        abschnitt("Technische und organisatorische Maßnahmen", massnahmen) +
        abschnitt("Dienstleister", dienstleister),
    });
  },
};

/** Ortszeit Berlin (Datum + HH:MM) → UTC-Zeitpunkt, ohne Zusatzpaket. */
export function berlinZuUtc(datum: string, zeit: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const z = /^(\d{1,2}):(\d{2})$/.exec(zeit.trim() || "00:00");
  if (!m || !z) return null;
  const roh = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(z[1]), Number(z[2]));
  if (new Date(roh).toISOString().slice(0, 10) !== datum || Number(z[1]) > 23) return null;
  const versatz = (t: number) => {
    const teile = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    return Date.UTC(Number(teile.year), Number(teile.month) - 1, Number(teile.day), Number(teile.hour), Number(teile.minute)) - t;
  };
  let t = roh - versatz(roh);
  t = roh - versatz(t);
  return new Date(t);
}

/** Zeitpunkt in Berliner Ortszeit als „TT.MM.JJJJ, HH:MM Uhr“. */
export function berlinText(t: Date): string {
  return `${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t)} Uhr`;
}

export const datenpanne: Vorlage = {
  id: "datenpanne",
  titel: "Datenpanne: Dokumentation und Meldeentwurf",
  beschreibung: "Alles, was bei einer Datenpanne festzuhalten ist – als Dokumentation und als Vorlage für die Meldung an die Aufsichtsbehörde.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.datenpanne_meldung"],
  namensFeld: "beschreibung",
  abschnitte: [
    {
      titel: "Wann",
      hilfe: "Die Frist für die Meldung beginnt, sobald du von der Panne erfährst.",
      felder: [
        { id: "entdeckt_am", art: "datum", label: "Bekannt geworden am", vorbelegung: "heute", pflicht: true },
        { id: "entdeckt_um", art: "uhrzeit", label: "Uhrzeit", hilfe: "HH:MM" },
      ],
    },
    {
      titel: "Was ist passiert",
      felder: [
        { id: "beschreibung", art: "mehrzeilig", label: "Art der Verletzung", hilfe: "z. B. Laptop mit Kundendaten gestohlen, E-Mail an falschen Empfänger", pflicht: true },
        { id: "datenarten", art: "mehrzeilig", label: "Betroffene Datenarten", pflicht: true },
        { id: "betroffene_anzahl", art: "text", label: "Betroffene Personen und Datensätze (ungefähre Zahl)", pflicht: true },
        { id: "folgen", art: "mehrzeilig", label: "Wahrscheinliche Folgen", pflicht: true },
        { id: "massnahmen", art: "mehrzeilig", label: "Ergriffene und geplante Maßnahmen", pflicht: true },
        { id: "kontakt", art: "text", label: "Kontakt für Rückfragen", vorbelegung: "betrieb_kontakt", pflicht: true },
      ],
    },
    {
      titel: "Bewertung und Meldung",
      felder: [
        { id: "risiko", art: "wahl", label: "Bewertung", optionen: optionen(DATENPANNE_RISIKO) },
        { id: "begruendung", art: "mehrzeilig", label: "Begründung, warum keine Meldung nötig ist", wenn: { feld: "risiko", ist: "kein_risiko" }, pflicht: true },
        { id: "gemeldet", art: "schalter", label: "Bereits gemeldet", wenn: { feld: "risiko" } },
        { id: "gemeldet_am", art: "datum", label: "Gemeldet am", wenn: { feld: "gemeldet" } },
        { id: "aktenzeichen", art: "text", label: "Aktenzeichen der Behörde", wenn: { feld: "gemeldet" } },
      ],
    },
  ],
  html(d, b) {
    const beginn = berlinZuUtc(text(d, "entdeckt_am"), text(d, "entdeckt_um"));
    const risiko = text(d, "risiko");
    const gemeldet = ja(d, "gemeldet") && risiko !== "";
    const teile: [string, string][] = [
      ["Art der Verletzung", text(d, "beschreibung")],
      ["Kategorien der Daten", text(d, "datenarten")],
      ["Betroffene Personen und Datensätze (ungefähre Zahl)", text(d, "betroffene_anzahl")],
      ["Kontakt für Rückfragen", text(d, "kontakt")],
      ["Wahrscheinliche Folgen", text(d, "folgen")],
      ["Ergriffene und vorgeschlagene Maßnahmen", text(d, "massnahmen")],
      ...(risiko === "kein_risiko" ? ([["Begründung, warum keine Meldung nötig ist", text(d, "begruendung")]] as [string, string][]) : []),
    ];
    return dokument({
      titel: gemeldet ? "Meldung einer Datenpanne (Dokumentation)" : "Datenpanne – Meldeentwurf und Dokumentation",
      betrieb: b,
      meta: `Bekannt seit: ${datumDe(text(d, "entdeckt_am")) || "–"}`,
      inhalt:
        angaben([
          ["Bekannt geworden", beginn ? berlinText(beginn) : datumDe(text(d, "entdeckt_am"))],
          ["Frist (72 Stunden)", beginn ? berlinText(new Date(beginn.getTime() + 72 * 3600_000)) : ""],
          ["Bewertung", DATENPANNE_RISIKO[risiko] ?? "noch offen"],
          ["Gemeldet", gemeldet ? `${datumDe(text(d, "gemeldet_am")) || "ja"}${text(d, "aktenzeichen") ? ` · Aktenzeichen ${text(d, "aktenzeichen")}` : ""}` : "noch nicht gemeldet"],
        ]) + teile.map(([t, w]) => abschnitt(t, absatz(w))).join(""),
    });
  },
};

const INFO_TEILE: { id: string; label: string; hilfe: string; nurFalls?: boolean }[] = [
  { id: "dsb", label: "Kontakt der/des Datenschutzbeauftragten", hilfe: "nur falls benannt", nurFalls: true },
  { id: "zwecke", label: "Zwecke der Verarbeitung", hilfe: "Wofür du die Daten verwendest" },
  { id: "rechtsgrundlagen", label: "Rechtsgrundlagen", hilfe: "Auf welcher Grundlage du die Daten verarbeitest" },
  { id: "interessen", label: "Berechtigte Interessen", hilfe: "nur falls du dich auf berechtigte Interessen stützt", nurFalls: true },
  { id: "empfaenger", label: "Empfänger der Daten", hilfe: "Wer die Daten bekommt, z. B. Steuerberatung, Buchungssystem" },
  { id: "drittland", label: "Übermittlung in Drittländer", hilfe: "nur falls Daten das EU-Ausland verlassen", nurFalls: true },
  { id: "speicherdauer", label: "Speicherdauer", hilfe: "Wie lange du die Daten aufbewahrst" },
  { id: "rechte", label: "Rechte der betroffenen Personen", hilfe: "Welche Rechte die Menschen haben und wie sie sie ausüben" },
  { id: "widerruf", label: "Widerruf einer Einwilligung", hilfe: "nur falls du Daten mit Einwilligung verarbeitest", nurFalls: true },
  { id: "beschwerde", label: "Beschwerderecht bei einer Aufsichtsbehörde", hilfe: "Welche Behörde zuständig ist" },
  { id: "bereitstellung", label: "Pflicht zur Bereitstellung der Daten", hilfe: "Ob die Menschen die Daten angeben müssen und was passiert, wenn nicht" },
  { id: "automatisiert", label: "Automatisierte Entscheidungen", hilfe: "nur falls Entscheidungen automatisch getroffen werden", nurFalls: true },
];

export const datenschutzinformation: Vorlage = {
  id: "datenschutzinformation",
  titel: "Datenschutzinformation",
  beschreibung: "Informationsblatt für Kundschaft, Beschäftigte oder Bewerbende: wer Daten verarbeitet, wofür, wie lange und welche Rechte bestehen.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.informationspflichten"],
  namensFeld: "fuer_wen",
  abschnitte: [
    {
      felder: [
        { id: "fuer_wen", art: "text", label: "Für wen", hilfe: "z. B. Kundinnen und Kunden, Beschäftigte, Bewerbende", pflicht: true },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
    {
      titel: "Inhalt",
      hilfe: "Die verantwortliche Stelle übernimmt Amtlos aus „Mein Betrieb“. Abschnitte mit „nur falls“ entfallen im Dokument, wenn sie leer sind.",
      felder: INFO_TEILE.map((x) => ({ id: x.id, art: "mehrzeilig" as const, label: x.label, hilfe: x.hilfe, pflicht: !x.nurFalls })),
    },
  ],
  html(d, b) {
    const verantwortlich = [b.name, anschrift(b), [b.telefon, b.email].filter((x) => x.trim()).join(" · ")].filter((x) => x.trim()).join("\n");
    return dokument({
      titel: "Datenschutzinformation",
      betrieb: b,
      unter: text(d, "fuer_wen") ? `für ${text(d, "fuer_wen")}` : undefined,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        abschnitt("Verantwortliche Stelle", absatz(verantwortlich)) +
        INFO_TEILE.filter((x) => !x.nurFalls || text(d, x.id))
          .map((x) => abschnitt(x.label, absatz(text(d, x.id))))
          .join(""),
    });
  },
};
