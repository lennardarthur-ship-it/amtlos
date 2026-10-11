import Link from "next/link";
import { revalidatePath } from "next/cache";
import { datumLang, fuelle } from "@amtlos/i18n";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { StatusForm } from "@/komponenten/status";
import { api } from "@/lib/api";
import { branchenAusProfil } from "@/lib/branchen";
import { t } from "@/lib/sprache";
import { ZONE } from "@/lib/zeit";
import type { Bereich, Gruendung, Heute } from "@/lib/typen";

export const metadata = { title: "Heute" };

const BEREICHE: Bereich[] = ["steuern", "personal", "arbeitsschutz", "datenschutz", "online", "gesellschaft"];
const AMPEL_FARBE = { gruen: "text-amt", gelb: "text-bald", rot: "text-frist" } as const;

interface Meldung { id: string; titel: string; text: string; link: string | null; gelesen_am: string | null; erstellt_am: string }
interface Termin { id: string; art: "brief" | "pruefung"; datum: string; titel: string; link: string }

async function gelesen(f: FormData) {
  "use server";
  const id = f.get("id");
  await api("/v1/benachrichtigungen/gelesen", { method: "POST", body: JSON.stringify(id ? { ids: [String(id)] } : {}) });
  revalidatePath("/heute");
}

async function vorStartErledigt() {
  "use server";
  await api("/v1/pflichten/vor-start-erledigt", { method: "POST" });
  revalidatePath("/heute");
}

export default async function HeuteSeite() {
  const [{ s, t: x }, h, profil, g] = await Promise.all([t(), api<Heute>("/v1/heute"), api<{ version: number; daten?: Record<string, unknown> }>("/v1/profil"), api<Gruendung>("/v1/gruendung")]);
  const [meldungen, termine] = await Promise.all([api<Meldung[]>("/v1/benachrichtigungen"), api<Termin[]>("/v1/termine")]);
  const ungelesen = meldungen.filter((m) => !m.gelesen_am).slice(0, 5);
  const ortsdatum = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(d);
  const bis = ortsdatum(new Date(Date.now() + 60 * 864e5));
  const naheTermine = termine.filter((w) => w.datum <= bis).slice(0, 5);
  const heuteIso = ortsdatum(new Date());
  const gruendungOffen = g.fortschritt.gesamt > 0 && !g.fortschritt.fertig;
  const branchen = branchenAusProfil((profil as { daten?: Record<string, unknown> }).daten ?? {});
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

      {ungelesen.length ? (
        <section aria-labelledby="meldungen" className="lesetext rounded-md border-2 border-amt bg-blatt p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="meldungen" className="text-gross font-bold">{x.meldungen.titel}</h2>
            <form action={gelesen}>
              <button className="verweis text-klein">{x.meldungen.alle_gelesen}</button>
            </form>
          </div>
          <ul className="mt-3 space-y-3">
            {ungelesen.map((m) => (
              <li key={m.id} className="border-t border-linie pt-3">
                <p className="font-bold">{m.link ? <Link href={m.link} className="verweis">{m.titel}</Link> : m.titel}</p>
                <p className="text-klein">{m.text}</p>
                <form action={gelesen} className="mt-1">
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-klein text-tinte-leise underline">{x.meldungen.gelesen}</button>
                </form>
              </li>
            ))}
          </ul>
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

      {gruendungOffen ? (
        <section aria-labelledby="gruendung" className="lesetext rounded-md border-2 border-amt bg-blatt p-6">
          <h2 id="gruendung" className="text-gross font-bold">
            {fuelle(x.gruendung.heute_karte, { n: g.fortschritt.erledigt, gesamt: g.fortschritt.gesamt })}
          </h2>
          <progress className="mt-3 h-2 w-full accent-amt" value={g.fortschritt.erledigt} max={g.fortschritt.gesamt} aria-hidden="true" />
          <Link href="/gruendung" className="knopf mt-4">
            {x.gruendung.heute_link}
          </Link>
        </section>
      ) : null}

      {branchen.length ? (
        <p className="lesetext">
          <Link href="/branche" className="verweis">{fuelle(x.branche.heute_karte, { namen: branchen.map((b) => x.branche.namen[b]).join(", ") })}</Link>
        </p>
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

      {naheTermine.length ? (
        <section aria-labelledby="weitere">
          <h2 id="weitere" className="text-gross font-bold">{x.heute.weitere_fristen}</h2>
          <ul className="mt-3 border-t border-linie">
            {naheTermine.map((w) => (
              <li key={`${w.art}|${w.id}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linie py-3">
                <Link href={w.link} className="verweis">{w.titel}</Link>
                <span className={`text-klein font-bold ${w.datum < heuteIso ? "text-frist" : ""}`}>{fuelle(x.pflichten.bis, { datum: datumLang(w.datum, s) })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!ohneProfil ? (
        <form action="/frag" method="get" role="search" className="lesetext flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="heute-frage" className="block font-bold">{x.heute.frag_link}</label>
            <input id="heute-frage" name="f" minLength={3} maxLength={500} placeholder={x.frag.platzhalter} className="feld mt-1 w-full" />
          </div>
          <button className="knopf knopf-leise">{x.frag.fragen}</button>
          <Link href="/radar" className="verweis w-full text-klein">{x.heute.radar_link}</Link>
        </form>
      ) : null}

      {!ohneProfil ? (
        <p className="lesetext flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>{x.heute.melden_frage}</span>
          <Link href="/melden" className="knopf knopf-leise">{x.heute.melden_link}</Link>
          <Link href="/datenschutz/pannen#melden" className="verweis text-klein">{x.ds.notfall}</Link>
        </p>
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
