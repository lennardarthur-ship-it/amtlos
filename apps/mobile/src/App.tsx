import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { beiTippen } from "./push";
import { Anmelden } from "./seiten/Anmelden";
import { Beleg } from "./seiten/Beleg";
import { Heute } from "./seiten/Heute";
import { Mehr } from "./seiten/Mehr";
import { Pflichten } from "./seiten/Pflichten";
import { Stempeln } from "./seiten/Stempeln";
import { GROESSE, ZIEL, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos } from "./zustand";

type Tab = "heute" | "pflichten" | "stempeln" | "beleg" | "mehr";
const TABS: Tab[] = ["heute", "pflichten", "stempeln", "beleg", "mehr"];
const SEITE: Record<Tab, () => React.JSX.Element> = { heute: Heute, pflichten: Pflichten, stempeln: Stempeln, beleg: Beleg, mehr: Mehr };

function Rahmen() {
  const { bereit, ich, t } = useAmtlos();
  const f = useFarben();
  const [tab, setTab] = useState<Tab>("heute");
  // Tippen auf eine Push-Erinnerung öffnet die Pflichten
  useEffect(() => beiTippen((link) => setTab(link.startsWith("/pflichten") ? "pflichten" : "heute")), []);

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
  const Aktiv = SEITE[tab];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1 }}>
        <Aktiv />
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderColor: f.linie, backgroundColor: f.blatt }}>
        {TABS.map((k) => {
          const an = k === tab;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: an }}
              onPress={() => setTab(k)}
              style={{ flex: 1, minHeight: ZIEL + 8, alignItems: "center", justifyContent: "center", borderTopWidth: 3, borderColor: an ? f.amt : "transparent" }}
            >
              <Text style={{ fontSize: GROESSE.klein, fontWeight: an ? "700" : "400", color: an ? f.amt : f.tinteLeise }}>{t.mobil.tabs[k]}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const dunkel = useColorScheme() === "dark";
  return (
    <SafeAreaProvider>
      <AmtlosAnbieter>
        <StatusBar style={dunkel ? "light" : "dark"} />
        <Rahmen />
      </AmtlosAnbieter>
    </SafeAreaProvider>
  );
}
