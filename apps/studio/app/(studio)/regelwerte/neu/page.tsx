import { redirect } from "next/navigation";
import { StudioFehler, neueRegelwertversion } from "@amtlos/server";
import { darfRedigieren, datenbank, ich } from "@/lib/studio";
import { RegelwertFormular, ausFormular } from "../formular";

export const metadata = { title: "Neuer Regelwert" };
const ID = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

async function anlegen(formular: FormData) {
  "use server";
  const k = await ich();
  const id = String(formular.get("id") ?? "").trim();
  if (!ID.test(id)) redirect(`/regelwerte/neu?fehler=${encodeURIComponent("ID: braucht die Form bereich.name, nur Kleinbuchstaben, Ziffern und Unterstrich")}`);
  try {
    await neueRegelwertversion(datenbank(), k, ausFormular(formular, id));
  } catch (e) {
    if (e instanceof StudioFehler) redirect(`/regelwerte/neu?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/regelwerte/${encodeURIComponent(id)}?ok=${encodeURIComponent("Regelwert angelegt und zur Prüfung gegeben")}`);
}

export default async function NeuerRegelwert({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [k, { fehler }] = await Promise.all([ich(), searchParams]);
  if (!darfRedigieren(k)) redirect("/");
  return (
    <div className="space-y-6">
      <h1 className="text-titel font-bold">Neuen Regelwert anlegen</h1>
      <p className="lesetext text-tinte-leise">Nur Werte mit Quelle eintragen. Was unsicher ist, unter „Fachlich zu prüfen“ notieren – nichts schätzen.</p>
      {fehler ? <pre role="alert" className="whitespace-pre-wrap rounded-md border-2 border-frist bg-frist-hauch p-4 text-klein">{fehler}</pre> : null}
      <RegelwertFormular start={{}} aktion={anlegen} knopf="Regelwert anlegen und zur Prüfung geben" mitId />
    </div>
  );
}

