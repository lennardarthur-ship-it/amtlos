/**
 * Personal (E-121): Arbeitszeitnachweis, Lohnkonto, Daten für die Sozialversicherungsmeldung. Amtlos rechnet keine
 * Lohnsteuer und keine Beiträge – die Beträge kommen aus der Lohnabrechnung. Gliederungen fachlich zu prüfen (T-61).
 */
import { KOPF_LINIE, ZELLE_LINIE, abschnitt, angaben, ankreuzen, cent, datumDe, dokument, esc, euro, fassungNachsatz, felder, ibanText, ja, liste, roh, steuerHinweis, summe, svNummerText, tabelle, text, unterschriften, zahlText, zelle, type Roh } from "./html.js";
import { mindestlohnAm, minijobGrenzeAm } from "./personal.js";
import { MINIJOB, SV } from "./bausteine.js";
import { BRANCHEN_2A, BRANCHEN_2A_TEXT, branche2aAusProfil } from "./konstanten.js";
import type { Daten, Eintrag, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";

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

/** Hat ein Arbeitstag Inhalt (Zeiten, Pause, Ort oder Bemerkung)? Ein Tag nur mit Datum ist leer. */
const mitInhalt = (x: Eintrag) => ["beginn", "ende", "pause", "einsatzort", "bemerkung"].some((k) => text(x, k));

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
 * R12: Tage, die zählen – mit Inhalt; hat kein Tag Inhalt (Blatt zum Eintragen von Hand bzw. neu angelegt), alle mit
 * Datum. Leere Tage verschieben so weder Monat noch Zeitraum (Kurier #18).
 */
function zaehlendeTage(d: Daten): string[] {
  const alle = liste(d, "tage");
  const mit = alle.filter(mitInhalt);
  return (mit.length ? mit : alle).map((x) => text(x, "datum")).filter((t) => ISO_TAG.test(t)).sort();
}

/**
 * Monat eines Arbeitszeitnachweises (R11, Reinigung #10): die eigene Angabe, sonst aus den Daten der Arbeitstage
 * („Oktober 2026“; über zwei Monate „September 2026 – Oktober 2026“). Leer, wenn nichts bekannt ist.
 */
export function monatAus(d: Daten): string {
  const eigen = text(d, "monat");
  if (eigen) return eigen;
  const tage = zaehlendeTage(d);
  if (!tage.length) return "";
  const von = monatVon(tage[0]!);
  const bis = monatVon(tage[tage.length - 1]!);
  return von === bis ? von : `${von} – ${bis}`;
}

/** R12: eingetragenen Monat lesen („Oktober 2026“, „10/2026“, „10.2026“, „2026-10“) → „2026-10“, sonst null. */
export function monatSchluessel(t: string): string | null {
  const s = t.trim();
  const name = /^([A-Za-zäÄ]+)\.?\s+(\d{4})$/.exec(s);
  if (name) {
    const i = MONATSNAMEN.findIndex((m) => m.toLocaleLowerCase("de").startsWith(name[1]!.toLocaleLowerCase("de").slice(0, 3)));
    return i >= 0 ? `${name[2]}-${String(i + 1).padStart(2, "0")}` : null;
  }
  const zahl = /^(\d{1,2})\s*[./-]\s*(\d{4})$/.exec(s);
  if (zahl && Number(zahl[1]) >= 1 && Number(zahl[1]) <= 12) return `${zahl[2]}-${zahl[1]!.padStart(2, "0")}`;
  const iso = /^(\d{4})-(\d{2})$/.exec(s);
  return iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12 ? s : null;
}

/** Vorschläge für den Monat: dieser und der vorige (beim Laden des Moduls berechnet). */
function monatsVorschlaege(jetzt = new Date()): string[] {
  const j = jetzt.getFullYear();
  const m = jetzt.getMonth();
  return [monatVon(`${j}-${String(m + 1).padStart(2, "0")}-01`), monatVon(m === 0 ? `${j - 1}-12-01` : `${j}-${String(m).padStart(2, "0")}-01`)];
}

/**
 * Branchen nach § 2a Abs. 1 SchwarzArbG für den Hinweis im Nachweis (R11, Reinigung #9; Vorprüfung 21.10.2026, T-99:
 * vollständige Liste der Neufassung) – vorbelegt aus dem Pflichten-Check. „andere“ gab es bis zur Vorprüfung als Sammeloption.
 */
const AZN_BRANCHEN = [...BRANCHEN_2A, { wert: "keine", text: "Keine dieser Branchen" }];

/** R12: Art der Beschäftigung – gleiche Werte in „Mitarbeiter“, Arbeitszeitnachweis und Personalfragebogen. */
export const BESCHAEFTIGUNGSARTEN = [
  { wert: "vollzeit", text: "Vollzeit" },
  { wert: "teilzeit", text: "Teilzeit" },
  { wert: "minijob", text: "Minijob" },
  { wert: "kurzfristig", text: "Kurzfristig" },
  { wert: "ausbildung", text: "Ausbildung (Azubi)" },
  { wert: "werkstudent", text: "Werkstudent/in" },
];
export const ENTGELT_ARTEN = [
  { wert: "stunde", text: "Stundenlohn" },
  { wert: "monat", text: "Monatsgehalt" },
];

/** Satz zur Aufzeichnungspflicht unter der Tabelle – je nach Branche aus dem Profil. */
function aufzeichnungsSatz(d: Daten): string {
  const frist = "Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens bis zum Ablauf des siebten Kalendertages nach dem Arbeitstag aufzeichnen. Die Aufzeichnungen mindestens zwei Jahre aufbewahren.";
  const b = text(d, "branche");
  const name = BRANCHEN_2A.find((x) => x.wert === b)?.text;
  if (name) return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Branchen nach § 2a Abs. 1 SchwarzArbG (hier: ${name}) und für Minijobs: ${frist}`;
  if (b === "andere") return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Branchen nach § 2a Abs. 1 SchwarzArbG und für Minijobs: ${frist}`;
  if (b === "keine") return `Für Minijobs gilt die Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG: ${frist}`;
  return `Aufzeichnungspflicht nach § 17 Abs. 1 MiLoG für Minijobs und die Branchen nach § 2a Abs. 1 SchwarzArbG (${BRANCHEN_2A_TEXT}): ${frist}`;
}

/** ISO-Tag plus n Tage. */
const plusTage = (iso: string, n: number) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
const tageText = (l: string[]) => (l.length > 4 ? `${l.slice(0, 4).map(datumDe).join(", ")} und ${l.length - 4} weiteren Tagen` : l.map(datumDe).join(", "));

/** Stunden als Dezimalzahl mit Komma, abgerundet auf zwei Stellen („43,38 h“) – für Höchststunden. */
const stundenDezimal = (min: number) => `${zahlText(Math.floor((min / 60) * 100) / 100)} h`;

/** R12: Stundenlohn bzw. Monatsgehalt aus dem Nachweis (Cent) – nach der gewählten Art; ohne Art, was eingetragen ist. */
function entgelt(d: Daten): { stunde: number | null; monat: number | null } {
  const art = text(d, "entgelt_art");
  const s = cent(text(d, "stundenlohn"));
  const m = cent(text(d, "monatsgehalt"));
  return { stunde: art === "monat" ? null : s, monat: art === "stunde" ? null : s !== null && !art ? null : m };
}

/**
 * R12 (Zoll #4, #14): Rechnungen zum Nachweis – Minijob-Grenze (§ 8 SGB IV), Mindestlohn (§ 1 MiLoG), Höchstarbeitszeit
 * und Pausen (§§ 3, 4 ArbZG) und die Sieben-Tage-Frist (§ 17 Abs. 1 MiLoG). Nur Hinweise, die Aufzeichnung bleibt gültig.
 */
export function arbeitszeitPruefung(d: Daten): { hinweise: string[]; hoechstMinuten: number | null } {
  const r: string[] = [];
  const { z, gesamt } = zeiten(d);
  const tage = zaehlendeTage(d);
  const stichtag = tage.at(-1) ?? "";
  const art = text(d, "art");
  const e = entgelt(d);
  const ml = stichtag ? mindestlohnAm(stichtag) : null;
  const grenze = stichtag ? minijobGrenzeAm(stichtag) : null;
  let hoechstMinuten: number | null = null;
  if (art === "minijob" && grenze !== null) {
    if (e.stunde) {
      hoechstMinuten = Math.floor((grenze / e.stunde) * 60 * 100) / 100;
      const verdienst = Math.round((gesamt / 60) * e.stunde);
      if (gesamt && verdienst > grenze) r.push(`Minijob: ${stunden(gesamt)} × ${euro(e.stunde)} = ${euro(verdienst)} – das liegt über der Minijob-Grenze von ${euro(grenze)} im Monat (§ 8 SGB IV). Bei ${euro(e.stunde)} je Stunde sind höchstens ${stundenDezimal(hoechstMinuten)} im Monat möglich.`);
    } else if (e.monat !== null && e.monat > grenze) r.push(`Minijob: Das Monatsgehalt von ${euro(e.monat)} liegt über der Minijob-Grenze von ${euro(grenze)} (§ 8 SGB IV).`);
  }
  // Mindestlohn gilt nicht für Auszubildende (dort Mindestausbildungsvergütung)
  if (ml !== null && art !== "ausbildung") {
    if (e.stunde !== null && e.stunde < ml) r.push(`Der Stundenlohn von ${euro(e.stunde)} liegt unter dem Mindestlohn von ${euro(ml)} (§ 1 MiLoG).`);
    else if (e.stunde === null && e.monat !== null && gesamt > 0) {
      const je = Math.floor(e.monat / (gesamt / 60));
      if (je < ml) r.push(`Monatsgehalt ${euro(e.monat)} ÷ ${stunden(gesamt)} = ${euro(je)} je Stunde – das liegt unter dem Mindestlohn von ${euro(ml)} (§ 1 MiLoG). Sind alle Arbeitstage eingetragen?`);
    }
  }
  // Arbeitszeitgesetz: mehr als 10 Stunden, zu kurze Pausen (> 6 h: 30 Minuten, > 9 h: 45 Minuten)
  const lang = z.filter((t) => t.min !== null && t.min > 600).map((t) => text(t.x, "datum")).filter((t) => ISO_TAG.test(t));
  if (lang.length) r.push(`Mehr als 10 Stunden Arbeitszeit am ${tageText(lang)} (§ 3 ArbZG). Bitte prüfen.`);
  const ohnePause = z
    .filter((t) => {
      if (t.min === null) return false;
      const p = Math.round(Number((text(t.x, "pause") || "0").replace(",", "."))) || 0;
      return (t.min > 540 && p < 45) || (t.min > 360 && p < 30);
    })
    .map((t) => text(t.x, "datum"))
    .filter((t) => ISO_TAG.test(t));
  if (ohnePause.length) r.push(`Zu kurze Pause am ${tageText(ohnePause)}: Bei mehr als 6 Stunden Arbeit sind mindestens 30 Minuten, bei mehr als 9 Stunden 45 Minuten Pause vorgeschrieben (§ 4 ArbZG).`);
  // Sieben-Tage-Frist: erfasst mehr als sieben Tage nach dem Arbeitstag (Zeitstempel der App)
  const spaet = liste(d, "tage")
    .filter((x) => ISO_TAG.test(text(x, "datum")) && ISO_TAG.test(text(x, "erfasst_am")) && text(x, "erfasst_am") > plusTage(text(x, "datum"), 7))
    .map((x) => text(x, "datum"))
    .sort();
  if (spaet.length) r.push(`${spaet.length === 1 ? "Ein Arbeitstag wurde" : `${spaet.length} Arbeitstage wurden`} später als sieben Tage nach dem Arbeitstag erfasst (${tageText(spaet)}). Nach § 17 Abs. 1 MiLoG ist bis zum Ablauf des siebten Tages aufzuzeichnen.`);
  return { hinweise: r, hoechstMinuten };
}

export const arbeitszeitnachweis: Vorlage = {
  id: "arbeitszeitnachweis",
  titel: "Arbeitszeitnachweis",
  // R12 (Zoll #11): der Monat der Aufzeichnung im Namen – „Arbeitszeitnachweis Oktober 2026 · Rami Haddad“
  titelFuer: (d) => (monatAus(d) ? `Arbeitszeitnachweis ${monatAus(d)}` : "Arbeitszeitnachweis"),
  beschreibung: "Beginn, Ende und Dauer der täglichen Arbeitszeit je Person und Monat – auch für Minijobs. Ausgefüllt oder als Blatt zum Eintragen von Hand.",
  bereich: "personal",
  pflichten: ["personal.arbeitszeit_aufzeichnung", "personal.arbeitszeit_milog"],
  // R12 (Zoll #2): nach dem Teilen festgeschrieben, Korrektur als neue Fassung mit Grund
  festschreiben: true,
  korrektur: true,
  // „Beschäftigt seit“ für die Prüfung, ob ein Arbeitstag davor liegt (R11, Reinigung #10); R12: Art und Entgelt
  person: { art: "mitarbeiter", felder: { name: "name", beginn: "beschaeftigt_seit", art: "art", entgelt_art: "entgelt_art", stundenlohn: "stundenlohn", monatsgehalt: "monatsgehalt" } },
  grundlage: "§ 3 Abs. 2 Nr. 1 ArbSchG (BAG 13.09.2022 – 1 ABR 22/21); § 17 MiLoG",
  // Vorprüfung 21.10.2026 (T-99): Branche nach § 2a SchwarzArbG auch aus der Frage nach den Sofortmeldebranchen
  profilStart(profil) {
    const w = branche2aAusProfil(profil);
    const start: Daten = w ? { branche: w } : {};
    return start;
  },
  namensFeld: "name",
  abschnitte: [
    { titel: "Person und Monat",
      felder: [
        { id: "name", art: "text", label: "Name der beschäftigten Person", pflicht: true },
        // R12 (Kurier #11): sichtbar; eingetragen begrenzt er die Arbeitstage
        { id: "monat", art: "text", label: "Monat", vorschlaege: monatsVorschlaege(), hilfe: `z. B. Oktober 2026. Leer lassen: ${MARKE.name} nimmt den Monat aus den Arbeitstagen. Eingetragen müssen alle Arbeitstage in diesem Monat liegen.` },
        { id: "beschaeftigt_seit", selten: true, art: "datum", label: "Beschäftigt seit", hilfe: "Aus „Mitarbeiter“ übernommen. Arbeitstage davor sind ein Fehler." },
        { id: "art", selten: true, art: "wahl", label: "Art der Beschäftigung", optionen: BESCHAEFTIGUNGSARTEN, hilfe: `Aus „Mitarbeiter“. Beim Minijob rechnet ${MARKE.name} Stunden × Lohn gegen die Minijob-Grenze.` },
        { id: "entgelt_art", selten: true, art: "wahl", label: "Entgelt", optionen: ENTGELT_ARTEN },
        { id: "stundenlohn", selten: true, art: "betrag", label: "Stundenlohn brutto (€)", wenn: { feld: "entgelt_art", ist: "monat", nicht: true } },
        { id: "monatsgehalt", selten: true, art: "betrag", label: "Monatsgehalt brutto (€)", wenn: { feld: "entgelt_art", ist: "monat" } },
        {
          id: "branche",
          selten: true,
          art: "wahl",
          label: "Branche für den Hinweis zur Aufzeichnungspflicht",
          optionen: AZN_BRANCHEN,
          vorbelegungJe: { gastro_cafe: "gastronomie", friseur: "friseur_kosmetik", kosmetik: "friseur_kosmetik", gebaeudereinigung: "gebaeudereinigung" },
          hilfe: "Aus deiner Branche im Pflichten-Check. Bestimmt den Satz unter der Tabelle. Die Branchen nach § 2a Abs. 1 SchwarzArbG: seit 30.12.2025 auch Friseur- und Kosmetikgewerbe.",
        },
        { id: "leerzeilen", selten: true, art: "schalter", label: "Leere Zeilen zum Eintragen von Hand anhängen", vorbelegung: false },
        // R12 (Zoll #3): Erfassungszeitpunkt je Tag als Spalte
        { id: "erfasst_spalte", selten: true, art: "schalter", label: "Spalte „Erfasst am“ drucken", hilfe: `${MARKE.name} merkt sich je Arbeitstag, wann er erfasst und zuletzt geändert wurde.` },
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
            { id: "einsatzort", art: "text", label: "Einsatzort", hilfe: "z. B. Objekt, Kunde, Baustelle oder Filiale" },
            { id: "bemerkung", selten: true, art: "text", label: "Bemerkung", hilfe: "z. B. Urlaub, krank" },
          ],
        },
      ],
    },
  ],
  ergebnis: (d) => {
    const { hoechstMinuten } = arbeitszeitPruefung(d);
    return [...(hoechstMinuten !== null ? ([["Höchstens im Minijob", stundenDezimal(hoechstMinuten)]] as [string, string][]) : []), ["Arbeitszeit im Monat", stunden(zeiten(d).gesamt)]];
  },
  pruefen(d) {
    const alle = liste(d, "tage");
    // R12 (Kurier #1): hat irgendein Tag Inhalt, ist jeder Tag ohne Beginn und Ende unvollständig – auch ein leer
    // angelegter. Nur das Blatt zum Eintragen von Hand (kein Tag mit Inhalt) braucht keine Uhrzeiten.
    const tage = alle.some(mitInhalt) ? alle : [];
    const f = tage.flatMap((x, i) =>
      text(x, "bemerkung")
        ? []
        : [["beginn", "Beginn"], ["ende", "Ende"]].filter(([k]) => !text(x, k!)).map(([, label]) => `Arbeitstag${tage.length > 1 ? ` ${i + 1}` : ""}: ${label}`),
    );
    // R12 (Kurier #1, Zoll): Arbeitstage vor „Beschäftigt seit“ sind ein Fehler, keine bloße Warnung
    const seit = text(d, "beschaeftigt_seit");
    const daten = zaehlendeTage(d);
    const vorher = ISO_TAG.test(seit) ? daten.filter((t) => t < seit) : [];
    if (vorher.length) f.push(`${vorher.length === 1 ? `Der Arbeitstag am ${datumDe(vorher[0]!)} liegt` : `${vorher.length} Arbeitstage (ab ${datumDe(vorher[0]!)}) liegen`} vor „Beschäftigt seit“ (${datumDe(seit)}). Bitte Datum bzw. Beginn der Beschäftigung prüfen.`);
    // R12 (Kurier #11): eingetragener Monat begrenzt die Tage
    const m = monatSchluessel(text(d, "monat"));
    const fremd = m ? daten.filter((t) => !t.startsWith(m)) : [];
    if (fremd.length) f.push(`${fremd.length === 1 ? `Der Arbeitstag am ${datumDe(fremd[0]!)} liegt` : `${fremd.length} Arbeitstage (ab ${datumDe(fremd[0]!)}) liegen`} nicht im Monat ${text(d, "monat")}.`);
    return f;
  },
  hinweise(d) {
    const r: string[] = [];
    const tage = zaehlendeTage(d);
    if (!monatSchluessel(text(d, "monat")) && tage.length && monatVon(tage[0]!) !== monatVon(tage[tage.length - 1]!)) r.push("Die Arbeitstage stammen aus mehreren Monaten. Üblich ist ein Nachweis je Person und Monat.");
    return [...r, ...arbeitszeitPruefung(d).hinweise];
  },
  html(d, b) {
    const { z, gesamt } = zeiten(d);
    const monat = monatAus(d);
    // Einsatzort als eigene Spalte nur, wenn er irgendwo eingetragen ist
    const mitOrt = z.some(({ x }) => text(x, "einsatzort"));
    // ohne Einträge: Blatt zum Eintragen von Hand – eine hohe Zeile je Tag, keine Summe „0:00 h“
    const leer = !z.length;
    const leerzeilen = leer ? 31 : ja(d, "leerzeilen") ? 31 - z.length : 0;
    const mitErfasst = !leer && ja(d, "erfasst_spalte");
    const erfasst = (x: Eintrag) => (text(x, "erfasst_am") ? `${datumDe(text(x, "erfasst_am"))}${text(x, "geaendert_am") && text(x, "geaendert_am") !== text(x, "erfasst_am") ? `<br><span class="klein">geändert ${datumDe(text(x, "geaendert_am"))}</span>` : ""}` : "");
    const summeZeile = (n: number) => (ja(d, "leerzeilen") ? { summe: ["<strong>Summe der erfassten Tage</strong>", `<strong>${stunden(gesamt)}</strong>`, ...Array<string>(n - 5).fill("")], summeSpanne: 4 } : { summe: ["<strong>Summe</strong>", "", "", "", `<strong>${stunden(gesamt)}</strong>`, ...Array<string>(n - 5).fill("")] });
    const grund = (x: Eintrag, min: number | null) => [datumDe(text(x, "datum")), esc(text(x, "beginn")), esc(text(x, "ende")), esc(text(x, "pause")), min === null ? "" : stunden(min)];
    const tabelleHtml = mitErfasst
      ? // R12: mit Spalte „Erfasst am“ – Breiten neu verteilt
        ((kopf: string[], breiten: string[]) => tabelle(kopf, z.map(({ x, min }) => [...grund(x, min), ...(mitOrt ? [zelle(text(x, "einsatzort"))] : []), zelle(text(x, "bemerkung")), erfasst(x)]), { breiten, leerzeilen, hoch: ja(d, "leerzeilen"), zahlen: [3, 4], ...summeZeile(kopf.length) }))(
          ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", ...(mitOrt ? ["Einsatzort"] : []), "Bemerkung", "Erfasst am"],
          mitOrt ? ["12%", "9%", "9%", "10%", "10%", "19%", "17%", "14%"] : ["13%", "10%", "10%", "11%", "11%", "31%", "14%"],
        )
      : mitOrt
        ? tabelle(
            ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Einsatzort", "Bemerkung"],
            z.map(({ x, min }) => [...grund(x, min), zelle(text(x, "einsatzort")), zelle(text(x, "bemerkung"))]),
            { breiten: ["13%", "10%", "10%", "11%", "11%", "24%", "21%"], leerzeilen, hoch: ja(d, "leerzeilen"), zahlen: [3, 4], ...summeZeile(7) },
          )
        : tabelle(
            ["Datum", "Beginn", "Ende", "Pause (Min.)", "Dauer", "Bemerkung"],
            z.map(({ x, min }) => [...grund(x, min), zelle(text(x, "bemerkung"))]),
            { breiten: ["15%", "12%", "12%", "13%", "13%", "35%"], leerzeilen, hoch: leer || ja(d, "leerzeilen"), zahlen: [3, 4], ...(leer ? { summe: ["<strong>Summe</strong>", "", "", "", ZELLE_LINIE, ""] } : summeZeile(6)) },
          );
    return dokument({
      titel: "Arbeitszeitnachweis",
      betrieb: b,
      unter: [text(d, "name"), monat].filter(Boolean).join(", ") || undefined,
      meta: `Beschäftigte Person: ${text(d, "name")}\nMonat: ${monat}`,
      inhalt:
        // die Kennungsleiste lässt leere Angaben weg: dann je fehlender Angabe eine Zeile zum Eintragen von Hand
        (!text(d, "name") || !monat ? `<div style="margin-bottom:5mm">${felder([["Beschäftigte Person", text(d, "name") ? null : ""], ["Monat", monat ? null : ""]], { nummern: false })}</div>` : "") +
        tabelleHtml +
        `<p class="nachsatz">${esc(aufzeichnungsSatz(d))}</p>` +
        fassungNachsatz(d) +
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
  // StB GoBD (E-7): Übersicht aus den Abrechnungen – das Lohnkonto nach § 4 LStDV führt das Lohnprogramm
  titel: "Lohnkonto-Übersicht (aus den Abrechnungen)",
  beschreibung: "Je beschäftigte Person die Stammdaten und für jeden Monat Lohn, Steuern und Beiträge aus der Lohnabrechnung – mit Jahressummen. Das Lohnkonto nach § 4 LStDV führt dein Lohnprogramm bzw. Lohnbüro; diese Übersicht ersetzt es nicht.",
  bereich: "personal",
  // nicht „Lohnabrechnung über geprüfte Software“ (personal.lohnabrechnung): das Lohnkonto ersetzt keine Lohnsoftware
  pflichten: ["personal.lohnsteuer_anmeldung"],
  person: { art: "mitarbeiter", felder: { name: "name", geburtsdatum: "geburtsdatum", anschrift: "anschrift", steuer_id: "steuer_id", steuerklasse: "steuerklasse", sv_nummer: "sv_nummer", krankenkasse: "krankenkasse", beginn: "eintritt" } },
  grundlage: "§ 41 EStG; § 4 LStDV",
  namensFeld: "name",
  abschnitte: [
    {
      titel: "Stammdaten",
      hilfe: `${MARKE.name} rechnet keine Lohnsteuer und keine Beiträge – trag die Beträge aus deiner Lohnabrechnung ein. Das Lohnkonto selbst (§ 4 LStDV, mit allen Pflichtangaben wie Großbuchstaben, Zuschlägen und Arbeitgeberanteilen) kommt aus dem Lohnprogramm.`,
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
      titel: "Lohnkonto-Übersicht",
      betrieb: b,
      unter: ["aus den Abrechnungen", text(d, "name"), text(d, "jahr")].filter(Boolean).join(" · "),
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
            : tabelle(kopf, m.map((e) => [zelle(text(e, "monat")), datumDe(text(e, "zahltag")), ...BETRAEGE.map(([k]) => betrag(e, k)), ja(e, "unterbrechung") ? "U" : ""]), { ...tabellenOptionen, summe: ["<strong>Summe</strong>", "", ...BETRAEGE.map(([k]) => (spalteLeer(k) ? STRICH : `<strong>${euro(summe(m, k))}</strong>`)), ""] })) +
            // StB GoBD (E-7, Abschnitt 8): Fußnote und Hinweis in einer Zeile, damit alle zwölf Monate auf ein Blatt passen
            steuerHinweis("lohn", MARKE.name, { vorweg: "* U = Unterbrechung ohne Lohnanspruch (§ 41 Abs. 1 EStG).", kurz: true }),
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
  { wert: "werkstudent", text: "Werkstudent/in" },
];

/**
 * StB Busch (Durchsicht 23.10.2026): Geschlecht für die Anmeldung ohne Sozialversicherungsnummer (mit Geburtsname,
 * Geburtsort und Staatsangehörigkeit für die Vergabe), fünfstellige Tätigkeit (KldB 2010) und Kennzeichen
 * Arbeitnehmerüberlassung im Tätigkeitsschlüssel, bei Minijobs die Befreiung von der Rentenversicherungspflicht.
 */
const GESCHLECHT = [
  { wert: "W", text: "weiblich" },
  { wert: "M", text: "männlich" },
  { wert: "D", text: "divers" },
  { wert: "X", text: "unbestimmt" },
];
/** Tätigkeitsschlüssel Stelle 8 */
const AN_UEBERLASSUNG = [
  { wert: "1", text: "nein" },
  { wert: "2", text: "ja" },
];
const RV_BEFREIUNG = [
  { wert: "befreit", text: "Befreiung von der Rentenversicherungspflicht beantragt (§ 6 Abs. 1b SGB VI)" },
  { wert: "pflichtig", text: "keine Befreiung – rentenversicherungspflichtig" },
];
export const SV_GESCHLECHT_HILFE = "Nötig, wenn noch keine Sozialversicherungsnummer vorliegt: Mit Geburtsname, Geburtsort und Staatsangehörigkeit wird damit die Nummer vergeben.";

export const svMeldedaten: Vorlage = {
  id: "sv_meldedaten",
  gestalt: "formular",
  titel: "Personalfragebogen (Daten für die Anmeldung)",
  beschreibung: "Alle Angaben einer neuen beschäftigten Person, die du für die Anmeldung zur Sozialversicherung und die Lohnabrechnung brauchst – zum Unterschreiben.",
  bereich: "personal",
  pflichten: ["personal.sv_anmeldung", "personal.sofortmeldung"],
  person: { art: "mitarbeiter", felder: { name: "name", geburtsname: "geburtsname", geburtsdatum: "geburtsdatum", geburtsort: "geburtsort", staatsangehoerigkeit: "staatsangehoerigkeit", anschrift: "anschrift", sv_nummer: "sv_nummer", steuer_id: "steuer_id", krankenkasse: "krankenkasse", iban: "iban", beginn: "beginn", taetigkeit: "taetigkeit", art: "art", wochenstunden: "stunden" } },
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
        { id: "geschlecht", art: "wahl", label: "Geschlecht", optionen: GESCHLECHT, hilfe: SV_GESCHLECHT_HILFE },
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
        { id: "kldb", art: "text", label: "Ausgeübte Tätigkeit nach KldB 2010 (fünfstellig)", hilfe: "Stellen 1 bis 5 des Tätigkeitsschlüssels – Schlüsselverzeichnis der Bundesagentur für Arbeit; trägt sonst der Arbeitgeber bzw. das Lohnbüro ein" },
        { id: "ueberlassung", art: "wahl", label: "Arbeitnehmerüberlassung", optionen: AN_UEBERLASSUNG, vorbelegung: "1", hilfe: "Stelle 8 des Tätigkeitsschlüssels" },
        { id: "schulabschluss", art: "wahl", label: "Höchster Schulabschluss", optionen: SV.schulabschluss },
        { id: "ausbildung", art: "wahl", label: "Höchster Berufsabschluss", optionen: SV.ausbildung },
        { id: "rv_befreiung", art: "wahl", label: "Rentenversicherung im Minijob", optionen: RV_BEFREIUNG, wenn: { feld: "art", ist: "minijob" }, pflicht: true, hilfe: "Minijobs sind rentenversicherungspflichtig; die beschäftigte Person kann die Befreiung schriftlich beim Arbeitgeber beantragen (§ 6 Abs. 1b SGB VI)" },
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
    if (text(d, "kldb").trim() && !/^\d{5}$/.test(text(d, "kldb").trim())) f.push("Tätigkeit nach KldB 2010: fünf Ziffern, z. B. aus dem Schlüsselverzeichnis der Bundesagentur für Arbeit");
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
      [leer ? "Tätigkeit nach KldB 2010, fünfstellig (trägt der Arbeitgeber ein)" : "Tätigkeit nach KldB 2010", text(d, "kldb")],
      [leer ? "Arbeitnehmerüberlassung (trägt der Arbeitgeber ein)" : "Arbeitnehmerüberlassung", mitSchluessel(AN_UEBERLASSUNG.find((o) => o.wert === wahl("ueberlassung", "1")))],
      // Schlüssel des Meldeverfahrens: auf dem leeren Blatt trägt sie der Arbeitgeber ein
      [leer ? "Personengruppe (trägt der Arbeitgeber ein)" : "Personengruppe", SV.personengruppen.find((o) => o.wert === wahl("personengruppe", "101"))?.text ?? ""],
      [leer ? "Vertragsform (trägt der Arbeitgeber ein)" : "Vertragsform", mitSchluessel(SV.vertragsform.find((o) => o.wert === wahl("vertragsform", "1")))],
      ["Schulabschluss", kreuze(SV.schulabschluss, text(d, "schulabschluss"), true)],
      ["Berufsabschluss", kreuze(SV.ausbildung, text(d, "ausbildung"), true)],
      // Minijob: Befreiung von der Rentenversicherungspflicht – leer zum Ankreuzen
      ...(leer || text(d, "art") === "minijob" ? ([["Nur bei Minijob: Rentenversicherung", kreuze(RV_BEFREIUNG, text(d, "rv_befreiung"), false)]] as [string, string | Roh][]) : []),
      ["Weitere Beschäftigungen", ja(d, "weitere") ? text(d, "weitere_welche") || "ja" : leer ? "" : "keine"],
    ];
    // Geburtsname: ausgefüllt oder auf dem leeren Blatt als Zeile; Feldnummern laufen durch
    const geburtsname = text(d, "geburtsname") || (leer ? "" : null);
    const person: [string, string | Roh | null][] = [
      ["Name", text(d, "name")],
      ["Geburtsname (falls abweichend)", geburtsname],
      ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
      ["Geschlecht", kreuze(GESCHLECHT, text(d, "geschlecht"), false)],
      ["Geburtsort", text(d, "geburtsort")],
      ["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")],
      ["Anschrift", text(d, "anschrift")],
      ["SV-Nummer", svNummerText(text(d, "sv_nummer"))],
      ["Steuer-ID", text(d, "steuer_id")],
      ["Krankenkasse", text(d, "krankenkasse")],
      ["IBAN", ibanText(text(d, "iban"))],
    ];
    const start = person.filter((x) => x[1] !== null).length + 1;
    // das letzte Feld bleibt mit Erklärung und Unterschrift zusammen (nicht allein auf einer neuen Seite) – mehr
    // Felder schöben den Block samt Feldern auf die Folgeseite und ließen auf Seite 1 eine Lücke
    const teil = beschaeftigung.length - 1;
    return dokument({
      titel: "Personalfragebogen",
      betrieb: b,
      unter: text(d, "name") ? `${text(d, "name")}, Angaben für die Anmeldung zur Sozialversicherung` : "Angaben für die Anmeldung zur Sozialversicherung",
      meta: `Beginn: ${datumDe(text(d, "beginn"))}`,
      inhalt:
        `<p class="klein">Mit diesen Angaben meldet der Arbeitgeber bzw. das Lohnbüro die Beschäftigung bei der Krankenkasse an (DEÜV). Die Schlüssel für Personengruppe, Tätigkeit, Arbeitnehmerüberlassung, Vertragsform und Abschlüsse sind die des Meldeverfahrens. Liegt noch keine Sozialversicherungsnummer vor, werden Geschlecht, Geburtsname, Geburtsort und Staatsangehörigkeit für die Vergabe gebraucht.</p>` +
        abschnitt(
          "Person",
          felder(person),
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
