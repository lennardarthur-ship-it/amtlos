/** Personal: Nachweis der Arbeitsbedingungen, KI-Kompetenz-Schulung. */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { abschnitt, absatz, angaben, anschrift, datumDe, dokument, liste, text, unterschriften } from "./html.js";
import type { Vorlage } from "./typen.js";

/**
 * Angaben nach § 2 Abs. 1 NachwG in der Reihenfolge des Gesetzes. Gliederung und Vollständigkeit fachlich zu prüfen
 * (T-53). `nurFalls`: entfällt im Dokument, wenn leer.
 */
const NACHWG: { id: string; label: string; hilfe?: string; art?: "datum" | "text"; nurFalls?: boolean }[] = [
  { id: "beginn", label: "Beginn des Arbeitsverhältnisses", art: "datum" },
  { id: "befristung_ende", label: "Enddatum oder Dauer bei Befristung", art: "text", nurFalls: true },
  { id: "arbeitsort", label: "Arbeitsort", hilfe: "oder Hinweis, dass an verschiedenen Orten gearbeitet wird bzw. der Ort frei gewählt werden kann" },
  { id: "taetigkeit", label: "Bezeichnung oder Beschreibung der Tätigkeit" },
  { id: "probezeit", label: "Dauer der Probezeit", art: "text", nurFalls: true },
  { id: "entgelt", label: "Arbeitsentgelt", hilfe: "Zusammensetzung und Höhe einschließlich Zuschlägen, Zulagen, Prämien und Sonderzahlungen; Fälligkeit und Art der Auszahlung" },
  { id: "arbeitszeit", label: "Arbeitszeit", hilfe: "vereinbarte Arbeitszeit, Ruhepausen und Ruhezeiten; bei Schichtarbeit Schichtsystem und -rhythmus" },
  { id: "abruf", label: "Arbeit auf Abruf", hilfe: "nur falls vereinbart", nurFalls: true },
  { id: "ueberstunden", label: "Überstunden", hilfe: "ob und unter welchen Voraussetzungen Überstunden angeordnet werden können" },
  { id: "urlaub", label: "Dauer des jährlichen Erholungsurlaubs", art: "text" },
  { id: "fortbildung", label: "Fortbildung", hilfe: "ein etwaiger Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung", nurFalls: true },
  { id: "altersversorgung", label: "Betriebliche Altersversorgung über einen Versorgungsträger", hilfe: "Name und Anschrift des Versorgungsträgers, falls zugesagt", nurFalls: true },
  { id: "kuendigung", label: "Kündigung", hilfe: "das einzuhaltende Verfahren (mindestens Schriftform), die Kündigungsfristen und die Frist zur Erhebung einer Kündigungsschutzklage" },
  { id: "kollektiv", label: "Tarifverträge, Betriebs- oder Dienstvereinbarungen", hilfe: "Hinweis auf anwendbare Vereinbarungen", nurFalls: true },
];

export const nachweisArbeitsbedingungen: Vorlage = {
  id: "nachweis_arbeitsbedingungen",
  titel: "Nachweis der wesentlichen Arbeitsbedingungen",
  beschreibung: "Die wesentlichen Arbeitsbedingungen einer neuen beschäftigten Person schriftlich – zum Unterschreiben und Aushändigen.",
  bereich: "personal",
  pflichten: ["personal.nachweisgesetz"],
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Beschäftigte Person",
      felder: [
        { id: "name", art: "text", label: "Name", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Anschrift", pflicht: true },
      ],
    },
    {
      titel: "Arbeitsbedingungen",
      hilfe: "Felder mit „nur falls“ entfallen im Dokument, wenn sie leer sind.",
      felder: NACHWG.map((x) =>
        x.art === "datum"
          ? { id: x.id, art: "datum" as const, label: x.label, pflicht: true }
          : { id: x.id, art: x.art === "text" ? ("text" as const) : ("mehrzeilig" as const), label: x.label, hilfe: x.nurFalls && !x.hilfe ? "nur falls zutreffend" : x.hilfe, pflicht: !x.nurFalls },
      ),
    },
    { felder: [{ id: "ausgestellt_am", art: "datum", label: "Ausgestellt am", vorbelegung: "heute" }] },
  ],
  html(d, b) {
    return dokument({
      titel: "Nachweis der wesentlichen Arbeitsbedingungen",
      betrieb: b,
      unter: text(d, "name") || undefined,
      meta: `Ausgestellt: ${datumDe(text(d, "ausgestellt_am")) || "–"}`,
      inhalt:
        abschnitt(
          "Vertragsparteien",
          angaben([
            ["Arbeitgeber", [b.name, anschrift(b)].filter((x) => x.trim()).join("\n")],
            ["Beschäftigte Person", [text(d, "name"), text(d, "anschrift")].filter(Boolean).join("\n")],
          ]),
        ) +
        abschnitt(
          "Arbeitsbedingungen",
          angaben(NACHWG.filter((x) => !x.nurFalls || text(d, x.id)).map((x) => [x.label, x.art === "datum" ? datumDe(text(d, x.id)) : text(d, x.id)] as [string, string])),
        ) +
        unterschriften(["Ort, Datum · Arbeitgeber/in", "Erhalten am · beschäftigte Person"]),
    });
  },
};

export const kiKompetenz: Vorlage = {
  id: "ki_kompetenz",
  titel: "Nachweis KI-Kompetenz-Schulung",
  beschreibung: "Wer wann zu welchen KI-Werkzeugen geschult wurde – mit Unterschriften der Teilnehmenden.",
  bereich: "personal",
  pflichten: ["ki.kompetenz"],
  namensFeld: "thema",
  abschnitte: [
    {
      felder: [
        { id: "thema", art: "text", label: "Thema der Schulung", hilfe: "z. B. Sicherer Umgang mit Chatbots im Büro", pflicht: true },
        { id: "ki_systeme", art: "text", label: "Eingesetzte KI-Werkzeuge", hilfe: "z. B. Textassistent, Übersetzungsprogramm, Bildbearbeitung", pflicht: true },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", hilfe: "z. B. 2 Stunden" },
        { id: "durchgefuehrt_von", art: "text", label: "Durchgeführt von", hilfe: "Person oder Anbieter", vorbelegung: "verantwortlich", pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Inhalte", hilfe: "z. B. Funktionsweise, Chancen und Risiken, was nicht eingegeben werden darf, Ergebnisse prüfen", pflicht: true },
      ],
    },
    {
      titel: "Teilnehmende",
      felder: [{ id: "teilnehmer", art: "liste", label: "Teilnehmende", eintrag: "Person", titelFeld: "name", felder: [{ id: "name", art: "text", label: "Name", pflicht: true }] }],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Nachweis KI-Kompetenz-Schulung",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt:
        angaben([
          ["Thema", text(d, "thema")],
          ["KI-Werkzeuge", text(d, "ki_systeme")],
          ["Datum", datumDe(text(d, "datum"))],
          ["Dauer", text(d, "dauer") || null],
          ["Durchgeführt von", text(d, "durchgefuehrt_von")],
        ]) +
        abschnitt("Inhalte", absatz(text(d, "inhalt"))) +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich die Teilnahme an der Schulung.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        unterschriften(["Unterschrift der schulenden Person"]),
    });
  },
};
