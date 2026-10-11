import { redirect } from "next/navigation";
import { devAnmelden } from "@amtlos/web-kern/auth-routen";
import { konfig } from "@amtlos/web-kern/konfig";
import { sitzung } from "@amtlos/web-kern/sitzung";

export const metadata = { title: "Anmelden" };

async function devLogin(formular: FormData) {
  "use server";
  if (!(await devAnmelden(String(formular.get("kennung") ?? "")))) redirect("/anmelden?fehler=1");
  redirect("/");
}

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  if (await sitzung()) redirect("/");
  const { fehler } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-titel font-bold">Amtlos Studio</h1>
      <p className="mt-2">Für Redaktion und fachliche Prüfung des Pflichtenkatalogs.</p>
      {fehler ? <p role="alert" className="mt-4 rounded-md border-2 border-frist bg-frist-hauch p-4">Die Anmeldung hat nicht geklappt. Bitte versuche es noch einmal.</p> : null}
      {konfig().authModus === "dev" ? (
        <form action={devLogin} className="mt-6 space-y-4">
          <p className="rounded-md border-2 border-bald bg-bald-hauch p-3 text-klein">Entwicklungsumgebung: Anmeldung mit der Kennung eines Kontos, das eine Plattformrolle hat.</p>
          <label htmlFor="kennung" className="block font-bold">Kennung</label>
          <input id="kennung" name="kennung" required className="feld" />
          <button className="knopf">Anmelden</button>
        </form>
      ) : (
        <a href="/auth/anmelden" className="knopf mt-6">Anmelden</a>
      )}
    </main>
  );
}
