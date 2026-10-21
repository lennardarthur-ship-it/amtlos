/**
 * Branchen (E-121, E-123): Gastronomie (Folgebelehrung § 43 IfSG, Allergenliste, Eigenkontrollen HACCP) und Beauty
 * (Hautschutzplan, Hygieneplan). Inhalte aus der Recherche (bausteine.ts): Gesetzestexte, Lebensmittelüberwachung,
 * Rahmenhygienepläne, BGW.
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { ALLERGENE_UMFANG, HACCP, HAUTSCHUTZ_FRISEUR, HYGIENE, IFSG, LOSE_WARE } from "./bausteine.js";
import { KOPF_LINIE, ZELLE_LINIE, abschnitt, absatz, angaben, auswahl, datumDe, dokument, esc, ja, liste, nachsatz, neufassung, plusMonate, punkte, stabileOption, tabelle, text, unterschriften, zelle } from "./html.js";
import { ALLERGENE, optionen } from "./konstanten.js";
import type { Betrieb, Daten, Eintrag, Vorlage, Vorschlag } from "./typen.js";

export const ifsgBelehrung: Vorlage = {
  id: "ifsg_belehrung",
  // „Folgebelehrung“ verwirrte bei neuen Kräften (R10): Es ist die Belehrung durch den Arbeitgeber, auch die erste
  titel: "Belehrung durch den Arbeitgeber (§ 43 IfSG)",
  beschreibung: "Nachweis der Belehrung durch den Arbeitgeber nach Aufnahme der Tätigkeit und danach alle zwei Jahre – Inhalte nach §§ 42, 43 IfSG, mit Unterschriften und Prüfung der Bescheinigung des Gesundheitsamts.",
  bereich: "gastro",
  pflichten: ["branche.gastro_ifsg_belehrung"],
  grundlage: "§ 43 Abs. 4 und 5 IfSG",
  abschnitte: [
    { titel: "Belehrung",
      hilfe: "Die Erstbelehrung macht das Gesundheitsamt oder eine beauftragte Ärztin bzw. ein beauftragter Arzt; die Bescheinigung darf bei Arbeitsbeginn höchstens drei Monate alt sein. Bescheinigung und letzte Dokumentation bewahrst du im Betrieb auf.",
      felder: [
        { id: "datum", art: "datum", label: "Datum der Belehrung", vorbelegung: "heute", pflicht: true },
        { id: "belehrt_von", art: "text", label: "Belehrt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "inhalte", art: "bausteine", label: "Inhalte der Belehrung", optionen: IFSG.inhalte.map((t) => ({ ...stabileOption(t), quelle: "§§ 42, 43 IfSG" })), vorbelegung: IFSG.inhalte.slice(0, 5).map((t) => stabileOption(t).wert), pflicht: true },
        { id: "liste_anhaengen", art: "schalter", label: "Tätigkeitsverbote, Krankheitszeichen und Lebensmittel nach § 42 IfSG im Dokument aufführen", vorbelegung: true, hilfe: "Mit den Krankheitszeichen in einfachen Worten – so ist der Inhalt der Belehrung im Dokument selbst festgehalten." },
        // Vorprüfung 21.10.2026: Belehrungsinhalt ausformuliert oder das amtliche Merkblatt beilegen
        { id: "merkblatt", art: "schalter", label: "Merkblatt des Gesundheitsamts beigelegt", hilfe: "Das Merkblatt zur Belehrung nach § 43 IfSG (vom Gesundheitsamt, beim Robert Koch-Institut auch in anderen Sprachen) ausdrucken und mit aushändigen – das Dokument nennt es dann als Anlage." },
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
            // für die Drei-Monats-Frist der Bescheinigung (§ 43 Abs. 1 IfSG) bei der ersten Tätigkeit (R10)
            { id: "erster_arbeitstag", art: "datum", label: "Erster Arbeitstag" },
            { id: "erstmals", art: "schalter", label: "Erste Tätigkeit mit Lebensmitteln", hilfe: "Dann darf die Bescheinigung bei Arbeitsbeginn höchstens drei Monate alt sein (§ 43 Abs. 1 IfSG)", wenn: { feld: "erster_arbeitstag" } },
          ],
        },
      ],
    },
  ],
  hinweise(d) {
    // Bescheinigung bei erster Tätigkeit höchstens drei Monate alt (§ 43 Abs. 1 IfSG) – nur ein Hinweis, die Belehrung
    // durch den Arbeitgeber bleibt trotzdem zu dokumentieren
    return liste(d, "teilnehmer")
      .filter((x) => text(x, "name") && ja(x, "erstmals") && text(x, "erstbelehrung_am") && text(x, "erster_arbeitstag"))
      .filter((x) => plusMonateIso(text(x, "erstbelehrung_am"), 3) < text(x, "erster_arbeitstag"))
      .map((x) => `${text(x, "name")}: Die Bescheinigung vom ${datumDe(text(x, "erstbelehrung_am"))} war am ersten Arbeitstag älter als drei Monate (§ 43 Abs. 1 IfSG) – vor der Tätigkeit ist eine neue Belehrung durch das Gesundheitsamt nötig.`);
  },
  html(d, b) {
    const naechste = plusMonate(text(d, "datum"), 24);
    const inhalte = auswahl(d, "inhalte").map((w) => neufassung(w));
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
              `<p>Folgende Personen dürfen nicht tätig sein oder beschäftigt werden a) beim Herstellen, Behandeln oder Inverkehrbringen der unten genannten Lebensmittel, wenn sie dabei mit diesen in Berührung kommen, oder b) in Küchen von Gaststätten und sonstigen Einrichtungen mit oder zur Gemeinschaftsverpflegung:</p>${punkte(IFSG.personen)}<h3>Woran Sie das erkennen</h3><p>Nicht arbeiten und den Arbeitgeber sofort informieren bei:</p>${punkte(IFSG.symptome)}<p>Bei solchen Krankheitszeichen ärztlichen Rat einholen und sagen, dass Sie mit Lebensmitteln arbeiten.</p><h3>Lebensmittel nach § 42 Abs. 2 IfSG</h3>${nummernListe(IFSG.lebensmittel)}`,
            )
          : "") +
        (ja(d, "merkblatt") ? `<p>Anlage: Merkblatt zur Belehrung nach § 43 Abs. 1 Nr. 1 IfSG (Gesundheitsamt), ausgehändigt an alle Teilnehmenden.</p>` : "") +
        abschnitt("Teilnahme", `<p class="vor-tabelle">Mit meiner Unterschrift bestätige ich, dass ich belehrt wurde und mir keine Tatsachen für ein Tätigkeitsverbot bekannt sind. Treten Hinderungsgründe auf, teile ich dies unverzüglich mit.</p>${teilnahmeTabelle(liste(d, "teilnehmer"), { kopf: "Erstbelehrung vom", feld: "erstbelehrung_am", datum: true })}`) +
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
            // welche Sorte (R10): Gäste mit Allergie fragen nach dem Getreide bzw. der Nuss – steht unter dem Namen
            { id: "getreide", art: "text", label: "Welches Getreide", hilfe: "optional, z. B. Weizen, Dinkel", wenn: { feld: "allergene", ist: "gluten" } },
            { id: "nuesse", art: "text", label: "Welche Schalenfrüchte (Nüsse)", hilfe: "optional, z. B. Haselnuss, Walnuss", wenn: { feld: "allergene", ist: "schalenfruechte" } },
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
    // Kennbuchstaben A–N in der Reihenfolge von Anhang II LMIV; die Zuordnung steht unter der Matrix (und in der Erläuterung)
    const kz = (i: number) => String.fromCharCode(65 + i);
    // Matrix: eine Zeile je Speise, eine Spalte je Allergen (● = enthalten); je Kategorie eine Zeilengruppe mit
    // Zwischenzeile, damit die Kategorie nicht allein am Seitenende steht
    const kopf = `<thead><tr><th>Speise / Getränk</th>${nummern.map((id, i) => `<th class="kz" title="${esc(ALLERGENE[id]!)}">${kz(i)}</th>`).join("")}</tr></thead>`;
    const zeilenHtml = kategorien
      .map((k) => {
        const zeilen = g.filter((x) => text(x, "kategorie") === k).map((x) => {
          const a = auswahl(x, "allergene");
          // „keines“ nur ausdrücklich bestätigt und ohne angekreuztes Allergen; sonst (nicht ausgefüllt, Widerspruch) kein Vermerk
          const keine = ja(x, "keine") && !a.length;
          const sorte = [a.includes("gluten") && text(x, "getreide") ? `Getreide: ${text(x, "getreide")}` : "", a.includes("schalenfruechte") && text(x, "nuesse") ? `Nüsse: ${text(x, "nuesse")}` : ""].filter(Boolean).join(" · ");
          return `<tr><td><strong>${zelle(text(x, "name"))}</strong>${keine ? '<br><span class="klein">keines der 14 Hauptallergene</span>' : ""}${sorte ? `<br><span class="klein">${zelle(sorte)}</span>` : ""}</td>${nummern.map((id) => `<td class="x">${a.includes(id) ? "●" : ""}</td>`).join("")}</tr>`;
        });
        return `<tbody${k ? ' class="gruppe-block"' : ""}>${k ? `<tr class="gruppe"><td colspan="${nummern.length + 1}"><strong>${zelle(k)}</strong></td></tr>` : ""}${zeilen.join("")}</tbody>`;
      })
      .join("");
    // ohne Gerichte: Matrix mit leeren Zeilen zum Ausfüllen von Hand
    const leereZeilen = `<tbody>${Array.from({ length: 12 }, () => `<tr><td>&nbsp;</td>${nummern.map(() => '<td class="x"></td>').join("")}</tr>`).join("")}</tbody>`;
    const schluessel = `<p class="schluessel">${nummern.map((id, i) => `<span class="nb"><b>${kz(i)}</b> ${esc(ALLERGENE[id]!)}</span>`).join(" · ")}</p>`;
    const inhalt = `<table class="liste matrix${g.length ? "" : " hoch"}"><colgroup><col style="width:37%">${nummern.map(() => `<col style="width:${(63 / nummern.length).toFixed(2)}%">`).join("")}</colgroup>${kopf}${g.length ? zeilenHtml : leereZeilen}</table>${schluessel}`;
    // leeres Blatt: die Matrix füllt die erste Seite, die Erläuterung folgt als eigenes Blatt; die Erläuterung bricht
    // nicht über zwei Seiten (Klasse „zusammen“)
    const legende = ja(d, "legende")
      ? abschnitt("Die 14 Hauptallergene nach Anhang II der LMIV", tabelle(["", "Allergen", "Umfasst"], nummern.map((id, i) => [kz(i), esc(ALLERGENE[id]!), esc(ALLERGENE_UMFANG[i]?.umfasst ?? "")]), { breiten: ["6%", "28%", "66%"], klasse: "legende" }), g.length ? "zusammen" : "neue-seite zusammen")
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

/** Geräte für das Monatsraster zum Antippen (neben den eigenen Kontrollpunkten). */
const RASTER_GERAETE = ["Kühlschrank 1", "Kühlschrank 2", "Tiefkühltruhe", "Kühltheke", "Getränkekühlschrank", "Warmhaltetheke", "Spülmaschine (Nachspültemperatur)"];

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
            { id: "grenzwert", art: "mehrzeilig", label: "Grenzwert", pflicht: true },
            { id: "haeufigkeit", art: "mehrzeilig", label: "Häufigkeit", vorschlaege: ["täglich", "bei jeder Lieferung", "wöchentlich"] },
            { id: "korrektur", art: "mehrzeilig", label: "Korrekturmaßnahme", pflicht: true },
          ],
        },
      ],
    },
    {
      titel: "Messungen",
      hilfe: "Optional – wenn du lieber auf Papier einträgst, lass die Liste leer oder nimm das Monatsraster zum Aushängen.",
      felder: [
        // Monatsraster (R10): ein Blatt je Monat zum Aushängen – je Gerät eine Zeile, je Tag ein Kästchen
        { id: "raster", art: "schalter", label: "Monatsraster zum Aushängen (Gerät × Tag 1–31)", hilfe: "Ein Blatt für den Monat: je Gerät eine Zeile mit Grenzwert, je Tag ein Kästchen für Messwert und Kürzel." },
        { id: "raster_geraete", art: "mehrzeilig", label: "Geräte im Raster", hilfe: "Ein Gerät je Zeile – deine Kontrollpunkte stehen zur Auswahl", wenn: { feld: "raster" }, vorschlaege: RASTER_GERAETE, vorschlaegeAus: { liste: "punkte", feld: "punkt" } },
        {
          id: "messungen",
          art: "liste",
          label: "Messungen",
          eintrag: "Messung",
          titelFeld: "kontrollpunkt",
          leerStarten: true,
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            { id: "uhrzeit", art: "uhrzeit", label: "Uhrzeit", jetzt: true },
            // Auswahl aus den eigenen Kontrollpunkten (R10) – passt der Name, steht der Grenzwert im Protokoll
            { id: "kontrollpunkt", art: "text", label: "Kontrollpunkt", pflicht: true, vorschlaegeAus: { liste: "punkte", feld: "punkt" } },
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
    // Grenzwert zur Messung aus den Kontrollpunkten (gleicher Name, ohne Groß-/Kleinschreibung und Leerzeichen)
    const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
    const grenzwert = (kp: string) => p.find((x) => norm(text(x, "punkt")) === norm(kp)) ?? null;
    // Messungen heißen meist nach dem Gerät („Kühlschrank Küche“): Passt keine zu einem Kontrollpunkt, entfällt die
    // Spalte „Grenzwert“ statt leer zu bleiben. Das leere Protokoll zum Eintragen von Hand behält sie.
    const mitGrenzwert = !m.length || m.some((x) => grenzwert(text(x, "kontrollpunkt")));
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
        (ja(d, "raster") ? monatsraster(d, zeitraum, (g) => grenzwert(g)) : "") +
        (ja(d, "raster") && !m.length ? "" : abschnitt(
          zeitraum ? `Messprotokoll · ${zeitraum}` : "Messprotokoll",
          tabelle(
            ["Datum / Uhrzeit", "Kontrollpunkt", ...(mitGrenzwert ? ["Grenzwert"] : []), "Messwert", "In Ordnung", "Korrekturmaßnahme", "Kürzel"],
            m.map((x) => {
              const kp = grenzwert(text(x, "kontrollpunkt"));
              return [`${datumDe(text(x, "datum"))}${text(x, "uhrzeit") ? ` ${esc(text(x, "uhrzeit"))}` : ""}`, zelle(text(x, "kontrollpunkt")), ...(mitGrenzwert ? [kp ? zelle(text(kp, "grenzwert")) : ""] : []), zelle(text(x, "wert")), text(x, "in_ordnung") === "nein" ? "<strong>nein</strong>" : "ja", zelle(text(x, "massnahme")), zelle(text(x, "kuerzel"))];
            }),
            { breiten: mitGrenzwert ? ["13%", "19%", "15%", "10%", "9%", "24%", "10%"] : ["14%", "24%", "12%", "10%", "29%", "11%"], leerzeilen: ja(d, "leerzeilen") ? haccpLeerzeilen(m.length) : 0, hoch: ja(d, "leerzeilen") },
          ),
          // Protokoll als eigenes Blatt zum Aushängen (auch leer: davor steht die Tabelle der Kontrollpunkte)
          "neue-seite",
        )) +
        unterschriften(["Geprüft (Datum)", "Verantwortliche/r"]),
    });
  },
};

const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];

/** Tage des Monats aus dem Zeitraum („Oktober 2026“, „10/2026“, „2026-10“); unbekannt: 31. */
export function tageImMonat(zeitraum: string): number {
  const t = zeitraum.toLocaleLowerCase("de");
  const jahr = Number(/\b(20\d{2})\b/.exec(t)?.[1] ?? NaN);
  let monat = MONATE.findIndex((m) => t.includes(m) || t.includes(m.slice(0, 3) + "."));
  if (monat < 0) {
    const zahl = /\b(\d{1,2})\s*[/.]\s*20\d{2}\b/.exec(t)?.[1] ?? /\b20\d{2}-(\d{2})\b/.exec(t)?.[1];
    if (zahl && Number(zahl) >= 1 && Number(zahl) <= 12) monat = Number(zahl) - 1;
  }
  if (monat < 0) return 31;
  return new Date(Date.UTC(Number.isFinite(jahr) ? jahr : 2001, monat + 1, 0)).getUTCDate();
}

/**
 * Monatsraster zum Aushängen (R10): je Gerät zwei Zeilen (Messwert, Kürzel), je Tag eine Spalte – ein Blatt im
 * Querformat für bis zu zehn Geräte. Ohne Geräte sechs leere Zeilen zum Eintragen.
 */
function monatsraster(d: Parameters<Vorlage["html"]>[0], zeitraum: string, grenzwert: (geraet: string) => Record<string, unknown> | null): string {
  const geraete = text(d, "raster_geraete").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const tage = tageImMonat(zeitraum);
  const breite = (66 / tage).toFixed(2);
  const cols = `<colgroup><col style="width:22%"><col style="width:6%">${Array.from({ length: tage }, () => `<col style="width:${breite}%">`).join("")}</colgroup>`;
  const kopf = `<thead><tr><th>Gerät / Grenzwert</th><th></th>${Array.from({ length: tage }, (_, i) => `<th class="tag">${i + 1}</th>`).join("")}</tr></thead>`;
  const leer = Array.from({ length: tage }, () => "<td></td>").join("");
  const zeilen = (geraete.length ? geraete : Array.from({ length: 6 }, () => ""))
    .map((g) => {
      const kp = g ? grenzwert(g) : null;
      const gw = kp && typeof kp.grenzwert === "string" ? kp.grenzwert : "";
      return `<tbody class="geraet"><tr class="wert"><td rowspan="2"><strong>${zelle(g) || "&nbsp;"}</strong>${gw ? `<br><span class="klein">${zelle(gw)}</span>` : ""}</td><td class="art">Wert</td>${leer}</tr><tr class="kuerzel"><td class="art">Kürzel</td>${leer}</tr></tbody>`;
    })
    .join("");
  return abschnitt(
    zeitraum ? `Monatsraster · ${zeitraum}` : "Monatsraster",
    `<table class="liste raster">${cols}${kopf}${zeilen}</table><p class="klein">Liegt ein Wert außerhalb des Grenzwerts: Korrekturmaßnahme laut Kontrollpunkt ergreifen und auf der Rückseite mit Datum vermerken.</p>`,
    "neue-seite",
  );
}

/** ISO-Datum plus Monate (Monatsende beachtet: 30.11. + 3 = 28./29.02.) als ISO. */
function plusMonateIso(iso: string, monate: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  const ende = new Date(Date.UTC(j, m - 1 + monate + 1, 0)).getUTCDate();
  return new Date(Date.UTC(j, m - 1 + monate, Math.min(t, ende))).toISOString().slice(0, 10);
}

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
    // kompakter Satz erst bei viel Text (ab ca. 1.800 Zeichen); auch dann nicht unter 9,6 pt (CSS .g-aushang.kompakt)
    klasse: zeichen > 1800 ? "kompakt" : undefined,
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
  ["schutz", "Hautschutz vorher", "18%"],
  ["handschuhe", "Schutzhandschuhe", "22%"],
  ["reinigung", "Hautreinigung", "19%"],
  ["pflege", "Hautpflege", "19%"],
];

/** Produkte des Betriebs je Spalte (R10): stehen im Plan fett über den Anweisungen – leer als Linie zum Eintragen. */
const HAUT_PRODUKTE: [string, string][] = [
  ["schutz", "produkt_schutz"],
  ["handschuhe", "produkt_handschuhe"],
  ["reinigung", "produkt_reinigung"],
  ["pflege", "produkt_pflege"],
];

export const hautschutzplan: Vorlage = {
  id: "hautschutzplan",
  gestalt: "aushang",
  titel: "Hautschutzplan",
  beschreibung: "Aushang auf einem Blatt: wann welcher Hautschutz, welche Handschuhe, welche Reinigung und Pflege – mit den Zeilen aus dem Muster-Hautschutzplan der TRGS 530 und der BGW und deinen Produkten.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hautschutzplan"],
  grundlage: "TRGS 401; TRGS 530",
  querformat: true,
  namensFeld: "bereich",
  abschnitte: [
    { titel: "Bereich", felder: [{ id: "bereich", art: "text", label: "Bereich", vorschlaege: ["Salon", "Kosmetikkabine", "Nagelstudio"] }] },
    {
      titel: "Tätigkeiten",
      hilfe: "Wähle die Tätigkeiten aus dem Muster. Die Produkte, die bei dir stehen, trägst du im nächsten Schritt ein.",
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
            { id: "schutz", art: "mehrzeilig", label: "Hautschutz vor der Tätigkeit" },
            { id: "handschuhe", art: "mehrzeilig", label: "Schutzhandschuhe" },
            { id: "reinigung", art: "mehrzeilig", label: "Hautreinigung" },
            { id: "pflege", art: "mehrzeilig", label: "Hautpflege" },
          ],
        },
      ],
    },
    {
      titel: "Deine Produkte",
      hilfe: "Der Name des Produkts, das bei dir am Waschplatz steht – so weiß jede im Team, welche Creme gemeint ist. Leer bleibt im Plan eine Linie zum Eintragen.",
      felder: [
        { id: "produkt_schutz", art: "text", label: "Hautschutzmittel", hilfe: "Produktname", hervor: true },
        { id: "produkt_handschuhe", art: "text", label: "Schutzhandschuhe", hilfe: "Produkt bzw. Material", hervor: true },
        { id: "produkt_reinigung", art: "text", label: "Hautreinigungsmittel", hilfe: "Produktname", hervor: true },
        { id: "produkt_pflege", art: "text", label: "Hautpflegemittel", hilfe: "Produktname", hervor: true },
      ],
    },
    { titel: "Verantwortlich und Stand",
      felder: [
        { id: "erstellt_von", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  html(d, b) {
    const eintraege = liste(d, "eintraege").filter((x) => HAUT.some(([id]) => text(x, id)));
    // Zeile „Produkt“ unter dem Kopf: je Spalte das Produkt des Betriebs (fett), sonst eine Linie zum Eintragen
    const produkt = (spalte: string) => {
      const feld = HAUT_PRODUKTE.find(([s]) => s === spalte)?.[1];
      return feld ? (text(d, feld) ? `<strong>${zelle(text(d, feld))}</strong>` : ZELLE_LINIE) : "<strong>Produkt</strong>";
    };
    const kopf = `<thead><tr>${HAUT.map(([, k]) => `<th>${esc(k)}</th>`).join("")}</tr></thead>`;
    const roh = eintraege.length ? eintraege.map((x) => HAUT.map(([id], i) => (i === 0 ? `<strong>${zelle(text(x, id))}</strong>` : zelle(text(x, id))))) : Array.from({ length: 6 }, () => HAUT.map(() => "&nbsp;"));
    // gleiche Anweisung in mehreren Zeilen (z. B. Hautpflege) steht einmal in der Zeile „Für alle Tätigkeiten“ – so passt
    // der Plan auf ein Blatt und liest sich am Waschplatz schneller (R10)
    const gemeinsam = HAUT.map((_, s) => {
      if (s === 0 || roh.length < 3) return "";
      const zahl = new Map<string, number>();
      for (const r of roh) if (r[s] && r[s] !== "&nbsp;") zahl.set(r[s]!, (zahl.get(r[s]!) ?? 0) + 1);
      const [w, n] = [...zahl.entries()].sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
      return n >= 2 ? w : "";
    });
    // Zeile „Produkt“: das Produkt des Betriebs und darunter die Anweisung, die für alle Tätigkeiten gilt
    const produkte = `<tr class="produkte">${HAUT.map(([id], sp) => `<td>${sp === 0 ? (gemeinsam.some(Boolean) ? "<strong>Produkt, für alle Tätigkeiten</strong>" : "<strong>Produkt</strong>") : `${produkt(id)}${gemeinsam[sp] ? `<div class="alle">${gemeinsam[sp]}</div>` : ""}`}</td>`).join("")}</tr>`;
    const zeichen = roh.reduce((n, r) => n + r.reduce((m, c, sp) => m + (gemeinsam[sp] && c === gemeinsam[sp] ? 0 : c.replace(/<[^>]+>/g, "").length), 0), 0) + gemeinsam.join("").length;
    const zeilen = roh.map((r) => `<tr>${r.map((c, s) => `<td>${gemeinsam[s] && c === gemeinsam[s] ? "" : c}</td>`).join("")}</tr>`).join("");
    // Tätigkeit und Handschuhe unterscheiden sich je Zeile – sie bekommen mehr Breite als die gemeinsamen Spalten
    const breiten = gemeinsam.some(Boolean) ? ["24%", "14%", "28%", "17%", "17%"] : HAUT.map(([, , w]) => w);
    const cols = `<colgroup>${breiten.map((w) => `<col style="width:${w}">`).join("")}</colgroup>`;
    return dokument({
      titel: "Hautschutzplan",
      betrieb: b,
      unter: text(d, "bereich") || undefined,
      quer: true,
      // ein Blatt zum Aushängen am Waschplatz (R10): große Schrift, ohne Unterschriftsblock – Verantwortlich und Stand
      // stehen in der Kennungsleiste
      // viel Text (alle Zeilen des Musters): etwas kleiner, damit es bei einem Blatt bleibt
      klasse: zeichen > 900 ? "haut dicht" : "haut",
      meta: `${text(d, "bereich") ? "" : `Bereich: ${KOPF_LINIE}\n`}Stand: ${datumDe(text(d, "datum"))}\nVerantwortlich: ${text(d, "erstellt_von") || KOPF_LINIE}`,
      inhalt: `<table class="liste haut${eintraege.length ? "" : " hoch"}">${cols}${kopf}<tbody>${produkte}${zeilen}</tbody></table>`,
    });
  },
};

const HYGIENE_SPALTEN: [string, string, string][] = [
  ["was", "Was", "18%"],
  ["wann", "Wann / wie oft", "20%"],
  ["womit", "Womit", "20%"],
  ["wie", "Wie", "30%"],
  ["wer", "Wer", "12%"],
];

/**
 * Nachkontrolle Dr. Weber (21.10.2026): Hygieneplan für Lebensmittelbetriebe nach den allgemeinen Hygienevorschriften
 * (Art. 4 Abs. 2, Anhang II VO (EG) Nr. 852/2004) und der LMHV (§ 3 allgemeine Anforderungen, § 4 Schulung) – mit eigenen
 * Themenbereichen statt der Beauty-Zeilen (Instrumentenaufbereitung, Hautdesinfektion). Die Eigenkontrollen nach HACCP
 * (Art. 5) bleiben eine eigene Vorlage. Zahlen sind übliche Richtwerte; alles fachlich zu prüfen (Lebensmittelhygiene).
 */
export const HYGIENE_THEMEN_LEBENSMITTEL = ["Reinigung und Desinfektion", "Personalhygiene", "Schädlingsbekämpfung", "Temperaturkontrollen", "Wareneingang", "Trennung rein/unrein", "Abfall", "Trinkwasser", "Schulungen"] as const;
const PRUEFEN_LM = "fachlich zu prüfen";
const RICHTWERT = "üblicher Richtwert, fachlich zu prüfen";
const lm = (thema: (typeof HYGIENE_THEMEN_LEBENSMITTEL)[number], was: string, wann: string, womit: string, wie: string, wer: string, quelle: string): Vorschlag => ({
  gruppe: "Gastronomie / Café",
  titel: was,
  werte: { thema, was, wann, womit, wie, wer },
  quelle: `${quelle} – ${PRUEFEN_LM}`,
});
export const HYGIENE_LEBENSMITTEL: Vorschlag[] = [
  lm("Reinigung und Desinfektion", "Arbeitsflächen und Schneidbretter", "nach jedem Arbeitsgang; nach rohem Fleisch, Geflügel, Fisch oder Eiern sofort; zum Arbeitsende", "Reinigungsmittel; für Lebensmittelbereiche geeignetes Desinfektionsmittel (Produkt eintragen)", "grob reinigen, desinfizieren nach Herstellerangabe (Konzentration, Einwirkzeit), mit Trinkwasser nachspülen, wenn der Hersteller es vorgibt", "Beschäftigte", "Anhang II Kap. I, II, V VO (EG) Nr. 852/2004"),
  lm("Reinigung und Desinfektion", "Geräte und Maschinen (z. B. Aufschnittmaschine, Mixer, Kaffeemaschine)", "nach Gebrauch, mindestens täglich", "Reinigungsmittel, Desinfektionsmittel", "vom Strom trennen, zerlegen, reinigen, desinfizieren, trocknen lassen, zusammensetzen", "Beschäftigte", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  lm("Reinigung und Desinfektion", "Kühl- und Tiefkühlgeräte", "wöchentlich und bei Verschmutzung sofort; Tiefkühlgeräte bei Eisbildung abtauen", "Reinigungsmittel, Desinfektionsmittel", "ausräumen, Ware prüfen (Mindesthaltbarkeits- und Verbrauchsdatum), auswischen, desinfizieren, trocknen, wieder einräumen", "Beschäftigte", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  lm("Reinigung und Desinfektion", "Geschirr, Besteck, Gläser", "nach Gebrauch", "Geschirrspülmaschine mit Reiniger und Klarspüler", "Spül- und Klarspültemperatur nach Herstellerangabe; Temperaturanzeige täglich ablesen", "Beschäftigte", "Anhang II Kap. II Nr. 2 VO (EG) Nr. 852/2004"),
  lm("Reinigung und Desinfektion", "Fußböden, Wände, Abflüsse", "Fußböden täglich zum Arbeitsende; Wände und Abflüsse wöchentlich", "Bodenreiniger", "kehren, nass wischen, trocknen lassen; Abflüsse reinigen", "Beschäftigte", "Anhang II Kap. II Nr. 1 VO (EG) Nr. 852/2004"),
  lm("Reinigung und Desinfektion", "Reinigungstücher und Reinigungsgeräte", "Tücher täglich wechseln, bei Verschmutzung sofort", "Waschmaschine, heißes Waschprogramm (60 °C – " + RICHTWERT + ")", "Tücher farbig nach Bereichen trennen; Reinigungsgeräte sauber und trocken aufbewahren", "Beschäftigte", "Anhang II Kap. I VO (EG) Nr. 852/2004"),
  lm("Personalhygiene", "Händewaschen", "vor Arbeitsbeginn; nach Pausen und dem Toilettengang; nach rohem Fleisch, Geflügel oder Eiern; nach Abfall, Naseputzen, Rauchen", "Handwaschbecken mit Warm- und Kaltwasser, Flüssigseife, Einmalhandtücher", "gründlich waschen (etwa 30 Sekunden), mit Einmalhandtuch abtrocknen", "alle", "Anhang II Kap. I Nr. 4, Kap. VIII VO (EG) Nr. 852/2004"),
  lm("Personalhygiene", "Arbeitskleidung und Schmuck", "täglich und bei Verschmutzung wechseln", "saubere Arbeitskleidung, Kopfbedeckung bzw. Haarnetz, Schürze", "Arbeitskleidung nur im Betrieb tragen; Ringe, Uhren, Armbänder ablegen; Fingernägel kurz und ohne Lack; Wunden an Händen wasserfest abdecken, Handschuh darüber", "alle", "Anhang II Kap. VIII Nr. 1 VO (EG) Nr. 852/2004"),
  lm("Personalhygiene", "Krankheit (§ 42 IfSG)", "vor Arbeitsbeginn und sofort, wenn Krankheitszeichen auftreten", "Meldung an die verantwortliche Person", "Bei Durchfall, Erbrechen, Fieber, Gelbsucht oder infizierten Wunden: sofort melden und nicht mit Lebensmitteln arbeiten, bis ärztlich geklärt ist, dass kein Tätigkeitsverbot nach § 42 IfSG besteht", "alle", "§ 42 IfSG; Anhang II Kap. VIII Nr. 2 VO (EG) Nr. 852/2004"),
  lm("Schädlingsbekämpfung", "Schädlingsmonitoring", "täglich Sichtkontrolle; Monitoringstellen nach Plan (z. B. monatlich – " + RICHTWERT + ")", "Klebefallen bzw. Monitore, Lageplan der Stellen; Fliegengitter", "auf Kot, Fraßspuren, Gespinste und Tiere achten; Befall sofort melden, Fachbetrieb beauftragen; Kontrollen und Maßnahmen aufschreiben", "verantwortliche Person", "Anhang II Kap. IX Nr. 4 VO (EG) Nr. 852/2004"),
  lm("Temperaturkontrollen", "Kühlgeräte", "täglich zu Arbeitsbeginn", "Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", "höchstens +7 °C (" + RICHTWERT + "; strengere Werte z. B. für Hackfleisch, Geflügel, Fisch nach Herstellerangabe); bei Abweichung Ursache beheben, Ware bewerten, eintragen", "Beschäftigte", "Anhang II Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  lm("Temperaturkontrollen", "Tiefkühlgeräte", "täglich zu Arbeitsbeginn", "Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", "−18 °C oder kälter (" + RICHTWERT + "); bei Abweichung Ursache beheben, Ware bewerten, eintragen", "Beschäftigte", "Anhang II Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  lm("Wareneingang", "Wareneingang", "bei jeder Lieferung", "Thermometer, Lieferschein", "Verpackung, Kennzeichnung, Mindesthaltbarkeits- und Verbrauchsdatum prüfen; Temperatur gekühlter und tiefgekühlter Ware messen; Mängel zurückweisen; Kühlware sofort einräumen", "Beschäftigte", "Anhang II Kap. IX Nr. 1, 2 VO (EG) Nr. 852/2004"),
  lm("Trennung rein/unrein", "Trennung rein/unrein", "ständig", "getrennte Arbeitsbereiche oder zeitliche Trennung; Schneidbretter nach Farben; abgedeckte Behälter", "rohe und verzehrfertige Lebensmittel getrennt lagern und bearbeiten (Rohes unten im Kühlgerät); Schmutzgeschirr, Abfall und Verpackungen nicht über Flächen für Lebensmittel; Reinigungsmittel getrennt von Lebensmitteln lagern", "alle", "Anhang II Kap. IX Nr. 3, Kap. I Nr. 10 VO (EG) Nr. 852/2004; § 3 LMHV"),
  lm("Abfall", "Abfall und Speisereste", "mehrmals täglich und zum Arbeitsende leeren; Behälter wöchentlich reinigen", "verschließbare Behälter, möglichst mit Fußbedienung", "Abfall nicht in Räumen mit Lebensmitteln sammeln; Speisereste getrennt sammeln und über einen Entsorger abgeben; Abfallplatz sauber und frei von Schädlingen halten", "Beschäftigte", "Anhang II Kap. VI VO (EG) Nr. 852/2004"),
  lm("Trinkwasser", "Trinkwasser und Eis", "laufend; nach längerem Stillstand Leitungen spülen", "Trinkwasser aus der Hausinstallation", "für Lebensmittel, Eis und das Reinigen von Flächen für Lebensmittel nur Trinkwasser verwenden; Eisbereiter und Wasserfilter nach Herstellerangabe reinigen bzw. wechseln", "Beschäftigte", "Anhang II Kap. VII VO (EG) Nr. 852/2004"),
  lm("Schulungen", "Schulung Lebensmittelhygiene", "vor der ersten Tätigkeit und regelmäßig wiederholen (z. B. jährlich – " + RICHTWERT + ")", "Schulung nach § 4 LMHV und Anhang II Kap. XII VO (EG) Nr. 852/2004; Belehrung nach § 43 IfSG (eigene Vorlage)", "Inhalte: Personalhygiene, Reinigung, Temperaturen, Trennung rein/unrein, Allergene; Teilnahme mit Unterschrift festhalten", "verantwortliche Person", "§ 4 LMHV; Anhang II Kap. XII VO (EG) Nr. 852/2004"),
];
/** Querverweis auf die Eigenkontrollen und die Belehrung im Plan eines Lebensmittelbetriebs. */
export const HYGIENE_VERWEIS_HACCP = "Eigenkontrollen nach HACCP (Kontrollpunkte, Temperaturen messen und eintragen, Korrekturmaßnahmen): eigene Vorlage „Eigenkontrollen (HACCP)“. Belehrung nach § 43 IfSG: eigene Vorlage.";
/** Zeilen, die nur in Beauty-Betriebe gehören (Instrumentenaufbereitung, Haut, Kundschaft) – für den Hinweis im Lebensmittelbetrieb. */
const BEAUTY_ZEILE = /Instrument|Haut|\bKund(?:e|en|in|innen)\b|Steril|Lanzett|Nagelhaut|Nagelstudio|Fußpflege|Haarwasch|Behandlungs|\bBlut/i;

/** Bayern-spezifischer Zusatz in einem Baustein (R11, Kosmetik #16): nur drucken, wenn der Betrieb in Bayern liegt */
const NUR_BAYERN = /\s*\(Bayern: [^)]*\)/g;
/** „Wer“ aus den Bausteinen (Beschäftigte, Reinigungskraft, Arbeitgeber …) – ohne Beschäftigte steht dort die verantwortliche Person */
const WER_AUS_BAUSTEINEN = new Set([...HYGIENE, ...HYGIENE_LEBENSMITTEL].map((v) => (typeof v.werte.wer === "string" ? v.werte.wer.trim() : "")).filter(Boolean));

/** Einträge des Hygieneplans für den Druck: Landeszusatz nur im passenden Land, „Wer“ bei Ein-Personen-Betrieben. */
function hygieneFuerDruck(d: Daten, b: Betrieb): Daten {
  const bayern = /bayern/i.test(b.bundesland ?? "");
  const allein = d.mit_beschaeftigten === false;
  const wer = text(d, "erstellt_von") || b.verantwortlich;
  return {
    ...d,
    eintraege: liste(d, "eintraege").map((x) => ({
      ...x,
      ...(bayern ? {} : Object.fromEntries(["was", "wann", "womit", "wie"].map((k) => [k, text(x, k).replace(NUR_BAYERN, "")]))),
      ...(allein && wer && WER_AUS_BAUSTEINEN.has(text(x, "wer")) ? { wer } : {}),
    })),
  };
}

/**
 * Plan eines Lebensmittelbetriebs: Einträge nach Themenbereichen geordnet (der Bereich steht über dem ersten Eintrag),
 * ohne Einträge je Themenbereich eine Zeile zum Eintragen; darunter der Verweis auf die Eigenkontrollen (HACCP).
 */
function lebensmittelPlan(d: Daten, b: Betrieb): string {
  const alle = liste(d, "eintraege").filter((x) => HYGIENE_SPALTEN.some(([id]) => text(x, id)));
  const rang = (x: Eintrag) => {
    const i = HYGIENE_THEMEN_LEBENSMITTEL.indexOf(text(x, "thema") as (typeof HYGIENE_THEMEN_LEBENSMITTEL)[number]);
    return i < 0 ? HYGIENE_THEMEN_LEBENSMITTEL.length : i;
  };
  const sortiert = alle.map((x, i) => ({ x, i })).sort((p, q) => rang(p.x) - rang(q.x) || p.i - q.i).map((p) => p.x);
  let zuletzt = "";
  const zeilen = sortiert.map((x) => {
    const thema = text(x, "thema");
    const kopf = thema && thema !== zuletzt ? `<span class="thema">${esc(thema)}</span>` : "";
    zuletzt = thema || zuletzt;
    return HYGIENE_SPALTEN.map(([id], i) => (i === 0 ? `${kopf}<strong>${zelle(text(x, id))}</strong>` : zelle(text(x, id))));
  });
  const leer = HYGIENE_THEMEN_LEBENSMITTEL.map((t) => HYGIENE_SPALTEN.map((_, i) => (i === 0 ? `<span class="thema">${esc(t)}</span>` : "")));
  const zeichen = sortiert.reduce((n, x) => n + HYGIENE_SPALTEN.reduce((m, [id]) => m + text(x, id).length, 0), 0);
  const unter = text(d, "bereich") || undefined;
  return dokument({
    titel: "Hygieneplan",
    betrieb: b,
    unter,
    quer: true,
    klasse: `lebensmittel${zeichen > 1800 ? " kompakt" : ""}`,
    meta: `${unter ? "" : `Bereich: ${KOPF_LINIE}\n`}Stand: ${datumDe(text(d, "datum"))}\nVerantwortlich: ${text(d, "erstellt_von")}`,
    inhalt:
      tabelle(HYGIENE_SPALTEN.map(([, k]) => k), zeilen.length ? zeilen : leer, { breiten: HYGIENE_SPALTEN.map(([, , w]) => w), ...(zeilen.length ? {} : { hoch: true }) }) +
      `<p class="klein">${esc(HYGIENE_VERWEIS_HACCP)}</p>` +
      unterschriften(["Ort, Datum", "Unterschrift Verantwortliche/r"]),
  });
}

export const HYGIENE_GRUNDLAGE_LEBENSMITTEL = "Art. 4 Abs. 2, Art. 5, Anhang II VO (EG) Nr. 852/2004; §§ 3, 4 LMHV";
export const hygieneplan: Vorlage = {
  id: "hygieneplan",
  gestalt: "aushang",
  titel: "Hygieneplan",
  beschreibung: "Aushang: was wann womit und wie gereinigt und desinfiziert wird und wer es macht – für Beauty-Betriebe mit Zeilen aus Rahmenhygieneplänen und dem BGW-Hygieneplan, für Lebensmittelbetriebe nach VO (EG) Nr. 852/2004 und LMHV.",
  bereich: "beauty",
  pflichten: ["branche.beauty_hygieneplan"],
  grundlage: "Hygieneverordnung des Landes (auf Grundlage des IfSG)",
  // Vorprüfung 21.10.2026 (T-104): Lebensmittelbetriebe nach EU-Lebensmittelhygienerecht, nicht nach der Landes-Hygieneverordnung
  grundlageFuer: (d) => (text(d, "art") === "lebensmittel" ? HYGIENE_GRUNDLAGE_LEBENSMITTEL : ""),
  querformat: true,
  namensFeld: "bereich",
  abschnitte: [
    {
      titel: "Bereich",
      hilfe: "Friseur, Kosmetik, Nagelstudio, Fußpflege: Welche Anforderungen genau gelten, regelt die Hygieneverordnung deines Bundeslands; Desinfektionsmittel nach Herstellerangabe bzw. VAH-Liste. Lebensmittelbetriebe: allgemeine Hygienevorschriften nach Art. 4 und Anhang II VO (EG) Nr. 852/2004 und Lebensmittelhygiene-Verordnung (LMHV) – die Vorschläge der Gruppe „Gastronomie / Café“ decken Reinigung und Desinfektion, Personalhygiene, Schädlinge, Temperaturen, Wareneingang, Trennung rein/unrein, Abfall, Trinkwasser und Schulungen ab. Die Eigenkontrollen nach HACCP haben eine eigene Vorlage.",
      felder: [
        { id: "art", art: "wahl", label: "Art des Betriebs", optionen: [{ wert: "beauty", text: "Friseur, Kosmetik, Nagelstudio, Fußpflege" }, { wert: "lebensmittel", text: "Lebensmittelbetrieb (Café, Küche, Bäckerei)" }], vorbelegung: "beauty", vorbelegungJe: { gastro_cafe: "lebensmittel" }, hilfe: "Bestimmt die Rechtsgrundlage und den Aufbau des Plans. Für Lebensmittelbetriebe: Vorschläge der Gruppe „Gastronomie / Café“ – Zahlen darin sind übliche Richtwerte und fachlich zu prüfen." },
        { id: "bereich", art: "text", label: "Bereich", vorschlaege: ["Friseursalon", "Kosmetik", "Nagelstudio", "Fußpflege", "Küche", "Theke und Gastraum"] },
      ],
    },
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
          vorschlaege: [...HYGIENE, ...HYGIENE_LEBENSMITTEL],
          felder: [
            { id: "was", art: "text", label: "Was", pflicht: true },
            { id: "wann", art: "mehrzeilig", label: "Wann / wie oft" },
            { id: "womit", art: "mehrzeilig", label: "Womit" },
            { id: "wie", art: "mehrzeilig", label: "Wie" },
            { id: "wer", art: "text", label: "Wer" },
            // Nachkontrolle Dr. Weber: Themenbereich ordnet den Plan eines Lebensmittelbetriebs
            { id: "thema", selten: true, art: "text", label: "Themenbereich (Lebensmittelbetrieb)", vorschlaege: [...HYGIENE_THEMEN_LEBENSMITTEL] },
          ],
        },
      ],
    },
    { titel: "Verantwortlich und Stand",
      felder: [
        { id: "erstellt_von", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute" },
        // R11 (Kosmetik #18): ohne Beschäftigte (laut Pflichten-Check) steht unter „Wer“ die verantwortliche Person
        { id: "mit_beschaeftigten", selten: true, art: "schalter", label: "Mit Beschäftigten", vorbelegung: true, hilfe: "Aus dem Pflichten-Check. Ohne Beschäftigte steht unter „Wer“ die verantwortliche Person statt „Beschäftigte“." },
      ],
    },
  ],
  ausProfil: { mit_beschaeftigten: "beschaeftigte.gesamt" },
  // Nachkontrolle Dr. Weber: im Lebensmittelbetrieb keine Beauty-Zeilen; die Themenbereiche vollständig
  hinweise(d) {
    if (text(d, "art") !== "lebensmittel") return [];
    const e = liste(d, "eintraege").filter((x) => text(x, "was"));
    const r: string[] = [];
    const beauty = e.filter((x) => BEAUTY_ZEILE.test(["was", "wann", "womit", "wie"].map((k) => text(x, k)).join(" "))).map((x) => text(x, "was"));
    if (beauty.length) r.push(`Lebensmittelbetrieb: ${beauty.length === 1 ? "Der Eintrag" : "Die Einträge"} „${beauty.join("“, „")}“ ${beauty.length === 1 ? "gehört" : "gehören"} in einen Beauty-Betrieb – entferne ${beauty.length === 1 ? "ihn" : "sie"} und nimm die Vorschläge der Gruppe „Gastronomie / Café“.`);
    if (e.some((x) => text(x, "thema"))) {
      const fehlt = HYGIENE_THEMEN_LEBENSMITTEL.filter((t) => !e.some((x) => text(x, "thema") === t));
      if (fehlt.length) r.push(`Lebensmittelbetrieb: Im Plan fehlt noch ${fehlt.join(", ")}.`);
    }
    return r;
  },
  html: (d, b) => (text(d, "art") === "lebensmittel" ? lebensmittelPlan(hygieneFuerDruck(d, b), b) : plan({ titel: "Hygieneplan", unter: text(d, "bereich") || undefined, d: hygieneFuerDruck(d, b), b, spalten: HYGIENE_SPALTEN, feld: "eintraege" })),
};
