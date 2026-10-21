/**
 * StB GoBD (Prüfbericht Heckler und Busch, D-1/D-9): Kassenbuch aus den Tagesabschlüssen – „nur lesbar“ mit Fassungsnummer
 * und Erstellungszeitpunkt auf jeder Seite, dazu wo die Einzelaufzeichnungen liegen (Kassensystem aus der Kassenmeldung
 * bzw. der Verfahrensdokumentation). Die Angaben kommen nur in die Anzeige, nicht in die festgeschriebenen Daten – so bleibt
 * der Vergleich „gleicher Inhalt, keine neue Fassung“ unberührt.
 */
import { zeitDe, type Daten } from "@amtlos/fachlogik";
import type { Stand, Unterlage } from "./speicher";

const text = (d: Daten | undefined, k: string) => (typeof d?.[k] === "string" ? (d[k] as string).trim() : "");

/** Kassensystem für den Satz „Einzelaufzeichnungen: …“ – aus der neuesten Kassenmeldung (Kasse am Standort), sonst der Verfahrensdokumentation. */
export function kassensystemText(s: Pick<Stand, "unterlagen">, standort = ""): string {
  const neueste = (vorlage: string) => s.unterlagen.filter((u) => u.vorlage === vorlage && !u.konfliktKopieVon).sort((a, b) => b.geaendert.localeCompare(a.geaendert))[0];
  const meldung = neueste("kassenmeldung");
  const kassen = (Array.isArray(meldung?.daten.kassen) ? (meldung.daten.kassen as Record<string, unknown>[]) : []).filter((k) => !text(k as Daten, "ausser_betrieb") && (text(k as Daten, "hersteller") || text(k as Daten, "modell")));
  const passend = kassen.find((k) => standort && text(k as Daten, "betriebsstaette") === standort) ?? kassen[0];
  if (passend) {
    const k = passend as Daten;
    const tse = text(k, "tse_seriennummer") ? `TSE ${text(k, "tse_seriennummer")}` : "";
    return [[text(k, "hersteller"), text(k, "modell")].filter(Boolean).join(" "), tse].filter(Boolean).join(", ");
  }
  const vd = neueste("verfahrensdokumentation");
  return vd ? [text(vd.daten, "kasse_system"), text(vd.daten, "kasse_tse") ? `TSE ${text(vd.daten, "kasse_tse")}` : ""].filter(Boolean).join(", ") : "";
}

/**
 * Daten zum Anzeigen bzw. Teilen: `daten` (aus den Tagesabschlüssen) plus Quelle, Fassung und Erstellungszeitpunkt.
 * `fest`: das festgeschriebene Kassenbuch zu Monat und Standort. Gleicher Inhalt: dessen Fassung und Zeitpunkt; sonst
 * entsteht beim Teilen die nächste Fassung (jetzt).
 */
export function kassenbuchAnzeige(s: Pick<Stand, "unterlagen">, daten: Daten, fest: Unterlage | undefined, standort = "", jetzt = new Date()): Daten {
  const fassungen = fest?.fassungen?.length ?? 0;
  const gleich = Boolean(fest?.festgeschrieben) && JSON.stringify(fest!.daten) === JSON.stringify(daten);
  const nr = !fest?.festgeschrieben ? 1 : gleich ? fassungen + 1 : fassungen + 2;
  const erstellt = gleich ? fest!.festgeschrieben! : jetzt.toISOString();
  return { ...daten, quelle: "tagesabschluesse", kb_fassung: String(nr), kb_erstellt: zeitDe(erstellt), kb_einzel: kassensystemText(s, standort) };
}
