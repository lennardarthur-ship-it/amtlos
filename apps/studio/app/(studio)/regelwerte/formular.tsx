/** Formular für eine Regelwertversion (Server-Komponente, ohne Client-JavaScript). */
export const EINHEITEN: Record<string, string> = {
  EUR: "Euro", EUR_pro_stunde: "Euro pro Stunde", EUR_pro_monat: "Euro pro Monat", prozent: "Prozent", anzahl: "Anzahl", tage: "Tage", monate: "Monate", jahre: "Jahre", kalenderjahr: "Kalenderjahr",
};
export const STATUS_RECHT: Record<string, string> = { in_kraft: "in Kraft", beschlossen: "beschlossen", entwurf: "Entwurf", geplant: "geplant", ausgelaufen: "ausgelaufen" };

import type { RegelwertDaten } from "@/lib/regelwert-helfer";
export { ausFormular, type RegelwertDaten } from "@/lib/regelwert-helfer";

function Feld({ id, label, hilfe, children }: { id: string; label: string; hilfe?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold">{label}</label>
      {hilfe ? <p id={`${id}-hilfe`} className="text-klein text-tinte-leise">{hilfe}</p> : null}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function RegelwertFormular({ start, aktion, knopf, einheitFest, mitId }: { start: RegelwertDaten; aktion: (f: FormData) => Promise<void>; knopf: string; einheitFest?: string; mitId?: boolean }) {
  const q = [0, 1, 2].map((i) => start.quellen?.[i] ?? {});
  return (
    <form action={aktion} className="lesetext space-y-5">
      {mitId ? (
        <Feld id="id" label="ID" hilfe="Stabil für immer, z. B. personal.mindestlohn.stunde">
          <input id="id" name="id" required pattern="[a-z][a-z0-9_]*(\.[a-z0-9_]+)+" defaultValue={start.id ?? ""} className="feld font-mono" aria-describedby="id-hilfe" />
        </Feld>
      ) : null}
      <Feld id="bezeichnung_de" label="Bezeichnung (Deutsch)">
        <input id="bezeichnung_de" name="bezeichnung_de" required defaultValue={start.bezeichnung?.de ?? ""} className="feld" />
      </Feld>
      <Feld id="bezeichnung_en" label="Bezeichnung (Englisch, optional)">
        <input id="bezeichnung_en" name="bezeichnung_en" defaultValue={start.bezeichnung?.en ?? ""} className="feld" />
      </Feld>
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld id="wert" label="Wert" hilfe="Dezimalkomma erlaubt, z. B. 13,90">
          <input id="wert" name="wert" required inputMode="decimal" defaultValue={start.wert === undefined ? "" : String(start.wert).replace(".", ",")} className="feld" aria-describedby="wert-hilfe" />
        </Feld>
        <Feld id="einheit" label="Einheit" hilfe={einheitFest ? "Steht für diesen Regelwert fest." : undefined}>
          <select id="einheit" name="einheit" defaultValue={einheitFest ?? start.einheit ?? "EUR"} disabled={!!einheitFest} className="feld" aria-describedby={einheitFest ? "einheit-hilfe" : undefined}>
            {Object.entries(EINHEITEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Feld>
        <Feld id="gueltig_ab" label="Gültig ab" hilfe="Leer = ohne Stichtag">
          <input id="gueltig_ab" name="gueltig_ab" type="date" defaultValue={start.gueltig_ab ?? ""} className="feld" aria-describedby="gueltig_ab-hilfe" />
        </Feld>
        <Feld id="gueltig_bis" label="Gültig bis (leer = offen)">
          <input id="gueltig_bis" name="gueltig_bis" type="date" defaultValue={start.gueltig_bis ?? ""} className="feld" />
        </Feld>
        <Feld id="status_recht" label="Rechtsstatus">
          <select id="status_recht" name="status_recht" defaultValue={start.status_recht ?? "in_kraft"} className="feld">
            {Object.entries(STATUS_RECHT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Feld>
        <Feld id="katalog_nr" label="Katalog-Nr. (optional)">
          <input id="katalog_nr" name="katalog_nr" defaultValue={start.katalog_nr ?? ""} placeholder="C.23" className="feld" />
        </Feld>
      </div>
      <Feld id="rechtsgrundlage" label="Rechtsgrundlagen" hilfe="Eine je Zeile, z. B. § 19 UStG">
        <textarea id="rechtsgrundlage" name="rechtsgrundlage" rows={3} defaultValue={(start.rechtsgrundlage ?? []).join("\n")} className="feld" aria-describedby="rechtsgrundlage-hilfe" />
      </Feld>
      <fieldset className="space-y-3">
        <legend className="font-bold">Quellen (mindestens eine)</legend>
        {q.map((x, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-linie p-3 sm:grid-cols-2">
            <Feld id={`q${i}_titel`} label={`Quelle ${i + 1}: Titel`}><input id={`q${i}_titel`} name={`q${i}_titel`} defaultValue={x.titel ?? ""} className="feld" /></Feld>
            <Feld id={`q${i}_url`} label={`Quelle ${i + 1}: Adresse`}><input id={`q${i}_url`} name={`q${i}_url`} type="url" defaultValue={x.url ?? ""} className="feld" /></Feld>
            <Feld id={`q${i}_abgerufen`} label={`Quelle ${i + 1}: abgerufen am`}><input id={`q${i}_abgerufen`} name={`q${i}_abgerufen`} type="date" defaultValue={x.abgerufen ?? ""} className="feld" /></Feld>
            <Feld id={`q${i}_fundstelle`} label={`Quelle ${i + 1}: Fundstelle`}><input id={`q${i}_fundstelle`} name={`q${i}_fundstelle`} defaultValue={x.fundstelle ?? ""} className="feld" /></Feld>
          </div>
        ))}
      </fieldset>
      <Feld id="fachlich_zu_pruefen" label="Fachlich zu prüfen" hilfe="Offene Fragen an die Prüfer, eine je Zeile">
        <textarea id="fachlich_zu_pruefen" name="fachlich_zu_pruefen" rows={3} defaultValue={(start.fachlich_zu_pruefen ?? []).join("\n")} className="feld" aria-describedby="fachlich_zu_pruefen-hilfe" />
      </Feld>
      <button className="knopf">{knopf}</button>
    </form>
  );
}
