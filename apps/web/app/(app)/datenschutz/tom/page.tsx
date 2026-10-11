import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Technische und organisatorische Maßnahmen" };

const ZIELE = ["pseudonymisierung_verschluesselung", "vertraulichkeit", "integritaet", "verfuegbarkeit_belastbarkeit", "wiederherstellung", "ueberpruefung", "sonstiges"] as const;
interface Tom { id: string; schutzziel: (typeof ZIELE)[number]; massnahme: string; umgesetzt_am: string | null; verantwortlich: string | null }
const SEITE = "/datenschutz/tom";

async function erfassen(f: FormData) {
  "use server";
  await senden("/v1/tom", "POST", {
    schutzziel: String(f.get("schutzziel") ?? ""), massnahme: String(f.get("massnahme") ?? ""),
    umgesetzt_am: String(f.get("umgesetzt_am") ?? "") || null, verantwortlich: String(f.get("verantwortlich") ?? "").trim() || null,
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function umgesetzt(m: Tom) {
  "use server";
  await senden(`/v1/tom/${m.id}`, "PUT", { schutzziel: m.schutzziel, massnahme: m.massnahme, verantwortlich: m.verantwortlich, umgesetzt_am: new Date().toISOString().slice(0, 10) }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function loeschen(id: string) {
  "use server";
  await senden(`/v1/tom/${id}`, "DELETE", undefined, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function TomSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Tom[]>("/v1/tom"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const gruppen = ZIELE.map((z) => [z, liste.filter((m) => m.schutzziel === z)] as const).filter(([, l]) => l.length);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.tom.titel}</h1>
        <p className="mt-2">{x.tom.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {gruppen.length ? (
        gruppen.map(([ziel, l]) => (
          <section key={ziel} aria-labelledby={ziel}>
            <h2 id={ziel} className="font-bold">{x.tom.schutzziele[ziel]}</h2>
            <ul className="mt-2 border-t border-linie">
              {l.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linie py-2">
                  <span>{m.massnahme}{m.verantwortlich ? <span className="text-klein text-tinte-leise"> · {m.verantwortlich}</span> : null}</span>
                  <span className="flex items-baseline gap-3 text-klein">
                    <span className={m.umgesetzt_am ? "text-amt" : "text-bald"}>{m.umgesetzt_am ? fuelle(x.tom.umgesetzt, { datum: datumLang(m.umgesetzt_am, s) }) : x.tom.geplant}</span>
                    {darf && !m.umgesetzt_am ? <form action={umgesetzt.bind(null, m)}><button className="underline">{x.tom.als_umgesetzt}</button></form> : null}
                    {darf ? <form action={loeschen.bind(null, m.id)}><button className="text-tinte-leise underline">{x.tom.loeschen}</button></form> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p>{x.tom.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.tom.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="schutzziel" className="block text-klein font-bold">{x.tom.schutzziel}</label>
              <select id="schutzziel" name="schutzziel" className="feld mt-1">{ZIELE.map((z) => <option key={z} value={z}>{x.tom.schutzziele[z]}</option>)}</select>
            </div>
            <div><label htmlFor="massnahme" className="block text-klein font-bold">{x.tom.massnahme}</label><input id="massnahme" name="massnahme" required className="feld mt-1" /></div>
            <div><label htmlFor="umgesetzt_am" className="block text-klein font-bold">{x.tom.umgesetzt_am}</label><input id="umgesetzt_am" name="umgesetzt_am" type="date" className="feld mt-1" /></div>
            <div><label htmlFor="verantwortlich" className="block text-klein font-bold">{x.tom.verantwortlich}</label><input id="verantwortlich" name="verantwortlich" className="feld mt-1" /></div>
            <div><button className="knopf">{x.tom.erfassen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
