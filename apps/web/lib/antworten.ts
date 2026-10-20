import { datumLang, fragenJePhase, fuelle, type Frage, type Schritt, type Sprache, type Texte } from "@amtlos/i18n";

/** Eine gespeicherte Antwort lesbar machen (Auswahl als Text, Ja/Nein, Datum, Zahl); null = nicht beantwortet. */
export function antwortText(f: Frage, wert: unknown, s: Sprache, x: Texte): string | null {
  if (wert === undefined || wert === null || wert === "") return null;
  switch (f.art) {
    case "janein":
      return wert === true ? x.gemeinsam.ja : wert === false ? x.gemeinsam.nein : null;
    case "auswahl":
      return f.optionen?.[String(wert)]?.[s] ?? String(wert);
    case "mehrfach":
      return Array.isArray(wert) && wert.length ? wert.map((w) => f.optionen?.[String(w)]?.[s] ?? String(w)).join(", ") : null;
    case "datum":
      return typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert) ? datumLang(wert, s) : String(wert);
    case "zahl":
    case "betrag":
      return typeof wert === "number" ? new Intl.NumberFormat(s === "en" ? "en-GB" : "de-DE").format(wert) + (f.art === "betrag" ? " €" : "") : String(wert);
    default:
      return String(wert);
  }
}

/**
 * Kurzfassung der Antworten eines Schritts für die Einstellungen (UX 6): die ersten Antworten und wie viele offen sind,
 * z. B. „Einzelunternehmen · 1. Apr. 2019 · noch 2 offen“.
 */
export function antwortZusammenfassung(schritt: Schritt, daten: Record<string, unknown>, s: Sprache, x: Texte, hoechstens = 3): string {
  const fragen = fragenJePhase(schritt, "alle", daten);
  const antworten = fragen.map((f) => antwortText(f, daten[f.feld], s, x)).filter((a): a is string => a !== null);
  const offen = fragen.length - antworten.length;
  if (!antworten.length) return x.einstellungen.keine_angaben;
  const teile = antworten.slice(0, hoechstens).map((a) => (a.length > 40 ? `${a.slice(0, 39)}…` : a));
  if (antworten.length > hoechstens) teile.push("…");
  if (offen > 0) teile.push(fuelle(x.einstellungen.offen, { n: offen }));
  return teile.join(" · ");
}
