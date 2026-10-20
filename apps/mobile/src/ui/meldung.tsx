import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { Symbol, T } from "./bausteine";
import { FussKontext } from "./fussHoehe";
import { RADIUS, RAND, istIos, useFarben, useWenigBewegung } from "./thema";

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

/**
 * `imTab`: liegt gerade die Tab-Leiste unten (kein Blatt darüber)? Dann steht die Meldung über der Kapsel; in Blättern
 * über der Fußleiste der sichtbaren Seite (A4), ohne Fußleiste knapp über dem unteren Rand.
 */
export function MeldungAnbieter({ children, imTab = () => false }: { children: ReactNode; imTab?: () => boolean }) {
  const [aktuell, setAktuell] = useState<Meldung | null>(null);
  // Fußleisten der sichtbaren Seiten (meist eine) – die zuletzt gemeldete zählt
  const fuesse = useRef(new Map<string, number>());
  const [fuss, setFuss] = useState(0);
  const fussMelden = useCallback((id: string, h: number | null) => {
    if (h) fuesse.current.set(id, h);
    else fuesse.current.delete(id);
    setFuss([...fuesse.current.values()].at(-1) ?? 0);
  }, []);
  const zaehler = useRef(0);
  const imTabRef = useRef(imTab);
  imTabRef.current = imTab;
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
      <FussKontext.Provider value={fussMelden}>
      {children}
      {/* über allem – auch über Blättern (auf dem iPhone eigenes Fenster, sonst läge die Meldung unter dem Blatt) */}
      {aktuell ? istIos ? <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}><Anzeige meldung={aktuell} weg={weg} fuss={fuss} imTab={imTabRef} /></FullWindowOverlay> : <Anzeige meldung={aktuell} weg={weg} fuss={fuss} imTab={imTabRef} /> : null}
      </FussKontext.Provider>
      </LeerenKontext.Provider>
    </Kontext.Provider>
  );
}

/** Höhe der schwebenden Tab-Leiste (siehe `Kapsel` in App.tsx) samt Abstand darüber */
const KAPSEL = 66 + 10;

function Anzeige({ meldung, weg, fuss, imTab }: { meldung: Meldung; weg: (nr: number) => void; fuss: number; imTab: { current: () => boolean } }) {
  // Lage laufend nachführen: schließt sich ein Blatt, während die Meldung steht, rückt sie über die Tab-Leiste
  const [tab, setTab] = useState(() => imTab.current());
  useEffect(() => {
    const t = setInterval(() => setTab(imTab.current()), 250);
    return () => clearInterval(t);
  }, [imTab]);
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const breite = useWindowDimensions().width;
  const wenig = useWenigBewegung();
  const y = useRef(new Animated.Value(24)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    y.setValue(wenig ? 0 : 24);
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
  // Tab: über der Kapsel; Blatt: über der Fußleiste der Seite (deren Höhe enthält schon den sicheren Rand), sonst am Rand
  const unten = tab ? Math.max(inset.bottom - 6, 14) + KAPSEL : fuss ? fuss + 8 : Math.max(inset.bottom, 12) + 8;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: unten, alignItems: "center" }}>
      {/* dunkle Kapsel wie die Tab-Leiste – auch im Dunkelmodus kein greller weißer Block */}
      <Animated.View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ opacity: o, transform: [{ translateY: y }], flexDirection: "row", alignItems: "center", gap: 10, maxWidth: Math.min(breite, 600) - 2 * RAND, paddingHorizontal: 16, paddingVertical: 13, borderRadius: RADIUS.karte, backgroundColor: f.kapsel, borderWidth: 1, borderColor: f.kapselRand, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
        <Symbol name={meldung.art === "erfolg" ? "checkmark.circle.fill" : "info.circle.fill"} groesse={18} farbe={f.minze} />
        <T v="klein" fett farbe="#ffffff" stil={{ flexShrink: 1 }}>{meldung.text}</T>
      </Animated.View>
    </View>
  );
}
