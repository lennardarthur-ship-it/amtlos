import Link from "next/link";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Hilfe" };

interface Begriff { begriff: string; erklaerung: string; pflichten: { id: string; titel: string }[] }

/** Glossar aus allen Fachbegriffen des Katalogs (Prinzip 5). */
export default async function Hilfe() {
  const [{ t: x }, begriffe] = await Promise.all([t(), api<Begriff[]>("/v1/glossar")]);
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.hilfe.titel}</h1>
      <p>{x.hilfe.text}</p>
      <p className="text-klein text-tinte-leise">{x.karte.keine_beratung}</p>
      {begriffe.length ? (
        <dl className="border-t border-linie">
          {begriffe.map((b) => (
            <div key={b.begriff} className="border-b border-linie py-4">
              <dt className="text-gross font-bold">{b.begriff}</dt>
              <dd className="mt-1">{b.erklaerung}</dd>
              <dd className="mt-1 text-klein text-tinte-leise">
                {x.hilfe.vorkommen}:{" "}
                {b.pflichten.map((p, i) => (
                  <span key={p.id}>
                    {i ? ", " : ""}
                    <Link href={`/pflichten?pflicht=${encodeURIComponent(p.id)}`} className="verweis">{p.titel}</Link>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>{x.hilfe.leer}</p>
      )}
    </div>
  );
}
