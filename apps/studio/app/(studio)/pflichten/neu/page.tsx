import { redirect } from "next/navigation";
import { StudioFehler, neuePflichtversion } from "@amtlos/server";
import { neuePflicht } from "@/lib/editor-helfer";
import { darfRedigieren, datenbank, editorDaten, ich } from "@/lib/studio";
import { PflichtEditor } from "../editor";

export const metadata = { title: "Neue Pflicht" };

const KATEGORIEN = ["gruendung", "gesellschaft", "steuern", "personal", "arbeitsschutz", "datenschutz", "it_sicherheit", "ki", "online", "produkte", "branche"];
const ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

async function anlegen(formular: FormData) {
  "use server";
  const k = await ich();
  const daten = JSON.parse(String(formular.get("daten") ?? "{}")) as Record<string, unknown>;
  try {
    await neuePflichtversion(datenbank(), k, daten);
  } catch (e) {
    if (e instanceof StudioFehler) redirect(`/pflichten/neu?id=${encodeURIComponent(String(daten.id))}&kategorie=${encodeURIComponent(String(daten.kategorie))}&fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/pflichten/${encodeURIComponent(String(daten.id))}?ok=${encodeURIComponent("Pflicht angelegt und zur Prüfung gegeben")}`);
}

export default async function NeuePflicht({ searchParams }: { searchParams: Promise<{ id?: string; kategorie?: string; fehler?: string }> }) {
  const [k, { id, kategorie, fehler }] = await Promise.all([ich(), searchParams]);
  if (!darfRedigieren(k)) redirect("/");
  const daten = await editorDaten();
  const gueltig = id && ID.test(id) && kategorie && KATEGORIEN.includes(kategorie);
  const vergeben = gueltig && daten.pflichten.includes(id);

  return (
    <div className="space-y-6">
      <h1 className="text-titel font-bold">Neue Pflicht anlegen</h1>
      {fehler ? <pre role="alert" className="whitespace-pre-wrap rounded-md border-2 border-frist bg-frist-hauch p-4 text-klein">{fehler}</pre> : null}
      {!gueltig || vergeben ? (
        <form method="get" className="lesetext space-y-4">
          {vergeben ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-3">Die ID „{id}“ gibt es schon. Neue Versionen bitte auf der Seite der Pflicht anlegen.</p> : null}
          {id && !ID.test(id) ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-3">Die ID braucht die Form kategorie.name, nur Kleinbuchstaben, Ziffern und Unterstrich.</p> : null}
          <label className="block">
            <span className="font-bold">Kategorie</span>
            <select name="kategorie" defaultValue={kategorie ?? "steuern"} className="feld mt-1">{KATEGORIEN.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <label className="block">
            <span className="font-bold">ID</span>
            <input name="id" required defaultValue={id ?? ""} placeholder="steuern.zusammenfassende_meldung" className="feld mt-1" />
            <span className="mt-1 block text-klein text-tinte-leise">Stabil für immer; nicht später umbenennen.</span>
          </label>
          <button className="knopf">Weiter</button>
        </form>
      ) : (
        <PflichtEditor start={neuePflicht(id, kategorie)} daten={daten} aktion={anlegen} knopf="Pflicht anlegen und zur Prüfung geben" />
      )}
    </div>
  );
}
