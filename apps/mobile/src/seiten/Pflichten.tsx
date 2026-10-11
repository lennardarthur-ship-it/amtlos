import { useState } from "react";
import { View } from "react-native";
import type { Karte } from "../kern/api";
import { gruppiere, type Gruppe } from "../kern/gruppen";
import { Hinweis, T } from "../ui/bausteine";
import { useAmtlos } from "../zustand";
import { Leer, Seite, useLaden } from "./gemeinsam";
import { PflichtZeile } from "./Heute";
import { PflichtBlatt } from "./Pflicht";

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig"]);
const REIHE: Gruppe[] = ["ueberfaellig", "woche", "monat", "spaeter", "laufend"];

/** Pflichten nach Zeithorizont – so liest man die Liste am Handy. Fehlende Angaben stehen als Nachfragen auf „Heute“. */
export function Pflichten() {
  const { t, klient, unternehmenId } = useAmtlos();
  const { daten, fehler, laedt, neu } = useLaden(() => klient.pflichten(), [unternehmenId]);
  const [gewaehlt, setGewaehlt] = useState<Karte | null>(null);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const g = gruppiere((daten ?? []).filter((k) => OFFEN.has(k.status)), heute);
  const leer = daten && REIHE.every((r) => !g[r].length);
  return (
    <Seite titel={t.pflichten.titel} laedt={laedt} neu={neu}>
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
      <T v="caption" leise>{t.mobil.alle_pflichten_web}</T>
      <PflichtBlatt karte={gewaehlt} offen={gewaehlt !== null} schliessen={() => setGewaehlt(null)} geaendert={() => void neu()} />
    </Seite>
  );
}
