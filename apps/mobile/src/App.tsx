import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, InputAccessoryView, Keyboard, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Betrieb } from "./seiten/Betrieb";
import { ErinnerungsPlaner, PflichtenTab } from "./seiten/Pflichten";
import { Meine } from "./seiten/Meine";
import { AutoSicherung, WiederherstellenSeite } from "./seiten/Sicherung";
import { Heute } from "./seiten/Heute";
import { NeuBlatt } from "./seiten/Erstellen";
import { T as TEXT } from "./texte";
import { Kachel, Karte, Knopf, Symbol, T, TextKnopf } from "./ui/bausteine";
import { MeldungAnbieter } from "./ui/meldung";
import { useSchrift } from "./ui/schrift";
import { entsperren } from "./unterlagen/sperre";
import { Blatt, InhaltSeite, WurzelNavKontext, kopfOptionen, useNav } from "./ui/navigation";
import { HAARLINIE, TASTATUR_FERTIG, istIos, schattenStil, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos, type Tab } from "./zustand";
import { KontoAnbieter } from "./konto/konto";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs (E-141): „Heute“ als Start, Pflichten, eigene Unterlagen, Betrieb – „+“ sitzt oben rechts in der Leiste. */
const TABS: { id: Tab; symbol: string; symbolAn: string }[] = [
  { id: "heute", symbol: "house", symbolAn: "house.fill" },
  { id: "pflichten", symbol: "checklist", symbolAn: "checklist" },
  { id: "meine", symbol: "folder", symbolAn: "folder.fill" },
  { id: "betrieb", symbol: "building.2", symbolAn: "building.2.fill" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: PflichtenTab, meine: Meine, betrieb: Betrieb };

/**
 * Web-Vorschau der Tab-Leiste (auf dem iPhone ist es die echte iOS-26-Leiste mit Glas): schwebende Kapsel, der aktive
 * Tab mit Pille hinterlegt. Erneutes Tippen auf den aktiven Tab führt zur ersten Seite.
 */
function WebLeiste({ state, navigation }: BottomTabBarProps) {
  const f = useFarben();
  const dunkel = useColorScheme() === "dark";
  const inset = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(inset.bottom - 8, 10), paddingHorizontal: 22 }}>
      <View accessibilityRole="tablist" style={[{ flexDirection: "row", padding: 4, borderRadius: 32, backgroundColor: dunkel ? "rgba(28,28,30,0.96)" : "rgba(255,255,255,0.96)", borderWidth: HAARLINIE, borderColor: dunkel ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }, schattenStil(f, 1.6)]}>
        {state.routes.map((r, i) => {
          const k = TABS.find((t) => t.id === r.name)!;
          const an = i === state.index;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityLabel={TEXT.tabs[k.id]}
              accessibilityState={{ selected: an }}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: r.key, canPreventDefault: true });
                if (!an && !e.defaultPrevented) navigation.navigate(r.name);
              }}
              style={{ flex: 1, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: an ? (dunkel ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)") : "transparent" }}
            >
              <Symbol name={an ? k.symbolAn : k.symbol} groesse={22} farbe={an ? f.amt : f.tinte} gewicht={an ? "semibold" : "regular"} />
              <T v="mini" farbe={an ? f.amt : f.tinte} stil={{ fontSize: 10, ...(an ? { fontWeight: "600" } : null) }}>{TEXT.tabs[k.id]}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Wurzel = createNativeStackNavigator();
const TabStapel = createNativeStackNavigator();
// iPhone: die echte Tab-Leiste (UITabBarController, Glas in iOS 26); Web/Android: dieselbe Struktur mit Nachbildung
const Tabs = istIos ? createNativeBottomTabNavigator() : createBottomTabNavigator();

/** Stapel eines Tabs: erste Seite mit großem Titel, Unterseiten schieben sich herein (Zurück-Geste wie in iOS). */
function TabSeiten({ route }: { route: { name: string } }) {
  const f = useFarben();
  const Erste = SEITE[route.name as Tab];
  return (
    <TabStapel.Navigator screenOptions={kopfOptionen(f)}>
      <TabStapel.Screen name="Wurzel" component={Erste} options={{ headerShown: istIos }} />
      <TabStapel.Screen name="Seite" component={InhaltSeite} />
    </TabStapel.Navigator>
  );
}

function TabLeiste() {
  const f = useFarben();
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false, tabBarActiveTintColor: f.amt, ...(istIos ? { tabBarMinimizeBehavior: "onScrollDown" } : null) } as never}
      {...(istIos ? {} : { tabBar: (p: BottomTabBarProps) => <WebLeiste {...p} /> })}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.id} name={t.id} component={TabSeiten} options={{ title: TEXT.tabs[t.id], ...(istIos ? { tabBarIcon: ({ focused }: { focused: boolean }) => ({ type: "sfSymbol", name: focused ? t.symbolAn : t.symbol }) } : null) } as never} />
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
  // Tab aus dem Zustand (z. B. „Zu den Unterlagen“) → Navigation
  useEffect(() => {
    if (navRef.isReady() && aktiverTab() && aktiverTab() !== tab) navRef.navigate("Tabs", { screen: tab });
  }, [tab]);
  const wurzelNav = navRef as unknown as NavigationProp<ParamListBase>;
  return (
    <WurzelNavKontext.Provider value={wurzelNav}>
      <NavigationContainer
        ref={navRef}
        theme={thema}
        onStateChange={() => {
          const t = aktiverTab();
          if (t && t !== tab) tabWechseln(t);
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
  // Systemschrift (SF Pro) auf dem iPhone; in der Web-Vorschau Inter (E-140)
  useSchrift();
  return (
    <SafeAreaProvider>
      <AmtlosAnbieter>
        <KontoAnbieter>
          <StatusBar style={dunkel ? "light" : "dark"} />
          <ErinnerungsPlaner />
          <AutoSicherung />
          <Sperre>
            <MeldungAnbieter unten={84}>
              <Rahmen />
            </MeldungAnbieter>
          </Sperre>
          <TastaturLeiste />
        </KontoAnbieter>
      </AmtlosAnbieter>
    </SafeAreaProvider>
  );
}
