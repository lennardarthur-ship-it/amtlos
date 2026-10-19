/**
 * Branchen (E-121, E-123): Gastronomie (Folgebelehrung § 43 IfSG, Allergenliste, Eigenkontrollen HACCP) und Beauty
 * (Hautschutzplan, Hygieneplan). Inhalte aus der Recherche (bausteine.ts): Gesetzestexte, Lebensmittelüberwachung,
 * Rahmenhygienepläne, BGW.
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { ALLERGENE_UMFANG, HACCP, HAUTSCHUTZ_FRISEUR, HYGIENE, IFSG, LOSE_WARE } from "./bausteine.js";
import { KOPF_LINIE, abschnitt, absatz, angaben, auswahl, datumDe, dokument, esc, ja, liste, nachsatz, plusMonate, punkte, tabelle, text, unterschriften, zelle } from "./html.js";
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
              `<p>Folgende Personen dürfen nicht tätig sein oder beschäftigt werden a) beim Herstellen, Behandeln oder Inverkehrbringen der unten genannten Lebensmittel, wenn sie dabei mit diesen in Berührung kommen, oder b) in Küchen von Gaststätten und sonstigen Einrichtungen mit oder zur Gemeinschaftsverpflegung:</p>${punkte(IFSG.personen)}<h3>Lebensmittel nach § 42 Abs. 2 IfSG</h3>${nummernListe(IFSG.lebensmittel)}`,
            )
          : "") +
        abschnitt("Teilnahme", `<p>Mit meiner Unterschrift bestätige ich, dass ich belehrt wurde und mir keine Tatsachen für ein Tätigkeitsverbot bekannt sind. Treten Hinderungsgründe auf, teile ich dies unverzüglich mit.</p>${teilnahmeTabelle(liste(d, "teilnehmer"), { kopf: "Erstbelehrung vom", feld: "erstbelehrung_am", datum: true })}`) +
        nachsatz(`Die Belehrung ist nach Aufnahme der Tätigkeit und danach alle zwei Jahre zu wiederholen und zu dokumentieren (§ 43 Abs. 4 IfSG)${naechste ? `, nächste Belehrung spätestens am ${naechste}` : ""}.`) +
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
  // Aushang für Gäste: ohne interne Bereichsangabe und Rechtsgrundlage im Kopf (die steht als Fußnote am Ende)
  ohneKopfangaben: true,
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
            // ausdrückliche Bestätigung: ohne sie steht kein „keines der 14 Hauptallergene“ auf dem Aushang
            { id: "keine", art: "schalter", label: "Enthält keines der 14 Hauptallergene" },
          ],
        },
      ],
    },
  ],
  pruefen(d) {
    // Ohne Kreuz ist nicht gesagt, dass ein Gericht allergenfrei ist – vergessen und „enthält keines“ sehen sonst gleich aus
    return liste(d, "gerichte")
      .filter((x) => text(x, "name"))
      .flatMap((x) => {
        const a = auswahl(x, "allergene").length > 0;
        if (!a && !ja(x, "keine")) return [`Gericht „${text(x, "name")}“: Allergene ankreuzen oder „enthält keines“ bestätigen`];
        if (a && ja(x, "keine")) return [`Gericht „${text(x, "name")}“: „enthält keines der 14 Hauptallergene“ bestätigt, aber Allergene angekreuzt – bitte prüfen.`];
        return [];
      });
  },
  html(d, b) {
    const g = liste(d, "gerichte").filter((x) => text(x, "name"));
    const kategorien = [...new Set(g.map((x) => text(x, "kategorie")))];
    const nummern = Object.keys(ALLERGENE);
    // Matrix: eine Zeile je Speise, eine Spalte je Allergen (× = enthalten); je Kategorie eine Zeilengruppe mit
    // Zwischenzeile, damit die Kategorie nicht allein am Seitenende steht
    const kopf = `<thead><tr><th>Speise / Getränk</th>${nummern.map((id) => `<th class="dreh">${esc(ALLERGENE[id]!)}</th>`).join("")}</tr></thead>`;
    const zeilenHtml = kategorien
      .map((k) => {
        const zeilen = g.filter((x) => text(x, "kategorie") === k).map((x) => {
          const a = auswahl(x, "allergene");
          // „keines“ nur ausdrücklich bestätigt und ohne angekreuztes Allergen; sonst (nicht ausgefüllt, Widerspruch) kein Vermerk
          const keine = ja(x, "keine") && !a.length;
          return `<tr><td><strong>${zelle(text(x, "name"))}</strong>${keine ? '<br><span class="klein">keines der 14 Hauptallergene</span>' : ""}</td>${nummern.map((id) => `<td class="x">${a.includes(id) ? "×" : ""}</td>`).join("")}</tr>`;
        });
        return `<tbody${k ? ' class="gruppe-block"' : ""}>${k ? `<tr class="gruppe"><td colspan="${nummern.length + 1}"><strong>${zelle(k)}</strong></td></tr>` : ""}${zeilen.join("")}</tbody>`;
      })
      .join("");
    // ohne Gerichte: Matrix mit leeren Zeilen zum Ausfüllen von Hand
    const leereZeilen = `<tbody>${Array.from({ length: 12 }, () => `<tr><td>&nbsp;</td>${nummern.map(() => '<td class="x"></td>').join("")}</tr>`).join("")}</tbody>`;
    const inhalt = `<table class="liste matrix${g.length ? "" : " hoch"}"><colgroup><col style="width:37%">${nummern.map(() => `<col style="width:${(63 / nummern.length).toFixed(2)}%">`).join("")}</colgroup>${kopf}${g.length ? zeilenHtml : leereZeilen}</table>`;
    // leeres Blatt: die Matrix füllt die erste Seite, die Erläuterung folgt als eigenes Blatt; die Erläuterung bricht
    // nicht über zwei Seiten (Klasse „zusammen“)
    const legende = ja(d, "legende")
      ? abschnitt("Die 14 Hauptallergene nach Anhang II der LMIV", tabelle(["Allergen", "umfasst"], nummern.map((id, i) => [esc(ALLERGENE[id]!), esc(ALLERGENE_UMFANG[i]?.umfasst ?? "")]), { breiten: ["30%", "70%"], klasse: "legende" }), g.length ? "zusammen" : "neue-seite zusammen")
      : "";
    return dokument({
      titel: "Allergene in unseren Speisen und Getränken",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand"))}`,
      // die Rechtsgrundlage als Fußnote unter dem Hinweis – nach der Erläuterung rutschte sie allein auf eine neue Seite
      inhalt: inhalt + `<p style="margin-top:6mm">${esc(LOSE_HINWEIS)}</p>` + nachsatz(LOSE_WARE.rechtsgrundlage) + legende,
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
    // Grenzwert zur Messung aus den Kontrollpunkten (gleicher Name, ohne Groß-/Kleinschreibung und Leerzeichen am Rand)
    const norm = (t: string) => t.trim().toLocaleLowerCase("de");
    const grenzwert = (kp: string) => p.find((x) => norm(text(x, "punkt")) === norm(kp)) ?? null;
    const zeitraum = text(d, "zeitraum");
    return dokument({
      titel: "Eigenkontrollen",
      betrieb: b,
      unter: text(d, "zeitraum") || undefined,
      quer: true,
      meta: `Zeitraum: ${text(d, "zeitraum")}${p.length ? `\nKontrollpunkte: ${p.length}` : ""}`,
      inhalt:
        // die Kennungsleiste lässt einen leeren Zeitraum weg: dann ein Feld zum Eintragen
        (text(d, "zeitraum") ? "" : angaben([["Zeitraum", ""]])) +
        abschnitt(
          "Kontrollpunkte, Grenzwerte und Korrekturmaßnahmen",
          tabelle(["Kontrollpunkt", "Grenzwert", "Häufigkeit", "Korrekturmaßnahme"], p.map((x) => [`<strong>${zelle(text(x, "punkt"))}</strong>`, zelle(text(x, "grenzwert")), zelle(text(x, "haeufigkeit")), zelle(text(x, "korrektur"))]), { breiten: ["20%", "24%", "20%", "36%"], ...(p.length ? {} : { mindestens: 6, hoch: true }) }),
        ) +
        abschnitt(
          zeitraum ? `Messprotokoll · ${zeitraum}` : "Messprotokoll",
          tabelle(
            ["Datum / Uhrzeit", "Kontrollpunkt", "Grenzwert", "Messwert", "In Ordnung", "Korrekturmaßnahme", "Kürzel"],
            m.map((x) => {
              const kp = grenzwert(text(x, "kontrollpunkt"));
              return [`${datumDe(text(x, "datum"))}${text(x, "uhrzeit") ? ` ${esc(text(x, "uhrzeit"))}` : ""}`, zelle(text(x, "kontrollpunkt")), kp ? zelle(text(kp, "grenzwert")) : "", zelle(text(x, "wert")), text(x, "in_ordnung") === "nein" ? "<strong>nein</strong>" : "ja", zelle(text(x, "massnahme")), zelle(text(x, "kuerzel"))];
            }),
            { breiten: ["13%", "19%", "15%", "10%", "9%", "24%", "10%"], leerzeilen: ja(d, "leerzeilen") ? haccpLeerzeilen(m.length) : 0, hoch: ja(d, "leerzeilen") },
          ),
          // Protokoll als eigenes Blatt zum Aushängen (auch leer: davor steht die Tabelle der Kontrollpunkte)
          "neue-seite",
        ) +
        unterschriften(["Geprüft (Datum)", "Verantwortliche/r"]),
    });
  },
};

/**
 * Leere Zeilen im Messprotokoll, damit die Seite ungefähr voll wird, aber keine neue Seite nur mit Kopf und zwei
 * Zeilen entsteht (Querformat, Satzspiegel ca. 176 mm hoch). Das Protokoll beginnt auf einer eigenen Seite. Passen
 * höchstens drei, entfallen sie.
 */
function haccpLeerzeilen(messungen: number): number {
  const ZEILE = 8.2; // Zeile mit Mindesthöhe 8 mm samt Linie
  // eigene Seite: Überschrift und Tabellenkopf (26 mm), am Ende die Unterschriften (ca. 24 mm)
  const platz = Math.floor((176 - 26 - 24) / ZEILE);
  const frei = messungen < platz ? platz - messungen : (platz + 3 - ((messungen - platz) % (platz + 3))) % (platz + 3);
  return frei > 3 ? frei : 0;
}

/** Nummerierte Liste; Texte, die schon mit „1. “ beginnen, bekommen die Nummer nur einmal. */
function nummernListe(l: string[]): string {
  return `<ol class="nummern">${l.map((x) => `<li>${esc(x.replace(/^\d+\.\s*/, ""))}</li>`).join("")}</ol>`;
}

/** Tabelle als Plan zum Aushängen (Hautschutz, Hygiene). Viel Text → kompakter Satz, damit weniger Blätter nötig sind. */
function plan(o: { titel: string; unter?: string; d: Parameters<Vorlage["html"]>[0]; b: Parameters<Vorlage["html"]>[1]; spalten: [string, string, string][]; feld: string }): string {
  const eintraege = liste(o.d, o.feld).filter((x) => o.spalten.some(([id]) => text(x, id)));
  const zeichen = eintraege.reduce((n, x) => n + o.spalten.reduce((m, [id]) => m + text(x, id).length, 0), 0);
  return dokument({
    titel: o.titel,
    betrieb: o.b,
    unter: o.unter,
    quer: true,
    klasse: zeichen > 900 ? "kompakt" : undefined,
    // der Bereich steht schon als Unterzeile unter dem Titel
    // ohne Bereich: Linie zum Eintragen in der Kennungsleiste
    meta: `${o.unter ? "" : `Bereich: ${text(o.d, "bereich") || KOPF_LINIE}\n`}Stand: ${datumDe(text(o.d, "datum"))}\nVerantwortlich: ${text(o.d, "erstellt_von")}`,
    inhalt:
      // ohne Einträge: leere Tabelle zum Ausfüllen von Hand
      tabelle(o.spalten.map(([, k]) => k), eintraege.map((x) => o.spalten.map(([id], i) => (i === 0 ? `<strong>${zelle(text(x, id))}</strong>` : zelle(text(x, id))))), { breiten: o.spalten.map(([, , w]) => w), ...(eintraege.length ? {} : { mindestens: 6, hoch: true }) }) +
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
