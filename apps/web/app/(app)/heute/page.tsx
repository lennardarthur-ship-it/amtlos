import Link from "next/link";
import { revalidatePath } from "next/cache";
import { datumLang, fuelle } from "@amtlos/i18n";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { StatusForm } from "@/komponenten/status";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Bereich, Heute } from "@/lib/typen";

export const metadata = { title: "Heute" };

const BEREICHE: Bereich[] = ["steuern", "personal", "arbeitsschutz", "datenschutz", "online", "gesellschaft"];
const AMPEL_FARBE = { gruen: "text-amt", gelb: "text-bald", rot: "text-frist" } as const;

async function vorStartErledigt() {
  "use server";
  await api("/v1/pflichten/vor-start-erledigt", { method: "POST" });
  revalidatePath("/heute");
}

export default async function HeuteSeite() {
  const [{ s, t: x }, h, profil] = await Promise.all([t(), api<Heute>("/v1/heute"), api<{ version: number }>("/v1/profil")]);
  const ohneProfil = profil.version === 0;
  const nochNichtBerechnet = !ohneProfil && h.zaehler.offen + h.zaehler.erledigt === 0 && h.als_naechstes.length === 0;

  return (
    <div className="space-y-10">
      <h1 className="text-titel font-bold">{x.heute.titel}</h1>

      {ohneProfil ? (
        <section className="lesetext rounded-md border-2 border-dashed border-amt bg-blatt p-6">
          <p className="text-gross">{x.heute.profil_fehlt}</p>
          <Link href="/onboarding/rechtsform" className="knopf mt-5">
            {x.heute.profil_starten}
          </Link>
        </section>
      ) : null}

      {h.vor_start.anzahl > 0 && h.vor_start.seit ? (
        <section aria-labelledby="vorstart" className="lesetext rounded-md border-2 border-linie bg-blatt p-6">
          <h2 id="vorstart" className="text-gross font-bold">
            {x.heute.vor_start_titel}
          </h2>
          <p className="mt-2">{fuelle(x.heute.vor_start_text, { n: h.vor_start.anzahl, datum: datumLang(h.vor_start.seit, s) })}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={vorStartErledigt}>
              <button className="knopf">{x.heute.vor_start_ja}</button>
            </form>
            <Link href="/pflichten?status=ueberfaellig" className="knopf knopf-leise">
              {x.heute.vor_start_einzeln}
            </Link>
          </div>
        </section>
      ) : null}

      {nochNichtBerechnet ? <p className="lesetext text-tinte-leise">{x.heute.berechnung_laeuft}</p> : null}

      {!ohneProfil && !nochNichtBerechnet ? (
        <section aria-labelledby="naechstes">
          <h2 id="naechstes" className="text-gross font-bold">
            {x.heute.als_naechstes}
          </h2>
          <p className="mt-1 text-klein text-tinte-leise">
            {[
              fuelle(x.heute.zaehler_offen, { n: h.zaehler.offen }),
              h.zaehler.ueberfaellig ? fuelle(x.heute.zaehler_ueberfaellig, { n: h.zaehler.ueberfaellig }) : null,
              h.zaehler.angabe_fehlt ? fuelle(x.heute.zaehler_angabe, { n: h.zaehler.angabe_fehlt }) : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {h.als_naechstes.length ? (
            <ul className="mt-3 border-t border-linie">
              {h.als_naechstes.map((k) => (
                <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />
              ))}
            </ul>
          ) : (
            <p className="lesetext mt-4">{x.heute.nichts_offen}</p>
          )}
        </section>
      ) : null}

      {!ohneProfil ? (
        <section aria-labelledby="bereiche">
          <h2 id="bereiche" className="text-gross font-bold">
            {x.heute.bereiche}
          </h2>
          <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {BEREICHE.map((b) => (
              <div key={b} className="flex items-baseline justify-between gap-4 border-b border-linie py-3">
                <dt>{x.bereich[b]}</dt>
                <dd className={`flex items-center gap-1.5 text-klein font-bold ${AMPEL_FARBE[h.ampel[b]]}`}>
                  <StatusForm status={h.ampel[b]} />
                  {x.ampel[h.ampel[b]]}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
