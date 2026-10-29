/**
 * „Fristen in den Kalender übernehmen“ (E-238) – reine Funktionen, ohne Gerät testbar.
 *
 * Lokale Mitteilungen plant nur die laufende App (E-207); auf dem iPhone höchstens 60. Eine Kalenderdatei (iCalendar,
 * RFC 5545) trägt die Fristen der nächsten zwölf Monate mit ihren Erinnerungen in den Kalender ein – dort melden sie
 * sich auch, wenn die App monatelang zu bleibt. Die App braucht dafür keinen Kalenderzugriff: Sie erzeugt eine Datei
 * und gibt sie über das Teilen-Menü weiter (keine neue Berechtigung, nichts verlässt das Gerät ohne Zutun).
 *
 * Welche Termine: dieselben wie bei den Erinnerungen (`erinnerungen`) – alle Fristen mit Datum aus „gilt“ (ohne Lohnbüro
 * bzw. Steuerberatung, ohne Fristen vor dem ersten Check, ohne den abgehakten Termin) und die Termine der Einträge, die
 * noch von Angaben abhängen („falls es für dich gilt“). Vergangenes nicht (ein Kalendereintrag von gestern hilft nicht).
 *
 * Form: ganztägige Termine (DTSTART;VALUE=DATE – das Datum, wie die App es zeigt, ohne Umrechnung über UTC), je Termin
 * eine Erinnerung drei Tage vorher um 9 Uhr (TRIGGER -P2DT15H vor Tagesbeginn) und – wie in der App, nicht bei „falls es
 * für dich gilt“ – am Tag selbst um 9 Uhr (TRIGGER PT9H). Feste UID je Pflicht und Termin: Kalender, die das können,
 * aktualisieren beim erneuten Übernehmen die Einträge, statt sie doppelt anzulegen. CRLF, Zeilen über 75 Byte gefaltet,
 * Text maskiert; DTSTAMP in UTC.
 */
import { plusMonate, plusTage } from "@amtlos/fristen";
import { MARKE } from "@amtlos/marke";
import { istErledigt, type Auswertung, type Erledigt } from "./check";
import { VORLAUF_TAGE } from "./erinnerungsplan";

/** So weit reicht die Datei – wie die Termine der Auswertung und der Plan der Erinnerungen. */
export const KALENDER_MONATE = 12;
/** Uhrzeit der Erinnerungen im Kalender (wie die Mitteilungen der App) */
export const KALENDER_STUNDE = 9;

export interface KalenderTermin {
  uid: string;
  pflichtId: string;
  titel: string;
  /** ISO-Datum der Frist */
  datum: string;
  /** E-207: hängt noch von Angaben ab */
  vielleicht: boolean;
  /** E-200: letzter Tag zum Übermitteln */
  uebermitteln: boolean;
}

/** Feste Kennung je Pflicht und Termin – gleich bei jedem Export, damit der Kalender aktualisieren kann. */
export const kalenderUid = (pflichtId: string, datum: string) => `${pflichtId.replace(/[^A-Za-z0-9._-]/g, "-")}-${datum.replace(/-/g, "")}@${MARKE.domain}`;

/** Termine für die Kalenderdatei: ab heute (einschließlich) bis zwölf Monate danach, nach Datum. */
export function kalenderTermine(a: Auswertung, e: Erledigt, heute: string, monate = KALENDER_MONATE): KalenderTermin[] {
  const bis = plusMonate(heute, monate);
  const ee = { ...e, heute: e.heute ?? heute };
  const aus = new Map<string, KalenderTermin>();
  const neu = (p: { id: string; titel: string; uebermittelnVortag?: boolean }, datum: string, vielleicht: boolean) => {
    if (datum < heute || datum > bis) return;
    const uid = kalenderUid(p.id, datum);
    if (!aus.has(uid)) aus.set(uid, { uid, pflichtId: p.id, titel: p.titel, datum, vielleicht, uebermitteln: Boolean(p.uebermittelnVortag) });
  };
  for (const p of a.gilt) {
    if (!p.naechsterTermin || p.lohnbuero || p.vorCheck) continue;
    const erledigt = istErledigt(p, ee);
    for (const t of p.termine) if (!(erledigt && t === p.naechsterTermin)) neu(p, t, false);
  }
  const gilt = new Set(a.gilt.map((p) => p.id));
  for (const p of a.unbekannt) if (!gilt.has(p.id) && !p.lohnbuero) for (const t of p.termine) neu(p, t, true);
  return [...aus.values()].sort((x, y) => x.datum.localeCompare(y.datum) || x.titel.localeCompare(y.titel, "de"));
}

/** Text maskieren (RFC 5545 3.3.11): Backslash, Semikolon, Komma, Zeilenumbruch. */
export const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Zeile falten (RFC 5545 3.1): höchstens 75 Byte je Zeile, Fortsetzung mit einem Leerzeichen, nie mitten im UTF-8-Zeichen. */
export function icsFalten(zeile: string): string {
  const teile: string[] = [];
  let aktuell = "";
  let bytes = 0;
  for (const z of zeile) {
    const n = new TextEncoder().encode(z).length;
    const grenze = teile.length ? 74 : 75; // Fortsetzungszeilen beginnen mit einem Leerzeichen
    if (bytes + n > grenze) {
      teile.push(aktuell);
      aktuell = "";
      bytes = 0;
    }
    aktuell += z;
    bytes += n;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

const datumIcs = (iso: string) => iso.replace(/-/g, "");
/** Zeitpunkt in UTC (DTSTAMP): 20261029T081500Z */
export const utcIcs = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const datumDe = (iso: string) => iso.split("-").reverse().join(".");

/** Erinnerung vor Tagesbeginn eines ganztägigen Termins: N Tage vorher um `stunde` Uhr → „-P(N-1)DT(24-stunde)H“. */
export const vorherTrigger = (tage: number, stunde: number) => (tage <= 0 ? `PT${stunde}H` : `-P${tage - 1 > 0 ? `${tage - 1}D` : ""}T${24 - stunde}H`);

/** Die Kalenderdatei (iCalendar) mit allen Terminen; `jetzt` für DTSTAMP. */
export function fristenIcs(termine: readonly KalenderTermin[], heute: string, jetzt: Date): string {
  const stamp = utcIcs(jetzt);
  const z: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${MARKE.name}//Fristen//DE`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(`Fristen – ${MARKE.name}`)}`];
  for (const t of termine) {
    const titel = t.vielleicht ? `${t.titel} (falls es für dich gilt)` : t.titel;
    const text = [
      t.uebermitteln ? `Spätestens am ${datumDe(t.datum)} übermitteln.` : `Fällig am ${datumDe(t.datum)}.`,
      t.vielleicht ? `Hängt noch von deinen Angaben ab – kläre es in ${MARKE.name}.` : null,
      `Aus ${MARKE.name}, Stand ${datumDe(heute)}. Ändert sich etwas, übernimm die Fristen erneut.`,
    ]
      .filter(Boolean)
      .join("\n");
    z.push("BEGIN:VEVENT", `UID:${t.uid}`, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, `DTSTART;VALUE=DATE:${datumIcs(t.datum)}`, `DTEND;VALUE=DATE:${datumIcs(plusTage(t.datum, 1))}`, `SUMMARY:${icsText(titel)}`, `DESCRIPTION:${icsText(text)}`, "TRANSP:TRANSPARENT");
    z.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${vorherTrigger(VORLAUF_TAGE, KALENDER_STUNDE)}`, `DESCRIPTION:${icsText(`${titel} – fällig am ${datumDe(t.datum)}`)}`, "END:VALARM");
    if (!t.vielleicht) z.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${vorherTrigger(0, KALENDER_STUNDE)}`, `DESCRIPTION:${icsText(`${titel} – heute fällig`)}`, "END:VALARM");
    z.push("END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.map(icsFalten).join("\r\n") + "\r\n";
}

/** Dateiname für das Teilen-Menü */
export const kalenderDateiname = (heute: string) => `Fristen-${MARKE.name}-${heute}.ics`;
