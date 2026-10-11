import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Prüfung elektrischer Geräte" };

const ERGEBNISSE = ["bestanden", "maengel", "ausgesondert"] as const;
interface Geraet {
  id: string; bezeichnung: string; standort: string | null; kennung: string | null; pruefintervall_monate: number | null; naechste_pruefung: string | null; ausgesondert_am: string | null;
  letzte_pruefung: string | null; letztes_ergebnis: (typeof ERGEBNISSE)[number] | null; ueberfaellig: boolean;
}
const SEITE = "/personal/arbeitsmittel";
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function erfassen(f: FormData) {
  "use server";
  const intervall = text(f, "pruefintervall_monate");
  await senden("/v1/arbeitsmittel", "POST", {
    bezeichnung: text(f, "bezeichnung"), standort: text(f, "standort") || null, kennung: text(f, "kennung") || null,
    pruefintervall_monate: intervall ? Number(intervall) : null, naechste_pruefung: text(f, "naechste_pruefung") || null,
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function pruefung(id: string, f: FormData) {
  "use server";
  await senden(`/v1/arbeitsmittel/${id}/pruefungen`, "POST", {
    datum: text(f, "datum"), ergebnis: text(f, "ergebnis"), pruefer: text(f, "pruefer"), bemerkung: text(f, "bemerkung") || null, naechste_pruefung: text(f, "naechste_pruefung") || null,
  }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

export default async function ArbeitsmittelSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, liste, { fehler }, u] = await Promise.all([t(), api<Geraet[]>("/v1/arbeitsmittel"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const heute = new Date().toISOString().slice(0, 10);
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/personal" className="verweis">{x.personal.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.arbeitsmittel.titel}</h1>
        <p className="mt-2">{x.arbeitsmittel.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((g) => (
            <li key={g.id} className={`space-y-1 border-b border-linie py-3 ${g.ausgesondert_am ? "text-tinte-leise" : ""}`}>
              <p><span className="font-bold">{g.bezeichnung}</span>{[g.standort, g.kennung].filter(Boolean).map((v) => ` · ${v}`).join("")}</p>
              <p className="text-klein">
                {g.letzte_pruefung && g.letztes_ergebnis ? fuelle(x.arbeitsmittel.letzte, { datum: datumLang(g.letzte_pruefung, s), ergebnis: x.arbeitsmittel.ergebnisse[g.letztes_ergebnis] }) : x.arbeitsmittel.nie}
              </p>
              <p className={`text-klein ${g.ueberfaellig ? "font-bold text-frist" : ""}`}>
                {g.ausgesondert_am
                  ? fuelle(x.arbeitsmittel.ausgesondert, { datum: datumLang(g.ausgesondert_am, s) })
                  : g.naechste_pruefung
                    ? fuelle(g.ueberfaellig ? x.arbeitsmittel.ueberfaellig : x.arbeitsmittel.faellig, { datum: datumLang(g.naechste_pruefung, s) })
                    : x.arbeitsmittel.kein_termin}
              </p>
              {darf && !g.ausgesondert_am ? (
                <details>
                  <summary className="cursor-pointer text-klein text-amt">{x.arbeitsmittel.pruefung}</summary>
                  <form action={pruefung.bind(null, g.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div><label htmlFor={`d-${g.id}`} className="block text-klein font-bold">{x.arbeitsmittel.datum}</label><input id={`d-${g.id}`} name="datum" type="date" required defaultValue={heute} className="feld mt-1" /></div>
                    <div>
                      <label htmlFor={`e-${g.id}`} className="block text-klein font-bold">{x.arbeitsmittel.ergebnis}</label>
                      <select id={`e-${g.id}`} name="ergebnis" className="feld mt-1">{ERGEBNISSE.map((e) => <option key={e} value={e}>{x.arbeitsmittel.ergebnisse[e]}</option>)}</select>
                    </div>
                    <div><label htmlFor={`p-${g.id}`} className="block text-klein font-bold">{x.arbeitsmittel.pruefer}</label><input id={`p-${g.id}`} name="pruefer" required className="feld mt-1" /></div>
                    <div><label htmlFor={`n-${g.id}`} className="block text-klein font-bold">{x.arbeitsmittel.naechste_optional}</label><input id={`n-${g.id}`} name="naechste_pruefung" type="date" className="feld mt-1" /></div>
                    <div className="sm:col-span-2"><label htmlFor={`b-${g.id}`} className="block text-klein font-bold">{x.arbeitsmittel.bemerkung}</label><input id={`b-${g.id}`} name="bemerkung" className="feld mt-1" /></div>
                    <div><button className="knopf knopf-leise">{x.arbeitsmittel.eintragen}</button></div>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.arbeitsmittel.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.arbeitsmittel.neu}</h2>
          <form action={erfassen} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="bezeichnung" className="block text-klein font-bold">{x.arbeitsmittel.bezeichnung}</label><input id="bezeichnung" name="bezeichnung" required className="feld mt-1" /></div>
            <div><label htmlFor="standort" className="block text-klein font-bold">{x.arbeitsmittel.standort}</label><input id="standort" name="standort" className="feld mt-1" /></div>
            <div><label htmlFor="kennung" className="block text-klein font-bold">{x.arbeitsmittel.kennung}</label><input id="kennung" name="kennung" className="feld mt-1" /></div>
            <div><label htmlFor="pruefintervall_monate" className="block text-klein font-bold">{x.arbeitsmittel.intervall}</label><input id="pruefintervall_monate" name="pruefintervall_monate" type="number" min={1} max={120} className="feld mt-1" /></div>
            <div><label htmlFor="naechste_pruefung" className="block text-klein font-bold">{x.arbeitsmittel.naechste}</label><input id="naechste_pruefung" name="naechste_pruefung" type="date" className="feld mt-1" /></div>
            <div className="flex items-end"><button className="knopf">{x.arbeitsmittel.erfassen}</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
