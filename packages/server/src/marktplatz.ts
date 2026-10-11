/**
 * Experten-Marktplatz (Spezifikation 6.12): Partner werden im Studio gepflegt; Nutzer senden eine Anfrage und teilen
 * nur die Daten, denen sie ausdrücklich zugestimmt haben. Amtlos vermittelt den Kontakt per E-Mail – keine Zahlung,
 * keine Provision, bis das Vergütungsmodell berufsrechtlich geklärt ist (J-4, E-102).
 */
import type { Datenbank } from "./datenbank.js";
import type { Versand } from "./erinnerungen.js";
import type { MarktplatzJob } from "./warteschlange.js";

export const QUALIFIKATIONEN = ["steuerberater", "rechtsanwalt", "fachkraft_arbeitssicherheit", "datenschutzbeauftragter"] as const;

export interface GeteilteDaten {
  kontakt: { name: string; email: string };
  unternehmen?: { name: string; rechtsform?: unknown; branchen?: unknown; beschaeftigte?: unknown; bundesland?: unknown };
  offene_pflichten?: string[];
}

/** E-Mail an den Partner: Nachricht, gewähltes Paket und genau die freigegebenen Daten. */
export function anfrageText(a: { nachricht: string; paket: string | null; daten: GeteilteDaten; partner: string }) {
  const zeilen = [
    `Guten Tag ${a.partner},`,
    "",
    "über Amtlos hat Sie eine Anfrage erreicht.",
    a.paket ? `Gewünschtes Paket: ${a.paket}` : "",
    "",
    "Nachricht:",
    a.nachricht,
    "",
    `Kontakt: ${a.daten.kontakt.name} <${a.daten.kontakt.email}>`,
  ];
  if (a.daten.unternehmen) {
    const u = a.daten.unternehmen;
    zeilen.push("", "Freigegebene Angaben zum Unternehmen:", `Name: ${u.name}`);
    if (u.rechtsform) zeilen.push(`Rechtsform: ${String(u.rechtsform)}`);
    if (Array.isArray(u.branchen) && u.branchen.length) zeilen.push(`Branchen: ${u.branchen.join(", ")}`);
    if (u.beschaeftigte !== undefined && u.beschaeftigte !== null) zeilen.push(`Beschäftigte: ${String(u.beschaeftigte)}`);
    if (u.bundesland) zeilen.push(`Bundesland: ${String(u.bundesland)}`);
  }
  if (a.daten.offene_pflichten?.length) zeilen.push("", "Offene Pflichten laut Amtlos:", ...a.daten.offene_pflichten.map((p) => `– ${p}`));
  zeilen.push("", "Bitte antworten Sie direkt an die Kontaktadresse. Amtlos ist an der Beauftragung und Vergütung nicht beteiligt.");
  return { betreff: "Anfrage über Amtlos", text: zeilen.filter((z, i, l) => !(z === "" && l[i - 1] === "")).join("\n") };
}

/** Worker: Anfrage per E-Mail an den Partner senden (einmal; bereits versendete werden übersprungen). */
export async function versendeMarktplatzAnfrage(db: Datenbank, versand: Versand, job: MarktplatzJob): Promise<"gesendet" | "uebersprungen"> {
  return db.imKontext({ unternehmenId: job.unternehmenId }, async (tx) => {
    const a = await tx.eine<{ nachricht: string; paket: string | null; geteilte_daten: GeteilteDaten; versendet_am: Date | null; email: string; name: string; aktiv: boolean }>(
      `select a.nachricht, a.paket, a.geteilte_daten, a.versendet_am, p.email, p.name, p.aktiv
         from app.marktplatz_anfrage a join katalog.partner p on p.id = a.partner_id where a.id = $1 for update of a`,
      [job.anfrageId],
    );
    if (!a || a.versendet_am || !a.aktiv) return "uebersprungen";
    const { betreff, text } = anfrageText({ nachricht: a.nachricht, paket: a.paket, daten: a.geteilte_daten, partner: a.name });
    await versand.email({ an: a.email, betreff, text });
    await tx.abfrage("update app.marktplatz_anfrage set versendet_am = now() where id = $1", [job.anfrageId]);
    return "gesendet";
  });
}
