import Link from "next/link";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { api } from "@/lib/api";
import { WERKZEUGE, WERKZEUG_PFAD, branchenAusProfil } from "@/lib/branchen";
import { t } from "@/lib/sprache";
import type { Karte } from "@/lib/typen";

export const metadata = { title: "Branchenpaket" };

export default async function BranchePage() {
  const [{ s, t: x }, profil, karten] = await Promise.all([t(), api<{ daten: Record<string, unknown> }>("/v1/profil"), api<Karte[]>("/v1/pflichten")]);
  const branchen = branchenAusProfil(profil.daten);
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.branche.titel}</h1>
        <p className="mt-2">{x.branche.text}</p>
      </header>
      {branchen.length ? (
        branchen.map((b) => {
          const pflichten = karten.filter((k) => k.branchen?.includes(b) && k.ergebnis !== "gilt_nicht" && k.status !== "entfallen");
          const werkzeuge = WERKZEUGE[b] ?? [];
          return (
            <section key={b} aria-labelledby={`b-${b}`} className="space-y-3">
              <h2 id={`b-${b}`} className="text-gross font-bold">{x.branche.namen[b]}</h2>
              {werkzeuge.length ? (
                <ul className="flex flex-wrap gap-2" aria-label={x.branche.werkzeuge}>
                  {werkzeuge.map((w) => <li key={w}><Link href={WERKZEUG_PFAD[w]} className="knopf knopf-leise">{x.branche[w]}</Link></li>)}
                </ul>
              ) : null}
              {pflichten.length ? (
                <ul className="border-t border-linie">
                  {pflichten.map((k) => <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />)}
                </ul>
              ) : (
                <p className="text-klein text-tinte-leise">{x.branche.keine_pflichten}</p>
              )}
            </section>
          );
        })
      ) : (
        <p>{x.branche.keine} <Link href="/onboarding/taetigkeit?zurueck=%2Fbranche" className="verweis">{x.branche.angeben}</Link></p>
      )}
    </div>
  );
}
