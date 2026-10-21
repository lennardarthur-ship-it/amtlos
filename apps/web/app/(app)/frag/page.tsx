import Link from "next/link";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import { MARKE } from "@amtlos/marke";

export const metadata = { title: `Frag ${MARKE.name}` };

interface Treffer { pflicht_id: string; titel: string; kurz: string; erklaerung: string; rechtsgrundlage: string[]; quellen: { titel: string; url: string }[]; pruefung: { status: string; geprueft_am: string | null }; gilt_fuer_dich: boolean | null }
interface Regelwert { id: string; bezeichnung: string; wert: unknown; einheit: string; gueltig_ab: string | null; quellen: { titel: string; url: string }[]; pruefung: { status: string } }
interface Antwort { art: "antwort" | "beratung" | "unsicher"; treffer: Treffer[]; regelwerte: Regelwert[] }

/** Frage per GET (?f=…), damit Antworten verlinkbar sind und ohne JavaScript funktionieren. Nichts wird gespeichert. */
export default async function FragSeite({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const [{ s, t: x }, { f }] = await Promise.all([t(), searchParams]);
  const frage = (f ?? "").trim().slice(0, 500);
  const a = frage.length >= 3 ? await api<Antwort>("/v1/frage", { method: "POST", body: JSON.stringify({ frage }) }) : null;
  const zahl = (v: unknown, einheit: string) =>
    typeof v === "number" ? `${new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(v)}${einheit.startsWith("EUR") ? " €" : ""}` : String(v);
  const pruefText = (p: { status: string; geprueft_am?: string | null }) =>
    p.status === "freigegeben" && p.geprueft_am ? fuelle(x.frag.pruefung.freigegeben, { datum: datumLang(p.geprueft_am, s) }) : p.status === "in_pruefung" ? x.frag.pruefung.in_pruefung : x.frag.pruefung.entwurf;
  return (
    <div className="lesetext space-y-6">
      <header>
        <h1 className="text-titel font-bold">{x.frag.titel}</h1>
        <p className="mt-2">{x.frag.text}</p>
        <p className="mt-1 text-klein text-tinte-leise">{x.frag.ki_hinweis}</p>
      </header>
      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="f" className="block text-klein font-bold">{x.frag.frage}</label>
          <input id="f" name="f" required minLength={3} maxLength={500} defaultValue={frage} placeholder={x.frag.platzhalter} className="feld mt-1" />
        </div>
        <button className="knopf">{x.frag.fragen}</button>
      </form>
      {!a ? (
        <section aria-labelledby="beispiele">
          <h2 id="beispiele" className="text-klein font-bold">{x.frag.beispiele}</h2>
          <ul className="mt-1 space-y-1">{x.frag.beispiel.map((b) => <li key={b}><Link href={`/frag?f=${encodeURIComponent(b)}`} className="verweis">{b}</Link></li>)}</ul>
        </section>
      ) : (
        <section aria-live="polite" className="space-y-4">
          {a.art === "beratung" ? (
            <p role="status" className="rounded-md border-2 border-bald bg-bald-hauch p-4">{x.frag.beratung} <Link href="/experten" className="verweis">{x.frag.experten}</Link></p>
          ) : null}
          {a.art === "unsicher" ? (
            <p role="status" className="rounded-md border border-linie bg-blatt p-4">{x.frag.unsicher} <Link href="/experten" className="verweis">{x.frag.experten}</Link></p>
          ) : null}
          {a.treffer.length || a.regelwerte.length ? <h2 className="text-gross font-bold">{x.frag.antwort}</h2> : null}
          {a.regelwerte.map((r) => (
            <article key={r.id} className="rounded-md border border-linie bg-blatt p-4">
              <p className="font-bold">{fuelle(x.frag.regelwert, { bezeichnung: r.bezeichnung, wert: zahl(r.wert, r.einheit), datum: r.gueltig_ab ? datumLang(r.gueltig_ab, s) : "–" })}</p>
              <p className="mt-1 text-klein text-tinte-leise">{pruefText(r.pruefung)}{r.quellen[0] ? <> · {x.frag.quelle}: <a href={r.quellen[0].url} className="verweis" rel="noopener noreferrer">{r.quellen[0].titel}</a></> : null}</p>
            </article>
          ))}
          {a.treffer.map((tr) => (
            <article key={tr.pflicht_id} className="rounded-md border border-linie bg-blatt p-4">
              <h3 className="font-bold">{tr.titel}</h3>
              {tr.gilt_fuer_dich !== null ? <p className={`text-klein font-bold ${tr.gilt_fuer_dich ? "text-amt" : "text-tinte-leise"}`}>{tr.gilt_fuer_dich ? x.frag.gilt : x.frag.gilt_nicht}</p> : null}
              <p className="mt-1">{tr.kurz}</p>
              <p className="mt-1 text-klein">{tr.erklaerung}</p>
              <p className="mt-2 text-klein text-tinte-leise">
                {tr.rechtsgrundlage.join(", ")} · {pruefText(tr.pruefung)}
                {tr.quellen[0] ? <> · {x.frag.quelle}: <a href={tr.quellen[0].url} className="verweis" rel="noopener noreferrer">{tr.quellen[0].titel}</a></> : null}
              </p>
              <p className="mt-1 text-klein"><Link href={`/pflichten?pflicht=${encodeURIComponent(tr.pflicht_id)}`} className="verweis">{x.frag.zur_pflicht}</Link></p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
