/**
 * Personal (E-121): Arbeitszeitnachweis, Lohnkonto, Daten für die Sozialversicherungsmeldung. Amtlos rechnet keine
 * Lohnsteuer und keine Beiträge – die Beträge kommen aus der Lohnabrechnung. Gliederungen fachlich zu prüfen (T-61).
 */
import { abschnitt, absatz, angaben, cent, datumDe, dokument, esc, euro, ja, liste, summe, tabelle, text, unterschriften, zelle } from "./html.js";
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
  const p = Number((pause || "0").replace(",", "."));
  return Math.max(0, (e >= b ? e - b : e + 1440 - b) - (Number.isFinite(p) ? p : 0));
}
export const stunden = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;

function zeiten(d: Daten) {
  const z = liste(d, "tage")
    .filter((x) => text(x, "beginn") || text(x, "ende"))
    .map((x) => ({ x, min: arbeitsminuten(text(x, "beginn"), text(x, "ende"), text(x, "pause")) }));
  return { z, gesamt: z.reduce((a, t) => a + (t.min ?? 0), 0) };
}

export const arbeitszeitnachweis: Vorlage = {
  id: "arbeitszeitnachweis",
  titel: "Arbeitszeitnachweis",
  beschreibung: "Beginn, Ende und Dauer der täglichen Arbeitszeit je Person und Monat – auch für Minijobs. Ausgefüllt oder als Blatt zum Eintragen von Hand.",
  bereich: "personal",
  pflichten: ["personal.arbeitszeit_aufzeichnung", "personal.arbeitszeit_milog"],
  namensFeld: "name",
  abschnitte: [
    {
      felder: [
        { id: "name", art: "text", label: "Name der beschäftigten Person", pflicht: true },
        { id: "monat", art: "text", label: "Monat", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "leerzeilen", art: "schalter", label: "Leere Zeilen zum Eintragen von Hand anhängen", vorbelegung: false },
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
            { id: "beginn", art: "uhrzeit", label: "Beginn", pflicht: true },
            { id: "ende", art: "uhrzeit", label: "Ende", pflicht: true },
            { id: "pause", art: "zahl", label: "Pause (Minuten)" },
            { id: "bemerkung", art: "text", label: "Bemerkung", hilfe: "z. B. Urlaub, krank" },
          ],
        },
      ],
    },
  ],
  ergebnis: (d) => [["Arbeitszeit im Monat", stunden(zeiten(d).gesamt)]],
  html(d, b) {
    const { z, gesamt } = zeiten(d);
    return dokument({
      titel: "Arbeitszeitnachweis",
      betrieb: b,
      unter: [text(d, "name"), text(d, "monat")].filter(Boolean).join(" · ") || undefined,
      inhalt:
        tabelle(
          ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Bemerkung"],
          z.map(({ x, min }) => [datumDe(text(x, "datum")), esc(text(x, "beginn")), esc(text(x, "ende")), esc(text(x, "pause")), min === null ? "" : stunden(min), zelle(text(x, "bemerkung"))]),
          { breiten: ["15%", "12%", "12%", "13%", "13%", "35%"], leerzeilen: ja(d, "leerzeilen") ? 31 - z.length : 0, hoch: ja(d, "leerzeilen") },
        ) +
        angaben([["Summe", stunden(gesamt)]]) +
        unterschriften(["Unterschrift beschäftigte Person", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

const BETRAEGE: [string, string][] = [
  ["brutto", "Bruttolohn"],
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
  pflichten: ["personal.lohnabrechnung", "personal.lohnsteuer_anmeldung"],
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
        { id: "steuerklasse", art: "text", label: "Steuerklasse und Faktor", pflicht: true },
        { id: "kinder", art: "text", label: "Kinderfreibeträge" },
        { id: "religion", art: "text", label: "Religionsgemeinschaft (Kirchensteuer)" },
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
          felder: [{ id: "monat", art: "text", label: "Monat", hilfe: "z. B. Oktober", pflicht: true }, ...BETRAEGE.map(([id, label]) => ({ id, art: "betrag" as const, label: `${label} (€)`, pflicht: id === "brutto" }))],
        },
      ],
    },
  ],
  ergebnis: (d) => [["Brutto im Jahr", euro(summe(liste(d, "monate"), "brutto"))], ["Lohnsteuer im Jahr", euro(summe(liste(d, "monate"), "lohnsteuer"))]],
  html(d, b) {
    const m = liste(d, "monate").filter((x) => text(x, "monat"));
    const betrag = (e: Eintrag, k: string) => (text(e, k) ? euro(cent(text(e, k)) ?? 0) : "");
    return dokument({
      titel: "Lohnkonto",
      betrieb: b,
      unter: [text(d, "name"), text(d, "jahr")].filter(Boolean).join(" · ") || undefined,
      quer: true,
      inhalt:
        abschnitt(
          "Stammdaten",
          angaben([
            ["Name", text(d, "name")],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Anschrift", text(d, "anschrift")],
            ["Steuer-ID", text(d, "steuer_id")],
            ["Steuerklasse", text(d, "steuerklasse")],
            ["Kinderfreibeträge", text(d, "kinder") || null],
            ["Religionsgemeinschaft", text(d, "religion") || null],
            ["SV-Nummer", text(d, "sv_nummer")],
            ["Krankenkasse", text(d, "krankenkasse")],
            ["Beschäftigt seit", datumDe(text(d, "eintritt"))],
          ]),
        ) +
        abschnitt(
          "Monate",
          m.length
            ? tabelle(["Monat", ...BETRAEGE.map(([, l]) => l)], [...m.map((e) => [zelle(text(e, "monat")), ...BETRAEGE.map(([k]) => betrag(e, k))]), ["<strong>Summe</strong>", ...BETRAEGE.map(([k]) => `<strong>${euro(summe(m, k))}</strong>`)]], { breiten: ["12%", ...BETRAEGE.map(() => `${88 / BETRAEGE.length}%`)] })
            : absatz("", "Noch keine Monate erfasst."),
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
  titel: "Personalfragebogen (Daten für die Anmeldung)",
  beschreibung: "Alle Angaben einer neuen beschäftigten Person, die du für die Anmeldung zur Sozialversicherung und die Lohnabrechnung brauchst – zum Unterschreiben.",
  bereich: "personal",
  pflichten: ["personal.sv_anmeldung", "personal.sofortmeldung"],
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Person",
      hilfe: "Die Meldung selbst geht elektronisch über dein Lohnprogramm oder sv.net.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", pflicht: true },
        { id: "geburtsname", art: "text", label: "Geburtsname", hilfe: "falls abweichend" },
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
        { id: "stunden", art: "zahl", label: "Wochenstunden", pflicht: true },
        { id: "entgelt", art: "betrag", label: "Monatliches Entgelt (€)", pflicht: true },
        { id: "taetigkeit", art: "text", label: "Tätigkeit", pflicht: true },
        { id: "abschluss", art: "text", label: "Schul- und Berufsabschluss" },
        { id: "weitere", art: "schalter", label: "Hat weitere Beschäftigungen" },
        { id: "weitere_welche", art: "text", label: "Welche (Arbeitgeber, Umfang)", wenn: { feld: "weitere" }, pflicht: true },
      ],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Personalfragebogen",
      betrieb: b,
      unter: text(d, "name") || undefined,
      inhalt:
        abschnitt(
          "Person",
          angaben([
            ["Name", text(d, "name")],
            ["Geburtsname", text(d, "geburtsname") || null],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Geburtsort", text(d, "geburtsort")],
            ["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")],
            ["Anschrift", text(d, "anschrift")],
            ["SV-Nummer", text(d, "sv_nummer")],
            ["Steuer-ID", text(d, "steuer_id")],
            ["Krankenkasse", text(d, "krankenkasse")],
            ["IBAN", text(d, "iban")],
          ]),
        ) +
        abschnitt(
          "Beschäftigung",
          angaben([
            ["Beginn", datumDe(text(d, "beginn"))],
            ["Art", ARTEN.find((a) => a.wert === text(d, "art"))?.text ?? ""],
            ["Wochenstunden", text(d, "stunden")],
            ["Monatliches Entgelt", text(d, "entgelt") ? euro(cent(text(d, "entgelt")) ?? 0) : ""],
            ["Tätigkeit", text(d, "taetigkeit")],
            ["Schul- und Berufsabschluss", text(d, "abschluss") || null],
            ["Weitere Beschäftigungen", ja(d, "weitere") ? text(d, "weitere_welche") || "ja" : "keine"],
          ]),
        ) +
        `<p style="margin-top:6mm">Ich versichere, dass die Angaben vollständig und richtig sind, und teile Änderungen unverzüglich mit.</p>` +
        unterschriften(["Ort, Datum", "Unterschrift beschäftigte Person"]),
    });
  },
};
