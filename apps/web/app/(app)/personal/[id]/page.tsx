import Link from "next/link";
import { notFound } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Beschaeftigter } from "../page";

export const metadata = { title: "Checkliste" };

interface Checkliste { beschaeftigter: Beschaeftigter; schritte: { pflicht_id: string; periode: string; status: string; faellig_am: string | null; titel: string; kurz: string; anlass: "einstellung" | "austritt" }[] }

export default async function ChecklisteSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ s, t: x }, c] = await Promise.all([t(), api<Checkliste>(`/v1/beschaeftigte/${id}/checkliste`)]);
  const b = c.beschaeftigter;
  const gruppen = (["einstellung", "austritt"] as const).map((a) => [a, c.schritte.filter((z) => z.anlass === a)] as const).filter(([, z]) => z.length);
  return (
    <div className="lesetext space-y-6">
      <p className="text-klein"><Link href="/personal" className="verweis">{x.personal.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{fuelle(x.personal.checkliste_titel, { name: `${b.vorname} ${b.nachname}` })}</h1>
        <p className="mt-2">{x.personal.checkliste_text}</p>
      </header>
      {gruppen.length ? (
        gruppen.map(([anlass, schritte]) => (
          <section key={anlass} aria-labelledby={anlass}>
            <h2 id={anlass} className="text-gross font-bold">{anlass === "einstellung" ? x.personal.anlass_einstellung : x.personal.anlass_austritt}</h2>
            <ul className="mt-3 border-t border-linie">
              {schritte.map((z) => (
                <li key={z.pflicht_id} className="flex items-start gap-3 border-b border-linie py-3">
                  <span aria-hidden className={`mt-1 inline-block h-4 w-4 shrink-0 rounded-sm border-2 ${z.status === "erledigt" ? "border-amt bg-amt" : "border-tinte-leise"}`} />
                  <div className="min-w-0">
                    <Link href={`/pflichten/${z.pflicht_id}/${z.periode}`} className="verweis font-bold">{z.titel}</Link>
                    <p className="text-klein">{z.kurz}</p>
                    <p className="text-klein text-tinte-leise">
                      {x.status[z.status as keyof typeof x.status] ?? z.status}
                      {z.faellig_am ? ` · ${datumLang(z.faellig_am, s)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p>{x.personal.checkliste_leer}</p>
      )}
    </div>
  );
}
