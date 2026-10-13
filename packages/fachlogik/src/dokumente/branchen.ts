/**
 * Branchen (E-121, E-123): Gastronomie (Folgebelehrung § 43 IfSG, Allergenliste, Eigenkontrollen HACCP) und Beauty
 * (Hautschutzplan, Hygieneplan). Inhalte aus der Recherche (bausteine.ts): Gesetzestexte, Lebensmittelüberwachung,
 * Rahmenhygienepläne, BGW.
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { ALLERGENE_UMFANG, HACCP, HAUTSCHUTZ_FRISEUR, HYGIENE, IFSG, LOSE_WARE } from "./bausteine.js";
import { abschnitt, absatz, auswahl, datumDe, dokument, esc, ja, liste, plusMonate, punkte, tabelle, text, unterschriften, zelle } from "./html.js";
import { ALLERGENE, optionen } from "./konstanten.js";
import type { Vorlage } from "./typen.js";

export const ifsgBelehrung: Vorlage = {
  id: "ifsg_belehrung",
  titel: "Belehrung nach § 43 IfSG (Folgebelehrung)",
  beschreibung: "Nachweis der Belehrung durch den Arbeitgeber nach Aufnahme der Tätigkeit und danach alle zwei Jahre – Inhalte nach §§ 42, 43 IfSG, mit Unterschriften.",
  bereich: "gastro",
  pflichten: ["branche.gastro_ifsg_belehrung"],
  grundlage: "§ 43 Abs. 4 und 5 IfSG",
  abschnitte: [
    { titel: "Belehrung",
      hilfe: "Die Erstbelehrung macht das Gesundheitsamt oder eine beauftragte Ärztin bzw. ein beauftragter Arzt; die Bescheinigung darf bei Arbeitsbeginn höchstens drei Monate alt sein. Bescheinigung und letzte Dokumentation bewahrst du im Betrieb auf.",
      felder: [
        { id: "datum", art: "datum", label: "Datum der Belehrung", vorbelegung: "heute", pflicht: true },
        { id: "belehrt_von", art: "text", label: "Belehrt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "inhalte", art: "bausteine", label: "Inhalte der Belehrung", optionen: IFSG.inhalte.map((t) => ({ wert: t, text: t, quelle: "§§ 42, 43 IfSG" })), vorbelegung: IFSG.inhalte.slice(0, 5), pflicht: true },
        { id: "liste_anhaengen", art: "schalter", label: "Tätigkeitsverbote und Lebensmittel nach § 42 IfSG im Dokument aufführen", vorbelegung: true },
      ],
    },
    {
      titel: "Teilnehmende",
      felder: [
        {
          id: "teilnehmer",
          art: "liste", ausMitarbeitern: true,
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
    const naechste = plusMonate(text(d, "datum"), 24);
    const inhalte = auswahl(d, "inhalte");
    return dokument({
      titel: "Belehrung nach § 43 Infektionsschutzgesetz",
      betrieb: b,
      unter: "Belehrung durch den Arbeitgeber (§ 43 Abs. 4 IfSG)",
      meta: `Datum: ${datumDe(text(d, "datum"))}\nBelehrt von: ${text(d, "belehrt_von")}\nNächste Belehrung: ${naechste ? `bis ${naechste}` : ""}`,
      inhalt:
        abschnitt("Inhalte der Belehrung", inhalte.length ? punkte(inhalte) : absatz("")) +
        (ja(d, "liste_anhaengen")
          ? abschnitt(
              "Tätigkeitsverbote nach § 42 Abs. 1 IfSG",
              `<p>Folgende Personen dürfen nicht tätig sein oder beschäftigt werden a) beim Herstellen, Behandeln oder Inverkehrbringen der unten genannten Lebensmittel, wenn sie dabei mit diesen in Berührung kommen, oder b) in Küchen von Gaststätten und sonstigen Einrichtungen mit oder zur Gemeinschaftsverpflegung:</p>${punkte(IFSG.personen)}<h3>Lebensmittel nach § 42 Abs. 2 IfSG</h3>${punkte(IFSG.lebensmittel)}`,
            )
          : "") +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich, dass ich belehrt wurde und mir keine Tatsachen für ein Tätigkeitsverbot bekannt sind. Treten Hinderungsgründe auf, teile ich dies unverzüglich mit.</p>${teilnahmeTabelle(liste(d, "teilnehmer"), { kopf: "Erstbelehrung vom", feld: "erstbelehrung_am", datum: true })}`) +
        `<p class="klein" style="margin-top:4mm">Die Belehrung ist nach Aufnahme der Tätigkeit und danach alle zwei Jahre zu wiederholen und zu dokumentieren (§ 43 Abs. 4 IfSG)${naechste ? ` – nächste Belehrung spätestens am ${naechste}` : ""}.</p>` +
        unterschriften(["Ort, Datum", "Unterschrift der belehrenden Person"]),
    });
  },
};

const LOSE_HINWEIS = "Informationen zu Allergenen erhalten Sie in dieser Übersicht und auf Nachfrage bei unserem Personal.";

export const allergenAushang: Vorlage = {
  id: "allergene",
  gestalt: "aushang",
  titel: "Allergenliste",
  beschreibung: "Je Speise und Getränk die enthaltenen 14 Hauptallergene nach Anhang II LMIV – zum Auslegen oder Aushängen, mit Erläuterung der Allergene.",
  bereich: "gastro",
  pflichten: ["branche.gastro_allergene"],
  grundlage: "Art. 9, 44 LMIV; § 4 LMIDV",
  abschnitte: [
    { titel: "Stand", felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" }, { id: "legende", art: "schalter", label: "Erläuterung der 14 Allergene anfügen", vorbelegung: true }] },
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
            { id: "kategorie", art: "text", label: "Kategorie", vorschlaege: ["Frühstück", "Vorspeisen", "Hauptgerichte", "Desserts", "Kuchen und Torten", "Snacks", "Heißgetränke", "Kaltgetränke"] },
            { id: "allergene", art: "mehrfach", label: "Enthält", optionen: optionen(ALLERGENE) },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const g = liste(d, "gerichte").filter((x) => text(x, "name"));
    const kategorien = [...new Set(g.map((x) => text(x, "kategorie")))];
    const nummern = Object.keys(ALLERGENE);
    const inhalt = kategorien
      .map((k) => {
        const zeilenHtml = g.filter((x) => text(x, "kategorie") === k).map((x) => {
          const a = auswahl(x, "allergene");
          return [`<strong>${zelle(text(x, "name"))}</strong>`, a.length ? `Enthält: ${a.map((y) => esc(ALLERGENE[y] ?? y)).join(", ")}` : "keine der 14 Hauptallergene"];
        });
        const t = tabelle(["Speise / Getränk", "Allergene"], zeilenHtml, { breiten: ["40%", "60%"] });
        return k ? abschnitt(k, t) : `<section class="abschnitt">${t}</section>`;
      })
      .join("");
    const legende = ja(d, "legende")
      ? abschnitt("Die 14 Hauptallergene (Anhang II LMIV)", tabelle(["Allergen", "umfasst"], nummern.map((id, i) => [esc(ALLERGENE[id]!), esc(ALLERGENE_UMFANG[i]?.umfasst ?? "")]), { breiten: ["30%", "70%"] }))
      : "";
    return dokument({
      titel: "Allergene in unseren Speisen und Getränken",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand"))}`,
      inhalt: (inhalt || absatz("", "Keine Gerichte erfasst.")) + `<p style="margin-top:6mm">${esc(LOSE_HINWEIS)}</p>` + legende + `<p class="klein">${esc(LOSE_WARE.rechtsgrundlage)}</p>`,
    });
  },
};

export const haccp: Vorlage = {
  id: "haccp",
  titel: "Eigenkontrollen (HACCP)",
  beschreibung: "Kontrollpunkte mit Grenzwerten und Korrekturmaßnahmen aus Merkblättern der Lebensmittelüberwachung – plus Messprotokoll, ausgefüllt oder zum Eintragen von Hand.",
  bereich: "gastro",
  pflichten: ["branche.gastro_haccp"],
  grundlage: "Art. 5 VO (EG) Nr. 852/2004",
  querformat: true,
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum",
      felder: [
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "leerzeilen", selten: true, art: "schalter", label: "Leere Zeilen zum Eintragen von Hand anhängen", vorbelegung: true },
      ],
    },
    {
      titel: "Kontrollpunkte",
      hilfe: "Wähle die Kontrollpunkte deines Betriebs – Grenzwerte und Korrekturmaßnahmen sind vorbereitet und anpassbar.",
      felder: [
        {
          id: "punkte",
          art: "liste",
          label: "Kontrollpunkte",
          eintrag: "Kontrollpunkt",
          titelFeld: "punkt",
          pflicht: true,
          leerStarten: true,
          vorschlaege: HACCP,
          felder: [
            { id: "punkt", art: "text", label: "Kontrollpunkt", pflicht: true },
            { id: "grenzwert", art: "text", label: "Grenzwert", pflicht: true },
            { id: "haeufigkeit", art: "text", label: "Häufigkeit", vorschlaege: ["täglich", "bei jeder Lieferung", "wöchentlich"] },
            { id: "korrektur", art: "mehrzeilig", label: "Korrekturmaßnahme", pflicht: true },
          ],
        },
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
          leerStarten: true,
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            { id: "uhrzeit", art: "uhrzeit", label: "Uhrzeit" },
            { id: "kontrollpunkt", art: "text", label: "Kontrollpunkt", pflicht: true },
            { id: "wert", art: "text", label: "Messwert", hilfe: "z. B. 5 °C", pflicht: true },
            { id: "in_ordnung", art: "wahl", label: "In Ordnung", optionen: [{ wert: "ja", text: "ja" }, { wert: "nein", text: "nein" }], vorbelegung: "ja" },
            { id: "massnahme", art: "text", label: "Korrekturmaßnahme", wenn: { feld: "in_ordnung", ist: "nein" }, pflicht: true },
            { id: "kuerzel", selten: true, art: "text", label: "Kürzel" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const p = liste(d, "punkte").filter((x) => text(x, "punkt"));
    const m = liste(d, "messungen").filter((x) => text(x, "kontrollpunkt") || text(x, "wert"));
    return dokument({
      titel: "Eigenkontrollen",
      betrieb: b,
      unter: text(d, "zeitraum") || undefined,
      quer: true,
      meta: `Zeitraum: ${text(d, "zeitraum")}\nKontrollpunkte: ${p.length}`,
      inhalt:
        abschnitt("Kontrollpunkte, Grenzwerte und Korrekturmaßnahmen", p.length ? tabelle(["Kontrollpunkt", "Grenzwert", "Häufigkeit", "Korrekturmaßnahme"], p.map((x) => [`<strong>${zelle(text(x, "punkt"))}</strong>`, zelle(text(x, "grenzwert")), zelle(text(x, "haeufigkeit")), zelle(text(x, "korrektur"))]), { breiten: ["22%", "22%", "14%", "42%"] }) : absatz("")) +
        abschnitt(
          "Messprotokoll",
          tabelle(
            ["Datum / Uhrzeit", "Kontrollpunkt", "Messwert", "In Ordnung", "Korrekturmaßnahme", "Kürzel"],
            m.map((x) => [`${datumDe(text(x, "datum"))}${text(x, "uhrzeit") ? ` ${esc(text(x, "uhrzeit"))}` : ""}`, zelle(text(x, "kontrollpunkt")), zelle(text(x, "wert")), text(x, "in_ordnung") === "nein" ? "<strong>nein</strong>" : "ja", zelle(text(x, "massnahme")), zelle(text(x, "kuerzel"))]),
            { breiten: ["15%", "22%", "12%", "10%", "31%", "10%"], leerzeilen: ja(d, "leerzeilen") ? 14 : 0, hoch: ja(d, "leerzeilen") },
          ),
        ),
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
    meta: `Bereich: ${text(o.d, "bereich")}\nStand: ${datumDe(text(o.d, "datum"))}\nVerantwortlich: ${text(o.d, "erstellt_von")}`,
    inhalt:
      (eintraege.length ? tabelle(o.spalten.map(([, k]) => k), eintraege.map((x) => o.spalten.map(([id], i) => (i === 0 ? `<strong>${zelle(text(x, id))}</strong>` : zelle(text(x, id))))), { breiten: o.spalten.map(([, , w]) => w) }) : absatz("", "Noch keine Einträge.")) +
      unterschriften(["Ort, Datum", "Unterschrift Verantwortliche/r"]),
  });
}

const HAUT: [string, string, string][] = [
  ["anlass", "Tätigkeit", "22%"],
  ["schutz", "Hautschutz vor der Tätigkeit", "18%"],
  ["handschuhe", "Schutzhandschuhe", "22%"],
  ["reinigung", "Hautreinigung", "19%"],
  ["pflege", "Hautpflege", "19%"],
];

export const hautschutzplan: Vorlage = {
  id: "hautschutzplan",
  gestalt: "aushang",
  titel: "Hautschutzplan",
  beschreibung: "Aushang: wann welcher Hautschutz, welche Handschuhe, welche Reinigung und Pflege – mit den Zeilen aus dem Muster-Hautschutzplan der TRGS 530 und der BGW.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hautschutzplan"],
  grundlage: "TRGS 401; TRGS 530",
  querformat: true,
  namensFeld: "bereich",
  abschnitte: [
    { titel: "Bereich", felder: [{ id: "bereich", art: "text", label: "Bereich", vorschlaege: ["Salon", "Kosmetikkabine", "Nagelstudio"] }] },
    {
      titel: "Tätigkeiten",
      hilfe: "Wähle die Tätigkeiten aus dem Muster und trage die Produkte ein, die bei dir verwendet werden.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Tätigkeiten",
          eintrag: "Tätigkeit",
          titelFeld: "anlass",
          pflicht: true,
          leerStarten: true,
          vorschlaege: HAUTSCHUTZ_FRISEUR,
          felder: [
            { id: "anlass", art: "text", label: "Tätigkeit", pflicht: true },
            { id: "schutz", art: "text", label: "Hautschutz vor der Tätigkeit", hilfe: "Produkt" },
            { id: "handschuhe", art: "text", label: "Schutzhandschuhe" },
            { id: "reinigung", art: "text", label: "Hautreinigung" },
            { id: "pflege", art: "text", label: "Hautpflege" },
          ],
        },
      ],
    },
    { titel: "Verantwortlich und Stand",
      felder: [
        { id: "erstellt_von", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  html: (d, b) => plan({ titel: "Hautschutzplan", unter: text(d, "bereich") || undefined, d, b, spalten: HAUT, feld: "eintraege" }),
};

const HYGIENE_SPALTEN: [string, string, string][] = [
  ["was", "Was", "18%"],
  ["wann", "Wann / wie oft", "20%"],
  ["womit", "Womit", "20%"],
  ["wie", "Wie", "30%"],
  ["wer", "Wer", "12%"],
];

export const hygieneplan: Vorlage = {
  id: "hygieneplan",
  gestalt: "aushang",
  titel: "Hygieneplan",
  beschreibung: "Aushang: was wann womit und wie gereinigt und desinfiziert wird und wer es macht – mit Zeilen aus Rahmenhygieneplänen und dem BGW-Hygieneplan.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hygieneplan"],
  grundlage: "Hygieneverordnung des Landes (auf Grundlage des IfSG)",
  querformat: true,
  namensFeld: "bereich",
  abschnitte: [
    { titel: "Bereich", hilfe: "Welche Anforderungen genau gelten, regelt die Hygieneverordnung deines Bundeslands. Desinfektionsmittel nach Herstellerangabe bzw. VAH-Liste einsetzen.", felder: [{ id: "bereich", art: "text", label: "Bereich", vorschlaege: ["Friseursalon", "Kosmetik", "Nagelstudio", "Fußpflege"] }] },
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
          leerStarten: true,
          vorschlaege: HYGIENE,
          felder: [
            { id: "was", art: "text", label: "Was", pflicht: true },
            { id: "wann", art: "text", label: "Wann / wie oft" },
            { id: "womit", art: "text", label: "Womit" },
            { id: "wie", art: "mehrzeilig", label: "Wie" },
            { id: "wer", art: "text", label: "Wer" },
          ],
        },
      ],
    },
    { titel: "Verantwortlich und Stand",
      felder: [
        { id: "erstellt_von", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  html: (d, b) => plan({ titel: "Hygieneplan", unter: text(d, "bereich") || undefined, d, b, spalten: HYGIENE_SPALTEN, feld: "eintraege" }),
};
