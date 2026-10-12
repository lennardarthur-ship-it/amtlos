/**
 * Website und Verträge: Datenschutzerklärung für die Website, Impressum, Auftragsverarbeitungsvertrag (E-121).
 * Die Vorlagen geben die Gliederung vor; die Inhalte trägt der Nutzer ein (fachlich zu prüfen, T-59).
 */
import { abschnitt, absatz, angaben, anschrift, datumDe, dokument, text, unterschriften } from "./html.js";
import type { Betrieb, Daten, Vorlage } from "./typen.js";

type Teil = { id: string; label: string; hilfe: string; nurFalls?: boolean };

/** Abschnitte als reiner Text, z. B. zum Einfügen in die Website. Leere „nur falls“-Abschnitte entfallen. */
function klartext(titel: string, kopf: [string, string][], teile: Teil[], d: Daten): string {
  const bloecke = [...kopf.filter(([, w]) => w.trim()), ...teile.filter((t) => !t.nurFalls || text(d, t.id)).map((t) => [t.label, text(d, t.id) || "(noch nicht angegeben)"] as [string, string])];
  return [titel, ...bloecke.map(([k, w]) => `${k}\n${w}`)].join("\n\n");
}

const verantwortlicheStelle = (b: Betrieb) => [b.name, anschrift(b), [b.telefon, b.email].filter((x) => x.trim()).join(" · ")].filter((x) => x.trim()).join("\n");

const DSE: Teil[] = [
  { id: "dsb", label: "Datenschutzbeauftragte/r", hilfe: "nur falls benannt: Name und Kontakt", nurFalls: true },
  { id: "allgemein", label: "Allgemeines zur Datenverarbeitung", hilfe: "Welche Daten beim Besuch der Website anfallen und wofür" },
  { id: "hosting", label: "Hosting", hilfe: "Wo die Website liegt (Anbieter, Sitz) und was dort verarbeitet wird" },
  { id: "logfiles", label: "Server-Protokolle", hilfe: "Was der Server beim Aufruf speichert und wie lange" },
  { id: "kontakt", label: "Kontakt per E-Mail, Telefon oder Formular", hilfe: "Was mit Anfragen passiert und wie lange sie gespeichert werden" },
  { id: "buchung", label: "Online-Terminbuchung", hilfe: "nur falls angeboten: Anbieter und welche Daten", nurFalls: true },
  { id: "cookies", label: "Cookies und Einwilligung", hilfe: "nur falls Cookies gesetzt werden: welche, wofür, wie man widerspricht", nurFalls: true },
  { id: "analyse", label: "Reichweitenmessung und Analyse", hilfe: "nur falls genutzt: welches Werkzeug", nurFalls: true },
  { id: "eingebunden", label: "Eingebundene Dienste", hilfe: "nur falls genutzt, z. B. Karten, Videos, Schriften von anderen Anbietern", nurFalls: true },
  { id: "newsletter", label: "Newsletter", hilfe: "nur falls angeboten", nurFalls: true },
  { id: "social", label: "Soziale Netzwerke", hilfe: "nur falls verlinkt oder eingebunden", nurFalls: true },
  { id: "rechte", label: "Ihre Rechte", hilfe: "Welche Rechte Besucher haben und wie sie sie ausüben" },
  { id: "beschwerde", label: "Beschwerderecht", hilfe: "Bei welcher Aufsichtsbehörde man sich beschweren kann" },
];

export const datenschutzerklaerungWebsite: Vorlage = {
  id: "datenschutzerklaerung_website",
  titel: "Datenschutzerklärung für die Website",
  beschreibung: "Die Datenschutzerklärung für deine Website, gegliedert nach Hosting, Kontakt, Cookies und eingebundenen Diensten – als PDF und als Text zum Einfügen.",
  bereich: "datenschutz",
  pflichten: ["online.datenschutzerklaerung"],
  abschnitte: [
    { felder: [{ id: "website", art: "text", label: "Adresse der Website", hilfe: "z. B. www.salon-sonne.de" }, { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" }] },
    {
      titel: "Inhalt",
      hilfe: "Die verantwortliche Stelle übernimmt Amtlos aus „Mein Betrieb“. Abschnitte mit „nur falls“ entfallen, wenn sie leer sind.",
      felder: DSE.map((t) => ({ id: t.id, art: "mehrzeilig" as const, label: t.label, hilfe: t.hilfe, pflicht: !t.nurFalls })),
    },
  ],
  alsText: (d, b) => klartext("Datenschutzerklärung", [["Verantwortliche Stelle", verantwortlicheStelle(b)]], DSE, d) + (text(d, "stand") ? `\n\nStand: ${datumDe(text(d, "stand"))}` : ""),
  html(d, b) {
    return dokument({
      titel: "Datenschutzerklärung",
      betrieb: b,
      unter: text(d, "website") || undefined,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt: abschnitt("Verantwortliche Stelle", absatz(verantwortlicheStelle(b))) + DSE.filter((t) => !t.nurFalls || text(d, t.id)).map((t) => abschnitt(t.label, absatz(text(d, t.id)))).join(""),
    });
  },
};

const IMPRESSUM: Teil[] = [
  { id: "rechtsform", label: "Rechtsform", hilfe: "z. B. Einzelunternehmen, GmbH" },
  { id: "vertreten", label: "Vertreten durch", hilfe: "Inhaber/in oder Geschäftsführung" },
  { id: "register", label: "Registereintrag", hilfe: "nur falls eingetragen: Registergericht und Nummer", nurFalls: true },
  { id: "ust", label: "Umsatzsteuer-Identifikationsnummer", hilfe: "nur falls vorhanden", nurFalls: true },
  { id: "aufsicht", label: "Aufsichtsbehörde", hilfe: "nur falls dein Gewerbe eine Erlaubnis braucht", nurFalls: true },
  { id: "beruf", label: "Berufsrechtliche Angaben", hilfe: "nur bei reglementierten Berufen (z. B. Handwerk): Kammer, Berufsbezeichnung, Staat der Verleihung, Regelungen", nurFalls: true },
  { id: "redaktion", label: "Verantwortlich für den Inhalt", hilfe: "nur falls du journalistisch-redaktionelle Inhalte veröffentlichst (z. B. Blog)", nurFalls: true },
  { id: "streit", label: "Streitbeilegung", hilfe: "nur falls du dazu etwas angeben möchtest oder musst", nurFalls: true },
];

export const impressum: Vorlage = {
  id: "impressum",
  titel: "Impressum",
  beschreibung: "Die Anbieterangaben für deine Website – mit Name, Anschrift, Kontakt und, falls nötig, Register und Kammer. Als Text zum Einfügen.",
  bereich: "betrieb",
  pflichten: ["online.impressum"],
  abschnitte: [
    {
      hilfe: "Name, Anschrift, Telefon und E-Mail übernimmt Amtlos aus „Mein Betrieb“.",
      felder: IMPRESSUM.map((t) => ({ id: t.id, art: "text" as const, label: t.label, hilfe: t.hilfe, pflicht: !t.nurFalls })),
    },
  ],
  pruefen(_d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift (Mein Betrieb)");
    if (!b.email.trim()) f.push("E-Mail (Mein Betrieb)");
    return f;
  },
  alsText: (d, b) => klartext("Impressum", [["Angaben zum Anbieter", [b.name, b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join("\n")], ["Kontakt", [b.telefon ? `Telefon: ${b.telefon}` : "", b.email ? `E-Mail: ${b.email}` : ""].filter(Boolean).join("\n")]], IMPRESSUM, d),
  html(d, b) {
    return dokument({
      titel: "Impressum",
      betrieb: b,
      inhalt:
        abschnitt("Angaben zum Anbieter", absatz([b.name, b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join("\n"))) +
        abschnitt("Kontakt", absatz([b.telefon ? `Telefon: ${b.telefon}` : "", b.email ? `E-Mail: ${b.email}` : ""].filter(Boolean).join("\n"))) +
        IMPRESSUM.filter((t) => !t.nurFalls || text(d, t.id)).map((t) => abschnitt(t.label, absatz(text(d, t.id)))).join(""),
    });
  },
};

const ROLLE = [
  { wert: "auftraggeber", text: "Wir beauftragen einen Dienstleister" },
  { wert: "dienstleister", text: "Wir verarbeiten Daten für einen Kunden" },
];

const AVV: Teil[] = [
  { id: "gegenstand", label: "Gegenstand und Dauer des Auftrags", hilfe: "Welche Leistung, ab wann, wie lange" },
  { id: "zweck", label: "Art und Zweck der Verarbeitung", hilfe: "Was mit den Daten gemacht wird und wofür" },
  { id: "datenarten", label: "Art der personenbezogenen Daten", hilfe: "z. B. Name, Kontaktdaten, Termine" },
  { id: "betroffene", label: "Kategorien betroffener Personen", hilfe: "z. B. Kundinnen und Kunden, Beschäftigte" },
  { id: "pflichten", label: "Pflichten des Auftragsverarbeiters", hilfe: "Die vereinbarten Pflichten, insbesondere die in Art. 28 Abs. 3 DSGVO genannten" },
  { id: "tom", label: "Technische und organisatorische Maßnahmen", hilfe: "Wie der Auftragsverarbeiter die Daten schützt – oder Verweis auf eine Anlage" },
  { id: "unterauftrag", label: "Unterauftragsverarbeiter", hilfe: "Wer zusätzlich eingesetzt wird – oder „keine“" },
  { id: "ende", label: "Löschung und Rückgabe nach Ende des Auftrags", hilfe: "Was mit den Daten nach Vertragsende passiert" },
];

export const auftragsverarbeitung: Vorlage = {
  id: "avv",
  titel: "Vertrag zur Auftragsverarbeitung (AVV)",
  beschreibung: "Vertrag mit einem Dienstleister, der für dich Daten verarbeitet – oder mit einem Kunden, für den du Daten verarbeitest.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.avv"],
  namensFeld: "partner",
  abschnitte: [
    {
      hilfe: "Viele Anbieter stellen einen eigenen Vertrag bereit – dann reicht es oft, den zu unterschreiben und abzulegen.",
      felder: [
        { id: "rolle", art: "wahl", label: "Wer ist wer", optionen: ROLLE, vorbelegung: "auftraggeber" },
        { id: "partner", art: "text", label: "Vertragspartner", pflicht: true },
        { id: "partner_anschrift", art: "mehrzeilig", label: "Anschrift des Vertragspartners", pflicht: true },
      ],
    },
    { titel: "Inhalt", felder: AVV.map((t) => ({ id: t.id, art: "mehrzeilig" as const, label: t.label, hilfe: t.hilfe, pflicht: true })) },
  ],
  html(d, b) {
    const wir = [b.name, anschrift(b)].filter((x) => x.trim()).join("\n");
    const sie = [text(d, "partner"), text(d, "partner_anschrift")].filter(Boolean).join("\n");
    const auftraggeber = text(d, "rolle") !== "dienstleister";
    return dokument({
      titel: "Vertrag zur Auftragsverarbeitung",
      betrieb: b,
      unter: text(d, "partner") ? `mit ${text(d, "partner")}` : undefined,
      inhalt:
        abschnitt("Vertragsparteien", angaben([["Verantwortlicher (Auftraggeber)", auftraggeber ? wir : sie], ["Auftragsverarbeiter", auftraggeber ? sie : wir]])) +
        AVV.map((t) => abschnitt(t.label, absatz(text(d, t.id)))).join("") +
        unterschriften(["Ort, Datum · Verantwortlicher", "Ort, Datum · Auftragsverarbeiter"]),
    });
  },
};
