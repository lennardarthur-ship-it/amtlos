import Link from "next/link";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Änderung melden" };

/**
 * Ereignisse, die Nutzer selbst melden; system-erzeugte (Schwellen) und Gründung (aus dem Profil) nicht.
 * Einstellung und Austritt laufen über „Personal“ (dort entsteht zugleich der Eintrag in der Personalliste).
 */
const MELDBAR = [
  "neuer_arbeitsplatz", "neue_taetigkeit", "arbeitsunfall",
  "schwangerschaft_mitgeteilt", "neuer_vertriebskanal", "kasse_angeschafft", "kasse_ausser_betrieb",
  "rechtsformwechsel", "sitzverlegung", "gesellschafterwechsel", "datenpanne", "betriebsaufgabe",
] as const;

interface Ereignis { id: string; typ: string; datum: string; storniert: boolean; storniert_ereignis_id: string | null }

async function melden(formular: FormData) {
  "use server";
  await api("/v1/ereignisse", {
    method: "POST",
    body: JSON.stringify({ typ: formular.get("typ"), datum: formular.get("datum"), client_id: formular.get("client_id") }),
  });
  revalidatePath("/melden");
  redirect("/melden?gemeldet=1");
}

async function zuruecknehmen(id: string) {
  "use server";
  await api(`/v1/ereignisse/${id}/storno`, { method: "POST" });
  revalidatePath("/melden");
}

export default async function MeldenSeite({ searchParams }: { searchParams: Promise<{ gemeldet?: string }> }) {
  const [{ s, t: x }, liste, { gemeldet }] = await Promise.all([t(), api<Ereignis[]>("/v1/ereignisse"), searchParams]);
  const eigene = liste.filter((e) => !e.storniert_ereignis_id);
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-10">
      <header className="lesetext">
        <h1 className="text-titel font-bold">{x.melden.titel}</h1>
        <p className="mt-2">{x.melden.text}</p>
        <p className="mt-2 text-klein">
          {x.melden.personal_hinweis} <Link href="/personal" className="verweis">{x.nav.personal}</Link>
        </p>
      </header>
      {gemeldet ? (
        <p role="status" className="lesetext rounded-md bg-amt-hauch p-4 font-bold text-amt">
          {x.melden.gemeldet}
        </p>
      ) : null}
      <form action={melden} className="lesetext space-y-5">
        {/* client_id macht doppeltes Absenden unschädlich (idempotent, E-018) */}
        <input type="hidden" name="client_id" value={randomUUID()} />
        <fieldset>
          <legend className="font-bold">{x.melden.typ}</legend>
          <div className="mt-2 space-y-1">
            {MELDBAR.map((typ) => (
              <label key={typ} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-blatt">
                <input type="radio" name="typ" value={typ} required className="size-5 accent-amt" />
                {x.ereignis[typ]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="datum" className="font-bold">
            {x.melden.datum}
          </label>
          <input id="datum" name="datum" type="date" required defaultValue={heute} className="feld mt-2 max-w-60" />
        </div>
        <button className="knopf">{x.melden.knopf}</button>
      </form>

      {eigene.length ? (
        <section aria-labelledby="bisher" className="lesetext">
          <h2 id="bisher" className="text-gross font-bold">
            {x.melden.bisher}
          </h2>
          <ul className="mt-2 border-t border-linie">
            {eigene.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-linie py-3">
                <span className={e.storniert ? "text-tinte-leise line-through" : ""}>
                  {datumLang(e.datum, s)}: {x.ereignis[e.typ as keyof typeof x.ereignis] ?? e.typ}
                </span>
                {e.storniert ? (
                  <span className="text-klein text-tinte-leise">{x.melden.storniert}</span>
                ) : (
                  <form action={zuruecknehmen.bind(null, e.id)}>
                    <button className="verweis min-h-11 text-klein">{x.melden.stornieren}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
