import "server-only";
import { aktuelleSprache } from "./sprache";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { konfig } from "./konfig";
import { gewaehltesUnternehmen, sitzung } from "./sitzung";

export class EingabeFehler extends Error {
  constructor(readonly fehler: { feld: string; meldung: string }[]) {
    super(fehler.map((f) => `${f.feld}: ${f.meldung}`).join("; "));
  }
}

export interface Ich {
  konto: { id: string; email: string; anzeigename: string; sprache: "de" | "en" };
  unternehmen: { id: string; name: string; rolle: "inhaber" | "mitarbeiter" | "steuerberater" | "admin" }[];
}

async function roh(pfad: string, init: RequestInit & { unternehmen?: string | false } = {}): Promise<Response> {
  const s = await sitzung();
  if (!s) redirect("/anmelden");
  const kopf = new Headers(init.headers);
  kopf.set("Authorization", `Bearer ${s.token}`);
  if (typeof init.body === "string") kopf.set("Content-Type", "application/json"); // FormData setzt den Typ selbst (multipart)
  if (init.unternehmen) kopf.set("X-Unternehmen-Id", init.unternehmen);
  kopf.set("X-Sprache", await aktuelleSprache()); // Katalogtexte und Meldungen in der Sprache der Oberfläche
  const r = await fetch(`${konfig().apiUrl}${pfad}`, { ...init, headers: kopf, cache: "no-store" });
  if (r.status === 401) redirect("/anmelden?abgelaufen=1");
  return r;
}

/** Konto und Unternehmen – einmal je Anfrage. */
export const ich = cache(async (): Promise<Ich> => {
  const r = await roh("/v1/ich");
  if (!r.ok) throw new Error(`API /v1/ich: ${r.status}`);
  return r.json() as Promise<Ich>;
});

/** Aktives Unternehmen: Cookie-Wahl, falls Mitglied; sonst das erste. Ohne Unternehmen → Anlage. */
export const aktivesUnternehmen = cache(async () => {
  const i = await ich();
  if (!i.unternehmen.length) redirect("/unternehmen/neu");
  const gewaehlt = await gewaehltesUnternehmen();
  return i.unternehmen.find((u) => u.id === gewaehlt) ?? i.unternehmen[0]!;
});

/** API-Aufruf im Kontext des aktiven Unternehmens. 404 → notFound(), 422 → EingabeFehler. */
export async function api<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  const u = await aktivesUnternehmen();
  const r = await roh(pfad, { ...init, unternehmen: u.id });
  if (r.status === 404) notFound();
  if (r.status === 402) redirect("/einstellungen/abo?abgelaufen=1"); // Testphase vorbei: zum Abo (E-113)
  if (r.status === 422) throw new EingabeFehler(((await r.json()) as { fehler?: { feld: string; meldung: string }[] }).fehler ?? []);
  if (!r.ok) throw new Error(`API ${init.method ?? "GET"} ${pfad}: ${r.status}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Ohne Unternehmenskontext (z. B. Unternehmen anlegen). */
export async function apiOhneUnternehmen<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  const r = await roh(pfad, { ...init, unternehmen: false });
  if (r.status === 422) throw new EingabeFehler(((await r.json()) as { fehler?: { feld: string; meldung: string }[] }).fehler ?? []);
  if (!r.ok) throw new Error(`API ${init.method ?? "GET"} ${pfad}: ${r.status}`);
  return r.json() as Promise<T>;
}

/** Rohe Antwort (für Seiten, die Statuscodes wie 403/409 selbst erklären). */
export async function apiAntwort(pfad: string, init: RequestInit & { ohneUnternehmen?: boolean } = {}): Promise<Response> {
  const { ohneUnternehmen, ...rest } = init;
  const unternehmen = ohneUnternehmen ? false : (await aktivesUnternehmen()).id;
  return roh(pfad, { ...rest, unternehmen });
}
