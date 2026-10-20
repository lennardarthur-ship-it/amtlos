import Link from "next/link";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Was kommt auf dich zu" };

interface Eintrag { art: "radar" | "kommend"; pflicht_id: string; titel: string; kurz: string; erklaerung: string; status_recht: string; wahrscheinlichkeit: string | null; erwartet_ab: string | null; vorbereitung: string[]; betroffen: "ja" | "vielleicht"; warum: string[] }
interface Wert { id: string; bezeichnung: string; wert_bisher: unknown; wert_neu: unknown; einheit: string; gueltig_ab: string }

/** Angaben ohne Leere und ohne Wiederholung (Groß-/Kleinschreibung egal), Reihenfolge bleibt. */
function einmal(werte: (string | null | undefined)[]): string[] {
  const gesehen = new Set<string>();
  return werte.filter((w): w is string => Boolean(w) && !gesehen.has(w!.toLowerCase()) && Boolean(gesehen.add(w!.toLowerCase())));
}

export default async function RadarSeite() {
  const [{ s, t: x }, r] = await Promise.all([t(), api<{ eintraege: Eintrag[]; werte: Wert[] }>("/v1/radar")]);
  const zahl = (v: unknown, einheit: string) =>
    typeof v === "number" ? `${new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(v)}${einheit.startsWith("EUR") ? " €" : ""}` : String(v ?? "–");
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.radar.titel}</h1>
        <p className="mt-2">{x.radar.text}</p>
      </header>
      {r.eintraege.length ? (
        <ul className="space-y-4">
          {r.eintraege.map((e) => (
            <li key={`${e.art}-${e.pflicht_id}`} className="rounded-md border border-linie bg-blatt p-4">
              <h2 className="text-gross font-bold">{e.titel}</h2>
              <p className="mt-1 text-klein text-tinte-leise">
                {/* Gleiche Wörter nur einmal (G5: Status „beschlossen“ und Wahrscheinlichkeit „sicher“ heißen beide „beschlossen“) */}
                {einmal([(x.radar.status as Record<string, string>)[e.status_recht] ?? e.status_recht, e.wahrscheinlichkeit ? (x.radar.wahrscheinlichkeit as Record<string, string>)[e.wahrscheinlichkeit] : null, e.erwartet_ab ? fuelle(x.radar.erwartet, { datum: datumLang(e.erwartet_ab, s) }) : x.radar.offen]).join(" · ")}
              </p>
              <p className="mt-2">{e.kurz}</p>
              <p className={`mt-2 text-klein font-bold ${e.betroffen === "ja" ? "text-bald" : "text-tinte-leise"}`}>{e.betroffen === "ja" ? x.radar.betroffen_ja : x.radar.betroffen_vielleicht}</p>
              {e.warum.length ? <ul className="mt-1 list-disc pl-5 text-klein">{e.warum.map((w) => <li key={w}>{w}</li>)}</ul> : null}
              {e.vorbereitung.length ? (
                <div className="mt-3">
                  <h3 className="text-klein font-bold">{x.radar.vorbereitung}</h3>
                  <ul className="mt-1 list-disc pl-5 text-klein">{e.vorbereitung.map((v) => <li key={v}>{v}</li>)}</ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.radar.leer}</p>
      )}
      {r.werte.length ? (
        <section aria-labelledby="werte">
          <h2 id="werte" className="text-gross font-bold">{x.radar.werte}</h2>
          <ul className="mt-2 border-t border-linie">
            {r.werte.map((w) => (
              <li key={`${w.id}-${w.gueltig_ab}`} className="border-b border-linie py-2">
                {fuelle(x.radar.wert, { bezeichnung: w.bezeichnung, alt: zahl(w.wert_bisher, w.einheit), neu: zahl(w.wert_neu, w.einheit), datum: datumLang(w.gueltig_ab, s) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-klein"><Link href="/pflichten" className="verweis">{x.nav.pflichten}</Link></p>
    </div>
  );
}
