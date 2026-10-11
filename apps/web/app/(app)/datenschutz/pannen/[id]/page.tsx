import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { Countdown } from "@/komponenten/countdown";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import { ortszeitZuIso } from "@/lib/zeit";

export const metadata = { title: "Datenpanne" };

const RISIKEN = ["kein_risiko", "risiko", "hohes_risiko"] as const;
interface Panne {
  id: string; entdeckt_am: string; frist_bis: string; beschreibung: string; datenarten: string; betroffene_anzahl: string; folgen: string; massnahmen: string;
  risiko: (typeof RISIKEN)[number] | null; begruendung: string | null; gemeldet_am: string | null; aktenzeichen: string | null; abgeschlossen_am: string | null;
}
const seite = (id: string) => `/datenschutz/pannen/${id}`;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function speichern(id: string, f: FormData) {
  "use server";
  await senden(`/v1/datenpannen/${id}`, "PUT", {
    beschreibung: text(f, "beschreibung"), datenarten: text(f, "datenarten"), betroffene_anzahl: text(f, "betroffene_anzahl"), folgen: text(f, "folgen"),
    massnahmen: text(f, "massnahmen"), risiko: text(f, "risiko") || null, begruendung: text(f, "begruendung") || null,
  }, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

async function gemeldet(id: string, f: FormData) {
  "use server";
  const am = ortszeitZuIso(text(f, "datum"), text(f, "uhrzeit"));
  if (!am) redirect(`${seite(id)}?fehler=${encodeURIComponent("Datum und Uhrzeit prüfen")}`);
  await senden(`/v1/datenpannen/${id}/gemeldet`, "POST", { gemeldet_am: am, aktenzeichen: text(f, "aktenzeichen") || null }, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

async function abschliessen(id: string) {
  "use server";
  const r = await senden<{ erledigte_pflichten: number }>(`/v1/datenpannen/${id}/abschliessen`, "POST", undefined, seite(id));
  revalidatePath(seite(id));
  redirect(`${seite(id)}?erledigt=${r.erledigte_pflichten}`);
}

export default async function PanneSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; erledigt?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ s, t: x }, p, sp, u] = await Promise.all([t(), api<Panne>(`/v1/datenpannen/${id}`), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const offen = !p.abgeschlossen_am;
  const zeit = (iso: string) => new Intl.DateTimeFormat(s === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const jetzt = new Date();
  const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);
  const uhrzeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(jetzt);
  const felder = [["datenarten", x.panne.datenarten], ["betroffene_anzahl", x.panne.anzahl], ["folgen", x.panne.folgen], ["massnahmen", x.panne.massnahmen]] as const;
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz/pannen" className="verweis">{x.panne.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.panne.titel}</h1>
        <p className="mt-1 text-klein text-tinte-leise">{x.panne.entdeckt}: {zeit(p.entdeckt_am)}</p>
        <p className="mt-2">
          {p.gemeldet_am ? fuelle(x.panne.gemeldet, { zeit: zeit(p.gemeldet_am) }) + (p.aktenzeichen ? ` · ${p.aktenzeichen}` : "")
            : offen && p.risiko !== "kein_risiko" ? <Countdown bis={p.frist_bis} laeuft={x.panne.countdown} abgelaufen={x.panne.abgelaufen} zeit={zeit(p.frist_bis)} /> : null}
        </p>
      </header>
      {sp.fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{sp.fehler}</p> : null}
      {sp.erledigt ? <p role="status" className="rounded-md border-2 border-amt bg-amt-hauch p-4">{fuelle(x.panne.erledigt, { n: sp.erledigt })}</p> : null}

      <section aria-labelledby="angaben">
        <h2 id="angaben" className="text-gross font-bold">{x.panne.angaben}</h2>
        {darf && offen ? (
          <form action={speichern.bind(null, id)} className="mt-3 space-y-3">
            <div><label htmlFor="beschreibung" className="block text-klein font-bold">{x.panne.beschreibung}</label><textarea id="beschreibung" name="beschreibung" required rows={3} defaultValue={p.beschreibung} className="feld mt-1" /></div>
            {felder.map(([k, label]) => (
              <div key={k}><label htmlFor={k} className="block text-klein font-bold">{label}</label><textarea id={k} name={k} rows={2} defaultValue={p[k]} className="feld mt-1" /></div>
            ))}
            <fieldset>
              <legend className="text-klein font-bold">{x.panne.risiko}</legend>
              <div className="mt-1 space-y-1">
                {RISIKEN.map((r) => (
                  <label key={r} className="flex min-h-11 items-center gap-3"><input type="radio" name="risiko" value={r} defaultChecked={p.risiko === r} className="size-5 accent-amt" /> {x.panne.risiken[r]}</label>
                ))}
              </div>
            </fieldset>
            <div><label htmlFor="begruendung" className="block text-klein font-bold">{x.panne.begruendung}</label><textarea id="begruendung" name="begruendung" rows={2} defaultValue={p.begruendung ?? ""} className="feld mt-1" /></div>
            <button className="knopf">{x.panne.speichern}</button>
          </form>
        ) : (
          <dl className="mt-3 space-y-2">
            <div><dt className="text-klein font-bold">{x.panne.beschreibung}</dt><dd className="whitespace-pre-wrap">{p.beschreibung}</dd></div>
            {felder.map(([k, label]) => (p[k] ? <div key={k}><dt className="text-klein font-bold">{label}</dt><dd className="whitespace-pre-wrap">{p[k]}</dd></div> : null))}
            {p.risiko ? <div><dt className="text-klein font-bold">{x.panne.risiko}</dt><dd>{x.panne.risiken[p.risiko]}</dd></div> : null}
            {p.begruendung ? <div><dt className="text-klein font-bold">{x.panne.begruendung}</dt><dd className="whitespace-pre-wrap">{p.begruendung}</dd></div> : null}
          </dl>
        )}
      </section>

      <section aria-labelledby="meldung" className="space-y-3">
        <h2 id="meldung" className="text-gross font-bold">{x.panne.meldung}</h2>
        <p className="text-klein">{x.panne.entwurf_text}</p>
        <p><a href={`${seite(id)}/meldeentwurf`} className="verweis">{x.panne.entwurf}</a></p>
        {darf && offen && !p.gemeldet_am && p.risiko !== "kein_risiko" ? (
          <form action={gemeldet.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-klein font-bold">{x.panne.gemeldet_am}</legend>
              <div className="mt-1 grid max-w-sm grid-cols-2 gap-2">
                <input aria-label={x.panne.gemeldet_am} name="datum" type="date" required defaultValue={datum} className="feld" />
                <input aria-label={x.zeit.beginn} name="uhrzeit" type="time" required defaultValue={uhrzeit} className="feld" />
              </div>
            </fieldset>
            <div><label htmlFor="aktenzeichen" className="block text-klein font-bold">{x.panne.aktenzeichen}</label><input id="aktenzeichen" name="aktenzeichen" className="feld mt-1" /></div>
            <div className="flex items-end"><button className="knopf knopf-leise">{x.panne.eintragen}</button></div>
          </form>
        ) : null}
      </section>

      {darf && offen ? (
        <section className="space-y-3">
          <p className="text-klein">{x.panne.abschliessen_text}</p>
          <form action={abschliessen.bind(null, id)}><button className="knopf">{x.panne.abschliessen}</button></form>
        </section>
      ) : null}
    </div>
  );
}
