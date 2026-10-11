import Link from "next/link";
import { pruefpunkte } from "@amtlos/server";
import { datenbank, ich } from "@/lib/studio";

export const metadata = { title: "Prüfliste" };

export default async function Pruefliste() {
  await ich();
  const punkte = await pruefpunkte(datenbank());
  return (
    <div className="space-y-6">
      <h1 className="text-titel font-bold">Offene fachliche Prüfpunkte ({punkte.length})</h1>
      <p className="lesetext text-tinte-leise">
        Aus „fachlich_zu_pruefen“ der neuesten Versionen. Grundsätzliche Punkte (G-…) und juristische Fragen (J-…) stehen in PRUEFLISTE.md im Repository.
      </p>
      <table className="tabelle">
        <thead>
          <tr>
            <th scope="col">Art</th>
            <th scope="col">Objekt</th>
            <th scope="col">Version</th>
            <th scope="col">Punkt</th>
          </tr>
        </thead>
        <tbody>
          {punkte.map((p, i) => (
            <tr key={i}>
              <td>{p.art}</td>
              <td>
                {p.art === "Pflicht" ? (
                  <Link className="verweis" href={`/pflichten/${encodeURIComponent(p.id)}`}>
                    {p.id}
                  </Link>
                ) : (
                  p.id
                )}
              </td>
              <td>{p.version}</td>
              <td>{p.punkt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
