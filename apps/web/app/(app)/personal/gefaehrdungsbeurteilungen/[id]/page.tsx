import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Gefährdungsbeurteilung" };

const FAKTOREN = ["arbeitsstaette", "einwirkungen", "arbeitsmittel", "ablaeufe_arbeitszeit", "qualifikation", "psychisch", "sonstiges"] as const;
const RISIKEN = ["gering", "mittel", "hoch"] as const;
interface Gefaehrdung { id: string; faktor: (typeof FAKTOREN)[number]; beschreibung: string; risiko: (typeof RISIKEN)[number]; massnahme: string; verantwortlich: string | null; umsetzen_bis: string | null; umgesetzt_am: string | null; wirksam_geprueft_am: string | null; wirksamkeit_notiz: string | null }
interface Detail { id: string; arbeitsbereich: string; taetigkeiten: string; beurteilt_von: string; datum: string; mutterschutz: boolean; abgeschlossen_am: string | null; dokument_id: string | null; gefaehrdungen: Gefaehrdung[] }

const seite = (id: string) => `/personal/gefaehrdungsbeurteilungen/${id}`;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const datumOderNull = (f: FormData, k: string) => text(f, k) || null;

async function gefaehrdungErfassen(id: string, f: FormData) {
  "use server";
  await senden(`/v1/gefaehrdungsbeurteilungen/${id}/gefaehrdungen`, "POST", {
    faktor: text(f, "faktor"), beschreibung: text(f, "beschreibung"), risiko: text(f, "risiko"), massnahme: text(f, "massnahme"),
    verantwortlich: text(f, "verantwortlich") || null, umsetzen_bis: datumOderNull(f, "umsetzen_bis"),
  }, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

async function gefaehrdungLoeschen(id: string, gid: string) {
  "use server";
  await senden(`/v1/gefaehrdungen/${gid}`, "DELETE", undefined, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

async function umsetzung(id: string, gid: string, f: FormData) {
  "use server";
  await senden(`/v1/gefaehrdungen/${gid}/umsetzung`, "POST", {
    umgesetzt_am: datumOderNull(f, "umgesetzt_am"), wirksam_geprueft_am: datumOderNull(f, "wirksam_geprueft_am"), wirksamkeit_notiz: text(f, "wirksamkeit_notiz") || null,
  }, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

async function abschliessen(id: string) {
  "use server";
  const r = await senden<{ erledigte_pflichten: number }>(`/v1/gefaehrdungsbeurteilungen/${id}/abschliessen`, "POST", undefined, seite(id));
  revalidatePath(seite(id));
  redirect(`${seite(id)}?erledigt=${r.erledigte_pflichten}`);
}

async function loeschen(id: string) {
  "use server";
  await senden(`/v1/gefaehrdungsbeurteilungen/${id}`, "DELETE", undefined, seite(id));
  redirect("/personal/gefaehrdungsbeurteilungen");
}

export default async function BeurteilungSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; erledigt?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ s, t: x }, b, sp, u] = await Promise.all([t(), api<Detail>(`/v1/gefaehrdungsbeurteilungen/${id}`), searchParams, aktivesUnternehmen()]);
  const offen = !b.abgeschlossen_am;
  const darf = u.rolle !== "mitarbeiter";
  const heute = new Date().toISOString().slice(0, 10);
  const gruppen = FAKTOREN.map((f) => [f, b.gefaehrdungen.filter((g) => g.faktor === f)] as const).filter(([, l]) => l.length);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/personal/gefaehrdungsbeurteilungen" className="verweis">{x.gb.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{b.arbeitsbereich}</h1>
        <p className="mt-1 text-klein text-tinte-leise">
          {datumLang(b.datum, s)} · {b.beurteilt_von}{b.mutterschutz ? ` · ${x.gb.mutterschutz_ja}` : ""}
        </p>
        {b.taetigkeiten ? <p className="mt-2 whitespace-pre-wrap">{b.taetigkeiten}</p> : null}
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {sp.erledigt ? <p role="status" className="rounded-md border-2 border-amt bg-amt-hauch p-4">{fuelle(x.gb.erledigt, { n: sp.erledigt })}</p> : null}
      {b.abgeschlossen_am ? (
        <p>
          {fuelle(x.gb.abgeschlossen, { datum: datumLang(b.abgeschlossen_am.slice(0, 10), s) })}
          {b.dokument_id ? <> · <a href={`/finanzen/dokument/${b.dokument_id}`} className="verweis">{x.gb.pdf}</a></> : null}
        </p>
      ) : null}

      <section aria-labelledby="gefaehrdungen">
        <h2 id="gefaehrdungen" className="text-gross font-bold">{x.gb.gefaehrdungen}</h2>
        {gruppen.length ? (
          gruppen.map(([faktor, liste]) => (
            <div key={faktor} className="mt-4">
              <h3 className="font-bold">{x.gb.faktoren[faktor]}</h3>
              <ul className="mt-2 border-t border-linie">
                {liste.map((g) => (
                  <li key={g.id} className="space-y-1 border-b border-linie py-3">
                    <p><span className="font-bold">{g.beschreibung}</span> <span className={`text-klein ${g.risiko === "hoch" ? "font-bold text-frist" : "text-tinte-leise"}`}>· {x.gb.risiko}: {x.gb.risiken[g.risiko]}</span></p>
                    <p>{x.gb.massnahme}: {g.massnahme}</p>
                    <p className="text-klein text-tinte-leise">
                      {[g.verantwortlich, g.umsetzen_bis ? fuelle(x.gb.bis, { datum: datumLang(g.umsetzen_bis, s) }) : null].filter(Boolean).join(" · ")}
                      {g.verantwortlich || g.umsetzen_bis ? " · " : ""}
                      <span className={!g.umgesetzt_am && g.umsetzen_bis && g.umsetzen_bis < heute ? "font-bold text-frist" : ""}>
                        {g.umgesetzt_am ? fuelle(x.gb.umgesetzt, { datum: datumLang(g.umgesetzt_am, s) }) : x.gb.offen}
                      </span>
                    </p>
                    {g.wirksamkeit_notiz ? <p className="text-klein">{x.gb.wirksamkeit_notiz}: {g.wirksamkeit_notiz}</p> : null}
                    {darf ? (
                      <details>
                        <summary className="cursor-pointer text-klein text-amt">{x.gb.umsetzung_speichern}</summary>
                        <form action={umsetzung.bind(null, id, g.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div><label htmlFor={`u-${g.id}`} className="block text-klein font-bold">{x.gb.umgesetzt_am}</label><input id={`u-${g.id}`} name="umgesetzt_am" type="date" defaultValue={g.umgesetzt_am ?? ""} className="feld mt-1" /></div>
                          <div><label htmlFor={`w-${g.id}`} className="block text-klein font-bold">{x.gb.wirksam_geprueft_am}</label><input id={`w-${g.id}`} name="wirksam_geprueft_am" type="date" defaultValue={g.wirksam_geprueft_am ?? ""} className="feld mt-1" /></div>
                          <div className="sm:col-span-2"><label htmlFor={`n-${g.id}`} className="block text-klein font-bold">{x.gb.wirksamkeit_notiz}</label><input id={`n-${g.id}`} name="wirksamkeit_notiz" defaultValue={g.wirksamkeit_notiz ?? ""} className="feld mt-1" /></div>
                          <div><button className="knopf knopf-leise">{x.gb.umsetzung_speichern}</button></div>
                        </form>
                      </details>
                    ) : null}
                    {darf && offen ? (
                      <form action={gefaehrdungLoeschen.bind(null, id, g.id)}><button className="text-klein text-tinte-leise underline">{x.gb.loeschen}</button></form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="mt-2">{x.gb.keine_gefaehrdungen}</p>
        )}
      </section>

      {darf && offen ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.gb.neue_gefaehrdung}</h2>
          <form action={gefaehrdungErfassen.bind(null, id)} className="mt-3 space-y-3">
            <div>
              <label htmlFor="faktor" className="block text-klein font-bold">{x.gb.faktor}</label>
              <select id="faktor" name="faktor" required className="feld mt-1">{FAKTOREN.map((f) => <option key={f} value={f}>{x.gb.faktoren[f]}</option>)}</select>
            </div>
            <div><label htmlFor="beschreibung" className="block text-klein font-bold">{x.gb.beschreibung}</label><input id="beschreibung" name="beschreibung" required maxLength={2000} className="feld mt-1" /></div>
            <fieldset>
              <legend className="text-klein font-bold">{x.gb.risiko}</legend>
              <div className="mt-1 flex flex-wrap gap-4">
                {RISIKEN.map((r) => (
                  <label key={r} className="flex min-h-11 items-center gap-2"><input type="radio" name="risiko" value={r} required className="size-5 accent-amt" /> {x.gb.risiken[r]}</label>
                ))}
              </div>
            </fieldset>
            <div><label htmlFor="massnahme" className="block text-klein font-bold">{x.gb.massnahme}</label><textarea id="massnahme" name="massnahme" required rows={2} maxLength={2000} className="feld mt-1" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="verantwortlich" className="block text-klein font-bold">{x.gb.verantwortlich}</label><input id="verantwortlich" name="verantwortlich" className="feld mt-1" /></div>
              <div><label htmlFor="umsetzen_bis" className="block text-klein font-bold">{x.gb.umsetzen_bis}</label><input id="umsetzen_bis" name="umsetzen_bis" type="date" className="feld mt-1" /></div>
            </div>
            <button className="knopf">{x.gb.erfassen}</button>
          </form>
        </section>
      ) : null}

      {darf && offen ? (
        <section className="space-y-3">
          <p className="text-klein">{x.gb.abschliessen_text}</p>
          <div className="flex flex-wrap gap-3">
            {b.gefaehrdungen.length ? <form action={abschliessen.bind(null, id)}><button className="knopf">{x.gb.abschliessen}</button></form> : null}
            <form action={loeschen.bind(null, id)}><button className="knopf knopf-leise">{x.gb.entwurf_loeschen}</button></form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
