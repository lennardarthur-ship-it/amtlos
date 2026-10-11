import Link from "next/link";
import { redirect } from "next/navigation";
import { apiAntwort, ich } from "@/lib/api";
import { sitzungBeenden, unternehmenWaehlen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Unternehmen wechseln" };

async function waehlen(id: string) {
  "use server";
  const i = await ich();
  if (!i.unternehmen.some((u) => u.id === id)) redirect("/unternehmen");
  await unternehmenWaehlen(id);
  redirect("/heute");
}

/** Ohne Unternehmen: Konto hier löschen (die Einstellungen brauchen ein aktives Unternehmen). */
async function kontoLoeschen() {
  "use server";
  const r = await apiAntwort("/v1/ich/loeschen", { method: "POST", ohneUnternehmen: true });
  if (r.status === 409) redirect("/unternehmen");
  await sitzungBeenden();
  redirect("/anmelden?geloescht=1");
}

export default async function UnternehmenWechseln({ searchParams }: { searchParams: Promise<{ geloescht?: string }> }) {
  const [{ t: x }, i, { geloescht }] = await Promise.all([t(), ich(), searchParams]);
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-titel font-bold">{x.unternehmen.wechseln}</h1>
      {geloescht ? <p role="status" className="mt-4 rounded-md bg-amt-hauch p-4 font-bold text-amt">{x.loeschen.geloescht_unternehmen}</p> : null}
      {!i.unternehmen.length ? <p className="mt-4">{x.unternehmen.keins}</p> : null}
      {!i.unternehmen.length ? (
        <form action={kontoLoeschen} className="mt-4">
          <button className="verweis text-klein">{x.loeschen.konto_knopf}</button>
        </form>
      ) : null}
      <ul className="mt-6 border-t border-linie">
        {i.unternehmen.map((u) => (
          <li key={u.id} className="border-b border-linie">
            <form action={waehlen.bind(null, u.id)}>
              <button className="flex min-h-12 w-full items-center text-left hover:underline">{u.name}</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/unternehmen/neu" className="verweis">
          {x.unternehmen.neu_titel}
        </Link>
        {pfadSichtbar("/kanzlei") ? (
          <Link href="/kanzlei" className="verweis">
            {x.kanzlei.zur_uebersicht}
          </Link>
        ) : null}
      </p>
    </main>
  );
}
