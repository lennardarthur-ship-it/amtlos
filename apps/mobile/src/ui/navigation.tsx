import { StackActions, useIsFocused, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { createNativeStackNavigator, type NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { T as TEXT } from "../texte";
import { BuehnenText, Symbol, T, useGrosseSchrift } from "./bausteine";
import { MINZE, RADIUS, RAND, SCHRIFT, ZIEL, istIos, istNativ, useFarben, type Farben } from "./thema";
import { trennen } from "./trennen";
import { useAktionen } from "../zustand";

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
/**
 * Helle Statusleiste, solange diese Seite sichtbar ist (E-144: alle Leisten liegen auf der Bühne (Navy)). Über
 * expo-status-bar statt der Option der Navigationsleiste – die greift in dieser App nicht.
 */
export function HellerStatus() {
  return useIsFocused() ? <StatusBar style="light" /> : null;
}

/** Liegt die Seite in einem Blatt (ohne Tab-Leiste darunter)? */
export const useImBlatt = () => useContext(BlattKontext);

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

/**
 * Optionen der Tab-Seiten (R9 Performance): Nicht sichtbare Tabs werden eingefroren – eine Eingabe oder ein Tab-Wechsel
 * zeichnet nicht mehr alle vier Seiten neu. Beim Zurückkehren holt der Tab den aktuellen Stand nach.
 */
export const TAB_OPTIONEN = { headerShown: false, freezeOnBlur: true } as const;

/** Zeigt den registrierten Inhalt einer Route. */
export function InhaltSeite() {
  const params = useRoute().params as SeitenParams | undefined;
  const inhalt = params ? INHALTE.get(params.id) : undefined;
  const { sichern } = useAktionen();
  // geschlossene Seiten aus dem Verzeichnis nehmen
  useEffect(() => () => void (params && INHALTE.delete(params.id)), [params]);
  // Formular oder Unterseite verlassen: Ausstehendes gleich speichern, nicht erst nach der Tipp-Pause (R9 Performance)
  useEffect(() => () => sichern(), [sichern]);
  return <>{inhalt ? inhalt() : null}</>;
}

/** Kopfzeilen-Stil: iOS nutzt die Systemleiste (Glas, große Titel); im Web eine ruhige Nachbildung. */
export function kopfOptionen(f: Farben): NativeStackNavigationOptions {
  return {
    headerTintColor: f.amt,
    headerBackTitle: TEXT.zurueck,
    headerShadowVisible: false,
    // iOS: keine eigene Leistenfarbe – sonst verschwindet das Glas von iOS 26
    ...(istIos ? null : { headerStyle: { backgroundColor: f.papier } }),
    headerTitleStyle: { color: f.tinte, ...SCHRIFT.bold },
    headerLargeTitleStyle: { color: f.tinte, ...SCHRIFT.display },
    headerBackTitleStyle: { fontFamily: SCHRIFT.mittel.fontFamily },
    contentStyle: { backgroundColor: f.papier },
    // verdeckte Seiten (unter einer Unterseite oder einem Blatt) einfrieren – Tippen im Blatt zeichnet sie nicht neu
    freezeOnBlur: true,
    ...(Platform.OS === "web"
      ? {
          headerLeft: (p) => (p.canGoBack ? <WebZurueck buehne={p.tintColor === f.minze} /> : null),
          headerTitleAlign: "center",
          // lange Titel kürzen statt mit den Knöpfen zu kollidieren (das iPhone macht das selbst)
          headerTitle: webTitel(f.tinte),
        }
      : null),
  };
}

/** Web: Titel der Leiste gekürzt, in der passenden Farbe (auf der Bühne weiß). */
const webTitel = (farbe: string) =>
  function WebTitel({ children }: { children: string }) {
    // lässt links „Schließen“ und rechts „Übersicht“ Platz (A12) – lange Titel enden mit „…“; schmale Geräte weniger.
    // Schrift höchstens 130 % wie die Leiste des iPhones – bei 200 % lägen Titel und „Übersicht“ übereinander (G11)
    const { width, fontScale } = useWindowDimensions();
    // große Schrift oder schmal (R10): zwei kleinere Zeilen mit Trennstrich statt „Allergenlis…“
    const eng = fontScale > 1.3 || width < 340;
    return (
      <T fett v={eng ? "klein" : "basis"} numberOfLines={eng ? 2 : 1} maxFontSizeMultiplier={1.3} farbe={farbe} stil={{ maxWidth: eng ? Math.max(120, Math.min(220, width - 120)) : Math.max(96, Math.min(180, width - 210)), textAlign: "center" }}>
        {children}
      </T>
    );
  };

function WebZurueck({ buehne }: { buehne: boolean }) {
  const nav = useNav();
  return <RundKnopf symbol="chevron.left" label={TEXT.zurueck} onPress={nav.zurueck} buehne={buehne} />;
}

/**
 * Runder Knopf für die Kopfzeile im Web (auf dem iPhone übernimmt das die Systemleiste mit Glas). Auf der Bühne
 * Glasfläche mit weißem Zeichen; auf hellem Grund (`buehne={false}`) ruhige Fläche mit dunklem Zeichen – Weiß auf
 * Hell wäre kaum zu sehen. Ob die Leiste auf der Bühne liegt, verrät ihre Zeichenfarbe (Minze, siehe `useKopf`).
 */
export function RundKnopf({ symbol, label, onPress, buehne = true }: { symbol: string; label: string; onPress: () => void; buehne?: boolean }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center", marginHorizontal: RAND - 18, opacity: pressed ? 0.55 : 1 })}>
      {/* alle Leisten liegen auf der Bühne (E-144): Glasfläche mit weißem Zeichen */}
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: buehne ? f.buehneFlaeche : f.flaeche, alignItems: "center", justifyContent: "center" }}>
        <Symbol name={symbol} groesse={15} farbe={buehne ? f.buehneText : f.tinte} gewicht="bold" />
      </View>
    </Pressable>
  );
}

/** Textknopf rechts in der Kopfzeile (Web; iOS nutzt Systemknöpfe). */
export function KopfText({ text, onPress, label, buehne = true }: { text: string; onPress: () => void; label?: string; buehne?: boolean }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ minHeight: ZIEL, justifyContent: "center", paddingHorizontal: RAND - 6, opacity: pressed ? 0.55 : 1 })}>
      <T fett numberOfLines={1} maxFontSizeMultiplier={1.3} farbe={buehne ? f.minze : f.amt}>{text}</T>
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
export function useKopf({ titel, rechts, schliessen, gross, buehne }: { titel: string; rechts?: KopfKnopfDef | null; schliessen?: boolean; gross?: boolean; buehne?: boolean }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const f = useFarben();
  // große Schrift oder schmal (R10): Textknopf rechts als runder Symbolknopf – sonst läge „Übersicht“ über dem Titel
  const { fontScale, width } = useWindowDimensions();
  const eng = fontScale > 1.3 || width < 340;
  // Bühne (E-142): Leiste und Grund im Navy der Bühne, Schrift weiß, Knöpfe Minze – z. B. der Abschluss einer Rechnung
  useLayoutEffect(() => {
    if (buehne === undefined) return;
    navigation.setOptions(
      buehne
        ? { headerStyle: { backgroundColor: f.buehne }, headerTintColor: f.minze, headerTitleStyle: { color: f.buehneText, ...SCHRIFT.bold }, contentStyle: { backgroundColor: f.buehne }, ...(istIos ? null : { headerTitle: webTitel(f.buehneText) }) }
        : { headerStyle: istIos ? undefined : { backgroundColor: f.papier }, headerTintColor: f.amt, headerTitleStyle: { color: f.tinte, ...SCHRIFT.bold }, contentStyle: { backgroundColor: f.papier }, ...(istIos ? null : { headerTitle: webTitel(f.tinte) }) },
    );
  }, [navigation, buehne, f]);
  // „Schließen“ setzt der Blatt-Stapel selbst auf seine erste Seite (siehe `Blatt`) – hier nichts überschreiben
  void schliessen;
  // Handler über eine Referenz: neue Funktionen je Render setzen die Kopfzeile nicht ständig neu
  const druck = useRef(rechts?.onPress);
  druck.current = rechts?.onPress;
  useLayoutEffect(() => {
    const aufRechts = () => druck.current?.();
    // nur setzen, was diese Seite bestimmt: ein explizites `undefined` würde den Schließen-Knopf des Blatts löschen
    const o: NativeStackNavigationOptions = { title: titel };
    if (gross && istIos) o.headerLargeTitleEnabled = true;
    if (istIos) {
      o.unstable_headerRightItems = rechts
        ? () => [{ type: "button", label: rechts.text, accessibilityLabel: rechts.label ?? rechts.text, onPress: aufRechts, ...(rechts.symbol ? { icon: { type: "sfSymbol" as const, name: rechts.symbol as never } } : null), ...(rechts.hervor ? { variant: "prominent" as const } : null) }]
        : undefined;
    } else {
      o.headerRight = rechts ? (p: { tintColor?: string }) => (rechts.symbol || eng ? <RundKnopf symbol={rechts.symbol ?? "list.bullet"} label={rechts.label ?? rechts.text} onPress={aufRechts} buehne={p.tintColor === f.minze} /> : <KopfText text={rechts.text} label={rechts.label} onPress={aufRechts} buehne={p.tintColor === f.minze} />) : undefined;
    }
    navigation.setOptions(o);
    // Handler stehen in Referenzen
  }, [navigation, titel, Boolean(rechts), rechts?.text, rechts?.symbol, rechts?.label, rechts?.hervor, gross, f, eng]);
}

/**
 * Weicht der Tastatur aus – auch in Blättern unter einer Navigationsleiste. `KeyboardAvoidingView` rechnet mit der
 * eigenen Lage relativ zum Elternelement; in einem Blatt fehlt dabei der Abstand bis zum Bildschirmrand oben. Der
 * Abstand ergibt sich aus Fensterhöhe minus eigener Höhe (der untere Rand eines Blatts liegt am Bildschirmrand).
 */
export function TastaturRahmen({ children, grund }: { children: ReactNode; grund?: string }) {
  const f = useFarben();
  const { height: fenster } = useWindowDimensions();
  const [hoehe, setHoehe] = useState(0);
  return (
    <View style={{ flex: 1, backgroundColor: grund ?? f.papier }} onLayout={(e) => setHoehe(e.nativeEvent.layout.height)}>
      {/* Android (E-190): seit SDK 54 immer randlos (edge-to-edge) – das System verkleinert das Fenster nicht mehr für die
          Tastatur, also weicht die Seite wie auf dem iPhone selbst aus („padding“). Web: kein Ausweichen. */}
      <KeyboardAvoidingView behavior={istNativ ? "padding" : undefined} keyboardVerticalOffset={hoehe ? fenster - hoehe : 0} style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Unterseite (E-144): dunkle Leiste mit dem Titel groß darunter auf der Bühne, der Inhalt auf dem hellen Blatt –
 * Fußleisten bleiben über der Tastatur. Ohne Titel (z. B. gelöschter Eintrag) nur das Blatt.
 */
export function Unterseite({ titel, unter, children, rechts, schliessen }: { titel: string; unter?: string; children: ReactNode; rechts?: KopfKnopfDef | null; schliessen?: boolean }) {
  const f = useFarben();
  const gross = useGrosseSchrift();
  useKopf({ titel: "", rechts, schliessen: schliessen ?? true, buehne: true });
  return (
    <TastaturRahmen grund={f.buehne}>
      <HellerStatus />
      {titel ? (
        <View style={{ paddingHorizontal: RAND, paddingTop: 2, paddingBottom: 20 }}>
          <T v="titel" accessibilityRole="header" farbe={f.buehneText} numberOfLines={gross ? undefined : 3}>{trennen(titel)}</T>
          {/* R12 (UX #23): bei großer Schrift den Satz zuklappen – der Kopf der Kontrollmappe nahm sonst den halben Bildschirm */}
          {unter ? <BuehnenText text={unter} stil={{ marginTop: 6 }} kompakt={gross} /> : null}
        </View>
      ) : null}
      <View style={{ flex: 1, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, overflow: "hidden" }}>{children}</View>
    </TastaturRahmen>
  );
}

const BlattStapel = createNativeStackNavigator();

function BlattSchliessen({ buehne }: { buehne: boolean }) {
  const navigation = useNavigation();
  return <RundKnopf symbol="xmark" label={TEXT.schliessen} onPress={() => navigation.getParent()?.goBack()} buehne={buehne} />;
}

/** Erste Seite eines Blatts: links „Schließen“ (iPhone: Glasknopf der Leiste). */
const erstesBlattOptionen = ({ navigation }: { navigation: NavigationProp<ParamListBase> }): NativeStackNavigationOptions =>
  istIos
    ? { unstable_headerLeftItems: () => [{ type: "button", label: TEXT.schliessen, icon: { type: "sfSymbol", name: "xmark" }, onPress: () => navigation.getParent()?.goBack() }] }
    : { headerLeft: (p) => <BlattSchliessen buehne={p.tintColor === MINZE} /> };

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
