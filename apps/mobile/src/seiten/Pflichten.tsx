import { useState } from "react";
import { Pressable, View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import type { Karte } from "../kern/api";
import { gruppiere, type Gruppe } from "../kern/gruppen";
import { Hinweis, Karte as KarteBox, Symbol, T, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Inhalt, Leer, Seite, useLaden } from "./gemeinsam";
import { PflichtZeile } from "./Heute";
import { Kalender } from "./mehr/Kalender";
import { PflichtBlatt } from "./Pflicht";

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig"]);
const REIHE: Gruppe[] = ["ueberfaellig", "woche", "monat", "spaeter", "laufend"];

/** Pflichten nach Zeithorizont – so liest man die Liste am Handy. Fehlende Angaben stehen als Nachfragen auf „Heute“. */
export function Pflichten() {
  const { t, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten, fehler, laedt, neu } = useLaden(() => klient.pflichten(), [unternehmenId]);
  const unklar = daten?.filter((k) => k.status === "angabe_fehlt") ?? [];
  const giltNicht = daten?.filter((k) => k.status === "nicht_zutreffend") ?? [];
  const erledigt = daten?.filter((k) => k.status === "erledigt") ?? [];
  const [gewaehlt, setGewaehlt] = useState<Karte | null>(null);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const g = gruppiere((daten ?? []).filter((k) => OFFEN.has(k.status)), heute);
  const leer = daten && REIHE.every((r) => !g[r].length);
  return (
    <Seite
      titel={t.pflichten.titel}
      laedt={laedt}
      neu={neu}
      kopfRechts={
        <Pressable accessibilityRole="button" accessibilityLabel={t.kalender.titel} onPress={() => nav.oeffnen("kalender", () => <Kalender />)} hitSlop={8} style={{ padding: 8, marginBottom: 4 }}>
          <Symbol name="calendar" groesse={24} farbe={f.amt} />
        </Pressable>
      }
    >
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {leer ? <Leer text={t.mobil.nichts_offen} /> : null}
      {REIHE.filter((r) => g[r].length).map((r) => (
        <View key={r} style={{ marginBottom: 22 }}>
          <T v="gross" accessibilityRole="header" stil={{ marginBottom: 2 }}>{t.mobil.gruppen[r]}</T>
          {g[r].map((k, i) => (
            <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} k={k} onPress={() => setGewaehlt(k)} letzte={i === g[r].length - 1} />
          ))}
        </View>
      ))}
      {unklar.length || giltNicht.length || erledigt.length ? (
        <KarteBox stil={{ marginTop: 4 }}>
          {unklar.length ? <Zeile links={<Symbol name="questionmark.circle" groesse={20} farbe={f.bald} />} titel={fuelle(t.pflichten.unklar_titel, { n: unklar.length })} text={t.pflichten.unklar_text} onPress={() => nav.oeffnen("unklar", () => <Liste titel={t.status.angabe_fehlt} karten={unklar} neu={() => void neu()} />)} /> : null}
          {erledigt.length ? <Zeile links={<Symbol name="checkmark.circle" groesse={20} farbe={f.amt} />} titel={t.status.erledigt} text={String(erledigt.length)} onPress={() => nav.oeffnen("erledigt", () => <Liste titel={t.status.erledigt} karten={erledigt} neu={() => void neu()} />)} /> : null}
          {giltNicht.length ? <Zeile links={<Symbol name="xmark" groesse={18} />} titel={t.pflichten.nicht_zutreffend_link} text={String(giltNicht.length)} onPress={() => nav.oeffnen("gilt-nicht", () => <Liste titel={t.pflichten.nicht_zutreffend_link} karten={giltNicht} neu={() => void neu()} />)} letzte /> : null}
        </KarteBox>
      ) : null}
      <PflichtBlatt karte={gewaehlt} offen={gewaehlt !== null} schliessen={() => setGewaehlt(null)} geaendert={() => void neu()} />
    </Seite>
  );
}

/** Eine einfache Liste von Pflichten (fehlende Angabe, erledigt, gilt nicht) als Unterseite. */
function Liste({ titel, karten, neu }: { titel: string; karten: Karte[]; neu: () => void }) {
  const [gewaehlt, setGewaehlt] = useState<Karte | null>(null);
  return (
    <Unterseite titel={titel}>
      <Inhalt>
        {karten.map((k, i) => (
          <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} k={k} onPress={() => setGewaehlt(k)} letzte={i === karten.length - 1} />
        ))}
      </Inhalt>
      <PflichtBlatt karte={gewaehlt} offen={gewaehlt !== null} schliessen={() => setGewaehlt(null)} geaendert={neu} />
    </Unterseite>
  );
}
