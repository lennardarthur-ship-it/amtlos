import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Dimensions, Easing, PanResponder, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { T as TEXT } from "../texte";
import { Symbol, T } from "./bausteine";
import { RAND, ZIEL, useFarben } from "./thema";

/**
 * Stapel-Navigation je Tab (E-120), ohne zusätzliche Pakete: Unterseiten schieben sich von rechts herein,
 * Zurück über den Knopf oder durch Wischen vom linken Rand – wie in iOS. Erneutes Tippen auf den aktiven Tab
 * führt zur ersten Seite zurück.
 */
interface Nav {
  /** Unterseite öffnen; gleicher Schlüssel wird nicht doppelt geöffnet. `vollbild` blendet die Tab-Leiste aus (geführte Abläufe). */
  oeffnen(schluessel: string, inhalt: () => ReactNode, vollbild?: boolean): void;
  zurueck(): void;
}
const NavKontext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavKontext);
  if (!n) throw new Error("useNav außerhalb eines Stapels");
  return n;
}

const BREITE = Dimensions.get("window").width;

interface Eintrag {
  schluessel: string;
  inhalt: () => ReactNode;
  geht: boolean;
  vollbild: boolean;
}

function Ebene({ eintrag, oben, zurueck, weg }: { eintrag: Eintrag; oben: boolean; zurueck: () => void; weg: () => void }) {
  const f = useFarben();
  const x = useRef(new Animated.Value(BREITE)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [x]);
  useEffect(() => {
    if (eintrag.geht) Animated.timing(x, { toValue: BREITE, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(weg);
  }, [eintrag.geht, weg, x]);
  const wischen = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX - g.dx < 28 && g.dx > 8 && Math.abs(g.dy) < 20,
        onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx > BREITE * 0.33 || g.vx > 0.6) zurueck();
          else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [zurueck, x],
  );
  return (
    <Animated.View
      {...wischen.panHandlers}
      pointerEvents={oben ? "auto" : "none"}
      importantForAccessibility={oben ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!oben}
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: f.papier, transform: [{ translateX: x }], shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12 }}
    >
      {eintrag.inhalt()}
    </Animated.View>
  );
}

/** Ein Stapel für einen Tab. `wurzel` ist die erste Seite; ändert sich `zuruecksetzen`, schließen alle Unterseiten. */
export function Stapel({ wurzel, zuruecksetzen, vollbild }: { wurzel: ReactNode; zuruecksetzen: number; vollbild?: (an: boolean) => void }) {
  const [stapel, setStapel] = useState<Eintrag[]>([]);
  useEffect(() => setStapel([]), [zuruecksetzen]);
  const istVoll = stapel.some((e) => e.vollbild && !e.geht);
  useEffect(() => vollbild?.(istVoll), [istVoll, vollbild]);

  const zurueck = useCallback(() => {
    setStapel((s) => {
      const i = s.findLastIndex((e) => !e.geht);
      return i < 0 ? s : s.map((e, j) => (j === i ? { ...e, geht: true } : e));
    });
  }, []);
  const nav = useMemo<Nav>(
    () => ({
      oeffnen: (schluessel, inhalt, voll = false) => setStapel((s) => (s.some((e) => e.schluessel === schluessel && !e.geht) ? s : [...s.filter((e) => e.schluessel !== schluessel), { schluessel, inhalt, geht: false, vollbild: voll }])),
      zurueck,
    }),
    [zurueck],
  );
  const offen = stapel.filter((e) => !e.geht);
  return (
    <NavKontext.Provider value={nav}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} pointerEvents={offen.length ? "none" : "auto"} importantForAccessibility={offen.length ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={offen.length > 0}>
          {wurzel}
        </View>
        {stapel.map((e) => (
          <Ebene key={e.schluessel} eintrag={e} oben={e === offen.at(-1)} zurueck={zurueck} weg={() => setStapel((s) => s.filter((x) => x !== e))} />
        ))}
      </View>
    </NavKontext.Provider>
  );
}

/** Kopf einer Unterseite: Zurück links, Titel in der Mitte, optional eine Handlung rechts. */
export function Unterseite({ titel, children, rechts }: { titel: string; children: ReactNode; rechts?: ReactNode }) {
  const f = useFarben();
  const nav = useNav();
  return (
    // Zwei-Finger-Z-Geste von VoiceOver führt zurück
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["top", "left", "right"]} onAccessibilityEscape={nav.zurueck}>
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: RAND - 12, borderBottomWidth: 0.5, borderColor: f.linie }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.zurueck} onPress={nav.zurueck} hitSlop={8} style={{ minWidth: ZIEL + 40, height: ZIEL, flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Symbol name="chevron.left" groesse={20} farbe={f.amt} gewicht="semibold" />
          <T farbe={f.amt}>{TEXT.zurueck}</T>
        </Pressable>
        <T fett numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} accessibilityRole="header" stil={{ flex: 1, textAlign: "center", marginHorizontal: 4, paddingVertical: 4 }}>{titel}</T>
        <View style={{ minWidth: ZIEL + 40, alignItems: "flex-end" }}>{rechts}</View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}
