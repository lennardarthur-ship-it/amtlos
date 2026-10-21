import { MARKE } from "@amtlos/marke";
/**
 * Fehlerbericht für „Fehlerbericht teilen“ auf der Fehlerseite (Fehlergrenze). Rein, damit er sich testen lässt.
 * Enthält nur Technisches – Fehlername, Meldung, Stack, Komponenten-Stack, App-Version, Plattform –, nie den Stand mit
 * Betrieb, Unterlagen, Kunden oder Belegen. Kein Crash-SDK: geteilt wird nur, was die Nutzerin selbst im Teilen-Menü
 * abschickt.
 */
const MAX_ZEILEN = 25;
const MAX_MELDUNG = 500;

const kuerzen = (text: string, zeilen = MAX_ZEILEN) => {
  const l = text.split("\n").map((z) => z.trimEnd()).filter((z) => z.trim().length > 0);
  return l.length > zeilen ? [...l.slice(0, zeilen), `… (${l.length - zeilen} weitere Zeilen)`].join("\n") : l.join("\n");
};

export function fehlerbericht(fehler: unknown, komponenten: string | null | undefined, umgebung: { version: string; plattform: string; zeit: Date }): string {
  const e = fehler instanceof Error ? fehler : new Error(String(fehler));
  const meldung = e.message.length > MAX_MELDUNG ? `${e.message.slice(0, MAX_MELDUNG)} …` : e.message;
  return [
    `${MARKE.name} ${umgebung.version} · ${umgebung.plattform} · ${umgebung.zeit.toISOString()}`,
    `${e.name}: ${meldung}`,
    e.stack ? `\nStack:\n${kuerzen(e.stack)}` : "",
    komponenten ? `\nKomponenten:\n${kuerzen(komponenten)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
