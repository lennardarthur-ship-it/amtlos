import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { StudioFehler, partnerListe, partnerSpeichern, type PartnerDaten } from "@amtlos/server";
import { darfRedigieren, datenbank, ich } from "@/lib/studio";
import { MARKE } from "@amtlos/marke";

export const metadata = { title: "Marktplatz-Partner" };

const QUALI = { steuerberater: "Steuerberatung", rechtsanwalt: "Rechtsanwalt/-anwältin", fachkraft_arbeitssicherheit: "Fachkraft für Arbeitssicherheit", datenschutzbeauftragter: "Datenschutzbeauftragte:r" } as const;
interface Partner { id: string; name: string; qualifikation: keyof typeof QUALI; kanzlei: string; regionen: string[]; beschreibung: string; pakete: { titel: string; umfang?: string; preis_text?: string }[]; email: string; website: string | null; zulassung_geprueft_am: string | null; aktiv: boolean }

/** Pakete als Zeilen „Titel | Umfang | Preis“ – einfach zu pflegen, im Studio genügt Text. */
function paketeAus(text: string) {
  return text.split("\n").map((z) => z.trim()).filter(Boolean).map((z) => {
    const [titel, umfang, preis_text] = z.split("|").map((x) => x.trim());
    return { titel: titel ?? "", ...(umfang ? { umfang } : {}), ...(preis_text ? { preis_text } : {}) };
  });
}

async function speichern(id: string | null, f: FormData) {
  "use server";
  const k = await ich();
  const d: PartnerDaten = {
    name: String(f.get("name") ?? ""),
    qualifikation: String(f.get("qualifikation") ?? ""),
    kanzlei: String(f.get("kanzlei") ?? ""),
    regionen: String(f.get("regionen") ?? "").split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter(Boolean),
    beschreibung: String(f.get("beschreibung") ?? ""),
    pakete: paketeAus(String(f.get("pakete") ?? "")),
    email: String(f.get("email") ?? ""),
    website: String(f.get("website") ?? "").trim() || null,
    zulassung_geprueft_am: String(f.get("zulassung_geprueft_am") ?? "") || null,
    aktiv: f.get("aktiv") === "on",
  };
  try {
    await partnerSpeichern(datenbank(), k, d, id ?? undefined);
  } catch (e) {
    if (e instanceof StudioFehler) redirect(`/partner?fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/partner");
  redirect("/partner?ok=1");
}

function Formular({ p, aktion }: { p?: Partner; aktion: (f: FormData) => Promise<void> }) {
  const id = p?.id ?? "neu";
  return (
    <form action={aktion} className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="font-bold">Name</span><input name="name" required defaultValue={p?.name} className="feld mt-1" /></label>
      <label className="block">
        <span className="font-bold">Qualifikation</span>
        <select name="qualifikation" defaultValue={p?.qualifikation ?? "steuerberater"} className="feld mt-1">
          {Object.entries(QUALI).map(([w, t]) => <option key={w} value={w}>{t}</option>)}
        </select>
      </label>
      <label className="block"><span className="font-bold">Kanzlei / Firma</span><input name="kanzlei" defaultValue={p?.kanzlei} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">E-Mail für Anfragen</span><input name="email" type="email" required defaultValue={p?.email} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Website (https://…)</span><input name="website" defaultValue={p?.website ?? ""} className="feld mt-1" /></label>
      <label className="block"><span className="font-bold">Bundesländer (Kürzel, leer = bundesweit)</span><input name="regionen" defaultValue={p?.regionen.join(", ")} className="feld mt-1" /></label>
      <label className="block md:col-span-2"><span className="font-bold">Beschreibung</span><textarea name="beschreibung" rows={2} defaultValue={p?.beschreibung} className="feld mt-1" /></label>
      <label className="block md:col-span-2">
        <span className="font-bold">Pakete (je Zeile: Titel | Umfang | Preis laut Partner)</span>
        <textarea name="pakete" rows={3} defaultValue={p?.pakete.map((x) => [x.titel, x.umfang, x.preis_text].filter(Boolean).join(" | ")).join("\n")} className="feld mt-1" />
      </label>
      <label className="block"><span className="font-bold">Berufszulassung geprüft am</span><input name="zulassung_geprueft_am" type="date" defaultValue={p?.zulassung_geprueft_am ?? ""} className="feld mt-1" /></label>
      <label className="flex items-center gap-3 self-end"><input type="checkbox" name="aktiv" defaultChecked={p?.aktiv ?? false} className="size-5" /> <span>Im Marktplatz anzeigen</span></label>
      <div className="md:col-span-2"><button className="knopf" aria-describedby={`hinweis-${id}`}>Speichern</button></div>
    </form>
  );
}

export default async function PartnerSeite({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const [k, { fehler, ok }] = await Promise.all([ich(), searchParams]);
  const liste = (await partnerListe(datenbank())) as unknown as Partner[];
  const darf = darfRedigieren(k);
  return (
    <div className="space-y-8">
      <h1 className="text-titel font-bold">Marktplatz-Partner</h1>
      <p className="lesetext" id="hinweis-neu">
        Geprüfte Steuerberatungen, Kanzleien, Fachkräfte für Arbeitssicherheit und Datenschutzbeauftragte. Sichtbar nur mit geprüfter Berufszulassung.
        Keine Provision und keine Zahlung über {MARKE.name}, solange das Vergütungsmodell nicht geklärt ist (J-4).
      </p>
      {fehler ? <p role="alert" className="lesetext rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {ok ? <p role="status" className="lesetext rounded-md bg-amt-hauch p-4 font-bold text-amt">Gespeichert.</p> : null}
      {liste.length ? (
        <ul className="space-y-3">
          {liste.map((p) => (
            <li key={p.id} className="rounded-md border border-linie bg-blatt p-4">
              <p><span className="font-bold">{p.name}</span> · {QUALI[p.qualifikation]}{p.kanzlei ? ` · ${p.kanzlei}` : ""} · {p.aktiv ? "sichtbar" : "verborgen"}{p.zulassung_geprueft_am ? ` · Zulassung geprüft ${p.zulassung_geprueft_am}` : " · Zulassung nicht geprüft"}</p>
              {darf ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-klein">Bearbeiten</summary>
                  <div className="mt-3"><Formular p={p} aktion={speichern.bind(null, p.id)} /></div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>Noch keine Partner.</p>
      )}
      {darf ? (
        <section aria-labelledby="neu" className="space-y-3">
          <h2 id="neu" className="text-gross font-bold">Partner anlegen</h2>
          <Formular aktion={speichern.bind(null, null)} />
        </section>
      ) : null}
    </div>
  );
}
