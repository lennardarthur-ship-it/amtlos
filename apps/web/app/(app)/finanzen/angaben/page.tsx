import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EingabeFehler, api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Angaben auf Rechnungen" };

interface Steller { name?: string; strasse?: string; plz?: string; ort?: string; email?: string; telefon?: string | null; steuernummer?: string | null; ust_idnr?: string | null; iban?: string | null; bic?: string | null }
interface Kunde { id: string; name: string; ort: string | null; email: string | null; geschaeftskunde: boolean }

const feld = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function stellerSpeichern(f: FormData) {
  "use server";
  const daten = Object.fromEntries(["name", "strasse", "plz", "ort", "email", "telefon", "steuernummer", "ust_idnr", "iban", "bic"].map((k) => [k, feld(f, k)]));
  try {
    await api("/v1/rechnungssteller", { method: "PUT", body: JSON.stringify(daten) });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/angaben?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/finanzen/angaben");
  redirect("/finanzen/angaben?ok=1");
}

async function kundeAnlegen(f: FormData) {
  "use server";
  const daten = { ...Object.fromEntries(["name", "strasse", "plz", "ort", "email", "ust_idnr", "kaeufer_referenz"].map((k) => [k, feld(f, `k_${k}`)])), geschaeftskunde: f.get("geschaeftskunde") === "ja" };
  try {
    await api("/v1/kunden", { method: "POST", body: JSON.stringify(daten) });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/angaben?fehler=${encodeURIComponent(e.message)}#kunden`);
    throw e;
  }
  revalidatePath("/finanzen/angaben");
  redirect("/finanzen/angaben#kunden");
}

function Eingabe({ id, label, wert, pflicht, typ = "text", auto }: { id: string; label: string; wert?: string | null; pflicht?: boolean; typ?: string; auto?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold">{label}</label>
      <input id={id} name={id} type={typ} required={pflicht} defaultValue={wert ?? ""} autoComplete={auto} className="feld mt-1" />
    </div>
  );
}

export default async function AngabenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [{ t: x }, steller, kunden, { fehler, ok }] = await Promise.all([t(), api<Steller | null>("/v1/rechnungssteller"), api<Kunde[]>("/v1/kunden"), searchParams]);
  const st: Steller = steller ?? {};
  return (
    <div className="lesetext space-y-10">
      <p className="text-klein"><Link href="/finanzen" className="verweis">{x.finanzen.zurueck}</Link></p>
      <section aria-labelledby="steller" className="space-y-4">
        <h1 id="steller" className="text-titel font-bold">{x.angaben.titel}</h1>
        <p>{x.angaben.text}</p>
        {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
        {ok ? <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">{x.angaben.gespeichert}</p> : null}
        <form action={stellerSpeichern} className="space-y-4">
          <Eingabe id="name" label={x.angaben.name} wert={st.name} pflicht auto="organization" />
          <Eingabe id="strasse" label={x.angaben.strasse} wert={st.strasse} pflicht auto="street-address" />
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Eingabe id="plz" label={x.angaben.plz} wert={st.plz} pflicht auto="postal-code" />
            <Eingabe id="ort" label={x.angaben.ort} wert={st.ort} pflicht auto="address-level2" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Eingabe id="email" label={x.angaben.email} wert={st.email} pflicht typ="email" auto="email" />
            <Eingabe id="telefon" label={x.angaben.telefon} wert={st.telefon} typ="tel" auto="tel" />
            <Eingabe id="steuernummer" label={x.angaben.steuernummer} wert={st.steuernummer} />
            <Eingabe id="ust_idnr" label={x.angaben.ust_idnr} wert={st.ust_idnr} />
            <Eingabe id="iban" label={x.angaben.iban} wert={st.iban} />
            <Eingabe id="bic" label={x.angaben.bic} wert={st.bic} />
          </div>
          <button className="knopf">{x.angaben.speichern}</button>
        </form>
      </section>

      <section aria-labelledby="kunden" className="space-y-4">
        <h2 id="kunden" className="text-gross font-bold">{x.angaben.kunden}</h2>
        {kunden.length ? (
          <ul className="border-t border-linie">
            {kunden.map((k) => (
              <li key={k.id} className="flex flex-wrap justify-between gap-x-4 border-b border-linie py-3">
                <span className="font-bold">{k.name}</span>
                <span className="text-klein text-tinte-leise">{[k.ort, k.geschaeftskunde ? x.angaben.geschaeftlich : x.angaben.privat].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="rounded-md border border-linie p-4">
          <summary className="cursor-pointer font-bold">{x.angaben.kunde_neu}</summary>
          <form action={kundeAnlegen} className="mt-4 space-y-4">
            <Eingabe id="k_name" label={x.angaben.kunde_name} pflicht />
            <Eingabe id="k_strasse" label={x.angaben.strasse} />
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Eingabe id="k_plz" label={x.angaben.plz} />
              <Eingabe id="k_ort" label={x.angaben.ort} />
            </div>
            <Eingabe id="k_email" label={x.angaben.kunde_email} typ="email" />
            <Eingabe id="k_kaeufer_referenz" label={x.angaben.kunde_referenz} />
            <Eingabe id="k_ust_idnr" label={x.angaben.kunde_ust} />
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="geschaeftskunde" value="ja" defaultChecked className="size-5 accent-amt" />
              {x.angaben.geschaeftskunde}
            </label>
            <button className="knopf">{x.angaben.kunde_anlegen}</button>
          </form>
        </details>
      </section>
    </div>
  );
}
