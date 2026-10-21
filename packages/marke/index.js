/**
 * Sichtbare Marke (Produktname, Domain, Kontakt) aus `marke.json` – der einzigen Stelle, an der der Name steht
 * (docs/14-marke.md). Alles, was Nutzer, Store oder Website zeigen, liest von hier: Texte als Template-Strings mit
 * `MARKE.name` bzw. `MARKE.proName`, Textdateien (Store-Texte, Website) mit Platzhaltern über `markeEinsetzen`.
 *
 * Technische Kennungen (Paketnamen @amtlos/*, Bundle-ID, URL-Schema, Speicherschlüssel, Dateiformate, Abo-IDs)
 * bleiben bewusst „amtlos“ – sie stehen nur zur Übersicht unter `technisch`.
 */
import daten from "./marke.json" with { type: "json" };

/** @param {typeof daten} d */
export function markeAus(d) {
  const website = `https://${d.domain}`;
  return Object.freeze({
    name: d.name,
    proName: d.proName,
    domain: d.domain,
    email: d.email,
    website,
    datenschutz: `${website}/datenschutz.html`,
    hilfe: `${website}/hilfe.html`,
    technisch: Object.freeze({ bundleId: d.technisch.bundleId, scheme: d.technisch.scheme, dateiendungSicherung: d.technisch.dateiendungSicherung }),
  });
}

export const MARKE = markeAus(daten);

/** Platzhalter in Textdateien (Store-Texte, Website): {{MARKE}}, {{MARKE_PRO}}, {{DOMAIN}}, {{EMAIL}}, {{WEBSITE}}. */
export const PLATZHALTER = Object.freeze(["{{MARKE}}", "{{MARKE_PRO}}", "{{DOMAIN}}", "{{EMAIL}}", "{{WEBSITE}}"]);

/** Setzt die Marke in einen Text mit Platzhaltern ein (siehe PLATZHALTER). */
export function markeEinsetzen(text, m = MARKE) {
  return text
    .replaceAll("{{MARKE_PRO}}", m.proName)
    .replaceAll("{{MARKE}}", m.name)
    .replaceAll("{{DOMAIN}}", m.domain)
    .replaceAll("{{EMAIL}}", m.email)
    .replaceAll("{{WEBSITE}}", m.website);
}

/** Setzt die Marke in alle Zeichenketten eines JSON-Werts ein (z. B. store/de.json). */
export function markeEinsetzenTief(wert, m = MARKE) {
  if (typeof wert === "string") return markeEinsetzen(wert, m);
  if (Array.isArray(wert)) return wert.map((x) => markeEinsetzenTief(x, m));
  if (wert && typeof wert === "object") return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, markeEinsetzenTief(v, m)]));
  return wert;
}
