import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SCHRITTE, fragenJePhase, fuelle, schritteJePhase, type Frage, type Phase } from "@amtlos/i18n";
import { EingabeFehler, api } from "@/lib/api";
import { t } from "@/lib/sprache";

export const metadata = { title: "Dein Unternehmen" };

type Profil = { version: number; daten: Record<string, unknown> };
const UNBEKANNT = "__unbekannt__";

/** Formularwerte einer Frage in den Profilwert übersetzen; null = „weiß ich nicht“ (Angabe bleibt unbekannt). */
function wertAus(f: Frage, formular: FormData, sprache: "de" | "en" = "de"): unknown {
  const roh = formular.getAll(f.feld).map(String);
  if (roh.includes(UNBEKANNT)) return null;
  switch (f.art) {
    case "mehrfach":
      return roh.length ? roh : null;
    case "janein":
      return roh[0] === "ja" ? true : roh[0] === "nein" ? false : null;
    case "zahl":
    case "betrag": {
      // Deutsch: 12.400,50 · Englisch: 12,400.50
      const text = (sprache === "en" ? (roh[0] ?? "").replace(/,/g, "") : (roh[0] ?? "").replace(/\./g, "").replace(",", ".")).trim();
      return text === "" ? null : Number(text);
    }
    default:
      return roh[0]?.trim() ? roh[0].trim() : null;
  }
}

const phaseAus = (p: string | undefined): Phase => (p === "schnell" || p === "nachfragen" ? p : "alle");

/**
 * Speichert die Fragen der Phase (E-111): Schnellstart = Kernfragen, Nachfragen = nur offene Fragen, alle = der ganze
 * Schritt (Einstellungen). Danach der nächste Schritt derselben Phase; am Ende „Heute“.
 */
async function speichern(schrittId: string, phase: Phase, zurueck: string | undefined, formular: FormData) {
  "use server";
  const schritt = SCHRITTE.find((s) => s.id === schrittId)!;
  const alt = await api<Profil>("/v1/profil");
  const daten: Record<string, unknown> = { ...alt.daten };
  const { s: sprache } = await t();
  // In der Nachfrage-Phase stehen nur die damals offenen Fragen im Formular: genau die kommen als Felder mit
  const fragen = phase === "nachfragen" ? schritt.fragen.filter((f) => formular.has(f.feld) || formular.has(`${f.feld}__gezeigt`)) : fragenJePhase(schritt, phase, alt.daten);
  for (const f of fragen) daten[f.feld] = wertAus(f, formular, sprache);
  try {
    await api("/v1/profil", { method: "PUT", body: JSON.stringify({ daten }) });
  } catch (e) {
    if (e instanceof EingabeFehler) redirect(`/onboarding/${schrittId}?phase=${phase}&fehler=${encodeURIComponent(e.message)}`);
    throw e;
  }
  if (zurueck) redirect(zurueck);
  // Nächster relevanter Schritt der Phase nach den gerade gespeicherten Angaben (z. B. „Gesellschaft“ nur für UG/GmbH)
  const pos = SCHRITTE.findIndex((s) => s.id === schrittId);
  const naechster = SCHRITTE.slice(pos + 1).find((s) => schritteJePhase(phase, phase === "nachfragen" ? alt.daten : daten).includes(s));
  if (naechster) redirect(`/onboarding/${naechster.id}?phase=${phase}`);
  redirect(phase === "schnell" ? "/heute?willkommen=1" : "/heute?profil=gespeichert");
}

export default async function OnboardingSchritt({
  params,
  searchParams,
}: {
  params: Promise<{ schritt: string }>;
  searchParams: Promise<{ fehler?: string; zurueck?: string; phase?: string }>;
}) {
  const [{ schritt: id }, { fehler, zurueck, phase: phaseRoh }] = await Promise.all([params, searchParams]);
  const schritt = SCHRITTE.find((s) => s.id === id);
  if (!schritt) notFound();
  const [{ s, t: x }, profil] = await Promise.all([t(), api<Profil>("/v1/profil")]);
  // Ohne Profil beginnt der Schnellstart; Einstellungen und „Angabe ergänzen“ zeigen den ganzen Schritt
  const phase: Phase = phaseRoh ? phaseAus(phaseRoh) : profil.version === 0 ? "schnell" : "alle";
  const fragen = fragenJePhase(schritt, phase, profil.daten);
  if (!fragen.length && phase === "nachfragen") redirect("/heute");
  const sichtbar = schritteJePhase(phase, profil.daten);
  // Ein ausgeblendeter Schritt bleibt direkt aufrufbar (z. B. aus den Einstellungen), zählt aber nicht mit
  const liste = sichtbar.includes(schritt) ? sichtbar : SCHRITTE;
  const index = liste.indexOf(schritt);
  const gesamtFragen = liste.reduce((n, l) => n + fragenJePhase(l, phase, profil.daten).length, 0);
  const bisherFragen = liste.slice(0, index).reduce((n, l) => n + fragenJePhase(l, phase, profil.daten).length, 0);
  // Nur interne Rücksprünge erlauben (kein offener Redirect)
  const sichererRuecksprung = zurueck?.startsWith("/") && !zurueck.startsWith("//") ? zurueck : undefined;

  return (
    <div className="lesetext space-y-6">
      <p className="text-klein text-tinte-leise">
        {phase === "schnell" ? x.onboarding.schnellstart : phase === "nachfragen" ? x.onboarding.nachfragen_titel : null}
        {phase !== "alle" ? " · " : ""}
        {fuelle(x.onboarding.schritt, { n: index + 1, gesamt: liste.length })}
        {phase === "schnell" && index === 0 ? ` · ${x.onboarding.dauer}` : ""}
      </p>
      <progress className="h-1.5 w-full accent-amt" value={bisherFragen} max={gesamtFragen} aria-hidden="true" />
      <h1 className="text-titel font-bold">{schritt.titel[s]}</h1>
      {fehler ? (
        <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-4">
          {fuelle(x.fehler.eingabe, { details: fehler })}
        </p>
      ) : null}

      <form action={speichern.bind(null, schritt.id, phase, sichererRuecksprung)} className="space-y-8">
        {fragen.map((f) => (
          <FrageFeld key={f.feld} frage={f} wert={profil.daten[f.feld]} sprache={s} unbekanntText={x.onboarding.spaeter} jaNein={[x.gemeinsam.ja, x.gemeinsam.nein]} />
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button className="knopf">{index + 1 < liste.length && !sichererRuecksprung ? x.onboarding.weiter : x.onboarding.fertig}</button>
          {index > 0 && !sichererRuecksprung ? (
            <Link href={`/onboarding/${liste[index - 1]!.id}?phase=${phase}`} className="knopf knopf-leise">
              {x.onboarding.zurueck}
            </Link>
          ) : null}
          {phase === "nachfragen" ? (
            <Link href="/heute" className="verweis text-klein">
              {x.onboarding.spaeter_weiter}
            </Link>
          ) : null}
        </div>
        <p className="text-klein text-tinte-leise">{phase === "schnell" ? x.onboarding.schnell_hinweis : x.onboarding.unterbrechen}</p>
      </form>
    </div>
  );
}

function FrageFeld({ frage: f, wert, sprache: s, unbekanntText, jaNein }: { frage: Frage; wert: unknown; sprache: "de" | "en"; unbekanntText: string; jaNein: [string, string] }) {
  const unbekannt = wert === undefined || wert === null;
  const hilfeId = f.hilfe ? `${f.feld}-hilfe` : undefined;
  const option = (value: string, text: string, typ: "radio" | "checkbox", checked: boolean) => (
    <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-blatt">
      <input type={typ} name={f.feld} value={value} defaultChecked={checked} className="size-5 flex-none accent-amt" />
      {text}
    </label>
  );

  const gezeigt = <input type="hidden" name={`${f.feld}__gezeigt`} value="1" />;
  if (f.art === "auswahl" || f.art === "mehrfach" || f.art === "janein") {
    const typ = f.art === "mehrfach" ? "checkbox" : "radio";
    const optionen = f.art === "janein" ? { ja: jaNein[0], nein: jaNein[1] } : Object.fromEntries(Object.entries(f.optionen ?? {}).map(([k, v]) => [k, v[s]]));
    const gewaehlt = (k: string) =>
      f.art === "janein" ? (k === "ja" ? wert === true : wert === false) : f.art === "mehrfach" ? Array.isArray(wert) && wert.includes(k) : wert === k;
    return (
      <fieldset aria-describedby={hilfeId}>
        {gezeigt}
        <legend className="text-gross font-bold">{f.frage[s]}</legend>
        {f.hilfe ? <p id={hilfeId} className="mt-1 text-tinte-leise">{f.hilfe[s]}</p> : null}
        <div className="mt-3 space-y-1">
          {Object.entries(optionen).map(([k, text]) => option(k, text, typ, gewaehlt(k)))}
          {f.art !== "mehrfach" ? option(UNBEKANNT, unbekanntText, "radio", unbekannt) : null}
        </div>
      </fieldset>
    );
  }

  const art = f.art === "datum" ? "date" : f.art === "text" ? "text" : "text";
  return (
    <div>
      {gezeigt}
      <label htmlFor={f.feld} className="text-gross font-bold">
        {f.frage[s]}
      </label>
      {f.hilfe ? <p id={hilfeId} className="mt-1 text-tinte-leise">{f.hilfe[s]}</p> : null}
      <input
        id={f.feld}
        name={f.feld}
        type={art}
        inputMode={f.art === "zahl" ? "numeric" : f.art === "betrag" ? "decimal" : undefined}
        pattern={f.muster ?? (f.art === "zahl" ? "\\d*" : f.art === "betrag" ? "[0-9.,]*" : undefined)}
        defaultValue={unbekannt ? "" : f.art === "betrag" && s === "de" ? String(wert).replace(".", ",") : String(wert)}
        aria-describedby={hilfeId}
        className="feld mt-3 max-w-xs"
      />
    </div>
  );
}
