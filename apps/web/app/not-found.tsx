import Link from "next/link";
import { t } from "@/lib/sprache";

export default async function NichtGefunden() {
  const { t: x } = await t();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-titel font-bold">{x.fehler.nicht_gefunden}</h1>
      <Link href="/heute" className="knopf mt-6">
        {x.fehler.zur_startseite}
      </Link>
    </main>
  );
}
