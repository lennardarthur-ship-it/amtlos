import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { api, apiAntwort, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Behörden-Postfach" };

export interface Brief { id: string; eingang_am: string; absender: string; art: "bescheid" | "mahnung" | "anhoerung" | "auskunftsersuchen" | "sonstiges"; aktenzeichen: string; frist_am: string | null; frist_art: string | null; betrag_cent: number | null; pflicht_id: string | null; notiz: string | null; erledigt_am: string | null; dokument_id: string; datei_titel: string; tage_bis_frist?: number | null }

async function hochladen(f: FormData) {
  "use server";
  const datei = f.get("datei");
  if (!(datei instanceof File) || datei.size === 0) redirect(`/postfach?fehler=${encodeURIComponent("Datei fehlt")}`);
  const daten = new FormData();
  daten.set("datei", datei, datei.name);
  const r = await apiAntwort("/v1/briefe", { method: "POST", body: daten });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { meldung?: string; message?: string };
    redirect(`/postfach?fehler=${encodeURIComponent(j.meldung ?? j.message ?? `Fehler ${r.status}`)}`);
  }
  const b = (await r.json()) as { id: string };
  revalidatePath("/postfach");
  redirect(`/postfach/${b.id}`);
}

export default async function PostfachSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, briefe, { fehler }, u] = await Promise.all([t(), api<Brief[]>("/v1/briefe"), searchParams, aktivesUnternehmen()]);
  const uhr = (b: Brief) => (b.tage_bis_frist == null ? "" : b.tage_bis_frist >= 0 ? fuelle(x.postfach.frist_tage, { n: b.tage_bis_frist }) : fuelle(x.postfach.frist_ueber, { n: -b.tage_bis_frist }));
  return (
    <div className="lesetext space-y-8">
      <header>
        <h1 className="text-titel font-bold">{x.postfach.titel}</h1>
        <p className="mt-2">{x.postfach.text}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.postfach.hinweis}</p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      {u.rolle !== "mitarbeiter" ? (
        <form action={hochladen} className="flex flex-wrap items-end gap-3 rounded-md border border-linie bg-blatt p-4">
          <div>
            <label htmlFor="datei" className="block text-klein font-bold">{x.postfach.hochladen}</label>
            <input id="datei" name="datei" type="file" accept="application/pdf,image/jpeg,image/png" required className="mt-1 text-klein" />
          </div>
          <button className="knopf">{x.postfach.hochladen_knopf}</button>
        </form>
      ) : null}
      {briefe.length ? (
        <ul className="border-t border-linie">
          {briefe.map((b) => (
            <li key={b.id} className={`border-b border-linie py-3 ${b.erledigt_am ? "text-tinte-leise" : ""}`}>
              <Link href={`/postfach/${b.id}`} className="verweis font-bold">{b.absender || b.datei_titel}</Link>
              <p className="text-klein">
                {x.postfach.arten[b.art]}{b.aktenzeichen ? ` · ${b.aktenzeichen}` : ""} · {datumLang(b.eingang_am, s)}
                {b.absender ? "" : ` · ${x.postfach.neu}`}
              </p>
              {b.erledigt_am ? (
                <p className="text-klein">{fuelle(x.postfach.erledigt, { datum: datumLang(b.erledigt_am, s) })}</p>
              ) : b.frist_am ? (
                <p className={`text-klein font-bold ${(b.tage_bis_frist ?? 99) < 0 ? "text-frist" : (b.tage_bis_frist ?? 99) <= 7 ? "text-bald" : ""}`}>
                  {fuelle(x.postfach.frist, { datum: datumLang(b.frist_am, s) })}{b.frist_art ? ` (${(x.postfach.fristarten as Record<string, string>)[b.frist_art]})` : ""} · {uhr(b)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{x.postfach.leer}</p>
      )}
    </div>
  );
}
