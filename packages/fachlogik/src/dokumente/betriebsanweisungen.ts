/**
 * E-167 (Sifa-Durchsicht 22.10.2026, Blatt „B Vorlagen“): Betriebsanweisungen für Arbeitsmittel (§ 12 Abs. 2 BetrSichV) und
 * für Tätigkeiten mit Biostoffen (§ 14 Abs. 1 BioStoffV) – derselbe Aushang wie die Betriebsanweisung für Gefahrstoffe
 * (Muster DGUV Information 211-010), mit eigener Farbe und eigener Gliederung. Die Vorschläge zum Antippen sind allgemeine
 * Regeln je Maschine bzw. Tätigkeit; sie sind fachlich noch zu prüfen (PRUEFLISTE T-153).
 */
import { BEREICHE_VORSCHLAG, baAushang, baFelder, type BaTeil } from "./arbeitsschutz.js";
import { text } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Daten, Vorlage } from "./typen.js";

/** Vorschläge mit Branchengruppen: [Text, Gruppen] – ohne Gruppen für alle. */
const mitGruppen = (l: [string, string[]?][]) => ({ vorschlaege: l.map(([t]) => t), vorschlagGruppen: Object.fromEntries(l.filter(([, g]) => g?.length).map(([t, g]) => [t, g!])) });
const GASTRO = ["gastro_cafe"];
const BAECKER = ["baeckerei"];
const HOLZ = ["handwerk_allgemein"];
const KFZ = ["kfz_werkstatt"];

/** Typische Maschinen kleiner Betriebe (Blatt „B Vorlagen“: Aufschnitt-, Knetmaschine, Kreissäge, Hebebühne, Reifenmontiermaschine). */
const MASCHINEN = mitGruppen([["Aufschnittmaschine", GASTRO], ["Knetmaschine (Spiralkneter)", BAECKER], ["Tischkreissäge", HOLZ], ["Hebebühne", KFZ], ["Reifenmontiermaschine", KFZ]]);

/** Gliederung nach DGUV Information 211-010 (Arbeitsmittel): Anwendungsbereich steht im Kopf. */
const MASCHINE_TEILE: BaTeil[] = [
  {
    id: "gefahren",
    label: "Gefahren für Mensch und Umwelt",
    hilfe: "Was an der Maschine passieren kann – aus der Gefährdungsbeurteilung und der Betriebsanleitung des Herstellers",
    ...mitGruppen([
      ["Erfasst- oder Eingezogenwerden an bewegten Teilen."],
      ["Schnittverletzungen am rotierenden Messer, besonders beim Reinigen und beim Schneiden kleiner Reststücke.", GASTRO],
      ["Einzug und Quetschen von Händen und Armen am laufenden Knethaken und am Kessel.", BAECKER],
      ["Schnittverletzungen am Sägeblatt, Rückschlag des Werkstücks, Holzstaub und Lärm.", HOLZ],
      ["Quetschen durch absinkende oder abrutschende Fahrzeuge.", KFZ],
      ["Quetschen an Montierkopf und Felge; Platzen des Reifens beim Befüllen.", KFZ],
    ]),
  },
  {
    id: "schutz",
    label: "Schutzmaßnahmen und Verhaltensregeln",
    hilfe: "Konkret mit „müssen“ und „dürfen nicht“ – technisch vor organisatorisch vor persönlich",
    linien: 5,
    ...mitGruppen([
      ["Die Maschine dürfen nur unterwiesene und beauftragte Beschäftigte bedienen."],
      ["Schutzeinrichtungen dürfen nicht entfernt, überbrückt oder unwirksam gemacht werden."],
      ["Eng anliegende Kleidung tragen, keinen Schmuck; lange Haare zusammenbinden."],
      ["Restehalter benutzen; nach dem Schneiden die Schnittstärke auf null stellen.", GASTRO],
      ["Nicht in den laufenden Kessel greifen; Schutzgitter geschlossen halten.", BAECKER],
      ["Spaltkeil und Schutzhaube benutzen; bei schmalen Werkstücken Schiebestock; Absaugung einschalten; Gehörschutz tragen.", HOLZ],
      ["Fahrzeuge nur an den Aufnahmepunkten des Herstellers anheben; beim Heben und Senken darf sich niemand im Gefahrbereich aufhalten.", KFZ],
      ["Reifen nur mit Druckbegrenzung befüllen, große Reifen im Füllkäfig; nicht zwischen Montierkopf und Felge greifen.", KFZ],
    ]),
  },
  {
    id: "stoerung",
    label: "Verhalten bei Störungen",
    hilfe: "Was bei einer Störung zu tun ist und wer sie behebt",
    ...mitGruppen([
      ["Bei Störungen die Maschine sofort ausschalten (Not-Halt) und gegen Wiedereinschalten sichern."],
      ["Störung der verantwortlichen Person melden; nur beauftragte Personen beheben Störungen."],
      ["Beschädigte Maschine kennzeichnen und nicht weiter benutzen."],
    ]),
  },
  {
    id: "unfall",
    label: "Verhalten bei Unfällen – Erste Hilfe",
    hilfe: "Maschine stillsetzen, Erste Hilfe, Notruf, Meldung",
    ...mitGruppen([
      ["Maschine ausschalten (Not-Halt), Verletzte aus dem Gefahrbereich retten."],
      ["Erste Hilfe leisten, Ersthelferin oder Ersthelfer holen, Notruf 112."],
      ["Unfall der verantwortlichen Person melden und im Verbandbuch eintragen."],
    ]),
  },
  {
    id: "instandhaltung",
    label: "Instandhaltung, Entsorgung",
    hilfe: "Reinigen, Rüsten, Prüfen, Entsorgen",
    ...mitGruppen([
      ["Reinigen, Rüsten und Instandhalten nur bei stillstehender und gegen Wiedereinschalten gesicherter Maschine (Netzstecker ziehen bzw. Hauptschalter sichern)."],
      ["Prüfung durch eine befähigte Person nach § 14 BetrSichV, Frist laut Gefährdungsbeurteilung."],
      ["Instandsetzung nur durch beauftragte Fachleute."],
      ["Betriebsstoffe und Abfälle nur über die festgelegten Entsorgungswege entsorgen."],
    ]),
  },
];
const BESCHRAENKUNG_MASCHINE: BaTeil = { id: "beschraenkung", label: "Beschäftigungsbeschränkungen", hilfe: "z. B. für Jugendliche", vorschlaege: ["Jugendliche dürfen die Maschine nur bedienen, soweit dies zur Erreichung des Ausbildungsziels erforderlich ist, und unter Aufsicht einer fachkundigen Person (§ 22 JArbSchG)."], wennGefuellt: true, pflicht: false };

const NOTRUF_FREIGABE = {
  titel: "Notruf und Freigabe",
  felder: [
    { id: "notruf", art: "text" as const, label: "Notruf und Ersthelfer/in", hilfe: "z. B. Notruf 112 · Ersthelfer/in: Name, Telefon", vorschlaege: ["Notruf 112"] },
    { id: "erstellt_von", art: "text" as const, label: "Freigegeben von", vorbelegung: "verantwortlich" as const, pflicht: true },
    { id: "datum", art: "datum" as const, label: "Stand", vorbelegung: "heute" as const, pflicht: true },
  ],
};

export const betriebsanweisungMaschine: Vorlage = {
  id: "betriebsanweisung_maschine",
  gestalt: "aushang",
  titel: "Betriebsanweisung Maschinen",
  beschreibung: "Aushang für eine Maschine oder ein Arbeitsmittel nach § 12 BetrSichV: Gefahren, Schutzmaßnahmen, Verhalten bei Störungen und Unfällen, Instandhaltung – mit Vorschlägen für Aufschnitt-, Knetmaschine, Kreissäge, Hebebühne und Reifenmontiermaschine.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.betriebsanweisung_arbeitsmittel"],
  grundlage: "§ 12 Abs. 2 BetrSichV",
  namensFeld: "maschine",
  abschnitte: [
    { titel: "Maschine",
      felder: [
        { id: "maschine", art: "text", label: "Maschine bzw. Arbeitsmittel", hilfe: "Bezeichnung, wie sie im Betrieb heißt – mit Hersteller und Typ, wenn es mehrere gibt", pflicht: true, ...MASCHINEN },
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich, Arbeitsplatz, Tätigkeit", pflicht: true, vorschlaege: BEREICHE_VORSCHLAG },
        { id: "nummer", selten: true, art: "text", label: "Nummer der Betriebsanweisung", hilfe: "z. B. BA-M-01" },
      ],
    },
    {
      titel: "Inhalt",
      hilfe: "Grundlage sind deine Gefährdungsbeurteilung und die Betriebsanleitung des Herstellers; die Vorschläge sind allgemeine Regeln.",
      felder: [...baFelder(MASCHINE_TEILE), ...baFelder([BESCHRAENKUNG_MASCHINE]).map((f) => ({ ...f, selten: true }))],
    },
    NOTRUF_FREIGABE,
  ],
  html(d: Daten, b) {
    // Blau der Gebotszeichen (DGUV-Muster für Maschinen), weiße Schrift mit mehr als 4,5 : 1
    return baAushang({
      d,
      b,
      band: "#1d5aa6",
      untertitel: "für Arbeitsmittel gemäß § 12 BetrSichV",
      kopf: ["Anwendungsbereich", [["Arbeitsbereich, Arbeitsplatz, Tätigkeit", text(d, "arbeitsbereich")], ["Maschine bzw. Arbeitsmittel", text(d, "maschine")]]],
      teile: [...MASCHINE_TEILE, BESCHRAENKUNG_MASCHINE],
    });
  },
};

const PRAXIS = ["praxis"];
const BEAUTY = ["kosmetik", "praxis"];
/** Gliederung nach § 14 Abs. 1 BioStoffV (Gefährdungen, Schutzmaßnahmen, Verhalten bei Verletzungen und Unfällen, Inaktivierung und Entsorgung). */
const BIO_TEILE: BaTeil[] = [
  {
    id: "gefahren",
    label: "Gefahren für die Beschäftigten",
    hilfe: "Art der Tätigkeit, die Biostoffe mit Risikogruppe, Übertragungswege und gesundheitliche Wirkungen",
    ...mitGruppen([
      ["Infektion durch Blut und Körperflüssigkeiten, z. B. Hepatitis B und C, HIV – Übertragung über Stich- und Schnittverletzungen, Schleimhäute und verletzte Haut.", BEAUTY],
      ["Infektion durch Tröpfchen und Aerosole bei der Behandlung, z. B. Atemwegsinfektionen.", PRAXIS],
      ["Haut- und Nagelpilz sowie bakterielle Hautinfektionen beim Kontakt mit erkrankter Haut und Nägeln.", ["kosmetik"]],
    ]),
  },
  {
    id: "schutz",
    label: "Schutzmaßnahmen und Verhaltensregeln",
    hilfe: "Hygienevorgaben, Maßnahmen gegen eine Exposition, Tragen und Ablegen der Schutzausrüstung",
    linien: 5,
    ...mitGruppen([
      ["Hände vor und nach jeder Behandlung desinfizieren (Hygieneplan); kein Schmuck an Händen und Unterarmen."],
      ["Bei möglichem Kontakt mit Blut oder Körperflüssigkeiten flüssigkeitsdichte Schutzhandschuhe tragen und nach jeder Behandlung wechseln."],
      ["Spitze und scharfe Instrumente mit Sicherheitsmechanismus verwenden; gebrauchte Kanülen nicht in die Schutzkappe zurückstecken.", BEAUTY],
      ["Verschmutzte Schutzkleidung sofort wechseln; Schutzkleidung nicht mit nach Hause nehmen."],
      ["Im Arbeitsbereich nicht essen, trinken oder rauchen."],
    ]),
  },
  {
    id: "unfall",
    label: "Verhalten bei Verletzungen, Unfällen und Betriebsstörungen – Erste Hilfe",
    hilfe: "Sofortmaßnahmen, Meldung im Betrieb, Erste Hilfe – Zeitfenster der HIV-Postexpositionsprophylaxe nach S2k-Leitlinie AWMF 055-004",
    ...mitGruppen([
      // B-276, Rechtsanwalt (Fachfragen Runde 3, 24.10.2026, Abgleich mit der S2k-Leitlinie AWMF 055-004): Obergrenze nach
      // Stich- oder Schnittverletzungen ergänzt, damit nach Ablauf von 2 Stunden niemand auf den Arztbesuch verzichtet – sein Wortlaut
      ["Nach einer Stich- oder Schnittverletzung: Wunde desinfizieren und sofort Durchgangsarzt bzw. Betriebsarzt aufsuchen – eine HIV-Postexpositionsprophylaxe sollte möglichst innerhalb von 2 Stunden beginnen, nach einer Stich- oder Schnittverletzung spätestens bis 24 Stunden; auch später noch ärztlich abklären lassen.", BEAUTY],
      ["Bei Spritzern in Auge oder Mund sofort mit Wasser bzw. Augenspüllösung spülen und ärztlich vorstellen."],
      ["Jede Verletzung der verantwortlichen Person melden und im Verbandbuch eintragen."],
      ["Verschüttetes infektiöses Material mit Schutzhandschuhen aufnehmen und die Fläche desinfizieren."],
    ]),
  },
  {
    id: "entsorgung",
    label: "Sachgerechte Inaktivierung und Entsorgung",
    hilfe: "Abfälle, gebrauchte Instrumente, kontaminierte Wäsche und Flächen",
    ...mitGruppen([
      ["Spitze und scharfe Gegenstände in stich- und bruchfeste Abwurfbehälter; Behälter nicht umfüllen.", BEAUTY],
      ["Kontaminierte Abfälle in reißfesten, dichten Säcken sammeln und nach Abfallplan entsorgen."],
      ["Wiederverwendbare Instrumente nach Hygieneplan reinigen, desinfizieren und gegebenenfalls sterilisieren."],
    ]),
  },
];
/**
 * Durchsicht Sifa 23.10.2026: Vorsorge und Beschäftigungsbeschränkungen stehen immer auf dem Aushang (leer mit Linien
 * zum Ausfüllen). B-283: Impfungen nur, soweit tätigkeitsbedingt erforderlich (§ 6 Abs. 2 ArbMedVV); B-284 (pauschales
 * Verbot „mit diesem Stoff“) gestrichen – B-285 deckt den Mutterschutz bei Biostoffen ab.
 */
const BIO_VORSORGE: BaTeil = { id: "vorsorge", label: "Arbeitsmedizinische Vorsorge und Impfungen", hilfe: "z. B. Vorsorge nach ArbMedVV Anhang Teil 2, Impfangebot", vorschlaege: ["Arbeitsmedizinische Vorsorge nach ArbMedVV Anhang Teil 2 beim Betriebsarzt; Impfungen (z. B. Hepatitis B) werden angeboten, soweit tätigkeitsbedingt erforderlich."], linien: 2, pflicht: false };
const BIO_BESCHRAENKUNG: BaTeil = { id: "beschraenkung", label: "Beschäftigungsbeschränkungen", hilfe: "z. B. Mutterschutz", vorschlaege: ["Schwangere: Immunstatus klären; bei unverantwortbarer Gefährdung keine Tätigkeit mit diesen Biostoffen (§ 11 Abs. 2 MuSchG)."], linien: 2, pflicht: false };
const SCHUTZSTUFE: Record<string, string> = { "1": "Schutzstufe 1", "2": "Schutzstufe 2", "3": "Schutzstufe 3", "4": "Schutzstufe 4" };
/** Durchsicht Sifa 23.10.2026: Tätigkeiten mit Kontakt zu Blut und Körperflüssigkeiten sind nach TRBA 250 mindestens Schutzstufe 2. */
export const BIO_SCHUTZSTUFE_BLUT = "Tätigkeiten mit Kontakt zu Blut und Körperflüssigkeiten sind nach TRBA 250 mindestens Schutzstufe 2 – bitte die Schutzstufe prüfen.";

export const betriebsanweisungBiostoffe: Vorlage = {
  id: "betriebsanweisung_biostoffe",
  gestalt: "aushang",
  titel: "Betriebsanweisung Biostoffe",
  beschreibung: "Aushang für Tätigkeiten mit Biostoffen nach § 14 BioStoffV (z. B. Praxis, Kosmetik, Fußpflege): Gefahren, Schutzmaßnahmen, Verhalten bei Verletzungen und Unfällen, Inaktivierung und Entsorgung.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.biostoffe"],
  grundlage: "§ 14 Abs. 1 BioStoffV",
  namensFeld: "taetigkeit",
  abschnitte: [
    { titel: "Tätigkeit und Biostoffe",
      felder: [
        { id: "taetigkeit", art: "text", label: "Arbeitsbereich und Tätigkeit", hilfe: "z. B. Blutentnahme und Injektionen, Fußpflege, Kosmetikbehandlung", pflicht: true, vorschlaege: ["Untersuchung und Behandlung in der Praxis", "Blutentnahme und Injektionen", "Fußpflege", "Kosmetikbehandlung mit möglichem Blutkontakt"], vorschlagGruppen: { "Untersuchung und Behandlung in der Praxis": PRAXIS, "Blutentnahme und Injektionen": PRAXIS, Fußpflege: ["kosmetik"], "Kosmetikbehandlung mit möglichem Blutkontakt": ["kosmetik"] } },
        { id: "biostoffe", art: "text", label: "Biostoffe", hilfe: "Welche Biostoffe vorkommen können, mit Risikogruppe – aus der Gefährdungsbeurteilung (TRBA 250)", pflicht: true, vorschlaege: ["Krankheitserreger in Blut und Körperflüssigkeiten (z. B. Hepatitis-B-, Hepatitis-C-Virus, HIV)", "Erreger von Haut- und Nagelpilz"] },
        // Durchsicht Sifa 23.10.2026: ohne Vorbelegung, der Nutzer muss wählen; Hilfetext mit Verweis auf TRBA 250
        { id: "schutzstufe", art: "wahl", label: "Schutzstufe der Tätigkeit", optionen: optionen(SCHUTZSTUFE), pflicht: true, hilfe: "Aus der Gefährdungsbeurteilung nach TRBA 250 – Tätigkeiten mit Kontakt zu Blut und Körperflüssigkeiten sind mindestens Schutzstufe 2" },
        { id: "nummer", selten: true, art: "text", label: "Nummer der Betriebsanweisung", hilfe: "z. B. BA-B-01" },
      ],
    },
    {
      titel: "Inhalt nach § 14 BioStoffV",
      hilfe: "Grundlage sind deine Gefährdungsbeurteilung und dein Hygieneplan; die Vorschläge sind allgemeine Regeln.",
      felder: baFelder([...BIO_TEILE, BIO_VORSORGE, BIO_BESCHRAENKUNG]),
    },
    NOTRUF_FREIGABE,
  ],
  hinweise(d: Daten) {
    const blut = /blut|körperflüssigkeit|injektion|kanüle/i.test(`${text(d, "taetigkeit")} ${text(d, "biostoffe")}`);
    return text(d, "schutzstufe") === "1" && blut ? [BIO_SCHUTZSTUFE_BLUT] : [];
  },
  html(d: Daten, b) {
    // Grün (Rettungszeichen), weiße Schrift mit mehr als 4,5 : 1
    return baAushang({
      d,
      b,
      band: "#1f6b3b",
      untertitel: "für Tätigkeiten mit Biostoffen gemäß § 14 BioStoffV",
      kopf: ["Arbeitsbereich, Tätigkeit · Biostoffe", [["Arbeitsbereich und Tätigkeit", text(d, "taetigkeit")], ["Biostoffe", [text(d, "biostoffe"), SCHUTZSTUFE[text(d, "schutzstufe")] ?? ""].filter(Boolean).join(" · ")]]],
      teile: [...BIO_TEILE, BIO_VORSORGE, BIO_BESCHRAENKUNG],
    });
  },
};
