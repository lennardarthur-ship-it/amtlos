import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sichtbareSchritte } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { SPRACH_COOKIE, t } from "@/lib/sprache";

export const metadata = { title: "Einstellungen" };

async function spracheSetzen(formular: FormData) {
  "use server";
  const s = formular.get("sprache") === "en" ? "en" : "de";
  (await cookies()).set(SPRACH_COOKIE, s, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export default async function Einstellungen() {
  const [{ s, t: x }, profil] = await Promise.all([t(), api<{ daten: Record<string, unknown> }>("/v1/profil")]);
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
            <li key={schritt.id} className="border-b border-linie">
              <Link href={`/onboarding/${schritt.id}?zurueck=/einstellungen`} className="flex min-h-12 items-center hover:underline">
                {schritt.titel[s]}
              </Link>
            </li>
          ))}
        </ul>
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
