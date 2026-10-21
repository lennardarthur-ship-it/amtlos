/**
 * Personal (E-121): Arbeitszeitnachweis, Lohnkonto, Daten für die Sozialversicherungsmeldung. Amtlos rechnet keine
 * Lohnsteuer und keine Beiträge – die Beträge kommen aus der Lohnabrechnung. Gliederungen fachlich zu prüfen (T-61).
 */
import { KOPF_LINIE, ZELLE_LINIE, abschnitt, angaben, ankreuzen, cent, datumDe, dokument, esc, euro, felder, ibanText, ja, liste, nachsatz, roh, summe, svNummerText, tabelle, text, unterschriften, zelle, type Roh } from "./html.js";
import { MINIJOB, SV } from "./bausteine.js";
import type { Daten, Eintrag, Vorlage } from "./typen.js";

const minuten = (hhmm: string): number | null => {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Arbeitszeit eines Tages in Minuten: Ende − Beginn − Pause; über Mitternacht wird ein Tag addiert. */
export function arbeitsminuten(beginn: string, ende: string, pause: string): number | null {
  const b = minuten(beginn);
  const e = minuten(ende);
  if (b === null || e === null) return null;
  // Pause auf ganze Minuten gerundet („7,5“ → 8), sonst stünde „8:22.5 h“ im Nachweis
  const p = Math.round(Number((pause || "0").replace(",", ".")));
  return Math.max(0, (e >= b ? e - b : e + 1440 - b) - (Number.isFinite(p) ? p : 0));
}
export const stunden = (min: number) => {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
};

function zeiten(d: Daten) {
  // auch Tage nur mit Bemerkung (Urlaub, krank) bleiben stehen – ohne Dauer
  const z = liste(d, "tage")
    .filter((x) => text(x, "beginn") || text(x, "ende") || text(x, "bemerkung"))
    .map((x) => ({ x, min: arbeitsminuten(text(x, "beginn"), text(x, "ende"), text(x, "pause")) }));
  return { z, gesamt: z.reduce((a, t) => a + (t.min ?? 0), 0) };
}

const MONATSNAMEN = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const monatVon = (iso: string) => `${MONATSNAMEN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * Monat eines Arbeitszeitnachweises (R11, Reinigung #10): die eigene Angabe, sonst aus den Daten der Arbeitstage
 * („Oktober 2026“; über zwei Monate „September 2026 – Oktober 2026“). Leer, wenn nichts bekannt ist.
 */
export function monatAus(d: Daten): string {
  const eigen = text(d, "monat");
  if (eigen) return eigen;
  const tage = liste(d, "tage").map((x) => text(x, "datum")).filter((t) => ISO_TAG.test(t)).sort();
  if (!tage.length) return "";
  const von = monatVon(tage[0]!);
  const bis = monatVon(tage[tage.length - 1]!);
  return von === bis ? von : `${von} – ${bis}`;
}

/** Branchen nach § 2a SchwarzArbG für den Hinweis im Nachweis (R11, Reinigung #9) – vorbelegt aus der Branche im Pflichten-Check. */
const AZN_BRANCHEN = [
  { wert: "gastronomie", text: "Gaststätten und Beherbergung" },
  { wert: "bau", text: "Baugewerbe" },
  { wert: "gebaeudereinigung", text: "Gebäudereinigung" },
  { wert: "friseur_kosmetik", text: "Friseur- und Kosmetikgewerbe" },
  { wert: "andere", text: "Andere Branche nach § 2a SchwarzArbG" },
  { wert: "keine", text: "Keine dieser Branchen" },
];

/** Satz zur Aufzeichnungspflicht unter der Tabelle – je nach Branche aus dem Profil. */
function aufzeichnungsSatz(d: Daten): string {
  const frist = "Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens bis zum Ablauf des siebten Kalendertages nach dem Arbeitstag aufzeichnen. Die Aufzeichnungen mindestens zwei Jahre aufbewahren.";
  const b = text(d, "branche");
  const name = AZN_BRANCHEN.find((x) => x.wert === b && b !== "keine" && b !== "andere")?.text;
  if (name) return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Branchen nach § 2a SchwarzArbG (hier: ${name}) und für Minijobs: ${frist}`;
  if (b === "andere") return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Branchen nach § 2a SchwarzArbG und für Minijobs: ${frist}`;
  if (b === "keine") return `Für Minijobs gilt die Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG: ${frist}`;
  return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Minijobs und die Branchen nach § 2a SchwarzArbG (u. a. Bau, Gastronomie, Gebäudereinigung, Friseur- und Kosmetikgewerbe): ${frist}`;
}

export const arbeitszeitnachweis: Vorlage = {
  id: "arbeitszeitnachweis",
  titel: "Arbeitszeitnachweis",
  beschreibung: "Beginn, Ende und Dauer der täglichen Arbeitszeit je Person und Monat – auch für Minijobs. Ausgefüllt oder als Blatt zum Eintragen von Hand.",
  bereich: "personal",
  pflichten: ["personal.arbeitszeit_aufzeichnung", "personal.arbeitszeit_milog"],
  // „Beschäftigt seit“ für die Prüfung, ob ein Arbeitstag davor liegt (R11, Reinigung #10)
  person: { art: "mitarbeiter", felder: { name: "name", beginn: "beschaeftigt_seit" } },
  grundlage: "§ 3 Abs. 2 Nr. 1 ArbSchG (BAG 13.09.2022 – 1 ABR 22/21); § 17 MiLoG",
  namensFeld: "name",
  abschnitte: [
    { titel: "Person und Monat",
      felder: [
        { id: "name", art: "text", label: "Name der beschäftigten Person", pflicht: true },
        // R11: ohne Angabe aus den Arbeitstagen – Freitext nur noch, wer etwas anderes drucken will
        { id: "monat", selten: true, art: "text", label: "Monat", hilfe: "Leer lassen: Amtlos nimmt den Monat aus den Arbeitstagen, z. B. Oktober 2026." },
        { id: "beschaeftigt_seit", selten: true, art: "datum", label: "Beschäftigt seit", hilfe: "Aus „Mitarbeiter“ übernommen. Amtlos weist darauf hin, wenn ein Arbeitstag davor liegt." },
        {
          id: "branche",
          selten: true,
          art: "wahl",
          label: "Branche für den Hinweis zur Aufzeichnungspflicht",
          optionen: AZN_BRANCHEN,
          vorbelegungJe: { gastro_cafe: "gastronomie", friseur: "friseur_kosmetik", kosmetik: "friseur_kosmetik", gebaeudereinigung: "gebaeudereinigung" },
          hilfe: "Aus deiner Branche im Pflichten-Check. Bestimmt den Satz unter der Tabelle.",
        },
        { id: "leerzeilen", selten: true, art: "schalter", label: "Leere Zeilen zum Eintragen von Hand anhängen", vorbelegung: false },
      ],
    },
    {
      titel: "Arbeitstage",
      felder: [
        {
          id: "tage",
          art: "liste",
          label: "Arbeitstage",
          eintrag: "Arbeitstag",
          titelFeld: "datum",
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            // Pflicht nur ohne Bemerkung (Urlaub, krank) – das prüft pruefen(), die Liste kennt keine solche Bedingung
            { id: "beginn", art: "uhrzeit", label: "Beginn" },
            { id: "ende", art: "uhrzeit", label: "Ende" },
            { id: "pause", art: "zahl", label: "Pause (Minuten)" },
            { id: "einsatzort", art: "text", label: "Einsatzort", hilfe: "z. B. Objekt, Kunde oder Baustelle" },
            { id: "bemerkung", selten: true, art: "text", label: "Bemerkung", hilfe: "z. B. Urlaub, krank" },
          ],
        },
      ],
    },
  ],
  ergebnis: (d) => [["Arbeitszeit im Monat", stunden(zeiten(d).gesamt)]],
  pruefen(d) {
    // Beginn und Ende fehlen nur an Tagen ohne Bemerkung; ein Tag mit „Urlaub“ oder „krank“ braucht keine Uhrzeiten
    const tage = liste(d, "tage").filter((x) => ["beginn", "ende", "pause", "bemerkung"].some((k) => text(x, k)));
    return tage.flatMap((x, i) =>
      text(x, "bemerkung")
        ? []
        : [["beginn", "Beginn"], ["ende", "Ende"]].filter(([k]) => !text(x, k!)).map(([, label]) => `Arbeitstag${tage.length > 1 ? ` ${i + 1}` : ""}: ${label}`),
    );
  },
  hinweise(d) {
    const r: string[] = [];
    // R11 (Reinigung #10): Arbeitstag vor „Beschäftigt seit“ – meist ein Tippfehler im Datum oder beim Beginn
    const seit = text(d, "beschaeftigt_seit");
    const tage = liste(d, "tage").map((x) => text(x, "datum")).filter((t) => ISO_TAG.test(t)).sort();
    const vorher = ISO_TAG.test(seit) ? tage.filter((t) => t < seit) : [];
    if (vorher.length) r.push(`${vorher.length === 1 ? `Der Arbeitstag am ${datumDe(vorher[0]!)} liegt` : `${vorher.length} Arbeitstage (ab ${datumDe(vorher[0]!)}) liegen`} vor „Beschäftigt seit“ (${datumDe(seit)}). Bitte Datum bzw. Beginn der Beschäftigung prüfen.`);
    if (tage.length && monatVon(tage[0]!) !== monatVon(tage[tage.length - 1]!)) r.push("Die Arbeitstage stammen aus mehreren Monaten. Üblich ist ein Nachweis je Person und Monat.");
    return r;
  },
  html(d, b) {
    const { z, gesamt } = zeiten(d);
    const monat = monatAus(d);
    // Einsatzort als eigene Spalte nur, wenn er irgendwo eingetragen ist
    const mitOrt = z.some(({ x }) => text(x, "einsatzort"));
    // ohne Einträge: Blatt zum Eintragen von Hand – eine hohe Zeile je Tag, keine Summe „0:00 h“
    const leer = !z.length;
    const leerzeilen = leer ? 31 : ja(d, "leerzeilen") ? 31 - z.length : 0;
    return dokument({
      titel: "Arbeitszeitnachweis",
      betrieb: b,
      unter: [text(d, "name"), monat].filter(Boolean).join(", ") || undefined,
      meta: `Beschäftigte Person: ${text(d, "name")}\nMonat: ${monat}`,
      inhalt:
        // die Kennungsleiste lässt leere Angaben weg: dann je fehlender Angabe eine Zeile zum Eintragen von Hand
        (!text(d, "name") || !monat ? `<div style="margin-bottom:5mm">${felder([["Beschäftigte Person", text(d, "name") ? null : ""], ["Monat", monat ? null : ""]], { nummern: false })}</div>` : "") +
        (mitOrt
          ? tabelle(
              ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Einsatzort", "Bemerkung"],
              z.map(({ x, min }) => [datumDe(text(x, "datum")), esc(text(x, "beginn")), esc(text(x, "ende")), esc(text(x, "pause")), min === null ? "" : stunden(min), zelle(text(x, "einsatzort")), zelle(text(x, "bemerkung"))]),
              { breiten: ["13%", "10%", "10%", "11%", "11%", "24%", "21%"], leerzeilen, hoch: ja(d, "leerzeilen"), zahlen: [3, 4], ...(ja(d, "leerzeilen") ? { summe: ["<strong>Summe der erfassten Tage</strong>", `<strong>${stunden(gesamt)}</strong>`, "", ""], summeSpanne: 4 } : { summe: ["<strong>Summe</strong>", "", "", "", `<strong>${stunden(gesamt)}</strong>`, "", ""] }) },
            )
          : tabelle(
              ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Bemerkung"],
              z.map(({ x, min }) => [datumDe(text(x, "datum")), esc(text(x, "beginn")), esc(text(x, "ende")), esc(text(x, "pause")), min === null ? "" : stunden(min), zelle(text(x, "bemerkung"))]),
              { breiten: ["15%", "12%", "12%", "13%", "13%", "35%"], leerzeilen, hoch: leer || ja(d, "leerzeilen"), zahlen: [3, 4], ...(leer ? { summe: ["<strong>Summe</strong>", "", "", "", ZELLE_LINIE, ""] } : ja(d, "leerzeilen") ? { summe: ["<strong>Summe der erfassten Tage</strong>", `<strong>${stunden(gesamt)}</strong>`, ""], summeSpanne: 4 } : { summe: ["<strong>Summe</strong>", "", "", "", `<strong>${stunden(gesamt)}</strong>`, ""] }) },
            )) +
        `<p class="nachsatz">${esc(aufzeichnungsSatz(d))}</p>` +
        unterschriften(["Unterschrift beschäftigte Person", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

export const STEUERKLASSEN = ["I", "II", "III", "IV", "IV mit Faktor", "V", "VI"].map((k) => ({ wert: k, text: k }));

const BETRAEGE: [string, string][] = [
  ["brutto", "Bruttolohn"],
  ["sachbezuege", "Sachbezüge"],
  ["steuerfrei", "Steuerfreie Bezüge"],
  ["lohnsteuer", "Lohnsteuer"],
  ["soli", "Solidaritätszuschlag"],
  ["kirchensteuer", "Kirchensteuer"],
  ["sv_an", "SV-Beiträge Arbeitnehmer"],
  ["sv_ag", "SV-Beiträge Arbeitgeber"],
  ["auszahlung", "Auszahlung"],
];

export const lohnkonto: Vorlage = {
  id: "lohnkonto",
  querformat: true,
  titel: "Lohnkonto",
  beschreibung: "Je beschäftigte Person die Stammdaten und für jeden Monat Lohn, Steuern und Beiträge – mit Jahressummen.",
  bereich: "personal",
  // nicht „Lohnabrechnung über geprüfte Software“ (personal.lohnabrechnung): das Lohnkonto ersetzt keine Lohnsoftware
  pflichten: ["personal.lohnsteuer_anmeldung"],
  person: { art: "mitarbeiter", felder: { name: "name", geburtsdatum: "geburtsdatum", anschrift: "anschrift", steuer_id: "steuer_id", steuerklasse: "steuerklasse", sv_nummer: "sv_nummer", krankenkasse: "krankenkasse", beginn: "eintritt" } },
  grundlage: "§ 41 EStG; § 4 LStDV",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Stammdaten",
      hilfe: "Amtlos rechnet keine Lohnsteuer und keine Beiträge – trag die Beträge aus deiner Lohnabrechnung ein.",
      felder: [
        { id: "name", art: "text", label: "Name", pflicht: true },
        { id: "jahr", art: "text", label: "Jahr", pflicht: true },
        { id: "geburtsdatum", art: "datum", label: "Geburtsdatum", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Anschrift", pflicht: true },
        { id: "steuer_id", art: "text", label: "Steuer-Identifikationsnummer", pflicht: true },
        // pauschal versteuerter Minijob (§ 40a EStG): ohne Lohnsteuerabzugsmerkmale, also ohne Steuerklasse
        { id: "pauschal", selten: true, art: "schalter", label: "Lohnsteuer pauschal (Minijob, § 40a EStG)", hilfe: "Dann gilt keine Steuerklasse – die Pauschsteuer steht in der Abrechnung der Minijob-Zentrale" },
        { id: "steuerklasse", art: "wahl", label: "Steuerklasse", optionen: STEUERKLASSEN, pflicht: true, wenn: { feld: "pauschal", nicht: true } },
        { id: "kinder", art: "text", label: "Kinderfreibeträge" },
        { id: "religion", art: "text", label: "Kirchensteuermerkmal", vorschlaege: ["keine Kirchensteuerpflicht", "ev (evangelisch)", "rk (römisch-katholisch)"] },
        { id: "sv_nummer", art: "text", label: "Sozialversicherungsnummer", pflicht: true },
        { id: "krankenkasse", art: "text", label: "Krankenkasse", pflicht: true },
        { id: "eintritt", art: "datum", label: "Beschäftigt seit", pflicht: true },
      ],
    },
    {
      titel: "Monate",
      felder: [
        {
          id: "monate",
          art: "liste",
          label: "Monate",
          eintrag: "Monat",
          titelFeld: "monat",
          felder: [
            { id: "monat", art: "text", label: "Lohnzahlungszeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
            { id: "zahltag", art: "datum", label: "Tag der Lohnzahlung", pflicht: true },
            ...BETRAEGE.map(([id, label]) => ({ id, art: "betrag" as const, label: `${label} (€)`, pflicht: id === "brutto", selten: ["sachbezuege", "steuerfrei", "soli"].includes(id) })),
            { id: "unterbrechung", selten: true, art: "schalter", label: "Unterbrechung ohne Lohnanspruch (Großbuchstabe U)", hilfe: "z. B. mindestens fünf Arbeitstage ohne Lohn" },
          ],
        },
      ],
    },
  ],
  ergebnis: (d) => [["Brutto im Jahr", euro(summe(liste(d, "monate"), "brutto"))], ["Lohnsteuer im Jahr", euro(summe(liste(d, "monate"), "lohnsteuer"))]],
  html(d, b) {
    const m = liste(d, "monate").filter((x) => text(x, "monat"));
    // ohne Monate: Blatt zum Eintragen von Hand
    const leer = !m.length;
    // Spaltenköpfe mit weichen Trennstellen (nur im Kopf), damit „Solidaritätszuschlag“ in die schmale Spalte passt
    const kopf = ["Zeitraum", "Zahltag", ...BETRAEGE.map(([k, l]) => (k === "soli" ? "Soli\u00addaritäts\u00adzuschlag" : l)), "U*"];
    const tabellenOptionen = { breiten: ["10%", "8%", ...BETRAEGE.map(() => `${79 / BETRAEGE.length}%`), "3%"], zahlen: BETRAEGE.map((_, i) => i + 2), klasse: "eng lohn" };
    // leere Zelle: „–“ (nicht leer gelassen); Spalte ganz ohne Beträge: auch in der Summe „–“ statt „0,00 €“
    const STRICH = "–";
    const betrag = (e: Eintrag, k: string) => (text(e, k) ? euro(cent(text(e, k)) ?? 0) : STRICH);
    const spalteLeer = (k: string) => m.every((e) => !text(e, k));
    return dokument({
      titel: "Lohnkonto",
      betrieb: b,
      unter: [text(d, "name"), text(d, "jahr")].filter(Boolean).join(" · ") || undefined,
      // ohne Jahr: Linie zum Eintragen in der Kennungsleiste
      meta: text(d, "jahr") ? undefined : `Jahr: ${KOPF_LINIE}`,
      quer: true,
      // engerer Satz (CSS .lohnkonto), damit Stammdaten und alle zwölf Monate samt Summe auf ein Querformatblatt passen
      klasse: "lohnkonto",
      inhalt:
        // Querformat: Stammdaten in zwei Spalten, damit die Monate möglichst auf Seite 1 beginnen
        abschnitt(
          "Stammdaten",
          // drei Spalten, damit Stammdaten und alle zwölf Monate auf ein Querformatblatt passen; einzeilige Angaben zuerst,
          // damit die Zeilen der Spalten auf einer Höhe stehen; mehrzeilige bzw. entfallende am Ende
          `<div class="spalten3">${angaben([
            ["Name", text(d, "name")],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Anschrift", text(d, "anschrift")],
          ])}${angaben([
            ["Beschäftigt seit", datumDe(text(d, "eintritt"))],
            ["Krankenkasse", text(d, "krankenkasse")],
            ["SV-Nummer", svNummerText(text(d, "sv_nummer"))],
          ])}${angaben([
            ["Steuer-ID", text(d, "steuer_id")],
            ["Steuerklasse", ja(d, "pauschal") ? "keine – Lohnsteuer pauschal (§ 40a EStG)" : text(d, "steuerklasse")],
            ["Kinderfreibeträge", text(d, "kinder") || (leer ? "" : null)],
            ["Kirchensteuermerkmal", text(d, "religion") || (leer ? "" : null)],
          ])}</div>`,
        ) +
        abschnitt(
          "Monate",
          (leer
            ? tabelle(kopf, [], { ...tabellenOptionen, mindestens: 12, hoch: true, summe: ["<strong>Summe</strong>", "", ...BETRAEGE.map(() => ZELLE_LINIE), ""] })
            : tabelle(kopf, m.map((e) => [zelle(text(e, "monat")), datumDe(text(e, "zahltag")), ...BETRAEGE.map(([k]) => betrag(e, k)), ja(e, "unterbrechung") ? "U" : ""]), { ...tabellenOptionen, summe: ["<strong>Summe</strong>", "", ...BETRAEGE.map(([k]) => (spalteLeer(k) ? STRICH : `<strong>${euro(summe(m, k))}</strong>`)), ""] })) + nachsatz("* U = Unterbrechung ohne Lohnanspruch (§ 41 Abs. 1 EStG)"),
        ),
    });
  },
};

const ARTEN = [
  { wert: "vollzeit", text: "Vollzeit" },
  { wert: "teilzeit", text: "Teilzeit" },
  { wert: "minijob", text: "Minijob" },
  { wert: "kurzfristig", text: "Kurzfristig" },
  { wert: "ausbildung", text: "Ausbildung" },
];

export const svMeldedaten: Vorlage = {
  id: "sv_meldedaten",
  gestalt: "formular",
  titel: "Personalfragebogen (Daten für die Anmeldung)",
  beschreibung: "Alle Angaben einer neuen beschäftigten Person, die du für die Anmeldung zur Sozialversicherung und die Lohnabrechnung brauchst – zum Unterschreiben.",
  bereich: "personal",
  pflichten: ["personal.sv_anmeldung", "personal.sofortmeldung"],
  person: { art: "mitarbeiter", felder: { name: "name", geburtsname: "geburtsname", geburtsdatum: "geburtsdatum", geburtsort: "geburtsort", staatsangehoerigkeit: "staatsangehoerigkeit", anschrift: "anschrift", sv_nummer: "sv_nummer", steuer_id: "steuer_id", krankenkasse: "krankenkasse", iban: "iban", beginn: "beginn", taetigkeit: "taetigkeit" } },
  grundlage: "§ 28a SGB IV; DEÜV",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Person",
      hilfe: "Die Meldung selbst geht elektronisch über dein Lohnprogramm oder sv.net.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", pflicht: true },
        { id: "geburtsname", selten: true, art: "text", label: "Geburtsname", hilfe: "falls abweichend" },
        { id: "geburtsdatum", art: "datum", label: "Geburtsdatum", pflicht: true },
        { id: "geburtsort", art: "text", label: "Geburtsort", pflicht: true },
        { id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Anschrift", pflicht: true },
        { id: "sv_nummer", art: "text", label: "Sozialversicherungsnummer", pflicht: true },
        { id: "steuer_id", art: "text", label: "Steuer-Identifikationsnummer", pflicht: true },
        { id: "krankenkasse", art: "text", label: "Krankenkasse", pflicht: true },
        { id: "iban", art: "text", label: "IBAN für das Gehalt", pflicht: true },
      ],
    },
    {
      titel: "Beschäftigung",
      felder: [
        { id: "beginn", art: "datum", label: "Beginn der Beschäftigung", pflicht: true },
        { id: "art", art: "wahl", label: "Art", optionen: ARTEN, vorbelegung: "vollzeit" },
        { id: "personengruppe", art: "wahl", label: "Personengruppe (Schlüssel für die Meldung)", optionen: SV.personengruppen, vorbelegung: "101" },
        { id: "vertragsform", art: "wahl", label: "Vertragsform", optionen: SV.vertragsform, vorbelegung: "1" },
        { id: "stunden", art: "zahl", label: "Wochenstunden", pflicht: true },
        { id: "entgelt", art: "betrag", label: "Monatliches Entgelt (€)", pflicht: true },
        { id: "taetigkeit", art: "text", label: "Tätigkeit", pflicht: true },
        { id: "schulabschluss", art: "wahl", label: "Höchster Schulabschluss", optionen: SV.schulabschluss },
        { id: "ausbildung", art: "wahl", label: "Höchster Berufsabschluss", optionen: SV.ausbildung },
        { id: "weitere", art: "schalter", label: "Hat weitere Beschäftigungen" },
        { id: "weitere_welche", art: "text", label: "Welche (Arbeitgeber, Umfang)", wenn: { feld: "weitere" }, pflicht: true },
      ],
    },
  ],
  pruefen(d) {
    const grenze = MINIJOB.filter((m) => m.ab <= (text(d, "beginn") || "9999")).sort((a, b) => b.ab.localeCompare(a.ab))[0];
    const e = cent(text(d, "entgelt"));
    const art = text(d, "art");
    const pg = text(d, "personengruppe");
    const vf = SV.vertragsform.find((o) => o.wert === text(d, "vertragsform"));
    const artText = ARTEN.find((a) => a.wert === art)?.text ?? art;
    const pgText = SV.personengruppen.find((o) => o.wert === pg)?.text ?? pg;
    const f: string[] = [];
    if ((art === "minijob" || pg === "109") && grenze && e !== null && e > grenze.cent) f.push(`Entgelt über der Minijob-Grenze von ${euro(grenze.cent)} im Monat`);
    // Widersprüche zwischen den Auswahlen – Hinweise, kein Hindernis
    if (vf && ((art === "teilzeit" && /^Vollzeit/.test(vf.text)) || (art === "vollzeit" && /^Teilzeit/.test(vf.text)))) f.push(`Art „${artText}“ passt nicht zur Vertragsform „${vf.text}“ – bitte prüfen.`);
    if (art === "minijob" && pg && !["109", "110"].includes(pg)) f.push(`Art „Minijob“ mit Personengruppe „${pgText}“ – üblich ist 109 (bzw. 110 bei kurzfristiger Beschäftigung), bitte prüfen.`);
    // 121 sind ebenfalls Auszubildende (mit Entgelt bis zur Geringverdienergrenze)
    if (art === "ausbildung" && pg && !["102", "121"].includes(pg)) f.push(`Art „Ausbildung“ mit Personengruppe „${pgText}“ – für Auszubildende gilt 102 (bzw. 121), bitte prüfen.`);
    return f;
  },
  html(d, b) {
    // Blatt zum Ausfüllen (noch kein Name): Startauswahlen nicht drucken, sondern Linien zum Eintragen
    const leer = !text(d, "name");
    const wahl = (k: string, start: string) => (leer && text(d, k) === start ? "" : text(d, k));
    // Schlüssel der Tätigkeitsschlüssel-Stellen 6, 7 und 9 (Werte der Auswahl) vor dem Text, wie im Meldeverfahren
    const mitSchluessel = (o: { wert: string; text: string } | undefined) => (o ? `${o.wert} – ${o.text}` : "");
    // leeres Blatt ohne Auswahl: die Optionen zum Ankreuzen (Abschlüsse mit Schlüssel); ausgewählt: der Text
    const kreuze = (opts: { wert: string; text: string }[], gewaehlt: string, schluessel: boolean) => {
      const o = opts.find((x) => x.wert === gewaehlt);
      if (o) return schluessel ? mitSchluessel(o) : o.text;
      return leer ? roh(ankreuzen(opts.map((x) => (schluessel ? mitSchluessel(x) : x.text)), { nebeneinander: !schluessel })) : "";
    };
    const beschaeftigung: [string, string | Roh | null][] = [
      ["Beginn", datumDe(text(d, "beginn"))],
      ["Art", kreuze(ARTEN, wahl("art", "vollzeit"), false)],
      ["Wochenstunden", text(d, "stunden")],
      ["Monatliches Entgelt", text(d, "entgelt") ? euro(cent(text(d, "entgelt")) ?? 0) : ""],
      ["Tätigkeit", text(d, "taetigkeit")],
      // Schlüssel des Meldeverfahrens: auf dem leeren Blatt trägt sie der Arbeitgeber ein
      [leer ? "Personengruppe (trägt der Arbeitgeber ein)" : "Personengruppe", SV.personengruppen.find((o) => o.wert === wahl("personengruppe", "101"))?.text ?? ""],
      [leer ? "Vertragsform (trägt der Arbeitgeber ein)" : "Vertragsform", mitSchluessel(SV.vertragsform.find((o) => o.wert === wahl("vertragsform", "1")))],
      ["Schulabschluss", kreuze(SV.schulabschluss, text(d, "schulabschluss"), true)],
      ["Berufsabschluss", kreuze(SV.ausbildung, text(d, "ausbildung"), true)],
      ["Weitere Beschäftigungen", ja(d, "weitere") ? text(d, "weitere_welche") || "ja" : leer ? "" : "keine"],
    ];
    // Geburtsname: ausgefüllt oder auf dem leeren Blatt als Zeile; Feldnummern laufen durch
    const geburtsname = text(d, "geburtsname") || (leer ? "" : null);
    const start = 11 - (geburtsname === null ? 1 : 0);
    // das letzte Feld bleibt mit Erklärung und Unterschrift zusammen (nicht allein auf einer neuen Seite) – mehr
    // Felder schöben den Block samt Feldern auf die Folgeseite und ließen auf Seite 1 eine Lücke
    const teil = beschaeftigung.length - 1;
    return dokument({
      titel: "Personalfragebogen",
      betrieb: b,
      unter: text(d, "name") ? `${text(d, "name")}, Angaben für die Anmeldung zur Sozialversicherung` : "Angaben für die Anmeldung zur Sozialversicherung",
      meta: `Beginn: ${datumDe(text(d, "beginn"))}`,
      inhalt:
        `<p class="klein">Mit diesen Angaben meldet der Arbeitgeber bzw. das Lohnbüro die Beschäftigung bei der Krankenkasse an (DEÜV). Die Schlüssel für Personengruppe, Vertragsform und Abschlüsse sind die des Meldeverfahrens.</p>` +
        abschnitt(
          "Person",
          felder([
            ["Name", text(d, "name")],
            ["Geburtsname (falls abweichend)", geburtsname],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Geburtsort", text(d, "geburtsort")],
            ["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")],
            ["Anschrift", text(d, "anschrift")],
            ["SV-Nummer", svNummerText(text(d, "sv_nummer"))],
            ["Steuer-ID", text(d, "steuer_id")],
            ["Krankenkasse", text(d, "krankenkasse")],
            ["IBAN", ibanText(text(d, "iban"))],
          ]),
        ) +
        abschnitt(
          "Beschäftigung",
          felder(beschaeftigung.slice(0, teil), { start }) +
            `<div class="zusammen">${felder(beschaeftigung.slice(teil), { start: start + teil })}` +
            `<p style="margin-top:4mm">Ich versichere, dass die Angaben vollständig und richtig sind, und teile Änderungen unverzüglich mit.</p>` +
            `${unterschriften(["Beschäftigte Person"], { ortDatum: true })}</div>`,
        ),
    });
  },
};
