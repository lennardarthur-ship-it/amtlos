import Link from "next/link";
import type { ReactNode } from "react";
import { ich } from "@/lib/studio";

const ROLLE = { plattform_admin: "Administration", redaktion: "Redaktion", experte: "Prüfung", support: "Support" } as const;
const QUALI = { steuerberater: "Steuerberatung", rechtsanwalt: "Rechtsanwalt/-anwältin", fachkraft_arbeitssicherheit: "Fachkraft für Arbeitssicherheit", datenschutzbeauftragter: "Datenschutz", sonstige: "Sonstige" } as const;

export default async function StudioRahmen({ children }: { children: ReactNode }) {
  const k = await ich();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-tinte pb-4">
        <div className="flex flex-wrap items-baseline gap-6">
          <Link href="/" className="text-titel font-bold">
            Amtlos Studio
          </Link>
          <nav aria-label="Studio">
            <ul className="flex flex-wrap gap-5">
              <li><Link className="verweis" href="/">Pflichten</Link></li>
              <li><Link className="verweis" href="/regelwerte">Regelwerte</Link></li>
              <li><Link className="verweis" href="/releases">Releases</Link></li>
              <li><Link className="verweis" href="/pruefliste">Prüfliste</Link></li>
              <li><Link className="verweis" href="/partner">Partner</Link></li>
            </ul>
          </nav>
        </div>
        <p className="text-klein text-tinte-leise">
          {k.anzeigename}: {k.rollen.map((r) => ROLLE[r]).join(", ")}
          {k.qualifikationen.length ? ` (${k.qualifikationen.map((q) => QUALI[q]).join(", ")})` : ""}
        </p>
      </header>
      <main className="pt-6">{children}</main>
    </div>
  );
}
