import Link from "next/link";
import { fuelle } from "@amtlos/i18n";
import { DruckenKnopf } from "@/komponenten/drucken";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Fragebogen vorbereiten" };

interface Vorbereitung {
  abschnitte: { titel: string; angaben: { feld: string; label: string; wert: string | null; schritt: string }[] }[];
  fehlend: string[];
  hinweise: "verzicht_bindet"[];
  uebermittlung: { verfuegbar: boolean; grund?: string; alternative?: { titel: string; url: string } };
}

export default async function FragebogenSeite() {
  const [{ t: x }, v] = await Promise.all([t(), api<Vorbereitung>("/v1/gruendung/fragebogen")]);
  return (
    <div className="lesetext space-y-8">
      <header>
        <p className="text-klein print:hidden">
          <Link href="/gruendung" className="verweis">
            {x.fragebogen.zurueck}
          </Link>
        </p>
        <h1 className="mt-2 text-titel font-bold">{x.fragebogen.titel}</h1>
        <p className="mt-2">{x.fragebogen.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.fragebogen.hinweis_vorbereitung}</p>
      </header>

      {v.hinweise.includes("verzicht_bindet") ? (
        <p className="rounded-md border-2 border-bald bg-bald-hauch p-4">{x.fragebogen.verzicht_bindet}</p>
      ) : null}

      {v.abschnitte.map((a) => (
        <section key={a.titel} aria-labelledby={`abschnitt-${a.titel}`}>
          <h2 id={`abschnitt-${a.titel}`} className="text-gross font-bold">
            {a.titel}
          </h2>
          <dl className="mt-2 border-t border-linie">
            {a.angaben.map((g) => (
              <div key={g.feld} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linie py-3">
                <dt>{g.label}</dt>
                <dd className="font-bold">
                  {g.wert ?? (
                    <span className="font-normal">
                      <span className="text-frist">{x.fragebogen.fehlt}</span>
                      {g.schritt ? (
                        <>
                          {" · "}
                          <Link href={`/onboarding/${g.schritt}?zurueck=/gruendung/fragebogen`} className="verweis print:hidden">
                            {x.fragebogen.ergaenzen}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section aria-labelledby="uebermitteln" className="rounded-md border border-linie bg-blatt p-5 print:hidden">
        <h2 id="uebermitteln" className="font-bold">
          {x.fragebogen.uebermitteln_titel}
        </h2>
        {v.uebermittlung.verfuegbar ? null : (
          <>
            <p className="mt-2">
              {x.fragebogen.nicht_verfuegbar} {v.uebermittlung.grund}
            </p>
            {v.uebermittlung.alternative ? (
              <p className="mt-2">
                {fuelle(x.fragebogen.alternative, { titel: v.uebermittlung.alternative.titel })}{" "}
                <a href={v.uebermittlung.alternative.url} className="verweis" target="_blank" rel="noreferrer">
                  {v.uebermittlung.alternative.titel}
                </a>
              </p>
            ) : null}
          </>
        )}
      </section>

      <DruckenKnopf text={x.fragebogen.drucken} />
    </div>
  );
}
