/** Demo-Server: Behörden-Postfach und weitere Termine (wie apps/api/src/postfach.controller.ts). Das Foto bleibt im Gerät. */
import { fehler, nichtGefunden, ok, type Kontext, type Modul } from "./kontext";

const ARTEN = ["bescheid", "mahnung", "anhoerung", "auskunftsersuchen", "sonstiges"];
const FRISTARTEN = ["einspruch", "zahlung", "antwort", "sonstige"];
interface Brief {
  id: string; eingang_am: string; absender: string; art: string; aktenzeichen: string; frist_am: string | null; frist_art: string | null; betrag_cent: number | null;
  pflicht_id: string | null; notiz: string | null; erledigt_am: string | null; datei_titel: string; mime: string; erstellt_am: string;
}
const datum = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
const tageBis = (k: Kontext, frist: string | null) => (frist ? Math.round((Date.parse(`${frist}T00:00:00Z`) - Date.parse(`${k.heute()}T00:00:00Z`)) / 86_400_000) : null);

/** weitereTermine(): Fristen aus Behördenbriefen (Geräteprüfungen gehören zum ausgeblendeten Arbeitsschutz). */
export function weitereTermine(k: Kontext, s: "de" | "en") {
  return k
    .tabelle<Brief>("briefe")
    .filter((b) => !b.erledigt_am && b.frist_am)
    .map((b) => {
      const titel = [b.absender, b.aktenzeichen].filter(Boolean).join(" · ") || b.art;
      return { id: b.id, art: "brief" as const, datum: b.frist_am!, titel: s === "en" ? `Deadline (letter): ${titel}` : `Frist aus Behördenbrief: ${titel}`, link: `/postfach/${b.id}` };
    })
    .sort((x, y) => x.datum.localeCompare(y.datum));
}

export const postfach: Modul = (a, k) => {
  const { teile: t, methode: m, s } = a;
  if (t[0] !== "v1") return undefined;
  if (t[1] === "termine" && m === "GET") return ok(weitereTermine(k, s));
  if (t[1] !== "briefe") return undefined;
  const briefe = k.tabelle<Brief>("briefe");
  if (t.length === 2 && m === "GET")
    return ok(
      [...briefe]
        .sort((x, y) => Number(Boolean(x.erledigt_am)) - Number(Boolean(y.erledigt_am)) || (x.frist_am ?? "9999").localeCompare(y.frist_am ?? "9999") || y.eingang_am.localeCompare(x.eingang_am))
        .map((b) => ({ ...b, tage_bis_frist: tageBis(k, b.frist_am) })),
    );
  if (t.length === 2 && m === "POST") {
    const b: Brief = { id: k.id("brief"), eingang_am: k.heute(), absender: "", art: "sonstiges", aktenzeichen: "", frist_am: null, frist_art: null, betrag_cent: null, pflicht_id: null, notiz: null, erledigt_am: null, datei_titel: s === "en" ? "Photo" : "Foto", mime: "image/jpeg", erstellt_am: k.zeit() };
    briefe.push(b);
    return ok(b);
  }
  const b = briefe.find((x) => x.id === t[2]);
  if (!b) return fehler(404, "Brief nicht gefunden", "Letter not found", s);
  if (t.length === 3 && m === "GET") return ok(b);
  if (t.length === 3 && m === "PUT") {
    const d = a.koerper;
    const eingang = datum(d.eingang_am);
    const frist = datum(d.frist_am);
    if (!eingang) return fehler(422, "Bitte das Eingangsdatum angeben.", "Please enter the date received.", s);
    if (frist && !FRISTARTEN.includes(String(d.frist_art))) return { status: 422, wert: { meldung: s === "en" ? "Which deadline? (e.g. objection or payment)" : "Welche Frist? (z. B. Einspruch oder Zahlung)", fehler: [{ feld: "frist_art", meldung: "Welche Frist?" }] } };
    if (d.pflicht_id && !k.pflichtNachId.has(String(d.pflicht_id))) return fehler(422, "Unbekannte Pflicht", "Unknown obligation", s);
    Object.assign(b, {
      eingang_am: eingang, absender: String(d.absender ?? "").trim().slice(0, 200), art: ARTEN.includes(String(d.art)) ? String(d.art) : "sonstiges", aktenzeichen: String(d.aktenzeichen ?? "").trim().slice(0, 100),
      frist_am: frist, frist_art: frist ? String(d.frist_art) : null, betrag_cent: typeof d.betrag_cent === "number" && Number.isInteger(d.betrag_cent) && d.betrag_cent >= 0 ? d.betrag_cent : null,
      pflicht_id: d.pflicht_id ? String(d.pflicht_id) : null, notiz: typeof d.notiz === "string" && d.notiz.trim() ? d.notiz.trim().slice(0, 2000) : null,
    });
    return ok(b);
  }
  if (t[3] === "erledigt" && m === "POST") {
    b.erledigt_am = a.koerper.datum === null ? null : (datum(a.koerper.datum) ?? k.heute());
    return ok(b);
  }
  return nichtGefunden(s);
};
