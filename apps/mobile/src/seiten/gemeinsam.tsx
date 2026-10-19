import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { type ReactNode } from "react";
import { Pressable, ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bereich } from "@amtlos/fachlogik";
import { euroText } from "../unterlagen/ablage";
import { Kachel, Motiv, T } from "../ui/bausteine";
import { HellerStatus, TastaturRahmen, useImBlatt, useKopf, type KopfKnopfDef } from "../ui/navigation";
import { RADIUS, RAND, SCHRIFT, schattenStil, useFarben } from "../ui/thema";

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
        <View style={{ paddingTop: inset.top + (ueber || rechts ? 14 : 28), paddingHorizontal: RAND, paddingBottom: 30, gap: 22, overflow: "hidden" }}>
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
      <T farbe="rgba(255,255,255,0.72)" stil={{ ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.07, letterSpacing: -groesse * 0.04 }}>{hinten}</T>
    </T>
  );
}

/**
 * Unterseite oder Blatt im Bühnen-Aufbau (E-144): Die Navigationsleiste wird grün, darunter setzt sich die Bühne fort
 * mit Titel, einem Satz und dem, was zählt; das helle Blatt trägt den Rest. Ein Fuß (Hauptknopf) bleibt unten stehen.
 */
export function BuehnenBlatt({ kopf = "", ueber, titel, unter, buehne, rechts, fuss, children }: { kopf?: string; ueber?: string; titel?: string; unter?: string; buehne?: ReactNode; rechts?: KopfKnopfDef | null; fuss?: ReactNode; children?: ReactNode }) {
  const f = useFarben();
  const imBlatt = useImBlatt();
  useKopf({ titel: kopf, buehne: true, rechts });
  return (
    <TastaturRahmen grund={f.buehne}>
      <HellerStatus />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={{ paddingHorizontal: RAND, paddingTop: 6, paddingBottom: 28, gap: 14, overflow: "hidden" }}>
          <Motiv zeichen="§" groesse={300} farbe="rgba(127,227,184,0.06)" stil={{ right: -70, top: -60 }} />
          {ueber ? <T v="klein" fett farbe={f.buehneLeise}>{ueber}</T> : null}
          {titel ? <T v="titel" accessibilityRole="header" farbe={f.buehneText}>{titel}</T> : null}
          {unter ? <T farbe={f.buehneLeise}>{unter}</T> : null}
          {buehne}
        </View>
        <View style={{ flexGrow: 1, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: RAND, paddingTop: 24, paddingBottom: fuss ? 24 : imBlatt ? 40 : UNTEN_FREI }}>
          {children}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
        </View>
      </ScrollView>
      {fuss}
    </TastaturRahmen>
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
  // in einem Tab liegt die schwebende Tab-Leiste über dem Ende – Platz lassen; in Blättern genügt wenig
  const imBlatt = useImBlatt();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 22, paddingBottom: imBlatt ? 40 : UNTEN_FREI }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets {...rest}>
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
