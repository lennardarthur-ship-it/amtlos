import { Fristblatt } from "@/komponenten/fristblatt";
import { Fusszeile } from "@/komponenten/fusszeile";
import { Markenname } from "@/komponenten/markenname";
import { redirect } from "next/navigation";
import { devAnmelden } from "@amtlos/web-kern/auth-routen";
import { sichererPfad } from "@amtlos/web-kern/pfad";
import { konfig } from "@/lib/konfig";
import { sitzung } from "@/lib/sitzung";
import { t } from "@/lib/sprache";
import { ZONE } from "@/lib/zeit";

export const metadata = { title: "Anmelden" };

/** Nur AUTH_MODUS=dev (E-062): Anmeldung mit frei wählbarer Kennung, Token wie vom Identity-Provider. */
async function devLogin(formular: FormData) {
  "use server";
  const weiter = sichererPfad(formular.get("weiter"));
  if (!(await devAnmelden(String(formular.get("kennung") ?? "")))) redirect(`/anmelden?fehler=1&weiter=${encodeURIComponent(weiter)}`);
  redirect(weiter);
}

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ fehler?: string; weiter?: string; geloescht?: string }> }) {
  const [{ s, t: x }, { fehler, weiter: roh, geloescht }] = await Promise.all([t(), searchParams]);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
  const weiter = sichererPfad(roh);
  if (await sitzung()) redirect(weiter);
  const dev = konfig().authModus === "dev";
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p><Markenname /></p>
      <div className="mt-10 flex items-start gap-5">
        <Fristblatt datum={heute} status="offen" sprache={s} />
        <div>
          <h1 className="text-titel font-bold">{x.anmelden.versprechen}</h1>
          <p className="mt-3">{x.anmelden.versprechen_text}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-1 text-klein text-tinte-leise">
        {x.anmelden.punkte.map((p) => (
          <li key={p} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-amt" />{p}</li>
        ))}
      </ul>
      <h2 className="mt-10 text-gross font-bold">{x.anmelden.titel}</h2>
      <p className="mt-1 text-tinte-leise">{x.anmelden.text}</p>
      {geloescht ? <p role="status" className="mt-4 rounded-md bg-amt-hauch p-4 font-bold text-amt">{x.loeschen.geloescht}</p> : null}
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
      <Fusszeile className="mt-12" />
    </main>
  );
}
