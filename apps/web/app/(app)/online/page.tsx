import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Online-Check" };

type Status = "ok" | "fehlt" | "hinweis" | "nicht_geprueft";
interface Befund { id: string; status: Status; schwere: "hoch" | "mittel" | "niedrig"; werte?: Record<string, string | number>; pflicht_id?: string }
interface Check { id: string; url: string; status: "ok" | "fehler"; fehler: string | null; erstellt_am: string; befunde: Befund[]; seiten?: string[] }
const SEITE = "/online";
const FARBE: Record<Status, string> = { ok: "text-amt", fehlt: "text-frist", hinweis: "text-bald", nicht_geprueft: "text-tinte-leise" };
const ZEICHEN: Record<Status, string> = { ok: "✓", fehlt: "✗", hinweis: "!", nicht_geprueft: "–" };

async function pruefen(f: FormData) {
  "use server";
  const r = await senden<{ id: string }>("/v1/onlinecheck", "POST", { url: String(f.get("url") ?? "") }, SEITE);
  revalidatePath(SEITE);
  redirect(`${SEITE}?check=${r.id}`);
}

export default async function OnlineSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; check?: string }> }) {
  const [{ s, t: x }, liste, sp, u] = await Promise.all([t(), api<Check[]>("/v1/onlinecheck"), searchParams, aktivesUnternehmen()]);
  const id = sp.check && /^[0-9a-f-]{36}$/.test(sp.check) ? sp.check : liste[0]?.id;
  const aktuell = id ? await api<Check>(`/v1/onlinecheck/${id}`) : null;
  const zeit = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const befundText = (b: Befund) => {
    const t = (x.oc.befunde as Record<string, Record<string, string>>)[b.id];
    if (!t) return { titel: b.id, text: "", tun: "" };
    const roh = t[b.status] ?? "";
    return { titel: t.titel ?? b.id, text: Object.entries(b.werte ?? {}).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, String(v)), roh), tun: t.tun ?? "" };
  };
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.oc.titel}</h1>
        <p className="mt-2">{x.oc.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.oc.hinweis}</p>
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {u.rolle !== "mitarbeiter" ? (
        <form action={pruefen} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="url" className="block text-klein font-bold">{x.oc.url}</label>
            <input id="url" name="url" type="text" inputMode="url" required placeholder="https://www.beispiel.de" defaultValue={aktuell?.url ?? ""} className="feld mt-1" />
          </div>
          <button className="knopf">{x.oc.pruefen}</button>
        </form>
      ) : null}

      {aktuell ? (
        <section aria-labelledby="ergebnis">
          <h2 id="ergebnis" className="text-gross font-bold">{fuelle(x.oc.ergebnis, { datum: zeit(aktuell.erstellt_am) })}</h2>
          <p className="text-klein text-tinte-leise break-all">{aktuell.url}{aktuell.seiten ? ` · ${fuelle(x.oc.seiten, { n: aktuell.seiten.length })}` : ""}</p>
          {aktuell.status === "fehler" ? (
            <p role="alert" className="mt-3 rounded-md border-2 border-frist bg-frist-hauch p-4">{(x.oc.fehler as Record<string, string>)[aktuell.fehler ?? ""] ?? x.oc.fehler.nicht_erreichbar}</p>
          ) : (
            <ul className="mt-3 border-t border-linie">
              {aktuell.befunde.map((b) => {
                const t = befundText(b);
                return (
                  <li key={b.id} className="flex gap-3 border-b border-linie py-3">
                    <span aria-hidden className={`w-5 shrink-0 text-center font-bold ${FARBE[b.status]}`}>{ZEICHEN[b.status]}</span>
                    <div className="min-w-0">
                      <p><span className="font-bold">{t.titel}</span> <span className={`text-klein font-bold ${FARBE[b.status]}`}>· {x.oc.status[b.status]}</span></p>
                      {t.text ? <p className="text-klein">{t.text}</p> : null}
                      {b.status !== "ok" && t.tun ? <p className="text-klein text-tinte-leise">{t.tun}</p> : null}
                      {b.status !== "ok" && b.pflicht_id ? <Link href={`/pflichten?pflicht=${encodeURIComponent(b.pflicht_id)}`} className="verweis text-klein">{x.oc.zur_pflicht}</Link> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <p>{x.oc.keine}</p>
      )}

      {liste.length > 1 ? (
        <section aria-labelledby="verlauf">
          <h2 id="verlauf" className="font-bold">{x.oc.verlauf}</h2>
          <ul className="mt-2 text-klein">
            {liste.map((c) => (
              <li key={c.id}>
                <Link href={`${SEITE}?check=${c.id}`} className="verweis" aria-current={c.id === aktuell?.id ? "true" : undefined}>{zeit(c.erstellt_am)}</Link>{" "}
                <span className="text-tinte-leise">· {c.url} · {c.status === "fehler" ? x.oc.status.fehlt : `${c.befunde.filter((b) => b.status === "fehlt").length} ✗ / ${c.befunde.filter((b) => b.status === "hinweis").length} !`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
