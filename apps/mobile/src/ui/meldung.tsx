import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { Symbol, T } from "./bausteine";
import { RADIUS, RAND, istIos, useFarben } from "./thema";

type Art = "erfolg" | "info";
interface Meldung {
  text: string;
  art: Art;
  nr: number;
}

const Kontext = createContext<((text: string, art?: Art) => void) | null>(null);
const LeerenKontext = createContext<(() => void) | null>(null);

/** Eine noch sichtbare Meldung sofort ausblenden (z. B. beim Öffnen einer neuen Seite, damit sie nichts verdeckt). */
export function useMeldungLeeren(): () => void {
  return useContext(LeerenKontext) ?? (() => undefined);
}

/** Kurze Bestätigung am unteren Rand („Sicherung erstellt.“) – mit Haptik, verschwindet von selbst. */
export function useMeldung(): (text: string, art?: Art) => void {
  const m = useContext(Kontext);
  return m ?? (() => undefined);
}

export function MeldungAnbieter({ children, unten = 0 }: { children: ReactNode; unten?: number }) {
  const [aktuell, setAktuell] = useState<Meldung | null>(null);
  const zaehler = useRef(0);
  const melden = useCallback((text: string, art: Art = "erfolg") => {
    if (istIos) void Haptics.notificationAsync(art === "erfolg" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setAktuell({ text, art, nr: ++zaehler.current });
    // VoiceOver: Live-Regionen gibt es nur unter Android – auf dem iPhone ausdrücklich ansagen
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
  const weg = useCallback((nr: number) => setAktuell((m) => (m?.nr === nr ? null : m)), []);
  const wert = useMemo(() => melden, [melden]);
  const leeren = useCallback(() => setAktuell(null), []);
  return (
    <Kontext.Provider value={wert}>
      <LeerenKontext.Provider value={leeren}>
      {children}
      {/* über allem – auch über Blättern (auf dem iPhone eigenes Fenster, sonst läge die Meldung unter dem Blatt) */}
      {aktuell ? istIos ? <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}><Anzeige meldung={aktuell} weg={weg} unten={unten} /></FullWindowOverlay> : <Anzeige meldung={aktuell} weg={weg} unten={unten} /> : null}
      </LeerenKontext.Provider>
    </Kontext.Provider>
  );
}

function Anzeige({ meldung, weg, unten }: { meldung: Meldung; weg: (nr: number) => void; unten: number }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const y = useRef(new Animated.Value(24)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    y.setValue(24);
    o.setValue(0);
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const zeit = setTimeout(() => {
      Animated.timing(o, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => weg(meldung.nr));
    }, Math.min(6000, 2000 + meldung.text.length * 40));
    return () => clearTimeout(zeit);
    // jede neue Meldung (nr) blendet neu ein
  }, [meldung.nr, o, y, weg]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(inset.bottom, 12) + unten, alignItems: "center" }}>
      <Animated.View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ opacity: o, transform: [{ translateY: y }], flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 393 - 2 * RAND, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.karte, backgroundColor: f.tinte, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <Symbol name={meldung.art === "erfolg" ? "checkmark.circle.fill" : "info.circle.fill"} groesse={18} farbe={f.papier} />
        <T v="klein" fett farbe={f.papier} stil={{ flexShrink: 1 }}>{meldung.text}</T>
      </Animated.View>
    </View>
  );
}
