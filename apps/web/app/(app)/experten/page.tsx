import Link from "next/link";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Expertinnen und Experten" };

export type Qualifikation = "steuerberater" | "rechtsanwalt" | "fachkraft_arbeitssicherheit" | "datenschutzbeauftragter";
export interface Partner { id: string; name: string; qualifikation: Qualifikation; kanzlei: string; regionen: string[]; beschreibung: string; pakete: { titel: string; umfang?: string; preis_text?: string }[]; website: string | null; zulassung_geprueft_am: string; in_der_naehe: boolean }
interface Anfrage { id: string; partner: string; qualifikation: Qualifikation; paket: string | null; erstellt_am: string; versendet_am: string | null }

const QUALIFIKATIONEN: Qualifikation[] = ["steuerberater", "rechtsanwalt", "fachkraft_arbeitssicherheit", "datenschutzbeauftragter"];

export default async function ExpertenSeite({ searchParams }: { searchParams: Promise<{ q?: string; gesendet?: string }> }) {
  const { q, gesendet } = await searchParams;
  const filter = QUALIFIKATIONEN.includes(q as Qualifikation) ? (q as Qualifikation) : undefined;
  const [{ s, t: x }, partner, anfragen] = await Promise.all([
    t(),
    api<Partner[]>(`/v1/partner${filter ? `?qualifikation=${filter}` : ""}`),
    api<Anfrage[]>("/v1/marktplatz/anfragen"),
  ]);
  const e = x.experten;
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{e.titel}</h1>
        <p className="mt-2">{e.text}</p>
      </header>
      {gesendet ? <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">{e.gesendet}</p> : null}
      <nav aria-label={e.titel} className="flex flex-wrap gap-2">
        <Link href="/experten" aria-current={!filter ? "page" : undefined} className={`rounded-md border px-3 py-1 text-klein ${!filter ? "border-tinte font-bold" : "border-linie"}`}>{e.alle}</Link>
        {QUALIFIKATIONEN.map((k) => (
          <Link key={k} href={`/experten?q=${k}`} aria-current={filter === k ? "page" : undefined} className={`rounded-md border px-3 py-1 text-klein ${filter === k ? "border-tinte font-bold" : "border-linie"}`}>{e.qualifikationen[k]}</Link>
        ))}
      </nav>
      {partner.length ? (
        <ul className="space-y-4">
          {partner.map((p) => (
            <li key={p.id} className="rounded-md border border-linie bg-blatt p-4">
              <h2 className="text-gross font-bold"><Link href={`/experten/${p.id}`} className="verweis">{p.name}</Link></h2>
              <p className="text-klein">
                {e.qualifikationen[p.qualifikation]}{p.kanzlei ? ` · ${p.kanzlei}` : ""} · {p.regionen.length === 0 ? e.bundesweit : p.in_der_naehe ? e.in_der_naehe : p.regionen.join(", ")}
              </p>
              {p.beschreibung ? <p className="mt-2">{p.beschreibung}</p> : null}
              <p className="mt-2 text-klein text-tinte-leise">{fuelle(e.zulassung, { datum: datumLang(p.zulassung_geprueft_am, s) })}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{e.leer}</p>
      )}
      {anfragen.length ? (
        <section>
          <h2 className="text-gross font-bold">{e.meine}</h2>
          <ul className="mt-2 border-t border-linie">
            {anfragen.map((a) => (
              <li key={a.id} className="border-b border-linie py-2 text-klein">
                {e.qualifikationen[a.qualifikation]}{a.paket ? ` · ${a.paket}` : ""} – {fuelle(e.an, { name: a.partner, datum: datumLang(a.erstellt_am.slice(0, 10), s) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
