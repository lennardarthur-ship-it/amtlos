import { useState } from "react";
import { View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import type { Karte as KarteT } from "../../kern/api";
import type { Termin } from "../../kern/typen";
import { Fristblatt, Karte, T, Zeile } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, Leer, useLaden } from "../gemeinsam";
import { PflichtBlatt } from "../Pflicht";

/** Kalender: alle Fristen der nächsten zwölf Monate nach Monat, dazu Fristen aus Behördenbriefen. */
export function Kalender() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const { daten, neu, laedt } = useLaden(async () => {
    const [karten, termine] = await Promise.all([klient.pflichten(), klient.holen<Termin[]>("/v1/termine")]);
    return { karten, termine };
  }, [unternehmenId]);
  const [blatt, setBlatt] = useState<KarteT | null>(null);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const bis = `${Number(heute.slice(0, 4)) + 1}${heute.slice(4)}`;
  type Eintrag = { datum: string; titel: string; status: string; karte?: KarteT };
  const eintraege: Eintrag[] = [
    ...(daten?.karten ?? []).filter((k) => k.faellig_am && k.status !== "erledigt" && k.status !== "nicht_zutreffend" && k.faellig_am <= bis).map((k) => ({ datum: k.faellig_am!, titel: k.titel, status: k.status, karte: k })),
    ...(daten?.termine ?? []).filter((w) => w.datum <= bis).map((w) => ({ datum: w.datum, titel: w.titel, status: w.datum < heute ? "ueberfaellig" : "offen" })),
  ].sort((a, b) => a.datum.localeCompare(b.datum));
  const monate = new Map<string, Eintrag[]>();
  for (const e of eintraege) monate.set(e.datum.slice(0, 7), [...(monate.get(e.datum.slice(0, 7)) ?? []), e]);
  const laufend = (daten?.karten ?? []).filter((k) => !k.faellig_am && k.status !== "erledigt" && k.status !== "nicht_zutreffend").length;
  const monatName = (m: string) => new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  return (
    <Unterseite titel={t.kalender.titel}>
      <Inhalt laedt={laedt} neu={neu}>
        <T leise>{t.kalender.jahr_text}</T>
        {daten && !eintraege.length ? <View style={{ marginTop: 16 }}><Leer text={t.kalender.leer} /></View> : null}
        {[...monate.entries()].map(([m, liste]) => (
          <Gruppe key={m} titel={monatName(m)}>
            <Karte>
              {liste.map((e, i) => (
                <Zeile key={`${e.datum}-${e.titel}-${i}`} links={<Fristblatt datum={e.datum} status={e.status} sprache={sprache} />} titel={e.titel} text={(t.status as Record<string, string>)[e.status]} onPress={e.karte ? () => setBlatt(e.karte!) : undefined} letzte={i === liste.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ))}
        {laufend ? <T v="caption" leise stil={{ marginTop: 16 }}>{fuelle(t.kalender.laufend_text, { n: laufend })}</T> : null}
        <T v="caption" leise stil={{ marginTop: 8 }}>{t.kalender.vorlaeufig_hinweis}</T>
      </Inhalt>
      <PflichtBlatt karte={blatt} offen={Boolean(blatt)} schliessen={() => setBlatt(null)} geaendert={() => void neu()} />
    </Unterseite>
  );
}
