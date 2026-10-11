import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PASSENDE_QUALIFIKATION, StudioFehler, neuePflichtversion, pflichtVersionen, pruefentscheidung, testlauf, type Qualifikation } from "@amtlos/server";
import { darfPruefen, darfRedigieren, datenbank, editorDaten, fixtureVerzeichnis, ich } from "@/lib/studio";
import { PflichtEditor } from "../editor";

type Params = Promise<{ id: string }>;
const STATUS: Record<string, string> = { entwurf: "Entwurf", in_pruefung: "In Prüfung", freigegeben: "Freigegeben", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen" };
const ENTSCHEIDUNG: Record<string, string> = { freigegeben: "freigegeben", abgelehnt: "abgelehnt", aenderung_noetig: "Änderung nötig" };

function zurueck(id: string, art: "fehler" | "ok", text: string): never {
  redirect(`/pflichten/${encodeURIComponent(id)}?${art}=${encodeURIComponent(text)}`);
}

async function speichern(id: string, formular: FormData) {
  "use server";
  const k = await ich();
  let daten: Record<string, unknown>;
  try {
    daten = JSON.parse(String(formular.get("daten") ?? ""));
  } catch (e) {
    zurueck(id, "fehler", `Kein gültiges JSON: ${(e as Error).message}`);
  }
  if (daten.id !== id) zurueck(id, "fehler", `Die ID muss „${id}“ bleiben`);
  try {
    const r = await neuePflichtversion(datenbank(), k, daten);
    revalidatePath(`/pflichten/${id}`);
    zurueck(id, "ok", `Version ${r.version} gespeichert und zur Prüfung gegeben`);
  } catch (e) {
    if (e instanceof StudioFehler) zurueck(id, "fehler", e.message);
    throw e;
  }
}

async function entscheiden(id: string, versionId: string, formular: FormData) {
  "use server";
  const k = await ich();
  const quali = String(formular.get("qualifikation") ?? "");
  try {
    const r = await pruefentscheidung(datenbank(), k, versionId, {
      entscheidung: String(formular.get("entscheidung")) as "freigegeben" | "abgelehnt" | "aenderung_noetig",
      qualifikation: quali ? (quali as Qualifikation) : null,
      kommentar: String(formular.get("kommentar") ?? "").trim() || undefined,
    });
    revalidatePath(`/pflichten/${id}`);
    zurueck(id, "ok", `Entscheidung gespeichert. Status: ${STATUS[r.status]}`);
  } catch (e) {
    if (e instanceof StudioFehler) zurueck(id, "fehler", e.message);
    // Datenbank-Regeln (Autor ≠ Prüfer, Qualifikation hinterlegt) melden sich als Fehler mit Klartext
    const meldung = (e as { message?: string }).message ?? "";
    if (/Freigabe:|duplicate key/.test(meldung)) zurueck(id, "fehler", meldung.includes("duplicate") ? "Du hast diese Version bereits geprüft" : meldung);
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  return { title: (await params).id };
}

export default async function PflichtStudio({ params, searchParams }: { params: Params; searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [{ id }, { fehler, ok }, k] = await Promise.all([params, searchParams, ich()]);
  const versionen = await pflichtVersionen(datenbank(), id);
  if (!versionen.length) notFound();
  const neueste = versionen[0]!;
  const lauf = await testlauf(datenbank(), neueste.daten, fixtureVerzeichnis());
  const kategorie = neueste.daten.kategorie;
  const passend = (PASSENDE_QUALIFIKATION[kategorie] ?? []).filter((q) => k.qualifikationen.includes(q));
  const schonGeprueft = neueste.freigaben.some((f) => f.pruefer === k.anzeigename);
  const offen = (neueste.daten.fachlich_zu_pruefen as string[] | undefined) ?? [];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-titel font-bold">{neueste.daten.titel.de}</h1>
        <p className="text-tinte-leise">
          {id}, Kategorie {kategorie}, neueste Version {neueste.version}: {STATUS[neueste.pruef_status]} (angelegt von {neueste.autor})
        </p>
      </header>

      {fehler ? (
        <pre role="alert" className="whitespace-pre-wrap rounded-md border-2 border-frist bg-frist-hauch p-4 text-klein">
          {fehler}
        </pre>
      ) : null}
      {ok ? (
        <p role="status" className="rounded-md bg-amt-hauch p-4 font-bold text-amt">
          {ok}
        </p>
      ) : null}

      {offen.length ? (
        <section aria-labelledby="offen">
          <h2 id="offen" className="text-gross font-bold">Offene fachliche Punkte</h2>
          <ul className="lesetext mt-2 list-disc pl-5">{offen.map((o) => <li key={o}>{o}</li>)}</ul>
        </section>
      ) : null}

      <section aria-labelledby="test">
        <h2 id="test" className="text-gross font-bold">Testlauf gegen die Fixtures</h2>
        <p className="text-klein text-tinte-leise">Ergebnis mit dem aktiven Release („vorher“) und mit dieser Version („nachher“).</p>
        <table className="tabelle mt-2">
          <thead><tr><th scope="col">Fixture</th><th scope="col">Erwartet</th><th scope="col">Vorher</th><th scope="col">Nachher</th></tr></thead>
          <tbody>
            {lauf.map((f) => {
              const abweichung = f.erwartet && f.nachher !== f.erwartet;
              return (
                <tr key={f.datei} className={abweichung ? "bg-frist-hauch" : f.vorher !== f.nachher ? "bg-bald-hauch" : ""}>
                  <td>{f.datei}<div className="text-tinte-leise">{f.persona}</div></td>
                  <td>{f.erwartet ?? "–"}</td>
                  <td>{f.vorher ?? "nicht im Release"}</td>
                  <td className="font-bold">{f.nachher}{abweichung ? " (weicht ab)" : f.vorher !== f.nachher ? " (geändert)" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {darfPruefen(k) && neueste.pruef_status !== "freigegeben" && neueste.pruef_status !== "abgelehnt" ? (
        <section aria-labelledby="pruefen" className="lesetext">
          <h2 id="pruefen" className="text-gross font-bold">Version {neueste.version} prüfen</h2>
          {schonGeprueft ? (
            <p className="mt-2">Du hast diese Version bereits geprüft.</p>
          ) : (
            <form action={entscheiden.bind(null, id, neueste.id)} className="mt-3 space-y-4">
              <fieldset>
                <legend className="font-bold">Entscheidung</legend>
                {Object.entries(ENTSCHEIDUNG).map(([wert, text]) => (
                  <label key={wert} className="flex min-h-10 items-center gap-3">
                    <input type="radio" name="entscheidung" value={wert} required className="size-5 accent-amt" /> {text}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="font-bold">Als Fachprüfung zählen</span>
                <select name="qualifikation" className="feld mt-1">
                  <option value="">Nein, Zweitprüfung ohne Fachqualifikation</option>
                  {passend.map((q) => <option key={q} value={q}>Ja, als {q}</option>)}
                </select>
                <span className="mt-1 block text-klein text-tinte-leise">
                  Für „{kategorie}“ zählt: {(PASSENDE_QUALIFIKATION[kategorie] ?? []).join(", ") || "–"}. Freigegeben ist eine Version mit zwei Freigaben, davon eine fachlich.
                </span>
              </label>
              <label className="block">
                <span className="font-bold">Kommentar</span> <span className="text-klein text-tinte-leise">(Pflicht, wenn nicht freigegeben)</span>
                <textarea name="kommentar" rows={3} className="feld mt-1" />
              </label>
              <button className="knopf">Entscheidung speichern</button>
            </form>
          )}
        </section>
      ) : null}

      {darfRedigieren(k) ? (
        <section aria-labelledby="bearbeiten" className="space-y-3">
          <h2 id="bearbeiten" className="text-titel font-bold">Neue Version bearbeiten</h2>
          <p className="lesetext text-klein text-tinte-leise">Startet mit dem Inhalt von Version {neueste.version}. Beim Speichern prüft das System Schema, Fakten, Operatoren, Regelwerte und Verweise.</p>
          <PflichtEditor start={neueste.daten} daten={await editorDaten()} aktion={speichern.bind(null, id)} knopf="Als neue Version speichern" />
        </section>
      ) : null}

      <section aria-labelledby="historie">
        <h2 id="historie" className="text-gross font-bold">Versionen und Prüfungen</h2>
        <table className="tabelle mt-2">
          <thead><tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Autor</th><th scope="col">Prüfungen</th></tr></thead>
          <tbody>
            {versionen.map((v) => (
              <tr key={v.id}>
                <td>{v.version}</td>
                <td>{STATUS[v.pruef_status]}</td>
                <td>{v.autor}<div className="text-tinte-leise">{new Date(v.erstellt_am).toLocaleString("de-DE")}</div></td>
                <td>
                  {v.freigaben.length ? (
                    <ul>
                      {v.freigaben.map((f, i) => (
                        <li key={i}>
                          {f.pruefer}: {ENTSCHEIDUNG[f.entscheidung]}{f.qualifikation ? ` (als ${f.qualifikation})` : ""}{f.kommentar ? `: ${f.kommentar}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
