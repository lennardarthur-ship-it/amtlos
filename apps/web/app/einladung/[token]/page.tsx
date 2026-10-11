import { redirect } from "next/navigation";
import { datumLang, fuelle } from "@amtlos/i18n";
import { apiAntwort, ich } from "@/lib/api";
import { sitzung, unternehmenWaehlen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Einladung", referrer: "no-referrer" };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
type Rolle = "mitarbeiter" | "steuerberater" | "admin";

async function annehmen(token: string) {
  "use server";
  const r = await apiAntwort("/v1/einladungen/annehmen", { method: "POST", body: JSON.stringify({ token }), ohneUnternehmen: true });
  if (r.status === 403) redirect(`/einladung/${token}?fehler=andere_email`);
  if (!r.ok) redirect(`/einladung/${token}?fehler=ungueltig`);
  const { unternehmen_id } = (await r.json()) as { unternehmen_id: string };
  await unternehmenWaehlen(unternehmen_id);
  redirect("/heute");
}

export default async function EinladungSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const [{ s, t: x }, { token }, { fehler }] = await Promise.all([t(), params, searchParams]);
  const rahmen = (inhalt: React.ReactNode) => (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-titel font-bold">{x.app.name}</p>
      <h1 className="mt-10 text-titel font-bold">{x.einladung.titel}</h1>
      {inhalt}
    </main>
  );
  const hinweis = (text: string) => (
    <p role="alert" className="mt-4 rounded-md border-2 border-frist bg-frist-hauch p-4">
      {text}
    </p>
  );

  if (!TOKEN.test(token)) return rahmen(hinweis(x.einladung.ungueltig));

  if (!(await sitzung()))
    return rahmen(
      <>
        <p className="mt-2">{x.einladung.anmelden_text}</p>
        <a href={`/anmelden?weiter=${encodeURIComponent(`/einladung/${token}`)}`} className="knopf mt-6">
          {x.einladung.anmelden}
        </a>
      </>,
    );

  if (fehler === "andere_email") {
    const i = await ich();
    return rahmen(
      <>
        {hinweis(fuelle(x.einladung.andere_email, { email: i.konto.email }))}
        <form action="/auth/abmelden" method="post" className="mt-6">
          <button className="knopf knopf-leise">{x.anmelden.abmelden}</button>
        </form>
      </>,
    );
  }

  const r = await apiAntwort("/v1/einladungen/vorschau", { method: "POST", body: JSON.stringify({ token }), ohneUnternehmen: true });
  if (!r.ok || fehler === "ungueltig") return rahmen(hinweis(x.einladung.ungueltig));
  const v = (await r.json()) as { unternehmen: string; rolle: Rolle; eingeladen_von: string | null; laeuft_ab: string };
  const bis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(v.laeuft_ab));

  return rahmen(
    <>
      <p className="mt-4 text-gross">{fuelle(x.einladung.text, { wer: v.eingeladen_von ?? x.einladung.jemand, unternehmen: v.unternehmen })}</p>
      <p className="mt-3">{fuelle(x.einladung.rolle, { rolle: x.team.rollen[v.rolle], erklaerung: x.team.rollen_text[v.rolle] })}</p>
      <p className="mt-1 text-klein text-tinte-leise">{fuelle(x.einladung.gueltig_bis, { datum: datumLang(bis, s) })}</p>
      <form action={annehmen.bind(null, token)} className="mt-6">
        <button className="knopf">{x.einladung.annehmen}</button>
      </form>
    </>,
  );
}
