import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Personal" };

const ARTEN = ["vollzeit", "teilzeit", "minijob", "azubi", "werkstudent"] as const;
export interface Beschaeftigter { id: string; vorname: string; nachname: string; art: (typeof ARTEN)[number]; eintritt: string; austritt: string | null; wochenstunden: number | null }
interface Schwellen { aktuell: number; schwellen: { ab: number; neu: { pflicht_id: string; titel: string }[]; zu_pruefen: { pflicht_id: string; titel: string }[] }[] }

async function erfassen(f: FormData) {
  "use server";
  const stunden = String(f.get("wochenstunden") ?? "").replace(",", ".").trim();
  await senden("/v1/beschaeftigte", "POST", {
    vorname: String(f.get("vorname") ?? ""), nachname: String(f.get("nachname") ?? ""), art: String(f.get("art") ?? ""), eintritt: String(f.get("eintritt") ?? ""),
    wochenstunden: stunden ? Number(stunden) : null,
  }, "/personal");
  revalidatePath("/personal");
  redirect("/personal");
}

async function austritt(id: string, f: FormData) {
  "use server";
  await senden(`/v1/beschaeftigte/${id}/austritt`, "POST", { datum: String(f.get("datum") ?? "") }, "/personal");
  revalidatePath("/personal");
  redirect("/personal");
}

export default async function PersonalSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, schwellen, { fehler }, u] = await Promise.all([t(), api<Beschaeftigter[]>("/v1/beschaeftigte"), api<Schwellen>("/v1/personal/schwellen"), searchParams, aktivesUnternehmen()]);
  const darfSchreiben = u.rolle !== "mitarbeiter";
  const heute = new Date().toISOString().slice(0, 10);
  const zustand = (b: Beschaeftigter) =>
    b.austritt
      ? fuelle(b.austritt < heute ? x.personal.ausgeschieden : x.personal.endet, { datum: datumLang(b.austritt, s) })
      : fuelle(b.eintritt > heute ? x.personal.ab : x.personal.seit, { datum: datumLang(b.eintritt, s) });
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.personal.titel}</h1>
        <p className="mt-2">{x.personal.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.personal.lohn}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        <li><Link href="/personal/unterweisungen" className="block rounded-md border border-linie bg-blatt p-4 hover:border-amt"><span className="font-bold">{x.personal.unterweisungen}</span><span className="mt-1 block text-klein text-tinte-leise">{x.personal.unterweisungen_text}</span></Link></li>
        <li><Link href="/personal/zeiten" className="block rounded-md border border-linie bg-blatt p-4 hover:border-amt"><span className="font-bold">{x.personal.zeiten}</span><span className="mt-1 block text-klein text-tinte-leise">{x.personal.zeiten_text}</span></Link></li>
      </ul>

      {pfadSichtbar("/personal/gefaehrdungsbeurteilungen") ? (
      <section aria-labelledby="arbeitsschutz">
        <h2 id="arbeitsschutz" className="text-gross font-bold">{x.personal.arbeitsschutz}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {([["/personal/gefaehrdungsbeurteilungen", x.gb.titel, x.personal.gb_text], ["/personal/arbeitsmittel", x.arbeitsmittel.titel, x.personal.arbeitsmittel_text], ["/personal/gefahrstoffe", x.gefahrstoff.titel, x.personal.gefahrstoffe_text]] as const).map(([href, titel, text]) => (
            <li key={href}><Link href={href} className="block h-full rounded-md border border-linie bg-blatt p-4 hover:border-amt"><span className="font-bold">{titel}</span><span className="mt-1 block text-klein text-tinte-leise">{text}</span></Link></li>
          ))}
        </ul>
      </section>
      ) : null}

      <section aria-labelledby="team">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="team" className="text-gross font-bold">{x.personal.team}</h2>
          {darfSchreiben && liste.length ? <a href="/personal/export" className="verweis text-klein" title={x.personal.export_text}>{x.personal.export}</a> : null}
        </div>
        {liste.length ? (
          <ul className="mt-3 border-t border-linie">
            {liste.map((b) => (
              <li key={b.id} className={`space-y-2 border-b border-linie py-4 ${b.austritt && b.austritt < heute ? "text-tinte-leise" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><span className="font-bold">{b.vorname} {b.nachname}</span> · {x.personal.arten[b.art]}{b.wochenstunden ? ` · ${b.wochenstunden} h` : ""}</p>
                  <Link href={`/personal/${b.id}`} className="verweis text-klein">{x.personal.checkliste}</Link>
                </div>
                <p className="text-klein">{zustand(b)}</p>
                {darfSchreiben && !b.austritt ? (
                  <details>
                    <summary className="cursor-pointer text-klein text-tinte-leise">{x.personal.austritt_knopf}</summary>
                    <form action={austritt.bind(null, b.id)} className="mt-2 flex flex-wrap items-end gap-3">
                      <div>
                        <label htmlFor={`austritt-${b.id}`} className="block text-klein font-bold">{x.personal.austritt}</label>
                        <input id={`austritt-${b.id}`} name="datum" type="date" required min={b.eintritt} className="feld mt-1 w-auto" />
                      </div>
                      <button className="knopf knopf-leise">{x.personal.austritt_knopf}</button>
                    </form>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3">{x.personal.leer}</p>
        )}
      </section>

      {darfSchreiben ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.personal.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="vorname" className="block text-klein font-bold">{x.personal.vorname}</label><input id="vorname" name="vorname" required autoComplete="off" className="feld mt-1" /></div>
            <div><label htmlFor="nachname" className="block text-klein font-bold">{x.personal.nachname}</label><input id="nachname" name="nachname" required autoComplete="off" className="feld mt-1" /></div>
            <div>
              <label htmlFor="art" className="block text-klein font-bold">{x.personal.art}</label>
              <select id="art" name="art" required className="feld mt-1">{ARTEN.map((a) => <option key={a} value={a}>{x.personal.arten[a]}</option>)}</select>
            </div>
            <div><label htmlFor="eintritt" className="block text-klein font-bold">{x.personal.eintritt}</label><input id="eintritt" name="eintritt" type="date" required defaultValue={heute} className="feld mt-1" /></div>
            <div><label htmlFor="wochenstunden" className="block text-klein font-bold">{x.personal.wochenstunden}</label><input id="wochenstunden" name="wochenstunden" inputMode="decimal" className="feld mt-1" /></div>
            <div className="flex items-end"><button className="knopf">{x.personal.erfassen}</button></div>
          </form>
        </section>
      ) : null}

      {schwellen.schwellen.length ? (
        <section aria-labelledby="schwellen">
          <h2 id="schwellen" className="text-gross font-bold">{x.personal.schwellen_titel}</h2>
          <p className="mt-1">{x.personal.schwellen_text}</p>
          <p className="mt-1 text-klein text-tinte-leise">{fuelle(x.personal.schwellen_aktuell, { n: schwellen.aktuell })}</p>
          <ol className="mt-3 border-t border-linie">
            {schwellen.schwellen.map((sw) => (
              <li key={sw.ab} className="border-b border-linie py-3">
                <h3 className="font-bold">{fuelle(x.personal.schwelle_ab, { n: sw.ab })}</h3>
                {sw.neu.length + sw.zu_pruefen.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-klein">
                    {sw.neu.map((p) => <li key={p.pflicht_id}>{p.titel}</li>)}
                    {sw.zu_pruefen.map((p) => <li key={p.pflicht_id}>{p.titel} <span className="text-tinte-leise">({x.personal.zu_pruefen})</span></li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-klein text-tinte-leise">{x.personal.schwelle_nichts}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
