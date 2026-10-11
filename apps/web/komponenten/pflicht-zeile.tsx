import Link from "next/link";
import { datumLang, fuelle, texte, type Sprache } from "@amtlos/i18n";
import type { Karte } from "@/lib/typen";
import { periodeText } from "@/lib/periode";
import { Fristblatt } from "./fristblatt";
import { StatusText } from "./status";

/** Eine Pflicht als Zeile: Fristblatt, was zu tun ist, Status. Die ganze Zeile ist der Link. */
export function PflichtZeile({ karte, sprache }: { karte: Karte; sprache: Sprache }) {
  const t = texte(sprache);
  const href = `/pflichten/${encodeURIComponent(karte.pflicht_id)}/${encodeURIComponent(karte.periode)}`;
  return (
    <li className="border-b border-linie last:border-b-0">
      <Link href={href} className="group flex gap-4 py-4 pr-2 hover:bg-blatt/60 sm:gap-5">
        <Fristblatt datum={karte.faellig_am} status={karte.status} sprache={sprache} />
        <div className="min-w-0 flex-1">
          <p className="text-gross font-bold group-hover:underline group-hover:underline-offset-4">{karte.titel}</p>
          <p className="lesetext mt-1 text-tinte-leise">{karte.kurz}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-klein">
            <StatusText status={karte.status} sprache={sprache} />
            {karte.faellig_am && karte.status !== "erledigt" ? <span>{fuelle(t.pflichten.bis, { datum: datumLang(karte.faellig_am, sprache) })}</span> : null}
            {karte.periode !== "einmalig" && !karte.periode.startsWith("aenderung") ? <span className="text-tinte-leise">{periodeText(karte.periode, sprache)}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}

export { periodeText };
