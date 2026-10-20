import { VerweisZeile } from "@/komponenten/verweis-zeile";
import { aktivesUnternehmen, darfVerwalten } from "@/lib/api";
import { t } from "@/lib/sprache";
import { pfadSichtbar } from "@/lib/umfang";

export const metadata = { title: "Mehr" };

/** Bereiche ohne eigenen Platz in der Leiste (E-098); mobil zusätzlich die, die nur am Desktop in der Seitenleiste stehen. */
export default async function MehrSeite() {
  const [{ t: x }, u] = await Promise.all([t(), aktivesUnternehmen()]);
  const verwalten = darfVerwalten(u.rolle);
  // Mitarbeitende: Stempeln und Unterweisungen bestätigen statt Personalbereich, keine Meldungen und kein Datenschutz (H3, H4)
  const nurMitarbeiter = [
    ["/personal/zeiten", x.personal.zeiten, x.personal.zeiten_text, false],
    ["/personal/unterweisungen", x.personal.unterweisungen, x.personal.unterweisungen_text, false],
  ] as const;
  const nurVerwalten = new Set(["/datenschutz", "/melden", "/kanzlei"]);
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
  const eintraegeSichtbar = [...(verwalten ? [] : nurMitarbeiter), ...eintraege].filter(([href]) => pfadSichtbar(href) && (verwalten || !nurVerwalten.has(href)));
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.mehr.titel}</h1>
      <ul className="border-t border-linie">
        {eintraegeSichtbar.map(([href, titel, text, nurMobil]) => (
          <VerweisZeile key={href} href={href} titel={titel} text={text} className={nurMobil ? "md:hidden" : ""} />
        ))}
      </ul>
    </div>
  );
}
