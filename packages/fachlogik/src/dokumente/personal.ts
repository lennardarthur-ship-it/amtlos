/**
 * Personal: Nachweis der wesentlichen Arbeitsbedingungen, KI-Kompetenz-Schulung (E-121, E-123). Gesetzliche Angaben aus
 * der Recherche (bausteine.ts); Prüfung gegen Mindestlohn und Mindesturlaub. Fachlich zu prüfen (T-53).
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { MINDESTLOHN, NACHWG } from "./bausteine.js";
import { abschnitt, absatz, angaben, anschrift, auswahl, cent, datumDe, dokument, euro, ja, liste, parteien, punkte, text, unterschriften, zahl, zahlText, zeilen } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Daten, Vorlage } from "./typen.js";

/** Mindestlohn je Stunde (Cent), der am Stichtag gilt. */
export function mindestlohnAm(iso: string): number | null {
  const g = MINDESTLOHN.filter((m) => m.ab <= (iso || "9999")).sort((a, b) => b.ab.localeCompare(a.ab))[0];
  return g?.cent ?? null;
}
/** Stundenlohn in Cent aus Stundenlohn oder Monatsgehalt und Wochenstunden (Monat = 13/3 Wochen). */
export function stundenlohn(d: Daten): number | null {
  const betrag = cent(text(d, "entgelt_betrag"));
  if (betrag === null) return null;
  if (text(d, "entgelt_art") === "stunde") return betrag;
  const wochenstunden = zahl(text(d, "wochenstunden"));
  return wochenstunden ? Math.round((betrag * 3) / (13 * wochenstunden)) : null;
}
/** Gesetzlicher Mindesturlaub in Arbeitstagen: 24 Werktage auf Basis einer Sechs-Tage-Woche (§ 3 BUrlG). */
export const mindesturlaub = (tageProWoche: number) => Math.ceil((24 / 6) * tageProWoche);

const ORT: Record<string, string> = { betrieb: "in der Betriebsstätte des Arbeitgebers", verschieden: "an verschiedenen Orten", frei: "an einem frei gewählten Ort", anders: "an folgendem Ort:" };
const PROBEZEIT: Record<string, string> = { keine: "keine Probezeit", "1": "1 Monat", "3": "3 Monate", "6": "6 Monate" };
const ENTGELT: Record<string, string> = { monat: "Monatsgehalt (brutto)", stunde: "Stundenlohn (brutto)" };
const FAELLIG = ["am letzten Bankarbeitstag des laufenden Monats", "spätestens am 15. des Folgemonats"];
const UEBERSTUNDEN: Record<string, string> = { nein: "Die Anordnung von Überstunden ist nicht vereinbart.", ja: "Bei betrieblichem Bedarf können Überstunden angeordnet werden:" };
const KOLLEKTIV: Record<string, string> = { keine: "Auf das Arbeitsverhältnis finden keine Tarifverträge, Betriebs- oder Dienstvereinbarungen Anwendung.", ja: "Auf das Arbeitsverhältnis finden folgende Regelungen Anwendung:" };

/** Text zum Kündigungsverfahren aus den gesetzlichen Regelungen (Schriftform, Fristen, Klagefrist). */
function kuendigungText(d: Daten): string {
  if (text(d, "kuendigung_art") === "eigen") return text(d, "kuendigung_eigen");
  const probe = text(d, "probezeit") && text(d, "probezeit") !== "keine" ? " Während der vereinbarten Probezeit kann das Arbeitsverhältnis mit einer Frist von zwei Wochen gekündigt werden (§ 622 Abs. 3 BGB)." : "";
  return `Die Kündigung bedarf der Schriftform (§ 623 BGB). Es gelten die gesetzlichen Kündigungsfristen nach § 622 BGB; die Grundkündigungsfrist beträgt ${NACHWG.kuendigungGrund.replace(/ \(§ 622 Abs\. 1 BGB\)/, "")}. Für die Kündigung durch den Arbeitgeber verlängert sie sich mit der Dauer des Arbeitsverhältnisses (§ 622 Abs. 2 BGB).${probe} Will die beschäftigte Person geltend machen, dass eine Kündigung rechtsunwirksam ist, muss sie innerhalb von drei Wochen nach Zugang der schriftlichen Kündigung Klage beim Arbeitsgericht erheben (§ 4 KSchG).`;
}

export const nachweisArbeitsbedingungen: Vorlage = {
  id: "nachweis_arbeitsbedingungen",
  gestalt: "vertrag",
  titel: "Nachweis der wesentlichen Arbeitsbedingungen",
  beschreibung: "Niederschrift aller Angaben nach § 2 Abs. 1 NachwG zum Unterschreiben und Aushändigen – mit Kündigungsregeln aus dem Gesetz und Prüfung gegen Mindestlohn und Mindesturlaub.",
  bereich: "personal",
  pflichten: ["personal.nachweisgesetz"],
  person: { art: "mitarbeiter", felder: { name: "name", anschrift: "anschrift", beginn: "beginn", taetigkeit: "taetigkeit" } },
  grundlage: "§ 2 Abs. 1 NachwG",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Beschäftigte Person",
      hilfe: "In Gastronomie, Friseur- und Kosmetikbetrieben und anderen Branchen nach § 2a SchwarzArbG muss die Niederschrift unterschrieben und ausgehändigt werden – das PDF hat dafür die Unterschriftsfelder.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Anschrift", pflicht: true },
      ],
    },
    {
      titel: "Beginn, Ort und Tätigkeit",
      felder: [
        { id: "beginn", art: "datum", label: "Beginn des Arbeitsverhältnisses", pflicht: true },
        { id: "befristet", art: "schalter", label: "Befristet" },
        { id: "befristung_ende", art: "datum", label: "Enddatum", wenn: { feld: "befristet" }, pflicht: true },
        { id: "arbeitsort", art: "wahl", label: "Arbeitsort", optionen: optionen(ORT), vorbelegung: "betrieb" },
        { id: "arbeitsort_text", art: "text", label: "Ort", wenn: { feld: "arbeitsort", ist: "anders" }, pflicht: true },
        { id: "taetigkeit", art: "text", label: "Tätigkeit", hilfe: "kurze Beschreibung", pflicht: true, vorschlaege: ["Friseur/in", "Kosmetiker/in", "Servicekraft", "Küchenhilfe", "Koch/Köchin", "Verkäufer/in", "Bürokraft", "Geselle/Gesellin im Handwerk", "Aushilfe"] },
        { id: "probezeit", art: "wahl", label: "Probezeit", optionen: optionen(PROBEZEIT), vorbelegung: "6" },
      ],
    },
    {
      titel: "Arbeitsentgelt",
      felder: [
        { id: "entgelt_art", art: "wahl", label: "Art", optionen: optionen(ENTGELT), vorbelegung: "monat" },
        { id: "entgelt_betrag", art: "betrag", label: "Betrag brutto (€)", pflicht: true },
        { id: "zuschlaege", art: "mehrzeilig", label: "Weitere Bestandteile", hilfe: "Vergütung von Überstunden, Zuschläge, Zulagen, Prämien, Sonderzahlungen – jeweils getrennt", vorschlaege: ["Keine weiteren Bestandteile.", "Überstunden werden mit dem vereinbarten Stundenlohn vergütet.", "Überstunden werden durch Freizeit ausgeglichen."] },
        { id: "faelligkeit", art: "text", label: "Fälligkeit", pflicht: true, vorschlaege: FAELLIG },
        { id: "auszahlung", art: "text", label: "Art der Auszahlung", pflicht: true, vorschlaege: ["Überweisung auf das von der beschäftigten Person benannte Konto"] },
      ],
    },
    {
      titel: "Arbeitszeit",
      felder: [
        { id: "wochenstunden", art: "zahl", label: "Wöchentliche Arbeitszeit (Stunden)", pflicht: true },
        { id: "tage_pro_woche", art: "zahl", label: "Arbeitstage pro Woche", vorbelegung: "5", pflicht: true },
        { id: "verteilung", art: "text", label: "Verteilung", vorschlaege: ["Montag bis Freitag", "Dienstag bis Samstag", "nach Dienstplan"] },
        { id: "pausen", art: "text", label: "Ruhepausen", pflicht: true, vorschlaege: ["nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden"] },
        { id: "ruhezeit", art: "text", label: "Ruhezeit", pflicht: true, vorschlaege: ["nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit"] },
        { id: "schicht", art: "schalter", label: "Schichtarbeit" },
        { id: "schicht_text", art: "mehrzeilig", label: "Schichtsystem, Rhythmus, Voraussetzungen für Änderungen", wenn: { feld: "schicht" }, pflicht: true },
        { id: "abruf", art: "schalter", label: "Arbeit auf Abruf (§ 12 TzBfG)" },
        { id: "abruf_text", art: "mehrzeilig", label: "Mindeststunden, Zeitrahmen, Ankündigungsfrist", wenn: { feld: "abruf" }, pflicht: true },
        { id: "ueberstunden", art: "wahl", label: "Überstunden", optionen: [{ wert: "nein", text: "nicht vereinbart" }, { wert: "ja", text: "können angeordnet werden" }], vorbelegung: "nein" },
        { id: "ueberstunden_text", art: "text", label: "Voraussetzungen", wenn: { feld: "ueberstunden", ist: "ja" }, pflicht: true },
      ],
    },
    {
      titel: "Urlaub, Fortbildung, Altersversorgung",
      felder: [
        { id: "urlaub", art: "zahl", label: "Jahresurlaub (Arbeitstage)", pflicht: true, hilfe: "gesetzlich mindestens 20 Tage bei einer Fünf-Tage-Woche (§ 3 BUrlG)" },
        { id: "fortbildung", art: "text", label: "Fortbildung", vorschlaege: ["Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht."] },
        { id: "bav", art: "schalter", label: "Betriebliche Altersversorgung über einen Versorgungsträger" },
        { id: "bav_text", art: "text", label: "Name und Anschrift des Versorgungsträgers", wenn: { feld: "bav" }, pflicht: true },
      ],
    },
    {
      titel: "Kündigung und Vereinbarungen",
      felder: [
        { id: "kuendigung_art", art: "wahl", label: "Kündigung", optionen: [{ wert: "gesetz", text: "gesetzliche Regelungen" }, { wert: "eigen", text: "abweichend vereinbart" }], vorbelegung: "gesetz" },
        { id: "kuendigung_eigen", art: "mehrzeilig", label: "Vereinbarte Regelung (Schriftform, Fristen, Klagefrist)", wenn: { feld: "kuendigung_art", ist: "eigen" }, pflicht: true },
        { id: "kollektiv", art: "wahl", label: "Tarifverträge, Betriebsvereinbarungen", optionen: [{ wert: "keine", text: "keine" }, { wert: "ja", text: "finden Anwendung" }], vorbelegung: "keine" },
        { id: "kollektiv_text", art: "text", label: "Welche", wenn: { feld: "kollektiv", ist: "ja" }, pflicht: true },
        { id: "ausgestellt_am", art: "datum", label: "Ausgestellt am", vorbelegung: "heute" },
      ],
    },
  ],
  pruefen(d) {
    const f: string[] = [];
    const sl = stundenlohn(d);
    const ml = mindestlohnAm(text(d, "beginn") || new Date().toISOString().slice(0, 10));
    if (sl !== null && ml !== null && sl < ml) f.push(`Entgelt liegt unter dem gesetzlichen Mindestlohn von ${euro(ml)} je Stunde (rechnerisch ${euro(sl)})`);
    const urlaub = zahl(text(d, "urlaub"));
    const tage = zahl(text(d, "tage_pro_woche"));
    if (urlaub !== null && tage && urlaub < mindesturlaub(tage)) f.push(`Urlaub liegt unter dem gesetzlichen Mindesturlaub von ${mindesturlaub(tage)} Arbeitstagen`);
    return f;
  },
  html(d, b) {
    const ort = text(d, "arbeitsort") === "anders" ? `${ORT.anders} ${text(d, "arbeitsort_text")}` : (ORT[text(d, "arbeitsort")] ?? "");
    const entgelt = text(d, "entgelt_betrag") ? `${ENTGELT[text(d, "entgelt_art")] ?? ""}: ${euro(cent(text(d, "entgelt_betrag")) ?? 0)}` : "";
    const zeit = [text(d, "wochenstunden") ? `${zahlText(zahl(text(d, "wochenstunden")) ?? 0)} Stunden pro Woche` : "", text(d, "wochenstunden") && text(d, "tage_pro_woche") ? `an ${text(d, "tage_pro_woche")} Tagen` : "", text(d, "verteilung")].filter(Boolean).join(", ");
    const zeilenNw: [string, string | null][] = [
      ["1. Vertragsparteien", `Arbeitgeber: ${[b.name, anschrift(b)].filter((x) => x.trim()).join(", ")}\nBeschäftigte Person: ${[text(d, "name"), text(d, "anschrift").replace(/\n/g, ", ")].filter(Boolean).join(", ")}`],
      ["2. Beginn", datumDe(text(d, "beginn"))],
      ["3. Befristung", ja(d, "befristet") ? `befristet bis ${datumDe(text(d, "befristung_ende"))}` : "unbefristet"],
      ["4. Arbeitsort", ort],
      ["5. Tätigkeit", text(d, "taetigkeit")],
      ["6. Probezeit", PROBEZEIT[text(d, "probezeit")] ?? ""],
      ["7. Arbeitsentgelt", [entgelt, text(d, "zuschlaege"), text(d, "faelligkeit") ? `Fällig ${text(d, "faelligkeit")}.` : "", text(d, "auszahlung") ? `Auszahlung: ${text(d, "auszahlung")}.` : ""].filter(Boolean).join("\n")],
      ["8. Arbeitszeit, Pausen, Ruhezeiten", [zeit, text(d, "pausen") ? `Ruhepausen: ${text(d, "pausen").replace(/^\s*Ruhepausen:?\s*/i, "")}` : "", text(d, "ruhezeit") ? `Ruhezeit: ${text(d, "ruhezeit").replace(/^\s*Ruhezeit:?\s*/i, "")}` : "", ja(d, "schicht") ? `Schichtarbeit: ${text(d, "schicht_text")}` : ""].filter(Boolean).join("\n")],
      ["9. Arbeit auf Abruf", ja(d, "abruf") ? text(d, "abruf_text") : "nicht vereinbart"],
      ["10. Überstunden", text(d, "ueberstunden") === "ja" ? `${UEBERSTUNDEN.ja} ${text(d, "ueberstunden_text")}` : UEBERSTUNDEN.nein!],
      ["11. Erholungsurlaub", text(d, "urlaub") ? `${text(d, "urlaub")} Arbeitstage pro Kalenderjahr` : ""],
      ["12. Fortbildung", text(d, "fortbildung") || "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht."],
      ["13. Betriebliche Altersversorgung", ja(d, "bav") ? (text(d, "bav_text") ? `Über den Versorgungsträger: ${text(d, "bav_text")}` : "") : "nicht zugesagt"],
      ["14. Kündigung", kuendigungText(d)],
      ["15. Tarifverträge, Vereinbarungen", text(d, "kollektiv") === "ja" ? `${KOLLEKTIV.ja} ${text(d, "kollektiv_text")}` : KOLLEKTIV.keine!],
    ];
    // Blatt zum Ausfüllen: Punkte mit mehreren Angaben als beschriftete Linien – dieselben Teilangaben, die das
    // ausgefüllte Dokument nennt (statt zweier unbeschrifteter Linien)
    const leerAngaben: Record<string, string> = {
      "7": angaben([[`${ENTGELT.monat!.replace(" (brutto)", "")} bzw. ${ENTGELT.stunde!}`, ""], ["Weitere Bestandteile", "", 2], ["Fälligkeit", ""], ["Auszahlung", ""]]),
      "8": angaben([["Stunden pro Woche", ""], ["Arbeitstage pro Woche", ""], ["Verteilung", ""], ["Ruhepausen", ""], ["Ruhezeit", ""], ["Schichtarbeit (falls vereinbart)", ""]]),
      "11": angaben([["Arbeitstage pro Kalenderjahr", ""]]),
    };
    // Vertrag: Parteien in zwei Spalten, dann die 15 Punkte des § 2 Abs. 1 NachwG mit Randnummern
    const punkteNw = zeilenNw.slice(1).map(([t, w]) => abschnitt(t.replace(/^\d+\.\s*/, ""), !w && leerAngaben[t.split(".")[0]!] ? leerAngaben[t.split(".")[0]!]! : absatz(w ?? "")));
    return dokument({
      titel: "Nachweis der wesentlichen Arbeitsbedingungen",
      betrieb: b,
      nummerierung: "zahl",
      unter: "Niederschrift nach § 2 Abs. 1 Nachweisgesetz",
      meta: `Beginn: ${datumDe(text(d, "beginn"))}\nAusgestellt: ${datumDe(text(d, "ausgestellt_am"))}`,
      inhalt:
        `<p class="klein">Diese Niederschrift hält die wesentlichen Vertragsbedingungen nach § 2 Abs. 1 Nachweisgesetz fest. Sie ersetzt keinen Arbeitsvertrag; bestehende vertragliche Vereinbarungen gelten weiter.</p>` +
        abschnitt("Vertragsparteien", parteien({ rolle: "Arbeitgeber", name: b.name, anschrift: anschrift(b) }, { rolle: "beschäftigte Person", name: text(d, "name"), anschrift: text(d, "anschrift") })) +
        punkteNw.join("") +
        unterschriften(["Arbeitgeber/in", "Beschäftigte Person (Erhalt bestätigt)"], { ortDatum: true }),
    });
  },
};

const KI_THEMEN = [
  "Funktionsweise und Grenzen der eingesetzten KI-Werkzeuge",
  "Chancen und Risiken beim Einsatz von KI im Betrieb",
  "Keine personenbezogenen oder vertraulichen Daten in KI-Werkzeuge eingeben, soweit nicht ausdrücklich freigegeben",
  "Ergebnisse von KI-Werkzeugen vor der Verwendung prüfen",
  "Verantwortlichkeiten und Ansprechperson im Betrieb",
  "Umgang mit KI-erzeugten Texten und Bildern gegenüber Kundinnen und Kunden",
];

export const kiKompetenz: Vorlage = {
  id: "ki_kompetenz",
  titel: "Nachweis KI-Kompetenz-Schulung",
  beschreibung: "Wer wann zu welchen KI-Werkzeugen geschult wurde – Inhalte zum Ankreuzen, mit Unterschriften der Teilnehmenden.",
  bereich: "personal",
  pflichten: ["ki.kompetenz"],
  grundlage: "Art. 4 KI-VO (VO (EU) 2024/1689)",
  namensFeld: "thema",
  abschnitte: [
    { titel: "Schulung",
      felder: [
        { id: "thema", art: "text", label: "Bezeichnung", pflicht: true, vorschlaege: ["Grundschulung KI-Kompetenz", "Sicherer Umgang mit KI-Assistenten im Betrieb"] },
        { id: "ki_systeme", art: "mehrzeilig", label: "Eingesetzte KI-Werkzeuge", pflicht: true, vorschlaege: ["Textassistent (Chatbot)", "Übersetzungsprogramm", "Bildbearbeitung mit KI", "KI-Funktionen in der Buchhaltungs- oder Kassensoftware", "Online-Terminbuchung mit KI-Assistent"] },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", vorschlaege: ["60 Minuten", "2 Stunden", "halber Tag"] },
        { id: "durchgefuehrt_von", art: "text", label: "Durchgeführt von", hilfe: "Person oder Anbieter", vorbelegung: "verantwortlich", pflicht: true },
      ],
    },
    {
      titel: "Inhalte",
      felder: [
        { id: "themen", art: "bausteine", label: "Inhalte der Schulung", optionen: KI_THEMEN.map((t) => ({ wert: t, text: t })), vorbelegung: KI_THEMEN.slice(0, 4), pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Ergänzungen" },
      ],
    },
    {
      titel: "Teilnehmende",
      felder: [{ id: "teilnehmer", art: "liste", ausMitarbeitern: true, label: "Teilnehmende", eintrag: "Person", titelFeld: "name", felder: [{ id: "name", art: "text", label: "Name", pflicht: true }] }],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Nachweis KI-Kompetenz-Schulung",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum"))}\nDurchgeführt von: ${text(d, "durchgefuehrt_von")}\nDauer: ${text(d, "dauer")}`,
      inhalt:
        // Datum, Durchgeführt von und Dauer stehen in der Kennungsleiste; dort entfallen leere Angaben – dann hier als Linie
        abschnitt("Angaben", angaben([["Bezeichnung", text(d, "thema")], ["KI-Werkzeuge", text(d, "ki_systeme").split("\n").map((z) => z.trim().replace(/[.;,]+$/, "")).filter(Boolean).join(", ")], ["Datum", text(d, "datum") ? null : ""], ["Dauer", text(d, "dauer") ? null : ""], ["Durchgeführt von", text(d, "durchgefuehrt_von") ? null : ""]])) +
        abschnitt("Inhalte", (auswahl(d, "themen").length ? punkte(auswahl(d, "themen")) : absatz("")) + (text(d, "inhalt") ? zeilen(text(d, "inhalt")) : "")) +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich die Teilnahme an der Schulung.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        unterschriften(["Ort, Datum", "Unterschrift der schulenden Person"]),
    });
  },
};
