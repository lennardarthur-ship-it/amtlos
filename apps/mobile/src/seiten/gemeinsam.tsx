import type { ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import type { Bereich } from "@amtlos/fachlogik";
import { T } from "../ui/bausteine";
import { RAND, useFarben } from "../ui/thema";

/** Seitenrahmen mit großem Titel (iOS-Stil) und optionaler Unterzeile. */
export function Seite({ titel, unterzeile, children, ...rest }: ScrollViewProps & { titel: string; unterzeile?: string }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 8, paddingBottom: 120 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest}>
      <View style={{ marginBottom: 16 }}>
        <T v="grossTitel" accessibilityRole="header">{titel}</T>
        {unterzeile ? <T leise stil={{ marginTop: 4 }}>{unterzeile}</T> : null}
      </View>
      {children}
    </ScrollView>
  );
}

/** Leerer Zustand als Einladung: ein Satz, was jetzt sinnvoll ist. */
export function Leer({ text, children }: { text: string; children?: ReactNode }) {
  const f = useFarben();
  return (
    <View style={{ paddingVertical: 24, paddingHorizontal: 16, borderRadius: 14, backgroundColor: f.amtHauch, gap: 14 }}>
      <T fett farbe={f.amtTief}>{text}</T>
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

/** Abschnittstitel klein über einer Karte, wie in iOS-Einstellungen. */
export function Gruppe({ titel, children, fuss, hilfe }: { titel?: string; children: ReactNode; fuss?: string; hilfe?: string }) {
  return (
    <View style={{ marginTop: 24 }}>
      {titel ? <T v="klein" fett leise accessibilityRole="header" stil={{ marginBottom: hilfe ? 2 : 8, marginLeft: 4 }}>{titel}</T> : null}
      {hilfe ? <T v="caption" leise stil={{ marginBottom: 8, marginLeft: 4 }}>{hilfe}</T> : null}
      {children}
      {fuss ? <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{fuss}</T> : null}
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
