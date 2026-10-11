import Link from "next/link";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Mehr" };

/** Bereiche ohne eigenen Platz in der Leiste (E-098); mobil zusätzlich die, die nur am Desktop in der Seitenleiste stehen. */
export default async function MehrSeite() {
  const { t: x } = await t();
  const eintraege = [
    ["/frag", x.frag.titel, x.frag.text, false],
    ["/radar", x.radar.titel, x.radar.text, false],
    ["/experten", x.experten.titel, x.experten.text, false],
    ["/postfach", x.postfach.titel, x.postfach.text, true],
    ["/datenschutz", x.nav.datenschutz, x.ds.text, true],
    ["/online", x.nav.online, x.oc.titel, true],
    ["/branche", x.nav.branche, x.branche.text, true],
    ["/melden", x.mehr.melden, x.melden.text, false],
    ["/team", x.team.titel, "", false],
    ["/kanzlei", x.kanzlei.titel, x.kanzlei.text, false],
    ["/hilfe", x.hilfe.titel, "", false],
    ["/einstellungen", x.nav.einstellungen, "", true],
  ] as const;
  const eintraegeSichtbar = eintraege.filter(([href]) => pfadSichtbar(href));
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.mehr.titel}</h1>
      <ul className="border-t border-linie">
        {eintraegeSichtbar.map(([href, titel, text, nurMobil]) => (
          <li key={href} className={`border-b border-linie ${nurMobil ? "md:hidden" : ""}`}>
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
