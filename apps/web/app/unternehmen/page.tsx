import Link from "next/link";
import { redirect } from "next/navigation";
import { ich } from "@/lib/api";
import { unternehmenWaehlen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Unternehmen wechseln" };

async function waehlen(id: string) {
  "use server";
  const i = await ich();
  if (!i.unternehmen.some((u) => u.id === id)) redirect("/unternehmen");
  await unternehmenWaehlen(id);
  redirect("/heute");
}

export default async function UnternehmenWechseln() {
  const [{ t: x }, i] = await Promise.all([t(), ich()]);
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-titel font-bold">{x.unternehmen.wechseln}</h1>
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
        <Link href="/kanzlei" className="verweis">
          {x.kanzlei.zur_uebersicht}
        </Link>
      </p>
    </main>
  );
}
