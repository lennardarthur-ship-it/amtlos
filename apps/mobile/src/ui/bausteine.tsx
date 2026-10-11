import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text as RNText, Switch, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { datumTeile, type Sprache } from "@amtlos/i18n";
import { useAmtlos } from "../zustand";
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
  "chevron.left": "chevron-back", "plus": "add", "doc.text": "document-text-outline", "eurosign": "logo-euro", "envelope": "mail-outline", "tray": "file-tray-outline",
  "building.columns": "library-outline", "questionmark.circle": "help-circle-outline", "gearshape": "settings-outline", "megaphone": "megaphone-outline",
  "banknote": "cash-outline", "creditcard": "card-outline", "person.3": "people-circle-outline", "trash": "trash-outline", "square.and.arrow.up": "share-outline",
  "flag": "flag-outline", "graduationcap": "school-outline", "chart.bar": "bar-chart-outline", "magnifyingglass": "search-outline", "briefcase": "briefcase-outline",
  "person.badge.plus": "person-add-outline", "list.bullet": "list-outline", "calendar.badge.clock": "calendar-outline", "checkmark.circle": "checkmark-circle-outline",
  "exclamationmark.circle": "alert-circle-outline", "person": "person-outline", "lock": "lock-closed-outline", "percent": "calculator-outline",
};
export function Symbol({ name, groesse = 22, farbe, gewicht = "medium" }: { name: string; groesse?: number; farbe?: string; gewicht?: SymbolViewProps["weight"] }) {
  const f = useFarben();
  const c = farbe ?? f.tinteLeise;
  if (istIos) return <SymbolView name={name as SymbolViewProps["name"]} size={groesse} tintColor={c} weight={gewicht} resizeMode="scaleAspectFit" style={{ width: groesse, height: groesse }} />;
  // Das Ersatz-Icon ist ein Schriftzeichen – für Screenreader verbergen, sonst wird es mitgelesen
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Ionicons name={FALLBACK[name] ?? "ellipse-outline"} size={groesse} color={c} />
    </View>
  );
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

// ---------------------------------------------------------------- Formulare (E-120)

/** Karte: weiße Fläche mit Haarlinie, für zusammengehörige Zeilen oder ein Formular. */
export function Karte({ children, stil, rahmen }: { children: ReactNode; stil?: StyleProp<ViewStyle>; rahmen?: string }) {
  const f = useFarben();
  return <View style={[{ backgroundColor: f.blatt, borderRadius: RADIUS.karte, borderWidth: rahmen ? 1.5 : 1, borderColor: rahmen ?? f.linie, paddingHorizontal: 14 }, stil]}>{children}</View>;
}

/** Beschriftetes Textfeld; die Beschriftung steht darüber und ist mit dem Feld verbunden. */
export function Feld({ label, wert, aendern, hilfe, fehler, mehrzeilig, ...rest }: { label: string; wert: string; aendern: (w: string) => void; hilfe?: string; fehler?: string | null; mehrzeilig?: boolean } & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText" | "style">) {
  const f = useFarben();
  return (
    <View style={{ marginTop: 14 }}>
      <T v="klein" fett>{label}</T>
      {hilfe ? <T v="caption" leise stil={{ marginTop: 2 }}>{hilfe}</T> : null}
      <TextInput
        accessibilityLabel={label}
        value={wert}
        onChangeText={aendern}
        multiline={mehrzeilig}
        placeholderTextColor={f.tinteLeise}
        style={{ minHeight: mehrzeilig ? 96 : ZIEL, borderWidth: 1.5, borderColor: fehler ? f.frist : f.linie, borderRadius: RADIUS.klein, paddingHorizontal: 14, paddingTop: mehrzeilig ? 12 : 0, textAlignVertical: mehrzeilig ? "top" : "center", color: f.tinte, backgroundColor: f.blatt, fontFamily: SCHRIFT.regular, fontSize: GROESSE.basis, marginTop: 6 }}
        {...rest}
      />
      {fehler ? <T v="caption" farbe={f.frist} stil={{ marginTop: 4 }}>{fehler}</T> : null}
    </View>
  );
}

/** ISO-Datum ↔ deutsche Schreibweise TT.MM.JJJJ (bzw. englisch DD/MM/YYYY). */
export function isoAus(text: string): string | null {
  const m = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(text) ?? null;
  if (m) {
    const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text.trim()) ? text.trim() : null;
}
export const textAus = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** Datumsfeld ohne zusätzliches Paket: Eingabe als TT.MM.JJJJ, „Heute“ als Abkürzung. Liefert ISO oder null. */
export function DatumFeld({ label, wert, aendern, hilfe, ohneHeute }: { label: string; wert: string | null; aendern: (iso: string | null) => void; hilfe?: string; ohneHeute?: boolean }) {
  const f = useFarben();
  const heuteText = useAmtlos().t.mobil.heute;
  const [text, setText] = useState(textAus(wert));
  useEffect(() => setText(textAus(wert)), [wert]);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const falsch = text.trim() !== "" && !isoAus(text);
  return (
    <View style={{ marginTop: 14 }}>
      <T v="klein" fett>{label}</T>
      {hilfe ? <T v="caption" leise stil={{ marginTop: 2 }}>{hilfe}</T> : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(w) => {
            setText(w);
            aendern(w.trim() === "" ? null : isoAus(w));
          }}
          placeholder="TT.MM.JJJJ"
          placeholderTextColor={f.tinteLeise}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1, minHeight: ZIEL, borderWidth: 1.5, borderColor: falsch ? f.frist : f.linie, borderRadius: RADIUS.klein, paddingHorizontal: 14, color: f.tinte, backgroundColor: f.blatt, fontFamily: SCHRIFT.regular, fontSize: GROESSE.basis, fontVariant: ["tabular-nums"] }}
        />
        {ohneHeute ? null : (
          <Pressable accessibilityRole="button" onPress={() => aendern(heute)} style={{ minHeight: ZIEL, paddingHorizontal: 14, borderRadius: RADIUS.klein, justifyContent: "center", backgroundColor: f.amtHauch }}>
            <T v="klein" fett farbe={f.amt}>{heuteText}</T>
          </Pressable>
        )}
      </View>
      {falsch ? <T v="caption" farbe={f.frist} stil={{ marginTop: 4 }}>TT.MM.JJJJ</T> : null}
    </View>
  );
}

/** Euro-Betrag ↔ Cent. „12,50“ → 1250. Leer → null. */
export function centAus(text: string): number | null {
  const t = text.replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const euroText = (cent: number | null | undefined, sprache: "de" | "en" = "de") =>
  cent === null || cent === undefined ? "–" : new Intl.NumberFormat(sprache === "en" ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);

export function BetragFeld({ label, cent, aendern, hilfe }: { label: string; cent: number | null; aendern: (c: number | null) => void; hilfe?: string }) {
  const [text, setText] = useState(cent === null ? "" : (cent / 100).toFixed(2).replace(".", ","));
  return (
    <Feld
      label={label}
      hilfe={hilfe}
      wert={text}
      aendern={(w) => {
        setText(w);
        aendern(centAus(w));
      }}
      keyboardType="decimal-pad"
      placeholder="0,00"
      fehler={text.trim() !== "" && centAus(text) === null ? "0,00" : null}
    />
  );
}

/** Auswahl als Chips (wenige Optionen) – Radio-Semantik für VoiceOver. */
export function Wahl<W extends string>({ label, wert, aendern, optionen }: { label?: string; wert: W | null; aendern: (w: W) => void; optionen: { wert: W; text: string }[] }) {
  const f = useFarben();
  return (
    <View style={{ marginTop: label ? 14 : 0 }}>
      {label ? <T v="klein" fett>{label}</T> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: label ? 8 : 0 }}>
        {optionen.map((o) => {
          const an = o.wert === wert;
          return (
            <Pressable
              key={o.wert}
              accessibilityRole="radio"
              accessibilityState={{ checked: an }}
              onPress={() => {
                if (istIos) void Haptics.selectionAsync();
                aendern(o.wert);
              }}
              style={{ minHeight: ZIEL - 8, paddingHorizontal: 14, borderRadius: 20, justifyContent: "center", backgroundColor: an ? f.tinte : f.blatt, borderWidth: 1, borderColor: an ? f.tinte : f.linie }}
            >
              <T v="klein" fett farbe={an ? f.papier : f.tinte}>{o.text}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Schalter mit Beschriftung (iOS-Switch in Handlungsfarbe). */
export function Schalter({ label, wert, aendern, hilfe }: { label: string; wert: boolean; aendern: (w: boolean) => void; hilfe?: string }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: ZIEL, marginTop: 10 }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hilfe ? <T v="caption" leise>{hilfe}</T> : null}
      </View>
      <Switch accessibilityLabel={label} value={wert} onValueChange={aendern} trackColor={{ true: f.amt, false: f.linie }} thumbColor="#ffffff" />
    </View>
  );
}
