import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api, aktivesUnternehmen } from "@/lib/api";
import { senden } from "@/lib/aktion";
import { t } from "@/lib/sprache";
import type { Partner } from "../page";

export const metadata = { title: "Anfrage an Expertin oder Experten" };

async function anfragen(f: FormData) {
  "use server";
  const id = String(f.get("id"));
  const zurueck = `/experten/${id}`;
  if (f.get("einwilligung") !== "ja") redirect(`${zurueck}?fehler=${encodeURIComponent("Ohne Einwilligung wird nichts weitergegeben")}`);
  await senden(`/v1/partner/${id}/anfrage`, "POST", {
    nachricht: String(f.get("nachricht") ?? ""),
    paket: f.get("paket") ? String(f.get("paket")) : null,
    teilen: { unternehmen: f.get("teilen_unternehmen") === "ja", offene_pflichten: f.get("teilen_pflichten") === "ja" },
    einwilligung: true,
  }, zurueck);
  redirect("/experten?gesendet=1");
}

export default async function PartnerSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const [{ id }, { fehler }] = await Promise.all([params, searchParams]);
  const [{ s, t: x }, alle, u] = await Promise.all([t(), api<Partner[]>("/v1/partner"), aktivesUnternehmen()]);
  const p = alle.find((a) => a.id === id);
  if (!p) notFound();
  const e = x.experten;
  return (
    <div className="lesetext space-y-6">
      <p><Link href="/experten" className="verweis text-klein">{e.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{p.name}</h1>
        <p className="mt-1">{e.qualifikationen[p.qualifikation]}{p.kanzlei ? ` · ${p.kanzlei}` : ""} · {p.regionen.length ? p.regionen.join(", ") : e.bundesweit}</p>
        <p className="mt-1 text-klein text-tinte-leise">{fuelle(e.zulassung, { datum: datumLang(p.zulassung_geprueft_am, s) })}</p>
        {p.website ? <p className="mt-1"><a href={p.website} className="verweis" rel="noopener noreferrer" target="_blank">{p.website}</a></p> : null}
      </header>
      {p.beschreibung ? <p>{p.beschreibung}</p> : null}
      {p.pakete.length ? (
        <section>
          <h2 className="text-gross font-bold">{e.pakete}</h2>
          <ul className="mt-2 space-y-2">
            {p.pakete.map((k) => (
              <li key={k.titel} className="rounded-md border border-linie p-3">
                <p className="font-bold">{k.titel}{k.preis_text ? ` – ${k.preis_text}` : ""}</p>
                {k.umfang ? <p className="text-klein">{k.umfang}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {u.rolle !== "mitarbeiter" ? (
        <form action={anfragen} className="space-y-4 rounded-md border border-linie bg-blatt p-4">
          <h2 className="text-gross font-bold">{e.anfragen}</h2>
          <input type="hidden" name="id" value={p.id} />
          <div>
            <label htmlFor="nachricht" className="block font-bold">{e.nachricht}</label>
            <textarea id="nachricht" name="nachricht" required minLength={10} maxLength={4000} rows={5} className="feld mt-1 w-full" />
          </div>
          {p.pakete.length ? (
            <div>
              <label htmlFor="paket" className="block font-bold">{e.paket}</label>
              <select id="paket" name="paket" className="feld mt-1">
                <option value="">{e.kein_paket}</option>
                {p.pakete.map((k) => <option key={k.titel} value={k.titel}>{k.titel}</option>)}
              </select>
            </div>
          ) : null}
          <fieldset className="space-y-2">
            <legend className="font-bold">{e.teilen}</legend>
            <p className="text-klein">✓ {e.teilen_kontakt}</p>
            <label className="flex gap-2"><input type="checkbox" name="teilen_unternehmen" value="ja" /> {e.teilen_unternehmen}</label>
            <label className="flex gap-2"><input type="checkbox" name="teilen_pflichten" value="ja" /> {e.teilen_pflichten}</label>
          </fieldset>
          <label className="flex gap-2 font-bold"><input type="checkbox" name="einwilligung" value="ja" required /> {e.einwilligung}</label>
          <button className="knopf">{e.senden}</button>
        </form>
      ) : null}
    </div>
  );
}
