import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, apiAntwort, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Dienstleister und AVV" };

interface Dienstleister { id: string; name: string; leistung: string; auftragsverarbeitung: boolean; avv_datum: string | null; avv_dokument_id: string | null; drittland: string; beendet_am: string | null; avv_fehlt: boolean }
const SEITE = "/datenschutz/dienstleister";

async function erfassen(f: FormData) {
  "use server";
  await senden("/v1/dienstleister", "POST", {
    name: String(f.get("name") ?? ""), leistung: String(f.get("leistung") ?? ""), auftragsverarbeitung: f.get("auftragsverarbeitung") === "on",
    avv_datum: String(f.get("avv_datum") ?? "") || null, drittland: String(f.get("drittland") ?? ""),
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function avvHochladen(id: string, f: FormData) {
  "use server";
  const datei = f.get("datei");
  if (!(datei instanceof File) || datei.size === 0) redirect(`${SEITE}?fehler=${encodeURIComponent("Datei fehlt")}`);
  const daten = new FormData();
  daten.set("datei", datei, datei.name);
  const r = await apiAntwort(`/v1/dienstleister/${id}/avv`, { method: "POST", body: daten });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { meldung?: string; message?: string };
    redirect(`${SEITE}?fehler=${encodeURIComponent(j.meldung ?? j.message ?? `Fehler ${r.status}`)}`);
  }
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function beenden(id: string) {
  "use server";
  await senden(`/v1/dienstleister/${id}/beenden`, "POST", { datum: new Date().toISOString().slice(0, 10) }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function DienstleisterSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Dienstleister[]>("/v1/dienstleister"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.dl.titel}</h1>
        <p className="mt-2">{x.dl.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((d) => (
            <li key={d.id} className={`space-y-1 border-b border-linie py-3 ${d.beendet_am ? "text-tinte-leise" : ""}`}>
              <p><span className="font-bold">{d.name}</span>{d.leistung ? ` · ${d.leistung}` : ""}{d.drittland ? ` · ${d.drittland}` : ""}</p>
              <p className="text-klein">
                {d.beendet_am ? fuelle(x.dl.beendet, { datum: datumLang(d.beendet_am, s) })
                  : !d.auftragsverarbeitung ? x.dl.keine_av
                  : d.avv_fehlt ? <span className="font-bold text-frist">{x.dl.avv_fehlt}</span>
                  : d.avv_datum ? fuelle(x.dl.avv_vom, { datum: datumLang(d.avv_datum, s) }) : null}
                {d.avv_dokument_id ? <> · <a href={`/finanzen/dokument/${d.avv_dokument_id}`} className="verweis">{x.dl.avv_datei}</a></> : null}
              </p>
              {darf && !d.beendet_am ? (
                <div className="flex flex-wrap items-end gap-4">
                  {d.auftragsverarbeitung && !d.avv_dokument_id ? (
                    <form action={avvHochladen.bind(null, d.id)} className="flex flex-wrap items-end gap-2">
                      <div>
                        <label htmlFor={`avv-${d.id}`} className="block text-klein font-bold">{x.dl.avv_hochladen}</label>
                        <input id={`avv-${d.id}`} name="datei" type="file" accept="application/pdf" required className="mt-1 text-klein" />
                      </div>
                      <button className="knopf knopf-leise">{x.dl.hochladen}</button>
                    </form>
                  ) : null}
                  <form action={beenden.bind(null, d.id)}><button className="text-klein text-tinte-leise underline">{x.dl.beenden}</button></form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.dl.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.dl.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="name" className="block text-klein font-bold">{x.dl.name}</label><input id="name" name="name" required className="feld mt-1" /></div>
            <div><label htmlFor="leistung" className="block text-klein font-bold">{x.dl.leistung}</label><input id="leistung" name="leistung" className="feld mt-1" /></div>
            <div><label htmlFor="avv_datum" className="block text-klein font-bold">{x.dl.avv_datum}</label><input id="avv_datum" name="avv_datum" type="date" className="feld mt-1" /></div>
            <div><label htmlFor="drittland" className="block text-klein font-bold">{x.dl.drittland}</label><input id="drittland" name="drittland" className="feld mt-1" /></div>
            <label className="flex items-center gap-3 sm:col-span-2"><input type="checkbox" name="auftragsverarbeitung" defaultChecked className="size-5 accent-amt" /> {x.dl.auftragsverarbeitung}</label>
            <div><button className="knopf">{x.dl.erfassen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
