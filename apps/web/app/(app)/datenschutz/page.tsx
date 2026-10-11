import Link from "next/link";
import { redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Datenschutz und IT" };

async function ablegen() {
  "use server";
  const r = await senden<{ erledigte_pflichten: number }>("/v1/datenschutz/dokumentation", "POST", undefined, "/datenschutz");
  redirect(`/datenschutz?abgelegt=${r.erledigte_pflichten}`);
}

export default async function DatenschutzSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; abgelegt?: string }> }) {
  const [{ t: x }, profil, sp, u] = await Promise.all([t(), api<{ daten: Record<string, unknown> }>("/v1/profil"), searchParams, aktivesUnternehmen()]);
  const nis2 = profil.daten["nis2.betroffen"];
  const karten = [
    ["/datenschutz/vvt", x.vvt.titel, x.ds.vvt_text],
    ["/datenschutz/tom", x.tom.titel, x.ds.tom_text],
    ["/datenschutz/dienstleister", x.dl.titel, x.ds.dl_text],
    ["/datenschutz/anfragen", x.anfrage.titel, x.ds.anfragen_text],
    ["/datenschutz/pannen", x.panne.titel, x.ds.pannen_text],
    ["/personal/unterweisungen?art=ki_kompetenz", x.ds.schulungen, x.ds.schulungen_text],
  ] as const;
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.ds.titel}</h1>
        <p className="mt-2">{x.ds.text}</p>
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {sp.abgelegt ? <p role="status" className="rounded-md border-2 border-amt bg-amt-hauch p-4">{fuelle(x.ds.abgelegt, { n: sp.abgelegt })}</p> : null}

      <section aria-labelledby="notfall" className="rounded-md border-2 border-frist bg-frist-hauch p-5">
        <h2 id="notfall" className="text-gross font-bold">{x.ds.notfall}</h2>
        <p className="mt-1">{x.ds.notfall_text}</p>
        <Link href="/datenschutz/pannen#melden" className="knopf knopf-notfall mt-3">{x.ds.notfall}</Link>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {karten.map(([href, titel, text]) => (
          <li key={href}><Link href={href} className="block h-full rounded-md border border-linie bg-blatt p-4 hover:border-amt"><span className="font-bold">{titel}</span><span className="mt-1 block text-klein text-tinte-leise">{text}</span></Link></li>
        ))}
      </ul>

      <section aria-labelledby="doku">
        <h2 id="doku" className="text-gross font-bold">{x.ds.dokumentation}</h2>
        <p className="mt-1">{x.ds.dokumentation_text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a href="/datenschutz/dokumentation" className="verweis">{x.ds.ansehen}</a>
          {u.rolle !== "mitarbeiter" ? <form action={ablegen}><button className="knopf">{x.ds.ablegen}</button></form> : null}
        </div>
      </section>

      <section aria-labelledby="nis2">
        <h2 id="nis2" className="text-gross font-bold">{x.ds.nis2}</h2>
        <p className="mt-1">{nis2 === "ja" ? x.ds.nis2_ja : nis2 === "nein" ? x.ds.nis2_nein : x.ds.nis2_offen}</p>
        <Link href="/onboarding/daten?zurueck=%2Fdatenschutz" className="verweis mt-2 inline-block">{x.ds.nis2_aendern}</Link>
      </section>
    </div>
  );
}
