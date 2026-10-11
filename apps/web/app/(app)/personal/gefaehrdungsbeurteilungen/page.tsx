import Link from "next/link";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Gefährdungsbeurteilung" };

interface Beurteilung { id: string; arbeitsbereich: string; datum: string; beurteilt_von: string; mutterschutz: boolean; abgeschlossen_am: string | null; dokument_id: string | null; gefaehrdungen: number; offen: number; ueberfaellig: number }

async function anlegen(f: FormData) {
  "use server";
  const b = await senden<{ id: string }>("/v1/gefaehrdungsbeurteilungen", "POST", {
    arbeitsbereich: String(f.get("arbeitsbereich") ?? ""), taetigkeiten: String(f.get("taetigkeiten") ?? ""), beurteilt_von: String(f.get("beurteilt_von") ?? ""),
    datum: String(f.get("datum") ?? ""), mutterschutz: f.get("mutterschutz") === "on",
  }, "/personal/gefaehrdungsbeurteilungen");
  redirect(`/personal/gefaehrdungsbeurteilungen/${b.id}`);
}

export default async function BeurteilungenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Beurteilung[]>("/v1/gefaehrdungsbeurteilungen"), searchParams, aktivesUnternehmen()]);
  const heute = new Date().toISOString().slice(0, 10);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/personal" className="verweis">{x.personal.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.gb.titel}</h1>
        <p className="mt-2">{x.gb.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((b) => (
            <li key={b.id} className="border-b border-linie py-3">
              <Link href={`/personal/gefaehrdungsbeurteilungen/${b.id}`} className="verweis font-bold">{b.arbeitsbereich}</Link>
              <p className="text-klein text-tinte-leise">
                {datumLang(b.datum, s)} · {b.abgeschlossen_am ? fuelle(x.gb.abgeschlossen, { datum: datumLang(b.abgeschlossen_am.slice(0, 10), s) }) : x.gb.entwurf}
                {b.mutterschutz ? ` · ${x.gb.mutterschutz_ja}` : ""}
              </p>
              <p className="text-klein">
                {fuelle(x.gb.zaehler, { n: b.gefaehrdungen, offen: b.offen })}
                {b.ueberfaellig ? <span className="font-bold text-frist"> · {fuelle(x.gb.ueberfaellig, { n: b.ueberfaellig })}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.gb.leer}</p>
      )}
      {u.rolle !== "mitarbeiter" ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.gb.neu}</h2>
          <form action={anlegen} className="mt-3 space-y-3">
            <div><label htmlFor="arbeitsbereich" className="block text-klein font-bold">{x.gb.arbeitsbereich}</label><input id="arbeitsbereich" name="arbeitsbereich" required maxLength={200} className="feld mt-1" /></div>
            <div><label htmlFor="taetigkeiten" className="block text-klein font-bold">{x.gb.taetigkeiten}</label><textarea id="taetigkeiten" name="taetigkeiten" rows={3} maxLength={5000} className="feld mt-1" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="beurteilt_von" className="block text-klein font-bold">{x.gb.beurteilt_von}</label><input id="beurteilt_von" name="beurteilt_von" required className="feld mt-1" /></div>
              <div><label htmlFor="datum" className="block text-klein font-bold">{x.gb.datum}</label><input id="datum" name="datum" type="date" required defaultValue={heute} className="feld mt-1" /></div>
            </div>
            <label className="flex items-center gap-3"><input type="checkbox" name="mutterschutz" className="size-5 accent-amt" /> {x.gb.mutterschutz}</label>
            <button className="knopf">{x.gb.anlegen}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
