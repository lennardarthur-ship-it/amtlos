import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PASSENDE_QUALIFIKATION, StudioFehler, pruefentscheidung, regelwertUebersicht, type Qualifikation } from "@amtlos/server";
import { darfPruefen, datenbank, ich } from "@/lib/studio";

export const metadata = { title: "Regelwerte" };
const STATUS: Record<string, string> = { entwurf: "Entwurf", in_pruefung: "In Prüfung", freigegeben: "Freigegeben", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen" };

async function freigeben(versionId: string, formular: FormData) {
  "use server";
  const k = await ich();
  const quali = String(formular.get("qualifikation") ?? "");
  try {
    await pruefentscheidung(datenbank(), k, versionId, { entscheidung: "freigegeben", qualifikation: quali ? (quali as Qualifikation) : null }, "regelwert_version");
  } catch (e) {
    const m = (e as Error).message;
    if (e instanceof StudioFehler || /Freigabe:|duplicate key/.test(m)) redirect(`/regelwerte?fehler=${encodeURIComponent(m.includes("duplicate") ? "Bereits von dir geprüft" : m)}`);
    throw e;
  }
  revalidatePath("/regelwerte");
}

export default async function Regelwerte({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [k, { fehler }] = await Promise.all([ich(), searchParams]);
  const liste = await regelwertUebersicht(datenbank());
  return (
    <div className="space-y-6">
      <h1 className="text-titel font-bold">Regelwerte</h1>
      <p className="lesetext text-tinte-leise">
        Schwellen und Beträge mit Gültigkeitszeitraum (E-034). Eine Pflicht kommt nur in ein prod-Release, wenn ihre Regelwerte freigegeben sind.
      </p>
      {fehler ? (
        <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">
          {fehler}
        </p>
      ) : null}
      <table className="tabelle">
        <thead>
          <tr>
            <th scope="col">Regelwert</th>
            <th scope="col">Version</th>
            <th scope="col">Wert</th>
            <th scope="col">Gültig</th>
            <th scope="col">Status</th>
            <th scope="col">Freigaben</th>
            <th scope="col">Im Release</th>
            <th scope="col">
              <span className="sr-only">Aktion</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {liste.map((r) => {
            const passend = (PASSENDE_QUALIFIKATION[r.regelwert_id.split(".")[0]!] ?? []).filter((q) => k.qualifikationen.includes(q));
            return (
              <tr key={r.id}>
                <td className="font-bold">{r.regelwert_id}</td>
                <td>{r.version}</td>
                <td>
                  {r.wert} {r.einheit}
                </td>
                <td>
                  {r.gueltig_ab} bis {r.gueltig_bis ?? "offen"}
                </td>
                <td>{STATUS[r.pruef_status]}</td>
                <td>{r.freigaben}</td>
                <td>{r.im_release ? "ja" : "nein"}</td>
                <td>
                  {darfPruefen(k) && r.pruef_status !== "freigegeben" && r.pruef_status !== "abgelehnt" ? (
                    <form action={freigeben.bind(null, r.id)} className="flex flex-wrap gap-2">
                      <select name="qualifikation" className="feld min-h-9 py-1 text-klein" aria-label={`Prüfart für ${r.regelwert_id} Version ${r.version}`}>
                        <option value="">Zweitprüfung</option>
                        {passend.map((q) => (
                          <option key={q} value={q}>
                            als {q}
                          </option>
                        ))}
                      </select>
                      <button className="knopf min-h-9 py-1 text-klein">Freigeben</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
