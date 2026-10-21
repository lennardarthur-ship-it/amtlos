/**
 * Datenschutz: Verzeichnis der Verarbeitungstätigkeiten mit TOM, Datenpanne, Datenschutzinformation nach Art. 13
 * (E-121, E-123). Vorschläge aus Muster-Verzeichnissen der Aufsichtsbehörden, DSK und BSI (bausteine.ts).
 */
import { AUFSICHT, DSE, PANNEN_ARTEN, PANNEN_SOFORT, TOM, VVT } from "./bausteine.js";
import { LINIE_MITTEL, abschnitt, abschnitte, absatz, angaben, ankreuzen, anschrift, auswahl, datumDe, dokument, eintrag, esc, ja, liste, nachsatz, roh, tabelle, text, unterschriften, zelle, zeilen } from "./html.js";
import { DATENPANNE_RISIKO, SCHUTZZIELE, optionen } from "./konstanten.js";
import type { Betrieb, Vorlage } from "./typen.js";

export const BUNDESLAENDER = AUFSICHT.map((a) => a.land);
/** Zuständige Datenschutz-Aufsichtsbehörde für nicht-öffentliche Stellen nach Bundesland (DSK-Liste). */
export const aufsichtFuer = (b: Betrieb) => AUFSICHT.find((a) => a.land === b.bundesland);

const RECHTSGRUNDLAGEN = [
  "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)",
  "Art. 6 Abs. 1 lit. b DSGVO (Vertrag oder vorvertragliche Maßnahmen)",
  "Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung)",
  "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)",
  // § 26 Abs. 1 BDSG ist nach EuGH C-34/21 keine tragfähige eigene Grundlage (R10) – Beschäftigtendaten über lit. b und c
  "Art. 6 Abs. 1 lit. b und c DSGVO (Beschäftigungsverhältnis)",
  "Art. 9 Abs. 2 lit. a DSGVO (ausdrückliche Einwilligung bei Gesundheitsdaten)",
];
/** Früher gespeicherte Rechtsgrundlage (bis R10) → heutige Fassung; ältere Verzeichnisse drucken so die neue. */
const RECHTSGRUNDLAGE_FRUEHER: Record<string, string> = { "Art. 88 DSGVO i. V. m. § 26 BDSG (Beschäftigungsverhältnis)": "Art. 6 Abs. 1 lit. b und c DSGVO (Beschäftigungsverhältnis)" };
export const rechtsgrundlageNeu = (t: string) =>
  t
    .split("\n")
    .map((z) => RECHTSGRUNDLAGE_FRUEHER[z.trim()] ?? z)
    .join("\n");
const BETROFFENE = ["Kundinnen und Kunden", "Interessenten", "Beschäftigte", "Bewerberinnen und Bewerber", "Lieferanten und Dienstleister", "Besucherinnen und Besucher der Website"];
const LOESCHFRISTEN = [
  "Buchungsbelege und Rechnungen: 8 Jahre (§ 147 AO, § 257 HGB), ab Ende des Kalenderjahres",
  "Handels- und Geschäftsbriefe: 6 Jahre (§ 147 AO, § 257 HGB), ab Ende des Kalenderjahres",
  "Bücher, Inventare, Jahresabschlüsse: 10 Jahre (§ 147 AO, § 257 HGB)",
  "Löschung nach Wegfall des Zwecks (Art. 17 Abs. 1 lit. a DSGVO)",
];
/** Verweis auf den Abschnitt mit den TOM – im Verzeichnis Abschnitt 3 (nach „Verantwortlicher“ und „Verarbeitungstätigkeiten“). */
const TOM_VERWEIS = "siehe Abschnitt 3 „Technische und organisatorische Maßnahmen“";
const DIENSTLEISTUNGEN = ["Website-Hosting", "E-Mail-Anbieter", "Online-Terminbuchung", "Kassensystem", "Cloud-Speicher", "Lohnabrechnung (Lohnbüro)", "IT-Betreuung"];

export const datenschutzDokumentation: Vorlage = {
  id: "datenschutz_dokumentation",
  gestalt: "handbuch",
  titel: "Verzeichnis der Verarbeitungstätigkeiten mit TOM",
  beschreibung: "Welche Daten über Menschen du wofür verarbeitest, wie du sie schützt (TOM) und welche Dienstleister beteiligt sind – mit Vorschlägen aus Muster-Verzeichnissen der Aufsichtsbehörden.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.vvt", "datenschutz.tom"],
  grundlage: "Art. 30 Abs. 1, Art. 32 DSGVO",
  abschnitte: [
    { titel: "Verantwortlich",
      felder: [
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
        { id: "verantwortlich", art: "text", label: "Ansprechperson Datenschutz", vorbelegung: "verantwortlich", pflicht: true },
        { id: "dsb", selten: true, art: "text", label: "Datenschutzbeauftragte/r", hilfe: "nur falls benannt: Name und Kontakt" },
      ],
    },
    {
      titel: "Verarbeitungstätigkeiten",
      hilfe: "Wähle aus, was bei dir vorkommt, und passe die Angaben an deinen Betrieb an.",
      felder: [
        {
          id: "verarbeitungen",
          art: "liste",
          label: "Verarbeitungstätigkeiten",
          eintrag: "Verarbeitung",
          titelFeld: "bezeichnung",
          pflicht: true,
          leerStarten: true,
          vorschlaege: VVT,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung", pflicht: true },
            { id: "zweck", art: "mehrzeilig", label: "Zwecke der Verarbeitung", pflicht: true },
            { id: "rechtsgrundlage", art: "mehrzeilig", label: "Rechtsgrundlage", pflicht: true, vorschlaege: RECHTSGRUNDLAGEN },
            { id: "betroffene", art: "text", label: "Kategorien betroffener Personen", pflicht: true, vorschlaege: BETROFFENE },
            { id: "datenarten", art: "mehrzeilig", label: "Kategorien personenbezogener Daten", pflicht: true },
            { id: "empfaenger", art: "mehrzeilig", label: "Kategorien von Empfängern" },
            { id: "drittland", selten: true, art: "text", label: "Übermittlung in Drittländer", vorschlaege: ["keine Übermittlung in Drittländer"] },
            { id: "gemeinsam", selten: true, art: "text", label: "Gemeinsam Verantwortliche (Art. 26 DSGVO)", hilfe: "nur falls zutreffend, z. B. Betreiber einer Social-Media-Plattform" },
            { id: "loeschfrist", art: "mehrzeilig", label: "Fristen für die Löschung", pflicht: true, vorschlaege: LOESCHFRISTEN },
            { id: "tom_hinweis", art: "text", label: "Technische und organisatorische Maßnahmen", vorschlaege: [TOM_VERWEIS] },
          ],
        },
      ],
    },
    {
      titel: "Technische und organisatorische Maßnahmen (TOM)",
      hilfe: "Maßnahmen nach Art. 32 DSGVO, vorbereitet aus BSI IT-Grundschutz und Mustern der Aufsichtsbehörden.",
      felder: [
        {
          id: "tom",
          art: "liste",
          label: "Maßnahmen",
          eintrag: "Maßnahme",
          titelFeld: "massnahme",
          pflicht: true,
          leerStarten: true,
          vorschlaege: TOM,
          gruppenLabel: "Schutzziel",
          felder: [
            { id: "massnahme", art: "mehrzeilig", label: "Maßnahme", pflicht: true },
            { id: "schutzziel", art: "wahl", label: "Schutzziel", optionen: optionen(SCHUTZZIELE), vorbelegung: "vertraulichkeit" },
            { id: "umgesetzt_am", art: "datum", label: "Umgesetzt am", hilfe: "leer lassen, wenn noch geplant" },
            { id: "verantwortlich", art: "text", label: "Verantwortlich" },
          ],
        },
      ],
    },
    {
      titel: "Dienstleister",
      hilfe: "Wer für dich Daten verarbeitet. Steuerberatung ist in der Regel selbst verantwortlich und braucht keinen Vertrag zur Auftragsverarbeitung.",
      felder: [
        {
          id: "dienstleister",
          art: "liste",
          label: "Dienstleister",
          eintrag: "Dienstleister",
          titelFeld: "name",
          leerStarten: true,
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "leistung", art: "text", label: "Leistung", vorschlaege: DIENSTLEISTUNGEN },
            { id: "auftragsverarbeitung", art: "schalter", label: "Verarbeitet Daten in meinem Auftrag", vorbelegung: true },
            { id: "avv_vorhanden", art: "schalter", label: "Vertrag zur Auftragsverarbeitung liegt vor", wenn: { feld: "auftragsverarbeitung" } },
            { id: "avv_datum", art: "datum", label: "Vertrag vom", wenn: { feld: "avv_vorhanden" } },
            { id: "drittland", selten: true, art: "text", label: "Drittland", vorschlaege: ["keine Übermittlung in Drittländer"] },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const v = liste(d, "verarbeitungen").filter((x) => text(x, "bezeichnung"));
    const tom = liste(d, "tom").filter((x) => text(x, "massnahme"));
    const dl = liste(d, "dienstleister").filter((x) => text(x, "name"));
    // leeres Verzeichnis (nichts erfasst): Blatt zum Ausfüllen mit Zeilen und Tabellen statt „Keine … erfasst.“
    const leer = !v.length && !tom.length && !dl.length;
    const verarbeitungen = v.length
      ? v
          .map(
            (x, i) =>
              eintrag(text(x, "bezeichnung"), angaben([
                ["Zwecke (lit. b)", text(x, "zweck"), 2],
                ["Rechtsgrundlage", rechtsgrundlageNeu(text(x, "rechtsgrundlage"))],
                ["Betroffene Personen (lit. c)", text(x, "betroffene")],
                ["Datenkategorien (lit. c)", text(x, "datenarten"), 2],
                ["Empfänger (lit. d)", text(x, "empfaenger") || "keine"],
                ["Drittlandübermittlung (lit. e)", text(x, "drittland") || "keine"],
                ["Gemeinsam Verantwortliche", text(x, "gemeinsam") || null],
                ["Löschfristen (lit. f)", text(x, "loeschfrist"), 2],
                ["TOM (lit. g)", text(x, "tom_hinweis") || TOM_VERWEIS],
              ]), { nummer: `2.${i + 1}`, rand: "Art. 30 Abs. 1 lit. b–g" }),
          )
          .join("")
      : leer
        ? // Blatt zum Ausfüllen: drei leere Verarbeitungstätigkeiten (2.1–2.3), mehrzeilige Angaben mit zwei Linien
          [1, 2, 3].map((i) => eintrag("Bezeichnung der Verarbeitung", angaben([["Bezeichnung", ""], ["Zwecke (lit. b)", "", 2], ["Rechtsgrundlage", ""], ["Betroffene Personen (lit. c)", ""], ["Datenkategorien (lit. c)", "", 2], ["Empfänger (lit. d)", ""], ["Drittlandübermittlung (lit. e)", ""], ["Löschfristen (lit. f)", "", 2], ["TOM (lit. g)", TOM_VERWEIS]]), { nummer: `2.${i}`, rand: "Art. 30 Abs. 1 lit. b–g" })).join("")
        : absatz("", "Keine Verarbeitungstätigkeiten erfasst.");
    // Spalte „Verantwortlich“ nur, wenn mindestens eine Maßnahme eine verantwortliche Person nennt
    const mitVerantwortlich = tom.some((x) => text(x, "verantwortlich"));
    const massnahmen = tom.length
      ? Object.entries(SCHUTZZIELE)
          .map(([ziel, titel]) => {
            const l = tom.filter((x) => (text(x, "schutzziel") || "sonstiges") === ziel);
            if (!l.length) return "";
            const zeilenTom = l.map((m) => [zelle(text(m, "massnahme")), text(m, "umgesetzt_am") ? `umgesetzt ${datumDe(text(m, "umgesetzt_am"))}` : "geplant", ...(mitVerantwortlich ? [zelle(text(m, "verantwortlich"))] : [])]);
            return `<h3>${esc(titel)}</h3>${tabelle(["Maßnahme", "Stand", ...(mitVerantwortlich ? ["Verantwortlich"] : [])], zeilenTom, { breiten: mitVerantwortlich ? ["62%", "18%", "20%"] : ["80%", "20%"] })}`;
          })
          .join("")
      : leer
        ? tabelle(["Schutzziel", "Maßnahme", "Stand", "Verantwortlich"], [], { breiten: ["20%", "46%", "16%", "18%"], mindestens: 6, hoch: true })
        : absatz("", "Keine Maßnahmen erfasst.");
    const dienstleister = dl.length
      ? tabelle(
          ["Dienstleister", "Leistung", "Auftragsverarbeitung (Art. 28 DSGVO)", "Drittland"],
          dl.map((x) => [`<strong>${zelle(text(x, "name"))}</strong>`, zelle(text(x, "leistung")), ja(x, "auftragsverarbeitung") ? (ja(x, "avv_vorhanden") ? `Vertrag liegt vor${text(x, "avv_datum") ? ` (vom ${datumDe(text(x, "avv_datum"))})` : ""}` : "<strong>Vertrag fehlt</strong>") : "nein (eigenständig verantwortlich)", zelle(text(x, "drittland")) || "keine"]),
          { breiten: ["24%", "26%", "32%", "18%"] },
        )
      : leer
        ? tabelle(["Dienstleister", "Leistung", "Auftragsverarbeitung (Art. 28 DSGVO)", "Drittland"], [], { breiten: ["24%", "26%", "32%", "18%"], mindestens: 4, hoch: true })
        : absatz("", "Keine Dienstleister erfasst.");
    return dokument({
      titel: "Verzeichnis der Verarbeitungstätigkeiten",
      betrieb: b,
      unter: "nach Art. 30 Abs. 1 DSGVO, mit technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO",
      meta: `Stand: ${datumDe(text(d, "stand"))}\nAnsprechperson: ${text(d, "verantwortlich")}${v.length ? `\nVerarbeitungen: ${v.length}` : ""}`,
      inhalt:
        abschnitt(
          "Verantwortlicher",
          angaben([
            ["Verantwortlicher", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")],
            ["Kontakt", [b.telefon, b.email].filter((x) => x.trim()).join(", ")],
            ["Ansprechperson Datenschutz", text(d, "verantwortlich")],
            ["Datenschutzbeauftragte/r", text(d, "dsb") || "nicht benannt"],
          ]),
          { rand: "Art. 30 Abs. 1 lit. a DSGVO" },
        ) +
        abschnitt("Verarbeitungstätigkeiten", verarbeitungen, { rand: "Art. 30 Abs. 1 DSGVO" }) +
        abschnitt("Technische und organisatorische Maßnahmen", massnahmen, { rand: "Art. 32 DSGVO" }) +
        abschnitt("Dienstleister und Auftragsverarbeiter", dienstleister, { rand: "Art. 28 DSGVO" }) +
        nachsatz("Das Verzeichnis wird bei Änderungen der Verarbeitungen und mindestens jährlich überprüft."),
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

/** ISO-Datum plus Tage (Kalendertage), wieder als ISO-Datum. */
function plusTageIso(iso: string, tage: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

/** Zeitpunkt in Berliner Ortszeit als „TT.MM.JJJJ, HH:MM Uhr“. */
export function berlinText(t: Date): string {
  return `${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t)} Uhr`;
}

const BENACHRICHTIGUNG: Record<string, string> = { nicht_erforderlich: "nicht erforderlich (kein hohes Risiko)", erfolgt: "erfolgt", geplant: "geplant" };

export const datenpanne: Vorlage = {
  id: "datenpanne",
  titel: "Datenpanne: Dokumentation und Meldeentwurf",
  beschreibung: "Alles, was bei einer Datenpanne festzuhalten ist – als Dokumentation und als Vorlage für die Meldung an die Aufsichtsbehörde.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.datenpanne_meldung"],
  grundlage: "Art. 33, 34 DSGVO",
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
        { id: "beschreibung", art: "mehrzeilig", label: "Art der Verletzung", hilfe: "Was ist passiert? Typische Fälle zum Antippen, danach ergänzen.", pflicht: true, vorschlaege: PANNEN_ARTEN.map((o) => o.text) },
        { id: "datenarten", art: "mehrzeilig", label: "Betroffene Datenarten", pflicht: true },
        { id: "betroffene_anzahl", art: "text", label: "Betroffene Personen und Datensätze (ungefähre Zahl)", pflicht: true },
        { id: "folgen", art: "mehrzeilig", label: "Wahrscheinliche Folgen", pflicht: true },
        { id: "massnahmen", art: "mehrzeilig", label: "Ergriffene und geplante Maßnahmen", pflicht: true, vorschlaege: PANNEN_SOFORT.map((o) => o.text) },
        { id: "kontakt", art: "text", label: "Kontakt für Rückfragen", vorbelegung: "betrieb_kontakt", pflicht: true },
      ],
    },
    {
      titel: "Bewertung und Meldung",
      felder: [
        { id: "risiko", art: "wahl", label: "Bewertung", optionen: optionen(DATENPANNE_RISIKO) },
        { id: "begruendung", art: "mehrzeilig", label: "Begründung, warum keine Meldung nötig ist", wenn: { feld: "risiko", ist: "kein_risiko" }, pflicht: true },
        { id: "gemeldet", art: "schalter", label: "Bereits gemeldet", wenn: { feld: "risiko", ist: ["risiko", "hohes_risiko"] } },
        { id: "gemeldet_am", art: "datum", label: "Gemeldet am", wenn: { feld: "gemeldet" } },
        { id: "aktenzeichen", art: "text", label: "Aktenzeichen der Behörde", wenn: { feld: "gemeldet" } },
        { id: "verspaetung", art: "mehrzeilig", label: "Begründung, falls die Meldung später als 72 Stunden erfolgt", wenn: { feld: "gemeldet" } },
        { id: "benachrichtigung", art: "wahl", label: "Benachrichtigung der betroffenen Personen (Art. 34 DSGVO)", optionen: optionen(BENACHRICHTIGUNG) },
        { id: "benachrichtigt_am", art: "datum", label: "Benachrichtigt am", wenn: { feld: "benachrichtigung", ist: "erfolgt" } },
        { id: "benachrichtigung_text", art: "mehrzeilig", label: "Wie und mit welchem Inhalt benachrichtigt wurde", wenn: { feld: "benachrichtigung", ist: "erfolgt" } },
      ],
    },
  ],
  html(d, b) {
    const beginn = berlinZuUtc(text(d, "entdeckt_am"), text(d, "entdeckt_um"));
    const risiko = text(d, "risiko");
    // „Bereits gemeldet“ gibt es nur bei Risiko bzw. hohem Risiko
    const gemeldet = ja(d, "gemeldet") && (risiko === "risiko" || risiko === "hohes_risiko");
    const benachrichtigt = text(d, "benachrichtigung") === "erfolgt";
    // kein Risiko: keine Meldepflicht – reine Dokumentation, ohne 72-Stunden-Frist
    const keinRisiko = risiko === "kein_risiko";
    // Blatt zum Ausfüllen von Hand (noch nichts beschrieben): Bewertung, Meldung und Benachrichtigung zum Ankreuzen
    const leer = !text(d, "beschreibung");
    const uhrzeit = text(d, "entdeckt_um");
    // Gliederung wie der Mindestinhalt der Meldung nach Art. 33 Abs. 3 DSGVO (lit. a–d), Randspalte nennt den Buchstaben
    const teile: [string, string, string][] = [
      ["Art der Verletzung", text(d, "beschreibung"), "Art. 33 Abs. 3 lit. a"],
      ["Kategorien der Daten", text(d, "datenarten"), "Art. 33 Abs. 3 lit. a"],
      ["Betroffene Personen und Datensätze (ungefähre Zahl)", text(d, "betroffene_anzahl"), "Art. 33 Abs. 3 lit. a"],
      ["Kontakt für Rückfragen", text(d, "kontakt"), "Art. 33 Abs. 3 lit. b"],
      ["Wahrscheinliche Folgen", text(d, "folgen"), "Art. 33 Abs. 3 lit. c"],
      ["Ergriffene und vorgeschlagene Maßnahmen", text(d, "massnahmen"), "Art. 33 Abs. 3 lit. d"],
    ];
    const offen = !DATENPANNE_RISIKO[risiko];
    const benachrichtigung = text(d, "benachrichtigung");
    return dokument({
      titel: keinRisiko ? "Datenpanne – Dokumentation" : gemeldet ? "Meldung einer Datenpanne (Dokumentation)" : "Datenpanne – Meldeentwurf und Dokumentation",
      betrieb: b,
      meta: `Bekannt seit: ${datumDe(text(d, "entdeckt_am")) || "–"}`,
      inhalt:
        angaben([
          // ohne Uhrzeit keine erfundene „00:00 Uhr“: das Datum und eine kurze Linie für die Uhrzeit; die Frist endet drei
          // Tage später zur selben Uhrzeit
          ["Bekannt geworden", beginn && uhrzeit ? berlinText(beginn) : roh(`${datumDe(text(d, "entdeckt_am")) ? `${esc(datumDe(text(d, "entdeckt_am")))}, ` : `${LINIE_MITTEL}, `}${LINIE_MITTEL} Uhr`)],
          ["Frist (72 Stunden)", keinRisiko ? null : beginn ? (uhrzeit ? berlinText(new Date(beginn.getTime() + 72 * 3600_000)) : `${datumDe(plusTageIso(text(d, "entdeckt_am"), 3))}, zur Uhrzeit des Bekanntwerdens (Uhrzeit ergänzen)`) : ""],
          ["Bewertung", leer && offen ? roh(ankreuzen(Object.values(DATENPANNE_RISIKO))) : (DATENPANNE_RISIKO[risiko] ?? "noch offen")],
          // kein Risiko: die Begründung gehört zur Bewertung (Art. 33 Abs. 1 Satz 1 DSGVO)
          ["Begründung, warum keine Meldung nötig ist", keinRisiko ? text(d, "begruendung") : null, 2],
          [
            "Gemeldet",
            keinRisiko
              ? "nicht erforderlich (keine Meldepflicht)"
              : gemeldet
                ? `${datumDe(text(d, "gemeldet_am")) || "ja"}${text(d, "aktenzeichen") ? ` · Aktenzeichen ${text(d, "aktenzeichen")}` : ""}`
                : leer
                  ? roh(ankreuzen(["noch nicht gemeldet", `gemeldet am ${LINIE_MITTEL} · Aktenzeichen ${LINIE_MITTEL}`, "nicht erforderlich (keine Meldepflicht)"], { html: true }))
                  : "noch nicht gemeldet",
          ],
          ["Begründung der späteren Meldung", (gemeldet && text(d, "verspaetung")) || null],
          // Datum und Inhalt nur bei erfolgter Benachrichtigung (nicht an „nicht erforderlich“ oder „geplant“ angehängt)
          [
            "Benachrichtigung der Betroffenen",
            leer && !BENACHRICHTIGUNG[benachrichtigung]
              ? roh(ankreuzen(Object.entries(BENACHRICHTIGUNG).map(([w, t]) => (w === "erfolgt" ? `${esc(t)} am ${LINIE_MITTEL}` : esc(t))), { html: true }))
              : `${BENACHRICHTIGUNG[benachrichtigung] ?? "noch offen"}${benachrichtigt && text(d, "benachrichtigt_am") ? ` am ${datumDe(text(d, "benachrichtigt_am"))}` : ""}${benachrichtigt && text(d, "benachrichtigung_text") ? ` – ${text(d, "benachrichtigung_text")}` : ""}`,
          ],
        ]) +
        teile.map(([t, w, rand]) => abschnitt(t, absatz(w), { rand })).join("") +
        unterschriften(["Ort, Datum", "Dokumentiert von"]),
    });
  },
};

const BEREITSTELLUNG: Record<string, string> = {
  vertrag: "Die Bereitstellung der Daten ist für den Abschluss und die Durchführung des Vertrags erforderlich. Ohne diese Daten können wir den Vertrag nicht abschließen oder durchführen.",
  gesetz: "Die Bereitstellung der Daten ist teilweise gesetzlich vorgeschrieben (z. B. für Steuer und Sozialversicherung) und im Übrigen für die Durchführung des Vertrags erforderlich. Ohne diese Daten können wir unsere gesetzlichen Pflichten nicht erfüllen und das Vertragsverhältnis nicht durchführen.",
  freiwillig: "Die Bereitstellung der Daten ist freiwillig. Ohne die Daten können wir das jeweilige Angebot nicht oder nur eingeschränkt bereitstellen.",
};
/** R11 (Kosmetik #20, #24): Verarbeitungen mit eigenen Zusätzen in der Datenschutzinformation */
const GESUNDHEIT = "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)";
const TERMIN = "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)";
/** Online-Terminbuchung: reines Werkzeug im Auftrag oder Plattform, bei der Kundschaft ein eigenes Konto hat */
const BUCHUNG: Record<string, string> = { tool: "Reines Buchungstool (Auftragsverarbeiter)", plattform: "Plattform mit eigenem Kundenkonto (eigene Verantwortung der Plattform)" };
const BUCHUNG_PLATTFORM_EMPFAENGER = "Betreiber der Buchungsplattform – haben Kundinnen und Kunden dort ein eigenes Konto, verarbeitet er die Daten auch in eigener Verantwortung (siehe dessen Datenschutzhinweise)";
const GESUNDHEIT_FREIWILLIG = "Ausgenommen sind Angaben zur Gesundheit (z. B. Allergien): Ihre Angabe ist freiwillig; wir verarbeiten sie nur mit Ihrer ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die Sie jederzeit widerrufen können (Art. 7 Abs. 3 DSGVO).";

/** Stützt sich eine der gewählten Verarbeitungen auf berechtigte Interessen? */
const mitLitF = (d: Parameters<Vorlage["html"]>[0]) => auswahl(d, "verarbeitungen").some((t) => /lit\. f/.test(String(VVT.find((v) => v.titel === t)?.werte.rechtsgrundlage ?? "")));
const ZIELGRUPPE = ["Kundinnen und Kunden", "Beschäftigte", "Bewerberinnen und Bewerber", "Lieferanten und Geschäftspartner"];

export const datenschutzinformation: Vorlage = {
  id: "datenschutzinformation",
  gestalt: "handbuch",
  titel: "Datenschutzinformation (Art. 13 DSGVO)",
  beschreibung: "Informationsblatt für Kundschaft, Beschäftigte oder Bewerbende – Verarbeitungen ankreuzen, Zwecke, Rechtsgrundlagen und Speicherdauer kommen automatisch.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.informationspflichten"],
  grundlage: "Art. 13 DSGVO",
  namensFeld: "fuer_wen",
  abschnitte: [
    { titel: "Inhalt der Information",
      felder: [
        { id: "fuer_wen", art: "text", label: "Für wen", pflicht: true, vorschlaege: ZIELGRUPPE },
        { id: "verarbeitungen", art: "bausteine", label: "Welche Verarbeitungen betreffen diese Personen?", optionen: VVT.map((v) => ({ wert: v.titel, text: v.titel, quelle: v.quelle })), pflicht: true },
        { id: "dsb", selten: true, art: "text", label: "Datenschutzbeauftragte/r", hilfe: "nur falls benannt: Name und Kontakt" },
        { id: "buchung", art: "wahl", label: "Online-Terminbuchung", optionen: optionen(BUCHUNG), vorbelegung: "tool", wenn: { feld: "verarbeitungen", ist: TERMIN }, hilfe: "Haben deine Kundinnen und Kunden bei der Buchungsplattform ein eigenes Konto, ist die Plattform oft selbst verantwortlich – bitte im Vertrag bzw. bei der Plattform prüfen." },
        { id: "interessen", art: "mehrzeilig", label: "Berechtigte Interessen", hilfe: "nötig, wenn eine Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO beruht – z. B. Schutz vor Diebstahl, Durchsetzung von Ansprüchen, sichere IT", vorschlaege: ["Sicherer und störungsfreier Betrieb unserer IT", "Durchsetzung und Abwehr von Ansprüchen", "Schutz vor Diebstahl und Vandalismus (Videoüberwachung)", "Information unserer Bestandskundschaft über eigene Angebote"] },
        { id: "bereitstellung", art: "wahl", label: "Pflicht zur Bereitstellung der Daten", optionen: optionen(BEREITSTELLUNG), vorbelegung: "vertrag" },
        { id: "ergaenzung", selten: true, art: "mehrzeilig", label: "Ergänzungen", hilfe: "z. B. besondere Verarbeitungen in deinem Betrieb" },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  pruefen: (d, b) => [
    ...(b.bundesland ? [] : ["Bundesland (Mein Betrieb) – für die zuständige Aufsichtsbehörde"]),
    ...(b.email.trim() ? [] : ["E-Mail (Mein Betrieb)"]),
    ...(mitLitF(d) && !text(d, "interessen") ? ["Berechtigte Interessen (bei Art. 6 Abs. 1 lit. f DSGVO)"] : []),
    // gewählte Verarbeitungen, die es (z. B. nach einer Umbenennung) nicht mehr gibt, fielen sonst stillschweigend weg
    ...auswahl(d, "verarbeitungen").filter((t) => !VVT.some((v) => v.titel === t)).map((t) => `Verarbeitung „${t}“ gibt es nicht mehr – bitte neu auswählen`),
  ],
  html(d, b) {
    const gewaehlt = auswahl(d, "verarbeitungen").map((t) => VVT.find((v) => v.titel === t)).filter((v): v is (typeof VVT)[number] => Boolean(v));
    const a = aufsichtFuer(b);
    const ersetze = (t: string) => t.replace(/\{email\}/g, b.email.trim() || "____").replace(/\{link_einstellungen\}/g, "die angegebenen Kontaktwege");
    return dokument({
      titel: "Information zur Datenverarbeitung",
      betrieb: b,
      unter: text(d, "fuer_wen") ? `für ${text(d, "fuer_wen")} nach Art. 13 DSGVO` : "nach Art. 13 DSGVO",
      meta: `Stand: ${datumDe(text(d, "stand"))}`,
      inhalt: abschnitte([
        { titel: "Verantwortlicher", rand: "Art. 13 Abs. 1 lit. a, b", inhalt: angaben([["Verantwortlicher", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")], ["Kontakt", [b.telefon, b.email].filter((x) => x.trim()).join(", ")], ["Datenschutzbeauftragte/r", text(d, "dsb") || null]]) },
        {
          titel: "Zwecke, Rechtsgrundlagen, Empfänger und Speicherdauer",
          rand: "Art. 13 Abs. 1 lit. c, e, Abs. 2 lit. a",
          inhalt: gewaehlt.length
            ? gewaehlt
                .map((v) => eintrag(v.titel, angaben([["Zweck", String(v.werte.zweck ?? "")], ["Rechtsgrundlage", String(v.werte.rechtsgrundlage ?? "")], ["Empfänger", v.titel === TERMIN && text(d, "buchung") === "plattform" ? BUCHUNG_PLATTFORM_EMPFAENGER : String(v.werte.empfaenger ?? "") || "keine"], ["Übermittlung in Drittländer", String(v.werte.drittland ?? "") || "keine"], ["Speicherdauer", String(v.werte.loeschfrist ?? "")]])))
                .join("")
            : absatz(""),
        },
        // Ergänzungen (weitere Verarbeitungen) gleich nach den Zwecken, nicht hinter den Rechten
        ...(text(d, "ergaenzung") ? [{ titel: "Ergänzungen", inhalt: zeilen(text(d, "ergaenzung")) }] : []),
        ...(mitLitF(d) ? [{ titel: "Berechtigte Interessen", rand: "Art. 13 Abs. 1 lit. d", inhalt: text(d, "interessen") ? zeilen(text(d, "interessen")) : absatz("") }] : []),
        { titel: DSE.betroffenenrechte!.titel, rand: "Art. 13 Abs. 2 lit. b", inhalt: `<p>${esc(ersetze(DSE.betroffenenrechte!.text))}</p>` },
        { titel: DSE.widerspruchsrecht!.titel, rand: "Art. 21", inhalt: `<p>${esc(ersetze(DSE.widerspruchsrecht!.text))}</p>` },
        { titel: DSE.widerruf_einwilligung!.titel, rand: "Art. 13 Abs. 2 lit. c", inhalt: `<p>${esc(ersetze(DSE.widerruf_einwilligung!.text))}</p>` },
        { titel: DSE.beschwerderecht!.titel, rand: "Art. 13 Abs. 2 lit. d", inhalt: `<p>${esc(DSE.beschwerderecht!.text.replace("{aufsichtsbehoerde_name}", a?.name ?? "____").replace("{aufsichtsbehoerde_ort}", a?.ort ?? "____").replace("{aufsichtsbehoerde_url}", a?.url ?? "____"))}</p>` },
        // R11 (Kosmetik #20): Gesundheitsangaben sind freiwillig – auch wenn die übrigen Daten für den Vertrag nötig sind
        { titel: "Pflicht zur Bereitstellung", rand: "Art. 13 Abs. 2 lit. e", inhalt: `<p>${esc(BEREITSTELLUNG[text(d, "bereitstellung")] ?? "")}</p>${gewaehlt.some((v) => v.titel === GESUNDHEIT) && text(d, "bereitstellung") !== "freiwillig" ? `<p>${esc(GESUNDHEIT_FREIWILLIG)}</p>` : ""}` },
        { titel: "Automatisierte Entscheidungen", rand: "Art. 13 Abs. 2 lit. f", inhalt: "<p>Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt.</p>" },
      ]),
    });
  },
};

/**
 * R11 (Nutzertest Kosmetik #19): Angaben zur Gesundheit und Einwilligung (Art. 9 Abs. 2 lit. a, Art. 7 DSGVO) – die
 * Kundin trägt ein, was für die Behandlung wichtig ist, und willigt ausdrücklich ein; das unterschriebene Blatt ist der
 * Nachweis (Art. 7 Abs. 1). Keine Fragenliste zu Krankheiten – was abgefragt wird, entscheidet der Betrieb. Fachlich zu prüfen.
 */
/** R12 (Coach #8): Anamnese für Behandlung, Kurs oder Training – Beispiele je Art statt nur „Allergien“. */
const ANAMNESE_ART: Record<string, { label: string; wort: string; beispiele: string }> = {
  behandlung: { label: "Behandlung", wort: "Behandlung", beispiele: "z. B. Allergien, Unverträglichkeiten, Hauterkrankungen, Medikamente, Schwangerschaft" },
  kurs: { label: "Kurs", wort: "Kursteilnahme", beispiele: "z. B. Herz-Kreislauf, Bluthochdruck, Rücken oder Bandscheibe, Operationen, Schwangerschaft, Medikamente" },
  training: { label: "Training", wort: "Training", beispiele: "z. B. Herz-Kreislauf, Bluthochdruck, Rücken oder Bandscheibe, Gelenke, Operationen, Schwangerschaft, Medikamente" },
};
const anamneseArt = (d: Parameters<typeof text>[0]) => ANAMNESE_ART[text(d, "art")] ?? ANAMNESE_ART.behandlung!;
/** R12 (Coach #9): Text zum Übernehmen ins Buchungs- bzw. Anmeldeformular (ausdrücklich, gesondert, nicht vorangekreuzt). */
export const anamneseOnlineText = (betrieb: string, wort: string) => `☐ Ich willige ausdrücklich ein, dass ${betrieb} meine Angaben zur Gesundheit für meine ${wort} verarbeitet (Art. 9 Abs. 2 lit. a DSGVO). Die Einwilligung ist freiwillig und jederzeit für die Zukunft widerrufbar (Art. 7 Abs. 3 DSGVO).`;

export const anamnese: Vorlage = {
  id: "anamnese_einwilligung",
  titel: "Anamnese und Einwilligung",
  beschreibung: "Angaben zur Gesundheit vor einer Behandlung, einem Kurs oder Training (z. B. Allergien, Herz-Kreislauf, Rücken) mit ausdrücklicher, widerrufbarer Einwilligung – unterschrieben oder elektronisch, als Nachweis.",
  // R12 (Coach #8): neutral statt „Beauty und Kosmetik“ im Kopf – das Blatt nutzen auch Yoga, Training und Praxen
  bereich: "datenschutz",
  pflichten: [],
  person: { art: "kunde", felder: { name: "name" } },
  grundlage: "Art. 7, Art. 9 Abs. 2 lit. a DSGVO",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Kundin oder Kunde",
      hilfe: "Leer lassen, um das Blatt auszudrucken und von Hand ausfüllen zu lassen. Das unterschriebene Blatt aufbewahren – es weist die Einwilligung nach. Gib die Datenschutzinformation (eigene Vorlage) mit.",
      felder: [
        { id: "art", art: "wahl", label: "Wofür", optionen: Object.entries(ANAMNESE_ART).map(([wert, a]) => ({ wert, text: a.label })), vorbelegung: "behandlung", vorbelegungJe: { unterricht: "kurs" } },
        { id: "name", art: "text", label: "Name" },
        { id: "behandlung", art: "text", label: "Geplante Behandlung, Kurs oder Training", hilfe: "z. B. Gesichtsbehandlung, Yoga-Kurs, Personal Training" },
        { id: "angaben", art: "mehrzeilig", label: "Angaben zur Gesundheit", hilfe: "nur, was dafür wichtig ist – Beispiele stehen auf dem Blatt" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute" },
      ],
    },
    {
      titel: "Speicherung und Einwilligung",
      felder: [
        { id: "speicherung", art: "text", label: "Speicherung bzw. Löschung", hilfe: "Wie lange du die Angaben aufbewahrst – steht auf dem Blatt", vorschlaege: ["bis zum Widerruf, längstens ein Jahr nach dem letzten Termin", "bis zum Ende des Kurses", "bis zum Ende der Zusammenarbeit"] },
        { id: "elektronisch", art: "schalter", label: "Einwilligung elektronisch (z. B. Online-Kurs)", hilfe: "Statt Unterschrift ein eigenes, nicht vorangekreuztes Kästchen im Buchungsformular – der Text dafür steht auf dem Blatt. Den Zeitpunkt der Einwilligung aufbewahren (Art. 7 Abs. 1 DSGVO)." },
      ],
    },
  ],
  html(d, b) {
    const name = b.name.trim() || "____";
    const art = anamneseArt(d);
    // leer zum Ausdrucken: auch das Datum bleibt eine Linie (R12, Coach #8)
    const leer = !text(d, "name") && !text(d, "angaben");
    const datum = leer ? "" : text(d, "datum");
    const elektronisch = ja(d, "elektronisch");
    return dokument({
      titel: "Anamnese und Einwilligung",
      betrieb: b,
      unter: text(d, "name") || undefined,
      meta: `Kundin/Kunde: ${text(d, "name")}\nDatum: ${datumDe(datum)}`,
      inhalt:
        abschnitt("Angaben", angaben([["Name", text(d, "name") ? null : ""], [`Geplante ${art.label === "Kurs" ? "Kursteilnahme" : art.label}`, text(d, "behandlung") || ""], ["Datum", datum ? null : ""]])) +
        abschnitt("Angaben zur Gesundheit", text(d, "angaben") ? zeilen(text(d, "angaben")) : `<p>${esc(art.beispiele)}:</p>${absatz("")}${absatz("")}`) +
        abschnitt(
          "Einwilligung",
          absatz(`Ich willige ausdrücklich ein, dass ${name} meine oben genannten Angaben zur Gesundheit für meine ${art.wort} verarbeitet (Art. 9 Abs. 2 lit. a DSGVO).`) +
            absatz("Die Einwilligung ist freiwillig. Ich kann sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO); die Verarbeitung bis zum Widerruf bleibt rechtmäßig.") +
            absatz(`Speicherung: ${text(d, "speicherung") || "bis zum Widerruf, längstens ____ nach dem letzten Termin"}. Danach werden die Angaben gelöscht.`) +
            absatz("Die Informationen nach Art. 13 DSGVO (Datenschutzinformation) habe ich erhalten."),
        ) +
        (elektronisch
          ? abschnitt("Elektronische Einwilligung", absatz("Die Einwilligung wurde elektronisch erteilt am: ____ (Datum, Uhrzeit, z. B. aus dem Buchungssystem).") + `<p class="klein">Text für das Buchungs- bzw. Anmeldeformular (eigenes Kästchen, nicht vorangekreuzt):</p>` + absatz(anamneseOnlineText(name, art.wort)))
          : unterschriften(["Ort, Datum", "Unterschrift Kundin/Kunde"])),
    });
  },
};

/**
 * R12 (Kfz #8): Hinweisschild Videoüberwachung – gestufte Information nach Art. 13 DSGVO nach dem Muster der
 * Orientierungshilfe „Videoüberwachung durch nicht-öffentliche Stellen“ der Datenschutzkonferenz: vorn das Schild mit
 * den wichtigsten Angaben (erste Ebene), dahinter die vollständige Information zum Aushängen bzw. Bereithalten (zweite
 * Ebene). Beschäftigte sind ausdrücklich genannt, wenn sie mit erfasst werden. Fachlich zu prüfen (PRUEFLISTE).
 */
export const videoHinweis: Vorlage = {
  id: "video_hinweisschild",
  gestalt: "aushang",
  titel: "Hinweisschild Videoüberwachung",
  beschreibung: "Schild am Eingang zum überwachten Bereich nach Art. 13 DSGVO (Muster der Datenschutzkonferenz) – mit Zweck, Rechtsgrundlage, Speicherdauer und der vollständigen Information als zweiter Seite.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.videoueberwachung"],
  grundlage: "Art. 6 Abs. 1 lit. f, Art. 13 DSGVO",
  ohneKopfangaben: true,
  abschnitte: [
    {
      titel: "Überwachung",
      hilfe: "Das Schild hängt gut sichtbar, bevor man den überwachten Bereich betritt. Die zweite Seite hängst du daneben aus oder hältst sie bereit (z. B. an der Kasse). Muster nach der Datenschutzkonferenz – fachlich zu prüfen.",
      felder: [
        { id: "bereich", art: "text", label: "Überwachter Bereich", hilfe: "z. B. Werkstatthof, Verkaufsraum, Eingang", pflicht: true, vorschlaege: ["Eingangsbereich", "Verkaufsraum", "Werkstatthof und Parkplatz", "Lager"] },
        { id: "zwecke", art: "mehrzeilig", label: "Zwecke", pflicht: true, vorschlaege: ["Schutz vor Einbruch, Diebstahl und Sachbeschädigung", "Aufklärung von Straftaten", "Schutz der Beschäftigten und Kunden vor Übergriffen"] },
        { id: "interessen", art: "mehrzeilig", label: "Berechtigte Interessen", hilfe: "warum die Überwachung nötig ist (Art. 6 Abs. 1 lit. f DSGVO) – z. B. frühere Einbrüche", pflicht: true, vorschlaege: ["Schutz des Eigentums nach wiederholten Einbrüchen und Diebstählen", "Beweissicherung bei Straftaten"] },
        { id: "speicherdauer", art: "text", label: "Speicherdauer", vorbelegung: { text: "72 Stunden, danach automatische Löschung; länger nur, wenn ein Vorfall aufzuklären ist" }, vorschlaege: ["72 Stunden, danach automatische Löschung; länger nur, wenn ein Vorfall aufzuklären ist", "48 Stunden, danach automatische Löschung"] },
        { id: "beschaeftigte", art: "schalter", label: "Auch Beschäftigte werden erfasst", hilfe: "Dann steht es auf dem Schild – und gehört in die Unterweisung bzw. Information der Beschäftigten" },
        { id: "dsb", selten: true, art: "text", label: "Datenschutzbeauftragte/r (falls benannt)" },
        { id: "empfaenger", selten: true, art: "text", label: "Empfänger", hilfe: "z. B. Polizei im Einzelfall, Dienstleister für die Technik", vorbelegung: { text: "im Einzelfall Polizei und Strafverfolgungsbehörden" } },
        { id: "fundort", art: "text", label: "Weitere Informationen erhältlich", vorbelegung: { text: "an der Kasse bzw. am Empfang" }, vorschlaege: ["an der Kasse bzw. am Empfang", "als Aushang neben diesem Schild", "auf unserer Website"] },
      ],
    },
  ],
  pruefen: (_d, b) => [...(b.name.trim() ? [] : ["Name des Betriebs (Mein Betrieb)"]), ...(b.bundesland ? [] : ["Bundesland (Mein Betrieb) – für die zuständige Aufsichtsbehörde"])],
  html(d, b) {
    const a = aufsichtFuer(b);
    const verantwortlich = [b.name, anschrift(b)].filter((x) => x.trim()).join(", ");
    const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(", ");
    const zwecke = text(d, "zwecke");
    const schild =
      `<p style="font-size:44pt;line-height:1;margin:2mm 0 4mm">&#128249;</p>` +
      `<p style="font-size:16pt;font-weight:600;margin-bottom:4mm">Dieser Bereich wird videoüberwacht${text(d, "bereich") ? `: ${esc(text(d, "bereich"))}` : "."}</p>` +
      angaben([
        ["Verantwortlich", verantwortlich || ""],
        ["Kontakt", kontakt || ""],
        ...(text(d, "dsb") ? ([["Datenschutzbeauftragte/r", text(d, "dsb")]] as [string, string][]) : []),
        ["Zwecke", zwecke ? zwecke.split("\n").join("; ") : ""],
        ["Rechtsgrundlage", "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)"],
        ["Berechtigte Interessen", text(d, "interessen") ? text(d, "interessen").split("\n").join("; ") : ""],
        ["Speicherdauer", text(d, "speicherdauer") || ""],
      ]) +
      (ja(d, "beschaeftigte") ? absatz("Die Kameras erfassen auch Beschäftigte.") : "") +
      absatz(`Weitere Informationen, insbesondere zu Ihren Rechten (Auskunft, Löschung, Widerspruch, Beschwerde), erhalten Sie ${text(d, "fundort") || "____"}.`);
    const zweite = ([
      { titel: "Verantwortlicher", rand: "Art. 13 Abs. 1 lit. a, b", inhalt: angaben([["Verantwortlicher", verantwortlich || ""], ["Kontakt", kontakt || ""], ["Datenschutzbeauftragte/r", text(d, "dsb") || null]]) },
      { titel: "Zwecke und Rechtsgrundlage", rand: "Art. 13 Abs. 1 lit. c, d", inhalt: angaben([["Überwachter Bereich", text(d, "bereich") || ""], ["Zwecke", zwecke || ""], ["Rechtsgrundlage", "Art. 6 Abs. 1 lit. f DSGVO"], ["Berechtigte Interessen", text(d, "interessen") || ""]]) },
      { titel: "Empfänger und Speicherdauer", rand: "Art. 13 Abs. 1 lit. e, Abs. 2 lit. a", inhalt: angaben([["Empfänger", text(d, "empfaenger") || "keine"], ["Speicherdauer", text(d, "speicherdauer") || ""]]) },
      { titel: DSE.betroffenenrechte!.titel, rand: "Art. 13 Abs. 2 lit. b", inhalt: `<p>${esc(DSE.betroffenenrechte!.text.replace(/\{email\}/g, b.email.trim() || "____").replace(/\{link_einstellungen\}/g, "die angegebenen Kontaktwege"))}</p>` },
      { titel: DSE.widerspruchsrecht!.titel, rand: "Art. 21", inhalt: `<p>${esc(DSE.widerspruchsrecht!.text.replace(/\{email\}/g, b.email.trim() || "____").replace(/\{link_einstellungen\}/g, "die angegebenen Kontaktwege"))}</p>` },
      { titel: DSE.beschwerderecht!.titel, rand: "Art. 13 Abs. 2 lit. d", inhalt: `<p>${esc(DSE.beschwerderecht!.text.replace("{aufsichtsbehoerde_name}", a?.name ?? "____").replace("{aufsichtsbehoerde_ort}", a?.ort ?? "____").replace("{aufsichtsbehoerde_url}", a?.url ?? "____"))}</p>` },
    ] as { titel: string; rand: string; inhalt: string }[]).map((t) => abschnitt(t.titel, t.inhalt)).join("");
    return dokument({
      titel: "Videoüberwachung",
      betrieb: b,
      gestalt: "aushang",
      inhalt: schild + `<h2 class="neue-seite">Information nach Art. 13 DSGVO zur Videoüberwachung</h2><div class="klein">${zweite}</div>` + nachsatz("Muster nach der Orientierungshilfe Videoüberwachung der Datenschutzkonferenz – fachlich zu prüfen."),
    });
  },
};
