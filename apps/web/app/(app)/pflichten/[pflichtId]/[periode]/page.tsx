import Link from "next/link";
import { revalidatePath } from "next/cache";
import { datumLang, frageFuerFakt, fuelle, schrittFuerFakt } from "@amtlos/i18n";
import { Fristblatt } from "@/komponenten/fristblatt";
import { periodeText } from "@/lib/periode";
import { StatusText } from "@/komponenten/status";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { KartenDetail } from "@/lib/typen";

type Params = Promise<{ pflichtId: string; periode: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { pflichtId, periode } = await params;
  const d = await api<KartenDetail>(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}`);
  return { title: d.titel };
}

async function erledigen(pflichtId: string, periode: string, formular: FormData) {
  "use server";
  const notiz = String(formular.get("notiz") ?? "").trim();
  await api(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}/erledigen`, {
    method: "POST",
    body: JSON.stringify(notiz ? { notiz } : {}),
  });
  revalidatePath(`/pflichten/${pflichtId}/${periode}`);
}

async function wiederOeffnen(pflichtId: string, periode: string) {
  "use server";
  await api(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}/wieder-oeffnen`, { method: "POST" });
  revalidatePath(`/pflichten/${pflichtId}/${periode}`);
}

/** Seitenvertrag „Pflicht-Karte“ (docs/04): Was · Bis wann · Erledigen · Warum · Was sonst · Mehr · Quellen. */
export default async function PflichtSeite({ params }: { params: Params }) {
  const { pflichtId, periode } = await params;
  const [{ s, t: x }, d] = await Promise.all([t(), api<KartenDetail>(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}`)]);
  const offen = ["offen", "faellig_bald", "ueberfaellig", "angabe_fehlt"].includes(d.status);
  const ergaenzenSchritt = d.fehlende_fakten.map(schrittFuerFakt).find(Boolean);
  const steuerOderRecht = ["steuern", "gesellschaft"].includes(d.kategorie) || d.status === "angabe_fehlt";

  return (
    <article className="space-y-8">
      <p>
        <Link href="/pflichten" className="verweis">
          {x.karte.zurueck}
        </Link>
      </p>

      {d.ungeprueft ? (
        <p role="note" className="lesetext rounded-md border-2 border-bald bg-bald-hauch p-4 text-klein">
          {x.karte.ungeprueft}
        </p>
      ) : null}

      {/* Was und bis wann */}
      <header className="flex gap-5">
        <Fristblatt datum={d.faellig_am} status={d.status} sprache={s} />
        <div className="min-w-0">
          <h1 className="text-titel font-bold">{d.titel}</h1>
          <p className="lesetext mt-2 text-gross">{d.kurz}</p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <StatusText status={d.status} sprache={s} />
            {d.faellig_am ? <span>{fuelle(x.pflichten.bis, { datum: datumLang(d.faellig_am, s) })}</span> : null}
            {periode !== "einmalig" && !periode.startsWith("aenderung") ? <span className="text-tinte-leise">{periodeText(periode, s)}</span> : null}
          </p>
          {d.verschoben_von ? <p className="mt-1 text-klein text-tinte-leise">{fuelle(x.pflichten.verschoben, { datum: datumLang(d.verschoben_von, s) })}</p> : null}
          {!d.faellig_am && d.hinweise.some((h) => h.startsWith("termin_abhaengig_von_ereignis")) ? (
            <p className="mt-1 text-klein text-tinte-leise">
              {x.karte.termin_offen}{" "}
              <Link href="/melden" className="verweis">
                {x.nav.melden}
              </Link>
            </p>
          ) : null}
        </div>
      </header>

      {/* Erledigen */}
      {d.status === "erledigt" ? (
        <section className="flex flex-wrap items-center gap-4">
          <span className="stempel">{d.erledigt_am ? fuelle(x.karte.erledigt_am, { datum: datumLang(d.erledigt_am.slice(0, 10), s) }) : x.status.erledigt}</span>
          <form action={wiederOeffnen.bind(null, pflichtId, periode)}>
            <button className="knopf knopf-leise">{x.karte.wieder_oeffnen}</button>
          </form>
        </section>
      ) : offen && d.ergebnis === "gilt" ? (
        <form action={erledigen.bind(null, pflichtId, periode)} className="lesetext space-y-3">
          <label className="block text-klein" htmlFor="notiz">
            {x.karte.notiz}
          </label>
          <textarea id="notiz" name="notiz" rows={2} maxLength={2000} className="feld" />
          <button className="knopf">{x.karte.erledigen}</button>
        </form>
      ) : null}

      {/* Warum / was fehlt */}
      {d.warum.length ? (
        <section aria-labelledby="warum">
          <h2 id="warum" className="text-gross font-bold">
            {x.karte.warum}
          </h2>
          <ul className="lesetext mt-2 list-disc space-y-1 pl-5">
            {d.warum.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {d.status === "nicht_zutreffend" && d.nicht_zutreffend_grund ? <p className="lesetext">{d.nicht_zutreffend_grund}</p> : null}
      {d.ergebnis === "unbekannt" ? (
        <section aria-labelledby="fehlt" className="lesetext rounded-md border-2 border-dashed border-tinte-leise p-5">
          <h2 id="fehlt" className="text-gross font-bold">
            {x.karte.zu_klaeren}
          </h2>
          <p className="mt-2">{x.karte.zu_klaeren_text}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {d.fehlende_fakten.map((f) => (
              <li key={f}>{frageFuerFakt(f)?.frage[s] ?? d.zu_klaeren.join(" ")}</li>
            ))}
          </ul>
          {ergaenzenSchritt ? (
            <Link href={`/onboarding/${ergaenzenSchritt}?zurueck=${encodeURIComponent(`/pflichten/${pflichtId}/${periode}`)}`} className="knopf mt-4">
              {x.karte.angabe_ergaenzen}
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Was sonst */}
      <section aria-labelledby="sonst">
        <h2 id="sonst" className="text-gross font-bold">
          {x.karte.sonst}
        </h2>
        <p className="lesetext mt-2">{d.sanktion.text}</p>
      </section>

      {/* Mehr */}
      <section aria-labelledby="mehr" className="space-y-3">
        <h2 id="mehr" className="text-gross font-bold">
          {x.karte.mehr}
        </h2>
        <p className="lesetext">{d.erklaerung}</p>
        <dl className="lesetext space-y-2">
          <div>
            <dt className="font-bold">{x.karte.stelle}</dt>
            <dd>{d.stelle}</dd>
          </div>
          {d.kosten ? (
            <div>
              <dt className="font-bold">{x.karte.kosten}</dt>
              <dd>{d.kosten}</dd>
            </div>
          ) : null}
        </dl>
        {d.begriffe.length ? (
          <dl className="lesetext space-y-2">
            {d.begriffe.map((b) => (
              <div key={b.begriff}>
                <dt className="font-bold">{b.begriff}</dt>
                <dd>{b.erklaerung}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* Quellen */}
      <section aria-labelledby="quellen" className="border-t border-linie pt-6 text-klein">
        <h2 id="quellen" className="font-bold">
          {x.karte.quellen}
        </h2>
        <p className="mt-1">{d.rechtsgrundlage.join(", ")}</p>
        <ul className="mt-2 space-y-1">
          {d.quellen.map((q) => (
            <li key={q.url}>
              <a href={q.url} className="verweis" rel="noopener noreferrer" target="_blank">
                {q.titel}
              </a>
              {q.abgerufen ? null : <span className="text-tinte-leise"> ({x.karte.nicht_abgerufen})</span>}
            </li>
          ))}
        </ul>
        {d.pruefung.geprueft_von?.length && d.pruefung.geprueft_am ? (
          <p className="mt-2">{fuelle(x.karte.geprueft, { wer: d.pruefung.geprueft_von.join(", "), datum: datumLang(d.pruefung.geprueft_am, s) })}</p>
        ) : null}
        {steuerOderRecht ? <p className="lesetext mt-3 text-tinte-leise">{x.karte.keine_beratung}</p> : null}
      </section>
    </article>
  );
}
