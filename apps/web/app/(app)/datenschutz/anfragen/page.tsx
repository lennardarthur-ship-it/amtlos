import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Anfragen Betroffener" };

const ARTEN = ["auskunft", "berichtigung", "loeschung", "einschraenkung", "uebertragbarkeit", "widerspruch", "sonstiges"] as const;
interface Anfrage { id: string; eingang_am: string; art: (typeof ARTEN)[number]; person: string; frist_am: string; notiz: string | null; erledigt_am: string | null; antwort: string | null; tage_uebrig: number }
const SEITE = "/datenschutz/anfragen";

async function erfassen(f: FormData) {
  "use server";
  await senden("/v1/betroffenenanfragen", "POST", {
    eingang_am: String(f.get("eingang_am") ?? ""), art: String(f.get("art") ?? ""), person: String(f.get("person") ?? ""), notiz: String(f.get("notiz") ?? "").trim() || null,
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function erledigen(id: string, f: FormData) {
  "use server";
  await senden(`/v1/betroffenenanfragen/${id}/erledigen`, "POST", { datum: String(f.get("datum") ?? ""), antwort: String(f.get("antwort") ?? "") }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function AnfragenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Anfrage[]>("/v1/betroffenenanfragen"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const heute = new Date().toISOString().slice(0, 10);
  const uhr = (a: Anfrage) => (a.tage_uebrig > 0 ? fuelle(x.anfrage.tage, { n: a.tage_uebrig }) : a.tage_uebrig === 0 ? x.anfrage.heute : fuelle(x.anfrage.ueberfaellig, { n: -a.tage_uebrig }));
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.anfrage.titel}</h1>
        <p className="mt-2">{x.anfrage.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((a) => (
            <li key={a.id} className={`space-y-1 border-b border-linie py-3 ${a.erledigt_am ? "text-tinte-leise" : ""}`}>
              <p><span className="font-bold">{x.anfrage.arten[a.art]}</span> · {a.person} · {datumLang(a.eingang_am, s)}</p>
              {a.erledigt_am ? (
                <p className="text-klein">{fuelle(x.anfrage.beantwortet, { datum: datumLang(a.erledigt_am, s) })}{a.antwort ? ` – ${a.antwort}` : ""}</p>
              ) : (
                <p className={`text-klein font-bold ${a.tage_uebrig < 0 ? "text-frist" : a.tage_uebrig <= 7 ? "text-bald" : ""}`}>
                  {fuelle(x.anfrage.frist, { datum: datumLang(a.frist_am, s) })} · {uhr(a)}
                </p>
              )}
              {a.notiz ? <p className="text-klein">{a.notiz}</p> : null}
              {darf && !a.erledigt_am ? (
                <details>
                  <summary className="cursor-pointer text-klein text-amt">{x.anfrage.erledigen}</summary>
                  <form action={erledigen.bind(null, a.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div><label htmlFor={`d-${a.id}`} className="block text-klein font-bold">{x.anfrage.datum}</label><input id={`d-${a.id}`} name="datum" type="date" required defaultValue={heute} className="feld mt-1" /></div>
                    <div><label htmlFor={`a-${a.id}`} className="block text-klein font-bold">{x.anfrage.antwort}</label><input id={`a-${a.id}`} name="antwort" required className="feld mt-1" /></div>
                    <div><button className="knopf knopf-leise">{x.anfrage.erledigen}</button></div>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.anfrage.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.anfrage.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="eingang_am" className="block text-klein font-bold">{x.anfrage.eingang}</label><input id="eingang_am" name="eingang_am" type="date" required defaultValue={heute} max={heute} className="feld mt-1" /></div>
            <div>
              <label htmlFor="art" className="block text-klein font-bold">{x.anfrage.art}</label>
              <select id="art" name="art" className="feld mt-1">{ARTEN.map((a) => <option key={a} value={a}>{x.anfrage.arten[a]}</option>)}</select>
            </div>
            <div><label htmlFor="person" className="block text-klein font-bold">{x.anfrage.person}</label><input id="person" name="person" required autoComplete="off" className="feld mt-1" /></div>
            <div><label htmlFor="notiz" className="block text-klein font-bold">{x.anfrage.notiz}</label><input id="notiz" name="notiz" className="feld mt-1" /></div>
            <div><button className="knopf">{x.anfrage.erfassen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
