import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from "@expo-google-fonts/atkinson-hyperlegible";
import { BlurView } from "expo-blur";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { beiTippen } from "./push";
import { Anmelden } from "./seiten/Anmelden";
import { Beleg } from "./seiten/Beleg";
import { Heute } from "./seiten/Heute";
import { Mehr } from "./seiten/Mehr";
import { Pflichten } from "./seiten/Pflichten";
import { Schnellstart } from "./seiten/Schnellstart";
import { Stempeln } from "./seiten/Stempeln";
import { Symbol, T } from "./ui/bausteine";
import { ZIEL, istIos, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos } from "./zustand";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

type Tab = "heute" | "pflichten" | "stempeln" | "beleg" | "mehr";
const TABS: { id: Tab; symbol: string }[] = [
  { id: "heute", symbol: "calendar" },
  { id: "pflichten", symbol: "checklist" },
  { id: "stempeln", symbol: "clock" },
  { id: "beleg", symbol: "doc.viewfinder" },
  { id: "mehr", symbol: "ellipsis.circle" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: Pflichten, stempeln: Stempeln, beleg: Beleg, mehr: Mehr };

/** Tab-Leiste: unscharfer Hintergrund (iOS), SF Symbols, der aktive Tab in Handlungsfarbe. */
function Leiste({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
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
  const [tab, setTab] = useState<Tab>("heute");
  useEffect(() => beiTippen((link) => setTab(link.startsWith("/pflichten") ? "pflichten" : "heute")), []);
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
  const Aktiv = SEITE[tab];
  return (
    <View style={{ flex: 1, backgroundColor: f.papier }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <Aktiv />
      </SafeAreaView>
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
