import { VerweisZeile } from "@/komponenten/verweis-zeile";
import { fuelle } from "@amtlos/i18n";
import { api } from "@/lib/api";
import { euroText } from "@/lib/geld";
import { t } from "@/lib/sprache";

export const metadata = { title: "Finanzen" };

interface Uebersicht {
  jahr: number;
  umsatz_eur: number;
  kleinunternehmer: boolean;
  grenze: { id: string; wert_eur: number; anteil: number; ungeprueft: boolean } | null;
  entwuerfe: number;
  belege: number;
}

export default async function FinanzenSeite() {
  const [{ s, t: x }, u] = await Promise.all([t(), api<Uebersicht>("/v1/finanzen/uebersicht")]);
  const prozent = u.grenze ? Math.floor(u.grenze.anteil * 1000) / 10 : 0;
  const stufe = u.grenze ? (u.grenze.anteil >= 0.95 ? "95" : u.grenze.anteil >= 0.8 ? "80" : null) : null;
  const links = [
    { href: "/finanzen/rechnungen", text: x.finanzen.rechnungen, erklaerung: x.finanzen.rechnungen_text, info: u.entwuerfe ? fuelle(x.finanzen.entwuerfe, { n: u.entwuerfe }) : null },
    { href: "/finanzen/belege", text: x.finanzen.belege, erklaerung: x.finanzen.belege_text, info: fuelle(x.finanzen.belege_anzahl, { n: u.belege }) },
    { href: "/finanzen/ust", text: x.finanzen.ust, erklaerung: x.finanzen.ust_text, info: null },
    { href: "/finanzen/kassen", text: x.finanzen.kassen, erklaerung: x.finanzen.kassen_text, info: null },
    { href: "/finanzen/angaben", text: x.finanzen.angaben, erklaerung: x.finanzen.angaben_text, info: null },
  ];
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.finanzen.titel}</h1>
        <p className="mt-2">{x.finanzen.text}</p>
      </header>

      <section aria-labelledby="umsatz" className="rounded-md border border-linie bg-blatt p-5">
        <h2 id="umsatz" className="text-klein text-tinte-leise">
          {fuelle(x.finanzen.umsatz, { jahr: u.jahr })}
        </h2>
        <p className="mt-1 text-titel font-bold">{euroText(Math.round(u.umsatz_eur * 100), s)}</p>
        {u.kleinunternehmer && u.grenze ? (
          <div className="mt-4">
            <p className="font-bold">
              {x.finanzen.grenze}: {fuelle(x.finanzen.grenze_stand, { anteil: prozent.toLocaleString(s === "de" ? "de-DE" : "en-GB"), grenze: euroText(u.grenze.wert_eur * 100, s) })}
            </p>
            <div className="relative mt-2 h-3 rounded-full bg-linie" aria-hidden="true">
              <div className={`h-3 rounded-full ${stufe === "95" ? "bg-frist" : stufe === "80" ? "bg-bald" : "bg-amt"}`} style={{ width: `${Math.min(100, prozent)}%` }} />
              <span className="absolute inset-y-0 left-[80%] w-px bg-tinte" />
              <span className="absolute inset-y-0 left-[95%] w-px bg-tinte" />
            </div>
            {stufe ? <p className="mt-2 font-bold">{stufe === "95" ? x.finanzen.warnung_95 : x.finanzen.warnung_80}</p> : null}
            <p className="mt-2 text-klein text-tinte-leise">
              {x.finanzen.grenze_hinweis}
              {u.grenze.ungeprueft ? ` (${x.finanzen.ungeprueft})` : ""}
            </p>
          </div>
        ) : null}
      </section>

      <ul className="border-t border-linie">
        {links.map((l) => (
          <VerweisZeile key={l.href} href={l.href} titel={l.text} text={l.erklaerung} info={l.info} />
        ))}
      </ul>
    </div>
  );
}
