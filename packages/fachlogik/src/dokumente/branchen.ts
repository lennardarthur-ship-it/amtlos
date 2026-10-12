/** Branchen: Gastronomie (IfSG-Belehrung, Allergene, HACCP) und Beauty (Hautschutzplan, Hygieneplan). */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { abschnitt, absatz, angaben, auswahl, datumDe, dokument, esc, ja, liste, tabelle, text, unterschriften, zelle } from "./html.js";
import { ALLERGENE, optionen } from "./konstanten.js";
import type { Vorlage } from "./typen.js";

export const ifsgBelehrung: Vorlage = {
  id: "ifsg_belehrung",
  titel: "Belehrung nach § 43 IfSG (Folgebelehrung)",
  beschreibung: "Nachweis, dass du die Beschäftigten im Umgang mit Lebensmitteln belehrt hast – mit dem Datum der Erstbelehrung und Unterschriften.",
  bereich: "gastro",
  pflichten: ["branche.gastro_ifsg_belehrung"],
  abschnitte: [
    {
      hilfe: "Die Erstbelehrung macht das Gesundheitsamt oder eine beauftragte Ärztin bzw. ein beauftragter Arzt. Die Bescheinigung bewahrst du auf.",
      felder: [
        { id: "datum", art: "datum", label: "Datum der Belehrung", vorbelegung: "heute", pflicht: true },
        { id: "belehrt_von", art: "text", label: "Belehrt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Inhalt der Belehrung", hilfe: "z. B. nach dem Merkblatt deines Gesundheitsamts", pflicht: true },
      ],
    },
    {
      titel: "Teilnehmende",
      felder: [
        {
          id: "teilnehmer",
          art: "liste",
          label: "Teilnehmende",
          eintrag: "Person",
          titelFeld: "name",
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "erstbelehrung_am", art: "datum", label: "Bescheinigung der Erstbelehrung vom" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Belehrung nach § 43 Infektionsschutzgesetz",
      betrieb: b,
      unter: "Folgebelehrung durch den Arbeitgeber",
      meta: `Datum: ${datumDe(text(d, "datum")) || "–"}`,
      inhalt:
        angaben([["Datum", datumDe(text(d, "datum"))], ["Belehrt von", text(d, "belehrt_von")]]) +
        abschnitt("Inhalt", absatz(text(d, "inhalt"))) +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich, dass ich belehrt wurde.</p>${teilnahmeTabelle(liste(d, "teilnehmer"), { kopf: "Erstbelehrung vom", feld: "erstbelehrung_am", datum: true })}`) +
        unterschriften(["Unterschrift der belehrenden Person"]),
    });
  },
};

export const allergenAushang: Vorlage = {
  id: "allergene",
  titel: "Allergenliste",
  beschreibung: "Je Speise und Getränk die enthaltenen 14 Hauptallergene – zum Auslegen oder Aushängen für deine Gäste.",
  bereich: "gastro",
  pflichten: ["branche.gastro_allergene"],
  abschnitte: [
    { felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" }] },
    {
      titel: "Speisen und Getränke",
      felder: [
        {
          id: "gerichte",
          art: "liste",
          label: "Speisen und Getränke",
          eintrag: "Gericht",
          titelFeld: "name",
          pflicht: true,
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "kategorie", art: "text", label: "Kategorie", hilfe: "z. B. Frühstück, Kuchen, Getränke" },
            { id: "allergene", art: "mehrfach", label: "Enthaltene Allergene", optionen: optionen(ALLERGENE) },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const g = liste(d, "gerichte").filter((x) => text(x, "name"));
    const kategorien = [...new Set(g.map((x) => text(x, "kategorie")))];
    const inhalt = kategorien
      .map((k) => {
        const zeilen = g.filter((x) => text(x, "kategorie") === k).map((x) => {
          const a = auswahl(x, "allergene");
          return [`<strong>${zelle(text(x, "name"))}</strong>`, a.length ? a.map((y) => esc(ALLERGENE[y] ?? y)).join(", ") : "keine der 14 Hauptallergene angegeben"];
        });
        const t = tabelle(["Speise / Getränk", "Enthält"], zeilen, { breiten: ["40%", "60%"] });
        return k ? abschnitt(k, t) : `<section class="abschnitt">${t}</section>`;
      })
      .join("");
    return dokument({
      titel: "Allergene in unseren Speisen und Getränken",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt: (inhalt || absatz("", "Keine Gerichte erfasst.")) + `<p style="margin-top:6mm">Bei Fragen zu Allergenen und Zutaten sprechen Sie uns gern an.</p>`,
    });
  },
};

export const haccp: Vorlage = {
  id: "haccp",
  querformat: true,
  titel: "Eigenkontrollen (HACCP)",
  beschreibung: "Protokoll deiner Kontrollen, z. B. Kühltemperaturen – ausgefüllt oder als leeres Blatt zum Aushängen und Eintragen von Hand.",
  bereich: "gastro",
  pflichten: ["branche.gastro_haccp"],
  namensFeld: "zeitraum",
  abschnitte: [
    {
      felder: [
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "kontrollpunkte", art: "mehrzeilig", label: "Kontrollpunkte und Grenzwerte", hilfe: "z. B. Kühlschrank 1: Sollwert laut deinem HACCP-Konzept" },
        { id: "leerzeilen", art: "schalter", label: "Leere Zeilen zum Eintragen von Hand anhängen", vorbelegung: true },
      ],
    },
    {
      titel: "Messungen",
      hilfe: "Optional – wenn du lieber auf Papier einträgst, lass die Liste leer.",
      felder: [
        {
          id: "messungen",
          art: "liste",
          label: "Messungen",
          eintrag: "Messung",
          titelFeld: "kontrollpunkt",
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            { id: "uhrzeit", art: "uhrzeit", label: "Uhrzeit" },
            { id: "kontrollpunkt", art: "text", label: "Kontrollpunkt", hilfe: "z. B. Kühlschrank 1", pflicht: true },
            { id: "wert", art: "text", label: "Messwert", hilfe: "z. B. 5 °C", pflicht: true },
            { id: "in_ordnung", art: "wahl", label: "In Ordnung", optionen: [{ wert: "ja", text: "ja" }, { wert: "nein", text: "nein" }], vorbelegung: "ja" },
            { id: "massnahme", art: "text", label: "Korrekturmaßnahme", wenn: { feld: "in_ordnung", ist: "nein" }, pflicht: true },
            { id: "kuerzel", art: "text", label: "Kürzel" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const m = liste(d, "messungen").filter((x) => text(x, "kontrollpunkt") || text(x, "wert"));
    const zeilen = m.map((x) => [
      `${datumDe(text(x, "datum"))}${text(x, "uhrzeit") ? ` ${esc(text(x, "uhrzeit"))}` : ""}`,
      zelle(text(x, "kontrollpunkt")),
      zelle(text(x, "wert")),
      text(x, "in_ordnung") === "nein" ? "<strong>nein</strong>" : "ja",
      zelle(text(x, "massnahme")),
      zelle(text(x, "kuerzel")),
    ]);
    return dokument({
      titel: "Eigenkontrollen",
      betrieb: b,
      unter: text(d, "zeitraum") || undefined,
      quer: true,
      inhalt:
        (text(d, "kontrollpunkte") ? abschnitt("Kontrollpunkte und Grenzwerte", absatz(text(d, "kontrollpunkte"))) : "") +
        `<section class="abschnitt">${tabelle(["Datum / Uhrzeit", "Kontrollpunkt", "Messwert", "In Ordnung", "Korrekturmaßnahme", "Kürzel"], zeilen, { breiten: ["15%", "22%", "12%", "10%", "31%", "10%"], leerzeilen: ja(d, "leerzeilen") ? 14 : 0, hoch: ja(d, "leerzeilen") })}</section>`,
    });
  },
};

/** Tabelle als Plan zum Aushängen (Hautschutz, Hygiene). */
function plan(o: { titel: string; unter?: string; d: Parameters<Vorlage["html"]>[0]; b: Parameters<Vorlage["html"]>[1]; spalten: [string, string, string][]; feld: string }): string {
  const eintraege = liste(o.d, o.feld).filter((x) => o.spalten.some(([id]) => text(x, id)));
  return dokument({
    titel: o.titel,
    betrieb: o.b,
    unter: o.unter,
    quer: true,
    meta: `Stand: ${datumDe(text(o.d, "datum")) || "–"}`,
    inhalt:
      (eintraege.length ? tabelle(o.spalten.map(([, k]) => k), eintraege.map((x) => o.spalten.map(([id], i) => (i === 0 ? `<strong>${zelle(text(x, id))}</strong>` : zelle(text(x, id))))), { breiten: o.spalten.map(([, , w]) => w) }) : absatz("", "Noch keine Einträge.")) +
      angaben([["Erstellt von", text(o.d, "erstellt_von")]]) +
      unterschriften(["Ort, Datum", "Unterschrift"]),
  });
}

const HAUT: [string, string, string][] = [
  ["anlass", "Tätigkeit / Anlass", "22%"],
  ["schutz", "Hautschutz", "22%"],
  ["reinigung", "Hautreinigung", "18%"],
  ["pflege", "Hautpflege", "18%"],
  ["handschuhe", "Schutzhandschuhe", "20%"],
];

export const hautschutzplan: Vorlage = {
  id: "hautschutzplan",
  querformat: true,
  titel: "Hautschutzplan",
  beschreibung: "Aushang: wann welcher Hautschutz, welche Reinigung und welche Pflege – bei Feuchtarbeit und hautbelastenden Stoffen.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hautschutzplan"],
  namensFeld: "bereich",
  abschnitte: [
    { felder: [{ id: "bereich", art: "text", label: "Bereich", hilfe: "z. B. Salon, Kosmetikkabine" }] },
    {
      titel: "Einträge",
      hilfe: "Je Tätigkeit eine Zeile, mit den Produkten, die bei dir verwendet werden.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Einträge",
          eintrag: "Tätigkeit",
          titelFeld: "anlass",
          pflicht: true,
          felder: [
            { id: "anlass", art: "text", label: "Tätigkeit / Anlass", hilfe: "z. B. Haare waschen, Färben", pflicht: true },
            { id: "schutz", art: "text", label: "Hautschutz", hilfe: "Produkt und wann" },
            { id: "reinigung", art: "text", label: "Hautreinigung", hilfe: "Produkt und wann" },
            { id: "pflege", art: "text", label: "Hautpflege", hilfe: "Produkt und wann" },
            { id: "handschuhe", art: "text", label: "Schutzhandschuhe", hilfe: "Art, falls nötig" },
          ],
        },
      ],
    },
    {
      felder: [
        { id: "erstellt_von", art: "text", label: "Erstellt von", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute" },
      ],
    },
  ],
  html: (d, b) => plan({ titel: "Hautschutzplan", unter: text(d, "bereich") || undefined, d, b, spalten: HAUT, feld: "eintraege" }),
};

const HYGIENE: [string, string, string][] = [
  ["was", "Was", "20%"],
  ["wann", "Wann / wie oft", "16%"],
  ["womit", "Womit", "22%"],
  ["wie", "Wie", "28%"],
  ["wer", "Wer", "14%"],
];

export const hygieneplan: Vorlage = {
  id: "hygieneplan",
  querformat: true,
  titel: "Hygieneplan",
  beschreibung: "Aushang: was wann womit und wie gereinigt und desinfiziert wird und wer es macht – Hände, Geräte, Flächen.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hygieneplan"],
  namensFeld: "bereich",
  abschnitte: [
    { hilfe: "Welche Anforderungen genau gelten, regelt die Hygieneverordnung deines Bundeslands.", felder: [{ id: "bereich", art: "text", label: "Bereich", hilfe: "z. B. Kosmetik, Fußpflege, Nagelstudio" }] },
    {
      titel: "Einträge",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Einträge",
          eintrag: "Eintrag",
          titelFeld: "was",
          pflicht: true,
          felder: [
            { id: "was", art: "text", label: "Was", hilfe: "z. B. Hände, Instrumente, Liege, Fußboden", pflicht: true },
            { id: "wann", art: "text", label: "Wann / wie oft", hilfe: "z. B. vor jeder Behandlung, täglich" },
            { id: "womit", art: "text", label: "Womit", hilfe: "Mittel, Konzentration, Einwirkzeit" },
            { id: "wie", art: "mehrzeilig", label: "Wie", hilfe: "Ablauf in Stichworten" },
            { id: "wer", art: "text", label: "Wer" },
          ],
        },
      ],
    },
    {
      felder: [
        { id: "erstellt_von", art: "text", label: "Erstellt von", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute" },
      ],
    },
  ],
  html: (d, b) => plan({ titel: "Hygieneplan", unter: text(d, "bereich") || undefined, d, b, spalten: HYGIENE, feld: "eintraege" }),
};
