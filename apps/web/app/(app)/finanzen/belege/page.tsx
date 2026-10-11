import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { EingabeFehler, api, apiAntwort } from "@/lib/api";
import { centAus, euroFeld, euroText } from "@/lib/geld";
import { t } from "@/lib/sprache";

export const metadata = { title: "Belege" };

interface Beleg {
  id: string; dokument_id: string; belegdatum: string | null; lieferant: string | null; belegnummer: string | null; brutto_cent: number | null; ust_cent: number | null;
  quelle: string; storniert: boolean; datei_titel: string;
}

async function hochladen(f: FormData) {
  "use server";
  const datei = f.get("datei");
  if (!(datei instanceof File) || datei.size === 0) redirect("/finanzen/belege?fehler=datei");
  const form = new FormData();
  form.set("datei", datei, datei.name);
  const r = await apiAntwort("/v1/belege", { method: "POST", body: form });
  if (r.status === 409) redirect("/finanzen/belege?fehler=doppelt");
  if (r.status === 422 || r.status === 413 || r.status === 400) {
    const b = (await r.json().catch(() => ({}))) as { fehler?: { meldung: string }[]; message?: string };
    redirect(`/finanzen/belege?fehler=falsch&grund=${encodeURIComponent(b.fehler?.[0]?.meldung ?? b.message ?? String(r.status))}`);
  }
  if (!r.ok) throw new Error(`Beleg hochladen: ${r.status}`);
  revalidatePath("/finanzen/belege");
  redirect("/finanzen/belege?ok=1");
}

async function speichern(id: string, f: FormData) {
  "use server";
  const { s } = await t();
  const text = (k: string) => String(f.get(k) ?? "").trim() || null;
  const brutto = centAus(f.get("brutto"), s);
  const ust = centAus(f.get("ust"), s);
  try {
    await api(`/v1/belege/${id}`, {
      method: "PUT",
      body: JSON.stringify({ belegdatum: text("belegdatum"), lieferant: text("lieferant"), belegnummer: text("belegnummer"), brutto_cent: brutto, ust_cent: ust }),
    });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/belege?fehler=falsch&grund=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/finanzen/belege");
}

async function stornieren(id: string) {
  "use server";
  await api(`/v1/belege/${id}/stornieren`, { method: "POST" });
  revalidatePath("/finanzen/belege");
}

export default async function BelegeSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; grund?: string; ok?: string }> }) {
  const [{ s, t: x }, belege, sp] = await Promise.all([t(), api<Beleg[]>("/v1/belege"), searchParams]);
  const meldung = sp.fehler === "doppelt" ? x.beleg.doppelt : sp.fehler ? fuelle(x.beleg.falsch, { grund: sp.grund ?? "" }) : null;
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/finanzen" className="verweis">{x.finanzen.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.finanzen.belege}</h1>
        <p className="mt-2 text-klein text-tinte-leise">{x.beleg.gobd}</p>
      </header>
      {meldung ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{meldung}</p> : null}
      {sp.ok ? <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">{x.beleg.gespeichert}</p> : null}

      <form action={hochladen} className="space-y-3 rounded-md border border-linie bg-blatt p-4">
        <label htmlFor="datei" className="block font-bold">{x.beleg.datei}</label>
        <input id="datei" name="datei" type="file" required accept="application/pdf,image/jpeg,image/png,.xml,application/xml,text/xml" capture="environment" className="block w-full" />
        <button className="knopf">{x.beleg.knopf}</button>
      </form>

      {belege.length ? (
        <ul className="space-y-4">
          {belege.map((b) => (
            <li key={b.id} className={`rounded-md border border-linie p-4 ${b.storniert ? "bg-blatt" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  {b.lieferant ?? b.datei_titel}
                  {b.storniert ? <span className="ml-2 font-normal text-tinte-leise">({x.beleg.storniert})</span> : null}
                </p>
                <p className="text-klein text-tinte-leise">
                  {[b.belegdatum ? datumLang(b.belegdatum, s) : null, b.brutto_cent !== null ? euroText(b.brutto_cent, s) : null, b.quelle === "e_rechnung" ? x.beleg.e_rechnung : null].filter(Boolean).join(" · ")}
                  {" · "}<a href={`/finanzen/dokument/${b.dokument_id}`} className="verweis">{x.beleg.ansehen}</a>
                </p>
              </div>
              {b.storniert ? null : (
                <>
                  <form action={speichern.bind(null, b.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                    {([
                      ["belegdatum", x.beleg.datum, b.belegdatum ?? "", "date"],
                      ["lieferant", x.beleg.lieferant, b.lieferant ?? "", "text"],
                      ["belegnummer", x.beleg.nummer, b.belegnummer ?? "", "text"],
                      ["brutto", x.beleg.brutto, euroFeld(b.brutto_cent, s), "text"],
                      ["ust", x.beleg.ust, euroFeld(b.ust_cent, s), "text"],
                    ] as const).map(([k, label, wert, typ]) => (
                      <div key={k}>
                        <label htmlFor={`${k}-${b.id}`} className="block text-klein font-bold">{label}</label>
                        <input id={`${k}-${b.id}`} name={k} type={typ} defaultValue={wert} inputMode={k === "brutto" || k === "ust" ? "decimal" : undefined} className="feld mt-1" />
                      </div>
                    ))}
                    <div className="flex items-end">
                      <button className="knopf knopf-leise">{x.beleg.speichern}</button>
                    </div>
                  </form>
                  <form action={stornieren.bind(null, b.id)} className="mt-2">
                    <button className="text-klein underline">{x.beleg.stornieren}</button>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.beleg.leer}</p>
      )}
    </div>
  );
}
