import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, InputAccessoryView, Keyboard, Pressable, View, useColorScheme, useWindowDimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Betrieb } from "./seiten/Betrieb";
import { ErinnerungsPlaner, PflichtenTab } from "./seiten/Pflichten";
import { Meine } from "./seiten/Meine";
import { AutoSicherung, WiederherstellenSeite } from "./seiten/Sicherung";
import { Heute } from "./seiten/Heute";
import { NeuBlatt, useErstellen } from "./seiten/Erstellen";
import { T as TEXT } from "./texte";
import { Kachel, Karte, Knopf, Symbol, T, TextKnopf } from "./ui/bausteine";
import { MeldungAnbieter } from "./ui/meldung";
import { useSchrift } from "./ui/schrift";
import { entsperren } from "./unterlagen/sperre";
import { Blatt, InhaltSeite, WurzelNavKontext, kopfOptionen, useNav } from "./ui/navigation";
import { HAARLINIE, SCHRIFT, TASTATUR_FERTIG, istIos, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos, type Tab } from "./zustand";
import { KontoAnbieter } from "./konto/konto";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs (E-142): „Heute“ als Start, Pflichten, eigene Unterlagen, Betrieb – „+“ sitzt rechts in der Tab-Leiste. */
const TABS: { id: Tab; symbol: string; symbolAn: string }[] = [
  { id: "heute", symbol: "house", symbolAn: "house.fill" },
  { id: "pflichten", symbol: "checklist", symbolAn: "checklist" },
  { id: "meine", symbol: "folder", symbolAn: "folder.fill" },
  { id: "betrieb", symbol: "building.2", symbolAn: "building.2.fill" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: PflichtenTab, meine: Meine, betrieb: Betrieb };

/**
 * Tab-Leiste (E-142): eine dunkle, schwebende Kapsel – der aktive Tab als Minze-Pille mit Wort, die anderen als Symbol,
 * rechts der Minze-Knopf „+“ (Neu erstellen). Erneutes Tippen auf den aktiven Tab führt zur ersten Seite zurück.
 */
function Kapsel({ state, navigation }: BottomTabBarProps) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const erstellen = useErstellen();
  // große Schrift: das Wort in der Pille passt dann nicht mehr neben vier Symbole und „+“ – nur noch Symbole; lange
  // drücken zeigt den Namen groß (Large Content Viewer, iOS)
  const mitWort = useWindowDimensions().fontScale <= 1.35;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(inset.bottom - 6, 14), paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 66, paddingLeft: 7, paddingRight: 7, borderRadius: 33, backgroundColor: f.kapsel, borderWidth: 1, borderColor: f.kapselRand, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
        <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {state.routes.map((r, i) => {
            const k = TABS.find((t) => t.id === r.name)!;
            const an = i === state.index;
            return (
              <Pressable
                key={r.key}
                accessibilityRole="tab"
                accessibilityLabel={TEXT.tabs[k.id]}
                accessibilityState={{ selected: an }}
                aria-selected={an}
                accessibilityShowsLargeContentViewer
                accessibilityLargeContentTitle={TEXT.tabs[k.id]}
                onPress={() => {
                  const e = navigation.emit({ type: "tabPress", target: r.key, canPreventDefault: true });
                  // erneutes Tippen auf den aktiven Tab: der Stapel kehrt selbst zur ersten Seite zurück
                  if (!an && !e.defaultPrevented) navigation.navigate(r.name);
                }}
                hitSlop={4}
                style={({ pressed }) => ({ height: 52, minWidth: 52, paddingHorizontal: an && mitWort ? 15 : 0, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: an ? "rgba(127,227,184,0.16)" : "transparent", opacity: pressed ? 0.7 : 1 })}
              >
                <Symbol name={an ? k.symbolAn : k.symbol} groesse={21} farbe={an ? f.minze : "rgba(255,255,255,0.72)"} gewicht={an ? "semibold" : "regular"} />
                {an && mitWort ? <T v="klein" farbe={f.minze} stil={{ ...SCHRIFT.bold }} numberOfLines={1} maxFontSizeMultiplier={1.35}>{TEXT.tabs_kurz[k.id]}</T> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.neu_titel} accessibilityShowsLargeContentViewer accessibilityLargeContentTitle={TEXT.neu_titel} onPress={erstellen.oeffnen} hitSlop={4} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, marginLeft: 6, backgroundColor: f.minze, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Symbol name="plus" groesse={22} farbe={f.buehneKnopfText} gewicht="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const Wurzel = createNativeStackNavigator();
const TabStapel = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

/** Stapel eines Tabs: erste Seite mit der Bühne, Unterseiten schieben sich herein (Zurück-Geste wie in iOS). */
function TabSeiten({ route }: { route: { name: string } }) {
  const f = useFarben();
  const Erste = SEITE[route.name as Tab];
  return (
    <TabStapel.Navigator screenOptions={kopfOptionen(f)}>
      <TabStapel.Screen name="Wurzel" component={Erste} options={{ headerShown: false, title: TEXT.tabs[route.name as Tab], contentStyle: { backgroundColor: f.buehne } }} />
      <TabStapel.Screen name="Seite" component={InhaltSeite} />
    </TabStapel.Navigator>
  );
}

function TabLeiste() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(p: BottomTabBarProps) => <Kapsel {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.id} name={t.id} component={TabSeiten} options={{ title: TEXT.tabs[t.id] }} />
      ))}
    </Tabs.Navigator>
  );
}

const navRef = createNavigationContainerRef<ParamListBase>();

/** Name des sichtbaren Tabs aus dem Navigationszustand. */
function aktiverTab(): Tab | null {
  const tabs = navRef.getRootState()?.routes.find((r) => r.name === "Tabs")?.state;
  const r = tabs && typeof tabs.index === "number" ? tabs.routes[tabs.index] : undefined;
  return r ? (r.name as Tab) : null;
}

/** Liegt die Tab-Leiste gerade frei (kein Blatt darüber)? – für die Lage der Meldungen. */
function tabsOben(): boolean {
  const st = navRef.isReady() ? navRef.getRootState() : undefined;
  return !st || st.routes[st.index ?? 0]?.name === "Tabs";
}

function BlattSeite() {
  return <Blatt />;
}

/** Navigation der App: oben die Tabs (bzw. die Ladefehler-Seite), darüber Blätter für Abläufe und „Neu erstellen“. */
function Navigation({ erste }: { erste: () => React.JSX.Element }) {
  const f = useFarben();
  const dunkel = useColorScheme() === "dark";
  const { tab, tabWechseln } = useAmtlos();
  const thema = useMemo(() => {
    const basis = dunkel ? DarkTheme : DefaultTheme;
    return { ...basis, colors: { ...basis.colors, primary: f.amt, background: f.papier, card: f.papier, text: f.tinte, border: f.linie } };
  }, [dunkel, f]);
  // Tab im Zustand und Tab in der Navigation abgleichen – über den zuletzt abgeglichenen Tab, nicht über den Vergleich
  // beider Seiten: Ändern sich beide im selben Durchgang (Blatt schließt, Tab wechselt), liefen sie sonst gegeneinander
  // („heute“ ↔ „pflichten“ ohne Ende, React-Fehler #185). Jede Seite meldet nur, was sich bei ihr geändert hat.
  const abgeglichen = useRef<Tab>(tab);
  // Tab aus dem Zustand (z. B. „Zu den Unterlagen“) → Navigation
  useEffect(() => {
    if (tab === abgeglichen.current) return;
    abgeglichen.current = tab;
    if (navRef.isReady() && aktiverTab() !== tab) navRef.navigate("Tabs", { screen: tab }, { pop: true });
  }, [tab]);
  const wurzelNav = navRef as unknown as NavigationProp<ParamListBase>;
  return (
    <WurzelNavKontext.Provider value={wurzelNav}>
      <NavigationContainer
        ref={navRef}
        theme={thema}
        onStateChange={() => {
          // Navigation (Tippen auf einen Tab, Zurück) → Zustand – nur, wenn sich der sichtbare Tab wirklich geändert hat
          const t = aktiverTab();
          if (!t || t === abgeglichen.current) return;
          abgeglichen.current = t;
          tabWechseln(t);
        }}
      >
        <Wurzel.Navigator screenOptions={{ ...kopfOptionen(f), headerShown: false }}>
          <Wurzel.Screen name="Tabs" component={erste} />
          {/* Abläufe und Formulare als Blatt von unten (pageSheet), wegwischbar */}
          <Wurzel.Screen name="Blatt" component={BlattSeite} options={{ presentation: istIos ? "pageSheet" : "card" }} />
          <Wurzel.Screen name="Neu" component={NeuBlatt} options={{ presentation: istIos ? "pageSheet" : "card" }} />
        </Wurzel.Navigator>
      </NavigationContainer>
    </WurzelNavKontext.Provider>
  );
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
  const { bereit, ladefehler } = useAmtlos();
  const f = useFarben();
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
  return <Navigation erste={ladefehler ? LadefehlerWurzel : TabLeiste} />;
}

function LadefehlerWurzel() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LadefehlerSeite />
    </SafeAreaView>
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
  // Onest (E-142) – bis sie geladen ist, bleibt der Startbildschirm stehen
  const schrift = useSchrift();
  if (!schrift) return null;
  return (
    <SafeAreaProvider>
      <AmtlosAnbieter>
        <KontoAnbieter>
          <StatusBar style={dunkel ? "light" : "dark"} />
          <ErinnerungsPlaner />
          <AutoSicherung />
          <Sperre>
            <MeldungAnbieter imTab={tabsOben}>
              <Rahmen />
            </MeldungAnbieter>
          </Sperre>
          <TastaturLeiste />
        </KontoAnbieter>
      </AmtlosAnbieter>
    </SafeAreaProvider>
  );
}
