import "server-only";
import { redirect } from "next/navigation";
import { apiAntwort } from "./api";

/** Fehlertext aus einer API-Antwort (Nest: message, Amtlos: meldung + fehler[]). */
async function fehlertext(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { meldung?: string; message?: string | string[]; fehler?: { feld: string; meldung: string }[] };
    if (j.fehler?.length) return j.fehler.map((f) => f.meldung).join("; ");
    return j.meldung ?? (Array.isArray(j.message) ? j.message.join("; ") : j.message) ?? `Fehler ${r.status}`;
  } catch {
    return `Fehler ${r.status}`;
  }
}

/**
 * Für Server-Actions: schickt die Anfrage; bei 4xx geht es mit verständlichem Fehlertext zurück auf die Seite.
 * Gibt den JSON-Körper bei Erfolg zurück.
 */
export async function senden<T = unknown>(pfad: string, methode: string, koerper: unknown, zurueck: string): Promise<T> {
  const r = await apiAntwort(pfad, { method: methode, ...(koerper === undefined ? {} : { body: JSON.stringify(koerper) }) });
  if (r.status === 402) redirect("/einstellungen/abo?abgelaufen=1");
  if (r.status >= 400 && r.status < 500) {
    const trenner = zurueck.includes("?") ? "&" : "?";
    redirect(`${zurueck}${trenner}fehler=${encodeURIComponent(await fehlertext(r))}`);
  }
  if (!r.ok) throw new Error(`API ${methode} ${pfad}: ${r.status}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Datei (CSV, PDF) über die Sitzung durchreichen. */
export async function durchreichen(pfad: string): Promise<Response> {
  const r = await apiAntwort(pfad);
  if (!r.ok) return new Response("Nicht verfügbar", { status: r.status === 403 ? 403 : 404 });
  const kopf = new Headers();
  for (const k of ["content-type", "content-disposition"]) {
    const v = r.headers.get(k);
    if (v) kopf.set(k, v);
  }
  kopf.set("cache-control", "private, no-store");
  return new Response(r.body, { status: 200, headers: kopf });
}
