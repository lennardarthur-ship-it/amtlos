import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fuelle } from "@amtlos/i18n";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Verzeichnis der Verarbeitungstätigkeiten" };

const FELDER = ["zweck", "rechtsgrundlage", "betroffene", "datenarten", "empfaenger", "drittland", "loeschfrist", "tom_hinweis"] as const;
const PFLICHTFELDER = ["zweck", "rechtsgrundlage", "betroffene", "datenarten", "loeschfrist"] as const;
type Feld = (typeof FELDER)[number];
type Verarbeitung = { id: string; bezeichnung: string; aktiv: boolean } & Record<Feld, string>;
const SEITE = "/datenschutz/vvt";
const daten = (f: FormData) => ({ bezeichnung: String(f.get("bezeichnung") ?? ""), ...Object.fromEntries(FELDER.map((k) => [k, String(f.get(k) ?? "")])) });

async function anlegen(f: FormData) {
  "use server";
  await senden("/v1/verarbeitungen", "POST", daten(f), SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function vorschlag(bezeichnung: string) {
  "use server";
  await senden("/v1/verarbeitungen", "POST", { bezeichnung }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

async function speichern(id: string, aktiv: boolean, f: FormData) {
  "use server";
  await senden(`/v1/verarbeitungen/${id}`, "PUT", { ...daten(f), aktiv: f.get("umschalten") ? !aktiv : aktiv }, SEITE);
  revalidatePath(SEITE);
  redirect(SEITE);
}

function Formular({ x, v, aktion, knopf, praefix }: { x: Awaited<ReturnType<typeof t>>["t"]; v?: Verarbeitung; aktion: (f: FormData) => Promise<void>; knopf: string; praefix: string }) {
  return (
    <form action={aktion} className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor={`${praefix}-bezeichnung`} className="block text-klein font-bold">{x.vvt.bezeichnung}</label><input id={`${praefix}-bezeichnung`} name="bezeichnung" required defaultValue={v?.bezeichnung} className="feld mt-1" /></div>
      {FELDER.map((k) => (
        <div key={k}><label htmlFor={`${praefix}-${k}`} className="block text-klein font-bold">{x.vvt[k]}</label><textarea id={`${praefix}-${k}`} name={k} rows={2} defaultValue={v?.[k]} className="feld mt-1" /></div>
      ))}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button className="knopf">{knopf}</button>
        {v ? <button name="umschalten" value="1" className="knopf knopf-leise">{v.aktiv ? x.vvt.stilllegen : x.vvt.reaktivieren}</button> : null}
      </div>
    </form>
  );
}

export default async function VvtSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ t: x }, liste, vorschlaege, { fehler }, u] = await Promise.all([t(), api<Verarbeitung[]>("/v1/verarbeitungen"), api<string[]>("/v1/verarbeitungen/vorschlaege"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  return (
    <div className="lesetext space-y-8">
      <p className="text-klein"><Link href="/datenschutz" className="verweis">{x.ds.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{x.vvt.titel}</h1>
        <p className="mt-2">{x.vvt.text}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {darf && vorschlaege.length ? (
        <section aria-labelledby="vorschlaege">
          <h2 id="vorschlaege" className="font-bold">{x.vvt.vorschlaege}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {vorschlaege.map((b) => (
              <li key={b}><form action={vorschlag.bind(null, b)}><button className="knopf knopf-leise">+ {b}</button></form></li>
            ))}
          </ul>
        </section>
      ) : null}
      {liste.length ? (
        <ul className="border-t border-linie">
          {liste.map((v) => {
            const fehlt = PFLICHTFELDER.filter((k) => !v[k].trim());
            return (
              <li key={v.id} className={`space-y-1 border-b border-linie py-3 ${v.aktiv ? "" : "text-tinte-leise"}`}>
                <p className="font-bold">{v.bezeichnung}{v.aktiv ? "" : ` · ${x.vvt.inaktiv}`}</p>
                {v.zweck ? <p className="text-klein">{v.zweck}</p> : null}
                {v.aktiv && fehlt.length ? <p className="text-klein font-bold text-bald">{fuelle(x.vvt.unvollstaendig, { felder: fehlt.map((k) => x.vvt[k]).join(", ") })}</p> : null}
                {darf ? (
                  <details>
                    <summary className="cursor-pointer text-klein text-amt">{x.vvt.bearbeiten}</summary>
                    <Formular x={x} v={v} aktion={speichern.bind(null, v.id, v.aktiv)} knopf={x.vvt.speichern} praefix={v.id} />
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{x.vvt.leer}</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="rounded-md border border-linie bg-blatt p-4">
          <h2 id="neu" className="font-bold">{x.vvt.neu}</h2>
          <Formular x={x} aktion={anlegen} knopf={x.vvt.anlegen} praefix="neu" />
        </section>
      ) : null}
    </div>
  );
}
