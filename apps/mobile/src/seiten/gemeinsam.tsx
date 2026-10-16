import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bereich } from "@amtlos/fachlogik";
import { euroText } from "../unterlagen/ablage";
import { T as TEXT } from "../texte";
import { Kachel, Motiv, Symbol, T } from "../ui/bausteine";
import { RundKnopf, useNav } from "../ui/navigation";
import { RADIUS, RAND, SCHRIFT, istIos, schattenStil, useFarben } from "../ui/thema";

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

/** Platz unter dem Blatt für die schwebende Tab-Leiste. */
export const UNTEN_FREI = 120;

/**
 * Tab-Seite (E-142 „Bühne und Papier“): oben die dunkelgrüne Bühne mit Zeile darüber, großem Titel und dem, was auf
 * dieser Seite zählt (Betrag, Jahr, Knöpfe); darunter schiebt sich das helle Blatt mit dem Rest. Statusleiste hell,
 * solange die Seite sichtbar ist. Unter dem Blatt geht der helle Grund weiter (kein Grün beim Ziehen nach oben).
 */
export function BuehnenSeite({ ueber, titel, rechts, buehne, children, ...rest }: ScrollViewProps & { ueber?: string; titel?: string; rechts?: ReactNode; buehne?: ReactNode }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const sichtbar = useIsFocused();
  return (
    <View style={{ flex: 1, backgroundColor: f.buehne }}>
      {sichtbar ? <StatusBar style="light" /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest}>
        <View style={{ paddingTop: inset.top + (ueber || rechts ? 14 : 28), paddingHorizontal: RAND + 4, paddingBottom: 30, gap: 22, overflow: "hidden" }}>
          <Motiv zeichen="§" groesse={380} farbe="rgba(127,227,184,0.06)" stil={{ right: -92, top: -40 }} />
          {ueber || rechts ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
              <T v="klein" fett farbe={f.buehneLeise} stil={{ flex: 1 }} numberOfLines={1}>{ueber ?? ""}</T>
              {rechts}
            </View>
          ) : null}
          {titel ? <T v="grossTitel" accessibilityRole="header" farbe={f.buehneText}>{titel}</T> : null}
          {buehne}
        </View>
        <View style={{ flexGrow: 1, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: RAND, paddingTop: 24, paddingBottom: UNTEN_FREI }}>
          {children}
          {/* heller Grund unter dem Blatt – beim Ziehen über das Ende hinaus kein Grün */}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
        </View>
      </ScrollView>
    </View>
  );
}

/** Betrag groß wie in Finanz-Apps: Euro weiß, Cent und Zeichen gedämpft. */
export function GrosserBetrag({ cent, groesse = 60 }: { cent: number; groesse?: number }) {
  const f = useFarben();
  const text = euroText(cent);
  const komma = text.lastIndexOf(",");
  const vorn = komma > 0 ? text.slice(0, komma) : text;
  const hinten = komma > 0 ? text.slice(komma) : "";
  return (
    <T accessibilityLabel={text} farbe={f.buehneText} stil={{ ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.07, letterSpacing: -groesse * 0.04, fontVariant: ["tabular-nums"] }}>
      {vorn}
      <T farbe={f.buehneLeise} stil={{ ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.07, letterSpacing: -groesse * 0.04, opacity: 0.7 }}>{hinten}</T>
    </T>
  );
}

/** Kleiner Knopf auf der Bühne (oben rechts): Glasfläche mit weißer Schrift. */
export function BuehnenKnopf({ text, onPress, label }: { text: string; onPress: () => void; label?: string }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center", backgroundColor: f.buehneFlaeche, opacity: pressed ? 0.7 : 1 })}>
      <T v="klein" farbe={f.buehneText} stil={{ ...SCHRIFT.halb }}>{text}</T>
    </Pressable>
  );
}

/** Plakette auf der Bühne („820 € überfällig“, „Oktober 3.860 €“) – `warnung` rot getönt. */
export function BuehnenMarke({ text, warnung }: { text: string; warnung?: boolean }) {
  const f = useFarben();
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: warnung ? "rgba(255,105,97,0.22)" : f.buehneFlaeche }}>
      <T v="caption" farbe={warnung ? "#ffc9c4" : f.buehneText} stil={{ ...SCHRIFT.halb }}>{text}</T>
    </View>
  );
}

/** Abschnitt auf dem Blatt: Überschrift links, optional ein Link rechts. */
export function BlattKopf({ titel, rechts, onPress, erste }: { titel: string; rechts?: string; onPress?: () => void; erste?: boolean }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: erste ? 0 : 30, marginBottom: 12, paddingHorizontal: 4 }}>
      <T v="gross" accessibilityRole="header">{titel}</T>
      {rechts && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
          {({ pressed }) => <T v="klein" farbe={f.amt} stil={{ ...SCHRIFT.halb, opacity: pressed ? 0.55 : 1 }}>{rechts}</T>}
        </Pressable>
      ) : null}
    </View>
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
export function Gruppe({ titel, children, fuss, hilfe, erste }: { titel?: string; children: ReactNode; fuss?: string; hilfe?: string; erste?: boolean }) {
  return (
    <View style={{ marginTop: erste ? 0 : 30 }}>
      {titel ? <T v="gross" accessibilityRole="header" stil={{ marginBottom: hilfe ? 3 : 12, marginLeft: 4 }}>{titel}</T> : null}
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
