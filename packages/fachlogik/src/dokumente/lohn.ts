/**
 * Personal (E-121): Arbeitszeitnachweis, Lohnkonto, Daten für die Sozialversicherungsmeldung. Amtlos rechnet keine
 * Lohnsteuer und keine Beiträge – die Beträge kommen aus der Lohnabrechnung. Gliederungen fachlich zu prüfen (T-61).
 */
import { abschnitt, absatz, angaben, cent, datumDe, dokument, esc, euro, felder, ja, liste, nachsatz, summe, tabelle, text, unterschriften, zelle } from "./html.js";
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
  person: { art: "mitarbeiter", felder: { name: "name" } },
  grundlage: "§ 3 Abs. 2 Nr. 1 ArbSchG (BAG 13.09.2022 – 1 ABR 22/21); § 17 MiLoG",
  namensFeld: "name",
  abschnitte: [
    { titel: "Person und Monat",
      felder: [
        { id: "name", art: "text", label: "Name der beschäftigten Person", pflicht: true },
        { id: "monat", art: "text", label: "Monat", hilfe: "z. B. Oktober 2026", pflicht: true },
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
            { id: "beginn", art: "uhrzeit", label: "Beginn", pflicht: true },
            { id: "ende", art: "uhrzeit", label: "Ende", pflicht: true },
            { id: "pause", art: "zahl", label: "Pause (Minuten)" },
            { id: "bemerkung", selten: true, art: "text", label: "Bemerkung", hilfe: "z. B. Urlaub, krank" },
          ],
        },
      ],
    },
  ],
  ergebnis: (d) => [["Arbeitszeit im Monat", stunden(zeiten(d).gesamt)]],
  html(d, b) {
    const { z, gesamt } = zeiten(d);
    // ohne Einträge: Blatt zum Eintragen von Hand – eine hohe Zeile je Tag, keine Summe „0:00 h“
    const leer = !z.length;
    const leerzeilen = leer ? 31 : ja(d, "leerzeilen") ? 31 - z.length : 0;
    return dokument({
      titel: "Arbeitszeitnachweis",
      betrieb: b,
      unter: [text(d, "name"), text(d, "monat")].filter(Boolean).join(", ") || undefined,
      meta: `Beschäftigte Person: ${text(d, "name")}\nMonat: ${text(d, "monat")}`,
      inhalt:
        tabelle(
          ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Bemerkung"],
          z.map(({ x, min }) => [datumDe(text(x, "datum")), esc(text(x, "beginn")), esc(text(x, "ende")), esc(text(x, "pause")), min === null ? "" : stunden(min), zelle(text(x, "bemerkung"))]),
          { breiten: ["15%", "12%", "12%", "13%", "13%", "35%"], leerzeilen, hoch: leer || ja(d, "leerzeilen"), zahlen: [3, 4], ...(leer ? {} : { summe: ["<strong>Summe</strong>", "", "", "", `<strong>${stunden(gesamt)}</strong>`, ""] }) },
        ) +
        `<p class="nachsatz">Für Minijobs und die Branchen nach § 2a SchwarzArbG (u. a. Gastronomie, Friseur- und Kosmetikgewerbe, Bau): Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens bis zum Ablauf des siebten auf den Arbeitstag folgenden Kalendertages aufzeichnen und mindestens zwei Jahre aufbewahren (§ 17 Abs. 1 MiLoG).</p>` +
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
        { id: "steuerklasse", art: "wahl", label: "Steuerklasse", optionen: STEUERKLASSEN, pflicht: true },
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
    const betrag = (e: Eintrag, k: string) => (text(e, k) ? euro(cent(text(e, k)) ?? 0) : "");
    return dokument({
      titel: "Lohnkonto",
      betrieb: b,
      unter: [text(d, "name"), text(d, "jahr")].filter(Boolean).join(" · ") || undefined,
      quer: true,
      inhalt:
        // Querformat: Stammdaten in zwei Spalten, damit die Monate möglichst auf Seite 1 beginnen
        abschnitt(
          "Stammdaten",
          // einzeilige Angaben zuerst, damit die Zeilen beider Spalten auf einer Höhe stehen; mehrzeilige bzw. entfallende am Ende
          `<div class="spalten2">${angaben([
            ["Name", text(d, "name")],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Beschäftigt seit", datumDe(text(d, "eintritt"))],
            ["Krankenkasse", text(d, "krankenkasse")],
            ["Anschrift", text(d, "anschrift")],
          ])}${angaben([
            ["Steuer-ID", text(d, "steuer_id")],
            ["Steuerklasse", text(d, "steuerklasse")],
            ["SV-Nummer", text(d, "sv_nummer")],
            ["Kinderfreibeträge", text(d, "kinder") || null],
            ["Kirchensteuermerkmal", text(d, "religion") || null],
          ])}</div>`,
        ) +
        abschnitt(
          "Monate",
          m.length
            ? tabelle(["Zeitraum", "Zahltag", ...BETRAEGE.map(([, l]) => l), "U*"], m.map((e) => [zelle(text(e, "monat")), datumDe(text(e, "zahltag")), ...BETRAEGE.map(([k]) => betrag(e, k)), ja(e, "unterbrechung") ? "U" : ""]), { summe: ["<strong>Summe</strong>", "", ...BETRAEGE.map(([k]) => `<strong>${euro(summe(m, k))}</strong>`), ""], breiten: ["10%", "8%", ...BETRAEGE.map(() => `${79 / BETRAEGE.length}%`), "3%"], zahlen: BETRAEGE.map((_, i) => i + 2), klasse: "eng" }) + nachsatz("* U = Unterbrechung ohne Lohnanspruch (§ 41 Abs. 1 EStG)")
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
    return (text(d, "art") === "minijob" || text(d, "personengruppe") === "109") && grenze && e !== null && e > grenze.cent ? [`Entgelt über der Minijob-Grenze von ${euro(grenze.cent)} im Monat`] : [];
  },
  html(d, b) {
    const beschaeftigung: [string, string | null][] = [
      ["Beginn", datumDe(text(d, "beginn"))],
      ["Art", ARTEN.find((a) => a.wert === text(d, "art"))?.text ?? ""],
      ["Wochenstunden", text(d, "stunden")],
      ["Monatliches Entgelt", text(d, "entgelt") ? euro(cent(text(d, "entgelt")) ?? 0) : ""],
      ["Tätigkeit", text(d, "taetigkeit")],
      ["Personengruppe", SV.personengruppen.find((o) => o.wert === text(d, "personengruppe"))?.text ?? ""],
      ["Vertragsform", SV.vertragsform.find((o) => o.wert === text(d, "vertragsform"))?.text ?? ""],
      ["Schulabschluss", SV.schulabschluss.find((o) => o.wert === text(d, "schulabschluss"))?.text ?? ""],
      ["Berufsabschluss", SV.ausbildung.find((o) => o.wert === text(d, "ausbildung"))?.text ?? ""],
      ["Weitere Beschäftigungen", ja(d, "weitere") ? text(d, "weitere_welche") || "ja" : "keine"],
    ];
    const start = 11 - (text(d, "geburtsname") ? 0 : 1);
    // die letzten drei Felder bleiben mit Erklärung und Unterschrift zusammen (nicht allein auf einer neuen Seite)
    const teil = beschaeftigung.length - 3;
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
          felder(beschaeftigung.slice(0, teil), { start }) +
            `<div class="zusammen">${felder(beschaeftigung.slice(teil), { start: start + teil })}` +
            `<p style="margin-top:6mm">Ich versichere, dass die Angaben vollständig und richtig sind, und teile Änderungen unverzüglich mit.</p>` +
            `${unterschriften(["Beschäftigte Person"], { ortDatum: true })}</div>`,
        ),
    });
  },
};
