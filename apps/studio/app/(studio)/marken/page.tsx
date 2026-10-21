import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MARKEN_FLAECHEN, StudioFehler, kontrast, markeSpeichern, markenListe, type MarkeDaten } from "@amtlos/server";
import { datenbank, ich } from "@/lib/studio";
import { MARKE } from "@amtlos/marke";

export const metadata = { title: "White-Label-Marken" };

interface Marke { id: string; schluessel: string; name: string; hosts: string[]; farbe_hell: string; farbe_dunkel: string; logo_url: string | null; support_email: string | null; aktiv: boolean; unternehmen: number }

async function speichern(id: string | null, f: FormData) {
  "use server";
  const k = await ich();
  const d: MarkeDaten = {
    schluessel: String(f.get("schluessel") ?? "").trim(),
    name: String(f.get("name") ?? ""),
    hosts: String(f.get("hosts") ?? "").split(/[\s,]+/).filter(Boolean),
    farbe_hell: String(f.get("farbe_hell") ?? ""),
    farbe_dunkel: String(f.get("farbe_dunkel") ?? ""),
    logo_url: String(f.get("logo_url") ?? "").trim() || null,
    support_email: String(f.get("support_email") ?? "").trim() || null,
    aktiv: f.get("aktiv") === "on",
  };
  try {
    await markeSpeichern(datenbank(), k, d, id ?? undefined);
  } catch (e) {
    if (e instanceof StudioFehler) redirect(`/marken?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/marken");
  redirect("/marken?ok=1");
}

/** Kontrast der Farbe gegen die Flächen des Designsystems (schlechtester Wert). */
const minKontrast = (farbe: string, art: "hell" | "dunkel") => Math.min(...MARKEN_FLAECHEN[art].map((g) => kontrast(farbe, g))).toFixed(1).replace(".", ",");

function Formular({ m, aktion }: { m?: Marke; aktion: (f: FormData) => Promise<void> }) {
  return (
    <form action={aktion} className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="font-bold">Schlüssel</span><input name="schluessel" required pattern="[a-z0-9][a-z0-9-]{1,39}" defaultValue={m?.schluessel} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Name (wird statt „{MARKE.name}“ angezeigt)</span><input name="name" required defaultValue={m?.name} className="feld mt-1" /></label>
      <label className="block md:col-span-2"><span className="font-bold">Hostnamen (durch Komma getrennt)</span><input name="hosts" defaultValue={m?.hosts.join(", ")} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Farbe hell (#rrggbb, mind. 4,5 : 1 auf Weiß)</span><input name="farbe_hell" required defaultValue={m?.farbe_hell ?? "#136f5b"} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Farbe dunkel (#rrggbb, mind. 4,5 : 1 auf Dunkel)</span><input name="farbe_dunkel" required defaultValue={m?.farbe_dunkel ?? "#5cc2a6"} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Logo (https-Adresse, optional)</span><input name="logo_url" type="url" defaultValue={m?.logo_url ?? ""} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Support-E-Mail (optional)</span><input name="support_email" type="email" defaultValue={m?.support_email ?? ""} className="feld mt-1" /></label>
      <label className="flex items-center gap-3"><input type="checkbox" name="aktiv" defaultChecked={m?.aktiv ?? true} className="size-5" /> <span>Aktiv</span></label>
      <div className="md:col-span-2"><button className="knopf">Speichern</button></div>
    </form>
  );
}

export default async function MarkenSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [k, { fehler, ok }] = await Promise.all([ich(), searchParams]);
  const liste = (await markenListe(datenbank())) as unknown as Marke[];
  const darf = k.rollen.includes("plattform_admin");
  return (
    <div className="space-y-8">
      <h1 className="text-titel font-bold">White-Label-Marken</h1>
      <p className="lesetext">
        Partner (z. B. Steuerberatungen, Kammern) bieten {MARKE.name} unter eigenem Namen und eigener Adresse an. Die Marke ändert nur Name, Handlungsfarbe und Logo;
        Inhalte, Prüfstatus und Datenschutz bleiben gleich. Die Anzahl zeigt Unternehmen, die unter der Marke angelegt wurden (Lizenzbericht). Pflege nur durch Plattform-Admins.
      </p>
      {fehler ? <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {ok ? <p role="status" className="lesetext rounded-md bg-amt-hauch p-4 font-bold text-amt">Gespeichert.</p> : null}
      {liste.length ? (
        <ul className="space-y-3">
          {liste.map((m) => (
            <li key={m.id} className="rounded-md border border-linie bg-blatt p-4">
              <p>
                <span className="font-bold">{m.name}</span> · {m.schluessel} · {m.aktiv ? "aktiv" : "inaktiv"} · {m.unternehmen} Unternehmen
              </p>
              <p className="text-klein">{m.hosts.join(", ") || "kein Host"} · Kontrast hell {minKontrast(m.farbe_hell, "hell")} : 1, dunkel {minKontrast(m.farbe_dunkel, "dunkel")} : 1</p>
              {darf ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-klein">Bearbeiten</summary>
                  <div className="mt-3"><Formular m={m} aktion={speichern.bind(null, m.id)} /></div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>Noch keine Marken.</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="space-y-3">
          <h2 id="neu" className="text-gross font-bold">Marke anlegen</h2>
          <Formular aktion={speichern.bind(null, null)} />
        </section>
      ) : null}
    </div>
  );
}
