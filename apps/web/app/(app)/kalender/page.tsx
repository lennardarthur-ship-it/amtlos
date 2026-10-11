import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { PflichtZeile } from "@/komponenten/pflicht-zeile";
import { KopierFeld } from "@/komponenten/kopier-feld";
import { api } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Karte } from "@/lib/typen";

export const metadata = { title: "Kalender" };

const ABO_COOKIE = "amtlos_kalender_abo_neu";

async function aboErzeugen() {
  "use server";
  const r = await api<{ url: string }>("/v1/kalender/abo", { method: "POST" });
  // Die Adresse wird nur einmal gezeigt (gespeichert ist nur der Hash) – kurzlebig im Cookie bis zur Anzeige
  (await cookies()).set(ABO_COOKIE, r.url, { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/kalender" });
  revalidatePath("/kalender");
}

export default async function KalenderSeite() {
  const [{ s, t: x }, karten] = await Promise.all([t(), api<Karte[]>("/v1/pflichten?status=alle")]);
  const neueAdresse = (await cookies()).get(ABO_COOKIE)?.value;
  const termine = karten.filter((k) => k.faellig_am && ["offen", "faellig_bald", "ueberfaellig"].includes(k.status));

  return (
    <div className="space-y-10">
      <h1 className="text-titel font-bold">{x.kalender.titel}</h1>
      {termine.length ? (
        <ul className="border-t border-linie">
          {termine.map((k) => (
            <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} karte={k} sprache={s} />
          ))}
        </ul>
      ) : (
        <p className="lesetext">{x.kalender.leer}</p>
      )}

      <section aria-labelledby="abo" className="lesetext space-y-3 border-t border-linie pt-6">
        <h2 id="abo" className="text-gross font-bold">
          {x.kalender.abo_titel}
        </h2>
        <p>{x.kalender.abo_text}</p>
        {neueAdresse ? (
          <KopierFeld wert={neueAdresse} knopf={x.kalender.abo_kopieren} erledigt={x.kalender.abo_kopiert} />
        ) : (
          <form action={aboErzeugen}>
            <button className="knopf knopf-leise">{x.kalender.abo_knopf}</button>
          </form>
        )}
      </section>
    </div>
  );
}
