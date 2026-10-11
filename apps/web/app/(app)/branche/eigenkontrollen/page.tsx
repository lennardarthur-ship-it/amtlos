import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import { aktuellerMonat } from "@/lib/zeit";

export const metadata = { title: "Eigenkontrollen" };

interface Messpunkt { id: string; bezeichnung: string; einheit: string; grenze_min: number | null; grenze_max: number | null; aktiv: boolean; letzte_messung: string | null; letzter_wert: number | null; letzte_in_ordnung: boolean | null; heute: number }
interface Monat { monat: string; abweichungen: number; messungen: { id: string; gemessen_am: string; messpunkt: string; einheit: string; wert: number; in_ordnung: boolean; massnahme: string | null }[] }
const SEITE = "/branche/eigenkontrollen";
const zahl = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? null : Number(s);
};

async function anlegen(f: FormData) {
  "use server";
  await senden("/v1/messpunkte", "POST", { bezeichnung: String(f.get("bezeichnung") ?? ""), einheit: String(f.get("einheit") ?? "°C"), grenze_min: zahl(f.get("grenze_min")), grenze_max: zahl(f.get("grenze_max")) }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function messen(id: string, f: FormData) {
  "use server";
  const massnahme = String(f.get("massnahme") ?? "").trim();
  await senden(`/v1/messpunkte/${id}/messungen`, "POST", { wert: zahl(f.get("wert")), ...(massnahme ? { massnahme } : {}) }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function stilllegen(m: Messpunkt) {
  "use server";
  await senden(`/v1/messpunkte/${m.id}`, "PUT", { bezeichnung: m.bezeichnung, einheit: m.einheit, grenze_min: m.grenze_min, grenze_max: m.grenze_max, aktiv: false }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function EigenkontrollenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const monat = aktuellerMonat();
  const [{ s, t: x }, punkte, m, { fehler }, u] = await Promise.all([t(), api<Messpunkt[]>("/v1/messpunkte"), api<Monat>(`/v1/eigenkontrollen?monat=${monat}`), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const zeit = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const einheit = (e: string) => (e === "sonstige" ? "" : ` ${e}`);
  const zahlText = (n: number) => new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(n);
  const grenzen = (p: Messpunkt) =>
    p.grenze_min === null && p.grenze_max === null ? x.ek.keine_grenzen : [p.grenze_min !== null ? `≥ ${zahlText(p.grenze_min)}` : null, p.grenze_max !== null ? `≤ ${zahlText(p.grenze_max)}` : null].filter(Boolean).join(" · ") + einheit(p.einheit);
  const monatName = new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monat}-01T00:00:00Z`));
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/branche" className="verweis">{x.branche.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.ek.titel}</h1>
        <p className="mt-2">{x.ek.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {punkte.length ? (
        <ul className="border-t border-linie">
          {punkte.map((p) => (
            <li key={p.id} className={`space-y-2 border-b border-linie py-3 ${p.aktiv ? "" : "text-tinte-leise"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p><span className="font-bold">{p.bezeichnung}</span> <span className="text-klein text-tinte-leise">· {fuelle(x.ek.grenzen, { grenzen: grenzen(p) })}{p.aktiv ? "" : ` · ${x.ek.inaktiv}`}</span></p>
                {p.aktiv ? <span className="text-klein text-tinte-leise">{fuelle(x.ek.heute, { n: p.heute })}</span> : null}
              </div>
              <p className={`text-klein ${p.letzte_in_ordnung === false ? "font-bold text-frist" : ""}`}>
                {p.letzte_messung && p.letzter_wert !== null ? fuelle(x.ek.letzte, { wert: `${zahlText(p.letzter_wert)}${einheit(p.einheit)}`, zeit: zeit(p.letzte_messung) }) + (p.letzte_in_ordnung === false ? ` · ${x.ek.abweichung}` : "") : x.ek.nie}
              </p>
              {p.aktiv ? (
                <form action={messen.bind(null, p.id)} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
                  <div><label htmlFor={`w-${p.id}`} className="block text-klein font-bold">{x.ek.wert}</label><input id={`w-${p.id}`} name="wert" inputMode="decimal" required className="feld mt-1" /></div>
                  <div><label htmlFor={`m-${p.id}`} className="block text-klein font-bold">{x.ek.massnahme}</label><input id={`m-${p.id}`} name="massnahme" className="feld mt-1" /></div>
                  <div><button className="knopf">{x.ek.messen}</button></div>
                </form>
              ) : null}
              {darf && p.aktiv ? <form action={stilllegen.bind(null, p)}><button className="text-klein text-tinte-leise underline">{x.ek.stilllegen}</button></form> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.ek.leer}</p>
      )}

      <section aria-labelledby="monat">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="monat" className="text-gross font-bold">{fuelle(x.ek.monat, { monat: monatName })}</h2>
          {m.messungen.length ? <a href={`${SEITE}/protokoll?monat=${monat}`} className="verweis text-klein">{x.ek.protokoll}</a> : null}
        </div>
        {m.abweichungen ? <p className="text-klein font-bold text-frist">{fuelle(x.ek.abweichungen, { n: m.abweichungen })}</p> : null}
        {m.messungen.length ? (
          <ul className="mt-2 border-t border-linie text-klein">
            {[...m.messungen].reverse().slice(0, 50).map((z) => (
              <li key={z.id} className="flex flex-wrap gap-x-3 border-b border-linie py-2">
                <span className="text-tinte-leise">{zeit(z.gemessen_am)}</span>
                <span>{z.messpunkt}</span>
                <span className={z.in_ordnung ? "" : "font-bold text-frist"}>{zahlText(z.wert)}{einheit(z.einheit)}</span>
                {z.massnahme ? <span className="basis-full">{z.massnahme}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">{x.ek.keine_messungen}</p>
        )}
      </section>

      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.ek.neu}</h2>
          <form action={anlegen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="bezeichnung" className="block text-klein font-bold">{x.ek.bezeichnung}</label><input id="bezeichnung" name="bezeichnung" required className="feld mt-1" /></div>
            <div>
              <label htmlFor="einheit" className="block text-klein font-bold">{x.ek.einheit}</label>
              <select id="einheit" name="einheit" className="feld mt-1">{["°C", "%", "pH", "sonstige"].map((e) => <option key={e} value={e}>{e}</option>)}</select>
            </div>
            <div><label htmlFor="grenze_min" className="block text-klein font-bold">{x.ek.min}</label><input id="grenze_min" name="grenze_min" inputMode="decimal" className="feld mt-1" /></div>
            <div><label htmlFor="grenze_max" className="block text-klein font-bold">{x.ek.max}</label><input id="grenze_max" name="grenze_max" inputMode="decimal" className="feld mt-1" /></div>
            <div><button className="knopf">{x.ek.anlegen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
