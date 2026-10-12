import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from "@expo-google-fonts/atkinson-hyperlegible";
import { BlurView } from "expo-blur";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Betrieb } from "./seiten/Betrieb";
import { Meine } from "./seiten/Meine";
import { Unterlagen } from "./seiten/Unterlagen";
import { T as TEXT } from "./texte";
import { Symbol, T } from "./ui/bausteine";
import { Stapel } from "./ui/navigation";
import { ZIEL, istIos, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos, type Tab } from "./zustand";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs (E-121): Vorlagen wählen, eigene Unterlagen, Betrieb. Keine Erinnerungen, kein Fragebogen. */
const TABS: { id: Tab; symbol: string }[] = [
  { id: "unterlagen", symbol: "doc.text" },
  { id: "meine", symbol: "folder" },
  { id: "betrieb", symbol: "building.2" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { unterlagen: Unterlagen, meine: Meine, betrieb: Betrieb };

/** Tab-Leiste: unscharfer Hintergrund (iOS), SF Symbols, der aktive Tab in Handlungsfarbe. */
function Leiste({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  // Erneutes Tippen auf den aktiven Tab führt zur ersten Seite (setTab erkennt das)
  const f = useFarben();
  const dunkel = useColorScheme() === "dark";
  const inset = useSafeAreaInsets();
  const inhalt = (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingBottom: inset.bottom, borderTopWidth: 0.5, borderColor: f.linie }}>
      {TABS.map((k) => {
        const an = k.id === tab;
        return (
          <Pressable key={k.id} accessibilityRole="tab" accessibilityLabel={TEXT.tabs[k.id]} accessibilityState={{ selected: an }} onPress={() => setTab(k.id)} style={{ flex: 1, minHeight: ZIEL + 6, alignItems: "center", justifyContent: "center", gap: 3, paddingTop: 6 }}>
            <Symbol name={k.symbol} groesse={24} farbe={an ? f.amt : f.tinteLeise} gewicht={an ? "semibold" : "regular"} />
            <T v="caption" fett={an} farbe={an ? f.amt : f.tinteLeise} stil={{ fontSize: 11, lineHeight: 13 }}>{TEXT.tabs[k.id]}</T>
          </Pressable>
        );
      })}
    </View>
  );
  if (istIos) return <BlurView intensity={80} tint={dunkel ? "dark" : "light"} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>{inhalt}</BlurView>;
  return <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: f.blatt }}>{inhalt}</View>;
}

function Rahmen() {
  const { bereit, tab, tabWechseln } = useAmtlos();
  const f = useFarben();
  const [zurueck, setZurueck] = useState<Record<Tab, number>>({ unterlagen: 0, meine: 0, betrieb: 0 });
  const [besucht, setBesucht] = useState<Set<Tab>>(new Set(["unterlagen"]));
  // geführte Abläufe laufen im Vollbild – ohne Tab-Leiste, mit eigenem Knopf unten
  const [voll, setVoll] = useState<Record<Tab, boolean>>({ unterlagen: false, meine: false, betrieb: false });
  const vollSetzer = useMemo(() => Object.fromEntries(TABS.map((x) => [x.id, (an: boolean) => setVoll((v) => (v[x.id] === an ? v : { ...v, [x.id]: an }))])) as Record<Tab, (an: boolean) => void>, []);
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
  // Besuchte Tabs bleiben eingehängt, damit Unterseiten und Scrollposition beim Wechseln erhalten bleiben
  return (
    <View style={{ flex: 1, backgroundColor: f.papier }}>
      {TABS.filter((x) => besucht.has(x.id) || x.id === tab).map((x) => {
        const Wurzel = SEITE[x.id];
        const an = x.id === tab;
        return (
          // Im Web greift pointerEvents="none" nicht auf alle Kinder – verborgene Tabs dort ausblenden
          <View key={x.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: an ? 1 : 0, display: Platform.OS === "web" && !an ? "none" : "flex" }} pointerEvents={an ? "auto" : "none"} importantForAccessibility={an ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!an}>
            <Stapel
              zuruecksetzen={zurueck[x.id]}
              vollbild={vollSetzer[x.id]}
              wurzel={
                <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
                  <Wurzel />
                </SafeAreaView>
              }
            />
          </View>
        );
      })}
      {voll[tab] ? null : <Leiste tab={tab} setTab={setTab} />}
    </View>
  );
}

export default function App() {
  const dunkel = useColorScheme() === "dark";
  const [schriftGeladen] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  if (!schriftGeladen && Platform.OS !== "web") return null;
  return (
    <SafeAreaProvider>
      <AmtlosAnbieter>
        <StatusBar style={dunkel ? "light" : "dark"} />
        <Rahmen />
      </AmtlosAnbieter>
    </SafeAreaProvider>
  );
}
