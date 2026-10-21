/**
 * Personal: Nachweis der wesentlichen Arbeitsbedingungen, KI-Kompetenz-Schulung (E-121, E-123). Gesetzliche Angaben aus
 * der Recherche (bausteine.ts); Prüfung gegen Mindestlohn und Mindesturlaub. Fachlich zu prüfen (T-53).
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { mitVertretung } from "./betrieb.js";
import { MINDESTLOHN, MINIJOB, NACHWG } from "./bausteine.js";
import { abschnitt, absatz, angaben, anschrift, anschriftMehrzeilig, auswahl, cent, datumDe, dokument, euro, fassungNachsatz, ja, liste, neufassung, parteien, punkte, stabileOption, tabelle, text, unterschriften, zahl, zahlText, zelle, zeilen } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Daten, Vorlage } from "./typen.js";

/**
 * Werte vor 2026 (R10) für Unterlagen mit früherem Beginn oder Ausstellungsdatum – die Recherche-Tabellen beginnen 2026:
 * Mindestlohn 12,41 € (2024) und 12,82 € (2025, Vierte Mindestlohnanpassungsverordnung), Minijob-Grenze 538 € bzw.
 * 556 € (§ 8 Abs. 1a SGB IV: Mindestlohn × 130 / 3, aufgerundet).
 */
const MINDESTLOHN_FRUEHER = [{ ab: "2024-01-01", cent: 1241 }, { ab: "2025-01-01", cent: 1282 }];
const MINIJOB_FRUEHER = [{ ab: "2024-01-01", cent: 53800 }, { ab: "2025-01-01", cent: 55600 }];
const amStichtag = (l: { ab: string; cent: number }[], iso: string) => l.filter((m) => m.ab <= (iso || "9999")).sort((a, b) => b.ab.localeCompare(a.ab))[0]?.cent ?? null;

/** Mindestlohn je Stunde (Cent), der am Stichtag gilt. */
export function mindestlohnAm(iso: string): number | null {
  return amStichtag([...MINDESTLOHN_FRUEHER, ...MINDESTLOHN], iso);
}
/** Minijob-Grenze im Monat (Cent), die am Stichtag gilt. */
export function minijobGrenzeAm(iso: string): number | null {
  return amStichtag([...MINIJOB_FRUEHER, ...MINIJOB], iso);
}
/** Stichtag für Grenzen im Nachweis: ausgestellt am, sonst Beginn (R10 – nicht das heutige Jahr). */
const stichtag = (d: Daten) => text(d, "ausgestellt_am") || text(d, "beginn") || new Date().toISOString().slice(0, 10);
/** Monatsentgelt in Cent (Stundenlohn × Wochenstunden × 13/3), sonst der Monatsbetrag. */
function monatsentgelt(d: Daten): number | null {
  const betrag = cent(text(d, "entgelt_betrag"));
  if (betrag === null) return null;
  if (text(d, "entgelt_art") !== "stunde") return betrag;
  const w = zahl(text(d, "wochenstunden"));
  return w ? Math.round((betrag * w * 13) / 3) : null;
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
  // R12 (Zoll #2, #9): nach dem Teilen festgeschrieben; eine Änderung (z. B. Lohnerhöhung) wird eine neue Fassung
  festschreiben: true,
  korrektur: true,
  person: { art: "mitarbeiter", felder: { name: "name", anschrift: "anschrift", beginn: "beginn", taetigkeit: "taetigkeit", wochenstunden: "wochenstunden", entgelt_art: "entgelt_art" } },
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
        // Minijob (R10): die Grenze steht mit dem Wert zum Ausstellungsdatum im Nachweis – nicht als Freitext mit Jahreszahl
        { id: "minijob", art: "schalter", label: "Minijob (geringfügig entlohnt)", hilfe: "Der Nachweis nennt die Minijob-Grenze, die am Ausstellungstag gilt" },
        { id: "zuschlaege", art: "mehrzeilig", label: "Weitere Bestandteile", hilfe: "Vergütung von Überstunden, Zuschläge, Zulagen, Prämien, Sonderzahlungen – jeweils getrennt", vorschlaege: ["Keine weiteren Bestandteile.", "Überstunden werden mit dem vereinbarten Stundenlohn vergütet.", "Überstunden werden durch Freizeit ausgeglichen."] },
        // R11 (Rechtsprüfung #18): Provision als eigener Bestandteil mit eigenem Datum – im Freitext wurde „ab …“ mehrdeutig
        { id: "provision", selten: true, art: "mehrzeilig", label: "Provision", hilfe: "z. B. 5 % vom eigenen Dienstleistungsumsatz im Monat" },
        { id: "provision_ab", selten: true, art: "datum", label: "Provision ab", wenn: { feld: "provision" } },
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
    const grenze = minijobGrenzeAm(stichtag(d));
    const monat = monatsentgelt(d);
    if (ja(d, "minijob") && grenze !== null && monat !== null && monat > grenze) f.push(`Monatsentgelt (rechnerisch ${euro(monat)}) liegt über der Minijob-Grenze von ${euro(grenze)}`);
    return f;
  },
  // beim Teilen (R10): Form und Empfangsnachweis – gerade per Messenger geteilte PDFs erfüllen sonst die Form nicht
  hinweise: () => [
    "Form: In den Branchen nach § 2a SchwarzArbG (z. B. Bau, Gaststätten und Beherbergung, Friseur- und Kosmetikbetriebe, Transport und Logistik, Gebäudereinigung) gilt die Schriftform – ausdrucken, beide unterschreiben, aushändigen. Sonst reicht die Textform (z. B. PDF per E-Mail) nur, wenn das Dokument speicher- und ausdruckbar ist und du einen Empfangsnachweis anforderst (§ 2 Abs. 1 NachwG).",
  ],
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
      ["7. Arbeitsentgelt", [entgelt, ja(d, "minijob") && minijobGrenzeAm(stichtag(d)) !== null ? `Geringfügig entlohnte Beschäftigung (Minijob): Das monatliche Arbeitsentgelt übersteigt die Minijob-Grenze von ${euro(minijobGrenzeAm(stichtag(d))!)} (Stand ${datumDe(stichtag(d))}) nicht.` : "", text(d, "zuschlaege"), text(d, "provision") ? `Provision${text(d, "provision_ab") ? ` ab ${datumDe(text(d, "provision_ab"))}` : ""}: ${text(d, "provision").replace(/\n+/g, " ")}` : "", text(d, "faelligkeit") ? `Fällig ${text(d, "faelligkeit")}.` : "", text(d, "auszahlung") ? `Auszahlung: ${text(d, "auszahlung")}.` : ""].filter(Boolean).join("\n")],
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
    // Kapitalgesellschaft mit Geschäftsführung in „Mein Betrieb“: „vertreten durch …“ bei Partei und Unterschrift
    const vertreten = mitVertretung(b) !== b.name.trim() ? `vertreten durch ${(b.vertretung ?? "").trim()}` : "";
    // kompakt: aufeinanderfolgende Punkte mit kurzer, einzeiliger Angabe (Beginn, Befristung, Arbeitsort …) stehen als
    // Angabenzeilen unter einer gemeinsamen Randnummer („2.–6.“); längere Texte bleiben eigene Abschnitte. Wortlaut und
    // Reihenfolge aller Punkte bleiben gleich, die Nummerierung der Abschnitte läuft weiter (counter-increment).
    const kurz = ([t, w]: [string, string | null]) => !leerAngaben[t.split(".")[0]!] && !(w ?? "").includes("\n") && (w ?? "").length <= 60;
    const punkteNw: string[] = [];
    const rest = zeilenNw.slice(1);
    for (let i = 0; i < rest.length; ) {
      let j = i;
      while (j < rest.length && kurz(rest[j]!)) j++;
      if (j - i >= 2) {
        const nr = (k: number) => rest[k]![0].split(".")[0]!;
        punkteNw.push(`<section class="abschnitt gruppe zusammen" style="counter-increment: abschnitt ${j - i}"><div class="gruppe-nr">${nr(i)}.–${nr(j - 1)}.</div>${angaben(rest.slice(i, j).map(([t, w]) => [t.replace(/^\d+\.\s*/, ""), w ?? ""]))}</section>`);
        i = j;
        continue;
      }
      const [t, w] = rest[i]!;
      punkteNw.push(abschnitt(t.replace(/^\d+\.\s*/, ""), !w && leerAngaben[t.split(".")[0]!] ? leerAngaben[t.split(".")[0]!]! : absatz(w ?? "")));
      i++;
    }
    return dokument({
      titel: "Nachweis der wesentlichen Arbeitsbedingungen",
      betrieb: b,
      nummerierung: "zahl",
      unter: "Niederschrift nach § 2 Abs. 1 Nachweisgesetz",
      meta: `Beginn: ${datumDe(text(d, "beginn"))}\nAusgestellt: ${datumDe(text(d, "ausgestellt_am"))}`,
      inhalt:
        `<p class="klein">Diese Niederschrift hält die wesentlichen Vertragsbedingungen nach § 2 Abs. 1 Nachweisgesetz fest. Sie ersetzt keinen Arbeitsvertrag; bestehende vertragliche Vereinbarungen gelten weiter.</p>` +
        abschnitt("Vertragsparteien", parteien({ rolle: "Arbeitgeber", name: b.name, anschrift: anschriftMehrzeilig(b), zusatz: vertreten || undefined }, { rolle: "beschäftigte Person", name: text(d, "name"), anschrift: text(d, "anschrift") })) +
        punkteNw.join("") +
        fassungNachsatz(d) +
        unterschriften([vertreten ? `Arbeitgeber/in, ${vertreten}` : "Arbeitgeber/in", "Beschäftigte Person (Erhalt bestätigt)"], { ortDatum: true }),
    });
  },
};

const KI_THEMEN = [
  "Funktionsweise und Grenzen der eingesetzten KI-Werkzeuge",
  "Chancen und Risiken beim Einsatz von KI im Betrieb",
  "Umgang mit personenbezogenen und vertraulichen Daten: nur ausdrücklich freigegebene Daten in KI-Werkzeuge eingeben",
  "Prüfung von KI-Ergebnissen vor der Verwendung",
  "Verantwortlichkeiten und Ansprechperson im Betrieb",
  "Umgang mit KI-erzeugten Texten und Bildern gegenüber Kundinnen und Kunden",
];
/** Neufassung → früherer Text: gespeichert wird weiter der frühere Text, damit bestehende Auswahlen gültig bleiben. */
const KI_THEMEN_FRUEHER: Record<string, string> = {
  "Umgang mit personenbezogenen und vertraulichen Daten: nur ausdrücklich freigegebene Daten in KI-Werkzeuge eingeben": "Keine personenbezogenen oder vertraulichen Daten in KI-Werkzeuge eingeben, soweit nicht ausdrücklich freigegeben",
  "Prüfung von KI-Ergebnissen vor der Verwendung": "Ergebnisse von KI-Werkzeugen vor der Verwendung prüfen",
};
const kiOption = (t: string) => stabileOption(t, KI_THEMEN_FRUEHER);

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
        { id: "themen", art: "bausteine", label: "Inhalte der Schulung", optionen: KI_THEMEN.map(kiOption), vorbelegung: KI_THEMEN.slice(0, 4).map((t) => kiOption(t).wert), pflicht: true },
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
        abschnitt("Inhalte", (auswahl(d, "themen").length ? punkte(auswahl(d, "themen").map((w) => neufassung(w, KI_THEMEN_FRUEHER))) : absatz("")) + (text(d, "inhalt") ? zeilen(text(d, "inhalt")) : "")) +
        abschnitt("Teilnahme", `<p class="vor-tabelle">Mit meiner Unterschrift bestätige ich die Teilnahme an der Schulung.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        unterschriften(["Ort, Datum", "Unterschrift der schulenden Person"]),
    });
  },
};

/**
 * R11 (Nutzertest Reinigung #4, Katalog personal.ausweis_hinweis): schriftlicher Hinweis auf die Pflicht, bei der Arbeit
 * einen Ausweis mitzuführen (§ 2a SchwarzArbG) – mit Unterschrift als Nachweis. Wortlaut nah am Gesetz, fachlich zu prüfen.
 */
export const ausweisHinweis: Vorlage = {
  id: "ausweis_hinweis",
  titel: "Hinweis auf die Ausweispflicht",
  beschreibung: "Schriftlicher Hinweis an eine beschäftigte Person, bei der Arbeit einen Ausweis mitzuführen (§ 2a SchwarzArbG) – mit Unterschrift als Nachweis.",
  bereich: "personal",
  pflichten: ["personal.ausweis_hinweis"],
  // R12 (Zoll #2, #6): festgeschrieben nach dem Teilen; Beginn aus „Mitarbeiter“ für die Prüfung „vor Beginn“
  festschreiben: true,
  korrektur: true,
  person: { art: "mitarbeiter", felder: { name: "name", beginn: "beginn" } },
  grundlage: "§ 2a SchwarzArbG",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Beschäftigte Person",
      hilfe: "Vor Beginn der Arbeit aushändigen und unterschreiben lassen. Den unterschriebenen Hinweis für die Dauer der Beschäftigung aufbewahren und bei einer Prüfung des Zolls vorlegen.",
      felder: [
        { id: "name", art: "text", label: "Name der beschäftigten Person", pflicht: true },
        { id: "datum", art: "datum", label: "Ausgehändigt am", vorbelegung: "heute", pflicht: true },
        { id: "beginn", art: "datum", label: "Beginn der Beschäftigung", hilfe: "Aus „Mitarbeiter“. Der Hinweis muss vor diesem Tag ausgehändigt sein." },
      ],
    },
  ],
  // R12 (Zoll #6): nach Beginn ausgehändigt – kein Fehlen einer Angabe, aber ein Verstoß, den das PDF dokumentiert
  hinweise(d) {
    const datum = text(d, "datum");
    const beginn = text(d, "beginn");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{4}-\d{2}-\d{2}$/.test(beginn) || datum <= beginn) return [];
    return [`Der Hinweis ist auf den ${datumDe(datum)} datiert, die Beschäftigung begann am ${datumDe(beginn)}. Nach § 2a Abs. 2 SchwarzArbG ist er vor Beginn der Arbeit auszuhändigen. Trag das tatsächliche Datum ein – händige den Hinweis künftig vor dem ersten Arbeitstag aus.`];
  },
  html(d, b) {
    return dokument({
      titel: "Hinweis auf die Ausweispflicht",
      betrieb: b,
      unter: text(d, "name") || undefined,
      meta: `Beschäftigte Person: ${text(d, "name")}\nBeginn der Beschäftigung: ${datumDe(text(d, "beginn"))}\nAusgehändigt am: ${datumDe(text(d, "datum"))}`,
      inhalt:
        (!text(d, "name") ? abschnitt("Angaben", angaben([["Beschäftigte Person", ""]])) : "") +
        abschnitt(
          "Hinweis nach § 2a Abs. 2 SchwarzArbG",
          absatz("Bei der Erbringung von Dienst- oder Werkleistungen sind Sie verpflichtet, Ihren Personalausweis, Pass, Passersatz oder Ausweisersatz mitzuführen und den Behörden der Zollverwaltung auf Verlangen vorzulegen (§ 2a Abs. 1 SchwarzArbG).") +
            absatz("Mit Ihrer Unterschrift bestätigen Sie, dass Sie diesen Hinweis erhalten haben."),
        ) +
        fassungNachsatz(d) +
        unterschriften(["Ort, Datum", "Unterschrift beschäftigte Person", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

/**
 * R11 (Nutzertest Reinigung #14): Schlüsselquittung – welche Schlüssel eines Kunden oder Objekts wer wann erhalten und
 * zurückgegeben hat. Ohne rechtliche Aussagen; eine Vertraulichkeitsverpflichtung ist fachlich offen (PRUEFLISTE).
 */
export const schluesselquittung: Vorlage = {
  id: "schluesselquittung",
  titel: "Schlüsselquittung",
  beschreibung: "Welche Schlüssel eines Kunden oder Objekts wer wann erhalten und zurückgegeben hat – mit Unterschriften.",
  bereich: "personal",
  pflichten: [],
  namensFeld: "objekt",
  abschnitte: [
    {
      titel: "Objekt",
      felder: [
        { id: "objekt", art: "text", label: "Kunde bzw. Objekt", pflicht: true, hilfe: "z. B. Praxis Dr. Muster, Hauptstraße 1" },
        { id: "empfaenger", art: "text", label: "Schlüssel erhalten von (Name)", hilfe: "beschäftigte Person, die die Schlüssel bekommt", pflicht: true },
        { id: "datum", art: "datum", label: "Übergeben am", vorbelegung: "heute", pflicht: true },
      ],
    },
    {
      titel: "Schlüssel",
      felder: [
        {
          id: "schluessel",
          art: "liste",
          label: "Schlüssel",
          eintrag: "Schlüssel",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung", pflicht: true, hilfe: "z. B. Haustür, Büro 2. OG, Transponder" },
            { id: "nummer", art: "text", label: "Schlüssel-Nr." },
            { id: "anzahl", art: "zahl", label: "Anzahl", vorbelegung: "1" },
            { id: "zurueck_am", art: "datum", label: "Zurückgegeben am" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const s = liste(d, "schluessel").filter((x) => text(x, "bezeichnung"));
    return dokument({
      titel: "Schlüsselquittung",
      betrieb: b,
      unter: text(d, "objekt") || undefined,
      meta: `Objekt: ${text(d, "objekt")}\nErhalten von: ${text(d, "empfaenger")}\nÜbergeben am: ${datumDe(text(d, "datum"))}`,
      inhalt:
        ((a) => (a ? abschnitt("Angaben", a) : ""))(angaben([["Kunde bzw. Objekt", text(d, "objekt") ? null : ""], ["Erhalten von", text(d, "empfaenger") ? null : ""], ["Übergeben am", text(d, "datum") ? null : ""]])) +
        abschnitt("Schlüssel", tabelle(["Bezeichnung", "Schlüssel-Nr.", "Anzahl", "Zurückgegeben am"], s.map((x) => [zelle(text(x, "bezeichnung")), zelle(text(x, "nummer")), zelle(text(x, "anzahl")), text(x, "zurueck_am") ? datumDe(text(x, "zurueck_am")) : ""]), { breiten: ["42%", "20%", "12%", "26%"], ...(s.length ? { leerzeilen: 2 } : { mindestens: 5 }), hoch: true })) +
        abschnitt("Bestätigung", absatz("Die oben genannten Schlüssel habe ich erhalten. Ich bewahre sie sorgfältig auf, gebe sie nicht an Dritte weiter und melde einen Verlust sofort.")) +
        unterschriften(["Ort, Datum", "Unterschrift Empfänger/in", "Unterschrift Arbeitgeber/in"]),
    });
  },
};
