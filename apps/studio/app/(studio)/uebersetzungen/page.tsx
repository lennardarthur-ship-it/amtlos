import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { StudioFehler, uebersetzungListe, uebersetzungSpeichern } from "@amtlos/server";
import { darfRedigieren, datenbank, ich } from "@/lib/studio";

export const metadata = { title: "Übersetzungen" };

async function speichern(schluessel: string, zurueck: string, f: FormData) {
  "use server";
  const k = await ich();
  try {
    await uebersetzungSpeichern(datenbank(), k, schluessel, String(f.get("text") ?? ""), f.get("geprueft") === "on");
  } catch (e) {
    if (e instanceof StudioFehler) redirect(`${zurueck}${zurueck.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/uebersetzungen");
  redirect(zurueck);
}

/** Englische Katalogtexte prüfen (E-107): verbindlich bleibt Deutsch; geprüfte Einträge gewinnen beim Import. */
export default async function UebersetzungenSeite({ searchParams }: { searchParams: Promise<{ status?: string; suche?: string; fehler?: string }> }) {
  const [k, { status, suche, fehler }] = await Promise.all([ich(), searchParams]);
  const filter = { status: status === "geprueft" || status === "maschinell" ? status : undefined, suche };
  const { zeilen, gesamt, geprueft } = await uebersetzungListe(datenbank(), filter);
  const darf = darfRedigieren(k);
  const zurueck = `/uebersetzungen?${new URLSearchParams(Object.entries({ status: filter.status ?? "", suche: suche ?? "" }).filter(([, v]) => v)).toString()}`;
  return (
    <div className="space-y-6">
      <h1 className="text-titel font-bold">Übersetzungen (Englisch)</h1>
      <p className="lesetext">
        {gesamt} Texte, davon {geprueft} sprachlich geprüft. Maschinelle Übersetzungen erscheinen in der App mit dem Hinweis, dass die deutsche Fassung verbindlich ist.
        Fehlende Texte zeigt <code>scripts/uebersetzung_abdeckung.py</code>.
      </p>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="block"><span className="font-bold">Suche</span><input name="suche" defaultValue={suche} className="feld mt-1" /></label>
        <label className="block">
          <span className="font-bold">Status</span>
          <select name="status" defaultValue={filter.status ?? ""} className="feld mt-1">
            <option value="">alle</option>
            <option value="maschinell">maschinell</option>
            <option value="geprueft">geprüft</option>
          </select>
        </label>
        <button className="knopf knopf-leise">Filtern</button>
        <Link href="/uebersetzungen" className="verweis">zurücksetzen</Link>
      </form>
      {fehler ? <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      <ul className="space-y-3">
        {zeilen.map((z) => (
          <li key={z.schluessel} className="rounded-md border border-linie bg-blatt p-4">
            <p lang="de">{z.de}</p>
            <p className="mt-1 text-klein text-tinte-leise">{z.status === "geprueft" ? `geprüft am ${z.geprueft_am}` : "maschinell, ungeprüft"}{z.benutzt ? "" : " · in keiner Version mehr benutzt"}</p>
            {darf ? (
              <form action={speichern.bind(null, z.schluessel, zurueck)} className="mt-2 space-y-2">
                <label className="block"><span className="sr-only">Englisch</span><textarea name="text" lang="en" rows={2} defaultValue={z.text} className="feld w-full" aria-label={`Englisch: ${z.de.slice(0, 60)}`} /></label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" name="geprueft" defaultChecked={z.status === "geprueft"} className="size-5" /> geprüft</label>
                  <button className="knopf">Speichern</button>
                </div>
              </form>
            ) : (
              <p lang="en" className="mt-2">{z.text}</p>
            )}
          </li>
        ))}
      </ul>
      {zeilen.length === 200 ? <p className="text-klein">Es werden die ersten 200 Treffer gezeigt – Suche eingrenzen.</p> : null}
    </div>
  );
}
