/**
 * E-237 (T-339): Voranmeldung des Kleinunternehmers nach § 18 Abs. 4a UStG (Katalog C.37, freigegeben in v3) – Frist und
 * Erinnerung in der App nur für die Voranmeldungszeiträume, in denen laut Belegen solche Steuer entsteht.
 *
 * § 18 Abs. 4a Satz 2 UStG: „Voranmeldungen sind nur für die Voranmeldungszeiträume abzugeben, in denen die Steuer für diese
 * Umsätze zu erklären ist.“ Die Regel-Engine kennt die Belege nicht (sie liegen nur auf dem Gerät); der Eintrag rechnet
 * deshalb jeden Zeitraum (Kalendervierteljahr bzw. Kalendermonat nach dem Rhythmus des Eintrags), und sein Text sagt, dass
 * in Zeiträumen ohne solche Steuer keine Voranmeldung abzugeben ist. So bleibt es auf Server und Web (ohne Belege).
 *
 * Die App kennt die Belege und filtert die Anzeige – kein neuer Auslöser, kein geänderter Katalogtext: Ob der Eintrag gilt,
 * entscheidet weiter der Katalog (Kleinunternehmer und Einkauf im Ausland); die App behält davon nur die Termine der
 * Zeiträume mit solcher Steuer. Ohne solche Belege steht der Eintrag unter „gilt“ ohne Termin, mit einem Hinweis, und es
 * gibt keine Erinnerung.
 *
 * Zählt (je Tag der Steuerentstehung wie in der Voranmeldung, `steuerschuldTag`):
 * - Belege mit Steuerschuldnerschaft nach § 13b UStG („eu“: Leistung eines Unternehmers aus dem übrigen Gemeinschaftsgebiet,
 *   z. B. ein Software-Abo; „bau“: Bauleistung im Inland) – auch ohne Euro-Betrag (die Steuer entsteht trotzdem);
 * - innergemeinschaftliche Erwerbe („ige“) nur mit festgestellter Erwerbsbesteuerung (Erwerbsschwelle, Lage „ja“ – wie in
 *   der Übernahme in die Voranmeldung, `erwerbsschwelleLage`);
 * - ungültige Belege nicht.
 *
 * Leistungen von Unternehmen aus Drittländern (§ 13b Abs. 2 Nr. 1 UStG) lassen sich an Belegen nicht kennzeichnen (Arten
 * „eu“, „bau“, „ige“). Deshalb filtert die App nur, wenn der Betrieb angegeben hat, bei Unternehmen in anderen EU-Ländern
 * einzukaufen (`einkauf.eu_unternehmen` = ja); wer nur im Drittland einkauft (EU-Frage „nein“ bzw. offen), sieht weiter
 * jeden Zeitraum wie im Katalog. Reine Funktionen, ohne Gerät testbar.
 */
import { steuerschuldTag, type Beleg } from "@amtlos/fachlogik";
import { erwerbsschwelleLage, type ErwerbsschwelleLage } from "../unterlagen/erwerbsschwelle";

/** Katalogeintrag C.37 */
export const KU_VA_ID = "steuern.ust_voranmeldung_kleinunternehmer";

type Profil = Record<string, string | number | boolean | string[] | null>;

/** Schlüssel des Monats („JJJJ-MM“) und des Vierteljahrs („JJJJ-Qn“) eines Tages – wie die Perioden der Engine. */
export function zeitraumSchluessel(tag: string): [string, string] {
  const jahr = tag.slice(0, 4);
  const monat = Number(tag.slice(5, 7));
  return [`${jahr}-${tag.slice(5, 7)}`, `${jahr}-Q${Math.ceil(monat / 3)}`];
}

/**
 * Zeiträume (Monate und Vierteljahre), in denen laut Belegen Steuer nach § 13b UStG oder auf innergemeinschaftliche Erwerbe
 * mit Erwerbsbesteuerung entsteht.
 */
export function kuVaZeitraeume(belege: readonly Beleg[], profil: Profil, schwelleEuro: number | null): Set<string> {
  const aus = new Set<string>();
  const lage = new Map<string, ErwerbsschwelleLage>();
  for (const b of belege) {
    if (b.ungueltig || !b.steuerschuld) continue;
    const tag = steuerschuldTag(b);
    if (!/^\d{4}-\d{2}-\d{2}/.test(tag)) continue;
    if (b.steuerschuld === "ige") {
      const jahr = tag.slice(0, 4);
      if (!lage.has(jahr)) lage.set(jahr, erwerbsschwelleLage(profil, belege as Beleg[], jahr, schwelleEuro));
      if (lage.get(jahr)!.status !== "ja") continue;
    }
    for (const s of zeitraumSchluessel(tag)) aus.add(s);
  }
  return aus;
}

/** Filtert die App die Termine von C.37 für diesen Betrieb? (nur mit Einkauf in der EU – siehe oben) */
export const kuVaFiltern = (profil: Profil) => profil["einkauf.eu_unternehmen"] === true;

/** Termine (mit Periode) auf die Zeiträume mit solcher Steuer beschränken. */
export function kuVaTermine<T extends { periode: string }>(termine: readonly T[], zeitraeume: ReadonlySet<string>): T[] {
  return termine.filter((t) => zeitraeume.has(t.periode));
}
