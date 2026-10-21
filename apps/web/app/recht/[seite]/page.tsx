import Link from "next/link";
import { notFound } from "next/navigation";
import { Fusszeile } from "@/komponenten/fusszeile";
import { Markenname } from "@/komponenten/markenname";
import { t } from "@/lib/sprache";
import { MARKE } from "@amtlos/marke";

const SEITEN = ["impressum", "datenschutz", "agb"] as const;
type Seite = (typeof SEITEN)[number];

export async function generateMetadata({ params }: { params: Promise<{ seite: string }> }) {
  const { seite } = await params;
  const { t: x } = await t();
  return { title: (SEITEN as readonly string[]).includes(seite) ? x.recht[seite as Seite] : "Recht" };
}

/**
 * Rechtsseiten (E-115): Struktur und Platzhalter stehen fest, die Angaben kommen aus der Konfiguration des Betreibers
 * (RECHT_*). Texte sind Entwürfe und vor dem Livegang anwaltlich zu prüfen (T-46) – das steht sichtbar auf der Seite,
 * solange die Freigabe fehlt (RECHT_FREIGEGEBEN=ja).
 */
export default async function RechtSeite({ params }: { params: Promise<{ seite: string }> }) {
  const { seite } = await params;
  if (!(SEITEN as readonly string[]).includes(seite)) notFound();
  const { t: x } = await t();
  const e = process.env;
  const betreiber = {
    name: e.RECHT_BETREIBER ?? "[Betreiber: Firma und Rechtsform]",
    anschrift: e.RECHT_ANSCHRIFT ?? "[Straße Hausnummer, PLZ Ort]",
    vertreten: e.RECHT_VERTRETEN ?? "[Vertretungsberechtigte Person]",
    email: e.RECHT_EMAIL ?? MARKE.email,
    register: e.RECHT_REGISTER ?? "[Registergericht und Registernummer]",
    ust_id: e.RECHT_UST_ID ?? "[USt-IdNr.]",
    dsb: e.RECHT_DSB ?? "[Datenschutzbeauftragte:r, falls bestellt]",
    aufsicht: e.RECHT_AUFSICHT ?? "[zuständige Datenschutzaufsicht]",
  };
  const freigegeben = e.RECHT_FREIGEGEBEN === "ja";
  const inhalt = x.recht.inhalt[seite as Seite];
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p><Link href="/heute"><Markenname /></Link></p>
      <h1 className="mt-8 text-titel font-bold">{x.recht[seite as Seite]}</h1>
      {!freigegeben ? <p role="note" className="mt-4 rounded-md border-2 border-bald bg-bald-hauch p-3 text-klein">{x.recht.entwurf}</p> : null}
      <div className="lesetext mt-6 space-y-6">
        {inhalt.map((abschnitt) => (
          <section key={abschnitt.titel}>
            <h2 className="text-gross font-bold">{abschnitt.titel}</h2>
            {abschnitt.absaetze.map((a, i) => (
              <p key={i} className="mt-2 whitespace-pre-line">{a.replace(/\{(\w+)\}/g, (m, k: string) => (betreiber as Record<string, string>)[k] ?? m)}</p>
            ))}
          </section>
        ))}
      </div>
      <Fusszeile className="mt-12 border-t border-linie pt-4" />
    </main>
  );
}
