import Link from "next/link";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Karte } from "@/lib/typen";

export const metadata = { title: "Was nicht gilt" };

/** Transparenz: Was gilt nicht und warum (E-033: „nicht zutreffend“ immer mit Begründung). */
export default async function NichtZutreffend() {
  const [{ t: x }, karten] = await Promise.all([t(), api<Karte[]>("/v1/pflichten?status=nicht_zutreffend")]);
  return (
    <div className="space-y-6">
      <p>
        <Link href="/pflichten" className="verweis">
          {x.karte.zurueck}
        </Link>
      </p>
      <h1 className="text-titel font-bold">{x.pflichten.nicht_zutreffend_link}</h1>
      <ul className="border-t border-linie">
        {karten.map((k) => (
          <li key={k.pflicht_id} className="border-b border-linie py-4">
            <p className="font-bold">{k.titel}</p>
            {k.nicht_zutreffend_grund ? <p className="lesetext mt-1 text-tinte-leise">{k.nicht_zutreffend_grund}</p> : null}
            <p className="mt-2 text-klein">
              <Link href={`/pflichten/${encodeURIComponent(k.pflicht_id)}/${k.periode}`} className="verweis">
                {x.karte.mehr}
              </Link>
            </p>
          </li>
        ))}
      </ul>
      <p className="lesetext text-klein text-tinte-leise">{x.karte.keine_beratung}</p>
    </div>
  );
}
