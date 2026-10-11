import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Allergene" };

const ALLERGENE = ["gluten", "krebstiere", "eier", "fische", "erdnuesse", "soja", "milch", "schalenfruechte", "sellerie", "senf", "sesam", "schwefeldioxid", "lupinen", "weichtiere"] as const;
type Allergen = (typeof ALLERGENE)[number];
interface Gericht { id: string; name: string; kategorie: string; allergene: Allergen[]; aktiv: boolean }
const SEITE = "/branche/allergene";
const daten = (f: FormData) => ({ name: String(f.get("name") ?? ""), kategorie: String(f.get("kategorie") ?? ""), allergene: f.getAll("allergene").map(String) });

async function anlegen(f: FormData) {
  "use server";
  await senden("/v1/gerichte", "POST", daten(f), SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function speichern(g: Gericht, f: FormData) {
  "use server";
  await senden(`/v1/gerichte/${g.id}`, "PUT", { ...daten(f), aktiv: f.get("umschalten") ? !g.aktiv : g.aktiv }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

function Felder({ x, g, praefix }: { x: Awaited<ReturnType<typeof t>>["t"]; g?: Gericht; praefix: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`${praefix}-name`} className="block text-klein font-bold">{x.allergen.name}</label><input id={`${praefix}-name`} name="name" required defaultValue={g?.name} className="feld mt-1" /></div>
        <div><label htmlFor={`${praefix}-kategorie`} className="block text-klein font-bold">{x.allergen.kategorie}</label><input id={`${praefix}-kategorie`} name="kategorie" defaultValue={g?.kategorie} className="feld mt-1" /></div>
      </div>
      <fieldset>
        <legend className="text-klein font-bold">{x.allergen.allergene}</legend>
        <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
          {ALLERGENE.map((a) => (
            <label key={a} className="flex min-h-11 items-center gap-3"><input type="checkbox" name="allergene" value={a} defaultChecked={g?.allergene.includes(a)} className="size-5 accent-amt" /> {x.allergen.namen[a]}</label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default async function AllergeneSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ t: x }, gerichte, { fehler }, u] = await Promise.all([t(), api<Gericht[]>("/v1/gerichte"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/branche" className="verweis">{x.branche.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.allergen.titel}</h1>
        <p className="mt-2">{x.allergen.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.allergen.hinweis}</p>
        {gerichte.some((g) => g.aktiv) ? <p className="mt-2"><a href={`${SEITE}/aushang`} className="verweis">{x.allergen.aushang}</a></p> : null}
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {gerichte.length ? (
        <ul className="border-t border-linie">
          {gerichte.map((g) => (
            <li key={g.id} className={`space-y-1 border-b border-linie py-3 ${g.aktiv ? "" : "text-tinte-leise"}`}>
              <p><span className="font-bold">{g.name}</span>{g.kategorie ? <span className="text-klein text-tinte-leise"> · {g.kategorie}</span> : null}{g.aktiv ? "" : <span className="text-klein"> · {x.allergen.inaktiv}</span>}</p>
              <p className="text-klein">{g.allergene.length ? g.allergene.map((a) => x.allergen.namen[a]).join(", ") : x.allergen.keine}</p>
              {darf ? (
                <details>
                  <summary className="cursor-pointer text-klein text-amt">{x.allergen.bearbeiten}</summary>
                  <form action={speichern.bind(null, g)} className="mt-2 space-y-3">
                    <Felder x={x} g={g} praefix={g.id} />
                    <div className="flex flex-wrap gap-3">
                      <button className="knopf knopf-leise">{x.allergen.speichern}</button>
                      <button name="umschalten" value="1" className="knopf knopf-leise">{g.aktiv ? x.allergen.aus_angebot : x.allergen.wieder}</button>
                    </div>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.allergen.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.allergen.neu}</h2>
          <form action={anlegen} className="mt-3 space-y-3">
            <Felder x={x} praefix="neu" />
            <button className="knopf">{x.allergen.anlegen}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
