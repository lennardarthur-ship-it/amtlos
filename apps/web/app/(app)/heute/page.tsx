import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle, offeneFragen, schritteJePhase, fragenJePhase } from "@amtlos/i18n";
import { AutoAktualisieren } from "@/komponenten/auto-aktualisieren";
import { Fristblatt } from "@/komponenten/fristblatt";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { StatusForm, StatusText } from "@/komponenten/status";
import { senden } from "@/lib/aktion";
import { aktivesUnternehmen, api, apiAntwort, darfVerwalten } from "@/lib/api";
import { branchenAusProfil } from "@/lib/branchen";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";
import { ZONE } from "@/lib/zeit";
import type { Bereich, Gruendung, Heute, Karte } from "@/lib/typen";

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
  // senden(): bei 4xx verständlicher Text auf der Seite statt Fehlerseite (H3)
  await senden("/v1/pflichten/vor-start-erledigt", "POST", undefined, "/heute");
  revalidatePath("/heute");
}

/** „Rückgängig“ nach dem Erledigen (UX 5): öffnet die Pflicht wieder. */
async function rueckgaengig(schluessel: string) {
  "use server";
  const [pflichtId = "", periode = ""] = schluessel.split("|");
  await senden(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}/wieder-oeffnen`, "POST", undefined, "/heute");
  revalidatePath("/heute");
  redirect(`/heute?wieder=${encodeURIComponent(schluessel)}`);
}

/** Titel einer Pflicht für Bestätigungen; ohne Treffer (z. B. inzwischen entfallen) leer. */
async function titelVon(schluessel: string | undefined): Promise<string | null> {
  const [pflichtId, periode] = (schluessel ?? "").split("|");
  if (!pflichtId || !periode) return null;
  const r = await apiAntwort(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}`);
  return r.ok ? ((await r.json()) as { titel: string }).titel : null;
}

/** Nach so vielen Sekunden ohne fertigen Plan zeigt „Heute“ statt „Einen Moment“ einen Hinweis mit Ausweg (UX 3). */
const GEDULD_S = 30;

const pfadZu = (k: Karte) => `/pflichten/${encodeURIComponent(k.pflicht_id)}/${encodeURIComponent(k.periode)}`;

/**
 * „Heute“ (Spezifikation 6.1, E-112): eine klare nächste Handlung statt einer Liste. Reihenfolge: Willkommen (einmal),
 * das eine Ding jetzt, danach, Gründung, Nachfragen, Rest. Fehlende Angaben erscheinen gebündelt als Fragen.
 */
export default async function HeuteSeite({ searchParams }: { searchParams: Promise<{ willkommen?: string; erledigt?: string; wieder?: string; fehler?: string }> }) {
  const [{ s, t: x }, h, profil, g, { willkommen, erledigt, wieder, fehler }, u] = await Promise.all([
    t(),
    api<Heute>("/v1/heute"),
    api<{ version: number; daten?: Record<string, unknown> }>("/v1/profil"),
    api<Gruendung>("/v1/gruendung"),
    searchParams,
    aktivesUnternehmen(),
  ]);
  const verwalten = darfVerwalten(u.rolle);
  const [erledigtTitel, wiederTitel] = await Promise.all([titelVon(erledigt), titelVon(wieder)]);
  const [meldungen, termine] = await Promise.all([api<Meldung[]>("/v1/benachrichtigungen"), api<Termin[]>("/v1/termine")]);
  const daten = profil.daten ?? {};
  const ohneProfil = profil.version === 0;
  // Der Plan gilt erst als fertig, wenn er zur letzten Profilversion passt (M5) – nicht schon bei Zwischenständen
  const stand = h.berechnung?.status ?? (h.zaehler.offen + h.zaehler.erledigt === 0 && h.als_naechstes.length === 0 ? "laeuft" : "aktuell");
  const nochNichtBerechnet = !ohneProfil && stand !== "aktuell";
  const wartetSeit = h.berechnung?.seit ? (Date.now() - Date.parse(h.berechnung.seit)) / 1000 : 0;
  // Fehler des Workers (H2) oder ungewöhnlich lange Wartezeit: Ausweg anbieten statt endlos „Einen Moment“ (UX 3)
  const berechnungHaengt = nochNichtBerechnet && (stand === "fehlgeschlagen" || wartetSeit > GEDULD_S);
  const gruendungOffen = g.fortschritt.gesamt > 0 && !g.fortschritt.fertig;
  const branchen = branchenAusProfil(daten);
  const nachfragen = ohneProfil || !verwalten ? 0 : offeneFragen(daten);
  const naechsteRunde = nachfragen ? schritteJePhase("nachfragen", daten)[0] : undefined;
  const ungelesen = meldungen.filter((m) => !m.gelesen_am).slice(0, 5);
  const ortsdatum = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(d);
  const heuteIso = ortsdatum(new Date());
  const bis = ortsdatum(new Date(Date.now() + 60 * 864e5));
  const naheTermine = termine.filter((w) => w.datum <= bis).slice(0, 5);
  const [jetzt, ...danach] = h.als_naechstes;
  const gesamt = h.zaehler.klar + h.zaehler.erledigt;
  const anteil = gesamt ? Math.round((h.zaehler.erledigt / gesamt) * 100) : 0;

  return (
    <div className="space-y-10">
      <h1 className="text-titel font-bold">{x.heute.titel}</h1>

      {ohneProfil ? (
        <section className="lesetext rounded-md border-2 border-dashed border-amt bg-blatt p-6">
          <p className="text-gross">{verwalten ? x.heute.profil_fehlt : x.rolle.mitarbeiter_hinweis}</p>
          {verwalten ? (
            <Link href="/onboarding/rechtsform?phase=schnell" className="knopf mt-5">
              {x.heute.profil_starten}
            </Link>
          ) : null}
        </section>
      ) : null}

      {fehler ? (
        <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p>
      ) : null}

      {nochNichtBerechnet && !berechnungHaengt ? (
        <section className="lesetext rounded-md border-2 border-amt bg-blatt p-6" aria-live="polite">
          <AutoAktualisieren />
          <p className="text-gross font-bold">{x.heute.berechnung_titel}</p>
          <p className="mt-2 text-tinte-leise">{x.heute.berechnung_laeuft}</p>
        </section>
      ) : null}

      {berechnungHaengt ? (
        <section role="alert" className="lesetext rounded-md border-2 border-bald bg-bald-hauch p-6">
          {stand === "fehlgeschlagen" ? null : <AutoAktualisieren alleMs={10_000} hoechstens={30} />}
          <p className="text-gross font-bold">{stand === "fehlgeschlagen" ? x.heute.berechnung_fehler_titel : x.heute.berechnung_titel}</p>
          <p className="mt-2">{stand === "fehlgeschlagen" ? x.heute.berechnung_fehler_text : x.heute.berechnung_langsam_text}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {verwalten ? <Link href="/einstellungen#profil" className="knopf">{x.heute.angaben_pruefen}</Link> : null}
            <Link href="/heute" className="knopf knopf-leise">{x.heute.neu_laden}</Link>
          </div>
        </section>
      ) : null}

      {willkommen && !nochNichtBerechnet && !ohneProfil ? (
        <section aria-labelledby="willkommen" className="lesetext rounded-md border-2 border-amt bg-amt-hauch p-6">
          <h2 id="willkommen" className="text-gross font-bold">{x.heute.willkommen_titel}</h2>
          <p className="mt-2">{fuelle(x.heute.willkommen_text, { n: h.zaehler.klar, bald: h.zaehler.naechste_90 })}</p>
          <p className="mt-2">{x.heute.willkommen_ruhe}</p>
        </section>
      ) : null}

      {erledigt && !ohneProfil ? (
        <div role="status" className="lesetext flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-amt-hauch p-4 font-bold text-amt">
          <span className="stempel">{x.status.erledigt}</span>
          {/* Was wurde erledigt – mit „Rückgängig“ (UX 5) */}
          {erledigtTitel ? <span>{fuelle(x.heute.erledigt_was, { titel: erledigtTitel })}</span> : null}
          <span className="font-normal">{h.zaehler.klar ? fuelle(x.heute.erledigt_weiter, { n: h.zaehler.erledigt, offen: h.zaehler.naechste_90 }) : x.heute.erledigt_alles}</span>
          {erledigtTitel && verwalten ? (
            <form action={rueckgaengig.bind(null, erledigt)}>
              <button className="verweis text-klein">{x.heute.rueckgaengig}</button>
            </form>
          ) : null}
        </div>
      ) : null}
      {wiederTitel ? (
        <p role="status" className="lesetext rounded-md bg-blatt p-4">{fuelle(x.heute.rueckgaengig_fertig, { titel: wiederTitel })}</p>
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

      {/* Bei neuen Konten zuerst (UX 1): sonst stehen oben lauter rote „Überfällig seit …“ aus der Zeit vor Amtlos */}
      {h.vor_start.anzahl > 0 && h.vor_start.seit && verwalten && !nochNichtBerechnet ? (
        <section aria-labelledby="vorstart" className="rounded-md border-2 border-amt bg-blatt p-5">
          <h2 id="vorstart" className="font-bold">
            {x.heute.vor_start_titel}
          </h2>
          <p className="lesetext mt-1 text-klein">{fuelle(x.heute.vor_start_text, { n: h.vor_start.anzahl, datum: datumLang(h.vor_start.seit, s) })}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={vorStartErledigt}>
              <button className="knopf">{x.heute.vor_start_ja}</button>
            </form>
            <Link href="/pflichten?status=ueberfaellig" className="verweis self-center text-klein">
              {x.heute.vor_start_einzeln}
            </Link>
          </div>
        </section>
      ) : null}

      {!ohneProfil && !nochNichtBerechnet ? (
        <section aria-labelledby="naechstes">
          <h2 id="naechstes" className="text-gross font-bold">{jetzt ? x.heute.jetzt_dran : x.heute.als_naechstes}</h2>
          {jetzt ? (
            <article className={`mt-3 rounded-md border-2 bg-blatt p-5 ${jetzt.status === "ueberfaellig" ? "border-frist" : jetzt.status === "faellig_bald" ? "border-bald" : "border-linie"}`}>
              <div className="flex gap-4 sm:gap-5">
                <Fristblatt datum={jetzt.faellig_am} status={jetzt.status} sprache={s} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-gross font-bold">{jetzt.titel}</h3>
                  <p className="lesetext mt-1">{jetzt.kurz}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-klein">
                    <StatusText status={jetzt.status} sprache={s} />
                    {jetzt.faellig_am ? <span>{fuelle(x.pflichten.bis, { datum: datumLang(jetzt.faellig_am, s) })}</span> : null}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={pfadZu(jetzt)} className="knopf">{x.heute.jetzt_oeffnen}</Link>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <p className="lesetext mt-3 rounded-md bg-amt-hauch p-5 font-bold text-amt">{x.heute.nichts_offen}</p>
          )}
          {danach.length ? (
            <>
              <h3 className="mt-6 text-klein font-bold text-tinte-leise">{x.heute.danach}</h3>
              <ul className="mt-1 border-t border-linie">
                {danach.map((k) => (
                  <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-klein text-tinte-leise">
            <span>{fuelle(x.heute.zaehler_offen, { n: h.zaehler.klar })}</span>
            {h.zaehler.ueberfaellig ? <span className="font-bold text-frist">{fuelle(x.heute.zaehler_ueberfaellig, { n: h.zaehler.ueberfaellig })}</span> : null}
            {h.zaehler.erledigt ? <span>{fuelle(x.heute.zaehler_erledigt, { n: h.zaehler.erledigt, prozent: anteil })}</span> : null}
            <Link href="/pflichten" className="verweis">{x.heute.alle_pflichten}</Link>
          </p>
        </section>
      ) : null}

      {gruendungOffen ? (
        <section aria-labelledby="gruendung" className="rounded-md border border-linie bg-blatt p-5">
          <h2 id="gruendung" className="text-gross font-bold">
            {fuelle(x.gruendung.heute_karte, { n: g.fortschritt.erledigt, gesamt: g.fortschritt.gesamt })}
          </h2>
          <progress className="mt-3 h-2 w-full accent-amt" value={g.fortschritt.erledigt} max={g.fortschritt.gesamt} aria-hidden="true" />
          <Link href="/gruendung" className="knopf mt-4">
            {x.gruendung.heute_link}
          </Link>
        </section>
      ) : null}

      {naechsteRunde && !nochNichtBerechnet ? (
        <section aria-labelledby="nachfragen" className="rounded-md border border-linie bg-blatt p-5">
          <h2 id="nachfragen" className="font-bold">{x.onboarding.nachfragen_titel}</h2>
          <p className="lesetext mt-1">
            {fuelle(x.heute.nachfragen_runde, { thema: naechsteRunde.titel[s], n: fragenJePhase(naechsteRunde, "nachfragen", daten).length })}
            {" "}
            <span className="text-tinte-leise">{fuelle(x.heute.nachfragen_rest, { n: nachfragen, pflichten: h.zaehler.angabe_fehlt })}</span>
          </p>
          <Link href={`/onboarding/${naechsteRunde.id}?phase=nachfragen`} className="knopf knopf-leise mt-3">
            {x.onboarding.nachfragen_knopf}
          </Link>
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

      {branchen.length && pfadSichtbar("/branche") ? (
        <p className="lesetext">
          <Link href="/branche" className="verweis">{fuelle(x.branche.heute_karte, { namen: branchen.map((b) => x.branche.namen[b]).join(", ") })}</Link>
        </p>
      ) : null}

      {!ohneProfil && pfadSichtbar("/frag") ? (
        <form action="/frag" method="get" role="search" className="lesetext flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="heute-frage" className="block font-bold">{x.heute.frag_link}</label>
            <input id="heute-frage" name="f" minLength={3} maxLength={500} placeholder={x.frag.platzhalter} className="feld mt-1 w-full" />
          </div>
          <button className="knopf knopf-leise">{x.frag.fragen}</button>
          {pfadSichtbar("/radar") ? <Link href="/radar" className="verweis w-full text-klein">{x.heute.radar_link}</Link> : null}
        </form>
      ) : null}

      {!ohneProfil && verwalten ? (
        <p className="lesetext flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>{x.heute.melden_frage}</span>
          <Link href="/melden" className="knopf knopf-leise">{x.heute.melden_link}</Link>
          {pfadSichtbar("/datenschutz") ? <Link href="/datenschutz/pannen#melden" className="verweis text-klein">{x.ds.notfall}</Link> : null}
        </p>
      ) : null}

      {!ohneProfil && !nochNichtBerechnet ? (
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
