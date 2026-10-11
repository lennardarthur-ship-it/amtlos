import Link from "next/link";
import { pflichtUebersicht } from "@amtlos/server";
import { darfRedigieren, datenbank, ich } from "@/lib/studio";

export const metadata = { title: "Pflichten" };

const STATUS: Record<string, string> = { entwurf: "Entwurf", in_pruefung: "In Prüfung", freigegeben: "Freigegeben", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen" };

export default async function Uebersicht() {
  const k = await ich();
  const liste = await pflichtUebersicht(datenbank());
  const freigegeben = liste.filter((p) => p.pruef_status === "freigegeben").length;
  const kategorien = [...new Set(liste.map((p) => p.kategorie))].sort();

  return (
    <div className="space-y-8">
      <section aria-labelledby="quote">
        <h1 id="quote" className="text-titel font-bold">
          {freigegeben} von {liste.length} Pflichten fachlich freigegeben
        </h1>
        <p className="mt-1 text-tinte-leise">Ohne Freigabe erscheint eine Pflicht in prod nicht (E-002, E-038).</p>
        {darfRedigieren(k) ? <Link href="/pflichten/neu" className="knopf mt-4">Neue Pflicht anlegen</Link> : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
          {kategorien.map((k) => {
            const alle = liste.filter((p) => p.kategorie === k);
            return (
              <div key={k} className="flex justify-between border-b border-linie py-2 text-klein">
                <dt>{k}</dt>
                <dd className="font-bold">{alle.filter((p) => p.pruef_status === "freigegeben").length}/{alle.length}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <table className="tabelle">
        <caption className="sr-only">Pflichten mit neuester Version</caption>
        <thead>
          <tr>
            <th scope="col">Nr.</th>
            <th scope="col">Pflicht</th>
            <th scope="col">Version</th>
            <th scope="col">Prüfstatus</th>
            <th scope="col">Freigaben</th>
            <th scope="col">Offene Punkte</th>
            <th scope="col">Im aktiven Release</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((p) => (
            <tr key={p.pflicht_id}>
              <td>{p.katalog_nr ?? "–"}</td>
              <td>
                <Link href={`/pflichten/${encodeURIComponent(p.pflicht_id)}`} className="verweis font-bold">
                  {p.titel}
                </Link>
                <div className="text-tinte-leise">{p.pflicht_id}</div>
              </td>
              <td>{p.version}</td>
              <td className={p.pruef_status === "freigegeben" ? "font-bold text-amt" : p.pruef_status === "abgelehnt" ? "font-bold text-frist" : ""}>{STATUS[p.pruef_status]}</td>
              <td>{p.freigaben}</td>
              <td>{p.offene_punkte || "–"}</td>
              <td>{p.im_release ? "ja" : "nein"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
