import { Markenname } from "@/komponenten/markenname";
import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/komponenten/navigation";
import { aktivesUnternehmen, ich } from "@/lib/api";
import { t } from "@/lib/sprache";

/** Seiten, die über „Mehr“ erreicht werden (dort ist „Mehr“ aktiv). */
const MEHR = ["/radar", "/frag", "/experten", "/team", "/hilfe", "/melden"];

export default async function AppRahmen({ children }: { children: ReactNode }) {
  const [{ s, t: x }, u, i] = await Promise.all([t(), aktivesUnternehmen(), ich()]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col md:flex-row md:gap-10 md:px-6">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-blatt focus:p-3">
        {x.nav.zum_inhalt}
      </a>
      <aside className="md:sticky md:top-0 md:h-dvh md:w-56 md:flex-none md:py-8">
        <div className="flex items-baseline justify-between gap-4 px-4 pb-2 pt-5 md:block md:px-3 md:pb-8 md:pt-0">
          <Link href="/heute" className="tracking-tight">
            <Markenname />
          </Link>
          <p className="truncate text-klein text-tinte-leise md:mt-1" title={u.name}>
            {u.name}
            {i.unternehmen.length > 1 ? (
              <>
                {" "}
                <Link className="verweis" href="/unternehmen">
                  {x.unternehmen.wechseln}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Navigation
          beschriftung={x.nav.hauptnavigation}
          eintraege={[
            { href: "/heute", text: x.nav.heute, symbol: "heute" },
            { href: "/pflichten", text: x.nav.pflichten, symbol: "pflichten" },
            { href: "/kalender", text: x.nav.kalender, symbol: "kalender" },
            { href: "/finanzen", text: x.nav.finanzen, symbol: "finanzen" },
            { href: "/personal", text: x.nav.personal, symbol: "personal" },
            { href: "/datenschutz", text: x.nav.datenschutz, symbol: "datenschutz", nurDesktop: true },
            { href: "/online", text: x.nav.online, symbol: "online", nurDesktop: true },
            { href: "/branche", text: x.nav.branche, symbol: "branche", nurDesktop: true },
            { href: "/postfach", text: x.nav.postfach, symbol: "postfach", nurDesktop: true },
            { href: "/einstellungen", text: x.nav.einstellungen, symbol: "einstellungen", nurDesktop: true },
            { href: "/mehr", text: x.nav.mehr, symbol: "mehr", auch: MEHR },
          ]}
        />
      </aside>
      <main id="inhalt" className="min-w-0 flex-1 px-4 pb-28 pt-2 md:px-0 md:py-8">
        {children}
        {s === "en" ? <p className="mt-16 border-t border-linie pt-4 text-klein text-tinte-leise">{x.app.uebersetzung_hinweis}</p> : null}
      </main>
    </div>
  );
}
