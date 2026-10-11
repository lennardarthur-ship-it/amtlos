import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { datumTeile, fuelle } from "@amtlos/i18n";
import { KopierFeld } from "@/komponenten/kopier-feld";
import { StatusForm } from "@/komponenten/status";
import { api } from "@/lib/api";
import { monatsname } from "@/lib/periode";
import { t } from "@/lib/sprache";
import type { Karte } from "@/lib/typen";

export const metadata = { title: "Kalender" };

const ABO_COOKIE = "amtlos_kalender_abo_neu";
const SICHTBAR = new Set(["offen", "faellig_bald", "ueberfaellig", "erledigt"]);

async function aboErzeugen() {
  "use server";
  const r = await api<{ url: string }>("/v1/kalender/abo", { method: "POST" });
  // Die Adresse wird nur einmal gezeigt (gespeichert ist nur der Hash) – kurzlebig im Cookie bis zur Anzeige
  (await cookies()).set(ABO_COOKIE, r.url, { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/kalender" });
  revalidatePath("/kalender");
}

/** Jahreskalender (Spezifikation 4.I): alle zutreffenden Pflichten mit Termin, Monat für Monat. */
export default async function KalenderSeite() {
  const [{ s, t: x }, karten] = await Promise.all([t(), api<Karte[]>("/v1/pflichten?status=alle")]);
  const neueAdresse = (await cookies()).get(ABO_COOKIE)?.value;

  const heute = new Date();
  const monate = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const dieserMonat = monate[0]!;
  const mitTermin = karten.filter((k) => k.faellig_am && SICHTBAR.has(k.status));
  // Überfälliges aus früheren Monaten gehört in den aktuellen Monat – sonst verschwindet es aus dem Blick
  const monatVon = (k: Karte) => (k.status === "ueberfaellig" && k.faellig_am!.slice(0, 7) < dieserMonat ? dieserMonat : k.faellig_am!.slice(0, 7));
  const laufend = karten.filter((k) => !k.faellig_am && ["offen", "angabe_fehlt"].includes(k.status)).length;
  const jahr = String(heute.getUTCFullYear());

  return (
    <div className="space-y-10">
      <header className="lesetext">
        <h1 className="text-titel font-bold">{x.kalender.titel}</h1>
        <p className="mt-2">{x.kalender.jahr_text}</p>
      </header>

      <section aria-labelledby="jahr">
        <h2 id="jahr" className="sr-only">{x.kalender.jahr_titel}</h2>
        <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {monate.map((m) => {
            const liste = mitTermin.filter((k) => monatVon(k) === m).sort((a, b) => a.faellig_am!.localeCompare(b.faellig_am!));
            return (
              <li key={m} aria-labelledby={`monat-${m}`} className="min-w-0">
                <h3 id={`monat-${m}`} className={`border-b-2 pb-1 font-bold ${m === dieserMonat ? "border-amt text-amt" : "border-tinte"}`}>
                  {monatsname(Number(m.slice(5)), s)} {m.slice(0, 4) !== jahr || m === dieserMonat ? m.slice(0, 4) : ""}
                </h3>
                {liste.length ? (
                  <ul>
                    {liste.map((k) => {
                      const d = datumTeile(k.faellig_am!, s);
                      const ueberfaelligAlt = monatVon(k) !== k.faellig_am!.slice(0, 7);
                      return (
                        <li key={`${k.pflicht_id}|${k.periode}`} className="border-b border-linie">
                          <Link href={`/pflichten/${encodeURIComponent(k.pflicht_id)}/${encodeURIComponent(k.periode)}`} className="flex gap-3 py-2 hover:underline">
                            <span className={`w-16 flex-none whitespace-nowrap text-right tabular-nums ${k.status === "erledigt" ? "text-tinte-leise" : "font-bold"}`}>
                              {ueberfaelligAlt ? `${d.tag}.${k.faellig_am!.slice(5, 7)}.` : `${d.wochentag} ${d.tag}.`}
                            </span>
                            <span className={`flex min-w-0 items-start gap-2 ${k.status === "erledigt" ? "text-tinte-leise line-through" : ""}`}>
                              <StatusForm status={k.status} className={`mt-1.5 ${k.status === "ueberfaellig" ? "text-frist" : k.status === "faellig_bald" ? "text-bald" : k.status === "erledigt" ? "text-amt" : ""}`} />
                              <span>
                                {k.titel}
                                <span className="sr-only"> ({x.status[k.status]})</span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-2 text-klein text-tinte-leise">{x.kalender.keine_termine}</p>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-klein text-tinte-leise">{x.kalender.vorlaeufig_hinweis}</p>
      </section>

      {laufend ? (
        <section aria-labelledby="laufend" className="lesetext">
          <h2 id="laufend" className="text-gross font-bold">{x.kalender.laufend_titel}</h2>
          <p className="mt-1">
            {fuelle(x.kalender.laufend_text, { n: laufend })}{" "}
            <Link href="/pflichten" className="verweis">{x.kalender.zur_liste}</Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="abo" className="lesetext space-y-3 border-t border-linie pt-6">
        <h2 id="abo" className="text-gross font-bold">{x.kalender.abo_titel}</h2>
        <p>{x.kalender.abo_text}</p>
        {neueAdresse ? (
          <KopierFeld wert={neueAdresse} knopf={x.kalender.abo_kopieren} erledigt={x.kalender.abo_kopiert} />
        ) : (
          <form action={aboErzeugen}>
            <button className="knopf knopf-leise">{x.kalender.abo_knopf}</button>
          </form>
        )}
      </section>
    </div>
  );
}
