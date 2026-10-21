import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { NavigationContext } from "@react-navigation/native";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, Text as RNText, ScrollView, Switch, TextInput, View, useColorScheme, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as TEXT } from "../texte";
import { datumLesen, isoAus, nurJahr, uhrzeitLesen } from "./datum";
import { schuetzen, trennen } from "./trennen";
import { mehrfachUmschalten } from "./mehrfach";
import { DatumWahl } from "./datumwahl";
import { FussKontext } from "./fussHoehe";
import { GROESSE, HAARLINIE, RADIUS, RAND, SCHRIFT, TASTATUR_FERTIG, ZIEL, istIos, useFarben, useWenigBewegung, weich, type Farben } from "./thema";

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

/** Große Schrift (Dynamic Type über 130 %): Zeilen nicht mehr kürzen, Reihen untereinander statt nebeneinander. */
export const GROSSE_SCHRIFT_AB = 1.3;
export function useGrosseSchrift(): boolean {
  return useWindowDimensions().fontScale > GROSSE_SCHRIFT_AB;
}

/**
 * Text mit Markenschrift. `fett` wählt den Halbfett-Schnitt (keine künstliche Fettung). Bei großer Schrift oder auf sehr
 * schmalen Geräten bekommen lange Wörter weiche Trennstellen (R10) – sonst brächen „Sozialversicherungsbeiträge“ oder
 * „Temperaturkontrolle“ in Kacheln, Listen und Vorschlägen mitten im Wort ohne Strich.
 */
export function T({ v = "basis", fett, leise, farbe, stil, children, ...rest }: { v?: Variante; fett?: boolean; leise?: boolean; farbe?: string; stil?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  const f = useFarben();
  const { fontScale, width } = useWindowDimensions();
  // R12 (UX #18): Überschriften immer mit Trennstellen – „Kleinunternehmerregelung?“ passte bei 393 pt nicht in die Zeile
  const eng = fontScale > GROSSE_SCHRIFT_AB || width < 360 || UEBERSCHRIFT.has(v);
  return (
    <RNText {...rest} style={[STIL[v], fett && !UEBERSCHRIFT.has(v) ? { ...SCHRIFT.halb } : null, { color: farbe ?? (leise ? f.tinteLeise : f.tinte) }, stil]}>
      {typeof children === "string" ? schuetzen(eng ? trennen(children) : children) : children}
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
  "person.crop.circle": "person-circle-outline", "eye": "eye-outline", "eye.slash": "eye-off-outline", "arrow.left": "arrow-back", "list.number": "list-outline", "checkmark.circle.fill": "checkmark-circle", "person.badge.clock": "person-outline",
  "figure.wave": "body-outline", "storefront": "storefront-outline", "calendar.badge.checkmark": "calendar-outline", "laptopcomputer": "laptop-outline", "exclamationmark.shield": "shield-outline", "cup.and.saucer": "cafe-outline", "sparkle": "sparkles-outline", "arrow.clockwise": "refresh-outline", "pencil": "create-outline", "plus.circle": "add-circle-outline", "paintpalette": "color-palette-outline", "eurosign.circle": "logo-euro", "photo": "image-outline", "lock.fill": "lock-closed", "faceid": "scan-outline", "line.3.horizontal.decrease.circle": "funnel-outline", "icloud": "cloud-outline", "checkmark.seal.fill": "ribbon", "hand.raised": "hand-left-outline", "doc.plaintext": "document-outline", "square.grid.2x2": "grid-outline", "exclamationmark": "alert", "house": "home-outline", "house.fill": "home", "folder.fill": "folder", "building.2.fill": "business", "giftcard": "gift-outline", "rosette": "ribbon-outline",
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

/** Töne für Kacheln und Plaketten. Auf den Seiten nur Grün, Grau und Bernstein (Rot für Überfälliges) – Lila, Gold und Blau sind veraltet. */
export type Ton = "amt" | "bald" | "frist" | "leise" | "lila" | "gold" | "blau";
export const tonFarben = (f: Farben, ton: Ton) =>
  ton === "bald"
    ? { grund: f.baldScheibe, zeichen: f.bald }
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
    <View style={{ width: groesse, height: groesse, borderRadius: groesse <= 56 ? RADIUS.klein : RADIUS.karte, backgroundColor: t.grund, alignItems: "center", justifyContent: "center" }}>
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
      <T v="caption" allowFontScaling={false} farbe={f.amtTief} stil={{ ...SCHRIFT.bold, fontSize: groesse * 0.38, lineHeight: groesse * 0.5, letterSpacing: 0.4 }}>{kurz}</T>
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
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, borderRadius: RADIUS.klein, backgroundColor: t.grund, alignItems: "center", justifyContent: "center" }}>
      <RNText allowFontScaling={false} style={{ ...SCHRIFT.display, fontSize: groesse * 0.38, lineHeight: groesse * 0.42, color: t.zeichen, letterSpacing: -0.5 }}>{fmt({ day: "numeric" })}</RNText>
      <RNText allowFontScaling={false} style={{ ...SCHRIFT.bold, fontSize: groesse * 0.21, lineHeight: groesse * 0.26, color: t.zeichen, textTransform: "uppercase", letterSpacing: 0.4 }}>{fmt({ month: "short" })}</RNText>
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
export function Stempel({ groesse = 64, farbe, grund, text, unter }: { groesse?: number; farbe?: string; grund?: string; text?: string; unter?: string }) {
  const f = useFarben();
  const c = farbe ?? f.amt;
  const ring = Math.max(2, Math.round(groesse * 0.075));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, transform: [{ rotate: "-12deg" }] }}>
      <View style={{ position: "absolute", inset: 0, borderRadius: groesse / 2, borderWidth: ring, borderColor: c, backgroundColor: grund }} />
      <View style={{ position: "absolute", top: groesse * 0.13, left: groesse * 0.13, right: groesse * 0.13, bottom: groesse * 0.13, borderRadius: groesse, borderWidth: Math.max(1, ring / 3.5), borderColor: c, alignItems: "center", justifyContent: "center" }}>
        {text ? (
          // Wort-Stempel („GETEILT“, „BEZAHLT“) mit Datum darunter – wie ein Eingangsstempel auf Papier
          <>
            <RNText allowFontScaling={false} style={{ ...SCHRIFT.display, color: c, fontSize: groesse * 0.135, lineHeight: groesse * 0.17, letterSpacing: groesse * 0.006 }}>{text.toUpperCase()}</RNText>
            {unter ? <RNText allowFontScaling={false} style={{ ...SCHRIFT.bold, color: c, fontSize: groesse * 0.1, lineHeight: groesse * 0.13, marginTop: groesse * 0.02 }}>{unter}</RNText> : null}
          </>
        ) : (
          <Symbol name="checkmark" groesse={Math.round(groesse * 0.4)} farbe={c} gewicht="heavy" />
        )}
      </View>
    </View>
  );
}

/**
 * Auftritt eines Stempels (B1): fällt mit einer Feder auf das Papier (~280 ms) und gibt eine Erfolgs-Haptik –
 * nur wenn `jetzt` (gerade eben geteilt bzw. bezahlt); mit „Bewegung reduzieren“ steht er einfach da.
 */
export function StempelAuftritt({ jetzt, children, stil }: { jetzt: boolean; children: ReactNode; stil?: StyleProp<ViewStyle> }) {
  const wenig = useWenigBewegung();
  const los = useRef(new Animated.Value(jetzt ? 0 : 1)).current;
  useEffect(() => {
    if (!jetzt) return;
    if (istIos) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (wenig) {
      los.setValue(1);
      return;
    }
    los.setValue(0);
    Animated.spring(los, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 260, mass: 0.7 }).start();
  }, [jetzt, wenig, los]);
  const scale = los.interpolate({ inputRange: [0, 1], outputRange: [1.7, 1] });
  return (
    <Animated.View pointerEvents="none" style={[{ opacity: los.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }), transform: [{ scale }] }, stil]}>
      {children}
    </Animated.View>
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
  const dunkel = useColorScheme() === "dark";
  const haupt = gefahr ? f.frist : f.haupt;
  const grund = buehne ? f.buehneKnopf : glas ? f.buehneFlaeche : ton ? f.flaeche : leise ? "transparent" : haupt;
  const schrift = buehne ? f.buehneKnopfText : glas ? f.buehneText : ton ? (gefahr ? f.frist : f.tinte) : leise ? haupt : gefahr ? (dunkel ? f.papier : "#ffffff") : f.hauptText;
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
/** `erweitert`: der Knopf klappt etwas auf oder zu (Liste zeigen) – VoiceOver sagt „erweitert“ bzw. „reduziert“. */
export function TextKnopf({ text, onPress, symbol, gefahr, leise, buehne, stil, label, erweitert }: { text: string; onPress: () => void; symbol?: string; gefahr?: boolean; leise?: boolean; buehne?: boolean; stil?: StyleProp<ViewStyle>; label?: string; erweitert?: boolean }) {
  const f = useFarben();
  const farbe = buehne ? f.minze : gefahr ? f.frist : leise ? f.tinteLeise : f.amt;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} accessibilityState={erweitert === undefined ? undefined : { expanded: erweitert }} aria-expanded={erweitert} onPress={onPress} hitSlop={4} style={({ pressed }) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", opacity: pressed ? 0.55 : 1 }, stil]}>
      {symbol && symbol.startsWith("chevron") ? <Symbol name={symbol} groesse={13} farbe={farbe} gewicht="bold" /> : null}
      <T v="klein" fett farbe={farbe}>{text}</T>
    </Pressable>
  );
}

/** Feste Leiste am unteren Rand eines Ablaufs: der eine Hauptknopf, optional davor ein Zurück. */
export function Fuss({ children, ueber, buehne }: { children: ReactNode; ueber?: ReactNode; buehne?: boolean }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const grund = buehne ? f.buehne : f.papier;
  // Höhe melden, solange die Seite im Fokus ist – Meldungen erscheinen dann über der Leiste (A4)
  const melden = useContext(FussKontext);
  const nav = useContext(NavigationContext);
  const id = useId();
  const [hoehe, setHoehe] = useState(0);
  const [fokus, setFokus] = useState(() => nav?.isFocused() ?? true);
  useEffect(() => {
    if (!nav) return;
    setFokus(nav.isFocused());
    const an = nav.addListener("focus", () => setFokus(true));
    const aus = nav.addListener("blur", () => setFokus(false));
    return () => {
      an();
      aus();
    };
  }, [nav]);
  useEffect(() => {
    melden?.(id, fokus && hoehe ? hoehe : null);
    return () => melden?.(id, null);
  }, [melden, id, fokus, hoehe]);
  return (
    <View onLayout={(e) => setHoehe(Math.round(e.nativeEvent.layout.height))} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(inset.bottom, 14) + 4, backgroundColor: grund, gap: 8 }}>
      {/* weicher Übergang statt harter Kante: der Inhalt läuft unter der Leiste aus (A5) */}
      <Verlauf farbe={grund} />
      {ueber}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>{children}</View>
    </View>
  );
}

/** 24 pt Verlauf von durchsichtig zur Grundfarbe, über dem oberen Rand des Elternelements; fängt keine Berührungen. */
function Verlauf({ farbe, hoehe = 24 }: { farbe: string; hoehe?: number }) {
  const n = 12;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: "absolute", left: 0, right: 0, top: -hoehe, height: hoehe }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ height: hoehe / n, backgroundColor: farbe, opacity: Math.pow((i + 1) / n, 1.6) }} />
      ))}
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

/**
 * Das eine Kästchen (A6): 22 pt, Ecken 6, gewählt gefüllt in Amtsgrün mit Haken (13 pt). `invers`: auf gefüllter
 * dunkler Fläche (gewählter Chip) – dann weiß mit grünem Haken. Rein dekorativ; Zustand trägt das Element darum.
 */
export function Kaestchen({ an, invers, groesse = 22 }: { an: boolean; invers?: boolean; groesse?: number }) {
  const f = useFarben();
  const voll = invers ? f.hauptText : f.amt;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: groesse, height: groesse, borderRadius: 6, borderWidth: an ? 0 : 2, borderColor: invers ? f.hauptText : f.rahmen, backgroundColor: an ? voll : "transparent", alignItems: "center", justifyContent: "center" }}>
      {an ? <Symbol name="checkmark" groesse={13} farbe={invers ? f.haupt : f.amtText} gewicht="heavy" /> : null}
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
export function Zeile({ links, symbol, ton, titel, text, wert, marke, rechts, onPress, letzte, gefahr, label, link }: { links?: ReactNode; symbol?: string; ton?: Ton; titel: string; text?: string; wert?: string; marke?: { text: string; ton: Ton }; rechts?: ReactNode; onPress?: () => void; letzte?: boolean; gefahr?: boolean; label?: string; /** R11 (UX #18): öffnet eine Website – VoiceOver sagt „Link“ und dass man die App verlässt */ link?: boolean }) {
  const f = useFarben();
  // große Schrift: nichts abschneiden – die Zeile wird dann eben höher
  const gross = useGrosseSchrift();
  const schmal = useWindowDimensions().width < 360;
  // große Schrift oder sehr schmal (320 pt): der Betrag rückt unter Titel und Text – nebeneinander blieben für den
  // Titel nur ein paar Zeichen, Wörter und Daten brächen mitten im Wort („Kim / Beis / piel“, M4, G2)
  const betragUnten = Boolean(wert) && (gross || schmal);
  const vorn = symbol ? <Kachel symbol={symbol} ton={ton} /> : links;
  const inhalt = (pressed: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", opacity: pressed ? 0.55 : 1 }}>
      {vorn ? <View style={{ marginRight: 14, minWidth: 24, alignItems: "center" }}>{vorn}</View> : null}
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, minHeight: 58, borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Absatz immer links nach rechts (G3) – ein Kundenname in arabischer Schrift ordnet sonst die ganze Zeile um */}
          <T fett={!gefahr} farbe={gefahr ? f.frist : undefined} numberOfLines={gross ? undefined : 3} stil={{ writingDirection: "ltr" }}>{trennen(titel)}</T>
          {text ? <T v="klein" leise numberOfLines={gross ? undefined : 2} stil={{ marginTop: 1, writingDirection: "ltr" }}>{text}</T> : null}
          {/* Status als Plakette unter dem Titel (A15) – rechts bleibt Platz für den Betrag */}
          {marke ? <View style={{ flexDirection: "row", marginTop: 5 }}><Marke text={marke.text} ton={marke.ton} /></View> : null}
          {betragUnten ? <View style={{ flexDirection: "row", marginTop: 6 }}><Betrag>{wert}</Betrag></View> : null}
        </View>
        {/* Betrag rechts (Rechnungen, Belege) – das, wonach man in Listen sucht */}
        {wert && !betragUnten ? (
          <View style={{ alignItems: "flex-end", marginLeft: 4 }}>
            <Betrag>{wert}</Betrag>
          </View>
        ) : null}
        {rechts ?? (onPress && !gefahr ? <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" /> : null)}
      </View>
    </View>
  );
  if (!onPress) return inhalt(false);
  return (
    <Pressable accessibilityRole={link ? "link" : "button"} accessibilityLabel={label} accessibilityHint={link ? TEXT.r11_oeffnet_website : undefined} onPress={onPress}>
      {({ pressed }) => inhalt(pressed)}
    </Pressable>
  );
}

/** Status als kleine Plakette („Bezahlt“, „Überfällig“) – getönt, immer mit Wort. */
export function Marke({ text, ton }: { text: string; ton: Ton }) {
  const f = useFarben();
  const t = tonFarben(f, ton);
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.pille, backgroundColor: t.grund }}>
      {/* Grün auf Grünhauch: das tiefe Grün, sonst reicht der Kontrast für 12 pt nicht */}
      <T v="mini" farbe={ton === "amt" ? f.amtTief : t.zeichen} stil={{ fontSize: 12, lineHeight: 15 }}>{text}</T>
    </View>
  );
}

/** Hinweis: ruhig, mit Symbol; „fehler“ hat Rolle alert. Farbe nie allein (immer Text). */
export function Hinweis({ text, art = "info", symbol }: { text: string; art?: "info" | "warnung" | "fehler" | "erfolg"; symbol?: string }) {
  const f = useFarben();
  // Orange nur für echte Warnungen – neutrale Hinweise ruhig, sonst wirkt alles wie eine Warnung
  const farbe = art === "fehler" ? f.frist : art === "erfolg" ? f.amt : art === "warnung" ? f.bald : f.tinteLeise;
  const hg = art === "fehler" ? f.fristHauch : art === "erfolg" ? f.amtHauch : art === "warnung" ? f.baldHauch : f.flaeche;
  // Fehler immer ansagen (VoiceOver kennt keine Live-Regionen); Erfolg und Info nur, wenn sie sich nach dem ersten
  // Zeichnen ändern – sonst sagt jede Seite beim Öffnen ihre stehenden Hinweise an
  const gezeichnet = useRef(false);
  useEffect(() => {
    if (art === "fehler" || (gezeichnet.current && art !== "warnung")) AccessibilityInfo.announceForAccessibility(text);
    gezeichnet.current = true;
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
    // R11 (UX #17): ohne Fokus ein feiner Rand in `linie` – die Füllung allein hob sich kaum ab; Fokus und Fehler 2 pt
    // (der Innenabstand gleicht den breiteren Rand aus, nichts springt)
    borderWidth: zustand.fehler || zustand.fokus ? 2 : 1,
    borderColor: zustand.fehler ? f.frist : zustand.fokus ? f.amt : f.linie,
    paddingHorizontal: zustand.fehler || zustand.fokus ? 14 : 15,
    // überall dieselbe gefüllte graue Fläche mit Fokusrahmen (A7) – auf dem Blatt wie in Karten klar abgegrenzt
    backgroundColor: f.flaeche,
  };
}
// Web-Vorschau: kein Browser-Fokusrahmen (der eigene Rahmen in Amtsgrün zeigt den Fokus)
const feldText = (f: Farben): TextStyle => ({ color: f.tinte, ...SCHRIFT.regular, fontSize: GROESSE.basis, ...(istIos ? null : ({ outlineStyle: "none" } as unknown as TextStyle)) });

/** Beschriftetes Textfeld; die Beschriftung steht darüber und ist mit dem Feld verbunden. */
export function Feld({ label, wert, aendern, hilfe, fehler, mehrzeilig, ohneLabel, optional, ohneFehlerText, onFocus, onBlur, ...rest }: { label: string; wert: string; aendern: (w: string) => void; hilfe?: string; fehler?: string | null; mehrzeilig?: boolean; ohneLabel?: boolean; optional?: boolean; /** Fehler nur am Rahmen (und für VoiceOver) – der Text steht dann außerhalb, z. B. unter einer Feldreihe */ ohneFehlerText?: boolean } & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText" | "style">) {
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
      {fehler && !ohneFehlerText ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{fehler}</T> : null}
    </View>
  );
}

/**
 * Passwortfeld mit Auge (zeigen/verbergen). `hinweis` steht ruhig darunter (z. B. „Mindestens 10 Zeichen“), `fehler`
 * rot – die Seite entscheidet, wann aus dem Hinweis ein Fehler wird (erst nach Verlassen des Felds oder beim Absenden).
 */
export function PasswortFeld({ label, wert, aendern, hinweis, fehler, neu, onBlur, onSubmitEditing }: { label: string; wert: string; aendern: (w: string) => void; hinweis?: string | null; fehler?: string | null; neu?: boolean; onBlur?: () => void; onSubmitEditing?: () => void }) {
  const f = useFarben();
  const inKarte = useInKarte();
  const [fokus, setFokus] = useState(false);
  const [zeigen, setZeigen] = useState(false);
  return (
    <View style={{ marginTop: 20 }}>
      <FeldKopf label={label} />
      <View style={[feldRahmen(f, { fokus, fehler: Boolean(fehler), inKarte }), { flexDirection: "row", alignItems: "center", marginTop: 7, paddingRight: 0 }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={fehler ?? hinweis ?? undefined}
          value={wert}
          onChangeText={aendern}
          secureTextEntry={!zeigen}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={neu ? "newPassword" : "password"}
          selectionColor={f.amt}
          onFocus={() => setFokus(true)}
          onBlur={() => {
            setFokus(false);
            onBlur?.();
          }}
          onSubmitEditing={onSubmitEditing}
          style={[feldText(f), { flex: 1, minHeight: 46 }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={zeigen ? TEXT.passwort_verbergen : TEXT.passwort_zeigen} onPress={() => setZeigen(!zeigen)} hitSlop={4} style={({ pressed }) => ({ width: ZIEL, minHeight: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.55 : 1 })}>
          <Symbol name={zeigen ? "eye.slash" : "eye"} groesse={19} farbe={f.tinteLeise} />
        </Pressable>
      </View>
      {fehler ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{fehler}</T> : hinweis ? <T v="caption" leise stil={{ marginTop: 5 }}>{hinweis}</T> : null}
    </View>
  );
}

/** ISO-Datum ↔ deutsche Schreibweise TT.MM.JJJJ (bzw. englisch DD/MM/YYYY, kurz „5.3.26“) – siehe ./datum. */
export { isoAus };
export const textAus = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/**
 * Datumsfeld ohne zusätzliches Paket: Eingabe als TT.MM.JJJJ, „Heute“ als Abkürzung. Liefert ISO oder null.
 * Der Text bleibt beim Tippen stehen, auch wenn er (noch) kein Datum ist (H2) – nur ein Wert von außen („Heute“,
 * Kalender, anderer Stand) ersetzt ihn. Beim Verlassen wird ein gültiges Datum einheitlich geschrieben („5.3.26“ →
 * „05.03.2026“).
 */
export function DatumFeld({ label, wert, aendern, hilfe, ohneHeute, ohneLabel, jahrReicht: jahrGesetzt }: { label: string; wert: string | null; aendern: (iso: string | null) => void; hilfe?: string; ohneHeute?: boolean; ohneLabel?: boolean; /** nur das Jahr genügt („2014“ → 01.01.2014), z. B. „seit wann“ */ jahrReicht?: boolean }) {
  const f = useFarben();
  // Frage im Pflichten-Check (ohne Beschriftung: „Wann hast du angefangen?“): das Jahr allein genügt (R10, Sabine #12)
  const jahrReicht = jahrGesetzt ?? Boolean(ohneLabel);
  const heuteText = TEXT.heute;
  const [text, setText] = useState(textAus(wert));
  const [fokus, setFokus] = useState(false);
  const inKarte = useInKarte();
  // zuletzt aus diesem Feld gemeldeter Wert: kommt er als `wert` zurück, bleibt der getippte Text stehen
  const gemeldet = useRef<string | null>(wert);
  useEffect(() => {
    if (wert === gemeldet.current) return;
    gemeldet.current = wert;
    setText(textAus(wert));
  }, [wert]);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const gelesen = datumLesen(text, { jahrReicht });
  const leer = text.trim() === "";
  // ein unmöglicher Tag sofort, ein unvollständiges Format erst nach dem Verlassen – beim Tippen ist „20.10.20“ normal;
  // nur ein Jahr („2014“) ohne `jahrReicht`: nach dem ganzen Datum fragen statt stumm nichts zu übernehmen (R10)
  const fehlerText = leer ? null : gelesen.fehler === "tag" ? TEXT.datum_gibt_es_nicht : gelesen.fehler === "format" && !fokus ? (nurJahr(text) ? TEXT.datum_nur_jahr(text.trim()) : TEXT.datum_falsch) : null;
  const hinweisText = !leer && gelesen.iso && gelesen.unplausibel ? TEXT.datum_unplausibel(gelesen.iso.slice(0, 4)) : null;
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 7, alignItems: "center" }}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(w) => {
            setText(w);
            const iso = w.trim() === "" ? null : datumLesen(w, { jahrReicht }).iso;
            gemeldet.current = iso;
            aendern(iso);
          }}
          onFocus={() => setFokus(true)}
          onBlur={() => {
            setFokus(false);
            if (gelesen.iso) setText(textAus(gelesen.iso));
          }}
          placeholder="TT.MM.JJJJ"
          accessibilityHint={fehlerText ?? hinweisText ?? undefined}
          placeholderTextColor={f.tinteLeise}
          selectionColor={f.amt}
          keyboardType="numbers-and-punctuation"
          inputAccessoryViewID={TASTATUR_FERTIG}
          style={[feldRahmen(f, { fokus, fehler: Boolean(fehlerText), inKarte }), feldText(f), { flex: 1, minWidth: 0 }]}
        />
        {ohneHeute ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${heuteText}`} onPress={() => aendern(heute)} style={({ pressed }) => ({ minHeight: 50, paddingHorizontal: 15, borderRadius: RADIUS.klein, justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
            <T v="klein" fett farbe={f.amtTief}>{heuteText}</T>
          </Pressable>
        )}
        <DatumWahl label={label} wert={wert} aendern={aendern} />
      </View>
      {fehlerText ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{fehlerText}</T> : hinweisText ? <T v="caption" farbe={f.bald} stil={{ marginTop: 5 }}>{hinweisText}</T> : null}
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
      style={({ pressed }) => ({ minHeight: 40, paddingLeft: kaestchen ? 9 : 16, paddingRight: 16, borderRadius: RADIUS.pille, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: an ? f.haupt : pressed ? f.linie : inKarte ? f.flaeche : f.blatt, flexShrink: 1 })}
    >
      {kaestchen ? <Kaestchen an={an} invers={an} /> : null}
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

/**
 * Schalter mit Beschriftung (iOS-Switch in Handlungsfarbe): die ganze Zeile ist ein Element mit Rolle „Schalter“ –
 * Antippen irgendwo schaltet um, VoiceOver liest Beschriftung, Zustand und die Hilfe als Hinweis in einem.
 */
export function Schalter({ label, wert, aendern, hilfe }: { label: string; wert: boolean; aendern: (w: boolean) => void; hilfe?: string }) {
  const f = useFarben();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hilfe}
      accessibilityState={{ checked: wert }}
      aria-checked={wert}
      onPress={() => aendern(!wert)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: ZIEL + 4, marginTop: 14 }}
    >
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hilfe ? <T v="caption" leise stil={{ marginTop: 2 }}>{hilfe}</T> : null}
      </View>
      {/* nur Anzeige – Zustand und Bedienung trägt die Zeile */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {/* Web: ohne activeThumbColor färbt react-native-web den Knopf im An-Zustand grün (A11) */}
        {/* R12 (Kurier #20): auch der innere Schalter trägt die Beschriftung – im Web taucht er sonst unbeschriftet auf */}
        <Switch value={wert} accessibilityLabel={label} focusable={false} trackColor={{ true: f.haupt, false: f.linie }} thumbColor="#ffffff" ios_backgroundColor={f.linie} {...({ activeThumbColor: "#ffffff", tabIndex: -1, "aria-label": label } as object)} />
      </View>
    </Pressable>
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
function AntwortKarte({ text, an, rolle, onPress, unter }: { text: string; an: boolean; rolle: "radio" | "checkbox"; onPress: () => void; /** R12: kleine Zeile darunter, z. B. „aus deiner Branche“ */ unter?: string }) {
  const f = useFarben();
  return (
    <Pressable
      accessibilityRole={rolle}
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={unter ? `${text}, ${unter}` : text}
      onPress={() => {
        if (istIos) void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingHorizontal: 18, paddingVertical: 14, borderRadius: RADIUS.knopf, borderWidth: 2, borderColor: an ? f.amt : "transparent", backgroundColor: an ? f.amtHauch : pressed ? f.flaeche : f.blatt })}
    >
      {rolle === "radio" ? (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: an ? 7 : 2, borderColor: an ? f.amt : f.rahmen, backgroundColor: f.papier }} />
      ) : (
        <Kaestchen an={an} />
      )}
      <View style={{ flex: 1 }}>
        <T fett={an}>{text}</T>
        {unter ? <T v="caption" leise stil={{ marginTop: 2 }}>{unter}</T> : null}
      </View>
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
export function MehrfachWahl({ label, werte, aendern, optionen, hilfe, ohneLabel, gross }: { label: string; werte: string[]; aendern: (w: string[]) => void; optionen: { wert: string; text: string; herkunft?: string }[]; hilfe?: string; ohneLabel?: boolean; gross?: boolean }) {
  if (gross)
    return (
      <View accessibilityLabel={label} style={{ gap: 10, marginTop: ohneLabel ? 8 : 20 }}>
        {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
        {optionen.map((o) => {
          const an = werte.includes(o.wert);
          return <AntwortKarte key={o.wert} text={o.text} an={an} unter={an ? o.herkunft : undefined} rolle="checkbox" onPress={() => aendern(mehrfachUmschalten(werte, o.wert, optionen))} />;
        })}
      </View>
    );
  return (
    <View style={{ marginTop: ohneLabel ? 8 : 20 }}>
      {ohneLabel ? null : <FeldKopf label={label} hilfe={hilfe} />}
      <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
        {optionen.map((o) => {
          const an = werte.includes(o.wert);
          return <Chip key={o.wert} text={o.text} an={an} rolle="checkbox" kaestchen onPress={() => aendern(mehrfachUmschalten(werte, o.wert, optionen))} />;
        })}
      </View>
    </View>
  );
}

/**
 * Uhrzeit als HH:MM (R10): Ziffernblock statt Symboltastatur – „1400“ wird zu 14:00, „930“ beim Verlassen zu 09:30;
 * „14.00“ und „14,00“ gehen auch. `jetzt`: Knopf „Jetzt“ setzt die aktuelle Uhrzeit (deutsche Zeit).
 */
export function UhrzeitFeld({ label, wert, aendern, hilfe, jetzt }: { label: string; wert: string; aendern: (w: string) => void; hilfe?: string; jetzt?: boolean }) {
  const f = useFarben();
  const [fokus, setFokus] = useState(false);
  const roh = wert.trim();
  const gueltig = /^([01]?\d|2[0-3]):[0-5]\d$/.test(roh);
  // beim Tippen nur melden, was sicher falsch ist (z. B. „25:00“) – „14“ ist noch unterwegs zu „1400“
  const falsch = roh !== "" && !gueltig && (!fokus || roh.length >= 4) && !uhrzeitLesen(roh);
  const setzen = (w: string) => {
    // vier Ziffern sind vollständig: gleich als Uhrzeit schreiben („1400“ → „14:00“)
    const z = /^\d{4}$/.test(w.trim()) ? uhrzeitLesen(w) : null;
    aendern(z ?? w);
  };
  const jetztZeit = () => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const feld = (
    <Feld
      label={label}
      ohneLabel={Boolean(jetzt)}
      hilfe={hilfe === "HH:MM" ? undefined : hilfe}
      wert={wert}
      aendern={setzen}
      placeholder="HH:MM"
      keyboardType="number-pad"
      autoCorrect={false}
      spellCheck={false}
      fehler={falsch ? TEXT.uhrzeit_falsch : null}
      onFocus={() => setFokus(true)}
      onBlur={() => {
        setFokus(false);
        const z = uhrzeitLesen(roh);
        if (roh && z && z !== roh) aendern(z);
      }}
    />
  );
  if (!jetzt) return feld;
  return (
    <View style={{ marginTop: 20 }}>
      <FeldKopf label={label} hilfe={hilfe === "HH:MM" ? undefined : hilfe} />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>{feld}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${TEXT.jetzt}`} onPress={() => aendern(jetztZeit())} style={({ pressed }) => ({ minHeight: 50, marginTop: 15, paddingHorizontal: 15, borderRadius: RADIUS.klein, justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
          <T v="klein" fett farbe={f.amtTief}>{TEXT.jetzt}</T>
        </Pressable>
      </View>
    </View>
  );
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
              <View style={{ paddingTop: 0 }}>
                <Kaestchen an={an} />
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

/**
 * Chips zum Wählen in einer waagrechten Leiste (Zeiträume, Filter, Gruppen): beginnt und endet am Seitenrand und
 * scrollt beim Öffnen zum gewählten Chip, mit Seitenrand davor (A16). Radio-Semantik wie `Wahl`.
 */
export function ChipLeiste<W extends string>({ label, wert, aendern, optionen, hilfe, stil }: { label?: string; wert: W | null; aendern: (w: W) => void; optionen: { wert: W; text: string }[]; hilfe?: string; stil?: StyleProp<ViewStyle> }) {
  const ref = useRef<ScrollView>(null);
  const lagen = useRef(new Map<string, number>());
  const gescrollt = useRef(false);
  const hin = (x: number | undefined) => {
    if (x === undefined || gescrollt.current) return;
    gescrollt.current = true;
    ref.current?.scrollTo({ x: Math.max(0, x - RAND), animated: false });
  };
  return (
    <View style={[{ marginTop: label ? 20 : 0 }, stil]}>
      {label ? <FeldKopf label={label} hilfe={hilfe} /> : null}
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -RAND, marginTop: label ? 9 : 0 }} contentContainerStyle={{ paddingLeft: RAND }}>
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 8 }}>
          {optionen.map((o) => (
            <View
              key={o.wert}
              onLayout={(e) => {
                lagen.current.set(o.wert, e.nativeEvent.layout.x);
                if (o.wert === wert) hin(e.nativeEvent.layout.x);
              }}
            >
              <Chip text={o.text} an={o.wert === wert} rolle="radio" onPress={() => aendern(o.wert)} />
            </View>
          ))}
          {/* Abstand am Ende: der letzte Chip klebt nicht am Rand */}
          <View style={{ width: RAND - 8 }} />
        </View>
      </ScrollView>
    </View>
  );
}

/** „Hinzufügen“ – überall gleich (A23): gestrichelte Karte mit grünem Plus-Kreis. */
export function HinzufuegenKnopf({ text, label, onPress, stil }: { text: string; label?: string; onPress: () => void; stil?: StyleProp<ViewStyle> }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: RADIUS.karte, borderWidth: 1.5, borderStyle: "dashed", borderColor: f.rahmen, backgroundColor: pressed ? f.blatt : "transparent" }, stil]}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: f.amt, alignItems: "center", justifyContent: "center" }}>
        <Symbol name="plus" groesse={15} farbe={f.amtText} gewicht="bold" />
      </View>
      <T fett farbe={f.amt} stil={{ flexShrink: 1 }}>{text}</T>
    </Pressable>
  );
}

/** Kurze Zeilen auf der Bühne: Text in höchstens zwei Zeilen; ein längerer Rest steckt hinter einem (i) (B2). */
export function kurzUndRest(text: string, max = 88): [string, string] {
  // ~88 Zeichen sind zwei Zeilen bei 17 pt auf dem iPhone
  if (text.length <= max) return [text, ""];
  // am Satzende schneiden, sonst am letzten Wort vor der Grenze (dann mit „…“)
  const satz = text.slice(0, max + 1).search(/[.!?]\s(?=[^.!?]*$)/);
  if (satz > 30) return [text.slice(0, satz + 1).trim(), text.slice(satz + 1).trim()];
  const wort = text.lastIndexOf(" ", max);
  return [`${text.slice(0, wort).replace(/[,:;–-]+$/, "").trim()}\u00a0…`, text.slice(wort).trim()];
}

/** Satz unter dem Titel auf der Bühne: höchstens zwei Zeilen, der Rest hinter (i) zum Aufklappen. */
export function BuehnenText({ text, stil, kompakt }: { text: string; stil?: StyleProp<TextStyle>; /** R12 (UX #23): bei großer Schrift ganz zugeklappt – nur „Mehr dazu“ */ kompakt?: boolean }) {
  const f = useFarben();
  const [offen, setOffen] = useState(false);
  const [kurz, rest] = kompakt && text.length > 60 ? ["", text] : kurzUndRest(text);
  if (!rest) return <T farbe={f.buehneLeise} stil={stil}>{text}</T>;
  return (
    <View>
      {offen || kurz ? (
        <T farbe={f.buehneLeise} stil={stil}>
          {offen ? text : kurz}
        </T>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={offen ? TEXT.weniger : TEXT.mehr_dazu} accessibilityState={{ expanded: offen }} aria-expanded={offen} onPress={() => { weich(); setOffen(!offen); }} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 36, opacity: pressed ? 0.6 : 1 })}>
        <Symbol name={offen ? "info.circle.fill" : "info.circle"} groesse={16} farbe={f.minze} />
        <T v="klein" fett farbe={f.minze}>{offen ? TEXT.weniger : TEXT.mehr_dazu}</T>
      </Pressable>
    </View>
  );
}
