import { redirect } from "next/navigation";
import { devAnmelden } from "@amtlos/web-kern/auth-routen";
import { sichererPfad } from "@amtlos/web-kern/pfad";
import { konfig } from "@/lib/konfig";
import { sitzung } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Anmelden" };

/** Nur AUTH_MODUS=dev (E-062): Anmeldung mit frei wählbarer Kennung, Token wie vom Identity-Provider. */
async function devLogin(formular: FormData) {
  "use server";
  const weiter = sichererPfad(formular.get("weiter"));
  if (!(await devAnmelden(String(formular.get("kennung") ?? "")))) redirect(`/anmelden?fehler=1&weiter=${encodeURIComponent(weiter)}`);
  redirect(weiter);
}

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ fehler?: string; weiter?: string }> }) {
  const [{ t: x }, { fehler, weiter: roh }] = await Promise.all([t(), searchParams]);
  const weiter = sichererPfad(roh);
  if (await sitzung()) redirect(weiter);
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
        <form action={devLogin} className="mt-6 space-y-4">
          <p className="rounded-md border-2 border-bald bg-bald-hauch p-3 text-klein">{x.anmelden.dev_hinweis}</p>
          <label htmlFor="kennung" className="block font-bold">
            {x.anmelden.dev_kennung}
          </label>
          <input id="kennung" name="kennung" required autoComplete="username" className="feld" />
          <input type="hidden" name="weiter" value={weiter} />
          <button className="knopf">{x.anmelden.knopf}</button>
        </form>
      ) : (
        <a href={weiter === "/heute" ? "/auth/anmelden" : `/auth/anmelden?weiter=${encodeURIComponent(weiter)}`} className="knopf mt-6">
          {x.anmelden.knopf}
        </a>
      )}
    </main>
  );
}
