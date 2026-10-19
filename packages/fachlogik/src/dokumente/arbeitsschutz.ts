/**
 * Arbeitsschutz: Gefährdungsbeurteilung, Unterweisung, Gefahrstoffverzeichnis, Betriebsanweisung, Prüfprotokoll
 * elektrische Geräte (E-121, E-123). Vorschläge und Bausteine aus der Recherche (bausteine.ts, Quellen dort).
 */
import { BA_BAUSTEINE, ELEKTRO_FRISTEN, GEFAEHRDUNGEN, GEFAHRSTOFF_ANGABEN, MUTTERSCHUTZ, UNTERWEISUNGSTHEMEN } from "./bausteine.js";
import { LINIE, nachsatz, abschnitt, absatz, angaben, auswahl, datumDe, dokument, esc, ja, liste, plusMonate, punkte, tabelle, text, unterschriften, zelle, zellePunkte, zeilen } from "./html.js";
import { GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, optionen } from "./konstanten.js";
import type { Daten, Eintrag, Vorlage } from "./typen.js";

/** Teilnahmeliste mit Unterschriftsspalte; leere Zeilen zum Nachtragen von Hand. */
export function teilnahmeTabelle(eintraege: Eintrag[], extra?: { kopf: string; feld: string; datum?: boolean }): string {
  const kopf = ["Name", ...(extra ? [extra.kopf] : []), "Unterschrift"];
  const zeilen = eintraege.filter((e) => text(e, "name")).map((e) => [zelle(text(e, "name")), ...(extra ? [zelle(extra.datum ? datumDe(text(e, extra.feld)) : text(e, extra.feld))] : []), ""]);
  // mit Namen: zwei Leerzeilen zum Nachtragen; ohne Namen (Liste zum Ausdrucken): sechs Zeilen
  return tabelle(kopf, zeilen, { breiten: extra ? ["38%", "22%", "40%"] : ["45%", "55%"], ...(zeilen.length ? { leerzeilen: 2 } : { mindestens: 6 }), hoch: true });
}

const BEREICHE_VORSCHLAG = ["Salon", "Kosmetikkabine", "Küche", "Gastraum und Service", "Verkaufsraum", "Lager", "Werkstatt", "Baustelle beim Kunden", "Büro"];
const GEFAEHRDUNG_KOPF = ["Gefährdung", "Risiko", "Schutzmaßnahmen", "Umsetzung"];
const GEFAEHRDUNG_BREITEN = ["28%", "10%", "42%", "20%"];
const WIRKSAM: Record<string, string> = { wirksam: "Die Maßnahmen sind umgesetzt und wirksam.", teilweise: "Die Maßnahmen sind teilweise wirksam; Nachbesserung siehe Bemerkung.", offen: "Die Wirksamkeit ist noch zu überprüfen." };

export const gefaehrdungsbeurteilung: Vorlage = {
  id: "gefaehrdungsbeurteilung",
  titel: "Gefährdungsbeurteilung",
  beschreibung: "Welche Gefahren es an einem Arbeitsplatz gibt, wie hoch das Risiko ist und was du dagegen tust – mit Vorschlägen je Branche, Mutterschutz und Wirksamkeitskontrolle.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefaehrdungsbeurteilung", "personal.mutterschutz_gefaehrdungsbeurteilung", "branche.handwerk_gefaehrdung_gewerk"],
  grundlage: "§§ 5, 6 ArbSchG; § 10 MuSchG",
  namensFeld: "arbeitsbereich",
  abschnitte: [
    { titel: "Arbeitsbereich",
      felder: [
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich oder Gewerk", hilfe: "Je Bereich eine eigene Beurteilung; gleichartige Arbeitsplätze dürfen zusammen beurteilt werden.", pflicht: true, vorschlaege: BEREICHE_VORSCHLAG },
        { id: "taetigkeiten", art: "mehrzeilig", label: "Tätigkeiten in diesem Bereich", hilfe: "Was wird hier gemacht – Tätigkeiten, Geräte, Stoffe" },
        { id: "beschaeftigte", selten: true, art: "zahl", label: "Beschäftigte in diesem Bereich" },
        { id: "beurteilt_von", art: "text", label: "Beurteilt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "mitwirkung", selten: true, art: "mehrzeilig", label: "Mitgewirkt haben", vorschlaege: ["Fachkraft für Arbeitssicherheit", "Betriebsärztin / Betriebsarzt", "Beschäftigte des Bereichs"] },
        { id: "datum", art: "datum", label: "Datum der Beurteilung", vorbelegung: "heute", pflicht: true },
      ],
    },
    {
      titel: "Gefährdungen und Maßnahmen",
      hilfe: "Wähle typische Gefährdungen deiner Branche aus und passe sie an. Maßnahmen in der Reihenfolge: technisch vor organisatorisch vor persönlich.",
      felder: [
        {
          id: "gefaehrdungen",
          art: "liste",
          label: "Gefährdungen",
          eintrag: "Gefährdung",
          titelFeld: "beschreibung",
          pflicht: true,
          leerStarten: true,
          vorschlaege: GEFAEHRDUNGEN,
          gruppenLabel: "Branche",
          felder: [
            { id: "beschreibung", art: "mehrzeilig", label: "Gefährdung", pflicht: true },
            { id: "massnahme", art: "mehrzeilig", label: "Schutzmaßnahmen", hilfe: "Eine Maßnahme je Zeile", pflicht: true },
            { id: "risiko", art: "wahl", label: "Risiko", optionen: optionen(RISIKO_STUFEN), vorbelegung: "mittel" },
            { id: "faktor", art: "wahl", label: "Gefährdungsfaktor (§ 5 Abs. 3 ArbSchG)", optionen: optionen(GEFAEHRDUNGSFAKTOREN), vorbelegung: "arbeitsstaette" },
            { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
            { id: "umsetzen_bis", art: "datum", label: "Umsetzen bis" },
            { id: "umgesetzt_am", selten: true, art: "datum", label: "Umgesetzt am" },
          ],
        },
      ],
    },
    {
      titel: "Mutterschutz",
      hilfe: "Die Beurteilung nach dem Mutterschutzgesetz ist für jeden Arbeitsplatz nötig – unabhängig davon, ob gerade jemand schwanger ist.",
      felder: [
        { id: "mutterschutz_ergebnis", art: "wahl", label: "Ergebnis für schwangere oder stillende Frauen", optionen: MUTTERSCHUTZ, pflicht: true },
        { id: "mutterschutz_details", art: "mehrzeilig", label: "Gefährdungen und erforderliche Schutzmaßnahmen", hilfe: "z. B. kein Umgang mit bestimmten Chemikalien, Sitzgelegenheit, keine Nachtarbeit" },
      ],
    },
    {
      titel: "Wirksamkeit und Fortschreibung",
      felder: [
        { id: "wirksamkeit", art: "wahl", label: "Wirksamkeit der Maßnahmen", optionen: optionen(WIRKSAM), vorbelegung: "offen" },
        { id: "wirksamkeit_am", art: "datum", label: "Überprüft am" },
        { id: "bemerkung", art: "mehrzeilig", label: "Bemerkung" },
        { id: "fortschreibung", art: "text", label: "Überprüfung der Beurteilung", vorschlaege: ["bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich", "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen und nach Unfällen"] },
      ],
    },
  ],
  pruefen(d) {
    // „umgesetzt und wirksam“ passt nicht zu Maßnahmen ohne Umsetzungsdatum (Hinweis, kein Hindernis)
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    return text(d, "wirksamkeit") === "wirksam" && g.some((x) => !text(x, "umgesetzt_am")) ? ["Wirksamkeit: „Maßnahmen umgesetzt und wirksam“ gewählt, aber nicht alle Maßnahmen haben ein Datum „Umgesetzt am“ – bitte prüfen."] : [];
  },
  html(d, b) {
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    const umsetzung = (x: Eintrag) =>
      [text(x, "verantwortlich"), text(x, "umsetzen_bis") ? `bis ${datumDe(text(x, "umsetzen_bis"))}` : "", text(x, "umgesetzt_am") ? `umgesetzt ${datumDe(text(x, "umgesetzt_am"))}` : "offen"].filter(Boolean).map(esc).join("<br>");
    const teile = Object.entries(GEFAEHRDUNGSFAKTOREN)
      .map(([faktor, titel]) => {
        const l = g.filter((x) => (text(x, "faktor") || "sonstiges") === faktor);
        if (!l.length) return "";
        return abschnitt(
          titel,
          tabelle(GEFAEHRDUNG_KOPF, l.map((x) => [zelle(text(x, "beschreibung")), esc(RISIKO_STUFEN[text(x, "risiko")] ?? text(x, "risiko")), zellePunkte(text(x, "massnahme")), umsetzung(x)]), { breiten: GEFAEHRDUNG_BREITEN }),
        );
      })
      .join("");
    const musch = MUTTERSCHUTZ.find((m) => m.wert === text(d, "mutterschutz_ergebnis"));
    return dokument({
      titel: "Gefährdungsbeurteilung",
      betrieb: b,
      unter: text(d, "arbeitsbereich") || undefined,
      meta: `Arbeitsbereich: ${text(d, "arbeitsbereich")}\nBeurteilt von: ${text(d, "beurteilt_von")}\nStand: ${datumDe(text(d, "datum"))}`,
      inhalt:
        abschnitt(
          "Allgemeine Angaben",
          angaben([
            ["Arbeitsbereich / Gewerk", text(d, "arbeitsbereich")],
            ["Tätigkeiten", text(d, "taetigkeiten")],
            ["Beschäftigte", text(d, "beschaeftigte") || null],
            ["Beurteilt von", text(d, "beurteilt_von")],
            // eine Zeile je Person oder Stelle; Satzzeichen am Zeilenende entfallen, sonst stünde „Protokoll., Zweite“ da
            ["Mitgewirkt haben", text(d, "mitwirkung").split("\n").map((z) => z.trim().replace(/[.;,]+$/, "")).filter(Boolean).join(", ") || null],
            ["Datum", datumDe(text(d, "datum"))],
          ]),
        ) +
        // ohne Einträge: leere Tabelle zum Ausfüllen von Hand
        (teile || abschnitt("Gefährdungen und Maßnahmen", tabelle(GEFAEHRDUNG_KOPF, [], { breiten: GEFAEHRDUNG_BREITEN, mindestens: 6, hoch: true }))) +
        (d.mutterschutz !== false
          ? abschnitt(
              "Mutterschutz (§ 10 MuSchG)",
              `<p>Ergebnis der anlassunabhängigen Beurteilung für schwangere oder stillende Frauen:</p>${musch ? `<p><strong>${esc(musch.text)}</strong></p>` : absatz("")}${text(d, "mutterschutz_details") ? zeilen(text(d, "mutterschutz_details")) : ""}`,
            )
          : "") +
        abschnitt(
          "Wirksamkeit und Fortschreibung",
          angaben([
            ["Wirksamkeit", WIRKSAM[text(d, "wirksamkeit")] ?? ""],
            ["Überprüft am", datumDe(text(d, "wirksamkeit_am"))],
            ["Bemerkung", text(d, "bemerkung") || null],
            ["Überprüfung der Beurteilung", text(d, "fortschreibung")],
          ]),
        ) +
        unterschriften(["Ort, Datum", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

const ANLASS: Record<string, string> = { erst: "Erstunterweisung vor Aufnahme der Tätigkeit", wiederholung: "Wiederholungsunterweisung (mindestens jährlich)", anlass: "Unterweisung aus besonderem Anlass (z. B. neue Arbeitsmittel, Unfall)" };

export const unterweisung: Vorlage = {
  id: "unterweisung",
  titel: "Unterweisungsnachweis",
  beschreibung: "Wann du wen zu welchen Gefahren und Schutzmaßnahmen unterwiesen hast – Themen zum Ankreuzen, mit Unterschriften und nächstem Termin.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.erstunterweisung", "arbeitsschutz.unterweisung_wiederholen"],
  grundlage: "§ 12 ArbSchG; § 4 Abs. 1 DGUV Vorschrift 1",
  namensFeld: "thema",
  abschnitte: [
    { titel: "Unterweisung",
      felder: [
        { id: "thema", art: "text", label: "Bezeichnung", pflicht: true, vorschlaege: ["Jährliche Unterweisung Arbeitsschutz", "Erstunterweisung neuer Beschäftigter", "Unterweisung Gefahrstoffe", "Unterweisung Brandschutz und Erste Hilfe"] },
        { id: "anlass", art: "wahl", label: "Anlass", optionen: optionen(ANLASS), vorbelegung: "wiederholung" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", vorschlaege: ["30 Minuten", "45 Minuten", "60 Minuten", "90 Minuten"] },
        { id: "durchgefuehrt_von", art: "text", label: "Durchgeführt von", vorbelegung: "verantwortlich", pflicht: true },
      ],
    },
    {
      titel: "Inhalte",
      felder: [
        { id: "themen", art: "bausteine", label: "Themen der Unterweisung", optionen: UNTERWEISUNGSTHEMEN.map((t) => ({ wert: t.wert, text: t.text, quelle: t.quelle })), vorbelegung: [UNTERWEISUNGSTHEMEN[0]!.wert, UNTERWEISUNGSTHEMEN[1]!.wert, UNTERWEISUNGSTHEMEN[2]!.wert], pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Betriebsspezifische Ergänzungen", hilfe: "z. B. konkrete Geräte, Mittel, Abläufe in deinem Betrieb" },
      ],
    },
    {
      titel: "Teilnehmende",
      hilfe: "Namen eintragen – im PDF unterschreibt jede Person daneben. Freie Zeilen kommen automatisch dazu.",
      felder: [{ id: "teilnehmer", art: "liste", ausMitarbeitern: true, label: "Teilnehmende", eintrag: "Person", titelFeld: "name", felder: [{ id: "name", art: "text", label: "Name", pflicht: true }] }],
    },
  ],
  html(d, b) {
    const themen = auswahl(d, "themen").map((w) => UNTERWEISUNGSTHEMEN.find((t) => t.wert === w)?.text ?? w);
    const naechste = plusMonate(text(d, "datum"), 12);
    return dokument({
      titel: "Unterweisungsnachweis",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum"))}\nDurchgeführt von: ${text(d, "durchgefuehrt_von")}\nNächste Unterweisung: ${naechste ? `bis ${naechste}` : ""}`,
      inhalt:
        abschnitt("Angaben", angaben([["Bezeichnung", text(d, "thema")], ["Anlass", ANLASS[text(d, "anlass")] ?? ""], ["Datum", datumDe(text(d, "datum"))], ["Dauer", text(d, "dauer") || null], ["Durchgeführt von", text(d, "durchgefuehrt_von")]])) +
        abschnitt("Inhalte der Unterweisung", (themen.length ? punkte(themen) : absatz("")) + (text(d, "inhalt") ? `<h3>Betriebsspezifische Ergänzungen</h3>${zeilen(text(d, "inhalt"))}` : "")) +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich, dass ich an der Unterweisung teilgenommen und die Inhalte verstanden habe.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        nachsatz(`Die Unterweisung ist mindestens einmal jährlich zu wiederholen (§ 4 Abs. 1 DGUV Vorschrift 1)${naechste ? `, nächster Termin spätestens am ${naechste}` : ""}.`) +
        unterschriften(["Ort, Datum", "Unterschrift der unterweisenden Person"]),
    });
  },
};

export const gefahrstoffverzeichnis: Vorlage = {
  id: "gefahrstoffverzeichnis",
  titel: "Gefahrstoffverzeichnis",
  beschreibung: "Alle Gefahrstoffe im Betrieb mit Einstufung, Mengenbereich, Arbeitsbereich und Verweis auf das Sicherheitsdatenblatt.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  grundlage: "§ 6 Abs. 12 GefStoffV",
  querformat: true,
  abschnitte: [
    { titel: "Stand", felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true }, { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" }] },
    {
      titel: "Gefahrstoffe",
      hilfe: "Die Angaben stehen auf dem Etikett und im Sicherheitsdatenblatt (Abschnitte 1, 2 und 16).",
      felder: [
        {
          id: "stoffe",
          art: "liste",
          label: "Gefahrstoffe",
          eintrag: "Gefahrstoff",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung (Handelsname)", pflicht: true },
            { id: "hersteller", art: "text", label: "Hersteller" },
            { id: "gefahren", art: "text", label: "Einstufung / gefährliche Eigenschaften", hilfe: "H-Sätze oder Piktogramme laut Etikett, z. B. H315, H319", pflicht: true },
            { id: "menge", art: "text", label: "Mengenbereich im Betrieb", pflicht: true, vorschlaege: ["bis 1 kg bzw. 1 l", "1 bis 10 kg bzw. l", "10 bis 100 kg bzw. l", "über 100 kg bzw. l"] },
            { id: "arbeitsbereich", art: "text", label: "Arbeitsbereiche mit möglicher Exposition", pflicht: true },
            { id: "verwendung", art: "text", label: "Verwendung" },
            { id: "sdb_vorhanden", art: "schalter", label: "Sicherheitsdatenblatt liegt vor" },
            { id: "sdb_stand", selten: true, art: "datum", label: "Stand des Sicherheitsdatenblatts", wenn: { feld: "sdb_vorhanden" } },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const s = liste(d, "stoffe").filter((x) => text(x, "bezeichnung"));
    const zeilenHtml = s.map((x) => [
      `<strong>${zelle(text(x, "bezeichnung"))}</strong>${text(x, "hersteller") ? `<br><span class="klein">${zelle(text(x, "hersteller"))}</span>` : ""}`,
      zelle(text(x, "gefahren")),
      zelle(text(x, "menge")),
      zelle(text(x, "arbeitsbereich")),
      zelle(text(x, "verwendung")),
      ja(x, "sdb_vorhanden") ? `liegt vor${text(x, "sdb_stand") ? `<br>Stand ${datumDe(text(x, "sdb_stand"))}` : ""}` : "<strong>fehlt</strong>",
    ]);
    return dokument({
      titel: "Gefahrstoffverzeichnis",
      betrieb: b,
      quer: true,
      meta: `Stand: ${datumDe(text(d, "stand"))}\nVerantwortlich: ${text(d, "verantwortlich")}${s.length ? `\nAnzahl Gefahrstoffe: ${s.length}` : ""}`,
      inhalt:
        tabelle(["Bezeichnung / Hersteller", "Einstufung / gefährliche Eigenschaften", "Mengenbereich", "Arbeitsbereiche", "Verwendung", "Sicherheitsdatenblatt"], zeilenHtml, { breiten: ["20%", "22%", "12%", "18%", "14%", "14%"], mindestens: s.length ? 0 : 6 }) +
        nachsatz(`Verzeichnis nach § 6 Abs. 12 GefStoffV mit ${GEFAHRSTOFF_ANGABEN.length} Pflichtangaben: ${GEFAHRSTOFF_ANGABEN.join("; ")}.`),
    });
  },
};

/** Abschnitte nach TRGS 555 Nr. 3.2.4–3.2.8 (3.2.2/3.2.3 stehen im Kopf). */
const BA_TEILE: { id: string; label: string; hilfe: string; bausteine?: string }[] = [
  { id: "gefahren", label: "Gefahren für Mensch und Umwelt", hilfe: "H-Sätze aus dem Sicherheitsdatenblatt (Abschnitt 2), z. B. „Verursacht schwere Augenreizung“" },
  { id: "schutz", label: "Schutzmaßnahmen und Verhaltensregeln", hilfe: "Technisch, organisatorisch, Hygiene, persönliche Schutzausrüstung", bausteine: "schutzmassnahmen" },
  { id: "gefahrfall", label: "Verhalten im Gefahrfall", hilfe: "Bei Verschütten, Brand, Unfall – laut Sicherheitsdatenblatt (Abschnitte 5 und 6)", bausteine: "gefahrfall" },
  { id: "erste_hilfe", label: "Erste Hilfe", hilfe: "Nach Augen-, Hautkontakt, Einatmen, Verschlucken – laut Sicherheitsdatenblatt (Abschnitt 4)", bausteine: "erste_hilfe" },
  { id: "entsorgung", label: "Sachgerechte Entsorgung", hilfe: "Laut Sicherheitsdatenblatt (Abschnitt 13)", bausteine: "entsorgung" },
];

export const betriebsanweisung: Vorlage = {
  id: "betriebsanweisung",
  gestalt: "aushang",
  titel: "Betriebsanweisung",
  beschreibung: "Aushang für einen Gefahrstoff nach TRGS 555: Gefahren, Schutzmaßnahmen, Verhalten im Gefahrfall, Erste Hilfe, Entsorgung – mit Bausteinen zum Antippen.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  grundlage: "§ 14 Abs. 1 GefStoffV; TRGS 555",
  namensFeld: "stoff",
  abschnitte: [
    { titel: "Gefahrstoff",
      felder: [
        { id: "stoff", art: "text", label: "Gefahrstoff (Handelsname)", hilfe: "Die im Betrieb geläufige Bezeichnung", pflicht: true },
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich, Arbeitsplatz, Tätigkeit", pflicht: true, vorschlaege: BEREICHE_VORSCHLAG },
        { id: "nummer", selten: true, art: "text", label: "Nummer der Betriebsanweisung", hilfe: "z. B. BA-01" },
      ],
    },
    {
      titel: "Inhalt nach TRGS 555",
      hilfe: "Die stoffbezogenen Angaben stehen im Sicherheitsdatenblatt; die Bausteine sind allgemeine Regeln.",
      felder: BA_TEILE.map((t) => ({ id: t.id, art: "mehrzeilig" as const, label: t.label, hilfe: t.hilfe, pflicht: true, ...(t.bausteine ? { vorschlaege: (BA_BAUSTEINE[t.bausteine] ?? []).map((o) => o.text) } : {}) })),
    },
    { titel: "Notruf und Freigabe",
      felder: [
        { id: "notruf", art: "text", label: "Notruf und Ersthelfer/in", hilfe: "z. B. Notruf 112 · Ersthelfer/in: Name, Telefon", vorschlaege: ["Notruf 112"] },
        { id: "erstellt_von", art: "text", label: "Freigegeben von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
      ],
    },
  ],
  html(d: Daten, b) {
    // Aufbau wie das Muster der DGUV Information 211-010: Titelband mit Nummer, Bereich und Stoff, dann die Abschnitte nach TRGS 555
    const kaesten = BA_TEILE.map((t) => `<section class="kasten"><h2>${esc(t.label)}</h2><div class="inhalt">${zeilen(text(d, t.id))}</div></section>`).join("");
    // viel Text → kompakter Satz, damit der Aushang auf ein Blatt passt (Zeilen grob: ca. 80 Zeichen je Zeile)
    const zeilenzahl = BA_TEILE.reduce((n, t) => n + text(d, t.id).split("\n").filter((z) => z.trim()).reduce((m, z) => m + Math.ceil(z.trim().length / 80), 0), 0);
    return dokument({
      titel: "Betriebsanweisung",
      betrieb: b,
      gestalt: "aushang",
      klasse: zeilenzahl > BA_KOMPAKT_AB ? "ba kompakt" : "ba",
      band: "#e0640c",
      meta: `Stand: ${datumDe(text(d, "datum"))}`,
      inhalt:
        `<div class="titelband"><div class="t">Betriebsanweisung<small>gemäß § 14 GefStoffV (TRGS 555)</small></div><div class="n">${text(d, "nummer") ? `<span>Nummer<b>${esc(text(d, "nummer"))}</b></span>` : ""}<span>Stand<b>${datumDe(text(d, "datum")) || "&nbsp;"}</b></span></div></div>` +
        `<section class="kasten stoff"><h2>Arbeitsbereich, Arbeitsplatz, Tätigkeit · Gefahrstoffbezeichnung</h2><div class="inhalt"><div><dt>Arbeitsbereich, Arbeitsplatz, Tätigkeit</dt><dd>${text(d, "arbeitsbereich") ? esc(text(d, "arbeitsbereich")) : LINIE}</dd></div><div><dt>Gefahrstoff</dt><dd>${text(d, "stoff") ? esc(text(d, "stoff")) : LINIE}</dd></div></div></section>` +
        kaesten +
        // ohne Angabe: Notruf und Linie für die Ersthelferin bzw. den Ersthelfer zum Eintragen von Hand
        `<div class="notruf">${text(d, "notruf") ? esc(text(d, "notruf")) : `Notruf 112 · Ersthelfer/in: ${LINIE}`}</div>` +
        unterschriften([`Freigegeben: ${text(d, "erstellt_von")}`, "Datum, Unterschrift"]),
    });
  },
};

/** Ab so vielen Textzeilen in den Kästen wird die Betriebsanweisung kompakt gesetzt. */
const BA_KOMPAKT_AB = 12;

const ERGEBNIS: Record<string, string> = { bestanden: "bestanden", maengel: "Mängel – nicht verwenden" };

export const elektroPruefung: Vorlage = {
  id: "pruefprotokoll_elektro",
  titel: "Prüfprotokoll elektrische Geräte (DGUV V3)",
  beschreibung: "Verzeichnis der geprüften Geräte mit Ergebnis und nächstem Termin – mit den Richtwerten für Prüffristen aus der DGUV Vorschrift 3.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.dguv_v3"],
  grundlage: "§ 5 DGUV Vorschrift 3; § 14 BetrSichV",
  querformat: true,
  namensFeld: "datum",
  abschnitte: [
    { titel: "Prüfung",
      hilfe: "Prüfen darf eine Elektrofachkraft; eine elektrotechnisch unterwiesene Person nur unter Leitung und Aufsicht einer Elektrofachkraft. Die Prüffrist legst du in der Gefährdungsbeurteilung fest.",
      felder: [
        { id: "pruefer", art: "text", label: "Prüfende Elektrofachkraft / Firma", pflicht: true },
        { id: "datum", art: "datum", label: "Prüfdatum", vorbelegung: "heute", pflicht: true },
        { id: "messgeraet", selten: true, art: "text", label: "Verwendetes Prüfgerät" },
        { id: "pruefart", art: "wahl", label: "Art der Prüfung", optionen: [{ wert: "Wiederholungsprüfung", text: "Wiederholungsprüfung" }, { wert: "Erstprüfung", text: "Erstprüfung" }, { wert: "Prüfung nach Instandsetzung", text: "nach Instandsetzung" }], vorbelegung: "Wiederholungsprüfung", pflicht: true },
        { id: "umfang", art: "bausteine", label: "Umfang der Prüfung", optionen: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Messung des Schutzleiter- bzw. Berührungsstroms", "Funktionsprüfung"].map((t) => ({ wert: t, text: t })), vorbelegung: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], pflicht: true },
        { id: "norm", art: "text", label: "Prüfgrundlage", vorschlaege: ["DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)"] },
        { id: "einsatz", art: "wahl", label: "Einsatzbedingungen (Richtwert für die Prüffrist)", optionen: ELEKTRO_FRISTEN.slice(0, 4).map((o) => ({ wert: o.wert, text: o.text, quelle: o.quelle })) },
        { id: "leerzeilen", selten: true, art: "schalter", label: "Leere Zeilen zum Ausfüllen von Hand anhängen" },
      ],
    },
    {
      titel: "Geräte",
      felder: [
        {
          id: "geraete",
          art: "liste",
          label: "Geräte",
          eintrag: "Gerät",
          titelFeld: "bezeichnung",
          felder: [
            { id: "bezeichnung", art: "text", label: "Gerät", pflicht: true, vorschlaege: ["Föhn", "Glätteisen", "Haarschneidemaschine", "Kaffeemaschine", "Wasserkocher", "Mikrowelle", "Verlängerungskabel", "Mehrfachsteckdose", "Bohrmaschine", "Akku-Ladegerät", "Computer mit Netzteil"] },
            { id: "typ", art: "text", label: "Hersteller / Typ" },
            { id: "inventar", art: "text", label: "Inventar-Nr." },
            { id: "standort", art: "text", label: "Standort" },
            { id: "ergebnis", art: "wahl", label: "Ergebnis", optionen: optionen(ERGEBNIS), vorbelegung: "bestanden" },
            { id: "maengel", art: "text", label: "Mängel", wenn: { feld: "ergebnis", ist: "maengel" }, pflicht: true },
            { id: "naechste", art: "datum", label: "Nächste Prüfung" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const g = liste(d, "geraete").filter((x) => text(x, "bezeichnung"));
    const einsatz = ELEKTRO_FRISTEN.find((o) => o.wert === text(d, "einsatz"));
    return dokument({
      titel: "Prüfprotokoll elektrische Geräte",
      betrieb: b,
      quer: true,
      meta: `Prüfdatum: ${datumDe(text(d, "datum"))}\nGeprüft von: ${text(d, "pruefer")}\nArt der Prüfung: ${text(d, "pruefart")}`,
      inhalt:
        angaben([["Umfang der Prüfung", auswahl(d, "umfang").join(", ")], ["Prüfgrundlage", text(d, "norm") || null], ["Prüfgerät", text(d, "messgeraet") || null]]) +
        `<section class="abschnitt ohne-nummer">${tabelle(
          ["Gerät", "Hersteller / Typ", "Inventar-Nr.", "Standort", "Ergebnis", "Nächste Prüfung"],
          g.map((x) => [`<strong>${zelle(text(x, "bezeichnung"))}</strong>`, zelle(text(x, "typ")), zelle(text(x, "inventar")), zelle(text(x, "standort")), text(x, "ergebnis") === "maengel" ? `<strong>Mängel:</strong> ${zelle(text(x, "maengel"))}` : "bestanden", datumDe(text(x, "naechste"))]),
          // ohne Geräte (Protokoll zum Ausfüllen von Hand) immer mit leeren Zeilen – so viele, wie mit den Unterschriften auf das Blatt passen
          { breiten: ["20%", "18%", "12%", "15%", "20%", "15%"], leerzeilen: ja(d, "leerzeilen") ? 12 : g.length ? 0 : 7, hoch: ja(d, "leerzeilen") || !g.length },
        )}</section>` +
        (einsatz ? nachsatz(`Richtwert für die Prüffrist nach ${einsatz.quelle ?? "DGUV Vorschrift 3"}: ${einsatz.text.replace(/\.$/, "")}.`) : "") +
        unterschriften(["Ort, Datum", "Unterschrift der prüfenden Person"]),
    });
  },
};
