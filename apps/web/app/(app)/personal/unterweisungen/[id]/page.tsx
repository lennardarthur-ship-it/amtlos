import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Beschaeftigter } from "../../page";

export const metadata = { title: "Unterweisung" };

interface Detail {
  id: string; art: string; thema: string; inhalt: string; datum: string; durchgefuehrt_von: string; abgeschlossen_am: string | null; dokument_id: string | null; inhalt_sha256: string;
  teilnahmen: { beschaeftigter_id: string; vorname: string; nachname: string; bestaetigt_am: string; name_bestaetigt: string }[];
}

async function bestaetigen(id: string, f: FormData) {
  "use server";
  const zurueck = `/personal/unterweisungen/${id}`;
  await senden(`/v1/unterweisungen/${id}/bestaetigen`, "POST", { beschaeftigter_id: String(f.get("beschaeftigter_id") ?? ""), name: String(f.get("name") ?? "") }, zurueck);
  revalidatePath(zurueck);
  redirect(zurueck);
}

async function abschliessen(id: string) {
  "use server";
  const zurueck = `/personal/unterweisungen/${id}`;
  const r = await senden<{ erledigte_pflichten: number }>(`/v1/unterweisungen/${id}/abschliessen`, "POST", undefined, zurueck);
  revalidatePath(zurueck);
  redirect(`${zurueck}?erledigt=${r.erledigte_pflichten}`);
}

async function loeschen(id: string) {
  "use server";
  await senden(`/v1/unterweisungen/${id}`, "DELETE", undefined, `/personal/unterweisungen/${id}`);
  redirect("/personal/unterweisungen");
}


export default async function UnterweisungSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; erledigt?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ s, t: x }, w, personen, sp, u] = await Promise.all([t(), api<Detail>(`/v1/unterweisungen/${id}`), api<Beschaeftigter[]>("/v1/beschaeftigte"), searchParams, aktivesUnternehmen()]);
  const heute = new Date().toISOString().slice(0, 10);
  const bestaetigt = new Set(w.teilnahmen.map((p) => p.beschaeftigter_id));
  const offen = personen.filter((p) => !bestaetigt.has(p.id) && (!p.austritt || p.austritt >= heute));
  const darfSchreiben = u.rolle !== "mitarbeiter";
  const zeit = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href={`/personal/unterweisungen?art=${w.art}`} className="verweis">{w.art === "ki_kompetenz" ? x.schulung.titel : w.art === "ifsg" ? x.ifsg.titel : x.unterweisung.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{w.thema}</h1>
        <p className="mt-1 text-klein text-tinte-leise">{datumLang(w.datum, s)} · {w.durchgefuehrt_von}</p>
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {sp.erledigt ? <p role="status" className="rounded-md border-2 border-erfolg bg-erfolg-hauch p-4">{fuelle(x.unterweisung.erledigt, { n: sp.erledigt })}</p> : null}

      <section aria-label={x.unterweisung.inhalt} className="whitespace-pre-wrap rounded-md border border-linie bg-blatt p-4">{w.inhalt}</section>

      {w.abgeschlossen_am ? (
        <p>
          {fuelle(x.unterweisung.abgeschlossen, { datum: datumLang(w.abgeschlossen_am.slice(0, 10), s) })}
          {w.dokument_id ? <> · <a href={`/finanzen/dokument/${w.dokument_id}`} className="verweis">{x.unterweisung.protokoll}</a></> : null}
        </p>
      ) : (
        <section aria-labelledby="bestaetigen" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="bestaetigen" className="font-bold">{x.unterweisung.bestaetigen_titel}</h2>
          <p className="mt-1 text-klein">{x.unterweisung.bestaetigen_text}</p>
          {offen.length ? (
            <form action={bestaetigen.bind(null, id)} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="beschaeftigter_id" className="block text-klein font-bold">{x.unterweisung.person}</label>
                <select id="beschaeftigter_id" name="beschaeftigter_id" required className="feld mt-1">{offen.map((p) => <option key={p.id} value={p.id}>{p.vorname} {p.nachname}</option>)}</select>
              </div>
              <div><label htmlFor="name" className="block text-klein font-bold">{x.unterweisung.name}</label><input id="name" name="name" required autoComplete="off" className="feld mt-1" /></div>
              <div><button className="knopf">{x.unterweisung.bestaetigen_knopf}</button></div>
            </form>
          ) : (
            <p className="mt-3 text-klein">{personen.length ? x.unterweisung.alle_bestaetigt : x.zeit.keine_personen}</p>
          )}
        </section>
      )}

      <section aria-labelledby="teilnahmen">
        <h2 id="teilnahmen" className="text-gross font-bold">{x.unterweisung.teilnahmen}</h2>
        {w.teilnahmen.length ? (
          <ul className="mt-2 border-t border-linie">
            {w.teilnahmen.map((p) => (
              <li key={p.beschaeftigter_id} className="border-b border-linie py-2">
                <span className="font-bold">{p.vorname} {p.nachname}</span> <span className="text-klein text-tinte-leise">· „{p.name_bestaetigt}“ · {zeit(p.bestaetigt_am)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">{x.unterweisung.keine_teilnahmen}</p>
        )}
      </section>

      {darfSchreiben && !w.abgeschlossen_am ? (
        <section className="space-y-3">
          <p className="text-klein">{x.unterweisung.abschliessen_text}</p>
          <div className="flex flex-wrap gap-3">
            {w.teilnahmen.length ? <form action={abschliessen.bind(null, id)}><button className="knopf">{x.unterweisung.abschliessen}</button></form> : null}
            {!w.teilnahmen.length ? <form action={loeschen.bind(null, id)}><button className="knopf knopf-leise">{x.unterweisung.loeschen}</button></form> : null}
          </div>
        </section>
      ) : null}

      <p className="break-all text-klein text-tinte-leise">{x.unterweisung.pruefwert}: {w.inhalt_sha256}</p>
    </div>
  );
}
