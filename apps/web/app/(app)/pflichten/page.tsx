import Link from "next/link";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { fuelle, offeneFragen, schritteJePhase } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { monatsname } from "@/lib/periode";
import { t } from "@/lib/sprache";
import type { AnzeigeStatus, Karte } from "@/lib/typen";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Pflichten" };

const FILTER: (AnzeigeStatus | "alle")[] = ["alle", "ueberfaellig", "faellig_bald", "angabe_fehlt", "offen", "erledigt"];


export default async function PflichtenSeite({ searchParams }: { searchParams: Promise<{ status?: string; pflicht?: string }> }) {
  const { status, pflicht } = await searchParams;
  const filter = FILTER.includes(status as AnzeigeStatus) ? (status as AnzeigeStatus | "alle") : "alle";
  const [{ s, t: x }, karten, profil] = await Promise.all([t(), api<Karte[]>(`/v1/pflichten?status=${filter}`), api<{ daten?: Record<string, unknown> }>("/v1/profil")]);
  // „Gilt nicht“ steht auf einer eigenen Seite, damit die Liste das Zu-Tuende zeigt
  // Ohne Filter: nur die nächsten 90 Tage (wiederkehrende Pflichten würden sonst die Liste fluten); alles im Kalender
  const grenze = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  // ?pflicht=<id> (z. B. aus dem Glossar): alle Termine dieser einen Pflicht, inklusive „gilt nicht“
  // Ohne Filter stehen Pflichten mit fehlender Angabe nicht in der Liste: ein Hinweis mit Weg zu den Nachfragen statt einer Flut aus „?“
  const sichtbar = pflicht
    ? karten.filter((k) => k.pflicht_id === pflicht)
    : karten.filter((k) => k.status !== "nicht_zutreffend" && (filter !== "alle" || (k.status !== "erledigt" && k.status !== "angabe_fehlt" && (!k.faellig_am || k.faellig_am <= grenze))));
  const unklar = filter === "alle" && !pflicht ? karten.filter((k) => k.status === "angabe_fehlt").length : 0;
  const daten = profil.daten ?? {};
  const naechsteRunde = unklar && offeneFragen(daten) ? schritteJePhase("nachfragen", daten)[0] : undefined;

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
          {pfadSichtbar("/radar") ? (
            <>
              {" · "}
              <Link href="/radar" className="verweis">
                {x.radar.link}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {sichtbar.length === 0 ? <p className="lesetext">{x.pflichten.leer}</p> : null}

      {unklar ? (
        <aside aria-label={x.status.angabe_fehlt} className="rounded-md border border-dashed border-tinte-leise bg-blatt p-5">
          <p className="font-bold">{fuelle(x.pflichten.unklar_titel, { n: unklar })}</p>
          <p className="lesetext mt-1 text-klein text-tinte-leise">{x.pflichten.unklar_text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {naechsteRunde ? <Link href={`/onboarding/${naechsteRunde.id}?phase=nachfragen`} className="knopf knopf-leise">{x.onboarding.nachfragen_knopf}</Link> : null}
            <Link href="/pflichten?status=angabe_fehlt" className="verweis text-klein">{x.pflichten.unklar_einzeln}</Link>
          </div>
        </aside>
      ) : null}

      {[...gruppen.entries()].map(([monat, liste]) => {
        const titel = monat === "ohne" ? x.pflichten.ohne_termin : `${monatsname(Number(monat.slice(5)), s)} ${monat.slice(0, 4)}`;
        const zeilen = liste.map((k) => <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />);
        // Laufende Pflichten ohne Termin: eingeklappt, damit die Liste das Terminierte zeigt
        if (monat === "ohne" && !pflicht && filter === "alle") {
          return (
            <details key={monat} className="group border-b-2 border-tinte">
              <summary className="flex min-h-11 cursor-pointer list-none items-baseline justify-between gap-4 py-2 font-bold marker:hidden [&::-webkit-details-marker]:hidden">
                <span>{fuelle(x.pflichten.laufend_titel, { n: liste.length })}</span>
                <span className="text-klein text-tinte-leise group-open:hidden">{x.pflichten.laufend_zeigen}</span>
                <span className="hidden text-klein text-tinte-leise group-open:inline">{x.pflichten.laufend_verbergen}</span>
              </summary>
              <p className="lesetext text-klein text-tinte-leise">{x.pflichten.laufend_text}</p>
              <ul className="border-t border-linie">{zeilen}</ul>
            </details>
          );
        }
        return (
          <section key={monat} aria-labelledby={`m-${monat}`}>
            <h2 id={`m-${monat}`} className="border-b-2 border-tinte pb-1 font-bold">
              {titel}
            </h2>
            <ul>{zeilen}</ul>
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
