import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text as RNText, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { datumTeile, type Sprache } from "@amtlos/i18n";
import { GROESSE, RADIUS, SCHRIFT, ZIEL, istIos, useFarben } from "./thema";

type Variante = "grossTitel" | "titel" | "gross" | "basis" | "klein" | "caption";
const STIL: Record<Variante, TextStyle> = {
  grossTitel: { fontSize: GROESSE.grossTitel, lineHeight: 40, fontFamily: SCHRIFT.bold, letterSpacing: -0.4 },
  titel: { fontSize: GROESSE.titel, lineHeight: 28, fontFamily: SCHRIFT.bold },
  gross: { fontSize: GROESSE.gross, lineHeight: 26, fontFamily: SCHRIFT.bold },
  basis: { fontSize: GROESSE.basis, lineHeight: 24, fontFamily: SCHRIFT.regular },
  klein: { fontSize: GROESSE.klein, lineHeight: 20, fontFamily: SCHRIFT.regular },
  caption: { fontSize: GROESSE.caption, lineHeight: 18, fontFamily: SCHRIFT.regular },
};

/** Text mit Markenschrift. `fett` wechselt die Schriftdatei (keine künstliche Fettung). */
export function T({ v = "basis", fett, leise, farbe, stil, children, ...rest }: { v?: Variante; fett?: boolean; leise?: boolean; farbe?: string; stil?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  const f = useFarben();
  return (
    <RNText {...rest} style={[STIL[v], fett ? { fontFamily: SCHRIFT.bold } : null, { color: farbe ?? (leise ? f.tinteLeise : f.tinte) }, stil]}>
      {children}
    </RNText>
  );
}

/** SF Symbol auf iOS, sonst Ionicons. Immer dekorativ – der Text daneben trägt die Bedeutung. */
const FALLBACK: Record<string, keyof typeof Ionicons.glyphMap> = {
  "calendar": "calendar-outline", "checklist": "list-outline", "clock": "time-outline", "doc.viewfinder": "camera-outline", "ellipsis.circle": "ellipsis-horizontal-circle-outline",
  "checkmark": "checkmark", "chevron.right": "chevron-forward", "bell": "notifications-outline", "person.2": "people-outline", "globe": "globe-outline", "rectangle.portrait.and.arrow.right": "log-out-outline",
  "building.2": "business-outline", "wifi.slash": "cloud-offline-outline", "arrow.triangle.2.circlepath": "sync-outline", "exclamationmark.triangle": "warning-outline", "camera": "camera-outline", "photo.on.rectangle": "images-outline",
  "play.fill": "play", "stop.fill": "stop", "xmark": "close", "arrow.right": "arrow-forward", "sparkles": "sparkles-outline", "info.circle": "information-circle-outline",
};
export function Symbol({ name, groesse = 22, farbe, gewicht = "medium" }: { name: string; groesse?: number; farbe?: string; gewicht?: SymbolViewProps["weight"] }) {
  const f = useFarben();
  const c = farbe ?? f.tinteLeise;
  if (istIos) return <SymbolView name={name as SymbolViewProps["name"]} size={groesse} tintColor={c} weight={gewicht} resizeMode="scaleAspectFit" style={{ width: groesse, height: groesse }} />;
  return <Ionicons name={FALLBACK[name] ?? "ellipse-outline"} size={groesse} color={c} />;
}

/**
 * Das Fristblatt – das eine prägende Element (docs/06): ein Abreißkalender-Blatt mit Wochentag, Tag und Monat.
 * Der Farbstreifen oben sagt, was Sache ist: rot = überfällig, orange = bald, grün = erledigt, sonst Tinte.
 */
export function Fristblatt({ datum, status, sprache, gross }: { datum: string | null; status: string; sprache: Sprache; gross?: boolean }) {
  const f = useFarben();
  const streifen = status === "ueberfaellig" ? f.frist : status === "faellig_bald" ? f.bald : status === "erledigt" ? f.amt : f.tinte;
  const b = gross ? 84 : 56;
  const t = datum ? datumTeile(datum, sprache) : null;
  return (
    <View style={{ width: b, borderRadius: RADIUS.blatt, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie, overflow: "hidden", alignItems: "center", paddingBottom: gross ? 8 : 5 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: gross ? 6 : 4, alignSelf: "stretch", backgroundColor: streifen }} />
      {t ? (
        <>
          <RNText style={{ fontFamily: SCHRIFT.regular, fontSize: gross ? 13 : 11, color: f.tinteLeise, marginTop: gross ? 6 : 3 }}>{t.wochentag}</RNText>
          <RNText style={{ fontFamily: SCHRIFT.bold, fontSize: gross ? GROESSE.blatt : 22, lineHeight: gross ? 40 : 26, color: f.tinte, fontVariant: ["tabular-nums"] }}>{t.tag}</RNText>
          <RNText style={{ fontFamily: SCHRIFT.bold, fontSize: gross ? 14 : 11, color: f.tinte }}>{t.monat}</RNText>
        </>
      ) : (
        <RNText style={{ fontFamily: SCHRIFT.bold, fontSize: gross ? 26 : 18, color: f.tinteLeise, marginVertical: gross ? 20 : 10 }}>–</RNText>
      )}
    </View>
  );
}

/** Primärer und leiser Knopf: 48 pt hoch, Haptik beim Tippen. */
export function Knopf({ text, onPress, leise, gefahr, deaktiviert, laedt, symbol, stil }: { text: string; onPress: () => void; leise?: boolean; gefahr?: boolean; deaktiviert?: boolean; laedt?: boolean; symbol?: string; stil?: StyleProp<ViewStyle> }) {
  const f = useFarben();
  const farbe = gefahr ? f.frist : f.amt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(deaktiviert || laedt), busy: Boolean(laedt) }}
      disabled={deaktiviert || laedt}
      onPress={() => {
        if (istIos) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        { minHeight: ZIEL, paddingHorizontal: 20, borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: leise ? "transparent" : farbe, borderWidth: leise ? 1.5 : 0, borderColor: farbe, opacity: deaktiviert ? 0.45 : pressed ? 0.8 : 1 },
        stil,
      ]}
    >
      {laedt ? <ActivityIndicator color={leise ? farbe : f.blatt} /> : null}
      {!laedt && symbol ? <Symbol name={symbol} groesse={18} farbe={leise ? farbe : f.blatt} /> : null}
      {!laedt ? <RNText style={{ fontFamily: SCHRIFT.bold, fontSize: GROESSE.basis, color: leise ? farbe : f.blatt }}>{text}</RNText> : null}
    </Pressable>
  );
}

/** Abschnittsüberschrift wie in iOS-Listen: ruhig, klein, in Tinte – keine Großbuchstaben. */
export function Abschnitt({ titel, rechts, children }: { titel?: string; rechts?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      {titel ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <T v="gross" accessibilityRole="header">{titel}</T>
          {rechts}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Zeile in einer Liste: tippbar, mit Haarlinie unten. */
export function Zeile({ links, titel, text, rechts, onPress, letzte }: { links?: ReactNode; titel: string; text?: string; rechts?: ReactNode; onPress?: () => void; letzte?: boolean }) {
  const f = useFarben();
  const inhalt = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: letzte ? 0 : 1, borderColor: f.linieLeise }}>
      {links}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T fett numberOfLines={2}>{titel}</T>
        {text ? <T v="klein" leise numberOfLines={2} stil={{ marginTop: 2 }}>{text}</T> : null}
      </View>
      {rechts ?? (onPress ? <Symbol name="chevron.right" groesse={16} /> : null)}
    </View>
  );
  if (!onPress) return inhalt;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {inhalt}
    </Pressable>
  );
}

/** Hinweis: ruhig, mit Symbol; „fehler“ hat Rolle alert. Farbe nie allein (immer Text). */
export function Hinweis({ text, art = "info", symbol }: { text: string; art?: "info" | "fehler" | "erfolg"; symbol?: string }) {
  const f = useFarben();
  const farbe = art === "fehler" ? f.frist : art === "erfolg" ? f.amt : f.bald;
  const hg = art === "fehler" ? f.fristHauch : art === "erfolg" ? f.amtHauch : f.baldHauch;
  return (
    <View accessibilityRole={art === "fehler" ? "alert" : "text"} accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: hg, borderRadius: RADIUS.klein, padding: 12, marginVertical: 6 }}>
      <Symbol name={symbol ?? (art === "fehler" ? "exclamationmark.triangle" : art === "erfolg" ? "checkmark" : "info.circle")} groesse={18} farbe={farbe} />
      <T v="klein" stil={{ flex: 1 }}>{text}</T>
    </View>
  );
}

/** Statuszeile: Form + Text, Farbe nie allein. */
export function Status({ status, text }: { status: string; text: string }) {
  const f = useFarben();
  const farbe = status === "ueberfaellig" ? f.frist : status === "faellig_bald" ? f.bald : status === "erledigt" ? f.amt : f.tinteLeise;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: status === "erledigt" ? 2 : 4, backgroundColor: farbe }} />
      <T v="caption" fett farbe={farbe}>{text}</T>
    </View>
  );
}

/** Gestempelt: der Erfolgsmoment (E-117). Leicht gedreht, in Handlungsfarbe. */
export function Stempel({ text }: { text: string }) {
  const f = useFarben();
  return (
    <View style={{ alignSelf: "flex-start", transform: [{ rotate: "-6deg" }], borderWidth: 2.5, borderColor: f.amt, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
      <RNText style={{ fontFamily: SCHRIFT.bold, fontSize: GROESSE.gross, color: f.amt, letterSpacing: 1 }}>{text}</RNText>
    </View>
  );
}
