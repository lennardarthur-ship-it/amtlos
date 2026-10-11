import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { KopierFeld } from "@/komponenten/kopier-feld";
import { Markenname } from "@/komponenten/markenname";
import { StatusForm } from "@/komponenten/status";
import { apiAntwort, apiOhneUnternehmen, ich } from "@/lib/api";
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
}

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

export default async function KanzleiSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }] = await Promise.all([t(), apiOhneUnternehmen<Mandant[]>("/v1/mandanten"), searchParams]);
  const neu = (await cookies()).get(LINK_COOKIE)?.value;
  const neuDaten = neu ? (JSON.parse(neu) as { email: string; link: string }) : null;
  const k = x.kanzlei;
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <p><Link href="/heute"><Markenname /></Link></p>
      <header>
        <h1 className="text-titel font-bold">{k.titel}</h1>
        <p className="mt-2">{k.text}</p>
      </header>
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
                <form action={oeffnen.bind(null, m.id, m.profil_vorhanden ? "/heute" : "/onboarding/rechtsform")}>
                  <button className="knopf knopf-leise" aria-label={`${k.oeffnen}: ${m.name}`}>{k.oeffnen}</button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{k.leer}</p>
      )}

      <section aria-labelledby="neu" className="max-w-xl space-y-4">
        <h2 id="neu" className="text-gross font-bold">{k.neu_titel}</h2>
        <p>{k.neu_text}</p>
        {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
        {neuDaten ? (
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
    </main>
  );
}
