import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { EingabeFehler, api, apiAntwort } from "@/lib/api";
import { euroText, mengeAus, preisCentAus, preisFeld, zeileCent } from "@/lib/geld";
import { t } from "@/lib/sprache";

export const metadata = { title: "Rechnung" };

type Einheit = "stueck" | "stunde" | "tag" | "monat" | "pauschal" | "kilogramm";
const EINHEITEN: Einheit[] = ["stueck", "stunde", "tag", "monat", "pauschal", "kilogramm"];
interface Pos { bezeichnung: string; menge: number; einheit: Einheit; preis_cent: number; ust_art?: "regel" | "ermaessigt" | null; ust_satz?: number | null }
interface Rechnung {
  id: string; nummer: string | null; status: "entwurf" | "gestellt" | "storniert"; art: "rechnung" | "storno"; rechnungsdatum: string | null; leistungsdatum: string | null;
  faellig_am: string | null; kunde_id: string | null; kunde: { name: string; geschaeftskunde?: boolean } | null; positionen: Pos[]; kleinunternehmer: boolean; hinweis: string | null;
  netto_cent: number; ust_cent: number; brutto_cent: number; pdf_dokument_id: string | null; xml_dokument_id: string | null; storniert_rechnung_id: string | null;
}
interface Kunde { id: string; name: string; geschaeftskunde: boolean }

function ausFormular(f: FormData, s: "de" | "en") {
  const n = Number(f.get("anzahl") ?? 0);
  const positionen = [];
  for (let i = 0; i < n; i++) {
    const bezeichnung = String(f.get(`p${i}_bezeichnung`) ?? "").trim();
    if (!bezeichnung) continue;
    const preis = preisCentAus(f.get(`p${i}_preis`), s);
    positionen.push({
      bezeichnung,
      menge: mengeAus(f.get(`p${i}_menge`), s),
      einheit: String(f.get(`p${i}_einheit`) ?? "stueck"),
      preis_cent: preis === null ? 0 : preis,
      ust_art: f.get(`p${i}_ust`) === "ermaessigt" ? "ermaessigt" : f.get(`p${i}_ust`) === "keine" ? null : "regel",
    });
  }
  const datum = (k: string) => String(f.get(k) ?? "").trim() || null;
  return { kunde_id: datum("kunde_id"), leistungsdatum: datum("leistungsdatum"), faellig_am: datum("faellig_am"), hinweis: datum("hinweis"), positionen };
}

async function speichern(id: string, f: FormData) {
  "use server";
  const { s } = await t();
  const aktion = String(f.get("aktion") ?? "speichern");
  const daten = ausFormular(f, s);
  try {
    await api(`/v1/rechnungen/${id}`, { method: "PUT", body: JSON.stringify(daten) });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/finanzen/rechnungen/${id}?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(`/finanzen/rechnungen/${id}`);
  if (aktion === "zeile") redirect(`/finanzen/rechnungen/${id}?zeilen=${daten.positionen.length + 1}`);
  if (aktion === "stellen") {
    const r = await apiAntwort(`/v1/rechnungen/${id}/stellen`, { method: "POST" });
    if (r.status === 422) {
      const b = (await r.json()) as { fehlend?: string[]; fehler?: { feld: string; meldung: string }[] };
      redirect(`/finanzen/rechnungen/${id}?fehlend=${encodeURIComponent((b.fehlend ?? b.fehler?.map((x) => x.feld) ?? []).join(","))}`);
    }
    if (!r.ok) throw new Error(`Stellen: ${r.status}`);
    revalidatePath("/finanzen");
  }
  redirect(`/finanzen/rechnungen/${id}`);
}

async function loeschen(id: string) {
  "use server";
  await api(`/v1/rechnungen/${id}`, { method: "DELETE" });
  redirect("/finanzen/rechnungen");
}

async function stornieren(id: string) {
  "use server";
  const r = await api<{ id: string }>(`/v1/rechnungen/${id}/stornieren`, { method: "POST" });
  revalidatePath("/finanzen");
  redirect(`/finanzen/rechnungen/${r.id}`);
}

export default async function RechnungSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; fehlend?: string; zeilen?: string }> }) {
  const [{ id }, sp, { s, t: x }] = await Promise.all([params, searchParams, t()]);
  const [r, kunden] = await Promise.all([api<Rechnung>(`/v1/rechnungen/${id}`), api<Kunde[]>("/v1/kunden")]);
  const namen = x.rechnung.fehlend_namen as Record<string, string>;
  const zurueck = <p className="text-klein"><Link href="/finanzen/rechnungen" className="verweis">{x.finanzen.rechnungen}</Link></p>;

  if (r.status !== "entwurf") {
    const vz = r.art === "storno" ? -1 : 1;
    return (
      <div className="lesetext space-y-6">
        {zurueck}
        <header>
          <p className="text-klein text-tinte-leise">{r.art === "storno" ? x.rechnung.storno : x.rechnung[r.status]}</p>
          <h1 className="text-titel font-bold">{r.nummer}</h1>
          <p className="mt-1">{r.kunde?.name} · {r.rechnungsdatum ? datumLang(r.rechnungsdatum, s) : ""}</p>
        </header>
        <table className="tabelle">
          <thead><tr><th scope="col">{x.rechnung.bezeichnung}</th><th scope="col" className="text-right">{x.rechnung.menge}</th><th scope="col" className="text-right">{x.rechnung.betrag}</th></tr></thead>
          <tbody>
            {r.positionen.map((p, i) => (
              <tr key={i}>
                <td>{p.bezeichnung}{p.ust_satz != null ? <span className="text-klein text-tinte-leise"> · {p.ust_satz} %</span> : null}</td>
                <td className="text-right tabular-nums">{p.menge} {x.rechnung.einheiten[p.einheit]}</td>
                <td className="text-right tabular-nums">{euroText(vz * zeileCent(p.menge, p.preis_cent), s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto max-w-xs space-y-1">
          <div className="flex justify-between gap-6"><dt>{x.rechnung.summe_netto}</dt><dd className="tabular-nums">{euroText(vz * r.netto_cent, s)}</dd></div>
          <div className="flex justify-between gap-6"><dt>{x.rechnung.summe_ust}</dt><dd className="tabular-nums">{euroText(vz * r.ust_cent, s)}</dd></div>
          <div className="flex justify-between gap-6 font-bold"><dt>{x.rechnung.summe_brutto}</dt><dd className="tabular-nums">{euroText(vz * r.brutto_cent, s)}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-3">
          {r.pdf_dokument_id ? <a href={`/finanzen/dokument/${r.pdf_dokument_id}`} className="knopf">{x.rechnung.pdf}</a> : null}
          {r.xml_dokument_id ? <a href={`/finanzen/dokument/${r.xml_dokument_id}`} className="knopf knopf-leise">{x.rechnung.xml}</a> : null}
        </div>
        {r.status === "gestellt" && r.art === "rechnung" ? (
          <form action={stornieren.bind(null, r.id)} className="border-t border-linie pt-6">
            <button className="knopf knopf-leise">{x.rechnung.stornieren}</button>
          </form>
        ) : null}
      </div>
    );
  }

  const n = Math.max(Number(sp.zeilen ?? 0), r.positionen.length + (r.positionen.length ? 0 : 1));
  const zeilen: (Pos | null)[] = Array.from({ length: n }, (_, i) => r.positionen[i] ?? null);
  const netto = r.positionen.reduce((a, p) => a + zeileCent(p.menge, p.preis_cent), 0);
  const fehlend = sp.fehlend ? sp.fehlend.split(",").filter(Boolean) : [];
  return (
    <div className="space-y-6">
      {zurueck}
      <h1 className="text-titel font-bold">{x.rechnung.neu}</h1>
      {sp.fehler ? <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {fehlend.length ? (
        <div role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">
          <p>{fuelle(x.rechnung.fehlend, { liste: fehlend.map((f) => namen[f.replace(/\./g, "_")] ?? f).join(", ") })}</p>
          {fehlend.some((f) => f.startsWith("steller") || f.startsWith("kunde")) ? <p className="mt-2"><Link href="/finanzen/angaben" className="verweis">{x.finanzen.angaben}</Link></p> : null}
        </div>
      ) : null}
      <p className="lesetext text-klein text-tinte-leise">{r.kleinunternehmer ? x.rechnung.ku_info : x.rechnung.e_rechnung_info}</p>

      <form action={speichern.bind(null, r.id)} className="space-y-6">
        <input type="hidden" name="anzahl" value={n} />
        <div className="lesetext grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="kunde_id" className="block font-bold">{x.rechnung.kunde}</label>
            {kunden.length ? (
              <select id="kunde_id" name="kunde_id" defaultValue={r.kunde_id ?? ""} className="feld mt-1">
                <option value="">{x.rechnung.kunde_waehlen}</option>
                {kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            ) : (
              <p className="mt-1"><Link href="/finanzen/angaben#kunden" className="verweis">{x.rechnung.kein_kunde}</Link></p>
            )}
          </div>
          <div>
            <label htmlFor="leistungsdatum" className="block font-bold">{x.rechnung.leistungsdatum}</label>
            <input id="leistungsdatum" name="leistungsdatum" type="date" defaultValue={r.leistungsdatum ?? ""} className="feld mt-1" />
          </div>
          <div>
            <label htmlFor="faellig_am" className="block font-bold">{x.rechnung.faellig}</label>
            <input id="faellig_am" name="faellig_am" type="date" defaultValue={r.faellig_am ?? ""} className="feld mt-1" />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-gross font-bold">{x.rechnung.positionen}</legend>
          {zeilen.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-linie p-3 sm:grid-cols-[1fr_6rem_8rem_9rem_9rem]">
              <div>
                <label htmlFor={`p${i}_bezeichnung`} className="block text-klein font-bold">{x.rechnung.bezeichnung}</label>
                <input id={`p${i}_bezeichnung`} name={`p${i}_bezeichnung`} defaultValue={p?.bezeichnung ?? ""} className="feld mt-1" />
              </div>
              <div>
                <label htmlFor={`p${i}_menge`} className="block text-klein font-bold">{x.rechnung.menge}</label>
                <input id={`p${i}_menge`} name={`p${i}_menge`} inputMode="decimal" defaultValue={p ? String(p.menge).replace(".", s === "de" ? "," : ".") : "1"} className="feld mt-1" />
              </div>
              <div>
                <label htmlFor={`p${i}_einheit`} className="block text-klein font-bold">{x.rechnung.einheit}</label>
                <select id={`p${i}_einheit`} name={`p${i}_einheit`} defaultValue={p?.einheit ?? "stueck"} className="feld mt-1">
                  {EINHEITEN.map((e) => <option key={e} value={e}>{x.rechnung.einheiten[e]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`p${i}_preis`} className="block text-klein font-bold">{x.rechnung.preis}</label>
                <input id={`p${i}_preis`} name={`p${i}_preis`} inputMode="decimal" defaultValue={p ? preisFeld(p.preis_cent, s) : ""} className="feld mt-1" />
              </div>
              {r.kleinunternehmer ? <input type="hidden" name={`p${i}_ust`} value="keine" /> : (
                <div>
                  <label htmlFor={`p${i}_ust`} className="block text-klein font-bold">{x.rechnung.steuersatz}</label>
                  <select id={`p${i}_ust`} name={`p${i}_ust`} defaultValue={p?.ust_art ?? "regel"} className="feld mt-1">
                    <option value="regel">{x.rechnung.regel}</option>
                    <option value="ermaessigt">{x.rechnung.ermaessigt}</option>
                  </select>
                </div>
              )}
            </div>
          ))}
          <button name="aktion" value="zeile" className="knopf knopf-leise">{x.rechnung.zeile}</button>
        </fieldset>

        <div className="lesetext">
          <label htmlFor="hinweis" className="block font-bold">{x.rechnung.hinweis}</label>
          <textarea id="hinweis" name="hinweis" rows={2} maxLength={1000} defaultValue={r.hinweis ?? ""} className="feld mt-1" />
        </div>
        <p className="lesetext font-bold">{x.rechnung.summe_netto}: {euroText(netto, s)}</p>
        <div className="lesetext space-y-2 border-t border-linie pt-4">
          <div className="flex flex-wrap gap-3">
            <button name="aktion" value="speichern" className="knopf knopf-leise">{x.rechnung.speichern}</button>
            <button name="aktion" value="stellen" className="knopf">{x.rechnung.stellen}</button>
          </div>
          <p className="text-klein text-tinte-leise">{x.rechnung.stellen_text}</p>
        </div>
      </form>
      <form action={loeschen.bind(null, r.id)} className="lesetext">
        <button className="text-klein underline">{x.rechnung.loeschen}</button>
      </form>
    </div>
  );
}
