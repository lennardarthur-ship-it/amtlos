import type { ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import type { Bereich } from "@amtlos/fachlogik";
import { Stempel, T } from "../ui/bausteine";
import { RADIUS, RAND, schattenStil, useFarben } from "../ui/thema";

/** Seitenrahmen mit großem Titel (iOS-Stil) und optionaler Unterzeile. */
export function Seite({ titel, unterzeile, children, ...rest }: ScrollViewProps & { titel: string; unterzeile?: string }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 14, paddingBottom: 128 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest}>
      <View style={{ marginBottom: 20 }}>
        <T v="grossTitel" accessibilityRole="header">{titel}</T>
        {unterzeile ? <T leise stil={{ marginTop: 5 }}>{unterzeile}</T> : null}
      </View>
      {children}
    </ScrollView>
  );
}

/** Leerer Zustand als Einladung: der Stempel, ein Satz, was jetzt sinnvoll ist, und die Handlung dazu. */
export function Leer({ text, unter, children }: { text: string; unter?: string; children?: ReactNode }) {
  const f = useFarben();
  return (
    <View style={[{ paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, borderRadius: RADIUS.karte, backgroundColor: f.blatt, gap: 18, alignItems: "stretch", borderWidth: f.schatten ? 0 : 1, borderColor: f.linie }, schattenStil(f)]}>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Stempel groesse={58} farbe={f.amt} />
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
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets {...rest}>
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
