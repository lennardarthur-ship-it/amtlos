import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import { aktuellerMonat, isoZuOrtszeit, nachbarMonat, ortszeitZuIso } from "@/lib/zeit";
import type { Beschaeftigter } from "../page";

export const metadata = { title: "Arbeitszeiten" };

interface Eintrag { id: string; beschaeftigter_id: string; beginn: string; ende: string | null; pause_minuten: number; quelle: "stempel" | "nachtrag" | "korrektur"; grund: string | null; minuten: number }
interface Monat { monat: string; eintraege: Eintrag[]; summen_minuten: Record<string, number>; laufend: { beschaeftigter_id: string; beginn: string }[] }

const SEITE = "/personal/zeiten";
const pause = (f: FormData) => Math.max(0, Math.round(Number(String(f.get("pause_minuten") ?? "0").trim() || 0)));

async function kommen(id: string, monat: string) {
  "use server";
  await senden("/v1/zeiten/kommen", "POST", { beschaeftigter_id: id }, `${SEITE}?monat=${monat}`);
  revalidatePath(SEITE);
  redirect(`${SEITE}?monat=${monat}`);
}

async function gehen(id: string, monat: string, f: FormData) {
  "use server";
  await senden("/v1/zeiten/gehen", "POST", { beschaeftigter_id: id, pause_minuten: pause(f) }, `${SEITE}?monat=${monat}`);
  revalidatePath(SEITE);
  redirect(`${SEITE}?monat=${monat}`);
}

function zeitraum(f: FormData, zurueck: string) {
  const datum = String(f.get("datum") ?? "");
  const beginn = ortszeitZuIso(datum, String(f.get("von") ?? ""));
  let ende = ortszeitZuIso(datum, String(f.get("bis") ?? ""));
  if (!beginn || !ende) redirect(`${zurueck}&fehler=${encodeURIComponent("Datum und Uhrzeit prüfen")}`);
  if (ende <= beginn) ende = new Date(new Date(ende).getTime() + 86_400_000).toISOString(); // über Mitternacht
  return { beginn, ende };
}

async function nachtragen(monat: string, f: FormData) {
  "use server";
  const zurueck = `${SEITE}?monat=${monat}`;
  const { beginn, ende } = zeitraum(f, zurueck);
  await senden("/v1/zeiten", "POST", { beschaeftigter_id: String(f.get("beschaeftigter_id") ?? ""), beginn, ende, pause_minuten: pause(f), grund: String(f.get("grund") ?? "") }, zurueck);
  revalidatePath(SEITE);
  redirect(zurueck);
}

async function korrigieren(id: string, monat: string, f: FormData) {
  "use server";
  const zurueck = `${SEITE}?monat=${monat}`;
  const grund = String(f.get("grund") ?? "");
  const koerper = f.get("storniert") ? { storniert: true, grund } : { ...zeitraum(f, zurueck), pause_minuten: pause(f), grund };
  await senden(`/v1/zeiten/${id}/korrigieren`, "POST", koerper, zurueck);
  revalidatePath(SEITE);
  redirect(zurueck);
}

export default async function ZeitenSeite({ searchParams }: { searchParams: Promise<{ monat?: string; fehler?: string }> }) {
  const sp = await searchParams;
  const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.monat ?? "") ? sp.monat! : aktuellerMonat();
  const [{ s, t: x }, personen, m, u] = await Promise.all([t(), api<Beschaeftigter[]>("/v1/beschaeftigte"), api<Monat>(`/v1/zeiten?monat=${monat}`), aktivesUnternehmen()]);
  const darfSchreiben = u.rolle !== "mitarbeiter";
  const heute = isoZuOrtszeit(new Date().toISOString()).datum;
  const aktiv = personen.filter((p) => p.eintritt <= heute && (!p.austritt || p.austritt >= heute));
  const name = new Map(personen.map((p) => [p.id, `${p.vorname} ${p.nachname}`]));
  const laufend = new Map(m.laufend.map((l) => [l.beschaeftigter_id, l.beginn]));
  const dauer = (min: number) => fuelle(x.zeit.stunden, { h: Math.floor(min / 60), m: min % 60 });
  const tag = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const monatName = new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monat}-01T00:00:00Z`));
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/personal" className="verweis">{x.personal.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.zeit.titel}</h1>
        <p className="mt-2">{x.zeit.text}</p>
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}

      {aktiv.length ? (
        <ul className="border-t border-linie" aria-label={x.zeit.person}>
          {aktiv.map((p) => {
            const seit = laufend.get(p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-linie py-3">
                <div>
                  <p className="font-bold">{p.vorname} {p.nachname}</p>
                  {seit ? <p className="text-klein text-amt">{fuelle(x.zeit.laeuft, { name: p.vorname, zeit: isoZuOrtszeit(seit).uhrzeit })}</p> : null}
                </div>
                {seit ? (
                  <form action={gehen.bind(null, p.id, monat)} className="flex items-end gap-2">
                    <div>
                      <label htmlFor={`pause-${p.id}`} className="block text-klein">{x.zeit.pause}</label>
                      <input id={`pause-${p.id}`} name="pause_minuten" inputMode="numeric" defaultValue="0" className="feld mt-1 w-20" />
                    </div>
                    <button className="knopf">{x.zeit.gehen}</button>
                  </form>
                ) : (
                  <form action={kommen.bind(null, p.id, monat)}><button className="knopf">{x.zeit.kommen}</button></form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{x.zeit.keine_personen}</p>
      )}

      <section aria-labelledby="monat">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="monat" className="text-gross font-bold">{monatName}</h2>
          <p className="flex gap-4 text-klein">
            <Link href={`${SEITE}?monat=${nachbarMonat(monat, -1)}`} className="verweis" aria-label={x.zeit.vormonat}>←</Link>
            <Link href={`${SEITE}?monat=${nachbarMonat(monat, 1)}`} className="verweis" aria-label={x.zeit.naechster_monat}>→</Link>
            {darfSchreiben && m.eintraege.length ? <a href={`${SEITE}/export?monat=${monat}`} className="verweis">{x.zeit.export}</a> : null}
          </p>
        </div>
        {Object.keys(m.summen_minuten).length ? (
          <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
            {Object.entries(m.summen_minuten).map(([id, min]) => (
              <div key={id} className="flex justify-between gap-4 border-b border-linie py-2 text-klein">
                <dt>{name.get(id)}</dt>
                <dd className="font-bold">{dauer(min)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {m.eintraege.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="tabelle w-full text-klein">
              <thead>
                <tr><th>{x.zeit.spalte_tag}</th><th>{x.zeit.person}</th><th>{x.zeit.spalte_zeit}</th><th>{x.zeit.spalte_dauer}</th></tr>
              </thead>
              <tbody>
                {m.eintraege.map((e) => {
                  const b = isoZuOrtszeit(e.beginn);
                  const en = e.ende ? isoZuOrtszeit(e.ende) : null;
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{tag(e.beginn)}</td>
                      <td>{name.get(e.beschaeftigter_id)}</td>
                      <td>
                        {b.uhrzeit}–{en?.uhrzeit ?? "…"}
                        {e.pause_minuten ? <span className="text-tinte-leise"> ({x.zeit.pause}: {e.pause_minuten})</span> : null}
                        {e.quelle !== "stempel" ? <span className="block text-tinte-leise">{x.zeit.quelle[e.quelle]}{e.grund ? `: ${e.grund}` : ""}</span> : null}
                        {darfSchreiben && e.ende ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-amt">{x.zeit.korrigieren}</summary>
                            <form action={korrigieren.bind(null, e.id, monat)} className="mt-2 grid gap-2">
                              <input type="hidden" name="datum" value={b.datum} />
                              <div className="flex flex-wrap gap-2">
                                <label className="text-klein">{x.zeit.beginn}<input name="von" type="time" defaultValue={b.uhrzeit} className="feld mt-1 w-auto" /></label>
                                <label className="text-klein">{x.zeit.ende}<input name="bis" type="time" defaultValue={en?.uhrzeit} className="feld mt-1 w-auto" /></label>
                                <label className="text-klein">{x.zeit.pause}<input name="pause_minuten" inputMode="numeric" defaultValue={e.pause_minuten} className="feld mt-1 w-20" /></label>
                              </div>
                              <label className="text-klein">{x.zeit.grund}<input name="grund" required className="feld mt-1" /></label>
                              <label className="flex items-center gap-2 text-klein"><input type="checkbox" name="storniert" /> {x.zeit.stornieren}</label>
                              <div><button className="knopf knopf-leise">{x.zeit.korrigieren}</button></div>
                            </form>
                          </details>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">{e.ende ? dauer(e.minuten) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3">{x.zeit.keine}</p>
        )}
      </section>

      {darfSchreiben && personen.length ? (
        <section aria-labelledby="nachtrag" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="nachtrag" className="font-bold">{x.zeit.nachtrag}</h2>
          <form action={nachtragen.bind(null, monat)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="n-person" className="block text-klein font-bold">{x.zeit.person}</label>
              <select id="n-person" name="beschaeftigter_id" required className="feld mt-1">{personen.map((p) => <option key={p.id} value={p.id}>{p.vorname} {p.nachname}</option>)}</select>
            </div>
            <div><label htmlFor="n-datum" className="block text-klein font-bold">{x.unterweisung.datum}</label><input id="n-datum" name="datum" type="date" required defaultValue={heute} className="feld mt-1" /></div>
            <div><label htmlFor="n-von" className="block text-klein font-bold">{x.zeit.beginn}</label><input id="n-von" name="von" type="time" required className="feld mt-1" /></div>
            <div><label htmlFor="n-bis" className="block text-klein font-bold">{x.zeit.ende}</label><input id="n-bis" name="bis" type="time" required className="feld mt-1" /></div>
            <div><label htmlFor="n-pause" className="block text-klein font-bold">{x.zeit.pause}</label><input id="n-pause" name="pause_minuten" inputMode="numeric" defaultValue="0" className="feld mt-1" /></div>
            <div><label htmlFor="n-grund" className="block text-klein font-bold">{x.zeit.grund}</label><input id="n-grund" name="grund" required className="feld mt-1" /></div>
            <div><button className="knopf">{x.zeit.nachtragen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
