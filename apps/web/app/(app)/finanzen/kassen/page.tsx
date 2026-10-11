import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { EingabeFehler, api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Kassen" };

interface Kasse { id: string; bezeichnung: string; hersteller: string | null; modell: string | null; seriennummer: string | null; tse_seriennummer: string | null; angeschafft_am: string; ausser_betrieb_am: string | null }

async function erfassen(f: FormData) {
  "use server";
  const text = (k: string) => String(f.get(k) ?? "").trim() || null;
  try {
    await api("/v1/kassen", {
      method: "POST",
      body: JSON.stringify({ bezeichnung: text("bezeichnung"), hersteller: text("hersteller"), modell: text("modell"), seriennummer: text("seriennummer"), tse_seriennummer: text("tse_seriennummer"), betriebsstaette: text("betriebsstaette"), angeschafft_am: text("angeschafft_am") }),
    });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/kassen?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/finanzen/kassen");
  redirect("/finanzen/kassen");
}

async function ausserBetrieb(id: string, f: FormData) {
  "use server";
  try {
    await api(`/v1/kassen/${id}/ausser-betrieb`, { method: "POST", body: JSON.stringify({ datum: String(f.get("datum") ?? "") }) });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/kassen?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/finanzen/kassen");
}

export default async function KassenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, kassen, { fehler }] = await Promise.all([t(), api<Kasse[]>("/v1/kassen"), searchParams]);
  const heute = new Date().toISOString().slice(0, 10);
  const felder = [["bezeichnung", x.kasse.bezeichnung, true], ["hersteller", x.kasse.hersteller, false], ["modell", x.kasse.modell, false], ["seriennummer", x.kasse.seriennummer, false], ["tse_seriennummer", x.kasse.tse, false], ["betriebsstaette", x.kasse.betriebsstaette, false]] as const;
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/finanzen" className="verweis">{x.finanzen.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.kasse.titel}</h1>
        <p className="mt-2">{x.kasse.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.kasse.elster}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {kassen.length ? (
        <ul className="border-t border-linie">
          {kassen.map((k) => (
            <li key={k.id} className="space-y-2 border-b border-linie py-4">
              <p className="font-bold">{k.bezeichnung}</p>
              <p className="text-klein text-tinte-leise">
                {[k.hersteller, k.modell, k.seriennummer ? `SN ${k.seriennummer}` : null, k.tse_seriennummer ? `TSE ${k.tse_seriennummer}` : null].filter(Boolean).join(" · ")}
              </p>
              <p className="text-klein">{k.ausser_betrieb_am ? fuelle(x.kasse.beendet, { datum: datumLang(k.ausser_betrieb_am, s) }) : fuelle(x.kasse.aktiv, { datum: datumLang(k.angeschafft_am, s) })}</p>
              {k.ausser_betrieb_am ? null : (
                <form action={ausserBetrieb.bind(null, k.id)} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor={`datum-${k.id}`} className="block text-klein font-bold">{x.kasse.ausser_betrieb}</label>
                    <input id={`datum-${k.id}`} name="datum" type="date" required defaultValue={heute} className="feld mt-1 w-auto" />
                  </div>
                  <button className="knopf knopf-leise">{x.kasse.ausser_betrieb_knopf}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.kasse.leer}</p>
      )}
      <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
        <h2 id="neu" className="font-bold">{x.kasse.neu}</h2>
        <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
          {felder.map(([k, label, pflicht]) => (
            <div key={k}>
              <label htmlFor={k} className="block text-klein font-bold">{label}</label>
              <input id={k} name={k} required={pflicht} className="feld mt-1" />
            </div>
          ))}
          <div>
            <label htmlFor="angeschafft_am" className="block text-klein font-bold">{x.kasse.angeschafft}</label>
            <input id="angeschafft_am" name="angeschafft_am" type="date" required className="feld mt-1" />
          </div>
          <div className="flex items-end"><button className="knopf">{x.kasse.erfassen}</button></div>
        </form>
      </section>
    </div>
  );
}
