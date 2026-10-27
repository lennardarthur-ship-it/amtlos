import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { StudioFehler, neueRegelwertversion, regelwertVersionen } from "@amtlos/server";
import { darfRedigieren, datenbank, ich } from "@/lib/studio";
import { EINHEITEN, RegelwertFormular, ausFormular, type RegelwertDaten } from "../formular";

type Params = Promise<{ id: string }>;
const STATUS: Record<string, string> = { entwurf: "Entwurf", in_pruefung: "In Prüfung", freigegeben: "Freigegeben", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen" };

function zurueck(id: string, art: "fehler" | "ok", text: string): never {
  redirect(`/regelwerte/${encodeURIComponent(id)}?${art}=${encodeURIComponent(text)}`);
}

async function speichern(id: string, einheit: string, formular: FormData) {
  "use server";
  const k = await ich();
  try {
    const r = await neueRegelwertversion(datenbank(), k, ausFormular(formular, id, einheit));
    revalidatePath(`/regelwerte/${id}`);
    revalidatePath("/regelwerte");
    zurueck(id, "ok", `Version ${r.version} gespeichert und zur Prüfung gegeben`);
  } catch (e) {
    if (e instanceof StudioFehler) zurueck(id, "fehler", e.message);
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  return { title: (await params).id };
}

export default async function RegelwertSeite({ params, searchParams }: { params: Params; searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [{ id }, { fehler, ok }, k] = await Promise.all([params, searchParams, ich()]);
  const versionen = await regelwertVersionen(datenbank(), id);
  if (!versionen.length) notFound();
  const neueste = versionen[0]!.daten as RegelwertDaten;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-klein text-tinte-leise">Regelwert</p>
        <h1 className="text-titel font-bold">{neueste.bezeichnung?.de}</h1>
        <p className="font-mono text-klein">{id} · {EINHEITEN[neueste.einheit ?? ""] ?? neueste.einheit}</p>
      </header>
      {fehler ? <pre role="alert" className="whitespace-pre-wrap rounded-md border-2 border-frist bg-frist-hauch p-4 text-klein">{fehler}</pre> : null}
      {ok ? <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">{ok}</p> : null}

      <section aria-labelledby="versionen">
        <h2 id="versionen" className="text-gross font-bold">Versionen</h2>
        <table className="tabelle mt-2">
          <thead><tr><th scope="col">Version</th><th scope="col">Wert</th><th scope="col">Gültig</th><th scope="col">Rechtsstatus</th><th scope="col">Prüfung</th><th scope="col">Freigaben</th></tr></thead>
          <tbody>
            {versionen.map((v) => {
              const d = v.daten as RegelwertDaten;
              return (
                <tr key={v.id}>
                  <td>{v.version}</td>
                  <td>{d.wert}</td>
                  <td>{d.gueltig_ab ?? "ohne Stichtag"} bis {d.gueltig_bis ?? "offen"}</td>
                  <td>{d.status_recht}</td>
                  <td>{STATUS[v.pruef_status]}</td>
                  <td>{v.freigaben}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-klein text-tinte-leise">Freigeben auf der Übersicht „Regelwerte“. Freigegebene Versionen dürfen sich zeitlich nicht überschneiden.</p>
      </section>

      {darfRedigieren(k) ? (
        <section aria-labelledby="neu">
          <h2 id="neu" className="text-gross font-bold">Neue Version</h2>
          <p className="lesetext mt-1 text-tinte-leise">
            Für einen neuen Zeitraum (z. B. neuer Mindestlohn ab 1.1.) eine neue Version mit eigenem „Gültig ab“ anlegen; die alte bleibt für vergangene Zeiträume gültig.
          </p>
          <div className="mt-4">
            <RegelwertFormular start={neueste} aktion={speichern.bind(null, id, neueste.einheit ?? "EUR")} knopf="Als neue Version speichern" einheitFest={neueste.einheit} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
