import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { KopierFeld } from "@/komponenten/kopier-feld";
import { EingabeFehler, api, apiAntwort } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Team" };

const LINK_COOKIE = "amtlos_einladung_neu";
const EINLADBAR = ["mitarbeiter", "steuerberater", "admin"] as const;

interface Team {
  mitglieder: { konto_id: string; anzeigename: string; email: string; rolle: "inhaber" | "mitarbeiter" | "steuerberater" | "admin"; ich: boolean }[];
  einladungen: { id: string; email: string; rolle: (typeof EINLADBAR)[number]; laeuft_ab: string }[];
  darf_verwalten: boolean;
}

const berlinerDatum = (zeitpunkt: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(zeitpunkt));

async function einladen(formular: FormData) {
  "use server";
  const r = await apiAntwort("/v1/einladungen", {
    method: "POST",
    body: JSON.stringify({ email: String(formular.get("email") ?? ""), rolle: formular.get("rolle") }),
  });
  if (r.status === 409) redirect("/team?fehler=schon_da");
  if (r.status === 422) {
    const f = ((await r.json()) as { fehler?: { feld: string; meldung: string }[] }).fehler ?? [];
    throw new EingabeFehler(f);
  }
  if (!r.ok) throw new Error(`Einladen: ${r.status}`);
  const e = (await r.json()) as { email: string; link: string };
  // Den Link nur einmal zeigen, nicht in die URL schreiben (Verlauf, Logs) – wie beim Kalender-Abo.
  (await cookies()).set(LINK_COOKIE, JSON.stringify({ email: e.email, link: e.link }), { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/team" });
  revalidatePath("/team");
  redirect("/team");
}

async function widerrufen(id: string) {
  "use server";
  await api(`/v1/einladungen/${id}`, { method: "DELETE" });
  revalidatePath("/team");
}

async function entfernen(kontoId: string) {
  "use server";
  const r = await apiAntwort(`/v1/team/${kontoId}`, { method: "DELETE" });
  if (r.status === 409) redirect("/team?fehler=letzter");
  if (!r.ok && r.status !== 404) throw new Error(`Entfernen: ${r.status}`);
  revalidatePath("/team");
}

export default async function TeamSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, team, { fehler }] = await Promise.all([t(), api<Team>("/v1/team"), searchParams]);
  const neu = (await cookies()).get(LINK_COOKIE)?.value;
  const neuDaten = neu ? (JSON.parse(neu) as { email: string; link: string }) : null;
  const meldung = fehler === "schon_da" ? x.team.fehler_schon_da : fehler === "letzter" ? x.team.fehler_letzter : null;

  return (
    <div className="lesetext space-y-10">
      <header>
        <h1 className="text-titel font-bold">{x.team.titel}</h1>
        <p className="mt-2">{x.team.text}</p>
      </header>

      {meldung ? (
        <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">
          {meldung}
        </p>
      ) : null}

      <ul className="border-t border-linie">
        {team.mitglieder.map((m) => (
          <li key={m.konto_id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linie py-2">
            <div className="min-w-0">
              <p className="font-bold">
                {m.anzeigename}
                {m.ich ? <span className="font-normal text-tinte-leise"> ({x.team.du})</span> : null}
              </p>
              <p className="truncate text-klein text-tinte-leise">
                {x.team.rollen[m.rolle]} · {m.email}
              </p>
            </div>
            {team.darf_verwalten && !m.ich ? (
              <form action={entfernen.bind(null, m.konto_id)}>
                <button className="knopf knopf-leise" aria-label={fuelle(x.team.entfernen_von, { name: m.anzeigename })}>
                  {x.team.entfernen}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {team.darf_verwalten ? (
        <>
          <section aria-labelledby="einladen" className="space-y-4">
            <h2 id="einladen" className="text-gross font-bold">
              {x.team.einladen_titel}
            </h2>
            <p>{x.team.einladen_text}</p>
            {neuDaten ? (
              <div role="status" className="space-y-3 rounded-md bg-amt-hauch p-4">
                <p className="font-bold text-amt">{fuelle(x.team.gesendet, { email: neuDaten.email })}</p>
                <KopierFeld wert={neuDaten.link} knopf={x.team.link_kopieren} erledigt={x.team.link_kopiert} />
                <p className="text-klein">{x.team.link_hinweis}</p>
              </div>
            ) : null}
            <form action={einladen} className="space-y-5">
              <div>
                <label htmlFor="email" className="font-bold">
                  {x.team.email}
                </label>
                <input id="email" name="email" type="email" required autoComplete="off" className="feld mt-2" />
              </div>
              <fieldset>
                <legend className="font-bold">{x.team.rolle}</legend>
                <div className="mt-2 space-y-1">
                  {EINLADBAR.map((r, i) => (
                    <label key={r} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-blatt">
                      <input type="radio" name="rolle" value={r} defaultChecked={i === 0} required className="mt-0.5 size-5 flex-none accent-amt" />
                      <span>
                        <span className="font-bold">{x.team.rollen[r]}</span>
                        <span className="block text-klein text-tinte-leise">{x.team.rollen_text[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="knopf">{x.team.einladen}</button>
            </form>
          </section>

          {team.einladungen.length ? (
            <section aria-labelledby="offen">
              <h2 id="offen" className="text-gross font-bold">
                {x.team.offen_titel}
              </h2>
              <ul className="mt-3 border-t border-linie">
                {team.einladungen.map((e) => (
                  <li key={e.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linie py-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{e.email}</p>
                      <p className="text-klein text-tinte-leise">
                        {x.team.rollen[e.rolle]} · {fuelle(x.team.gueltig_bis, { datum: datumLang(berlinerDatum(e.laeuft_ab), s) })}
                      </p>
                    </div>
                    <form action={widerrufen.bind(null, e.id)}>
                      <button className="knopf knopf-leise" aria-label={fuelle(x.team.widerrufen_von, { email: e.email })}>
                        {x.team.widerrufen}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="text-tinte-leise">{x.team.nur_lesen}</p>
      )}
    </div>
  );
}
