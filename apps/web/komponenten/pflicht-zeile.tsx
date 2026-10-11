import Link from "next/link";
import { datumLang, fuelle, texte, type Sprache } from "@amtlos/i18n";
import type { Karte } from "@/lib/typen";
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

const MONATE = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** 2026-10 → „für Oktober 2026“, 2026-Q3 → „für das 3. Quartal 2026“ */
export function periodeText(p: string, s: Sprache): string {
  const m = /^(\d{4})(?:-(\d{2})|-Q(\d)|-H(\d))?$/.exec(p);
  if (!m) return p;
  const [, j, mon, q, h] = m;
  if (mon) return s === "de" ? `für ${MONATE.de[Number(mon) - 1]} ${j}` : `for ${MONATE.en[Number(mon) - 1]} ${j}`;
  if (q) return s === "de" ? `für das ${q}. Quartal ${j}` : `for Q${q} ${j}`;
  if (h) return s === "de" ? `für das ${h}. Halbjahr ${j}` : `for H${h} ${j}`;
  return s === "de" ? `für ${j}` : `for ${j}`;
}
