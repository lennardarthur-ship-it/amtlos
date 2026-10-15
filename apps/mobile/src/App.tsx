import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold, useFonts } from "@expo-google-fonts/onest";
import { BlurView } from "expo-blur";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Easing, InputAccessoryView, Keyboard, Platform, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Betrieb } from "./seiten/Betrieb";
import { ErinnerungsPlaner, PflichtenTab } from "./seiten/Pflichten";
import { Meine } from "./seiten/Meine";
import { AutoSicherung, WiederherstellenSeite } from "./seiten/Sicherung";
import { Heute } from "./seiten/Heute";
import { ErstellenAnbieter, useErstellen } from "./seiten/Erstellen";
import * as Haptics from "expo-haptics";
import { T as TEXT } from "./texte";
import { Kachel, Karte, Knopf, Symbol, T, TextKnopf } from "./ui/bausteine";
import { MeldungAnbieter } from "./ui/meldung";
import { entsperren } from "./unterlagen/sperre";
import { Stapel, useNav, type Nav } from "./ui/navigation";
import { HAARLINIE, TASTATUR_FERTIG, ZIEL, istIos, schattenStil, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos, type Tab } from "./zustand";
import { KontoAnbieter } from "./konto/konto";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs (E-138): „Heute“ als Start, Pflichten, eigene Unterlagen, Betrieb – in der Mitte „+“ zum Erstellen. */
const TABS: { id: Tab; symbol: string }[] = [
  { id: "heute", symbol: "house" },
  { id: "pflichten", symbol: "checklist" },
  { id: "meine", symbol: "folder" },
  { id: "betrieb", symbol: "building.2" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: PflichtenTab, meine: Meine, betrieb: Betrieb };

/** Tab-Leiste: unscharfer Hintergrund (iOS), SF Symbols, der aktive Tab in Handlungsfarbe; in der Mitte „+“. */
function Leiste({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  // Erneutes Tippen auf den aktiven Tab führt zur ersten Seite (setTab erkennt das)
  const f = useFarben();
  const dunkel = useColorScheme() === "dark";
  const inset = useSafeAreaInsets();
  const erstellen = useErstellen();
  const reiter = (k: (typeof TABS)[number]) => {
    const an = k.id === tab;
    return (
      <Pressable key={k.id} accessibilityRole="tab" accessibilityLabel={TEXT.tabs[k.id]} accessibilityState={{ selected: an }} onPress={() => setTab(k.id)} style={{ flex: 1, minHeight: ZIEL + 4, alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 7 }}>
        <Symbol name={an && k.id === "heute" ? "house.fill" : k.symbol} groesse={23} farbe={an ? f.amt : f.tinteLeise} gewicht={an ? "semibold" : "regular"} />
        <T v="mini" farbe={an ? f.amt : f.tinteLeise}>{TEXT.tabs[k.id]}</T>
      </Pressable>
    );
  };
  const inhalt = (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", paddingBottom: Math.max(inset.bottom - 6, 4), borderTopWidth: HAARLINIE, borderColor: f.linie }}>
      {TABS.slice(0, 2).map(reiter)}
      {/* der eine Ort zum Anfangen – egal, wo man gerade ist */}
      <View style={{ flex: 1, alignItems: "center", paddingTop: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TEXT.erstellen}
          onPress={() => {
            if (istIos) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            erstellen.oeffnen();
          }}
          hitSlop={6}
          style={({ pressed }) => [{ width: 50, height: 50, borderRadius: 25, backgroundColor: f.amt, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }, schattenStil(f, 1.2)]}
        >
          <Symbol name="plus" groesse={24} farbe={f.amtText} gewicht="bold" />
        </Pressable>
      </View>
      {TABS.slice(2).map(reiter)}
    </View>
  );
  if (istIos) return <BlurView intensity={80} tint={dunkel ? "dark" : "light"} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>{inhalt}</BlurView>;
  return <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: f.papier }}>{inhalt}</View>;
}

/** App-Sperre (E-129): bei eingeschalteter Sperre nach dem Start und nach jedem Wechsel in den Hintergrund. */
function Sperre({ children }: { children: React.ReactNode }) {
  const { bereit, stand } = useAmtlos();
  const f = useFarben();
  const [offen, setOffen] = useState(false);
  const an = bereit && stand.appSperre;
  const los = () => void entsperren(TEXT.entsperren_grund).then(setOffen);
  useEffect(() => {
    if (bereit) void SplashScreen.hideAsync().catch(() => undefined);
  }, [bereit]);
  useEffect(() => {
    if (!an) return;
    const abo = AppState.addEventListener("change", (z) => {
      if (z === "background") setOffen(false);
    });
    return () => abo.remove();
  }, [an]);
  useEffect(() => {
    if (an && !offen) los();
    // nur beim Einschalten bzw. nach dem Sperren einmal fragen
  }, [an, offen]);
  if (!an || offen) return <>{children}</>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier, paddingHorizontal: 28, paddingBottom: 24 }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14 }}>
        <Kachel symbol="lock.fill" groesse={72} />
        <T v="titel" accessibilityRole="header" stil={{ textAlign: "center", marginTop: 10 }}>{TEXT.gesperrt_titel}</T>
        <T leise stil={{ textAlign: "center" }}>{TEXT.gesperrt_text}</T>
      </View>
      <Knopf symbol="faceid" text={TEXT.entsperren} onPress={los} />
    </SafeAreaView>
  );
}

function Rahmen() {
  const { bereit, ladefehler, tab, tabWechseln } = useAmtlos();
  const f = useFarben();
  const [zurueck, setZurueck] = useState<Record<Tab, number>>({ heute: 0, pflichten: 0, meine: 0, betrieb: 0 });
  const [besucht, setBesucht] = useState<Set<Tab>>(new Set(["heute"]));
  // geführte Abläufe laufen im Vollbild – ohne Tab-Leiste, mit eigenem Knopf unten
  const [voll, setVoll] = useState<Record<Tab, boolean>>({ heute: false, pflichten: false, meine: false, betrieb: false });
  const vollSetzer = useMemo(() => Object.fromEntries(TABS.map((x) => [x.id, (an: boolean) => setVoll((v) => (v[x.id] === an ? v : { ...v, [x.id]: an }))])) as Record<Tab, (an: boolean) => void>, []);
  // Stapel je Tab: das Blatt „Neu erstellen“ öffnet Abläufe im aktuellen Tab
  const navs = useRef<Partial<Record<Tab, Nav>>>({});
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const navRefs = useMemo(() => Object.fromEntries(TABS.map((x) => [x.id, (n: Nav) => { navs.current[x.id] = n; }])) as unknown as Record<Tab, (n: Nav) => void>, []);
  const navFuer = useCallback(() => navs.current[tabRef.current], []);
  // Tabwechsel: die neue Seite blendet kurz ein (160 ms) – ruhig, aber spürbar
  const einblenden = useMemo(() => Object.fromEntries(TABS.map((x) => [x.id, new Animated.Value(1)])) as Record<Tab, Animated.Value>, []);
  useEffect(() => {
    const w = einblenden[tab];
    w.setValue(0);
    Animated.timing(w, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tab, einblenden]);
  const setTab = (t: Tab) => {
    if (t === tab) setZurueck((z) => ({ ...z, [t]: z[t] + 1 }));
    tabWechseln(t);
  };
  // auch Wechsel aus einer Seite heraus (z. B. „Zu den Unterlagen“) hängen den Tab ein
  useEffect(() => setBesucht((b) => (b.has(tab) ? b : new Set([...b, tab]))), [tab]);
  useEffect(() => {
    if (bereit) void SplashScreen.hideAsync().catch(() => undefined);
  }, [bereit]);

  if (!bereit)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: f.papier }}>
        <ActivityIndicator color={f.amt} accessibilityLabel={TEXT.app} />
      </View>
    );
  // Daten unlesbar: nichts bearbeiten lassen, was sich nicht speichern ließe – erst klären (E-129)
  if (ladefehler)
    return (
      <View style={{ flex: 1, backgroundColor: f.papier }}>
        <Stapel zuruecksetzen={0} wurzel={<SafeAreaView style={{ flex: 1 }}><LadefehlerSeite /></SafeAreaView>} />
      </View>
    );
  // Besuchte Tabs bleiben eingehängt, damit Unterseiten und Scrollposition beim Wechseln erhalten bleiben
  return (
    <ErstellenAnbieter navFuer={navFuer}>
    <View style={{ flex: 1, backgroundColor: f.papier }}>
      {TABS.filter((x) => besucht.has(x.id) || x.id === tab).map((x) => {
        const Wurzel = SEITE[x.id];
        const an = x.id === tab;
        return (
          // Im Web greift pointerEvents="none" nicht auf alle Kinder – verborgene Tabs dort ausblenden
          <Animated.View key={x.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: an ? einblenden[x.id] : 0, transform: [{ translateY: an ? einblenden[x.id].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) : 0 }], display: Platform.OS === "web" && !an ? "none" : "flex" }} pointerEvents={an ? "auto" : "none"} importantForAccessibility={an ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!an}>
            <Stapel
              navRef={navRefs[x.id]}
              zuruecksetzen={zurueck[x.id]}
              vollbild={vollSetzer[x.id]}
              wurzel={
                <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
                  <Wurzel />
                </SafeAreaView>
              }
            />
          </Animated.View>
        );
      })}
      {voll[tab] ? null : <Leiste tab={tab} setTab={setTab} />}
    </View>
    </ErstellenAnbieter>
  );
}

/** Gespeicherte Daten ließen sich nicht lesen: noch einmal versuchen, Sicherung wiederherstellen oder neu beginnen. */
function LadefehlerSeite() {
  const z = useAmtlos();
  const nav = useNav();
  const [laedt, setLaedt] = useState(false);
  const [frage, setFrage] = useState(false);
  return (
    <View style={{ flex: 1, padding: 24, gap: 14, justifyContent: "center" }}>
      <Kachel symbol="exclamationmark.triangle" ton="frist" groesse={60} />
      <T v="titel" accessibilityRole="header">{TEXT.ladefehler_titel}</T>
      <T>{TEXT.ladefehler}</T>
      <Knopf text={TEXT.ladefehler_nochmal} symbol="arrow.clockwise" laedt={laedt} onPress={() => { setLaedt(true); void z.neuLaden().finally(() => setLaedt(false)); }} />
      <Knopf ton text={TEXT.wiederherstellen} symbol="arrow.clockwise" onPress={() => nav.oeffnen("wiederherstellen", () => <WiederherstellenSeite />, true)} />
      {frage ? (
        <Karte stil={{ paddingVertical: 14, gap: 10 }}>
          <T fett>{TEXT.ladefehler_neu_wirklich}</T>
          <T v="klein" leise>{TEXT.ladefehler_neu_text}</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Knopf gefahr text={TEXT.ladefehler_neu} onPress={() => void z.neuBeginnen()} stil={{ flex: 1 }} />
            <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
          </View>
        </Karte>
      ) : (
        <TextKnopf gefahr symbol="trash" text={TEXT.ladefehler_neu} onPress={() => setFrage(true)} />
      )}
    </View>
  );
}

/** „Fertig“ über Zahlentastaturen (iOS hat dort keine Eingabetaste) – alle Zahlen- und Datumsfelder hängen daran. */
function TastaturLeiste() {
  const f = useFarben();
  if (!istIos) return null;
  return (
    <InputAccessoryView nativeID={TASTATUR_FERTIG} backgroundColor={f.papier}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", borderTopWidth: HAARLINIE, borderColor: f.linie }}>
        <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 20, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
          <T fett farbe={f.amt}>{TEXT.tastatur_fertig}</T>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export default function App() {
  const dunkel = useColorScheme() === "dark";
  // Onest (OFL 1.1), E-139 – fünf Schnitte einer Familie
  const [schriftGeladen] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold });
  if (!schriftGeladen && Platform.OS !== "web") return null;
  return (
    <SafeAreaProvider>
      <AmtlosAnbieter>
        <KontoAnbieter>
          <StatusBar style={dunkel ? "light" : "dark"} />
          <ErinnerungsPlaner />
          <AutoSicherung />
          <Sperre>
            <MeldungAnbieter unten={72}>
              <Rahmen />
            </MeldungAnbieter>
          </Sperre>
          <TastaturLeiste />
        </KontoAnbieter>
      </AmtlosAnbieter>
    </SafeAreaProvider>
  );
}
