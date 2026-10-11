import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from "@expo-google-fonts/atkinson-hyperlegible";
import { BlurView } from "expo-blur";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { beiTippen } from "./push";
import { Anmelden } from "./seiten/Anmelden";
import { FinanzenStart } from "./seiten/finanzen/FinanzenStart";
import { Heute } from "./seiten/Heute";
import { Mehr } from "./seiten/Mehr";
import { PersonalStart } from "./seiten/personal/PersonalStart";
import { Pflichten } from "./seiten/Pflichten";
import { Schnellstart } from "./seiten/Schnellstart";
import { Symbol, T } from "./ui/bausteine";
import { Stapel } from "./ui/navigation";
import { ZIEL, istIos, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos } from "./zustand";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs (E-120): was täglich gebraucht wird; alles Weitere unter „Mehr“. Stempeln liegt bei Personal, Beleg bei Finanzen. */
type Tab = "heute" | "pflichten" | "finanzen" | "personal" | "mehr";
const TABS: { id: Tab; symbol: string }[] = [
  { id: "heute", symbol: "calendar" },
  { id: "pflichten", symbol: "checklist" },
  { id: "finanzen", symbol: "eurosign" },
  { id: "personal", symbol: "person.2" },
  { id: "mehr", symbol: "ellipsis.circle" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: Pflichten, finanzen: FinanzenStart, personal: PersonalStart, mehr: Mehr };

/** Tab-Leiste: unscharfer Hintergrund (iOS), SF Symbols, der aktive Tab in Handlungsfarbe. */
function Leiste({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  // Erneutes Tippen auf den aktiven Tab führt zur ersten Seite (setTab erkennt das)
  const { t } = useAmtlos();
  const f = useFarben();
  const dunkel = useColorScheme() === "dark";
  const inset = useSafeAreaInsets();
  const inhalt = (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingBottom: inset.bottom, borderTopWidth: 0.5, borderColor: f.linie }}>
      {TABS.map((k) => {
        const an = k.id === tab;
        return (
          <Pressable key={k.id} accessibilityRole="tab" accessibilityLabel={t.mobil.tabs[k.id]} accessibilityState={{ selected: an }} onPress={() => setTab(k.id)} style={{ flex: 1, minHeight: ZIEL + 6, alignItems: "center", justifyContent: "center", gap: 3, paddingTop: 6 }}>
            <Symbol name={k.symbol} groesse={24} farbe={an ? f.amt : f.tinteLeise} gewicht={an ? "semibold" : "regular"} />
            <T v="caption" fett={an} farbe={an ? f.amt : f.tinteLeise} stil={{ fontSize: 11, lineHeight: 13 }}>{t.mobil.tabs[k.id]}</T>
          </Pressable>
        );
      })}
    </View>
  );
  if (istIos) return <BlurView intensity={80} tint={dunkel ? "dark" : "light"} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>{inhalt}</BlurView>;
  return <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: f.blatt }}>{inhalt}</View>;
}

function Rahmen() {
  const { bereit, ich, profilFehlt, profilFehltSetzen, t } = useAmtlos();
  const f = useFarben();
  const [tab, setTabRoh] = useState<Tab>("heute");
  const [zurueck, setZurueck] = useState<Record<Tab, number>>({ heute: 0, pflichten: 0, finanzen: 0, personal: 0, mehr: 0 });
  const [besucht, setBesucht] = useState<Set<Tab>>(new Set(["heute"]));
  const setTab = (t: Tab) => {
    if (t === tab) setZurueck((z) => ({ ...z, [t]: z[t] + 1 }));
    setBesucht((b) => (b.has(t) ? b : new Set([...b, t])));
    setTabRoh(t);
  };
  useEffect(() => beiTippen((link) => setTabRoh(link.startsWith("/pflichten") ? "pflichten" : "heute")), []);
  useEffect(() => {
    if (bereit) void SplashScreen.hideAsync().catch(() => undefined);
  }, [bereit]);

  if (!bereit)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: f.papier }}>
        <ActivityIndicator color={f.amt} accessibilityLabel={t.app.name} />
      </View>
    );
  if (!ich)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }}>
        <Anmelden />
      </SafeAreaView>
    );
  if (profilFehlt) return <Schnellstart fertig={() => profilFehltSetzen(false)} />;
  // Besuchte Tabs bleiben eingehängt, damit Unterseiten und Scrollposition beim Wechseln erhalten bleiben
  return (
    <View style={{ flex: 1, backgroundColor: f.papier }}>
      {TABS.filter((x) => besucht.has(x.id)).map((x) => {
        const Wurzel = SEITE[x.id];
        const an = x.id === tab;
        return (
          <View key={x.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: an ? 1 : 0 }} pointerEvents={an ? "auto" : "none"} importantForAccessibility={an ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!an}>
            <Stapel
              zuruecksetzen={zurueck[x.id]}
              wurzel={
                <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
                  <Wurzel />
                </SafeAreaView>
              }
            />
          </View>
        );
      })}
      <Leiste tab={tab} setTab={setTab} />
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
