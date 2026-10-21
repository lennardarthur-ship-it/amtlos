/**
 * Amtlos Pro (E-132, E-156) – reine Regeln, ohne Gerät testbar.
 *
 * Seit E-156 (ersetzt E-154): Kostenlos ist, was jeder Betrieb täglich braucht – Rechnungen (auch Gutschriften und
 * Stornos, als PDF, ohne Limit), Belege und E-Rechnungen empfangen, Kasse und Kassenbuch, der Pflichten-Check im
 * Überblick (was in Frage kommt, Kurztext, Termin, Abhaken), Fristen in der App, alle Vorlagen ausfüllen und ansehen,
 * Sicherung, Wiederherstellen und das offene Archiv. Je Kalendermonat geht außerdem eine Vorlage (alles außer Rechnung
 * und Kassenbuch) kostenlos zum ersten Mal als PDF hinaus.
 *
 * Pro: alle Vorlagen als PDF, Erinnerungen per Mitteilung, Kontrollmappe, Pflicht-Details (Erklärung, Folgen,
 * Rechtsgrundlage, Quellen, Vorlage), Paket für die Steuerberatung und Werte per Tipp, E-Rechnung erstellen, Briefkopf,
 * iCloud-Sicherung, Synchronisation.
 *
 * Grundsatz (GoBD, Datenschutz, App Review 3.1): Pro sperrt nie den Zugriff auf eigene Daten – eine schon einmal
 * ausgegebene Unterlage lässt sich immer wieder teilen und drucken, Entwürfe immer ausfüllen, ansehen und speichern,
 * Storno, Sicherung, Wiederherstellen und Datenexport sind frei, und ein Ende von Pro löscht oder versteckt nichts.
 */
import type { Betrieb } from "@amtlos/fachlogik";
import type { Unterlage } from "../unterlagen/speicher";

/** Vorlagen (ohne Rechnung und Kassenbuch), die kostenlos je Kalendermonat zum ersten Mal als PDF hinausgehen (E-156). */
export const VORLAGEN_FREI_JE_MONAT = 1;

export type ProFunktion = "pdf" | "erinnerungen" | "kontrollmappe" | "pflicht_details" | "steuerberater" | "ust_uebernahme" | "e_rechnung" | "briefkopf" | "icloud" | "sync";

/**
 * Reihenfolge der Vorteile auf dem Bezahlschirm (E-156): „Pflichten erfüllen, Kontrollen bestehen“ zuerst, Komfort
 * zuletzt. Die Werte per Tipp (`ust_uebernahme`) stehen beim Paket für die Steuerberatung mit dabei.
 */
export const PRO_VORTEILE: ProFunktion[] = ["pdf", "erinnerungen", "kontrollmappe", "pflicht_details", "steuerberater", "e_rechnung", "briefkopf", "icloud", "sync"];

/** Vorlagen, deren PDF immer kostenlos ist: Rechnungen (mit Gutschrift und Storno) und das Kassenbuch (Kasse). */
const IMMER_FREI = new Set(["rechnung", "kassenbuch"]);

/** Kalendermonat in Deutschland (Europe/Berlin) – nicht UTC, sonst wechselt das Kontingent nachts um 1 bzw. 2 Uhr. */
const BERLIN = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
const monat = (iso: string | Date) => BERLIN.format(typeof iso === "string" ? new Date(iso) : iso).slice(0, 7);
const istStorno = (u: Pick<Unterlage, "daten">) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/** Zählt diese Unterlage aufs Freikontingent? Jede Vorlage außer Rechnung (auch Gutschrift, Storno) und Kassenbuch (E-156). */
export const zaehltFuerKontingent = (u: Pick<Unterlage, "vorlage">) => !IMMER_FREI.has(u.vorlage);

/**
 * Im Monat von `jetzt` erstmals ausgegebene Vorlagen – ohne Stornos (Korrekturen zählen nie) und ohne Konfliktkopien
 * (K1: dieselbe Unterlage, auf einem zweiten Gerät geteilt).
 */
export function verbraucht(unterlagen: Unterlage[], jetzt: Date): number {
  const m = monat(jetzt);
  return unterlagen.filter((u) => zaehltFuerKontingent(u) && u.ausgegeben && monat(u.ausgegeben) === m && !istStorno(u) && !u.konfliktKopieVon).length;
}

/** Wie viele kostenlose erste Ausgaben einer Vorlage in diesem Monat noch übrig sind. */
export const uebrig = (unterlagen: Unterlage[], jetzt: Date) => Math.max(0, VORLAGEN_FREI_JE_MONAT - verbraucht(unterlagen, jetzt));

/**
 * Darf diese Unterlage jetzt geteilt oder gedruckt werden? Mit Pro immer; sonst, wenn sie eine Rechnung bzw. ein
 * Kassenbuch ist, schon einmal ausgegeben wurde (erneut teilen, drucken, korrigierte Fassung), ein Storno ist oder
 * die kostenlose Vorlage des Monats noch frei ist.
 */
export function ausgabeErlaubt(unterlagen: Unterlage[], u: Unterlage, pro: boolean, jetzt: Date): boolean {
  if (pro || u.ausgegeben || istStorno(u) || !zaehltFuerKontingent(u)) return true;
  return uebrig(unterlagen, jetzt) > 0;
}

/**
 * Darf die E-Rechnung (XRechnung) dieser Rechnung geteilt werden? Erstellen gehört zu Pro; eine schon einmal als
 * E-Rechnung geteilte Rechnung lässt sich immer wieder teilen – auch wenn Pro inzwischen endete (eigene Daten).
 */
export const eRechnungErlaubt = (u: Pick<Unterlage, "eRechnungGeteilt">, pro: boolean) => pro || Boolean(u.eRechnungGeteilt);

/** Betrieb für Dokumente: Logo und Hausfarbe nur mit Pro – ohne Pro der neutrale Briefkopf (die Angaben bleiben gespeichert). */
export const betriebFuerDokument = (b: Betrieb, pro: boolean): Betrieb => (pro ? b : { ...b, logo: "", farbe: "" });

/** Erinnerungen per Mitteilung laufen nur mit Pro und eingeschaltetem Schalter; die Fristen in der App sieht jeder. */
export const erinnerungenAktiv = (an: boolean, pro: boolean) => an && pro;

/**
 * Geplante Mitteilungen mit dem Pro-Stand abgleichen: mit Pro und Schalter den Plan setzen, sonst alle absagen – endet
 * Pro, verschwinden die geplanten Mitteilungen still, Schalterstellung und Fristen bleiben (nichts wird gelöscht).
 */
export async function erinnerungenAbgleichen<P>(an: boolean, pro: boolean, plan: P, geraet: { planen: (plan: P) => Promise<void>; allesAbsagen: () => Promise<void> }): Promise<"geplant" | "abgesagt"> {
  if (erinnerungenAktiv(an, pro)) {
    await geraet.planen(plan);
    return "geplant";
  }
  await geraet.allesAbsagen();
  return "abgesagt";
}

/**
 * Pflicht-Details (E-156): Ohne Pro zeigt die Pflicht den Überblick – Titel, Kurztext, Termin bzw. Stand und Abhaken
 * (dazu Hinweise zum eigenen Stand und den Rechtshinweis). Warum sie gilt, zuständige Stelle, Erklärung, Folgen,
 * Rechtsgrundlage, Quellen und die verknüpften Vorlagen gehören zu Pro.
 */
export const PFLICHT_PRO_TEILE = ["grund", "stelle", "erklaerung", "sanktion", "rechtsgrundlage", "quellen", "vorlagen"] as const;
type ProTeil = (typeof PFLICHT_PRO_TEILE)[number];

/** Die Pflicht so, wie sie angezeigt wird: ohne Pro sind die Pro-Teile leer (`teaser`: es gäbe dazu mehr mit Pro). */
export function pflichtAnsicht<P extends { [K in ProTeil]?: unknown }>(p: P, pro: boolean): P & { teaser: boolean } {
  if (pro) return { ...p, teaser: false };
  const leer = { grund: "", stelle: "", erklaerung: "", sanktion: null, rechtsgrundlage: [], quellen: [], vorlagen: [] };
  const teaser = PFLICHT_PRO_TEILE.some((k) => {
    const w = p[k];
    return Array.isArray(w) ? w.length > 0 : Boolean(w);
  });
  return { ...p, ...Object.fromEntries(PFLICHT_PRO_TEILE.filter((k) => k in p).map((k) => [k, leer[k]])), teaser };
}

/** Kontrollmappe zusammenstellen und teilen gehört zu Pro; jede Unterlage darin bleibt einzeln zu öffnen und (erneut) zu teilen. */
export const kontrollmappeErlaubt = (pro: boolean) => pro;
