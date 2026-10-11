/** Minimaler iCalendar-Export (RFC 5545) für Fristen als ganztägige Termine. */

export interface IcsTermin {
  uid: string;
  datum: string; // YYYY-MM-DD
  titel: string;
  beschreibung?: string;
  url?: string;
}

function text(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen über 75 Oktette falten (Fortsetzung mit führendem Leerzeichen), ohne UTF-8-Zeichen zu zerschneiden. */
export function falten(zeile: string): string {
  const teile: string[] = [];
  let aktuell = "";
  let bytes = 0;
  for (const zeichen of zeile) {
    const b = Buffer.byteLength(zeichen);
    const grenze = teile.length === 0 ? 75 : 74; // Folgezeilen haben ein führendes Leerzeichen
    if (bytes + b > grenze) {
      teile.push(aktuell);
      aktuell = "";
      bytes = 0;
    }
    aktuell += zeichen;
    bytes += b;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

export function erzeugeIcs(name: string, termine: IcsTermin[], erzeugt: Date = new Date()): string {
  const stempel = erzeugt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Amtlos//Fristen//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${text(name)}`];
  for (const t of termine) {
    const tag = t.datum.replace(/-/g, "");
    const folgetag = new Date(`${t.datum}T00:00:00Z`);
    folgetag.setUTCDate(folgetag.getUTCDate() + 1);
    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${t.uid}`,
      `DTSTAMP:${stempel}`,
      `DTSTART;VALUE=DATE:${tag}`,
      `DTEND;VALUE=DATE:${folgetag.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${text(t.titel)}`,
      ...(t.beschreibung ? [`DESCRIPTION:${text(t.beschreibung)}`] : []),
      ...(t.url ? [`URL:${t.url}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  zeilen.push("END:VCALENDAR");
  return zeilen.map(falten).join("\r\n") + "\r\n";
}
