/**
 * Demo-Modus (E-119): Die App läuft ohne Server mit einem Schnappschuss echter API-Antworten (werkzeuge/demo-schnappschuss.mjs).
 * Inhalte kommen unverändert aus dem Katalog; Fristen werden auf das heutige Datum verschoben, damit „überfällig“ und
 * „bald fällig“ stimmen. Erledigen, Stempeln und Angaben wirken nur im Speicher und sind nach einem Neustart weg.
 * Ohne React-Native-Abhängigkeiten, damit testbar.
 */
import type { Abruf, Heute, Karte, KartenDetail, Sprache } from "../kern/api";

export const DEMO_TOKEN = "demo";
export const DEMO_UNTERNEHMEN = "demo-unternehmen";

export interface DemoDaten {
  stand: string;
  sprachen: Record<Sprache, { heute: Heute; pflichten: Karte[]; details: Record<string, KartenDetail> }>;
  profil: { version: number; daten: Record<string, unknown> };
  beschaeftigte: { id: string; vorname: string; nachname: string; austritt: string | null }[];
  abo: Record<string, unknown>;
}

const TAG = 86_400_000;
const isoTag = (d: Date) => d.toISOString().slice(0, 10);
function verschieben(wert: string | null | undefined, tage: number): string | null {
  if (!wert) return wert ?? null;
  const d = new Date(wert.length === 10 ? `${wert}T12:00:00Z` : wert);
  const neu = new Date(d.getTime() + tage * TAG).toISOString();
  return wert.length === 10 ? neu.slice(0, 10) : neu;
}

/** Status aus dem verschobenen Datum, wie die API ihn bildet: überfällig vor heute, bald fällig in 14 Tagen. */
function statusNeu(k: Karte, heute: string, bald: string): string {
  if (k.status === "erledigt" || k.status === "angabe_fehlt" || !k.faellig_am) return k.status;
  if (k.faellig_am < heute) return "ueberfaellig";
  if (k.faellig_am <= bald) return "faellig_bald";
  return "offen";
}

const RANG: Record<string, number> = { ueberfaellig: 0, faellig_bald: 1, offen: 2 };

export function demoAbruf(daten: DemoDaten, jetzt: () => Date = () => new Date()): Abruf {
  const heute = isoTag(jetzt());
  const tage = Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${daten.stand}T12:00:00Z`)) / TAG);
  const bald = isoTag(new Date(Date.parse(`${heute}T12:00:00Z`) + 14 * TAG));
  const in90 = isoTag(new Date(Date.parse(`${heute}T12:00:00Z`) + 90 * TAG));

  // Zustand je Pflicht (sprachübergreifend): Status und Erledigt-Zeitpunkt
  const ausgangsStatus = new Map<string, string>();
  const zustand = new Map<string, { status: string; erledigt_am: string | null }>();
  for (const k of daten.sprachen.de.pflichten) {
    const schluessel = `${k.pflicht_id}|${k.periode}`;
    const verschoben = { ...k, faellig_am: verschieben(k.faellig_am, tage) };
    const status = statusNeu(verschoben, heute, bald);
    ausgangsStatus.set(schluessel, status);
    zustand.set(schluessel, { status, erledigt_am: verschieben(daten.sprachen.de.details[schluessel]?.erledigt_am, tage) });
  }
  let profil = { ...daten.profil, daten: { ...daten.profil.daten } };
  const laufend = new Map<string, string>();

  const karte = (k: Karte): Karte => ({ ...k, faellig_am: verschieben(k.faellig_am, tage), status: zustand.get(`${k.pflicht_id}|${k.periode}`)?.status ?? k.status });
  const liste = (s: Sprache) => daten.sprachen[s].pflichten.map(karte);

  function heuteAntwort(s: Sprache): Heute {
    const alle = liste(s);
    const offen = alle.filter((k) => k.status !== "erledigt");
    const klar = offen.filter((k) => k.status !== "angabe_fehlt");
    const als_naechstes = klar
      .filter((k) => k.faellig_am)
      .sort((a, b) => (RANG[a.status] ?? 3) - (RANG[b.status] ?? 3) || a.faellig_am!.localeCompare(b.faellig_am!))
      .slice(0, 3);
    return {
      ...daten.sprachen[s].heute,
      als_naechstes,
      zaehler: {
        offen: offen.length,
        ueberfaellig: klar.filter((k) => k.status === "ueberfaellig").length,
        angabe_fehlt: offen.length - klar.length,
        erledigt: alle.length - offen.length,
        klar: klar.length,
        naechste_90: klar.filter((k) => k.faellig_am && k.faellig_am <= in90).length,
      },
    };
  }

  const antwort = (status: number, wert?: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => wert ?? {} });

  return async (url, init) => {
    const u = new URL(url, "http://demo");
    const pfad = u.pathname;
    const m = init.method;
    const s: Sprache = init.headers["X-Sprache"] === "en" ? "en" : "de";
    const koerper = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const name = s === "en" ? "Demo company" : "Demo-Betrieb";

    if (pfad === "/v1/ich" && m === "GET")
      return antwort(200, { konto: { id: "demo", email: "demo@amtlos.de", anzeigename: "Demo", sprache: s }, unternehmen: [{ id: DEMO_UNTERNEHMEN, name, rolle: "inhaber" }] });
    if (pfad === "/v1/ich/sprache") return antwort(204);
    if (pfad === "/v1/heute") return antwort(200, heuteAntwort(s));
    if (pfad === "/v1/pflichten" && m === "GET") {
      const filter = u.searchParams.get("status") ?? "alle";
      return antwort(200, liste(s).filter((k) => filter === "alle" || k.status === filter));
    }
    const p = /^\/v1\/pflichten\/([^/]+)\/([^/]+)(?:\/(erledigen|wieder-oeffnen))?$/.exec(pfad);
    if (p) {
      const schluessel = `${decodeURIComponent(p[1]!)}|${decodeURIComponent(p[2]!)}`;
      const d = daten.sprachen[s].details[schluessel];
      const z = zustand.get(schluessel);
      if (!d || !z) return antwort(404, { meldung: "Nicht gefunden" });
      if (p[3] === "erledigen") zustand.set(schluessel, { status: "erledigt", erledigt_am: jetzt().toISOString() });
      if (p[3] === "wieder-oeffnen") {
        const vorher = ausgangsStatus.get(schluessel) ?? "offen";
        zustand.set(schluessel, { status: vorher === "erledigt" ? statusNeu({ ...karte(d), status: "offen" }, heute, bald) : vorher, erledigt_am: null });
      }
      if (p[3]) return antwort(200, {});
      const neu = zustand.get(schluessel)!;
      return antwort(200, { ...d, faellig_am: verschieben(d.faellig_am, tage), status: neu.status, erledigt_am: neu.erledigt_am });
    }
    if (pfad === "/v1/profil" && m === "GET") return antwort(200, profil);
    if (pfad === "/v1/profil" && m === "PUT") {
      profil = { version: profil.version + 1, daten: { ...profil.daten, ...((koerper.daten as Record<string, unknown>) ?? {}) } };
      return antwort(200, profil);
    }
    if (pfad === "/v1/abo") return antwort(200, { ...daten.abo, test_bis: verschieben(daten.abo.test_bis as string, tage) });
    if (pfad === "/v1/beschaeftigte") return antwort(200, daten.beschaeftigte);
    if (pfad === "/v1/zeiten") return antwort(200, { laufend: [...laufend].map(([beschaeftigter_id, beginn]) => ({ beschaeftigter_id, beginn })) });
    if (pfad === "/v1/zeiten/kommen" || pfad === "/v1/zeiten/gehen") {
      const id = String(koerper.beschaeftigter_id);
      const zeit = String(koerper.zeitpunkt ?? jetzt().toISOString());
      if (pfad.endsWith("kommen")) laufend.set(id, zeit);
      else laufend.delete(id);
      return antwort(200, { id: String(koerper.client_id), beschaeftigter_id: id, beginn: zeit, ende: null });
    }
    if (pfad === "/v1/belege" || pfad === "/v1/geraete") return antwort(200, { id: `demo-${Date.now()}` });
    if (pfad.startsWith("/v1/geraete/")) return antwort(204);
    return antwort(404, { meldung: s === "en" ? "Not available in the demo" : "In der Demo nicht verfügbar" });
  };
}
