import Link from "next/link";
import { fuelle } from "@amtlos/i18n";
import { aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Keine Berechtigung" };

/** Ziel, wenn die API mit 403 antwortet (H3): sagt, mit welcher Rolle man in welchem Unternehmen handelt. */
export default async function KeineBerechtigung() {
  const [{ t: x }, u] = await Promise.all([t(), aktivesUnternehmen()]);
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{x.rolle.keine_berechtigung_titel}</h1>
      <p>{fuelle(x.rolle.keine_berechtigung_text, { rolle: x.team.rollen[u.rolle], unternehmen: u.name })}</p>
      {u.rolle === "mitarbeiter" ? <p className="text-tinte-leise">{x.rolle.mitarbeiter_hinweis}</p> : null}
      <Link href="/heute" className="knopf">{x.rolle.zurueck}</Link>
    </div>
  );
}
