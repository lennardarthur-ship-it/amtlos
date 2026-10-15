import { StackActions, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Symbol, T } from "./bausteine";
import { RAND, ZIEL, istIos, useFarben, type Farben } from "./thema";

/**
 * Navigation (E-141): echte iOS-Navigation mit react-native-screens – UINavigationController mit großen Titeln,
 * Zurück-Geste und Glas-Knöpfen, Abläufe als Blätter (pageSheet). Die Seiten öffnen sich weiter mit
 * `useNav().oeffnen(schluessel, inhalt, vollbild)`; `vollbild` heißt jetzt: als Blatt von unten (ohne Tab-Leiste).
 */
export interface Nav {
  /** Seite öffnen; ist derselbe Schlüssel schon offen, passiert nichts. `vollbild`: als Blatt (Abläufe, Formulare mit Fußleiste). */
  oeffnen(schluessel: string, inhalt: () => ReactNode, vollbild?: boolean): void;
  zurueck(): void;
}

// Inhalte der geöffneten Seiten – die Route trägt nur die Kennung (Funktionen gehören nicht in den Navigationszustand)
const INHALTE = new Map<string, () => ReactNode>();
let zaehler = 0;
export function registrieren(inhalt: () => ReactNode): string {
  const id = `s${++zaehler}`;
  INHALTE.set(id, inhalt);
  return id;
}
export type SeitenParams = { id: string; schluessel: string };

/** Navigator der obersten Ebene (für Blätter), in einem Blatt: ob wir darin sind. */
export const WurzelNavKontext = createContext<NavigationProp<ParamListBase> | null>(null);
const BlattKontext = createContext(false);

const offen = (nav: NavigationProp<ParamListBase> | null, schluessel: string) => Boolean(nav?.getState()?.routes.some((r) => (r.params as Partial<SeitenParams> | undefined)?.schluessel === schluessel));

export function useNav(): Nav {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const wurzel = useContext(WurzelNavKontext);
  return useMemo<Nav>(
    () => ({
      oeffnen(schluessel, inhalt, vollbild = false) {
        if (offen(navigation, schluessel) || offen(wurzel, schluessel)) return;
        const params: SeitenParams = { id: registrieren(inhalt), schluessel };
        // `vollbild` öffnet ein eigenes Blatt (auch über einem Blatt – iOS stapelt Blätter); sonst schiebt sich die Seite herein
        if (vollbild && wurzel) wurzel.dispatch(StackActions.push("Blatt", params));
        else navigation.dispatch(StackActions.push("Seite", params));
      },
      zurueck() {
        if (navigation.canGoBack()) navigation.goBack();
        else wurzel?.goBack();
      },
    }),
    [navigation, wurzel],
  );
}

/** Zeigt den registrierten Inhalt einer Route. */
export function InhaltSeite() {
  const params = useRoute().params as SeitenParams | undefined;
  const inhalt = params ? INHALTE.get(params.id) : undefined;
  return <>{inhalt ? inhalt() : null}</>;
}

/** Kopfzeilen-Stil: iOS nutzt die Systemleiste (Glas, große Titel); im Web eine ruhige Nachbildung. */
export function kopfOptionen(f: Farben): NativeStackNavigationOptions {
  return {
    headerTintColor: f.amt,
    headerBackTitle: TEXT.zurueck,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: f.papier },
    headerTitleStyle: { color: f.tinte, fontWeight: "600" },
    headerLargeTitleStyle: { color: f.tinte },
    contentStyle: { backgroundColor: f.papier },
    ...(Platform.OS === "web"
      ? {
          headerLeft: (p) => (p.canGoBack ? <WebZurueck /> : null),
          headerTitleAlign: "center",
          // lange Titel kürzen statt mit den Knöpfen zu kollidieren (das iPhone macht das selbst)
          headerTitle: ({ children }) => <T fett numberOfLines={1} stil={{ maxWidth: 220 }}>{children}</T>,
        }
      : null),
  };
}

function WebZurueck() {
  const nav = useNav();
  return <RundKnopf symbol="chevron.left" label={TEXT.zurueck} onPress={nav.zurueck} />;
}

/** Runder Knopf für die Kopfzeile im Web (auf dem iPhone übernimmt das die Systemleiste mit Glas). */
export function RundKnopf({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center", marginHorizontal: RAND - 18, opacity: pressed ? 0.55 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: f.blatt, alignItems: "center", justifyContent: "center" }}>
        <Symbol name={symbol} groesse={15} farbe={f.tinte} gewicht="bold" />
      </View>
    </Pressable>
  );
}

/** Textknopf rechts in der Kopfzeile (Web; iOS nutzt Systemknöpfe). */
export function KopfText({ text, onPress, label }: { text: string; onPress: () => void; label?: string }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ minHeight: ZIEL, justifyContent: "center", paddingHorizontal: RAND - 6, opacity: pressed ? 0.55 : 1 })}>
      <T fett farbe={f.amt}>{text}</T>
    </Pressable>
  );
}

export interface KopfKnopfDef {
  text: string;
  onPress: () => void;
  /** SF Symbol – dann als runder Glas-Knopf mit Symbol (Beschriftung für VoiceOver) */
  symbol?: string;
  hervor?: boolean;
  label?: string;
}

/**
 * Kopfzeile der aktuellen Seite setzen: Titel, optional ein Knopf rechts, `schliessen` links (erste Seite eines Blatts).
 * Auf dem iPhone werden daraus echte Leistenknöpfe (Glas, iOS 26).
 */
export function useKopf({ titel, rechts, schliessen, gross }: { titel: string; rechts?: KopfKnopfDef | null; schliessen?: boolean; gross?: boolean }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const nav = useNav();
  // „Schließen“ setzt der Blatt-Stapel selbst auf seine erste Seite (siehe `Blatt`)
  void schliessen;
  const zeigeSchliessen = false;
  // Handler über eine Referenz: neue Funktionen je Render setzen die Kopfzeile nicht ständig neu
  const druck = useRef(rechts?.onPress);
  druck.current = rechts?.onPress;
  const zu = useRef(nav.zurueck);
  zu.current = nav.zurueck;
  useLayoutEffect(() => {
    const aufRechts = () => druck.current?.();
    const schliessenDruck = () => zu.current();
    const o: NativeStackNavigationOptions = { title: titel, headerLargeTitle: Boolean(gross) && istIos };
    if (istIos) {
      o.unstable_headerLeftItems = zeigeSchliessen ? () => [{ type: "button", label: TEXT.schliessen, icon: { type: "sfSymbol", name: "xmark" }, onPress: schliessenDruck }] : undefined;
      o.unstable_headerRightItems = rechts
        ? () => [{ type: "button", label: rechts.text, accessibilityLabel: rechts.label ?? rechts.text, onPress: aufRechts, ...(rechts.symbol ? { icon: { type: "sfSymbol" as const, name: rechts.symbol as never } } : null), ...(rechts.hervor ? { variant: "prominent" as const } : null) }]
        : undefined;
    } else {
      if (zeigeSchliessen) o.headerLeft = () => <RundKnopf symbol="xmark" label={TEXT.schliessen} onPress={schliessenDruck} />;
      o.headerRight = rechts ? () => (rechts.symbol ? <RundKnopf symbol={rechts.symbol} label={rechts.label ?? rechts.text} onPress={aufRechts} /> : <KopfText text={rechts.text} label={rechts.label} onPress={aufRechts} />) : undefined;
    }
    navigation.setOptions(o);
    // Handler stehen in Referenzen
  }, [navigation, titel, Boolean(rechts), rechts?.text, rechts?.symbol, rechts?.label, rechts?.hervor, zeigeSchliessen, gross]);
}

/** Unterseite: setzt die Kopfzeile (Titel, Knopf rechts) und zeigt den Inhalt. */
export function Unterseite({ titel, children, rechts, schliessen }: { titel: string; children: ReactNode; rechts?: KopfKnopfDef | null; schliessen?: boolean }) {
  useKopf({ titel, rechts, schliessen: schliessen ?? true });
  const f = useFarben();
  return <View style={{ flex: 1, backgroundColor: f.papier }}>{children}</View>;
}

const BlattStapel = createNativeStackNavigator();

function BlattSchliessen() {
  const navigation = useNavigation();
  return <RundKnopf symbol="xmark" label={TEXT.schliessen} onPress={() => navigation.getParent()?.goBack()} />;
}

/** Erste Seite eines Blatts: links „Schließen“ (iPhone: Glasknopf der Leiste). */
const erstesBlattOptionen = ({ navigation }: { navigation: NavigationProp<ParamListBase> }): NativeStackNavigationOptions =>
  istIos
    ? { unstable_headerLeftItems: () => [{ type: "button", label: TEXT.schliessen, icon: { type: "sfSymbol", name: "xmark" }, onPress: () => navigation.getParent()?.goBack() }] }
    : { headerLeft: () => <BlattSchliessen /> };

/** Ein Blatt (Ablauf, Formular): eigener Stapel – Unterseiten schieben sich im Blatt herein, „Schließen“ schließt es. */
export function Blatt({ params }: { params?: SeitenParams }) {
  const f = useFarben();
  const route = useRoute();
  const p = params ?? (route.params as SeitenParams | undefined);
  return (
    <BlattKontext.Provider value>
      <BlattStapel.Navigator screenOptions={kopfOptionen(f)}>
        <BlattStapel.Screen name="Inhalt" component={InhaltSeite} initialParams={p} options={erstesBlattOptionen} />
        <BlattStapel.Screen name="Seite" component={InhaltSeite} />
      </BlattStapel.Navigator>
    </BlattKontext.Provider>
  );
}
