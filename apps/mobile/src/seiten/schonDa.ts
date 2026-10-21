/**
 * „Was hast du schon?“ – vor dem Ergebnis des Checks für Betriebe, die schon laufen (R11, Berater d, Befund 3; R12 UX #1/#2:
 * schon ab vier Wochen, und vor der Hauptzahl). Wer arbeitet, hat Kasse gemeldet, Impressum online und eine
 * Gefährdungsbeurteilung im Ordner – die Liste soll nicht bei „26 Dinge sind jetzt dran“ beginnen. Reine Funktionen
 * (testbar ohne Oberfläche).
 */
import { KATALOG, KATEGORIE_TITEL, inZukunft as pflichtInZukunft, istErledigt, type Auswertung, type Erledigt, type PflichtInfo, type Profil } from "../pflichten/check";

/** Ab so vielen Tagen seit Beginn fragt Amtlos im Check, was schon erledigt ist (R12 UX #1: vier Wochen statt zwölf Monate). */
export const LANG_BESTEHEND_TAGE = 28;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function minusTage(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t - n)).toISOString().slice(0, 10);
}

/** Läuft der Betrieb laut Check (Gründungsdatum) schon länger als vier Wochen? */
export function langBestehend(profil: Profil, stichtag: string): boolean {
  const beginn = profil.gruendungsdatum;
  return typeof beginn === "string" && ISO.test(beginn) && beginn <= minusTage(stichtag, LANG_BESTEHEND_TAGE);
}

/**
 * Gilt die Pflicht erst in der Zukunft (R12 Kfz #13: „E-Rechnungen versenden (ab 2028)“ ließ sich schon abhaken)? Aus
 * check.ts (`inZukunft`, Katalog `gueltig_ab` bzw. Stichtag) – hier je Pflicht-ID für Tests und Aufrufer ohne PflichtInfo.
 */
export function inZukunft(id: string, stichtag: string, a?: Auswertung): boolean {
  const p = a?.gilt.find((x) => x.id === id);
  if (p) return pflichtInZukunft(p, stichtag);
  const k = NACH_ID.get(id);
  if (!k) return false;
  if (typeof k.gueltig_ab === "string" && k.gueltig_ab > stichtag) return true;
  const frist = k.frist as { typ?: string; datum?: string };
  return frist.typ === "absolut" && typeof frist.datum === "string" && frist.datum > stichtag && (k.wiederholung?.art ?? "einmalig") === "einmalig";
}
const NACH_ID = new Map(KATALOG.pflichten.map((p) => [p.id, p]));

/**
 * Typische Pflichten, die ein laufender Betrieb längst erfüllt hat: echte Pflichten, die einmal bzw. dauerhaft zu
 * erledigen sind (keine laufenden Termine, keine Aufgaben je neuer Person), die nicht Lohnbüro oder Steuerberatung
 * übernehmen und nicht erst in der Zukunft gelten – noch offen. Sortiert nach Bereich, darin nach Titel.
 */
export function schonDaKandidaten(a: Auswertung, e: Erledigt, stichtag = e.heute ?? new Date().toISOString().slice(0, 10)): PflichtInfo[] {
  return a.gilt
    .filter((p) => p.einordnung === "pflicht" && !p.lohnbuero && !p.wiederkehrend && p.erledigung.art !== "laufend" && !p.personen.length && !pflichtInZukunft(p, stichtag) && !inZukunft(p.id, stichtag) && !istErledigt(p, e))
    .sort((x, y) => bereichRang(x) - bereichRang(y) || x.titel.localeCompare(y.titel, "de"));
}

/** Reihenfolge der Bereiche: erst die Startschritte, dann wie im Ergebnis. */
const BEREICHE = ["gruendung", ...Object.keys(KATEGORIE_TITEL).filter((k) => k !== "gruendung")];
const bereichVon = (p: PflichtInfo) => (p.gruendungsschritt ? "gruendung" : p.kategorie);
const bereichRang = (p: PflichtInfo) => {
  const i = BEREICHE.indexOf(bereichVon(p));
  return i < 0 ? BEREICHE.length : i;
};

/** R12 (UX #19): die Liste nach Bereichen („Gründung“, „Steuern“, „Arbeitsschutz“ …) statt 24 Zeilen alphabetisch. */
export function schonDaGruppen(liste: readonly PflichtInfo[]): { bereich: string; titel: string; pflichten: PflichtInfo[] }[] {
  const gruppen: { bereich: string; titel: string; pflichten: PflichtInfo[] }[] = [];
  for (const p of [...liste].sort((x, y) => bereichRang(x) - bereichRang(y) || x.titel.localeCompare(y.titel, "de"))) {
    const bereich = bereichVon(p);
    const g = gruppen.find((x) => x.bereich === bereich);
    if (g) g.pflichten.push(p);
    else gruppen.push({ bereich, titel: KATEGORIE_TITEL[bereich] ?? "Weitere", pflichten: [p] });
  }
  return gruppen;
}

/**
 * Was der Haken bestätigt – passend zum Profil (R12 UX #19): Impressum und Datenschutzerklärung „auf der Website
 * veröffentlicht“ nur, wenn es eine Website gibt; sonst im Shop bzw. auf den Profilen.
 */
export function bestaetigungFuer(p: PflichtInfo, profil: Profil): string | null {
  if (p.erledigung.art !== "bestaetigen" || !p.erledigung.bestaetigung) return null;
  if ((p.id === "online.impressum" || p.id === "online.datenschutzerklaerung") && profil["online.website"] !== true) {
    const kanaele = Array.isArray(profil["vertrieb.kanaele"]) ? (profil["vertrieb.kanaele"] as string[]) : [];
    const shop = kanaele.includes("onlineshop") || kanaele.includes("app");
    if (p.id === "online.impressum") return shop ? (profil["online.social_media"] === true ? "Im Shop und auf deinen Profilen hinterlegt" : "Im Shop bzw. in der App hinterlegt") : "Auf deinen Profilen (z. B. Instagram) hinterlegt";
    return "Im Shop bzw. in der App veröffentlicht";
  }
  return p.erledigung.bestaetigung;
}
