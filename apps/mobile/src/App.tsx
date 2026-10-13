import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from "@expo-google-fonts/atkinson-hyperlegible";
import { BlurView } from "expo-blur";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, InputAccessoryView, Keyboard, Platform, Pressable, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Betrieb } from "./seiten/Betrieb";
import { ErinnerungsPlaner, PflichtenTab } from "./seiten/Pflichten";
import { Meine } from "./seiten/Meine";
import { AutoSicherung } from "./seiten/Sicherung";
import { Unterlagen } from "./seiten/Unterlagen";
import { T as TEXT } from "./texte";
import { Knopf, Symbol, T } from "./ui/bausteine";
import { MeldungAnbieter } from "./ui/meldung";
import { entsperren } from "./unterlagen/sperre";
import { Stapel } from "./ui/navigation";
import { TASTATUR_FERTIG, ZIEL, istIos, useFarben } from "./ui/thema";
import { AmtlosAnbieter, useAmtlos, type Tab } from "./zustand";
import { KontoAnbieter } from "./konto/konto";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tabs: Pflichten zuerst (E-129, das Alleinstellungsmerkmal), dann Vorlagen, eigene Unterlagen, Betrieb. */
const TABS: { id: Tab; symbol: string }[] = [
  { id: "pflichten", symbol: "checklist" },
  { id: "unterlagen", symbol: "doc.text" },
  { id: "meine", symbol: "folder" },
  { id: "betrieb", symbol: "building.2" },
];
const SEITE: Record<Tab, () => React.JSX.Element> = { pflichten: PflichtenTab, unterlagen: Unterlagen, meine: Meine, betrieb: Betrieb };

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
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier, padding: 24, justifyContent: "center", alignItems: "center", gap: 12 }}>
      <Symbol name="lock.fill" groesse={44} farbe={f.amt} />
      <T v="titel" accessibilityRole="header">{TEXT.gesperrt_titel}</T>
      <T leise>{TEXT.gesperrt_text}</T>
      <Knopf symbol="faceid" text={TEXT.entsperren} onPress={los} stil={{ alignSelf: "stretch", marginTop: 16 }} />
    </SafeAreaView>
  );
}

function Rahmen() {
  const { bereit, ladefehler, tab, tabWechseln } = useAmtlos();
  const f = useFarben();
  const [zurueck, setZurueck] = useState<Record<Tab, number>>({ pflichten: 0, unterlagen: 0, meine: 0, betrieb: 0 });
  const [besucht, setBesucht] = useState<Set<Tab>>(new Set(["pflichten"]));
  // geführte Abläufe laufen im Vollbild – ohne Tab-Leiste, mit eigenem Knopf unten
  const [voll, setVoll] = useState<Record<Tab, boolean>>({ pflichten: false, unterlagen: false, meine: false, betrieb: false });
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
      {ladefehler ? (
        <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <View accessibilityRole="alert" style={{ margin: 12, padding: 12, borderRadius: 10, backgroundColor: f.fristHauch }}>
            <T v="klein" fett farbe={f.frist}>{TEXT.ladefehler}</T>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

/** „Fertig“ über Zahlentastaturen (iOS hat dort keine Eingabetaste) – alle Zahlen- und Datumsfelder hängen daran. */
function TastaturLeiste() {
  const f = useFarben();
  if (!istIos) return null;
  return (
    <InputAccessoryView nativeID={TASTATUR_FERTIG} backgroundColor={f.papier}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", borderTopWidth: 0.5, borderColor: f.linie }}>
        <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 20, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
          <T fett farbe={f.amt}>{TEXT.tastatur_fertig}</T>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export default function App() {
  const dunkel = useColorScheme() === "dark";
  const [schriftGeladen] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
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
