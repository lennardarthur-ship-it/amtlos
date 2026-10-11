import Link from "next/link";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { api } from "@/lib/api";
import { monatsname } from "@/lib/periode";
import { t } from "@/lib/sprache";
import type { AnzeigeStatus, Karte } from "@/lib/typen";

export const metadata = { title: "Pflichten" };

const FILTER: (AnzeigeStatus | "alle")[] = ["alle", "ueberfaellig", "faellig_bald", "angabe_fehlt", "offen", "erledigt"];


export default async function PflichtenSeite({ searchParams }: { searchParams: Promise<{ status?: string; pflicht?: string }> }) {
  const { status, pflicht } = await searchParams;
  const filter = FILTER.includes(status as AnzeigeStatus) ? (status as AnzeigeStatus | "alle") : "alle";
  const [{ s, t: x }, karten] = await Promise.all([t(), api<Karte[]>(`/v1/pflichten?status=${filter}`)]);
  // „Gilt nicht“ steht auf einer eigenen Seite, damit die Liste das Zu-Tuende zeigt
  // Ohne Filter: nur die nächsten 90 Tage (wiederkehrende Pflichten würden sonst die Liste fluten); alles im Kalender
  const grenze = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  // ?pflicht=<id> (z. B. aus dem Glossar): alle Termine dieser einen Pflicht, inklusive „gilt nicht“
  const sichtbar = pflicht
    ? karten.filter((k) => k.pflicht_id === pflicht)
    : karten.filter((k) => k.status !== "nicht_zutreffend" && (filter !== "alle" || (k.status !== "erledigt" && (!k.faellig_am || k.faellig_am <= grenze))));

  // Nach Monat der Fälligkeit gruppieren – Zeitfolge ist hier die tatsächliche Ordnung
  const gruppen = new Map<string, Karte[]>();
  for (const k of sichtbar) {
    const schluessel = k.faellig_am ? k.faellig_am.slice(0, 7) : "ohne";
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), k]);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-titel font-bold">{x.pflichten.titel}</h1>
      <nav aria-label={x.pflichten.filter}>
        <ul className="flex flex-wrap gap-2">
          {FILTER.map((f) => (
            <li key={f}>
              <Link
                href={f === "alle" ? "/pflichten" : `/pflichten?status=${f}`}
                aria-current={f === filter ? "true" : undefined}
                className="inline-flex min-h-11 items-center rounded-full border-2 border-linie px-4 text-klein font-bold aria-[current=true]:border-amt aria-[current=true]:bg-amt-hauch aria-[current=true]:text-amt"
              >
                {f === "alle" ? x.pflichten.alle : x.status[f]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {filter === "alle" && !pflicht ? (
        <p className="text-klein text-tinte-leise">
          {x.pflichten.naechste_90}{" "}
          <Link href="/kalender" className="verweis">
            {x.pflichten.alle_termine}
          </Link>
          {" · "}
          <Link href="/radar" className="verweis">
            {x.radar.link}
          </Link>
        </p>
      ) : null}
      {sichtbar.length === 0 ? <p className="lesetext">{x.pflichten.leer}</p> : null}

      {[...gruppen.entries()].map(([monat, liste]) => {
        const titel = monat === "ohne" ? x.pflichten.ohne_termin : `${monatsname(Number(monat.slice(5)), s)} ${monat.slice(0, 4)}`;
        return (
          <section key={monat} aria-labelledby={`m-${monat}`}>
            <h2 id={`m-${monat}`} className="border-b-2 border-tinte pb-1 font-bold">
              {titel}
            </h2>
            <ul>
              {liste.map((k) => (
                <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />
              ))}
            </ul>
          </section>
        );
      })}

      <p>
        <Link href="/pflichten/nicht-zutreffend" className="verweis">
          {x.pflichten.nicht_zutreffend_link}
        </Link>
      </p>
    </div>
  );
}
