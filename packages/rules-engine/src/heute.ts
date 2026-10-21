import { differenzTage, type Datum } from "@amtlos/fristen";

/* „Heute“-Übersicht: rein, vom API-Server und vom Demo-Modus der App genutzt (E-112, E-119). */

export type Bereich = "steuern" | "personal" | "arbeitsschutz" | "datenschutz" | "online" | "gesellschaft";

/** Ampel-Bereiche aus Spezifikation 6.1; Gründung zählt zu „Gesellschaft“, Branchenpflichten nach ihrer Kategorie. */
export const BEREICH_JE_KATEGORIE: Record<string, Bereich> = {
  steuern: "steuern",
  personal: "personal",
  arbeitsschutz: "arbeitsschutz",
  datenschutz: "datenschutz",
  it_sicherheit: "datenschutz",
  ki: "datenschutz",
  online: "online",
  produkte: "online",
  gruendung: "gesellschaft",
  gesellschaft: "gesellschaft",
  branche: "gesellschaft",
  // R12: Umwelt und Abfall – Kontrollen der Behörden vor Ort wie beim Arbeitsschutz
  umwelt: "arbeitsschutz",
};

export interface Aufgabe {
  pflicht_id: string;
  periode: string;
  kategorie: string;
  anzeige_status: string; // offen | faellig_bald | ueberfaellig | angabe_fehlt | erledigt | nicht_zutreffend | entfallen
  faellig_am: Datum | null;
  schwere: "niedrig" | "mittel" | "hoch";
  /** Katalog `dringend_ohne_termin`: gewichtet wie Schwere „hoch“, auch wenn die angezeigte Schwere niedriger ist */
  dringend_ohne_termin?: boolean;
}

export type Ampel = "gruen" | "gelb" | "rot";

const GEWICHT = { hoch: 1, mittel: 1.5, niedrig: 2 } as const;

/**
 * Dringlichkeit: kleiner = dringender. Überfällige zuerst (je länger überfällig, desto dringender),
 * danach Tage bis Fälligkeit gewichtet mit der Sanktionsschwere. „Angabe fehlt“ kommt nach allen Fristen
 * innerhalb eines Jahres: Auf „Heute“ werden fehlende Angaben gebündelt als Nachfragen gestellt (E-111),
 * nicht als einzelne Aufgaben; Aufgaben ohne Datum zuletzt.
 */
export function dringlichkeit(a: Aufgabe, heute: Datum): number {
  const gewicht = a.dringend_ohne_termin ? GEWICHT.hoch : GEWICHT[a.schwere];
  if (a.anzeige_status === "ueberfaellig" && a.faellig_am) return -1_000_000 + differenzTage(heute, a.faellig_am);
  if (a.anzeige_status === "angabe_fehlt") return 400 * gewicht;
  if (!a.faellig_am) return 10_000 * gewicht;
  return Math.max(0, differenzTage(heute, a.faellig_am)) * gewicht;
}

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig", "angabe_fehlt"]);

export function heuteUebersicht(aufgaben: Aufgabe[], heute: Datum, max = 3) {
  const offen = aufgaben.filter((a) => OFFEN.has(a.anzeige_status));
  const ampel = {} as Record<Bereich, Ampel>;
  for (const b of new Set(Object.values(BEREICH_JE_KATEGORIE))) ampel[b] = "gruen";
  for (const a of offen) {
    const b = BEREICH_JE_KATEGORIE[a.kategorie] ?? "gesellschaft";
    if (a.anzeige_status === "ueberfaellig") ampel[b] = "rot";
    // Gelb auch für offene Pflichten ohne Termin: sie gelten, sind aber nicht erledigt
    else if ((a.anzeige_status === "faellig_bald" || a.anzeige_status === "angabe_fehlt" || (a.anzeige_status === "offen" && !a.faellig_am)) && ampel[b] !== "rot") ampel[b] = "gelb";
  }
  const als_naechstes = [...offen]
    .sort((x, y) => dringlichkeit(x, heute) - dringlichkeit(y, heute) || x.pflicht_id.localeCompare(y.pflicht_id) || x.periode.localeCompare(y.periode))
    .slice(0, max);
  return {
    ampel,
    als_naechstes,
    zaehler: {
      offen: offen.length,
      ueberfaellig: offen.filter((a) => a.anzeige_status === "ueberfaellig").length,
      angabe_fehlt: offen.filter((a) => a.anzeige_status === "angabe_fehlt").length,
      erledigt: aufgaben.filter((a) => a.anzeige_status === "erledigt").length,
      /** sicher geltende, offene Pflichten (ohne „Angabe fehlt“) */
      klar: offen.filter((a) => a.anzeige_status !== "angabe_fehlt").length,
      /** davon mit Frist in den nächsten 90 Tagen oder überfällig */
      naechste_90: offen.filter((a) => a.anzeige_status !== "angabe_fehlt" && a.faellig_am && differenzTage(heute, a.faellig_am) <= 90).length,
    },
  };
}
