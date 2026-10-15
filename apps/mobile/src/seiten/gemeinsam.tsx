import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, View, type ScrollViewProps } from "react-native";
import type { Bereich } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Kachel, Symbol, T } from "../ui/bausteine";
import { RundKnopf, useNav } from "../ui/navigation";
import { RADIUS, RAND, istIos, schattenStil, useFarben } from "../ui/thema";

export interface SeitenKnopf {
  text: string;
  symbol: string;
  label?: string;
  onPress: () => void;
  /** iPhone: Menü am Knopf (wie „+“ in Notizen/Dateien); im Web öffnet der Knopf `onPress`. */
  menue?: { text: string; symbol: string; onPress: () => void }[];
}

/**
 * Erste Seite eines Tabs (E-141): auf dem iPhone mit dem großen Titel der Systemleiste, der beim Scrollen in die Leiste
 * wandert, und echten Glasknöpfen; im Web derselbe Aufbau nachgebildet (Titel im Inhalt).
 */
export function Seite({ titel, unterzeile, ueber, rechts, schliessen, children, ...rest }: ScrollViewProps & { titel: string; unterzeile?: string; ueber?: string; rechts?: SeitenKnopf; schliessen?: boolean }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const nav = useNav();
  // Knopf und Menü über eine Referenz – neue Funktionen je Render sollen die Leiste nicht neu setzen
  const knopf = useRef(rechts);
  knopf.current = rechts;
  const zu = useRef(nav.zurueck);
  zu.current = nav.zurueck;
  useLayoutEffect(() => {
    if (!istIos) {
      navigation.setOptions({ headerShown: false });
      return;
    }
    // große Titel und durchsichtige Leiste stehen schon in den Optionen des Stapels (kein Umschalten nach dem Start)
    navigation.setOptions({
      title: titel,
      ...(schliessen ? { unstable_headerLeftItems: () => [{ type: "button", label: TEXT.schliessen, icon: { type: "sfSymbol", name: "xmark" }, onPress: () => zu.current() }] } : null),
      unstable_headerRightItems: rechts
        ? () => [
            rechts.menue
              ? { type: "menu", label: rechts.text, accessibilityLabel: rechts.label ?? rechts.text, icon: { type: "sfSymbol", name: rechts.symbol as never }, variant: "prominent", tintColor: undefined, menu: { items: rechts.menue.map((m, i) => ({ type: "action" as const, label: m.text, icon: { type: "sfSymbol" as const, name: m.symbol as never }, onPress: () => knopf.current?.menue?.[i]?.onPress() })) } }
              : { type: "button", label: rechts.text, accessibilityLabel: rechts.label ?? rechts.text, icon: { type: "sfSymbol", name: rechts.symbol as never }, onPress: () => knopf.current?.onPress() },
          ]
        : undefined,
    });
    // Handler stehen in Referenzen; neu setzen nur bei anderem Titel oder anderer Beschriftung
  }, [navigation, titel, rechts?.text, rechts?.menue?.map((m) => m.text).join(), schliessen]);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: istIos ? 4 : 14, paddingBottom: istIos ? 32 : 128 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest}>
      {istIos ? (
        ueber || unterzeile ? <T leise stil={{ marginBottom: 18 }}>{[ueber, unterzeile].filter(Boolean).join(" · ")}</T> : null
      ) : (
        <View style={{ marginBottom: 20 }}>
          {ueber ? <T v="caption" fett leise stil={{ marginBottom: 2 }}>{ueber}</T> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T v="grossTitel" accessibilityRole="header" stil={{ flex: 1 }}>{titel}</T>
            {schliessen ? <RundKnopf symbol="xmark" label={TEXT.schliessen} onPress={nav.zurueck} /> : null}
            {rechts ? <PlusKnopf k={rechts} /> : null}
          </View>
          {unterzeile ? <T leise stil={{ marginTop: 5 }}>{unterzeile}</T> : null}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

/** Web: runder, gefüllter Knopf in der Akzentfarbe (auf dem iPhone ein prominenter Glasknopf der Leiste). */
function PlusKnopf({ k }: { k: SeitenKnopf }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={k.label ?? k.text} onPress={k.onPress} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: f.amt, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
      <Symbol name={k.symbol} groesse={20} farbe={f.amtText} gewicht="semibold" />
    </Pressable>
  );
}

/** Leerer Zustand als Einladung: großes Symbol, ein Satz, was jetzt sinnvoll ist, und die Handlung dazu. */
export function Leer({ text, unter, children, symbol = "tray" }: { text: string; unter?: string; children?: ReactNode; symbol?: string }) {
  const f = useFarben();
  return (
    <View style={[{ paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, borderRadius: RADIUS.karte, backgroundColor: f.blatt, gap: 18, alignItems: "stretch", borderWidth: 0 }, schattenStil(f)]}>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Kachel symbol={symbol} groesse={84} />
        <T v="gross" stil={{ textAlign: "center", marginTop: 10 }}>{text}</T>
        {unter ? <T leise stil={{ textAlign: "center", maxWidth: 300 }}>{unter}</T> : null}
      </View>
      {children}
    </View>
  );
}

/** Inhalt einer Unterseite: scrollbar, Platz für die Tab-Leiste, Tastatur schiebt mit. */
export function Inhalt({ children, ...rest }: ScrollViewProps) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: istIos ? 32 : 140 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets {...rest}>
      {children}
    </ScrollView>
  );
}

/** Abschnitt mit Serif-Überschrift über einer Karte – wie eine Zwischenüberschrift im Dokument. */
export function Gruppe({ titel, children, fuss, hilfe }: { titel?: string; children: ReactNode; fuss?: string; hilfe?: string }) {
  return (
    <View style={{ marginTop: 30 }}>
      {titel ? <T v="gross" accessibilityRole="header" stil={{ marginBottom: hilfe ? 3 : 11, marginLeft: 2 }}>{titel}</T> : null}
      {hilfe ? <T v="caption" leise stil={{ marginBottom: 11, marginLeft: 2 }}>{hilfe}</T> : null}
      {children}
      {fuss ? <T v="caption" leise stil={{ marginTop: 8, marginLeft: 2 }}>{fuss}</T> : null}
    </View>
  );
}

/** Symbol je Bereich. */
export const BEREICH_SYMBOL: Record<Bereich, string> = {
  arbeitsschutz: "hammer",
  datenschutz: "lock.shield",
  personal: "person.2",
  steuern: "building.columns",
  betrieb: "building.2",
  gastro: "fork.knife",
  beauty: "scissors",
};

/** ISO-Zeitpunkt → TT.MM.JJJJ (deutsche Ortszeit). */
export const datumKurz = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
