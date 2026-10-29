import { useState } from "react";
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { Hinweis, T, TextKnopf } from "./bausteine";
import { RADIUS, useFarben, weich } from "./thema";
import { ordnen, type Geordnet, type Meldung } from "./hinweisStufen";

/**
 * E-239: Warnungen und Hinweise eines Bildschirms in drei Stufen (hinweisStufen.ts). Blocker stehen sichtbar in höchstens
 * einem Kasten; Hinweise in einer ruhigen Zeile „N Hinweise“ (mit `bereit`: „Alles bereit – N Hinweise“), aufklappbar;
 * Erklärungen erst nach „Mehr erfahren“. Die Zeilen sind Knöpfe mit Zustand „aufgeklappt“ für VoiceOver; die Texte
 * selbst sind unverändert.
 */
export function HinweisStapel({ meldungen, geordnet, bereit, oben = 6 }: { meldungen?: readonly (Meldung | null | undefined | false)[]; geordnet?: Geordnet; /** nichts mehr zu tun – positive Zeile */ bereit?: boolean; oben?: number }) {
  const g = geordnet ?? ordnen(meldungen ?? []);
  const [offen, setOffen] = useState(false);
  const [mehr, setMehr] = useState(false);
  if (!g.blocker.length && !g.hinweise.length && !g.info.length) return null;
  const n = g.hinweise.length;
  return (
    <View style={{ marginTop: oben }}>
      {g.blocker.length ? <BlockerKasten l={g.blocker} /> : null}
      {n ? (
        <TextKnopf
          symbol={offen ? "chevron.up" : "chevron.down"}
          text={bereit && !g.blocker.length ? TEXT.e239_bereit(n) : TEXT.e239_hinweise(n)}
          erweitert={offen}
          onPress={() => {
            weich();
            setOffen(!offen);
          }}
        />
      ) : null}
      {n && offen ? g.hinweise.map((m) => <Zeile key={m.text} m={m} />) : null}
      {g.info.length && (offen || !n) ? (
        <TextKnopf
          symbol={mehr ? "chevron.up" : "chevron.down"}
          leise
          text={TEXT.e239_mehr_erfahren}
          erweitert={mehr}
          onPress={() => {
            weich();
            setMehr(!mehr);
          }}
        />
      ) : null}
      {g.info.length && mehr && (offen || !n) ? g.info.map((m) => <Zeile key={m.text} m={m} />) : null}
    </View>
  );
}

function Zeile({ m }: { m: Meldung }) {
  return (
    <View>
      <Hinweis text={m.text} symbol={m.symbol} />
      {m.aktion ? <TextKnopf symbol={m.aktion.symbol} text={m.aktion.text} onPress={m.aktion.onPress} /> : null}
    </View>
  );
}

/** Ein Kasten für alle Blocker: einer als Warnung wie bisher, mehrere als Liste unter einer Überschrift. */
function BlockerKasten({ l }: { l: Meldung[] }) {
  const f = useFarben();
  if (l.length === 1)
    return (
      <View>
        <Hinweis art="warnung" text={l[0]!.text} symbol={l[0]!.symbol} />
        {l[0]!.aktion ? <TextKnopf symbol={l[0]!.aktion.symbol} text={l[0]!.aktion.text} onPress={l[0]!.aktion.onPress} /> : null}
      </View>
    );
  return (
    <View accessibilityRole="summary" style={{ marginVertical: 6, backgroundColor: f.baldHauch, borderRadius: RADIUS.klein, paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
      <T v="klein" fett accessibilityRole="header">{TEXT.e239_wichtig(l.length)}</T>
      {l.map((m) => (
        <View key={m.text} style={{ flexDirection: "row", gap: 8 }}>
          <T v="klein" importantForAccessibility="no" accessibilityElementsHidden>{"•"}</T>
          <View style={{ flex: 1 }}>
            <T v="klein">{m.text}</T>
            {m.aktion ? <TextKnopf symbol={m.aktion.symbol} text={m.aktion.text} onPress={m.aktion.onPress} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
