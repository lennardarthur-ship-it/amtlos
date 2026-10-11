import Link from "next/link";
import { VerweisZeile } from "@/komponenten/verweis-zeile";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { datumLang, fuelle, sichtbareSchritte } from "@amtlos/i18n";
import { redirect } from "next/navigation";
import { senden } from "@/lib/aktion";
import { api, apiAntwort, aktivesUnternehmen } from "@/lib/api";
import { sitzungBeenden } from "@/lib/sitzung";
import type { Abo } from "./abo/page";
import { SPRACH_COOKIE, t } from "@/lib/sprache";

export const metadata = { title: "Einstellungen" };

async function spracheSetzen(formular: FormData) {
  "use server";
  const s = formular.get("sprache") === "en" ? "en" : "de";
  (await cookies()).set(SPRACH_COOKIE, s, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // Auch fürs Konto speichern: E-Mails und Benachrichtigungen kommen dann in dieser Sprache
  await apiAntwort("/v1/ich/sprache", { method: "PUT", ohneUnternehmen: true, body: JSON.stringify({ sprache: s }) }).catch(() => undefined);
  revalidatePath("/", "layout");
}

interface Kanal { kanal: "email" | "push"; aktiv: boolean; vorlauf_tage: number[] }

async function erinnerungenSetzen(f: FormData) {
  "use server";
  const tage = (k: string) => [...new Set(String(f.get(`${k}_tage`) ?? "").split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 90))].sort((a, b) => b - a).slice(0, 5);
  const kanaele = (["email", "push"] as const).map((k) => ({ kanal: k, aktiv: f.get(`${k}_aktiv`) === "on", vorlauf_tage: tage(k).length ? tage(k) : [14, 3] }));
  await senden("/v1/benachrichtigungen/einstellungen", "PUT", { kanaele }, "/einstellungen");
  revalidatePath("/einstellungen");
  redirect("/einstellungen?gespeichert=erinnerungen#erinnerungen");
}

async function unternehmenLoeschen(f: FormData) {
  "use server";
  await senden("/v1/unternehmen", "DELETE", { name: String(f.get("name") ?? "") }, "/einstellungen#loeschen");
  redirect("/unternehmen?geloescht=1");
}

async function kontoLoeschen() {
  "use server";
  const r = await apiAntwort("/v1/ich/loeschen", { method: "POST", ohneUnternehmen: true });
  if (r.status === 409) redirect(`/einstellungen?fehler=${encodeURIComponent("Zuerst alle Unternehmen löschen oder verlassen")}#loeschen`);
  await sitzungBeenden();
  redirect("/anmelden?geloescht=1");
}

export default async function Einstellungen({ searchParams }: { searchParams: Promise<{ gespeichert?: string; fehler?: string }> }) {
  const [{ s, t: x }, profil, erinnerung, { gespeichert, fehler }, u, abo] = await Promise.all([
    t(),
    api<{ daten: Record<string, unknown> }>("/v1/profil"),
    api<{ geraet_vorhanden: boolean; kanaele: Kanal[] }>("/v1/benachrichtigungen/einstellungen"),
    searchParams,
    aktivesUnternehmen(),
    api<Abo>("/v1/abo"),
  ]);
  const darfVerwalten = u.rolle === "inhaber" || u.rolle === "admin";
  return (
    <div className="lesetext space-y-10">
      <h1 className="text-titel font-bold">{x.einstellungen.titel}</h1>

      <section aria-labelledby="profil">
        <h2 id="profil" className="text-gross font-bold">
          {x.einstellungen.profil}
        </h2>
        <p className="mt-1 text-tinte-leise">{x.einstellungen.profil_text}</p>
        <ul className="mt-3 border-t border-linie">
          {sichtbareSchritte(profil.daten).map((schritt) => (
            <VerweisZeile key={schritt.id} href={`/onboarding/${schritt.id}?zurueck=/einstellungen`} titel={schritt.titel[s]} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="erinnerungen" className="space-y-3">
        <h2 id="erinnerungen" className="text-gross font-bold">{x.einstellungen.erinnerungen}</h2>
        <p className="text-tinte-leise">{x.einstellungen.erinnerungen_text}</p>
        {gespeichert === "erinnerungen" ? <p role="status" className="rounded-md bg-amt-hauch p-3 font-bold text-amt">{x.einstellungen.gespeichert}</p> : null}
        {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-3">{fehler}</p> : null}
        <form action={erinnerungenSetzen} className="space-y-4">
          {erinnerung.kanaele.map((k) => (
            <fieldset key={k.kanal} className="space-y-2 rounded-md border border-linie p-3">
              <legend className="px-1 font-bold">{x.einstellungen.kanal[k.kanal]}</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" name={`${k.kanal}_aktiv`} defaultChecked={k.aktiv} className="size-5" disabled={k.kanal === "push" && !erinnerung.geraet_vorhanden} />
                {x.einstellungen.aktiv}
              </label>
              {k.kanal === "push" && !erinnerung.geraet_vorhanden ? <p className="text-klein text-tinte-leise">{x.einstellungen.push_ohne_geraet}</p> : null}
              <div>
                <label htmlFor={`${k.kanal}_tage`} className="block text-klein font-bold">{x.einstellungen.vorlauf}</label>
                <input id={`${k.kanal}_tage`} name={`${k.kanal}_tage`} defaultValue={k.vorlauf_tage.join(", ")} inputMode="numeric" className="feld mt-1 max-w-48" aria-describedby={`${k.kanal}_tage_hilfe`} />
                <p id={`${k.kanal}_tage_hilfe`} className="mt-1 text-klein text-tinte-leise">{x.einstellungen.vorlauf_hilfe}</p>
              </div>
            </fieldset>
          ))}
          <button className="knopf knopf-leise">{x.einstellungen.erinnerungen_speichern}</button>
        </form>
      </section>

      <section aria-labelledby="sprache">
        <h2 id="sprache" className="text-gross font-bold">
          {x.einstellungen.sprache}
        </h2>
        <form action={spracheSetzen} className="mt-3 flex flex-wrap items-center gap-3">
          <select name="sprache" defaultValue={s} className="feld max-w-48" aria-labelledby="sprache">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          <button className="knopf knopf-leise">{x.einstellungen.sprache_speichern}</button>
        </form>
      </section>

      <section aria-labelledby="abo-titel" className="rounded-md border border-linie bg-blatt p-4">
        <h2 id="abo-titel" className="text-gross font-bold">{x.abo.titel}</h2>
        <p className="mt-1">
          <span className="font-bold">{x.abo.status[abo.status]}</span>
          {abo.status === "test" ? ` · ${fuelle(x.abo.test_laeuft, { n: Math.max(0, Math.round((Date.parse(abo.test_bis) - Date.now()) / 864e5)), datum: datumLang(abo.test_bis, s) })}` : ""}
        </p>
        <Link href="/einstellungen/abo" className="knopf knopf-leise mt-3">{abo.status === "test" || abo.status === "abgelaufen" ? x.abo.abschliessen : x.abo.verwalten}</Link>
      </section>

      <section aria-labelledby="loeschen" id="loeschen" className="space-y-4">
        <h2 id="loeschen-titel" className="text-gross font-bold">{x.loeschen.titel}</h2>
        {darfVerwalten ? (
          <p>
            <a href="/einstellungen/export" className="verweis font-bold">{x.loeschen.export}</a>
            <span className="block text-klein text-tinte-leise">{x.loeschen.export_text}</span>
          </p>
        ) : null}
        {u.rolle === "inhaber" ? (
          <details className="rounded-md border border-linie p-4">
            <summary className="cursor-pointer font-bold">{x.loeschen.unternehmen_titel}</summary>
            <p className="mt-2 text-klein">{x.loeschen.unternehmen_text}</p>
            <form action={unternehmenLoeschen} className="mt-3 space-y-2">
              <label htmlFor="loesch-name" className="block text-klein font-bold">{fuelle(x.loeschen.unternehmen_bestaetigen, { name: u.name })}</label>
              <input id="loesch-name" name="name" required autoComplete="off" className="feld" />
              <button className="knopf knopf-notfall">{x.loeschen.unternehmen_knopf}</button>
            </form>
          </details>
        ) : null}
        <details className="rounded-md border border-linie p-4">
          <summary className="cursor-pointer font-bold">{x.loeschen.konto_titel}</summary>
          <p className="mt-2 text-klein">{x.loeschen.konto_text}</p>
          <form action={kontoLoeschen} className="mt-3">
            <button className="knopf knopf-notfall">{x.loeschen.konto_knopf}</button>
          </form>
        </details>
      </section>

      <ul className="space-y-2">
        <li>
          <Link href="/team" className="verweis">{x.team.link}</Link>
        </li>
        <li>
          <Link href="/hilfe" className="verweis">{x.hilfe.link}</Link>
        </li>
      </ul>

      <form action="/auth/abmelden" method="post">
        <button className="knopf knopf-leise">{x.anmelden.abmelden}</button>
      </form>
    </div>
  );
}
