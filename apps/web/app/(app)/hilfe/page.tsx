import Link from "next/link";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Hilfe" };

interface Begriff { begriff: string; erklaerung: string; pflichten: { id: string; titel: string }[] }

/** Glossar aus allen Fachbegriffen des Katalogs (Prinzip 5). */
/** Anleitungen, die zu einem Modul gehören, erscheinen nur, wenn das Modul sichtbar ist (E-110). */
const ANLEITUNG_PFAD: Record<string, string> = { gefaehrdung: "/personal/gefaehrdungsbeurteilungen", datenpanne: "/datenschutz", anfrage: "/datenschutz", onlinecheck: "/online", eigenkontrollen: "/branche", kanzlei: "/kanzlei" };

export default async function Hilfe() {
  const [{ t: x }, begriffe] = await Promise.all([t(), api<Begriff[]>("/v1/glossar")]);
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.hilfe.titel}</h1>
      <p>{x.hilfe.text}</p>
      <p className="text-klein text-tinte-leise">{x.karte.keine_beratung}</p>
      <section aria-labelledby="anleitungen">
        <h2 id="anleitungen" className="text-gross font-bold">{x.hilfe.anleitungen_titel}</h2>
        <div className="mt-2 border-t border-linie">
          {x.hilfe.anleitungen.filter((a) => !ANLEITUNG_PFAD[a.id] || pfadSichtbar(ANLEITUNG_PFAD[a.id]!)).map((a) => (
            <details key={a.id} id={a.id} className="border-b border-linie py-3">
              <summary className="cursor-pointer font-bold">{a.titel}</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {a.schritte.map((schritt) => <li key={schritt}>{schritt}</li>)}
              </ol>
            </details>
          ))}
        </div>
      </section>
      <h2 className="text-gross font-bold">{x.hilfe.begriffe_titel}</h2>
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
