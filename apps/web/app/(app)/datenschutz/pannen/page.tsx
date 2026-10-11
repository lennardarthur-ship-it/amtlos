import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "@/komponenten/countdown";
import { senden } from "@/lib/aktion";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import { ortszeitZuIso } from "@/lib/zeit";

export const metadata = { title: "Datenpannen" };

interface Panne { id: string; entdeckt_am: string; beschreibung: string; risiko: string | null; gemeldet_am: string | null; abgeschlossen_am: string | null; frist_bis: string }
const SEITE = "/datenschutz/pannen";

async function melden(f: FormData) {
  "use server";
  const datum = String(f.get("datum") ?? "");
  const uhrzeit = String(f.get("uhrzeit") ?? "");
  const entdeckt = datum && uhrzeit ? ortszeitZuIso(datum, uhrzeit) : null;
  const p = await senden<{ id: string }>("/v1/datenpannen", "POST", { beschreibung: String(f.get("beschreibung") ?? ""), ...(entdeckt ? { entdeckt_am: entdeckt } : {}) }, SEITE);
  redirect(`${SEITE}/${p.id}`);
}

export default async function PannenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }] = await Promise.all([t(), api<Panne[]>("/v1/datenpannen"), searchParams]);
  const zeit = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const jetzt = new Date();
  const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);
  const uhrzeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(jetzt);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link></p>
      <h1 className="text-titel font-bold">{x.panne.titel}</h1>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      <section id="melden" aria-labelledby="melden-titel" className="rounded-md border-2 border-frist bg-blatt p-4">
        <h2 id="melden-titel" className="text-gross font-bold">{x.panne.notfall_titel}</h2>
        <p className="mt-1">{x.panne.notfall_text}</p>
        <form action={melden} className="mt-3 space-y-3">
          <div><label htmlFor="beschreibung" className="block text-klein font-bold">{x.panne.beschreibung}</label><textarea id="beschreibung" name="beschreibung" required rows={3} className="feld mt-1" /></div>
          <fieldset>
            <legend className="text-klein font-bold">{x.panne.entdeckt}</legend>
            <div className="mt-1 grid max-w-sm grid-cols-2 gap-2">
              <input aria-label={x.panne.entdeckt} name="datum" type="date" defaultValue={datum} max={datum} className="feld" />
              <input aria-label={x.zeit.beginn} name="uhrzeit" type="time" defaultValue={uhrzeit} className="feld" />
            </div>
          </fieldset>
          <button className="knopf knopf-notfall">{x.panne.erfassen}</button>
        </form>
      </section>
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((p) => (
            <li key={p.id} className="space-y-1 border-b border-linie py-3">
              <Link href={`${SEITE}/${p.id}`} className="verweis font-bold">{p.beschreibung.length > 80 ? `${p.beschreibung.slice(0, 80)}…` : p.beschreibung}</Link>
              <p className="text-klein text-tinte-leise">{x.panne.entdeckt}: {zeit(p.entdeckt_am)} · {p.abgeschlossen_am ? x.panne.abgeschlossen : x.panne.offen}</p>
              {!p.abgeschlossen_am && !p.gemeldet_am && p.risiko !== "kein_risiko" ? (
                <p className="text-klein"><Countdown bis={p.frist_bis} laeuft={x.panne.countdown} abgelaufen={x.panne.abgelaufen} zeit={zeit(p.frist_bis)} /></p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.panne.leer}</p>
      )}
    </div>
  );
}
