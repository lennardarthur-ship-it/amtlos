/** Arbeitsschutz: Gefährdungsbeurteilung, Unterweisung, Gefahrstoffverzeichnis, Betriebsanweisung. */
import { abschnitt, absatz, angaben, datumDe, dokument, esc, ja, liste, tabelle, text, unterschriften, zelle } from "./html.js";
import { GEFAEHRDUNGSFAKTOREN, RISIKO_STUFEN, optionen } from "./konstanten.js";
import type { Daten, Eintrag, Vorlage } from "./typen.js";

/** Teilnahmeliste mit Unterschriftsspalte; leere Zeilen zum Nachtragen von Hand. */
export function teilnahmeTabelle(eintraege: Eintrag[], extra?: { kopf: string; feld: string; datum?: boolean }): string {
  const kopf = ["Name", ...(extra ? [extra.kopf] : []), "Unterschrift"];
  const zeilen = eintraege.filter((e) => text(e, "name")).map((e) => [zelle(text(e, "name")), ...(extra ? [zelle(extra.datum ? datumDe(text(e, extra.feld)) : text(e, extra.feld))] : []), ""]);
  return tabelle(kopf, zeilen, { breiten: extra ? ["38%", "22%", "40%"] : ["45%", "55%"], mindestens: 8, hoch: true });
}

export const gefaehrdungsbeurteilung: Vorlage = {
  id: "gefaehrdungsbeurteilung",
  titel: "Gefährdungsbeurteilung",
  beschreibung: "Welche Gefahren es an einem Arbeitsplatz gibt, wie hoch das Risiko ist und was du dagegen tust – auch für Mutterschutz und je Gewerk.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefaehrdungsbeurteilung", "personal.mutterschutz_gefaehrdungsbeurteilung", "branche.handwerk_gefaehrdung_gewerk"],
  namensFeld: "arbeitsbereich",
  abschnitte: [
    {
      felder: [
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich oder Gewerk", hilfe: "z. B. Salon, Küche, Werkstatt, Baustelle – je Bereich eine eigene Beurteilung", pflicht: true },
        { id: "taetigkeiten", art: "mehrzeilig", label: "Tätigkeiten in diesem Bereich" },
        { id: "beurteilt_von", art: "text", label: "Beurteilt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
      ],
    },
    {
      titel: "Gefährdungen und Maßnahmen",
      hilfe: "Je Gefahr ein Eintrag: was passieren kann, wie wahrscheinlich und schwer, und was du dagegen tust.",
      felder: [
        {
          id: "gefaehrdungen",
          art: "liste",
          label: "Gefährdungen",
          eintrag: "Gefährdung",
          titelFeld: "beschreibung",
          pflicht: true,
          felder: [
            { id: "beschreibung", art: "mehrzeilig", label: "Gefährdung", hilfe: "z. B. Rutschgefahr durch nassen Boden", pflicht: true },
            { id: "massnahme", art: "mehrzeilig", label: "Maßnahme", hilfe: "z. B. rutschfeste Matten, Schuhe mit rutschhemmender Sohle", pflicht: true },
            { id: "risiko", art: "wahl", label: "Risiko", optionen: optionen(RISIKO_STUFEN), vorbelegung: "mittel" },
            { id: "faktor", art: "wahl", label: "Art der Gefährdung", optionen: optionen(GEFAEHRDUNGSFAKTOREN), vorbelegung: "arbeitsstaette" },
            { id: "verantwortlich", art: "text", label: "Verantwortlich" },
            { id: "umsetzen_bis", art: "datum", label: "Umsetzen bis" },
            { id: "umgesetzt_am", art: "datum", label: "Umgesetzt am" },
          ],
        },
      ],
    },
    {
      titel: "Mutterschutz",
      felder: [
        { id: "mutterschutz", art: "schalter", label: "Mutterschutz mitbeurteilt", hilfe: "Unabhängig davon, ob gerade jemand schwanger ist." },
        { id: "mutterschutz_ergebnis", art: "mehrzeilig", label: "Ergebnis für schwangere und stillende Frauen", hilfe: "Welche Gefährdungen es für sie gibt und welche Schutzmaßnahmen nötig wären", wenn: { feld: "mutterschutz" } },
      ],
    },
    {
      titel: "Wirksamkeit",
      felder: [
        { id: "wirksamkeit_am", art: "datum", label: "Wirksamkeit überprüft am" },
        { id: "wirksamkeit", art: "mehrzeilig", label: "Ergebnis der Überprüfung" },
      ],
    },
  ],
  html(d, b) {
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    const teile = Object.entries(GEFAEHRDUNGSFAKTOREN)
      .map(([faktor, titel]) => {
        const l = g.filter((x) => (text(x, "faktor") || "sonstiges") === faktor);
        if (!l.length) return "";
        return abschnitt(
          titel,
          l
            .map((x) => {
              const wer = [text(x, "verantwortlich") ? `verantwortlich: ${text(x, "verantwortlich")}` : "", text(x, "umsetzen_bis") ? `bis ${datumDe(text(x, "umsetzen_bis"))}` : "", text(x, "umgesetzt_am") ? `umgesetzt am ${datumDe(text(x, "umgesetzt_am"))}` : "noch nicht umgesetzt"].filter(Boolean).join(" · ");
              return `<div class="eintrag">${angaben([["Gefährdung", text(x, "beschreibung")], ["Risiko", RISIKO_STUFEN[text(x, "risiko")] ?? text(x, "risiko")], ["Maßnahme", text(x, "massnahme")], ["Umsetzung", wer]])}</div>`;
            })
            .join(""),
        );
      })
      .join("");
    return dokument({
      titel: "Gefährdungsbeurteilung",
      betrieb: b,
      unter: text(d, "arbeitsbereich") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt:
        angaben([
          ["Arbeitsbereich", text(d, "arbeitsbereich")],
          ["Beurteilt von", text(d, "beurteilt_von")],
          ["Datum", datumDe(text(d, "datum"))],
          ["Mutterschutz", ja(d, "mutterschutz") ? "mitbeurteilt (anlassunabhängig)" : "nicht gesondert beurteilt"],
        ]) +
        (text(d, "taetigkeiten") ? abschnitt("Tätigkeiten", absatz(text(d, "taetigkeiten"))) : "") +
        (teile || abschnitt("Gefährdungen", absatz(""))) +
        (ja(d, "mutterschutz") ? abschnitt("Mutterschutz: Ergebnis für schwangere und stillende Frauen", absatz(text(d, "mutterschutz_ergebnis"))) : "") +
        (text(d, "wirksamkeit_am") || text(d, "wirksamkeit") ? abschnitt("Überprüfung der Wirksamkeit", angaben([["Überprüft am", datumDe(text(d, "wirksamkeit_am"))], ["Ergebnis", text(d, "wirksamkeit")]])) : "") +
        unterschriften(["Ort, Datum", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

const ANLASS: Record<string, string> = { erst: "vor Arbeitsbeginn (Erstunterweisung)", wiederholung: "Wiederholung", anlass: "aus besonderem Anlass" };

export const unterweisung: Vorlage = {
  id: "unterweisung",
  titel: "Unterweisungsnachweis",
  beschreibung: "Wann du wen zu welchen Gefahren und Schutzmaßnahmen unterwiesen hast – mit Unterschriften der Teilnehmenden.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.erstunterweisung", "arbeitsschutz.unterweisung_wiederholen"],
  namensFeld: "thema",
  abschnitte: [
    {
      felder: [
        { id: "thema", art: "text", label: "Thema", hilfe: "z. B. Arbeitsschutz im Salon, Umgang mit Reinigungsmitteln", pflicht: true },
        { id: "anlass", art: "wahl", label: "Anlass", optionen: optionen(ANLASS), vorbelegung: "erst" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
        { id: "durchgefuehrt_von", art: "text", label: "Durchgeführt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Inhalt der Unterweisung", hilfe: "Die Gefährdungen und Schutzmaßnahmen aus deiner Gefährdungsbeurteilung, Verhalten im Notfall, Erste Hilfe", pflicht: true },
      ],
    },
    {
      titel: "Teilnehmende",
      hilfe: "Namen eintragen – im PDF unterschreibt jede Person daneben. Freie Zeilen kommen automatisch dazu.",
      felder: [{ id: "teilnehmer", art: "liste", label: "Teilnehmende", eintrag: "Person", titelFeld: "name", felder: [{ id: "name", art: "text", label: "Name", pflicht: true }] }],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Unterweisungsnachweis",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt:
        angaben([
          ["Thema", text(d, "thema")],
          ["Anlass", ANLASS[text(d, "anlass")] ?? ""],
          ["Datum", datumDe(text(d, "datum"))],
          ["Durchgeführt von", text(d, "durchgefuehrt_von")],
        ]) +
        abschnitt("Inhalt", absatz(text(d, "inhalt"))) +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich, dass ich an der Unterweisung teilgenommen und den Inhalt verstanden habe.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        unterschriften(["Unterschrift der unterweisenden Person"]),
    });
  },
};

export const gefahrstoffverzeichnis: Vorlage = {
  id: "gefahrstoffverzeichnis",
  querformat: true,
  titel: "Gefahrstoffverzeichnis",
  beschreibung: "Alle Gefahrstoffe im Betrieb mit Verwendung, Menge, Arbeitsbereich und Sicherheitsdatenblatt.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  abschnitte: [
    { felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true }] },
    {
      titel: "Gefahrstoffe",
      hilfe: "Die Angaben stehen auf dem Etikett und im Sicherheitsdatenblatt des Herstellers.",
      felder: [
        {
          id: "stoffe",
          art: "liste",
          label: "Gefahrstoffe",
          eintrag: "Gefahrstoff",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Produkt / Bezeichnung", pflicht: true },
            { id: "hersteller", art: "text", label: "Hersteller" },
            { id: "gefahren", art: "text", label: "Gefahrenhinweise / Piktogramme", hilfe: "laut Etikett oder Sicherheitsdatenblatt" },
            { id: "verwendung", art: "text", label: "Verwendung" },
            { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich" },
            { id: "menge", art: "text", label: "Menge im Betrieb", hilfe: "ungefähr, z. B. 2 × 1 Liter" },
            { id: "sdb_vorhanden", art: "schalter", label: "Sicherheitsdatenblatt liegt vor" },
            { id: "sdb_stand", art: "datum", label: "Stand des Sicherheitsdatenblatts", wenn: { feld: "sdb_vorhanden" } },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const s = liste(d, "stoffe").filter((x) => text(x, "bezeichnung"));
    const zeilen = s.map((x) => [
      `<strong>${zelle(text(x, "bezeichnung"))}</strong>${text(x, "hersteller") ? `<br>${zelle(text(x, "hersteller"))}` : ""}`,
      zelle(text(x, "gefahren")),
      zelle(text(x, "verwendung")),
      zelle(text(x, "arbeitsbereich")),
      zelle(text(x, "menge")),
      ja(x, "sdb_vorhanden") ? `liegt vor${text(x, "sdb_stand") ? `<br>Stand ${datumDe(text(x, "sdb_stand"))}` : ""}` : "<strong>fehlt</strong>",
    ]);
    return dokument({
      titel: "Gefahrstoffverzeichnis",
      betrieb: b,
      quer: true,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt: s.length
        ? tabelle(["Produkt / Hersteller", "Gefahrenhinweise", "Verwendung", "Arbeitsbereich", "Menge", "Sicherheitsdatenblatt"], zeilen, { breiten: ["22%", "20%", "18%", "15%", "10%", "15%"] })
        : absatz("", "Keine Gefahrstoffe erfasst."),
    });
  },
};

const BA_TEILE: [string, string, string][] = [
  ["gefahren", "Gefahren für Mensch und Umwelt", "z. B. reizt die Haut, gesundheitsschädlich beim Einatmen – laut Sicherheitsdatenblatt"],
  ["schutz", "Schutzmaßnahmen und Verhaltensregeln", "z. B. Handschuhe tragen, für Lüftung sorgen, nicht essen und trinken"],
  ["gefahrfall", "Verhalten im Gefahrfall", "z. B. bei Verschütten: aufnehmen mit …, Raum lüften"],
  ["erste_hilfe", "Erste Hilfe", "nach Hautkontakt, Augenkontakt, Einatmen, Verschlucken – laut Sicherheitsdatenblatt"],
  ["entsorgung", "Sachgerechte Entsorgung", "z. B. Reste und Gebinde – laut Sicherheitsdatenblatt"],
];

export const betriebsanweisung: Vorlage = {
  id: "betriebsanweisung",
  titel: "Betriebsanweisung",
  beschreibung: "Aushang für einen Gefahrstoff oder eine Tätigkeit: Gefahren, Schutzmaßnahmen, Verhalten im Notfall, Erste Hilfe, Entsorgung.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  namensFeld: "stoff",
  abschnitte: [
    {
      felder: [
        { id: "stoff", art: "text", label: "Gefahrstoff oder Tätigkeit", hilfe: "z. B. Blondiermittel, Desinfektionsmittel XY", pflicht: true },
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich" },
      ],
    },
    {
      titel: "Inhalt",
      hilfe: "Die Angaben findest du im Sicherheitsdatenblatt des Herstellers.",
      felder: BA_TEILE.map(([id, label, hilfe]) => ({ id, art: "mehrzeilig" as const, label, hilfe, pflicht: true })),
    },
    {
      felder: [
        { id: "notruf", art: "text", label: "Notruf und Ansprechperson", hilfe: "z. B. Ersthelfer/in im Betrieb mit Telefonnummer" },
        { id: "erstellt_von", art: "text", label: "Erstellt von", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute" },
      ],
    },
  ],
  html(d: Daten, b) {
    const kaesten = BA_TEILE.map(([id, label]) => `<section class="kasten"><h2>${esc(label)}</h2><div class="inhalt">${absatz(text(d, id))}${id === "gefahrfall" && text(d, "notruf") ? `<p><strong>Notruf / Ansprechperson:</strong> ${esc(text(d, "notruf"))}</p>` : ""}</div></section>`).join("");
    return dokument({
      titel: "Betriebsanweisung",
      betrieb: b,
      unter: [text(d, "stoff"), text(d, "arbeitsbereich") ? `Arbeitsbereich: ${text(d, "arbeitsbereich")}` : ""].filter(Boolean).join(" · ") || undefined,
      meta: `Stand: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt: `<section class="kasten"><h2>Anwendungsbereich</h2><div class="inhalt">${angaben([["Gefahrstoff / Tätigkeit", text(d, "stoff")], ["Arbeitsbereich", text(d, "arbeitsbereich")]])}</div></section>${kaesten}${unterschriften([`Erstellt: ${text(d, "erstellt_von") || "…"}`, "Unterschrift"])}`,
    });
  },
};

const ERGEBNIS: Record<string, string> = { bestanden: "bestanden", maengel: "Mängel – nicht verwenden" };

export const elektroPruefung: Vorlage = {
  id: "pruefprotokoll_elektro",
  titel: "Prüfprotokoll elektrische Geräte (DGUV V3)",
  beschreibung: "Verzeichnis der geprüften Geräte mit Ergebnis und nächstem Prüftermin – zum Ausfüllen durch die Elektrofachkraft oder nach ihrem Bericht.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.dguv_v3"],
  querformat: true,
  namensFeld: "datum",
  abschnitte: [
    {
      hilfe: "Prüfen darf nur eine Elektrofachkraft (bzw. unter ihrer Leitung). Wie oft geprüft wird, legst du in der Gefährdungsbeurteilung fest.",
      felder: [
        { id: "pruefer", art: "text", label: "Prüfende Elektrofachkraft / Firma", pflicht: true },
        { id: "datum", art: "datum", label: "Prüfdatum", vorbelegung: "heute", pflicht: true },
        { id: "messgeraet", art: "text", label: "Verwendetes Prüfgerät" },
        { id: "leerzeilen", art: "schalter", label: "Leere Zeilen zum Ausfüllen von Hand anhängen", vorbelegung: false },
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
            { id: "bezeichnung", art: "text", label: "Gerät", hilfe: "z. B. Föhn, Kaffeemaschine, Verlängerungskabel", pflicht: true },
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
    return dokument({
      titel: "Prüfprotokoll elektrische Geräte",
      betrieb: b,
      quer: true,
      meta: `Prüfdatum: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt:
        angaben([["Geprüft von", text(d, "pruefer")], ["Prüfgerät", text(d, "messgeraet") || null]]) +
        `<section class="abschnitt">${tabelle(
          ["Gerät", "Hersteller / Typ", "Inventar-Nr.", "Standort", "Ergebnis", "Nächste Prüfung"],
          g.map((x) => [`<strong>${zelle(text(x, "bezeichnung"))}</strong>`, zelle(text(x, "typ")), zelle(text(x, "inventar")), zelle(text(x, "standort")), text(x, "ergebnis") === "maengel" ? `<strong>Mängel:</strong> ${zelle(text(x, "maengel"))}` : "bestanden", datumDe(text(x, "naechste"))]),
          { breiten: ["20%", "18%", "12%", "15%", "20%", "15%"], leerzeilen: ja(d, "leerzeilen") ? 12 : 0, hoch: ja(d, "leerzeilen") },
        )}</section>` +
        unterschriften(["Ort, Datum", "Unterschrift Elektrofachkraft"]),
    });
  },
};
