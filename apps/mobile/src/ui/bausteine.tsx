import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, Text as RNText, Switch, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as TEXT } from "../texte";
import { DatumWahl } from "./datumwahl";
import { GROESSE, HAARLINIE, RADIUS, SCHRIFT, TASTATUR_FERTIG, ZIEL, istIos, useFarben, weich, type Farben } from "./thema";

type Variante = "grossTitel" | "titel" | "gross" | "basis" | "klein" | "caption" | "mini";
/** Textstile in Onest (E-142): Titel extrafett und eng gesetzt, Fließtext ruhig. */
const STIL: Record<Variante, TextStyle> = {
  grossTitel: { fontSize: GROESSE.grossTitel, lineHeight: 40, ...SCHRIFT.display, letterSpacing: -1 },
  titel: { fontSize: GROESSE.titel, lineHeight: 34, ...SCHRIFT.display, letterSpacing: -0.7 },
  gross: { fontSize: GROESSE.gross, lineHeight: 26, ...SCHRIFT.bold, letterSpacing: -0.4 },
  basis: { fontSize: GROESSE.basis, lineHeight: 23, ...SCHRIFT.regular, letterSpacing: -0.2 },
  klein: { fontSize: GROESSE.klein, lineHeight: 21, ...SCHRIFT.regular, letterSpacing: -0.1 },
  caption: { fontSize: GROESSE.caption, lineHeight: 18, ...SCHRIFT.regular, letterSpacing: 0 },
  mini: { fontSize: GROESSE.mini, lineHeight: 14, ...SCHRIFT.mittel, letterSpacing: 0.1 },
};
const UEBERSCHRIFT = new Set<Variante>(["grossTitel", "titel", "gross"]);

/** Text mit Markenschrift. `fett` wählt den Halbfett-Schnitt (keine künstliche Fettung). */
export function T({ v = "basis", fett, leise, farbe, stil, children, ...rest }: { v?: Variante; fett?: boolean; leise?: boolean; farbe?: string; stil?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  const f = useFarben();
  return (
    <RNText {...rest} style={[STIL[v], fett && !UEBERSCHRIFT.has(v) ? { ...SCHRIFT.halb } : null, { color: farbe ?? (leise ? f.tinteLeise : f.tinte) }, stil]}>
      {children}
    </RNText>
  );
}

/** Beträge und Ziffern: fett, gleich breite Ziffern – Spalten stehen untereinander. */
export function Betrag({ children, v = "basis", farbe, stil }: { children: ReactNode; v?: Variante; farbe?: string; stil?: StyleProp<TextStyle> }) {
  return (
    <T v={v} farbe={farbe} stil={[{ ...SCHRIFT.bold }, stil]}>
      {children}
    </T>
  );
}

/** SF Symbol auf iOS, sonst Ionicons. Immer dekorativ – der Text daneben trägt die Bedeutung. */
const FALLBACK: Record<string, keyof typeof Ionicons.glyphMap> = {
  "calendar": "calendar-outline", "checklist": "list-outline", "clock": "time-outline", "doc.viewfinder": "camera-outline", "ellipsis.circle": "ellipsis-horizontal-circle-outline",
  "lock.open": "lock-open-outline", "key": "key-outline", "pause.circle": "pause-circle-outline", "checkmark.seal": "ribbon-outline", "number": "keypad-outline", "xmark.icloud": "cloud-offline-outline",
  "checkmark": "checkmark", "chevron.right": "chevron-forward", "bell": "notifications-outline", "person.2": "people-outline", "globe": "globe-outline", "rectangle.portrait.and.arrow.right": "log-out-outline",
  "building.2": "business-outline", "wifi.slash": "cloud-offline-outline", "arrow.triangle.2.circlepath": "sync-outline", "exclamationmark.triangle": "warning-outline", "camera": "camera-outline", "photo.on.rectangle": "images-outline",
  "play.fill": "play", "stop.fill": "stop", "xmark": "close", "arrow.right": "arrow-forward", "sparkles": "sparkles-outline", "info.circle": "information-circle-outline",
  "chevron.left": "chevron-back", "plus": "add", "doc.text": "document-text-outline", "eurosign": "logo-euro", "envelope": "mail-outline", "tray": "file-tray-outline",
  "building.columns": "library-outline", "questionmark.circle": "help-circle-outline", "gearshape": "settings-outline", "megaphone": "megaphone-outline",
  "banknote": "cash-outline", "creditcard": "card-outline", "person.3": "people-circle-outline", "trash": "trash-outline", "square.and.arrow.up": "share-outline",
  "flag": "flag-outline", "graduationcap": "school-outline", "chart.bar": "bar-chart-outline", "magnifyingglass": "search-outline", "briefcase": "briefcase-outline",
  "person.badge.plus": "person-add-outline", "list.bullet": "list-outline", "calendar.badge.clock": "calendar-outline", "checkmark.circle": "checkmark-circle-outline",
  "exclamationmark.circle": "alert-circle-outline", "person": "person-outline", "lock": "lock-closed-outline", "percent": "calculator-outline",
  "folder": "folder-outline", "doc.on.doc": "copy-outline", "printer": "print-outline", "lock.shield": "shield-checkmark-outline", "fork.knife": "restaurant-outline",
  "scissors": "cut-outline", "cross.case": "medkit-outline", "checkmark.square.fill": "checkbox", "square": "square-outline", "chevron.down": "chevron-down", "chevron.up": "chevron-up",
  "doc.richtext": "document-text-outline", "hammer": "hammer-outline", "info.circle.fill": "information-circle", "circle": "ellipse-outline", "arrow.uturn.backward": "arrow-undo-outline", "xmark.circle": "close-circle-outline",
  "person.crop.circle": "person-circle-outline", "eye": "eye-outline", "arrow.left": "arrow-back", "list.number": "list-outline", "checkmark.circle.fill": "checkmark-circle", "person.badge.clock": "person-outline",
  "figure.wave": "body-outline", "storefront": "storefront-outline", "calendar.badge.checkmark": "calendar-outline", "laptopcomputer": "laptop-outline", "exclamationmark.shield": "shield-outline", "cup.and.saucer": "cafe-outline", "sparkle": "sparkles-outline", "arrow.clockwise": "refresh-outline", "pencil": "create-outline", "plus.circle": "add-circle-outline", "paintpalette": "color-palette-outline", "eurosign.circle": "logo-euro", "photo": "image-outline", "lock.fill": "lock-closed", "faceid": "scan-outline", "line.3.horizontal.decrease.circle": "funnel-outline", "icloud": "cloud-outline", "checkmark.seal.fill": "ribbon", "hand.raised": "hand-left-outline", "doc.plaintext": "document-outline", "square.grid.2x2": "grid-outline", "exclamationmark": "alert", "house": "home-outline", "house.fill": "home", "folder.fill": "folder", "building.2.fill": "business",
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

export type Ton = "amt" | "bald" | "frist" | "leise" | "lila" | "gold" | "blau";
export const tonFarben = (f: Farben, ton: Ton) =>
  ton === "bald"
    ? { grund: f.baldHauch, zeichen: f.bald }
    : ton === "frist"
      ? { grund: f.fristHauch, zeichen: f.frist }
      : ton === "leise"
        ? { grund: f.flaeche, zeichen: f.tinteLeise }
        : ton === "lila"
          ? { grund: f.lilaHauch, zeichen: f.lila }
          : ton === "gold"
            ? { grund: f.goldHauch, zeichen: f.gold }
            : ton === "blau"
              ? { grund: f.blauHauch, zeichen: f.blau }
              : { grund: f.amtHauch, zeichen: f.amt };

/** Symbol auf einem getönten, weich abgerundeten Quadrat – vor Listenzeilen und in leeren Zuständen (E-142). */
export function Kachel({ symbol, ton = "amt", groesse = 40 }: { symbol: string; ton?: Ton; groesse?: number }) {
  const f = useFarben();
  const t = tonFarben(f, ton);
  return (
    <View style={{ width: groesse, height: groesse, borderRadius: Math.round(groesse * 0.32), backgroundColor: t.grund, alignItems: "center", justifyContent: "center" }}>
      <Symbol name={symbol} groesse={Math.round(groesse * 0.5)} farbe={t.zeichen} gewicht="semibold" />
    </View>
  );
}

/** Anfangsbuchstaben einer Person im Kreis – in Listen von Mitarbeitern und Kunden. */
export function Initialen({ name, groesse = 34 }: { name: string; groesse?: number }) {
  const f = useFarben();
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const kurz = ((teile[0]?.[0] ?? "") + (teile.length > 1 ? teile.at(-1)![0] : "")).toUpperCase() || "?";
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, borderRadius: groesse / 2, backgroundColor: f.amtHauch, alignItems: "center", justifyContent: "center" }}>
      <T v="caption" farbe={f.amtTief} stil={{ ...SCHRIFT.bold, fontSize: groesse * 0.38, lineHeight: groesse * 0.5, letterSpacing: 0.4 }}>{kurz}</T>
    </View>
  );
}

/** Tage von `heute` bis `termin` (ISO-Daten, ohne Uhrzeit) – negativ, wenn der Termin vorbei ist. */
export function tageBis(termin: string, heute: string): number {
  return Math.round((Date.parse(`${termin}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5);
}

/**
 * Fristblatt (docs/06-design.md): Datum wie auf einem Abreißkalender – Wochentag, großer Tag, Monat. Der Streifen
 * oben trägt den Status (rot überfällig, bernstein bald, grün erledigt). Für VoiceOver verborgen; das Datum steht
 * immer zusätzlich als Text daneben.
 */
export function Fristblatt({ termin, heute, erledigt, groesse = 46 }: { termin: string; heute: string; erledigt?: boolean; groesse?: number }) {
  const f = useFarben();
  const d = new Date(`${termin}T12:00:00Z`);
  const tage = tageBis(termin, heute);
  // getöntes Quadrat mit Tag und Monat – der Ton trägt den Status (rot überfällig, bernstein bald, grün erledigt)
  const t = erledigt ? tonFarben(f, "amt") : tage < 0 ? tonFarben(f, "frist") : tage <= 14 ? tonFarben(f, "bald") : { grund: f.flaeche, zeichen: f.tinte };
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", ...o }).format(d).replace(".", "");
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, borderRadius: Math.round(groesse * 0.32), backgroundColor: t.grund, alignItems: "center", justifyContent: "center" }}>
      <RNText style={{ ...SCHRIFT.display, fontSize: groesse * 0.38, lineHeight: groesse * 0.42, color: t.zeichen, letterSpacing: -0.5 }}>{fmt({ day: "numeric" })}</RNText>
      <RNText style={{ ...SCHRIFT.bold, fontSize: groesse * 0.21, lineHeight: groesse * 0.26, color: t.zeichen, textTransform: "uppercase", letterSpacing: 0.4 }}>{fmt({ month: "short" })}</RNText>
    </View>
  );
}

/** Geschafft: gefüllter grüner Kreis mit Haken – der Moment nach dem Check, nach dem Teilen. */
export function Erfolg({ groesse = 64 }: { groesse?: number }) {
  const f = useFarben();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Symbol name="checkmark.circle.fill" groesse={groesse} farbe={f.amt} gewicht="regular" />
    </View>
  );
}

/**
 * Bildmotiv (E-139): ein Zeichen aus der Welt der Pflichten und Rechnungen (§, €) als große, angeschnittene Grafik auf
 * der Bühne – das wiederkehrende Bildelement statt Illustrationen. Rein dekorativ.
 */
export function Motiv({ zeichen, groesse = 220, farbe, stil }: { zeichen: string; groesse?: number; farbe: string; stil?: StyleProp<TextStyle> }) {
  return (
    <RNText accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[{ position: "absolute", ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.1, color: farbe, letterSpacing: -groesse * 0.04, includeFontPadding: false }, stil]}>
      {zeichen}
    </RNText>
  );
}

/**
 * Der Amtlos-Stempel (wie im App-Symbol): doppelter Ring mit Haken, leicht gedreht – „amtlich erledigt, ohne Amt“.
 * Das eine wiederkehrende Bildzeichen: Einladung, leere Listen, geschaffte Schritte. Rein dekorativ.
 */
export function Stempel({ groesse = 64, farbe, grund }: { groesse?: number; farbe?: string; grund?: string }) {
  const f = useFarben();
  const c = farbe ?? f.amt;
  const ring = Math.max(2, Math.round(groesse * 0.075));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, transform: [{ rotate: "-12deg" }] }}>
      <View style={{ position: "absolute", inset: 0, borderRadius: groesse / 2, borderWidth: ring, borderColor: c, backgroundColor: grund }} />
      <View style={{ position: "absolute", top: groesse * 0.13, left: groesse * 0.13, right: groesse * 0.13, bottom: groesse * 0.13, borderRadius: groesse, borderWidth: Math.max(1, ring / 3.5), borderColor: c, alignItems: "center", justifyContent: "center" }}>
        <Symbol name="checkmark" groesse={Math.round(groesse * 0.4)} farbe={c} gewicht="heavy" />
      </View>
    </View>
  );
}

const tippen = () => {
  if (istIos) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Knöpfe (E-142): der eine Hauptknopf (tiefes Grün, dunkel: Minze), `ton` für Zweitrangiges (ruhige Fläche), `leise`
 * als Umriss, `buehne` als Minze-Knopf auf der Bühne, `glas` als Zweitknopf auf der Bühne. 54 pt hoch, abgerundete
 * Rechtecke, geben beim Drücken leicht nach, Haptik beim Tippen.
 */
export function Knopf({ text, onPress, leise, ton, gefahr, buehne, glas, deaktiviert, laedt, symbol, stil }: { text: string; onPress: () => void; leise?: boolean; ton?: boolean; gefahr?: boolean; buehne?: boolean; glas?: boolean; deaktiviert?: boolean; laedt?: boolean; symbol?: string; stil?: StyleProp<ViewStyle> }) {
  const f = useFarben();
  const haupt = gefahr ? f.frist : f.haupt;
  const grund = buehne ? f.buehneKnopf : glas ? f.buehneFlaeche : ton ? f.flaeche : leise ? "transparent" : haupt;
  const schrift = buehne ? f.buehneKnopfText : glas ? f.buehneText : ton ? (gefahr ? f.frist : f.tinte) : leise ? haupt : gefahr ? "#ffffff" : f.hauptText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: Boolean(deaktiviert || laedt), busy: Boolean(laedt) }}
      disabled={deaktiviert || laedt}
      onPress={() => {
        tippen();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 54,
          paddingHorizontal: 24,
          borderRadius: RADIUS.knopf,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: grund,
          borderWidth: leise ? 1.5 : 0,
          borderColor: haupt,
          opacity: deaktiviert ? 0.4 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed && !deaktiviert ? 0.985 : 1 }],
        },
        stil,
      ]}
    >
      {/* Knöpfe tragen Text – Symbole nur, wo sie eine feste Bedeutung haben (Teilen, Face ID) */}
      {laedt ? <ActivityIndicator color={schrift} /> : symbol && KNOPF_SYMBOLE.has(symbol) ? <Symbol name={symbol} groesse={18} farbe={schrift} gewicht="semibold" /> : null}
      {/* der Text bleibt beim Laden stehen („Wird verschlüsselt …“) */}
      <RNText style={{ ...SCHRIFT.bold, fontSize: GROESSE.basis, letterSpacing: -0.2, color: schrift, textAlign: "center", flexShrink: 1 }}>{text}</RNText>
    </Pressable>
  );
}

/** Schnellzugriff als Kachel: Symbol oben, Beschriftung darunter – zwei nebeneinander. */
export function SchnellKachel({ symbol, text, onPress, ton = "amt" }: { symbol: string; text: string; onPress: () => void; ton?: Ton }) {
  const f = useFarben();
  // getöntes Symbol-Quadrat, darunter das Wort – wie die Kacheln in Finanz-Apps
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 112, padding: 16, borderRadius: RADIUS.karte, backgroundColor: pressed ? f.flaeche : f.blatt, justifyContent: "space-between", gap: 14 })}>
      <Kachel symbol={symbol} ton={ton} groesse={40} />
      <T fett stil={{ letterSpacing: -0.2 }}>{text}</T>
    </Pressable>
  );
}

const KNOPF_SYMBOLE = new Set(["square.and.arrow.up", "faceid", "plus", "doc.viewfinder"]);

/** Handlung als Text (Links, „Entfernen“, „Weitere Angaben“) – ohne Rahmen, 44 pt Tippfläche. */
export function TextKnopf({ text, onPress, symbol, gefahr, leise, buehne, stil, label }: { text: string; onPress: () => void; symbol?: string; gefahr?: boolean; leise?: boolean; buehne?: boolean; stil?: StyleProp<ViewStyle>; label?: string }) {
  const f = useFarben();
  const farbe = buehne ? f.minze : gefahr ? f.frist : leise ? f.tinteLeise : f.amt;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} hitSlop={4} style={({ pressed }) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", opacity: pressed ? 0.55 : 1 }, stil]}>
      {symbol && symbol.startsWith("chevron") ? <Symbol name={symbol} groesse={13} farbe={farbe} gewicht="bold" /> : null}
      <T v="klein" fett farbe={farbe}>{text}</T>
    </Pressable>
  );
}

/** Feste Leiste am unteren Rand eines Ablaufs: der eine Hauptknopf, optional davor ein Zurück. */
export function Fuss({ children, ueber, buehne }: { children: ReactNode; ueber?: ReactNode; buehne?: boolean }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(inset.bottom, 14) + 4, backgroundColor: buehne ? f.buehne : f.papier, gap: 8 }}>
      {ueber}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>{children}</View>
    </View>
  );
}

/** Runder Zurück-Knopf im Fuß eines Ablaufs (neben dem Hauptknopf). */
export function ZurueckKnopf({ onPress, label, buehne }: { onPress: () => void; label: string; buehne?: boolean }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ width: 54, height: 54, borderRadius: RADIUS.knopf, alignItems: "center", justifyContent: "center", backgroundColor: buehne ? f.buehneFlaeche : pressed ? f.linie : f.flaeche, opacity: pressed && buehne ? 0.7 : 1 })}>
      <Symbol name="chevron.left" groesse={19} farbe={buehne ? f.buehneText : f.tinte} gewicht="semibold" />
    </Pressable>
  );
}

/** Runder Knopf oben in Vollbild-Abläufen (Schließen) – ruhige Fläche, klar als Knopf erkennbar. */
export function KopfKnopf({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={({ pressed }) => ({ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: f.blatt, alignItems: "center", justifyContent: "center" }}>
        <Symbol name={symbol} groesse={15} farbe={f.tinte} gewicht="bold" />
      </View>
    </Pressable>
  );
}

/** Zeile mit Kennzahl-Symbol und einem Satz – für Ergebnisse („Für 15 davon gibt es eine Vorlage“). */
export function Fakt({ symbol: _symbol, ton, text, letzte }: { symbol: string; ton?: Ton; text: string; letzte?: boolean }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tonFarben(f, ton ?? "amt").zeichen }} />
      <View style={{ flex: 1, paddingVertical: 12, borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <T v="klein">{text}</T>
      </View>
    </View>
  );
}

function HilfeKnopf({ label, offen, umschalten }: { label: string; offen: boolean; umschalten: () => void }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${TEXT.hilfe_zu} ${label}`} accessibilityState={{ expanded: offen }} onPress={umschalten} hitSlop={12} style={{ padding: 2 }}>
      <Symbol name={offen ? "info.circle.fill" : "info.circle"} groesse={16} farbe={f.amt} />
    </Pressable>
  );
}

/** Beschriftung eines Felds; Hilfe hinter einem (i), damit Formulare ruhig bleiben. */
export function FeldKopf({ label, hilfe, optional }: { label: string; hilfe?: string; optional?: boolean }) {
  const [offen, setOffen] = useState(false);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <T v="klein" fett stil={{ flexShrink: 1 }}>{label}</T>
        {/* freiwillige Angaben kennzeichnen – sonst merkt man erst am Ende, was wirklich fehlt */}
        {optional ? <T v="caption" leise>{TEXT.optional}</T> : null}
        {hilfe ? <HilfeKnopf label={label} offen={offen} umschalten={() => { weich(); setOffen(!offen); }} /> : null}
      </View>
      {hilfe && offen ? <T v="caption" leise stil={{ marginTop: 4, maxWidth: 520 }}>{hilfe}</T> : null}
    </View>
  );
}

/** Kurze Hilfe (passt ins Feld) steht als Platzhalter darin; längere Erklärungen hinter dem (i). */
export const istBeispiel = (hilfe?: string, mehrzeilig?: boolean) => Boolean(hilfe && hilfe.trim().length <= (mehrzeilig ? 80 : 34));

/** Abschnittsüberschrift: Amtlos Serif, wie eine Zwischenüberschrift im Dokument. */
export function Abschnitt({ titel, rechts, children }: { titel?: string; rechts?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 32 }}>
      {titel ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <T v="gross" accessibilityRole="header">{titel}</T>
          {rechts}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Zeile in einer Liste: tippbar, Haarlinie unten (eingerückt ab dem Text, wie in iOS). `symbol` setzt eine getönte
 * Kachel davor, `links` ein eigenes Element (z. B. Status-Kreis).
 */
export function Zeile({ links, symbol, ton, titel, text, wert, marke, rechts, onPress, letzte, gefahr, label }: { links?: ReactNode; symbol?: string; ton?: Ton; titel: string; text?: string; wert?: string; marke?: { text: string; ton: Ton }; rechts?: ReactNode; onPress?: () => void; letzte?: boolean; gefahr?: boolean; label?: string }) {
  const f = useFarben();
  const vorn = symbol ? <Kachel symbol={symbol} ton={ton} /> : links;
  const inhalt = (pressed: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", opacity: pressed ? 0.55 : 1 }}>
      {vorn ? <View style={{ marginRight: 14, minWidth: 24, alignItems: "center" }}>{vorn}</View> : null}
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, minHeight: 58, borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T fett={!gefahr} farbe={gefahr ? f.frist : undefined} numberOfLines={3}>{titel}</T>
          {text ? <T v="klein" leise numberOfLines={2} stil={{ marginTop: 1 }}>{text}</T> : null}
        </View>
        {/* Betrag rechts (Rechnungen, Belege) – das, wonach man in Listen sucht */}
        {wert || marke ? (
          <View style={{ alignItems: "flex-end", gap: 4, marginLeft: 4 }}>
            {wert ? <Betrag>{wert}</Betrag> : null}
            {marke ? <Marke text={marke.text} ton={marke.ton} /> : null}
          </View>
        ) : null}
        {rechts ?? (onPress && !gefahr ? <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" /> : null)}
      </View>
    </View>
  );
  if (!onPress) return inhalt(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => inhalt(pressed)}
    </Pressable>
  );
}

/** Status als kleine Plakette („Bezahlt“, „Überfällig“) – getönt, immer mit Wort. */
export function Marke({ text, ton }: { text: string; ton: Ton }) {
  const f = useFarben();
  const t = tonFarben(f, ton);
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.grund }}>
      <T v="mini" farbe={t.zeichen} stil={{ fontSize: 12, lineHeight: 15 }}>{text}</T>
    </View>
  );
}

/** Hinweis: ruhig, mit Symbol; „fehler“ hat Rolle alert. Farbe nie allein (immer Text). */
export function Hinweis({ text, art = "info", symbol }: { text: string; art?: "info" | "warnung" | "fehler" | "erfolg"; symbol?: string }) {
  const f = useFarben();
  // Orange nur für echte Warnungen – neutrale Hinweise ruhig, sonst wirkt alles wie eine Warnung
  const farbe = art === "fehler" ? f.frist : art === "erfolg" ? f.amt : art === "warnung" ? f.bald : f.tinteLeise;
  const hg = art === "fehler" ? f.fristHauch : art === "erfolg" ? f.amtHauch : art === "warnung" ? f.baldHauch : f.flaeche;
  // Fehler und Erfolge ansagen (VoiceOver kennt keine Live-Regionen)
  useEffect(() => {
    if (art === "fehler" || art === "erfolg") AccessibilityInfo.announceForAccessibility(text);
  }, [art, text]);
  // neutrale Hinweise ohne Kasten (ruhig, wie eine Fußnote); Warnung, Fehler, Erfolg mit Fläche
  const kasten = art !== "info";
  return (
    <View accessibilityRole={art === "fehler" ? "alert" : "text"} accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: kasten ? hg : "transparent", borderRadius: RADIUS.klein, paddingVertical: kasten ? 12 : 4, paddingHorizontal: kasten ? 14 : 0, marginVertical: 6 }}>
      <View style={{ paddingTop: 2 }}>
        <Symbol name={symbol ?? (art === "fehler" ? "exclamationmark.triangle" : art === "erfolg" ? "checkmark.circle" : art === "warnung" ? "exclamationmark.circle" : "info.circle")} groesse={17} farbe={farbe} gewicht="semibold" />
      </View>
      <T v="klein" leise={!kasten} stil={{ flex: 1 }}>{text}</T>
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

// ---------------------------------------------------------------- Formulare (E-120)

/** Karte: helle Fläche mit weichem Schatten (dunkel: Haarlinie), für zusammengehörige Zeilen oder ein Formular. */
/** Liegt ein Element in einer weißen Karte? Felder und Chips wählen danach ihre Füllung (grau in Weiß, weiß auf Grau). */
const KarteKontext = createContext(false);
export const useInKarte = () => useContext(KarteKontext);

export function Karte({ children, stil, rahmen }: { children: ReactNode; stil?: StyleProp<ViewStyle>; rahmen?: string }) {
  const f = useFarben();
  return (
    <KarteKontext.Provider value>
      <View style={[{ backgroundColor: f.blatt, borderRadius: RADIUS.karte, borderWidth: rahmen ? 1.5 : 0, borderColor: rahmen ?? f.linie, paddingHorizontal: 16 }, stil]}>
        {children}
      </View>
    </KarteKontext.Provider>
  );
}

/** Gemeinsamer Stil für Eingabeflächen (Textfeld, Datum, Auswahlzeile): Rahmen ≥ 3:1, im Fokus Amtsgrün. */
/**
 * Eingabefläche wie in iOS: gefüllt, ohne Rahmen (grau in einer Karte, weiß auf grauem Grund); im Fokus und bei
 * Fehlern ein farbiger Rand. Die Beschriftung steht immer sichtbar darüber (E-140).
 */
export function feldRahmen(f: Farben, zustand: { fokus?: boolean; fehler?: boolean; inKarte?: boolean } = {}): ViewStyle {
  return {
    minHeight: 50,
    borderRadius: RADIUS.klein,
    borderWidth: 2,
    borderColor: zustand.fehler ? f.frist : zustand.fokus ? f.amt : "transparent",
    paddingHorizontal: 14,
    backgroundColor: zustand.inKarte ? f.flaeche : f.blatt,
  };
}
// Web-Vorschau: kein Browser-Fokusrahmen (der eigene Rahmen in Amtsgrün zeigt den Fokus)
const feldText = (f: Farben): TextStyle => ({ color: f.tinte, ...SCHRIFT.regular, fontSize: GROESSE.basis, ...(istIos ? null : ({ outlineStyle: "none" } as unknown as TextStyle)) });

/** Beschriftetes Textfeld; die Beschriftung steht darüber und ist mit dem Feld verbunden. */
export function Feld({ label, wert, aendern, hilfe, fehler, mehrzeilig, ohneLabel, optional, onFocus, onBlur, ...rest }: { label: string; wert: string; aendern: (w: string) => void; hilfe?: string; fehler?: string | null; mehrzeilig?: boolean; ohneLabel?: boolean; optional?: boolean } & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText" | "style">) {
  const f = useFarben();
  const inKarte = useInKarte();
  const [fokus, setFokus] = useState(false);
  const beispiel = istBeispiel(hilfe, mehrzeilig) && !rest.placeholder;
  const zahlen = rest.keyboardType === "decimal-pad" || rest.keyboardType === "number-pad" || rest.keyboardType === "numbers-and-punctuation" || rest.keyboardType === "phone-pad";
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={beispiel ? undefined : hilfe} optional={optional} />}
      <TextInput
        placeholder={beispiel ? hilfe : undefined}
        accessibilityLabel={label}
        accessibilityHint={fehler ?? undefined}
        value={wert}
        onChangeText={aendern}
        multiline={mehrzeilig}
        inputAccessoryViewID={zahlen ? TASTATUR_FERTIG : undefined}
        placeholderTextColor={f.tinteLeise}
        selectionColor={f.amt}
        onFocus={(e) => {
          setFokus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFokus(false);
          onBlur?.(e);
        }}
        style={[feldRahmen(f, { fokus, fehler: Boolean(fehler), inKarte }), feldText(f), { minHeight: mehrzeilig ? 104 : 50, paddingTop: mehrzeilig ? 13 : 0, paddingBottom: mehrzeilig ? 13 : 0, textAlignVertical: mehrzeilig ? "top" : "center", marginTop: 7 }]}
        {...rest}
      />
      {fehler ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{fehler}</T> : null}
    </View>
  );
}

/** ISO-Datum ↔ deutsche Schreibweise TT.MM.JJJJ (bzw. englisch DD/MM/YYYY). */
export function isoAus(text: string): string | null {
  const de = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(text);
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(text);
  const [t, mo, j] = de ? [Number(de[1]), Number(de[2]), Number(de[3])] : iso ? [Number(iso[3]), Number(iso[2]), Number(iso[1])] : [0, 0, 0];
  if (!j) return null;
  // nur Tage, die es gibt (kein 31.02.) – zurückgerechnet geprüft
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return null;
  return `${j}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}
export const textAus = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** Datumsfeld ohne zusätzliches Paket: Eingabe als TT.MM.JJJJ, „Heute“ als Abkürzung. Liefert ISO oder null. */
export function DatumFeld({ label, wert, aendern, hilfe, ohneHeute, ohneLabel }: { label: string; wert: string | null; aendern: (iso: string | null) => void; hilfe?: string; ohneHeute?: boolean; ohneLabel?: boolean }) {
  const f = useFarben();
  const heuteText = TEXT.heute;
  const [text, setText] = useState(textAus(wert));
  const [fokus, setFokus] = useState(false);
  const inKarte = useInKarte();
  useEffect(() => setText(textAus(wert)), [wert]);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const falsch = text.trim() !== "" && !isoAus(text);
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 7, alignItems: "center" }}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(w) => {
            setText(w);
            aendern(w.trim() === "" ? null : isoAus(w));
          }}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          placeholder="TT.MM.JJJJ"
          accessibilityHint={falsch ? TEXT.datum_falsch : undefined}
          placeholderTextColor={f.tinteLeise}
          selectionColor={f.amt}
          keyboardType="numbers-and-punctuation"
          inputAccessoryViewID={TASTATUR_FERTIG}
          style={[feldRahmen(f, { fokus, fehler: falsch, inKarte }), feldText(f), { flex: 1, minWidth: 0 }]}
        />
        {ohneHeute ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${heuteText}`} onPress={() => aendern(heute)} style={({ pressed }) => ({ minHeight: 50, paddingHorizontal: 15, borderRadius: RADIUS.klein, justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
            <T v="klein" fett farbe={f.amtTief}>{heuteText}</T>
          </Pressable>
        )}
        <DatumWahl label={label} wert={wert} aendern={aendern} />
      </View>
      {falsch ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{TEXT.datum_falsch}</T> : null}
    </View>
  );
}

/** Chip für Auswahl und Mehrfachauswahl: rund, gewählt in Amtsgrün mit Häkchen (Farbe nie allein). */
function Chip({ text, an, rolle, onPress, kaestchen }: { text: string; an: boolean; rolle: "radio" | "checkbox"; onPress: () => void; kaestchen?: boolean }) {
  const f = useFarben();
  const inKarte = useInKarte();
  return (
    <Pressable
      accessibilityRole={rolle}
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={text}
      hitSlop={4}
      onPress={() => {
        if (istIos) void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 40, paddingLeft: kaestchen ? 11 : 16, paddingRight: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: an ? f.haupt : pressed ? f.linie : inKarte ? f.flaeche : f.blatt, flexShrink: 1 })}
    >
      {kaestchen ? <Symbol name={an ? "checkmark.square.fill" : "square"} groesse={16} farbe={an ? f.hauptText : f.tinteLeise} /> : null}
      <T v="klein" fett farbe={an ? f.hauptText : f.tinte} stil={{ flexShrink: 1 }}>{text}</T>
    </Pressable>
  );
}

/** Auswahl als Chips (wenige Optionen) – Radio-Semantik für VoiceOver. */
export function Wahl<W extends string>({ label, wert, aendern, optionen, hilfe }: { label?: string; wert: W | null; aendern: (w: W) => void; optionen: { wert: W; text: string }[]; hilfe?: string }) {
  return (
    <View style={{ marginTop: label ? 20 : 0 }}>
      {label ? <FeldKopf label={label} hilfe={hilfe} /> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: label ? 9 : 0 }}>
        {optionen.map((o) => (
          <Chip key={o.wert} text={o.text} an={o.wert === wert} rolle="radio" onPress={() => aendern(o.wert)} />
        ))}
      </View>
    </View>
  );
}

/** Schalter mit Beschriftung (iOS-Switch in Handlungsfarbe). */
export function Schalter({ label, wert, aendern, hilfe }: { label: string; wert: boolean; aendern: (w: boolean) => void; hilfe?: string }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: ZIEL + 4, marginTop: 14 }}>
      <View style={{ flex: 1 }}>
        <SchalterText label={label} hilfe={hilfe} />
      </View>
      <Switch accessibilityLabel={label} value={wert} onValueChange={aendern} trackColor={{ true: f.haupt, false: f.linie }} thumbColor="#ffffff" ios_backgroundColor={f.linie} />
    </View>
  );
}

function SchalterText({ label, hilfe }: { label: string; hilfe?: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <T stil={{ flexShrink: 1 }}>{label}</T>
        {hilfe ? <HilfeKnopf label={label} offen={offen} umschalten={() => { weich(); setOffen(!offen); }} /> : null}
      </View>
      {hilfe && offen ? <T v="caption" leise stil={{ marginTop: 4 }}>{hilfe}</T> : null}
    </View>
  );
}

/** Rahmen einer Liste zum Auswählen (Auswahl, Bausteine): eine Fläche, Zeilen mit Haarlinie. */
function ListenRahmen({ label, rolle, children }: { label: string; rolle?: "radiogroup"; children: ReactNode }) {
  const f = useFarben();
  const inKarte = useInKarte();
  return (
    <View accessibilityRole={rolle} accessibilityLabel={label} style={{ marginTop: 7, borderRadius: RADIUS.klein, overflow: "hidden", backgroundColor: inKarte ? f.flaeche : f.blatt }}>
      {children}
    </View>
  );
}

/**
 * Große Antwortkarte (Fragen im Pflichten-Check): eine Karte je Möglichkeit, gewählt mit grünem Rahmen und
 * Radiokreis bzw. Kästchen – wie in den besten Frage-Antwort-Apps, mit großen Tippflächen.
 */
function AntwortKarte({ text, an, rolle, onPress }: { text: string; an: boolean; rolle: "radio" | "checkbox"; onPress: () => void }) {
  const f = useFarben();
  return (
    <Pressable
      accessibilityRole={rolle}
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={text}
      onPress={() => {
        if (istIos) void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 18, borderWidth: 2, borderColor: an ? f.amt : "transparent", backgroundColor: an ? f.amtHauch : pressed ? f.flaeche : f.blatt })}
    >
      {rolle === "radio" ? (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: an ? 7 : 2, borderColor: an ? f.amt : f.rahmen, backgroundColor: f.papier }} />
      ) : (
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: an ? 0 : 2, borderColor: f.rahmen, backgroundColor: an ? f.amt : f.papier, alignItems: "center", justifyContent: "center" }}>
          {an ? <Symbol name="checkmark" groesse={14} farbe={f.amtText} gewicht="bold" /> : null}
        </View>
      )}
      <T fett={an} stil={{ flex: 1 }}>{text}</T>
    </Pressable>
  );
}

/** Auswahl als Liste untereinander – für lange oder viele Optionen (Radio-Semantik). `gross`: Antwortkarten. */
export function Auswahl<W extends string>({ label, wert, aendern, optionen, hilfe, ohneLabel, gross }: { label: string; wert: W | null; aendern: (w: W) => void; optionen: { wert: W; text: string }[]; hilfe?: string; ohneLabel?: boolean; gross?: boolean }) {
  const f = useFarben();
  if (gross)
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 10, marginTop: ohneLabel ? 8 : 20 }}>
        {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
        {optionen.map((o) => (
          <AntwortKarte key={o.wert} text={o.text} an={o.wert === wert} rolle="radio" onPress={() => aendern(o.wert)} />
        ))}
      </View>
    );
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
      <ListenRahmen label={label} rolle="radiogroup">
        {optionen.map((o, i) => {
          const an = o.wert === wert;
          return (
            <Pressable
              key={o.wert}
              accessibilityRole="radio"
              accessibilityState={{ checked: an }}
              aria-checked={an}
              onPress={() => {
                if (istIos) void Haptics.selectionAsync();
                aendern(o.wert);
              }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie, backgroundColor: an ? f.amtHauch : pressed ? f.linieLeise : "transparent" })}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: an ? 6 : 1.5, borderColor: an ? f.amt : f.rahmen, backgroundColor: f.blatt }} />
              <T v="klein" fett={an} farbe={an ? f.amtTief : f.tinte} stil={{ flex: 1 }}>{o.text}</T>
            </Pressable>
          );
        })}
      </ListenRahmen>
    </View>
  );
}

/** Mehrfachauswahl als Chips mit Kästchen (Checkbox-Semantik), z. B. Allergene. */
export function MehrfachWahl({ label, werte, aendern, optionen, hilfe, ohneLabel, gross }: { label: string; werte: string[]; aendern: (w: string[]) => void; optionen: { wert: string; text: string }[]; hilfe?: string; ohneLabel?: boolean; gross?: boolean }) {
  if (gross)
    return (
      <View accessibilityLabel={label} style={{ gap: 10, marginTop: ohneLabel ? 8 : 20 }}>
        {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
        {optionen.map((o) => {
          const an = werte.includes(o.wert);
          return <AntwortKarte key={o.wert} text={o.text} an={an} rolle="checkbox" onPress={() => aendern(an ? werte.filter((x) => x !== o.wert) : [...werte, o.wert])} />;
        })}
      </View>
    );
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
      <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
        {optionen.map((o) => {
          const an = werte.includes(o.wert);
          return <Chip key={o.wert} text={o.text} an={an} rolle="checkbox" kaestchen onPress={() => aendern(an ? werte.filter((x) => x !== o.wert) : [...werte, o.wert])} />;
        })}
      </View>
    </View>
  );
}

/** Uhrzeit als HH:MM. */
export function UhrzeitFeld({ label, wert, aendern, hilfe }: { label: string; wert: string; aendern: (w: string) => void; hilfe?: string }) {
  const falsch = wert.trim() !== "" && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(wert.trim());
  return <Feld label={label} hilfe={hilfe === "HH:MM" ? undefined : hilfe} wert={wert} aendern={aendern} placeholder="HH:MM" keyboardType="numbers-and-punctuation" fehler={falsch ? TEXT.uhrzeit_falsch : null} />;
}

/** Textbausteine zum Ankreuzen – untereinander, mit Quelle (Checkbox-Semantik). */
export function BausteinListe({ label, hilfe, werte, aendern, optionen }: { label: string; hilfe?: string; werte: string[]; aendern: (w: string[]) => void; optionen: { wert: string; text: string; quelle?: string }[] }) {
  const f = useFarben();
  return (
    <View style={{ marginTop: 20 }}>
      <FeldKopf label={label} hilfe={hilfe} />
      <ListenRahmen label={label}>
        {optionen.map((o, i) => {
          const an = werte.includes(o.wert);
          return (
            <Pressable
              key={o.wert}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: an }}
              aria-checked={an}
              accessibilityLabel={o.text}
              onPress={() => {
                if (istIos) void Haptics.selectionAsync();
                aendern(an ? werte.filter((x) => x !== o.wert) : [...werte, o.wert]);
              }}
              style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie, backgroundColor: an ? f.amtHauch : pressed ? f.linieLeise : "transparent" })}
            >
              <View style={{ paddingTop: 1 }}>
                <Symbol name={an ? "checkmark.square.fill" : "square"} groesse={19} farbe={an ? f.amt : f.rahmen} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="klein">{o.text}</T>
                {o.quelle ? <T v="caption" leise stil={{ marginTop: 3 }}>{o.quelle}</T> : null}
              </View>
            </Pressable>
          );
        })}
      </ListenRahmen>
    </View>
  );
}

/** Suchfeld für Listen (Unterlagen, Kunden, Auswahl): gefüllte Fläche wie in iOS. */
export function Suchfeld({ wert, setzen, label = TEXT.suchen, buehne }: { wert: string; setzen: (w: string) => void; label?: string; buehne?: boolean }) {
  const f = useFarben();
  const [fokus, setFokus] = useState(false);
  // auf der Bühne: Glasfläche, weiße Schrift, Fokus in Minze
  const leise = buehne ? f.buehneLeise : f.tinteLeise;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 46, borderRadius: RADIUS.klein, backgroundColor: buehne ? f.buehneFlaeche : f.flaeche, borderWidth: 2, borderColor: fokus ? (buehne ? f.minze : f.amt) : "transparent" }}>
      <Symbol name="magnifyingglass" groesse={17} farbe={leise} gewicht="semibold" />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={leise}
        selectionColor={buehne ? f.minze : f.amt}
        value={wert}
        onChangeText={setzen}
        onFocus={() => setFokus(true)}
        onBlur={() => setFokus(false)}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[feldText(f), { flex: 1, minHeight: 40 }, buehne ? { color: f.buehneText } : null]}
      />
    </View>
  );
}
