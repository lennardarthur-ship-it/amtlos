import Link from "next/link";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Abo" };

export interface Abo { status: "test" | "aktiv" | "gekuendigt" | "ueberfaellig" | "abgelaufen"; test_bis: string; laeuft_bis: string | null; schreibbar: boolean; bezahlen_moeglich: boolean; plan_name: string; testtage: number }

async function checkout() {
  "use server";
  const { url } = await senden<{ url: string }>("/v1/abo/checkout", "POST", undefined, "/einstellungen/abo");
  redirect(url);
}
async function portal() {
  "use server";
  const { url } = await senden<{ url: string }>("/v1/abo/portal", "POST", undefined, "/einstellungen/abo");
  redirect(url);
}

/** Abo (E-113): Testphase, Bezahlen über Stripe, Kundenportal. Lesen geht immer, Schreiben nur mit laufendem Abo. */
export default async function AboSeite({ searchParams }: { searchParams: Promise<{ ok?: string; abgelaufen?: string; fehler?: string }> }) {
  const [{ s, t: x }, a, u, sp] = await Promise.all([t(), api<Abo>("/v1/abo"), aktivesUnternehmen(), searchParams]);
  const darf = u.rolle === "inhaber" || u.rolle === "admin";
  const heute = new Date().toISOString().slice(0, 10);
  const resttage = Math.max(0, Math.round((Date.parse(a.test_bis) - Date.parse(heute)) / 864e5));
  const text =
    a.status === "test"
      ? resttage > 0
        ? fuelle(x.abo.test_laeuft, { n: resttage, datum: datumLang(a.test_bis, s) })
        : x.abo.test_vorbei
      : a.status === "aktiv"
        ? fuelle(x.abo.aktiv, { datum: a.laeuft_bis ? datumLang(a.laeuft_bis, s) : "–" })
        : a.status === "gekuendigt"
          ? fuelle(x.abo.gekuendigt, { datum: a.laeuft_bis ? datumLang(a.laeuft_bis, s) : "–" })
          : a.status === "ueberfaellig"
            ? x.abo.ueberfaellig
            : x.abo.abgelaufen;
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/einstellungen" className="verweis">{x.abo.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.abo.titel}</h1>
        <p className="mt-2">{x.abo.text}</p>
      </header>
      {sp.ok ? <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">{x.abo.danke}</p> : null}
      {sp.abgelaufen ? <p role="alert" className="rounded-md border-2 border-bald bg-bald-hauch p-4">{x.abo.schreiben_gesperrt}</p> : null}
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      <section className={`rounded-md border-2 p-5 ${a.schreibbar ? "border-amt bg-blatt" : "border-frist bg-frist-hauch"}`}>
        <p className="text-gross font-bold">{x.abo.status[a.status]}</p>
        <p className="mt-1">{text}</p>
        <p className="mt-3 text-klein text-tinte-leise">{x.abo.daten_bleiben}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-gross font-bold">{a.plan_name}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {x.abo.leistungen.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="text-klein text-tinte-leise">{x.abo.preis_hinweis}</p>
        {!darf ? (
          <p className="text-klein">{x.abo.nur_inhaber}</p>
        ) : !a.bezahlen_moeglich ? (
          <p className="rounded-md border border-linie p-3 text-klein">{x.abo.nicht_eingerichtet}</p>
        ) : a.status === "test" || a.status === "abgelaufen" ? (
          <form action={checkout}>
            <button className="knopf">{x.abo.abschliessen}</button>
          </form>
        ) : (
          <form action={portal}>
            <button className="knopf knopf-leise">{x.abo.verwalten}</button>
          </form>
        )}
      </section>
    </div>
  );
}
