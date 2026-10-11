import Link from "next/link";
import { redirect } from "next/navigation";
import { datumLang } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { euroText } from "@/lib/geld";
import { t } from "@/lib/sprache";

export const metadata = { title: "Rechnungen" };

interface Zeile { id: string; nummer: string | null; status: "entwurf" | "gestellt" | "storniert"; art: "rechnung" | "storno"; rechnungsdatum: string | null; brutto_cent: number; kunde_name: string | null }

async function neu() {
  "use server";
  const r = await api<{ id: string }>("/v1/rechnungen", { method: "POST", body: JSON.stringify({ positionen: [] }) });
  redirect(`/finanzen/rechnungen/${r.id}`);
}

export default async function RechnungenSeite() {
  const [{ s, t: x }, liste] = await Promise.all([t(), api<Zeile[]>("/v1/rechnungen")]);
  const status = (z: Zeile) => (z.art === "storno" ? x.rechnung.storno : x.rechnung[z.status]);
  return (
    <div className="space-y-6">
      <p className="text-klein"><Link href="/finanzen" className="verweis">{x.finanzen.zurueck}</Link></p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-titel font-bold">{x.finanzen.rechnungen}</h1>
        <form action={neu}><button className="knopf">{x.rechnung.neu}</button></form>
      </div>
      {liste.length ? (
        <table className="tabelle">
          <thead>
            <tr>
              <th scope="col">{x.rechnung.nummer}</th>
              <th scope="col">{x.rechnung.datum}</th>
              <th scope="col">{x.rechnung.kunde}</th>
              <th scope="col" className="text-right">{x.rechnung.betrag}</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((z) => (
              <tr key={z.id}>
                <td><Link href={`/finanzen/rechnungen/${z.id}`} className="verweis">{z.nummer ?? x.rechnung.entwurf}</Link></td>
                <td>{z.rechnungsdatum ? datumLang(z.rechnungsdatum, s) : "–"}</td>
                <td>{z.kunde_name ?? "–"}</td>
                <td className="text-right tabular-nums">{euroText((z.art === "storno" ? -1 : 1) * z.brutto_cent, s)}</td>
                <td>{status(z)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="lesetext">{x.rechnung.liste_leer}</p>
      )}
    </div>
  );
}
