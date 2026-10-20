import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { Fusszeile } from "@/komponenten/fusszeile";
import { KopierFeld } from "@/komponenten/kopier-feld";
import { Markenname } from "@/komponenten/markenname";
import { StatusForm } from "@/komponenten/status";
import { apiAntwort, ich } from "@/lib/api";
import { aktuelleMarke } from "@/lib/marke";
import { unternehmenWaehlen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Mandantenübersicht" };

const LINK_COOKIE = "amtlos_mandant_neu";
type Ampel = "gruen" | "gelb" | "rot";
interface Mandant {
  id: string; name: string; rolle: "inhaber" | "admin" | "steuerberater" | "mitarbeiter"; marke: string | null; profil_vorhanden: boolean;
  zaehler: { offen: number; ueberfaellig: number; angabe_fehlt: number; erledigt: number };
  ampel: Record<string, Ampel>;
  naechste: { pflicht_id: string; periode: string; titel: string; faellig_am: string | null; status: string } | null;
  /** Stand der Inhaber-Einladung (nur für die Kanzlei, solange es keinen Inhaber gibt; M6) */
  einladung: { email: string; laeuft_ab: string; status: "offen" | "abgelaufen" | "angenommen" | "widerrufen" } | null;
}
const FILTER = ["alle", "ueberfaellig", "angabe_fehlt", "einladung"] as const;
type Filter = (typeof FILTER)[number];
const SEITE = 50;

/** Schlechteste Ampel über alle Bereiche. */
const gesamt = (a: Record<string, Ampel>): Ampel => (Object.values(a).includes("rot") ? "rot" : Object.values(a).includes("gelb") ? "gelb" : "gruen");
const FARBE = { gruen: "text-amt", gelb: "text-bald", rot: "text-frist" } as const;

async function oeffnen(id: string, ziel: string) {
  "use server";
  const i = await ich();
  if (!i.unternehmen.some((u) => u.id === id)) redirect("/kanzlei");
  await unternehmenWaehlen(id);
  redirect(ziel.startsWith("/") && !ziel.startsWith("//") ? ziel : "/heute");
}

async function anlegen(f: FormData) {
  "use server";
  const marke = (await aktuelleMarke())?.schluessel ?? null;
  const r = await apiAntwort("/v1/mandanten", { method: "POST", ohneUnternehmen: true, body: JSON.stringify({ name: String(f.get("name") ?? ""), email: String(f.get("email") ?? ""), marke }) });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { fehler?: { meldung: string }[]; meldung?: string };
    redirect(`/kanzlei?fehler=${encodeURIComponent(j.fehler?.map((x) => x.meldung).join("; ") ?? j.meldung ?? `Fehler ${r.status}`)}`);
  }
  const m = (await r.json()) as { einladung: { email: string; link: string } };
  // Link nur einmal zeigen, nie in der URL (wie bei Team-Einladungen)
  (await cookies()).set(LINK_COOKIE, JSON.stringify(m.einladung), { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/kanzlei" });
  revalidatePath("/kanzlei");
  redirect("/kanzlei");
}

/** Inhaber-Einladung erneut senden (M6, UX 8): solange der Mandant keinen Inhaber hat. */
async function erneuern(id: string) {
  "use server";
  const r = await apiAntwort(`/v1/mandanten/${encodeURIComponent(id)}/einladung-erneuern`, { method: "POST", ohneUnternehmen: true, body: "{}" });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { fehler?: { meldung: string }[]; meldung?: string; message?: string };
    redirect(`/kanzlei?fehler=${encodeURIComponent(j.fehler?.map((x) => x.meldung).join("; ") ?? j.meldung ?? j.message ?? `Fehler ${r.status}`)}`);
  }
  const e = (await r.json()) as { email: string; link: string };
  (await cookies()).set(LINK_COOKIE, JSON.stringify({ ...e, erneuert: true }), { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/kanzlei" });
  revalidatePath("/kanzlei");
  redirect("/kanzlei");
}

export default async function KanzleiSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; suche?: string; filter?: string; mehr?: string }> }) {
  const [{ s, t: x }, sp] = await Promise.all([t(), searchParams]);
  const suche = (sp.suche ?? "").slice(0, 100);
  const filter: Filter = FILTER.includes(sp.filter as Filter) ? (sp.filter as Filter) : "alle";
  const anzahl = Math.min(200, Math.max(SEITE, Number(sp.mehr) || SEITE));
  const abfrage = new URLSearchParams({ limit: String(anzahl), ...(suche ? { suche } : {}), ...(filter !== "alle" ? { filter } : {}) });
  const r = await apiAntwort(`/v1/mandanten?${abfrage}`, { ohneUnternehmen: true });
  if (!r.ok) throw new Error(`API /v1/mandanten: ${r.status}`);
  const liste = (await r.json()) as Mandant[];
  const gesamtAnzahl = Number(r.headers.get("x-gesamt") ?? liste.length);
  const fehler = sp.fehler;
  const neu = (await cookies()).get(LINK_COOKIE)?.value;
  const neuDaten = neu ? (JSON.parse(neu) as { email: string; link: string; erneuert?: boolean }) : null;
  const k = x.kanzlei;
  const einladungText = (m: Mandant) => {
    const e = m.einladung!;
    const datum = datumLang(e.laeuft_ab.slice(0, 10), s);
    return e.status === "offen" ? fuelle(k.einladung_offen, { email: e.email, datum }) : e.status === "abgelaufen" ? fuelle(k.einladung_abgelaufen, { email: e.email, datum }) : fuelle(k.einladung_widerrufen, { email: e.email });
  };
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      {/* Kopf mit Weg zurück und Abmelden (G8) */}
      <nav aria-label={k.titel} className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/heute"><Markenname /></Link>
        <div className="flex flex-wrap items-center gap-4 text-klein">
          <Link href="/heute" className="verweis">{k.zurueck}</Link>
          <form action="/auth/abmelden" method="post">
            <button className="verweis">{x.anmelden.abmelden}</button>
          </form>
        </div>
      </nav>
      <header>
        <h1 className="text-titel font-bold">{k.titel}</h1>
        <p className="mt-2">{k.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {neuDaten?.erneuert ? (
        <div role="status" className="space-y-3 rounded-md bg-amt-hauch p-4">
          <p className="font-bold text-amt">{fuelle(k.einladung_erneuert, { email: neuDaten.email })}</p>
          <KopierFeld wert={neuDaten.link} knopf={x.team.link_kopieren} erledigt={x.team.link_kopiert} />
        </div>
      ) : null}

      {/* Suche und Filter (UX 8) */}
      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="suche" className="block text-klein font-bold">{k.suche}</label>
          <input id="suche" name="suche" defaultValue={suche} maxLength={100} placeholder={k.suche_feld} className="feld mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="filter" className="block text-klein font-bold">{k.filter}</label>
          <select id="filter" name="filter" defaultValue={filter} className="feld mt-1 w-auto">
            {FILTER.map((f) => <option key={f} value={f}>{k.filter_werte[f]}</option>)}
          </select>
        </div>
        <button className="knopf knopf-leise">{k.anwenden}</button>
      </form>
      {suche || filter !== "alle" || gesamtAnzahl > liste.length ? <p className="text-klein text-tinte-leise">{fuelle(k.treffer, { n: liste.length, gesamt: gesamtAnzahl })}</p> : null}

      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((m) => {
            const a = gesamt(m.ampel);
            return (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-linie py-4">
                <div className="min-w-0">
                  <h2 className="text-gross font-bold">{m.name}</h2>
                  <p className="text-klein text-tinte-leise">
                    {fuelle(k.rolle, { rolle: x.team.rollen[m.rolle] })}{m.marke ? ` · ${fuelle(k.marke, { marke: m.marke })}` : ""}
                  </p>
                  {m.einladung && m.einladung.status !== "angenommen" ? (
                    <p className={`mt-1 text-klein ${m.einladung.status === "offen" ? "" : "font-bold text-frist"}`}>{einladungText(m)}</p>
                  ) : null}
                  {!m.profil_vorhanden ? (
                    <p className="mt-1 text-klein">{k.ohne_profil}</p>
                  ) : (
                    <>
                      <p className={`mt-1 flex items-center gap-1.5 text-klein font-bold ${FARBE[a]}`}>
                        <StatusForm status={a} />
                        {x.ampel[a]} · {[fuelle(x.heute.zaehler_offen, { n: m.zaehler.offen }), m.zaehler.ueberfaellig ? fuelle(x.heute.zaehler_ueberfaellig, { n: m.zaehler.ueberfaellig }) : null, m.zaehler.angabe_fehlt ? fuelle(x.heute.zaehler_angabe, { n: m.zaehler.angabe_fehlt }) : null].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 text-klein">
                        {m.naechste ? <>{fuelle(k.naechste, { titel: m.naechste.titel })}{m.naechste.faellig_am ? ` · ${fuelle(k.bis, { datum: datumLang(m.naechste.faellig_am, s) })}` : ""}</> : k.nichts_offen}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.einladung && m.einladung.status !== "angenommen" ? (
                    <form action={erneuern.bind(null, m.id)}>
                      <button className="knopf knopf-leise" aria-label={fuelle(k.einladung_erneuern_an, { name: m.name })}>{k.einladung_erneuern}</button>
                    </form>
                  ) : null}
                  <form action={oeffnen.bind(null, m.id, m.profil_vorhanden ? "/heute" : "/onboarding/rechtsform?phase=schnell")}>
                    <button className="knopf knopf-leise" aria-label={`${k.oeffnen}: ${m.name}`}>{k.oeffnen}</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{suche || filter !== "alle" ? k.keine_treffer : k.leer}</p>
      )}
      {gesamtAnzahl > liste.length && anzahl < 200 ? (
        <p>
          <Link className="verweis" href={`/kanzlei?${new URLSearchParams({ ...(suche ? { suche } : {}), ...(filter !== "alle" ? { filter } : {}), mehr: String(Math.min(200, anzahl + SEITE)) })}`}>{k.weitere}</Link>
        </p>
      ) : null}

      <section aria-labelledby="neu" className="max-w-xl space-y-4">
        <h2 id="neu" className="text-gross font-bold">{k.neu_titel}</h2>
        <p>{k.neu_text}</p>
        {neuDaten && !neuDaten.erneuert ? (
          <div role="status" className="space-y-3 rounded-md bg-amt-hauch p-4">
            <p className="font-bold text-amt">{k.angelegt}</p>
            <KopierFeld wert={neuDaten.link} knopf={x.team.link_kopieren} erledigt={x.team.link_kopiert} />
          </div>
        ) : null}
        <form action={anlegen} className="space-y-4">
          <div>
            <label htmlFor="name" className="block font-bold">{k.name}</label>
            <input id="name" name="name" required maxLength={200} autoComplete="organization" className="feld mt-1" />
          </div>
          <div>
            <label htmlFor="email" className="block font-bold">{k.email}</label>
            <input id="email" name="email" type="email" required maxLength={200} autoComplete="off" className="feld mt-1" />
          </div>
          <button className="knopf">{k.anlegen}</button>
        </form>
      </section>
      <Fusszeile className="border-t border-linie pt-4" />
    </main>
  );
}
