import Link from "next/link";
import { t } from "@/lib/sprache";

/** Rechtliche Links auf jeder Seite (Impressum, Datenschutz, AGB) – Pflicht nach § 5 DDG und DSGVO. */
export async function Fusszeile({ className = "" }: { className?: string }) {
  const { t: x } = await t();
  return (
    <footer className={`flex flex-wrap gap-x-5 gap-y-1 text-klein text-tinte-leise ${className}`}>
      <Link href="/recht/impressum" className="hover:underline">{x.recht.impressum}</Link>
      <Link href="/recht/datenschutz" className="hover:underline">{x.recht.datenschutz}</Link>
      <Link href="/recht/agb" className="hover:underline">{x.recht.agb}</Link>
      <a href="mailto:hallo@amtlos.de" className="hover:underline">{x.recht.kontakt}</a>
    </footer>
  );
}
