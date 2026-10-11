import Link from "next/link";
import { t } from "@/lib/sprache";

export const metadata = { title: "Mehr" };

/** Mobil: Bereiche, die nicht in die untere Leiste passen (E-098). Am Desktop stehen sie in der Seitenleiste. */
export default async function MehrSeite() {
  const { t: x } = await t();
  const eintraege = [
    ["/datenschutz", x.nav.datenschutz, x.ds.text],
    ["/online", x.nav.online, x.oc.titel],
    ["/branche", x.nav.branche, x.branche.text],
    ["/melden", x.mehr.melden, x.melden.text],
    ["/team", x.team.titel, ""],
    ["/hilfe", x.hilfe.titel, ""],
    ["/einstellungen", x.nav.einstellungen, ""],
  ] as const;
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.mehr.titel}</h1>
      <ul className="border-t border-linie">
        {eintraege.map(([href, titel, text]) => (
          <li key={href} className="border-b border-linie">
            <Link href={href} className="block min-h-14 py-3 hover:bg-blatt">
              <span className="font-bold">{titel}</span>
              {text ? <span className="block text-klein text-tinte-leise">{text}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
