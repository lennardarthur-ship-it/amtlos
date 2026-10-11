import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { StudioFehler, releaseListe, releaseVeroeffentlichen } from "@amtlos/server";
import { darfRedigieren, datenbank, ich, rollout } from "@/lib/studio";

export const metadata = { title: "Releases" };

async function veroeffentlichen(formular: FormData) {
  "use server";
  const k = await ich();
  let meldung: string;
  try {
    const r = await releaseVeroeffentlichen(datenbank(), k, String(formular.get("notiz") ?? "").trim() || "ohne Notiz", (tx) => rollout(tx, "neu"));
    meldung = `ok=${encodeURIComponent(`Release ${r.nummer} veröffentlicht (${r.inhalte} Inhalte). Alle Unternehmen werden neu berechnet.`)}`;
  } catch (e) {
    const m = (e as Error).message ?? "";
    if (e instanceof StudioFehler || m.startsWith("prod:")) redirect(`/releases?fehler=${encodeURIComponent(m)}`);
    throw e;
  }
  revalidatePath("/releases");
  redirect(`/releases?${meldung}`);
}

export default async function Releases({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [k, { fehler, ok }] = await Promise.all([ich(), searchParams]);
  const liste = await releaseListe(datenbank());
  return (
    <div className="space-y-8">
      <h1 className="text-titel font-bold">Releases</h1>
      {fehler ? (
        <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">
          {fehler}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="lesetext rounded-md bg-amt-hauch p-4 font-bold text-amt">
          {ok}
        </p>
      ) : null}
      {darfRedigieren(k) ? (
        <form action={veroeffentlichen} className="lesetext space-y-3">
          <p>Ein Release enthält je Pflicht die neueste verwendbare Version. In staging und prod nur Freigegebenes; die Datenbank lehnt alles andere ab.</p>
          <label className="block">
            <span className="font-bold">Notiz</span>
            <input name="notiz" maxLength={300} className="feld mt-1" />
          </label>
          <button className="knopf">Release veröffentlichen</button>
        </form>
      ) : null}
      <table className="tabelle">
        <thead>
          <tr>
            <th scope="col">Nr.</th>
            <th scope="col">Veröffentlicht</th>
            <th scope="col">Von</th>
            <th scope="col">Pflichten</th>
            <th scope="col">Regelwerte</th>
            <th scope="col">Davon ungeprüft</th>
            <th scope="col">Notiz</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((r) => (
            <tr key={r.nummer}>
              <td className="font-bold">{r.nummer}</td>
              <td>{r.veroeffentlicht_am ? new Date(r.veroeffentlicht_am).toLocaleString("de-DE") : "nicht veröffentlicht"}</td>
              <td>{r.autor}</td>
              <td>{r.pflichten}</td>
              <td>{r.regelwerte}</td>
              <td className={r.ungeprueft ? "font-bold text-bald" : ""}>{r.ungeprueft}</td>
              <td>{r.notiz}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
