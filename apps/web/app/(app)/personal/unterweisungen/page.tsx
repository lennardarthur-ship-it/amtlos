import Link from "next/link";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Unterweisungen" };

interface Unterweisung { id: string; thema: string; datum: string; durchgefuehrt_von: string; abgeschlossen_am: string | null; dokument_id: string | null; bestaetigt: number }
const ARTEN = ["arbeitsschutz", "ki_kompetenz", "datenschutz"] as const;
type Art = (typeof ARTEN)[number];

async function anlegen(art: Art, f: FormData) {
  "use server";
  const u = await senden<{ id: string }>("/v1/unterweisungen", "POST", {
    thema: String(f.get("thema") ?? ""), inhalt: String(f.get("inhalt") ?? ""), datum: String(f.get("datum") ?? ""), durchgefuehrt_von: String(f.get("durchgefuehrt_von") ?? ""), art,
  }, `/personal/unterweisungen?art=${art}`);
  redirect(`/personal/unterweisungen/${u.id}`);
}

export default async function UnterweisungenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; art?: string }> }) {
  const sp = await searchParams;
  const art: Art = (ARTEN as readonly string[]).includes(sp.art ?? "") ? (sp.art as Art) : "arbeitsschutz";
  const fehler = sp.fehler;
  const [{ s, t: x }, liste, u] = await Promise.all([t(), api<Unterweisung[]>(`/v1/unterweisungen?art=${art}`), aktivesUnternehmen()]);
  const ki = art === "ki_kompetenz";
  const heute = new Date().toISOString().slice(0, 10);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein">{ki ? <Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link> : <Link href="/personal" className="verweis">{x.personal.zurueck}</Link>}</p>
      <header>
        <h1 className="text-titel font-bold">{ki ? x.schulung.titel : x.unterweisung.titel}</h1>
        <p className="mt-2">{ki ? x.schulung.text : x.unterweisung.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((w) => (
            <li key={w.id} className="border-b border-linie py-3">
              <Link href={`/personal/unterweisungen/${w.id}`} className="verweis font-bold">{w.thema}</Link>
              <p className="text-klein text-tinte-leise">
                {datumLang(w.datum, s)} · {w.durchgefuehrt_von} · {fuelle(x.unterweisung.bestaetigt, { n: w.bestaetigt })} ·{" "}
                {w.abgeschlossen_am ? fuelle(x.unterweisung.abgeschlossen, { datum: datumLang(w.abgeschlossen_am.slice(0, 10), s) }) : x.unterweisung.offen}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.unterweisung.leer}</p>
      )}
      {u.rolle !== "mitarbeiter" ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.unterweisung.neu}</h2>
          <form action={anlegen.bind(null, art)} className="mt-3 space-y-3">
            <div><label htmlFor="thema" className="block text-klein font-bold">{x.unterweisung.thema}</label><input id="thema" name="thema" required maxLength={200} defaultValue={ki ? x.schulung.titel : undefined} className="feld mt-1" /></div>
            <div><label htmlFor="u-inhalt" className="block text-klein font-bold">{x.unterweisung.inhalt}</label><textarea id="u-inhalt" name="inhalt" required rows={6} maxLength={20000} defaultValue={ki ? x.schulung.vorlage : undefined} className="feld mt-1" />{ki ? <p className="mt-1 text-klein text-tinte-leise">{x.schulung.vorlage_hinweis}</p> : null}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="datum" className="block text-klein font-bold">{x.unterweisung.datum}</label><input id="datum" name="datum" type="date" required defaultValue={heute} className="feld mt-1" /></div>
              <div><label htmlFor="durchgefuehrt_von" className="block text-klein font-bold">{x.unterweisung.durchgefuehrt_von}</label><input id="durchgefuehrt_von" name="durchgefuehrt_von" required className="feld mt-1" /></div>
            </div>
            <button className="knopf">{x.unterweisung.anlegen}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
