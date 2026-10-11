import { redirect } from "next/navigation";
import { SignJWT } from "jose";
import { konfig } from "@/lib/konfig";
import { sitzung, sitzungSetzen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Anmelden" };

/** Nur AUTH_MODUS=dev (E-062): Anmeldung mit frei wählbarer Kennung, Token wie vom Identity-Provider. */
async function devAnmelden(formular: FormData) {
  "use server";
  const k = konfig();
  if (k.authModus !== "dev") throw new Error("Entwicklungs-Login ist deaktiviert");
  const sub = String(formular.get("kennung") ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!sub) redirect("/anmelden?fehler=1");
  const ablauf = Math.floor(Date.now() / 1000) + 12 * 3600;
  const token = await new SignJWT({ email: `${sub}@example.org`, name: sub })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("amtlos-dev")
    .setExpirationTime(ablauf)
    .sign(new TextEncoder().encode(k.devJwtSecret!));
  await sitzungSetzen({ token, ablauf, sub });
  redirect("/heute");
}

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  if (await sitzung()) redirect("/heute");
  const [{ t: x }, { fehler }] = await Promise.all([t(), searchParams]);
  const dev = konfig().authModus === "dev";
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-titel font-bold">{x.app.name}</p>
      <h1 className="mt-10 text-titel font-bold">{x.anmelden.titel}</h1>
      <p className="mt-2">{x.anmelden.text}</p>
      {fehler ? (
        <p role="alert" className="mt-4 rounded-md border-2 border-frist bg-frist-hauch p-4">
          {x.anmelden.fehler}
        </p>
      ) : null}
      {dev ? (
        <form action={devAnmelden} className="mt-6 space-y-4">
          <p className="rounded-md border-2 border-bald bg-bald-hauch p-3 text-klein">{x.anmelden.dev_hinweis}</p>
          <label htmlFor="kennung" className="block font-bold">
            {x.anmelden.dev_kennung}
          </label>
          <input id="kennung" name="kennung" required autoComplete="username" className="feld" />
          <button className="knopf">{x.anmelden.knopf}</button>
        </form>
      ) : (
        <a href="/auth/anmelden" className="knopf mt-6">
          {x.anmelden.knopf}
        </a>
      )}
    </main>
  );
}
