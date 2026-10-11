"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavEintrag {
  href: string;
  text: string;
  symbol: "heute" | "pflichten" | "kalender" | "finanzen" | "personal" | "datenschutz" | "melden" | "einstellungen";
  /** Mobil nicht in der Leiste (dort im Kopf), damit die Ziele groß genug bleiben. */
  nurDesktop?: boolean;
}

function Symbol({ art }: { art: NavEintrag["symbol"] }) {
  const p = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (art) {
    case "heute":
      return <svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M9 3v4M15 3v4" /><path d="M10 15l1.5 1.5L14.5 13" /></svg>;
    case "pflichten":
      return <svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>;
    case "kalender":
      return <svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M9 3v4M15 3v4M8 13h2M12 13h2M16 13h0M8 16h2M12 16h2" /></svg>;
    case "finanzen":
      return <svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>;
    case "personal":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14.2c2.9.4 5 2.9 5 5.8" /></svg>;
    case "datenschutz":
      return <svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /><rect x="9" y="11" width="6" height="5" rx="1" /><path d="M10.5 11V9.5a1.5 1.5 0 013 0V11" /></svg>;
    case "melden":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>;
    case "einstellungen":
      return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></svg>;
  }
}

/** Desktop: Seitenleiste links. Mobil: Leiste unten mit großen Zielen. */
export function Navigation({ eintraege, beschriftung }: { eintraege: NavEintrag[]; beschriftung: string }) {
  const pfad = usePathname();
  const aktiv = (href: string) => pfad === href || pfad.startsWith(`${href}/`);
  return (
    <nav aria-label={beschriftung}>
      <ul className="fixed inset-x-0 bottom-0 z-20 flex border-t border-linie bg-blatt pb-[env(safe-area-inset-bottom)] md:static md:flex-col md:gap-1 md:border-0 md:bg-transparent md:pb-0">
        {eintraege.map((e) => (
          <li key={e.href} className={`flex-1 md:flex-none ${e.nurDesktop ? "hidden md:list-item" : ""}`}>
            <Link
              href={e.href}
              aria-current={aktiv(e.href) ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.625rem] text-tinte-leise aria-[current=page]:text-amt md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-md md:px-3 md:text-basis md:aria-[current=page]:bg-amt-hauch md:aria-[current=page]:font-bold md:hover:bg-blatt"
            >
              <Symbol art={e.symbol} />
              <span>{e.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
