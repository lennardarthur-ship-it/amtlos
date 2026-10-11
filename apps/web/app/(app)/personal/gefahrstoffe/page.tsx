import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, apiAntwort, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Gefahrstoffe" };

interface Stoff { id: string; bezeichnung: string; hersteller: string | null; verwendung: string | null; arbeitsbereich: string | null; menge: string | null; sdb_dokument_id: string | null; sdb_stand: string | null; entfernt_am: string | null }
const SEITE = "/personal/gefahrstoffe";
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function erfassen(f: FormData) {
  "use server";
  await senden("/v1/gefahrstoffe", "POST", {
    bezeichnung: text(f, "bezeichnung"), hersteller: text(f, "hersteller") || null, verwendung: text(f, "verwendung") || null,
    arbeitsbereich: text(f, "arbeitsbereich") || null, menge: text(f, "menge") || null, sdb_stand: text(f, "sdb_stand") || null,
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function sdbHochladen(id: string, f: FormData) {
  "use server";
  const datei = f.get("datei");
  if (!(datei instanceof File) || datei.size === 0) redirect(`${SEITE}?fehler=${encodeURIComponent("Datei fehlt")}`);
  const daten = new FormData();
  daten.set("datei", datei, datei.name);
  const r = await apiAntwort(`/v1/gefahrstoffe/${id}/sicherheitsdatenblatt`, { method: "POST", body: daten });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { meldung?: string; message?: string };
    redirect(`${SEITE}?fehler=${encodeURIComponent(j.meldung ?? j.message ?? `Fehler ${r.status}`)}`);
  }
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function entfernen(id: string) {
  "use server";
  await senden(`/v1/gefahrstoffe/${id}/entfernen`, "POST", { datum: new Date().toISOString().slice(0, 10) }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function GefahrstoffeSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Stoff[]>("/v1/gefahrstoffe"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const felder = [["bezeichnung", x.gefahrstoff.bezeichnung, true], ["hersteller", x.gefahrstoff.hersteller, false], ["verwendung", x.gefahrstoff.verwendung, false], ["arbeitsbereich", x.gefahrstoff.arbeitsbereich, false], ["menge", x.gefahrstoff.menge, false]] as const;
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/personal" className="verweis">{x.personal.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.gefahrstoff.titel}</h1>
        <p className="mt-2">{x.gefahrstoff.text}</p>
        {liste.some((g) => !g.entfernt_am) ? <p className="mt-2"><a href={`${SEITE}/verzeichnis`} className="verweis">{x.gefahrstoff.verzeichnis}</a></p> : null}
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((g) => (
            <li key={g.id} className={`space-y-1 border-b border-linie py-3 ${g.entfernt_am ? "text-tinte-leise" : ""}`}>
              <p className="font-bold">{g.bezeichnung}</p>
              <p className="text-klein">{[g.hersteller, g.verwendung, g.arbeitsbereich, g.menge].filter(Boolean).join(" · ")}</p>
              <p className="text-klein">
                {g.entfernt_am ? fuelle(x.gefahrstoff.entfernt, { datum: datumLang(g.entfernt_am, s) }) : g.sdb_dokument_id ? (
                  <a href={`/finanzen/dokument/${g.sdb_dokument_id}`} className="verweis">{x.gefahrstoff.sdb}{g.sdb_stand ? ` (${datumLang(g.sdb_stand, s)})` : ""}</a>
                ) : (
                  <span className="font-bold text-frist">{x.gefahrstoff.sdb_fehlt}</span>
                )}
              </p>
              {darf && !g.entfernt_am ? (
                <div className="flex flex-wrap items-end gap-4">
                  <form action={sdbHochladen.bind(null, g.id)} className="flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor={`sdb-${g.id}`} className="block text-klein font-bold">{x.gefahrstoff.sdb_hochladen}</label>
                      <input id={`sdb-${g.id}`} name="datei" type="file" accept="application/pdf" required className="mt-1 text-klein" />
                    </div>
                    <button className="knopf knopf-leise">{x.gefahrstoff.hochladen}</button>
                  </form>
                  <form action={entfernen.bind(null, g.id)}><button className="text-klein text-tinte-leise underline">{x.gefahrstoff.entfernen}</button></form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.gefahrstoff.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.gefahrstoff.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            {felder.map(([k, label, pflicht]) => (
              <div key={k}><label htmlFor={k} className="block text-klein font-bold">{label}</label><input id={k} name={k} required={pflicht} className="feld mt-1" /></div>
            ))}
            <div><label htmlFor="sdb_stand" className="block text-klein font-bold">{x.gefahrstoff.sdb_stand}</label><input id="sdb_stand" name="sdb_stand" type="date" className="feld mt-1" /></div>
            <div className="flex items-end"><button className="knopf">{x.gefahrstoff.erfassen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
