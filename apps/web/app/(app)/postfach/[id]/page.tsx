import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { centAus, euroFeld } from "@/lib/geld";
import { senden } from "@/lib/aktion";
import { api, aktivesUnternehmen } from "@/lib/api";
import { t } from "@/lib/sprache";
import type { Karte } from "@/lib/typen";
import type { Brief } from "../page";

export const metadata = { title: "Behördenbrief" };

const ARTEN = ["bescheid", "mahnung", "anhoerung", "auskunftsersuchen", "sonstiges"] as const;
const FRISTARTEN = ["einspruch", "zahlung", "antwort", "sonstige"] as const;
const seite = (id: string) => `/postfach/${id}`;

async function einordnen(id: string, sprache: "de" | "en", f: FormData) {
  "use server";
  const text = (k: string) => String(f.get(k) ?? "").trim();
  const betrag = text("betrag");
  await senden(`/v1/briefe/${id}`, "PUT", {
    eingang_am: text("eingang_am"), absender: text("absender"), art: text("art"), aktenzeichen: text("aktenzeichen"),
    frist_am: text("frist_am") || null, frist_art: text("frist_am") ? text("frist_art") || null : null,
    betrag_cent: betrag ? centAus(betrag, sprache) : null, pflicht_id: text("pflicht_id") || null, notiz: text("notiz") || null,
  }, seite(id));
  revalidatePath(seite(id));
  redirect("/postfach");
}

async function erledigt(id: string, offen: boolean) {
  "use server";
  await senden(`/v1/briefe/${id}/erledigt`, "POST", { datum: offen ? new Date().toISOString().slice(0, 10) : null }, seite(id));
  revalidatePath(seite(id));
  redirect(seite(id));
}

export default async function BriefSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ s, t: x }, b, karten, { fehler }, u] = await Promise.all([t(), api<Brief>(`/v1/briefe/${id}`), api<Karte[]>("/v1/pflichten"), searchParams, aktivesUnternehmen()]);
  const darf = u.rolle !== "mitarbeiter";
  const pflichten = [...new Map(karten.filter((k) => k.ergebnis === "gilt").map((k) => [k.pflicht_id, k.titel])).entries()].sort((a, c) => a[1].localeCompare(c[1]));
  return (
    <div className="lesetext space-y-6">
      <p className="text-klein"><Link href="/postfach" className="verweis">{x.postfach.zurueck}</Link></p>
      <header>
        <h1 className="text-titel font-bold">{b.absender || b.datei_titel}</h1>
        <p className="mt-1"><a href={`/finanzen/dokument/${b.dokument_id}`} className="verweis">{x.postfach.datei}</a></p>
      </header>
      {fehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">{fehler}</p> : null}
      <section aria-labelledby="erklaerung" className="rounded-md border border-linie bg-blatt p-4">
        <h2 id="erklaerung" className="font-bold">{x.postfach.erklaerung} {x.postfach.arten[b.art]}</h2>
        <p className="mt-1 text-klein">{x.postfach.erklaerungen[b.art]}</p>
        <p className="mt-2 text-klein text-tinte-leise">{x.postfach.hinweis} <Link href="/experten" className="verweis">{x.frag.experten}</Link></p>
      </section>
      {darf ? (
        <section aria-labelledby="einordnen">
          <h2 id="einordnen" className="text-gross font-bold">{x.postfach.einordnen}</h2>
          <form action={einordnen.bind(null, id, s)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="absender" className="block text-klein font-bold">{x.postfach.absender}</label><input id="absender" name="absender" defaultValue={b.absender} className="feld mt-1" /></div>
            <div><label htmlFor="eingang_am" className="block text-klein font-bold">{x.postfach.eingang}</label><input id="eingang_am" name="eingang_am" type="date" required defaultValue={b.eingang_am} className="feld mt-1" /></div>
            <div>
              <label htmlFor="art" className="block text-klein font-bold">{x.postfach.art}</label>
              <select id="art" name="art" defaultValue={b.art} className="feld mt-1">{ARTEN.map((a) => <option key={a} value={a}>{x.postfach.arten[a]}</option>)}</select>
            </div>
            <div><label htmlFor="aktenzeichen" className="block text-klein font-bold">{x.postfach.aktenzeichen}</label><input id="aktenzeichen" name="aktenzeichen" defaultValue={b.aktenzeichen} className="feld mt-1" /></div>
            <div><label htmlFor="frist_am" className="block text-klein font-bold">{x.postfach.frist_am}</label><input id="frist_am" name="frist_am" type="date" defaultValue={b.frist_am ?? ""} className="feld mt-1" /></div>
            <div>
              <label htmlFor="frist_art" className="block text-klein font-bold">{x.postfach.frist_art}</label>
              <select id="frist_art" name="frist_art" defaultValue={b.frist_art ?? ""} className="feld mt-1"><option value="">–</option>{FRISTARTEN.map((a) => <option key={a} value={a}>{x.postfach.fristarten[a]}</option>)}</select>
            </div>
            <div><label htmlFor="betrag" className="block text-klein font-bold">{x.postfach.betrag}</label><input id="betrag" name="betrag" inputMode="decimal" defaultValue={b.betrag_cent != null ? euroFeld(b.betrag_cent, s) : ""} className="feld mt-1" /></div>
            <div>
              <label htmlFor="pflicht_id" className="block text-klein font-bold">{x.postfach.pflicht}</label>
              <select id="pflicht_id" name="pflicht_id" defaultValue={b.pflicht_id ?? ""} className="feld mt-1"><option value="">{x.postfach.keine_pflicht}</option>{pflichten.map(([pid, titel]) => <option key={pid} value={pid}>{titel}</option>)}</select>
            </div>
            <div className="sm:col-span-2"><label htmlFor="notiz" className="block text-klein font-bold">{x.postfach.notiz}</label><input id="notiz" name="notiz" defaultValue={b.notiz ?? ""} className="feld mt-1" /></div>
            <div><button className="knopf">{x.postfach.speichern}</button></div>
          </form>
          <form action={erledigt.bind(null, id, !b.erledigt_am)} className="mt-4"><button className="knopf knopf-leise">{b.erledigt_am ? x.postfach.wieder_offen : x.postfach.als_erledigt}</button></form>
        </section>
      ) : null}
    </div>
  );
}
