/** Zahlen für den Mini-Check der Landingpage (E-132), echt aus dem Katalog: esbuild bündeln, ausführen, nach apps/website/profile.json schreiben. */
import { auswertung, KATEGORIE_TITEL } from "../src/pflichten/check";
const branchen: [string, string][] = [["beauty_kosmetik","Salon oder Kosmetik"],["gastronomie_lebensmittel","Café oder Gastronomie"],["handwerk","Handwerk"],["it_agentur_freelancer","Freelancer oder Agentur"],["onlinehandel","Onlinehandel"]];
const out: Record<string, unknown> = {};
for (const [b] of branchen) for (const team of [0, 3]) {
  const profil = { "taetigkeit.branchen": [b], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": b === "it_agentur_freelancer" ? "freiberuf" : "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": team, "kasse.elektronisch": b === "beauty_kosmetik" || b === "gastronomie_lebensmittel", "online.website": b === "onlinehandel" || b === "it_agentur_freelancer", "ust.kleinunternehmer": false, steuerberater: false, gruendungsdatum: "2026-11-01" };
  const a = auswertung(profil as never, "2026-10-13");
  const kat: Record<string, number> = {};
  for (const p of a.gilt) { const k = KATEGORIE_TITEL[p.kategorie] ?? "Weitere"; kat[k] = (kat[k] ?? 0) + 1; }
  out[`${b}|${team}`] = { gilt: a.gilt.length + a.gruendung.length, unklar: a.unbekannt.length, kategorien: Object.entries(kat).sort((x, y) => y[1] - x[1]), beispiele: [...a.gilt].sort((x, y) => (x.schwere === "hoch" ? -1 : 1) - (y.schwere === "hoch" ? -1 : 1)).slice(0, 4).map((p) => ({ titel: p.titel, grund: (p.rechtsgrundlage[0] ?? "") })) };
}
console.log(JSON.stringify({ branchen, profile: out }));
