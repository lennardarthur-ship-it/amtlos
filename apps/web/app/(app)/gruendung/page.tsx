import Link from "next/link";
import { revalidatePath } from "next/cache";
import { datumLang, fuelle } from "@amtlos/i18n";
import { StatusText } from "@/komponenten/status";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Gruendung } from "@/lib/typen";

export const metadata = { title: "Gründung" };

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig"]);

async function erledigen(pflichtId: string, periode: string) {
  "use server";
  await api(`/v1/pflichten/${encodeURIComponent(pflichtId)}/${encodeURIComponent(periode)}/erledigen`, { method: "POST", body: "{}" });
  revalidatePath("/gruendung");
}

function wertText(wert: number, einheit: string, s: "de" | "en") {
  const zahl = new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB").format(wert);
  return einheit === "EUR" ? `${zahl} €` : einheit === "prozent" ? `${zahl} %` : `${zahl} ${einheit}`;
}

export default async function GruendungSeite() {
  const [{ s, t: x }, g] = await Promise.all([t(), api<Gruendung>("/v1/gruendung")]);
  const f = g.fortschritt;
  return (
    <div className="space-y-8">
      <header className="lesetext">
        <h1 className="text-titel font-bold">{x.gruendung.titel}</h1>
        <p className="mt-2">{x.gruendung.text}</p>
      </header>

      {f.gesamt ? (
        <div className="lesetext">
          <p className="font-bold">{fuelle(x.gruendung.fortschritt, { n: f.erledigt, gesamt: f.gesamt })}</p>
          <progress className="mt-2 h-2 w-full accent-amt" value={f.erledigt} max={f.gesamt} aria-label={fuelle(x.gruendung.fortschritt, { n: f.erledigt, gesamt: f.gesamt })} />
        </div>
      ) : (
        <p className="lesetext">{x.gruendung.leer}</p>
      )}

      {f.fertig ? (
        <section role="status" className="lesetext rounded-md border-2 border-amt bg-amt-hauch p-6">
          <p className="text-gross font-bold text-amt">{x.gruendung.fertig_titel}</p>
          <p className="mt-2">{x.gruendung.fertig_text}</p>
        </section>
      ) : null}

      {g.kapitalgesellschaft && g.kennzahlen.length ? (
        <section aria-labelledby="eckdaten" className="lesetext rounded-md border border-linie bg-blatt p-5">
          <h2 id="eckdaten" className="font-bold">
            {fuelle(x.gruendung.eckdaten, { rechtsform: g.kapitalgesellschaft === "ug" ? "UG" : "GmbH" })}
          </h2>
          <dl className="mt-2 space-y-1">
            {g.kennzahlen.map((k) => (
              <div key={k.id} className="flex flex-wrap justify-between gap-x-4">
                <dt>{k.bezeichnung}</dt>
                <dd className="font-bold">
                  {wertText(k.wert, k.einheit, s)}
                  {k.ungeprueft ? <span className="ml-2 text-klein font-normal text-tinte-leise">({x.gruendung.ungeprueft})</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <ol className="lesetext border-t border-linie">
        {g.schritte.map((schritt, i) => {
          const gesperrt = schritt.gesperrt_durch.length > 0;
          const fertig = schritt.status === "erledigt";
          return (
            <li key={`${schritt.pflicht_id}|${schritt.periode}`} className="flex gap-4 border-b border-linie py-5">
              <span
                aria-hidden="true"
                className={`flex size-9 flex-none items-center justify-center rounded-full border-2 font-bold ${fertig ? "border-amt bg-amt text-papier" : "border-linie"}`}
              >
                {fertig ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-gross font-bold">
                  <Link href={`/pflichten/${encodeURIComponent(schritt.pflicht_id)}/${encodeURIComponent(schritt.periode)}`} className="hover:underline">
                    {schritt.titel}
                  </Link>
                </h2>
                <p>{schritt.kurz}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-klein">
                  <StatusText status={schritt.status} sprache={s} />
                  {schritt.faellig_am && !fertig ? <span>{fuelle(x.gruendung.faellig, { datum: datumLang(schritt.faellig_am, s) })}</span> : null}
                  <span className="text-tinte-leise">{schritt.stelle}</span>
                </p>
                {gesperrt ? (
                  <p className="text-klein font-bold">{fuelle(x.gruendung.erst, { liste: schritt.gesperrt_durch.map((v) => v.titel).join(", ") })}</p>
                ) : null}
                <div className="flex flex-wrap gap-3 pt-1">
                  {!fertig && !gesperrt && OFFEN.has(schritt.status) && schritt.ergebnis === "gilt" ? (
                    <form action={erledigen.bind(null, schritt.pflicht_id, schritt.periode)}>
                      <button className="knopf">{x.gruendung.erledigen}</button>
                    </form>
                  ) : null}
                  {schritt.pflicht_id === "gruendung.fragebogen_steuerliche_erfassung" && !fertig ? (
                    <Link href="/gruendung/fragebogen" className="knopf knopf-leise">
                      {x.gruendung.fragebogen}
                    </Link>
                  ) : null}
                  {schritt.status === "angabe_fehlt" ? (
                    <Link href={`/pflichten/${encodeURIComponent(schritt.pflicht_id)}/${encodeURIComponent(schritt.periode)}`} className="knopf knopf-leise">
                      {x.gruendung.angaben}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
