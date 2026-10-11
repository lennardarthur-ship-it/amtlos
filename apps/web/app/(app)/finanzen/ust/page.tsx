import Link from "next/link";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { euroText } from "@/lib/geld";
import { t } from "@/lib/sprache";

export const metadata = { title: "Umsatzsteuer-Voranmeldung vorbereiten" };

interface Vorbereitung {
  periode: string; von: string; bis: string;
  umsaetze: { satz: number | null; netto_cent: number; ust_cent: number }[];
  umsatzsteuer_cent: number; vorsteuer_cent: number; zahllast_cent: number;
  rechnungen: number; belege: number; belege_ohne_steuerangabe: number;
  uebermittlung: { verfuegbar: boolean; grund?: string; alternative?: { titel: string; url: string } };
}

function letzterMonat() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Auswahl: die letzten 12 Monate und 4 Quartale */
function zeitraeume() {
  const heute = new Date();
  const monate = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const q = Math.floor(heute.getUTCMonth() / 3);
  const quartale = Array.from({ length: 4 }, (_, i) => {
    const gesamt = heute.getUTCFullYear() * 4 + q - i;
    return `${Math.floor(gesamt / 4)}-Q${(gesamt % 4) + 1}`;
  });
  return [...monate, ...quartale];
}

export default async function UstSeite({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const [{ s, t: x }, sp] = await Promise.all([t(), searchParams]);
  const periode = sp.periode && /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(sp.periode) ? sp.periode : letzterMonat();
  const v = await api<Vorbereitung>(`/v1/finanzen/ust-voranmeldung?periode=${periode}`);
  return (
    <div className="lesetext space-y-6">
      <p className="text-klein"><Link href="/finanzen" className="verweis">{x.finanzen.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.ust_va.titel}</h1>
        <p className="mt-2">{x.ust_va.text}</p>
      </header>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="periode" className="block font-bold">{x.ust_va.zeitraum}</label>
          <select id="periode" name="periode" defaultValue={periode} className="feld mt-1 w-auto">
            {zeitraeume().map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <button className="knopf knopf-leise">{x.ust_va.anzeigen}</button>
      </form>
      <p className="text-klein text-tinte-leise">{datumLang(v.von, s)} – {datumLang(v.bis, s)}</p>

      <section aria-labelledby="umsaetze">
        <h2 id="umsaetze" className="text-gross font-bold">{x.ust_va.umsaetze}</h2>
        <table className="tabelle mt-2">
          <thead><tr><th scope="col"></th><th scope="col" className="text-right">{x.ust_va.netto}</th><th scope="col" className="text-right">{x.ust_va.ust}</th></tr></thead>
          <tbody>
            {v.umsaetze.map((u) => (
              <tr key={String(u.satz)}>
                <th scope="row" className="font-normal">{u.satz === null ? x.ust_va.ohne_ust : fuelle(x.ust_va.satz, { satz: u.satz })}</th>
                <td className="text-right tabular-nums">{euroText(u.netto_cent, s)}</td>
                <td className="text-right tabular-nums">{euroText(u.ust_cent, s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <dl className="space-y-1">
        <div className="flex justify-between gap-6"><dt>{x.ust_va.ust}</dt><dd className="tabular-nums">{euroText(v.umsatzsteuer_cent, s)}</dd></div>
        <div className="flex justify-between gap-6"><dt>{x.ust_va.vorsteuer}</dt><dd className="tabular-nums">− {euroText(v.vorsteuer_cent, s)}</dd></div>
        <div className="flex justify-between gap-6 border-t border-linie pt-1 font-bold"><dt>{x.ust_va.zahllast}</dt><dd className="tabular-nums">{euroText(v.zahllast_cent, s)}</dd></div>
      </dl>
      {v.belege_ohne_steuerangabe ? (
        <p className="rounded-md border-2 border-bald bg-bald-hauch p-4">
          {fuelle(x.ust_va.belege_ohne, { n: v.belege_ohne_steuerangabe })} <Link href="/finanzen/belege" className="verweis">{x.finanzen.belege}</Link>
        </p>
      ) : null}
      <p className="text-klein text-tinte-leise">{x.ust_va.hinweis}</p>
      {!v.uebermittlung.verfuegbar ? (
        <p className="rounded-md border border-linie bg-blatt p-4">
          {x.fragebogen.nicht_verfuegbar}{" "}
          {v.uebermittlung.alternative ? <a href={v.uebermittlung.alternative.url} className="verweis" target="_blank" rel="noreferrer">{v.uebermittlung.alternative.titel}</a> : null}
        </p>
      ) : null}
    </div>
  );
}
