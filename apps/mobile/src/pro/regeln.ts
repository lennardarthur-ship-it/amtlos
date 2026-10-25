/**
 * Amtlos Pro (E-132, E-188) – reine Regeln, ohne Gerät testbar.
 *
 * Seit E-188 („Modell Check-Teaser“, ersetzt E-156): Kostenlos ist nur das Ausprobieren des Pflichten-Checks – alle
 * Fragen beantworten, im Ergebnis die Zahl der Pflichten, die nach den Angaben in Frage kommen, und die ersten 3
 * Pflichten (nach Dringlichkeit wie im Überblick) mit Titel, Kurztext und Termin, die sich auch abhaken lassen. Alle
 * weiteren Pflichten stehen nur als Zahl da („… und 38 weitere“, mit Pro).
 *
 * Pro ist alles Weitere: Rechnungen und E-Rechnung, Belege (auch E-Rechnungen empfangen) und Kasse, alle Pflichten mit
 * Erinnerungen, Paket für die Steuerberatung und Werte per Tipp, Vorlagen ausfüllen und als PDF, Kontrollmappe,
 * Pflicht-Details, Briefkopf, iCloud-Sicherung, Synchronisation. Im Katalog lassen sich die Vorlagen ohne Pro ansehen
 * (Titel, Beschreibung); eine neue Unterlage anlegen gehört zu Pro.
 *
 * Grundsatz (GoBD, Datenschutz, App Review 3.1): Pro sperrt nie den Zugriff auf eigene Daten – was schon da ist,
 * bleibt sichtbar; eine schon ausgegebene Unterlage lässt sich immer wieder teilen und drucken, eine ausgegebene
 * Rechnung immer stornieren (das Storno teilen eingeschlossen), vorhandene Entwürfe bleiben ansehbar und bearbeitbar,
 * vorhandene Belege lassen sich ansehen, bearbeiten und exportieren, erfasste Kassentage ansehen und mit Grund
 * korrigieren und ihr Kassenbuch ansehen, teilen und drucken (Aufbewahrung, § 147 AO); Sicherung, Wiederherstellen,
 * Datenexport und Löschen gehen immer, und ein Ende von Pro löscht oder versteckt nichts.
 */
import type { Betrieb } from "@amtlos/fachlogik";
import { dringlichkeit, type Auswertung } from "../pflichten/check";
import type { Unterlage } from "../unterlagen/speicher";

/** Pflichten, die ohne Pro mit Titel, Kurztext und Termin erscheinen (E-188). */
export const PFLICHTEN_FREI = 3;

export type ProFunktion = "rechnungen" | "e_rechnung" | "belege" | "kasse" | "pflichten" | "erinnerungen" | "steuerberater" | "ust_uebernahme" | "pdf" | "kontrollmappe" | "pflicht_details" | "briefkopf" | "icloud" | "sync";

/**
 * Reihenfolge der Vorteile auf dem Bezahlschirm (E-189, ersetzt die Reihenfolge aus E-188): der Pflichten-Kompass
 * zuerst – alle Pflichten, Erinnerung vor jeder Frist, jede Pflicht erklärt, Kontrollmappe (die vier großen Kacheln) –,
 * dann die Vorlagen zum Erledigen, danach als Zugabe Rechnungen, E-Rechnung, Belege, Kasse und das Paket für die
 * Steuerberatung, Komfort zuletzt. Die Werte per Tipp (`ust_uebernahme`) stehen beim Paket für die Steuerberatung mit dabei.
 */
export const PRO_VORTEILE: ProFunktion[] = ["pflichten", "erinnerungen", "pflicht_details", "kontrollmappe", "pdf", "rechnungen", "e_rechnung", "belege", "kasse", "steuerberater", "briefkopf", "icloud", "sync"];

/** Vorlagen, deren PDF ohne Pro immer geht: das Kassenbuch – es entsteht nur lesbar aus schon erfassten Tagen (GoBD). */
const IMMER_FREI = new Set(["kassenbuch"]);
const istStorno = (u: Pick<Unterlage, "daten">) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/**
 * Neue Daten anlegen – eine Unterlage (Rechnung, Vorlage, Kopie, Ersatzrechnung), einen Beleg (auch aus einer
 * empfangenen E-Rechnung), einen Kassentag, Kassensturz oder eine Sachentnahme – gehört zu Pro (E-188). Ein Storno
 * einer ausgegebenen Rechnung ist keine neue Unterlage in diesem Sinn: es geht immer (GoBD).
 */
export const erstellenErlaubt = (pro: boolean) => pro;
/** Kasse: neue Kassendaten erfassen nur mit Pro (Ansehen, Korrigieren, Kassenbuch teilen gehen immer). */
export const kasseErfassenErlaubt = erstellenErlaubt;

/**
 * Darf diese Unterlage jetzt geteilt oder gedruckt werden? Mit Pro immer. Ohne Pro: was schon einmal ausgegeben wurde
 * (erneut teilen, drucken, korrigierte Fassung), jedes Storno und das Kassenbuch erfasster Tage; eine noch nie
 * ausgegebene Rechnung oder Vorlage nicht.
 */
export function ausgabeErlaubt(u: Unterlage, pro: boolean): boolean {
  return pro || Boolean(u.ausgegeben) || istStorno(u) || IMMER_FREI.has(u.vorlage);
}

/** Welche Pro-Funktion fehlt, wenn `ausgabeErlaubt` bzw. `erstellenErlaubt` nein sagt: Rechnungen bzw. Vorlagen. */
export const ausgabeGrund = (u: Pick<Unterlage, "vorlage">): ProFunktion => (u.vorlage === "rechnung" ? "rechnungen" : "pdf");

/**
 * Die Pflichten, die ohne Pro sichtbar sind (E-188): die ersten 3 nach Dringlichkeit wie im Überblick – „Jetzt dran“,
 * dann „In den nächsten Wochen“, dann die übrigen Pflichten. Gerechnet ohne Haken und ohne Unterlagen: Abhaken
 * verschiebt die Auswahl nicht (sonst rückte mit jedem Haken eine weitere Pflicht nach); sie hängt nur von den
 * Antworten im Check und vom Tag ab. E-192: nur echte Pflichten (Katalog `einordnung: pflicht`, wie `zaehlung`) – so
 * gehen „3 frei + N weitere“ in der Gesamtzahl auf; mit `a` aus `terminStand` steht ein überfälliger Termin als
 * dringendster vorn (bis er abgehakt ist – das ist die einzige Stelle, an der ein Haken die Auswahl ändert).
 */
export function freiePflichten(a: Auswertung, betrieb: Betrieb, tag: string): Set<string> {
  const d = dringlichkeit(a, { erledigt: {}, unterlagen: [], betrieb }, tag);
  const reihe = [...d.jetzt, ...d.naechsteWochen, ...d.imBlick].filter((p) => p.einordnung === "pflicht");
  const ids: string[] = [];
  for (const p of reihe) if (!ids.includes(p.id) && ids.length < PFLICHTEN_FREI) ids.push(p.id);
  return new Set(ids);
}

/**
 * E-192: „… und N weitere Pflichten“ – dieselbe Zählung wie überall (`zaehlung`: nur `einordnung: pflicht`), abzüglich
 * der freien. Hinweise und Optionen zählen nicht mit.
 */
export function weiterePflichten(a: Pick<Auswertung, "gilt">, frei: ReadonlySet<string>): number {
  const pflichten = a.gilt.filter((p) => p.einordnung === "pflicht");
  return pflichten.length - pflichten.filter((p) => frei.has(p.id)).length;
}

/** Pflicht sichtbar? Mit Pro jede, ohne Pro nur die freien (`frei` aus `freiePflichten`). */
export const pflichtSichtbar = (id: string, pro: boolean, frei: ReadonlySet<string>) => pro || frei.has(id);

/**
 * Bezahlschirm nach dem ersten Pflichten-Check (E-188): genau einmal von selbst – ohne Pro, wenn feststeht, dass Pro
 * fehlt (`proBekannt`), der Bezahlschirm in diesem Build angeboten wird und er noch nie so gezeigt wurde (`gezeigt`).
 * Danach nur noch über die üblichen Anlässe.
 */
export const bezahlschirmNachCheck = (o: { pro: boolean; proBekannt: boolean; verfuegbar: boolean; gezeigt?: string }) => !o.pro && o.proBekannt && o.verfuegbar && !o.gezeigt;

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
 * Pflicht-Details (E-156, in E-188 unverändert): Ohne Pro zeigt die Pflicht den Überblick – Titel, Kurztext, Termin bzw. Stand und Abhaken
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
