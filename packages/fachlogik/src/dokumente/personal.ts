/**
 * Personal: Nachweis der wesentlichen Arbeitsbedingungen, KI-Kompetenz-Schulung (E-121, E-123). Gesetzliche Angaben aus
 * der Recherche (bausteine.ts); Prüfung gegen Mindestlohn und Mindesturlaub. Fachlich zu prüfen (T-53).
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { mitVertretung } from "./betrieb.js";
import { MINDESTLOHN, MINIJOB, NACHWG } from "./bausteine.js";
import { abschnitt, absatz, angaben, anschriftMehrzeilig, auswahl, cent, datumDe, dokument, esc, euro, fassungNachsatz, ja, liste, neufassung, parteien, punkte, stabileOption, tabelle, text, unterschriften, zahl, zahlText, zelle, zeilen } from "./html.js";
import { BRANCHEN_2A, BRANCHEN_2A_TEXT, branche2aAusProfil, optionen } from "./konstanten.js";
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
  const klage = "Will die beschäftigte Person geltend machen, dass eine Kündigung rechtsunwirksam ist, muss sie innerhalb von drei Wochen nach Zugang der schriftlichen Kündigung Klage beim Arbeitsgericht erheben (§ 4 KSchG).";
  // Vorprüfung 21.10.2026 (T-93): ein befristetes Arbeitsverhältnis ist nur ordentlich kündbar, wenn das vereinbart ist
  if (ja(d, "befristet") && d.befristet_kuendbar !== true)
    return `Das Arbeitsverhältnis endet mit Ablauf der Befristung. Eine ordentliche Kündigung ist nicht vereinbart (§ 15 Abs. 4 TzBfG); das Recht zur außerordentlichen Kündigung (§ 626 BGB) bleibt unberührt. Die Kündigung bedarf der Schriftform (§ 623 BGB). ${klage}`;
  const probe = text(d, "probezeit") && text(d, "probezeit") !== "keine" ? " Während der vereinbarten Probezeit kann das Arbeitsverhältnis mit einer Frist von zwei Wochen gekündigt werden (§ 622 Abs. 3 BGB)." : "";
  const befristet = ja(d, "befristet") ? " Die ordentliche Kündigung des befristeten Arbeitsverhältnisses ist vereinbart (§ 15 Abs. 4 TzBfG)." : "";
  return `Die Kündigung bedarf der Schriftform (§ 623 BGB).${befristet} Es gelten die gesetzlichen Kündigungsfristen nach § 622 BGB; die Grundkündigungsfrist beträgt ${NACHWG.kuendigungGrund.replace(/ \(§ 622 Abs\. 1 BGB\)/, "")}. Für die Kündigung durch den Arbeitgeber verlängert sie sich mit der Dauer des Arbeitsverhältnisses (§ 622 Abs. 2 BGB).${probe} ${klage}`;
}

/** Vorprüfung 21.10.2026: Form je Branche – § 2a-Branchen Schriftform, sonst Textform mit Empfangsnachweis (§ 2 Abs. 1 NachwG). */
const NW_BRANCHEN = [...BRANCHEN_2A, { wert: "keine", text: "Keine dieser Branchen" }];
export const NACHWG_FORM_SCHRIFT = (branche: string) => `In deiner Branche (${branche}, § 2a Abs. 1 SchwarzArbG): ausdrucken, unterschreiben, aushändigen. Ein PDF per E-Mail oder Messenger genügt hier nicht – es gilt weiter die Schriftform (§ 2 Abs. 1 NachwG).`;
export const NACHWG_FORM_TEXT = "PDF genügt (Textform, § 2 Abs. 1 NachwG): Das Dokument muss für die beschäftigte Person zugänglich, speicher- und ausdruckbar sein – lass dir den Empfang bestätigen (Empfangsnachweis), z. B. per Antwort-E-Mail. Verlangt die beschäftigte Person einen schriftlichen Nachweis, ausdrucken und unterschreiben.";
export const NACHWG_FORM_OFFEN = `Form: In den Branchen nach § 2a Abs. 1 SchwarzArbG (${BRANCHEN_2A_TEXT}) gilt die Schriftform – ausdrucken, beide unterschreiben, aushändigen. Sonst genügt seit 1.1.2025 die Textform (z. B. PDF per E-Mail), wenn das Dokument speicher- und ausdruckbar ist und du einen Empfangsnachweis anforderst (§ 2 Abs. 1 NachwG). Wähle die Branche im Formular, dann steht hier, was für dich gilt.`;
const BESTANDTEILE = ["Nachtzuschlag", "Sonntagszuschlag", "Feiertagszuschlag", "Weihnachtsgeld", "Urlaubsgeld", "Fahrtkostenzuschuss", "Sachbezug (z. B. Gutschein)", "Leistungsprämie", "Vermögenswirksame Leistungen"];
const ABRUF_HINWEIS = "Die beschäftigte Person ist nur zur Arbeitsleistung verpflichtet, wenn ihr die Lage der Arbeitszeit jeweils mindestens vier Tage im Voraus mitgeteilt wird und die Arbeit im festgelegten Zeitrahmen liegt (§ 12 Abs. 3 TzBfG).";

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
  // Vorprüfung 21.10.2026: Branche nach § 2a SchwarzArbG aus dem Pflichten-Check – bestimmt den Hinweis zur Form
  profilStart(profil) {
    const w = branche2aAusProfil(profil);
    const start: Daten = w ? { branche: w } : {};
    return start;
  },
  abschnitte: [
    {
      titel: "Beschäftigte Person",
      hilfe: "Name und Anschrift der beschäftigten Person gehören zu den Pflichtangaben (Nr. 1). Nr. 1, 7 und 8 müssen spätestens am ersten Arbeitstag vorliegen, Nr. 2–6, 9 und 10 bis zum siebten Kalendertag, die übrigen innerhalb eines Monats.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Anschrift (Straße, PLZ, Ort)", pflicht: true },
        {
          id: "branche",
          art: "wahl",
          label: "Branche – bestimmt die Form",
          optionen: NW_BRANCHEN,
          vorbelegungJe: { gastro_cafe: "gastronomie", friseur: "friseur_kosmetik", kosmetik: "friseur_kosmetik", gebaeudereinigung: "gebaeudereinigung" },
          hilfe: "In den Branchen nach § 2a Abs. 1 SchwarzArbG (seit 30.12.2025 auch Friseur- und Kosmetikgewerbe) gilt die Schriftform: ausdrucken, beide unterschreiben, aushändigen. Sonst genügt seit 1.1.2025 ein PDF, wenn du dir den Empfang bestätigen lässt. Die beschäftigte Person kann immer einen unterschriebenen Nachweis verlangen.",
        },
      ],
    },
    {
      titel: "Beginn, Ort und Tätigkeit",
      felder: [
        { id: "beginn", art: "datum", label: "Beginn des Arbeitsverhältnisses", pflicht: true },
        { id: "befristet", art: "schalter", label: "Befristet", hilfe: "Die Befristung selbst muss vor Arbeitsbeginn schriftlich vereinbart und von beiden unterschrieben sein (§ 14 Abs. 4 TzBfG) – dieser Nachweis ersetzt das nicht." },
        { id: "befristung_ende", art: "datum", label: "Enddatum", wenn: { feld: "befristet" }, pflicht: true },
        { id: "befristet_kuendbar", art: "schalter", label: "Ordentliche Kündigung vereinbart", wenn: { feld: "befristet" }, hilfe: "Ein befristetes Arbeitsverhältnis ist nur ordentlich kündbar, wenn das einzelvertraglich oder im Tarifvertrag vereinbart ist (§ 15 Abs. 4 TzBfG)." },
        { id: "arbeitsort", art: "wahl", label: "Arbeitsort", optionen: optionen(ORT), vorbelegung: "betrieb" },
        { id: "arbeitsort_text", art: "text", label: "Ort", wenn: { feld: "arbeitsort", ist: "anders" }, pflicht: true },
        { id: "taetigkeit", art: "text", label: "Tätigkeit", hilfe: "kurze Beschreibung", pflicht: true, vorschlaege: ["Friseur/in", "Kosmetiker/in", "Servicekraft", "Küchenhilfe", "Koch/Köchin", "Verkäufer/in", "Bürokraft", "Geselle/Gesellin im Handwerk", "Aushilfe"] },
        { id: "probezeit", art: "wahl", label: "Probezeit", optionen: optionen(PROBEZEIT), vorbelegung: "6", hilfe: "Bei einer Befristung muss die Probezeit im Verhältnis zur Dauer der Befristung und zur Art der Tätigkeit stehen (§ 15 Abs. 3 TzBfG)." },
      ],
    },
    {
      titel: "Arbeitsentgelt",
      hilfe: "Nr. 7 verlangt jeden Bestandteil getrennt mit seiner Höhe: Grundvergütung, Vergütung von Überstunden, Zuschläge, Zulagen, Prämien und Sonderzahlungen.",
      felder: [
        { id: "entgelt_art", art: "wahl", label: "Art", optionen: optionen(ENTGELT), vorbelegung: "monat" },
        { id: "entgelt_betrag", art: "betrag", label: "Betrag brutto (€)", pflicht: true },
        // Minijob (R10): die Grenze steht mit dem Wert zum Ausstellungsdatum im Nachweis – nicht als Freitext mit Jahreszahl
        { id: "minijob", art: "schalter", label: "Minijob (geringfügig entlohnt)", hilfe: "Der Nachweis nennt die Minijob-Grenze, die am Ausstellungstag gilt" },
        // Vorprüfung 21.10.2026: Überstundenvergütung als eigene Angabe (Nr. 7)
        { id: "ueberstunden_verguetung", art: "text", label: "Vergütung von Überstunden", pflicht: true, hilfe: "auch wenn Überstunden nur ausnahmsweise vorkommen", vorschlaege: ["Überstunden werden mit dem vereinbarten Stundenlohn vergütet.", "Überstunden werden mit dem vereinbarten Stundenlohn zuzüglich eines Zuschlags von 25 % vergütet.", "Überstunden werden durch bezahlte Freizeit im Verhältnis 1 : 1 ausgeglichen."] },
        {
          id: "bestandteile",
          art: "liste",
          label: "Zuschläge, Zulagen, Prämien, Sonderzahlungen",
          hilfe: "Jeder Bestandteil mit Bezeichnung und Höhe. Gibt es keine, leer lassen – im Nachweis steht dann „keine“.",
          eintrag: "Bestandteil",
          titelFeld: "bezeichnung",
          leerStarten: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung", pflicht: true, vorschlaege: BESTANDTEILE },
            { id: "hoehe", art: "text", label: "Höhe", pflicht: true, hilfe: "z. B. 50,00 € monatlich, 25 % des Stundenlohns, ein halbes Monatsgehalt im November" },
          ],
        },
        // bis zur Vorprüfung ein Sammelfeld für alle Bestandteile – bleibt für gespeicherte Nachweise und Ergänzungen
        { id: "zuschlaege", selten: true, art: "mehrzeilig", label: "Weitere Angaben zum Entgelt", hilfe: "z. B. Anrechnung oder Auszahlungsweise – Bestandteile mit Betrag bitte oben einzeln eintragen" },
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
        { id: "pausen", art: "text", label: "Ruhepausen", pflicht: true, hilfe: "Gesetzlich (§ 4 ArbZG): mindestens 30 Minuten bei mehr als 6 Stunden, 45 Minuten bei mehr als 9 Stunden Arbeit, teilbar in Abschnitte von mindestens 15 Minuten.", vorschlaege: ["nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden"] },
        { id: "ruhezeit", art: "text", label: "Ruhezeit", pflicht: true, hilfe: "Gesetzlich (§ 5 ArbZG): mindestens 11 Stunden ohne Unterbrechung zwischen Arbeitsende und nächstem Arbeitsbeginn; Ausnahmen z. B. in Gaststätten (§ 5 Abs. 2 ArbZG).", vorschlaege: ["nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit"] },
        { id: "schicht", art: "schalter", label: "Schichtarbeit" },
        { id: "schicht_text", art: "mehrzeilig", label: "Schichtsystem, Rhythmus, Voraussetzungen für Änderungen", wenn: { feld: "schicht" }, pflicht: true },
        { id: "abruf", art: "schalter", label: "Arbeit auf Abruf (§ 12 TzBfG)", hilfe: "Die beschäftigte Person arbeitet nach Arbeitsanfall – dann verlangt Nr. 9 Mindeststunden, Zeitrahmen und Ankündigungsfrist." },
        // Vorprüfung 21.10.2026: die Unterpunkte von Nr. 9 als eigene Felder
        { id: "abruf_mindest", art: "zahl", label: "Mindestens zu vergütende Stunden pro Woche", wenn: { feld: "abruf" }, pflicht: true, hilfe: "Ohne Vereinbarung gelten 20 Stunden (§ 12 Abs. 1 TzBfG). Bei einer Mindestarbeitszeit darf höchstens 25 % mehr abgerufen werden (§ 12 Abs. 2 TzBfG)." },
        { id: "abruf_zeitrahmen", art: "text", label: "Zeitrahmen (Referenztage und Referenzstunden)", wenn: { feld: "abruf" }, pflicht: true, vorschlaege: ["Montag bis Freitag, 8 bis 18 Uhr", "Montag bis Samstag, 7 bis 20 Uhr"] },
        { id: "abruf_frist", art: "text", label: "Ankündigungsfrist", wenn: { feld: "abruf" }, pflicht: true, vorbelegung: { text: "mindestens vier Tage im Voraus" }, hilfe: "Gesetzlich mindestens vier Tage (§ 12 Abs. 3 TzBfG)" },
        { id: "abruf_text", selten: true, art: "mehrzeilig", label: "Weitere Vereinbarungen zur Arbeit auf Abruf", wenn: { feld: "abruf" } },
        { id: "ueberstunden", art: "wahl", label: "Überstunden", optionen: [{ wert: "nein", text: "nicht vereinbart" }, { wert: "ja", text: "können angeordnet werden" }], vorbelegung: "nein" },
        { id: "ueberstunden_text", art: "text", label: "Voraussetzungen", wenn: { feld: "ueberstunden", ist: "ja" }, pflicht: true },
      ],
    },
    {
      titel: "Urlaub, Fortbildung, Altersversorgung",
      felder: [
        { id: "urlaub", art: "zahl", label: "Jahresurlaub (Arbeitstage)", pflicht: true, hilfe: "gesetzlich mindestens 20 Tage bei einer Fünf-Tage-Woche (§ 3 BUrlG)" },
        { id: "fortbildung", art: "text", label: "Fortbildung", vorschlaege: ["Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht."] },
        { id: "bav", art: "schalter", label: "Betriebliche Altersversorgung über einen Versorgungsträger", hilfe: "Die Angabe entfällt, wenn der Versorgungsträger selbst zu dieser Information verpflichtet ist (Nr. 13)." },
        // Vorprüfung 21.10.2026: Name UND Anschrift des Versorgungsträgers (Nr. 13); bav_text war bis dahin „Name und Anschrift“
        { id: "bav_text", art: "text", label: "Name des Versorgungsträgers", wenn: { feld: "bav" }, pflicht: true },
        { id: "bav_anschrift", art: "mehrzeilig", label: "Anschrift des Versorgungsträgers", wenn: { feld: "bav" }, pflicht: true },
      ],
    },
    {
      titel: "Kündigung und Vereinbarungen",
      felder: [
        { id: "kuendigung_art", art: "wahl", label: "Kündigung", optionen: [{ wert: "gesetz", text: "gesetzliche Regelungen" }, { wert: "eigen", text: "abweichend vereinbart" }], vorbelegung: "gesetz" },
        { id: "kuendigung_eigen", art: "mehrzeilig", label: "Vereinbarte Regelung (Schriftform, Fristen, Klagefrist)", wenn: { feld: "kuendigung_art", ist: "eigen" }, pflicht: true },
        { id: "kollektiv", art: "wahl", label: "Tarifverträge, Betriebsvereinbarungen", optionen: [{ wert: "keine", text: "keine" }, { wert: "ja", text: "finden Anwendung" }], vorbelegung: "keine", hilfe: "Allgemeinverbindliche Tarifverträge gelten auch ohne Mitgliedschaft im Arbeitgeberverband – z. B. in der Gebäudereinigung, teils regional im Friseurhandwerk. Nachschlagen: Verzeichnis der allgemeinverbindlichen Tarifverträge des BMAS." },
        { id: "kollektiv_text", art: "text", label: "Welche", wenn: { feld: "kollektiv", ist: "ja" }, pflicht: true },
        // Vorprüfung 21.10.2026: die Liste in § 2 Abs. 1 NachwG ist nicht abschließend
        { id: "weitere", art: "mehrzeilig", label: "Weitere Vereinbarungen", hilfe: "Ausschlussfristen und Wettbewerbsverbote gehören hinein, wenn sie vereinbart sind – die Liste in § 2 Abs. 1 NachwG ist nicht abschließend." },
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
  // beim Teilen (R10): Form und Empfangsnachweis – gerade per Messenger geteilte PDFs erfüllen sonst die Form nicht;
  // Vorprüfung 21.10.2026: je Branche, dazu die Hinweise zur Befristung (§§ 14, 15 TzBfG)
  hinweise: (d) => {
    const branche = BRANCHEN_2A.find((o) => o.wert === text(d, "branche"));
    const r = [branche ? NACHWG_FORM_SCHRIFT(branche.text) : text(d, "branche") === "keine" ? NACHWG_FORM_TEXT : NACHWG_FORM_OFFEN];
    if (ja(d, "befristet")) {
      r.push("Befristung: Die Befristungsabrede muss vor Arbeitsbeginn schriftlich vereinbart und von beiden unterschrieben sein (§ 14 Abs. 4 TzBfG) – dieser Nachweis ersetzt sie nicht.");
      if (text(d, "probezeit") && text(d, "probezeit") !== "keine") r.push("Probezeit bei Befristung: Sie muss im Verhältnis zur Dauer der Befristung und zur Art der Tätigkeit stehen (§ 15 Abs. 3 TzBfG).");
    }
    return r;
  },
  html(d, b) {
    const ort = text(d, "arbeitsort") === "anders" ? `${ORT.anders} ${text(d, "arbeitsort_text")}` : (ORT[text(d, "arbeitsort")] ?? "");
    const entgelt = text(d, "entgelt_betrag") ? `${ENTGELT[text(d, "entgelt_art")] ?? ""}: ${euro(cent(text(d, "entgelt_betrag")) ?? 0)}` : "";
    const zeit = [text(d, "wochenstunden") ? `${zahlText(zahl(text(d, "wochenstunden")) ?? 0)} Stunden pro Woche` : "", text(d, "wochenstunden") && text(d, "tage_pro_woche") ? `an ${text(d, "tage_pro_woche")} Tagen` : "", text(d, "verteilung")].filter(Boolean).join(", ");
    // Blatt zum Ausfüllen von Hand: noch kein Name und kein Entgelt eingetragen
    const leer = !text(d, "name") && !text(d, "entgelt_betrag");
    const bestandteile = liste(d, "bestandteile").filter((x) => text(x, "bezeichnung") || text(x, "hoehe"));
    const grenze = minijobGrenzeAm(stichtag(d));
    // Nr. 7: jeder Bestandteil eine eigene Zeile (Bezeichnung – Höhe), Grundvergütung und Überstunden vorneweg
    const nr7 = angaben([
      ["Grundvergütung (brutto)", entgelt],
      ["Minijob", ja(d, "minijob") && grenze !== null ? `Geringfügig entlohnte Beschäftigung: Das monatliche Arbeitsentgelt übersteigt die Minijob-Grenze von ${euro(grenze)} (Stand ${datumDe(stichtag(d))}) nicht.` : null],
      ["Vergütung von Überstunden", text(d, "ueberstunden_verguetung")],
      ...(bestandteile.length
        ? bestandteile.map((x): [string, string] => [text(x, "bezeichnung") || "Bestandteil", text(x, "hoehe")])
        : ([["Zuschläge, Zulagen, Prämien, Sonderzahlungen", leer ? "" : "keine", leer ? 3 : undefined]] as [string, string, number?][])),
      ["Provision", text(d, "provision") ? `${text(d, "provision").replace(/\n+/g, " ")}${text(d, "provision_ab") ? ` (ab ${datumDe(text(d, "provision_ab"))})` : ""}` : null],
      ["Weitere Angaben", text(d, "zuschlaege") || null],
      ["Fälligkeit", text(d, "faelligkeit")],
      ["Art der Auszahlung", text(d, "auszahlung")],
    ]);
    // Nr. 9: die vier Angaben bei Arbeit auf Abruf (Vereinbarung, Mindeststunden, Zeitrahmen, Ankündigungsfrist)
    const nr9 = ja(d, "abruf")
      ? angaben([
          ["Vereinbarung", "Die beschäftigte Person erbringt ihre Arbeitsleistung entsprechend dem Arbeitsanfall (§ 12 TzBfG)."],
          ["Mindestens zu vergütende Stunden", text(d, "abruf_mindest") ? `${zahlText(zahl(text(d, "abruf_mindest")) ?? 0)} Stunden pro Woche` : ""],
          ["Zeitrahmen (Referenztage und -stunden)", text(d, "abruf_zeitrahmen")],
          ["Ankündigungsfrist", text(d, "abruf_frist")],
          ["Weitere Vereinbarungen", text(d, "abruf_text") || null],
        ]) + `<p class="klein">${esc(ABRUF_HINWEIS)}</p>`
      : null;
    const zeilenNw: [string, string | null, string?][] = [
      ["2. Beginn", datumDe(text(d, "beginn"))],
      ["3. Befristung", ja(d, "befristet") ? `befristet bis ${datumDe(text(d, "befristung_ende"))}` : "unbefristet"],
      ["4. Arbeitsort", ort],
      ["5. Tätigkeit", text(d, "taetigkeit")],
      ["6. Probezeit", PROBEZEIT[text(d, "probezeit")] ?? ""],
      ["7. Arbeitsentgelt", null, nr7],
      ["8. Arbeitszeit, Pausen, Ruhezeiten", [zeit, text(d, "pausen") ? `Ruhepausen: ${text(d, "pausen").replace(/^\s*Ruhepausen:?\s*/i, "")}` : "", text(d, "ruhezeit") ? `Ruhezeit: ${text(d, "ruhezeit").replace(/^\s*Ruhezeit:?\s*/i, "")}` : "", ja(d, "schicht") ? `Schichtarbeit: ${text(d, "schicht_text")}` : ""].filter(Boolean).join("\n")],
      ["9. Arbeit auf Abruf", nr9 ? null : "nicht vereinbart", nr9 ?? undefined],
      ["10. Überstunden", text(d, "ueberstunden") === "ja" ? `${UEBERSTUNDEN.ja} ${text(d, "ueberstunden_text")}` : UEBERSTUNDEN.nein!],
      ["11. Erholungsurlaub", text(d, "urlaub") ? `${text(d, "urlaub")} Arbeitstage pro Kalenderjahr` : ""],
      ["12. Fortbildung", text(d, "fortbildung") || "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht."],
      ["13. Betriebliche Altersversorgung", ja(d, "bav") ? (text(d, "bav_text") || text(d, "bav_anschrift") ? `Über den Versorgungsträger: ${[text(d, "bav_text"), text(d, "bav_anschrift").replace(/\n+/g, ", ")].filter(Boolean).join(", ")}` : "") : "nicht zugesagt"],
      ["14. Kündigung", kuendigungText(d)],
      ["15. Tarifverträge, Vereinbarungen", text(d, "kollektiv") === "ja" ? `${KOLLEKTIV.ja} ${text(d, "kollektiv_text")}` : KOLLEKTIV.keine!],
      ...(text(d, "weitere") ? ([["16. Weitere Vereinbarungen", text(d, "weitere")]] as [string, string][]) : []),
    ];
    // Blatt zum Ausfüllen: Punkte mit mehreren Angaben als beschriftete Linien – dieselben Teilangaben, die das
    // ausgefüllte Dokument nennt (statt zweier unbeschrifteter Linien)
    const leerAngaben: Record<string, string> = {
      "8": angaben([["Stunden pro Woche", ""], ["Arbeitstage pro Woche", ""], ["Verteilung", ""], ["Ruhepausen", ""], ["Ruhezeit", ""], ["Schichtarbeit (falls vereinbart)", ""]]),
      "11": angaben([["Arbeitstage pro Kalenderjahr", ""]]),
    };
    // Vertrag: Parteien in zwei Spalten, dann die Punkte des § 2 Abs. 1 NachwG mit Randnummern
    // Kapitalgesellschaft mit Geschäftsführung in „Mein Betrieb“: „vertreten durch …“ bei Partei und Unterschrift
    const vertreten = mitVertretung(b) !== b.name.trim() ? `vertreten durch ${(b.vertretung ?? "").trim()}` : "";
    // kompakt: aufeinanderfolgende Punkte mit kurzer, einzeiliger Angabe (Beginn, Befristung, Arbeitsort …) stehen als
    // Angabenzeilen unter einer gemeinsamen Randnummer („2.–6.“); längere Texte bleiben eigene Abschnitte. Wortlaut und
    // Reihenfolge aller Punkte bleiben gleich, die Nummerierung der Abschnitte läuft weiter (counter-increment).
    const kurz = ([t, w, html]: [string, string | null, string?]) => !html && !leerAngaben[t.split(".")[0]!] && !(w ?? "").includes("\n") && (w ?? "").length <= 60;
    const punkteNw: string[] = [];
    const rest = zeilenNw;
    for (let i = 0; i < rest.length; ) {
      let j = i;
      while (j < rest.length && kurz(rest[j]!)) j++;
      if (j - i >= 2) {
        const nr = (k: number) => rest[k]![0].split(".")[0]!;
        punkteNw.push(`<section class="abschnitt gruppe zusammen" style="counter-increment: abschnitt ${j - i}"><div class="gruppe-nr">${nr(i)}.–${nr(j - 1)}.</div>${angaben(rest.slice(i, j).map(([t, w]) => [t.replace(/^\d+\.\s*/, ""), w ?? ""]))}</section>`);
        i = j;
        continue;
      }
      const [t, w, html] = rest[i]!;
      const nr = t.split(".")[0]!;
      punkteNw.push(abschnitt(t.replace(/^\d+\.\s*/, ""), html ?? (!w && leerAngaben[nr] ? leerAngaben[nr]! : absatz(w ?? ""))));
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
        abschnitt("Vertragsparteien", parteien({ rolle: "Arbeitgeber", name: b.name, anschrift: anschriftMehrzeilig(b), zusatz: vertreten || undefined }, { rolle: "beschäftigte Person", name: text(d, "name"), anschrift: text(d, "anschrift"), anschriftPflicht: true })) +
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

/**
 * KI-Schulung (Vorprüfung 21.10.2026): Art. 4 KI-VO verlangt seit 27.07.2026 (Änderung durch VO (EU) 2026/1744,
 * „Digital Omnibus“) Maßnahmen, die die KI-Kompetenz fördern – kein bestimmtes Niveau und keine Formvorschrift. Die
 * Vorlage dokumentiert eine solche Maßnahme; Titel und Rechtsgrundlage sind entsprechend zurückhaltend.
 */
export const KI_GRUNDLAGE = "Art. 4 KI-VO (VO (EU) 2024/1689, geändert durch VO (EU) 2026/1744)";
export const kiKompetenz: Vorlage = {
  id: "ki_kompetenz",
  titel: "Dokumentation KI-Schulung",
  beschreibung: "Wer wann zu welchen KI-Werkzeugen geschult wurde – Inhalte zum Ankreuzen, mit Unterschriften der Teilnehmenden. Belegt eine Maßnahme zur Förderung der KI-Kompetenz (Art. 4 KI-VO).",
  bereich: "personal",
  pflichten: ["ki.kompetenz"],
  grundlage: KI_GRUNDLAGE,
  namensFeld: "thema",
  abschnitte: [
    { titel: "Schulung",
      hilfe: "Seit 27.07.2026 verlangt Art. 4 KI-VO, dass Betriebe, die KI-Systeme einsetzen, Maßnahmen zur Förderung der KI-Kompetenz ihrer Beschäftigten ergreifen – ein bestimmtes Niveau oder eine bestimmte Form schreibt das Gesetz nicht vor. Eine dokumentierte Schulung ist ein üblicher Weg.",
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
      titel: "Dokumentation KI-Schulung",
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
        // Vorprüfung 21.10.2026: „Ausgehändigt am“ liegt vor dem Beginn – § 2a Abs. 2 SchwarzArbG verlangt den Hinweis vor Beginn der Arbeit
        { id: "datum", art: "datum", label: "Ausgehändigt am", vorbelegung: "heute", pflicht: true, hilfe: "Vor Beginn der Arbeit – das Datum liegt vor dem ersten Arbeitstag, spätestens an diesem Tag vor Arbeitsbeginn (§ 2a Abs. 2 SchwarzArbG)." },
        { id: "beginn", art: "datum", label: "Beginn der Beschäftigung", hilfe: "Aus „Mitarbeiter“. „Ausgehändigt am“ muss davor liegen." },
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
