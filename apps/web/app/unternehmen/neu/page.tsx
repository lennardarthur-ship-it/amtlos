import { Markenname } from "@/komponenten/markenname";
import { redirect } from "next/navigation";
import { apiOhneUnternehmen } from "@/lib/api";
import { aktuelleMarke } from "@/lib/marke";
import { unternehmenWaehlen } from "@/lib/sitzung";
import { t } from "@/lib/sprache";

export const metadata = { title: "Unternehmen anlegen" };

async function anlegen(formular: FormData) {
  "use server";
  const name = String(formular.get("name") ?? "").trim();
  const marke = (await aktuelleMarke())?.schluessel ?? null; // aus dem Hostnamen, nicht aus dem Formular
  const u = await apiOhneUnternehmen<{ id: string }>("/v1/unternehmen", { method: "POST", body: JSON.stringify({ name, marke }) });
  await unternehmenWaehlen(u.id);
  redirect("/onboarding/rechtsform?phase=schnell");
}

export default async function UnternehmenNeu() {
  const { t: x } = await t();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p><Markenname /></p>
      <h1 className="mt-10 text-titel font-bold">{x.unternehmen.neu_titel}</h1>
      <p className="mt-2">{x.unternehmen.neu_text}</p>
      <form action={anlegen} className="mt-6 space-y-4">
        <label htmlFor="name" className="block font-bold">
          {x.unternehmen.name}
        </label>
        <input id="name" name="name" required maxLength={200} autoComplete="organization" className="feld" />
        <button className="knopf">{x.unternehmen.anlegen}</button>
      </form>
    </main>
  );
}
