import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, type ReactElement, type ReactNode } from "react";
import { FlatList, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bereich } from "@amtlos/fachlogik";
import { rechtsHinweis, type HinweisArt } from "../rechtshinweis";
import { euroText } from "../unterlagen/ablage";
import { BuehnenText, Motiv, Symbol, T, useGrosseSchrift } from "../ui/bausteine";
import { HellerStatus, TastaturRahmen, useImBlatt, useKopf, type KopfKnopfDef } from "../ui/navigation";
import { BLATT_OBEN, RADIUS, RAND, SCHRIFT, schattenStil, useFarben } from "../ui/thema";
import { trennen } from "../ui/trennen";

/** Platz unter dem Blatt für die schwebende Tab-Leiste. */
export const UNTEN_FREI = 120;

/** Das §-Motiv der Bühne – überall an derselben Stelle und gleich leise (A2), damit es nichts überlagert. */
function BuehnenMotiv() {
  return <Motiv zeichen="§" groesse={340} farbe="rgba(127,227,184,0.045)" stil={{ right: -84, top: -56 }} />;
}

/**
 * Tab-Seite (E-142 „Bühne und Papier“): oben die dunkelgrüne Bühne mit Zeile darüber, großem Titel und dem, was auf
 * dieser Seite zählt (Betrag, Jahr, Knöpfe); darunter schiebt sich das helle Blatt mit dem Rest. Statusleiste hell,
 * solange die Seite sichtbar ist. Unter dem Blatt geht der helle Grund weiter (kein Grün beim Ziehen nach oben).
 */
export function BuehnenSeite({ ueber, titel, satz, rechts, buehne, children, ...rest }: ScrollViewProps & { ueber?: string; titel?: string; satz?: boolean; rechts?: ReactNode; buehne?: ReactNode }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const sichtbar = useIsFocused();
  const gross = useGrosseSchrift();
  return (
    <View style={{ flex: 1, backgroundColor: f.buehne }}>
      {sichtbar ? <StatusBar style="light" /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest}>
        {/* R12 (UX #23): bei großer Schrift kompakter – „Als Nächstes“ lag sonst hinter der Tab-Leiste */}
        <View style={{ paddingTop: inset.top + (ueber || rechts ? (gross ? 6 : 14) : gross ? 14 : 28), paddingHorizontal: RAND, paddingBottom: gross ? 18 : 30, gap: gross ? 12 : 22, overflow: "hidden" }}>
          <BuehnenMotiv />
          {ueber || rechts ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
              <T v="klein" fett farbe={f.buehneLeise} stil={{ flex: 1 }} numberOfLines={gross ? undefined : 1}>{ueber ?? ""}</T>
              {rechts}
            </View>
          ) : null}
          {/* ein Satz als Titel (z. B. „8 Dinge in den nächsten 2 Wochen“) in 28 statt 34 pt – bricht sonst unschön (A9) */}
          {titel ? <T v={satz ? "titel" : "grossTitel"} accessibilityRole="header" farbe={f.buehneText}>{trennen(titel)}</T> : null}
          {buehne}
        </View>
        <View style={{ flexGrow: 1, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: UNTEN_FREI }}>
          {children}
          {/* heller Grund unter dem Blatt – beim Ziehen über das Ende hinaus kein Grün */}
          {Platform.OS === "web" ? null : <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Tab-Seite wie `BuehnenSeite`, aber mit einer virtualisierten Liste auf dem Blatt (R9 Performance): Nur die sichtbaren
 * Zeilen werden gezeichnet – bei 5.000 Belegen statt 70.000 DOM-Knoten bzw. nativen Ansichten ein paar Dutzend. `kopf`
 * steht auf dem Blatt über der Liste, `fuss` darunter; jede Zeile liegt auf dem Blatt mit dessen Seitenrand.
 */
export function BuehnenListe<T>({ ueber, titel, buehne, kopf, fuss, daten, zeile, schluessel }: { ueber?: string; titel?: string; buehne?: ReactNode; kopf?: ReactNode; fuss?: ReactNode; daten: readonly T[]; zeile: (eintrag: T) => ReactElement | null; schluessel: (eintrag: T) => string }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const sichtbar = useIsFocused();
  const gross = useGrosseSchrift();
  const oben = (
    <View>
      <View style={{ paddingTop: inset.top + (ueber ? 14 : 28), paddingHorizontal: RAND, paddingBottom: 30, gap: 22, overflow: "hidden" }}>
        <BuehnenMotiv />
        {ueber ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
            <T v="klein" fett farbe={f.buehneLeise} stil={{ flex: 1 }} numberOfLines={gross ? undefined : 1}>{ueber}</T>
          </View>
        ) : null}
        {titel ? <T v="grossTitel" accessibilityRole="header" farbe={f.buehneText}>{trennen(titel)}</T> : null}
        {buehne}
      </View>
      <View style={{ backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: RAND, paddingTop: BLATT_OBEN }}>{kopf}</View>
    </View>
  );
  const unten = (
    <View style={{ backgroundColor: f.papier, paddingHorizontal: RAND, paddingBottom: UNTEN_FREI, flexGrow: 1 }}>
      {fuss}
      {/* heller Grund unter dem Blatt – beim Ziehen über das Ende hinaus kein Grün (im Web verlängerte er die Liste) */}
      {Platform.OS === "web" ? null : <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />}
    </View>
  );
  const zeichnen = useCallback(({ item }: { item: T }) => <View style={{ backgroundColor: f.papier, paddingHorizontal: RAND }}>{zeile(item)}</View>, [f.papier, zeile]);
  return (
    <View style={{ flex: 1, backgroundColor: f.buehne }}>
      {sichtbar ? <StatusBar style="light" /> : null}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        data={daten}
        renderItem={zeichnen}
        keyExtractor={schluessel}
        ListHeaderComponent={oben}
        ListFooterComponent={unten}
        ListFooterComponentStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={9}
      />
    </View>
  );
}

/** Betrag groß wie in Finanz-Apps: Euro weiß, Cent und Zeichen gedämpft. */
export function GrosserBetrag({ cent, groesse: wunsch = 60, label }: { cent: number; groesse?: number; label?: string }) {
  const f = useFarben();
  const { width, fontScale } = useWindowDimensions();
  const text = euroText(cent);
  const komma = text.lastIndexOf(",");
  const vorn = komma > 0 ? text.slice(0, komma) : text;
  const hinten = komma > 0 ? text.slice(komma) : "";
  // R11 (UX #10): immer einzeilig – bei großer Schrift oder langem Betrag kleiner (bis 60 %), nie „701,6 / 1 €“.
  // Geschätzt (Ziffern der Display-Schrift ≈ 0,6 em), weil adjustsFontSizeToFit im Web nicht greift.
  // bewusst ohne Obergrenze gerechnet: lieber etwas kleiner als ein abgeschnittener Betrag
  const skala = Math.max(1, fontScale);
  const breite = text.length * wunsch * 0.6 * skala;
  const platz = Math.max(200, width - 2 * RAND);
  const groesse = Math.round(wunsch * Math.max(0.6, Math.min(1, platz / breite)));
  return (
    <T accessibilityLabel={label ?? text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.4} farbe={f.buehneText} stil={{ ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.07, letterSpacing: -groesse * 0.04, fontVariant: ["tabular-nums"] }}>
      {vorn}
      <T maxFontSizeMultiplier={1.4} farbe="rgba(255,255,255,0.72)" stil={{ ...SCHRIFT.display, fontSize: groesse, lineHeight: groesse * 1.07, letterSpacing: -groesse * 0.04 }}>{hinten}</T>
    </T>
  );
}

/**
 * Unterseite oder Blatt im Bühnen-Aufbau (E-144): Die Navigationsleiste wird grün, darunter setzt sich die Bühne fort
 * mit Titel, einem Satz und dem, was zählt; das helle Blatt trägt den Rest. Ein Fuß (Hauptknopf) bleibt unten stehen.
 */
/**
 * `fest`: bleibt beim Scrollen oben stehen (z. B. das Suchfeld in „Neu erstellen“ – A17), direkt unter Titel und Satz.
 */
export function BuehnenBlatt({ kopf = "", ueber, titel, unter, buehne, fest, rechts, fuss, children }: { kopf?: string; ueber?: string; titel?: string; unter?: string; buehne?: ReactNode; fest?: ReactNode; rechts?: KopfKnopfDef | null; fuss?: ReactNode; children?: ReactNode }) {
  const f = useFarben();
  const imBlatt = useImBlatt();
  useKopf({ titel: kopf, buehne: true, rechts });
  const kopfTeil = (
    <View key="kopf" style={{ paddingHorizontal: RAND, paddingTop: 6, paddingBottom: fest ? 14 : buehne ? 14 : 28, gap: 14, overflow: "hidden" }}>
      <BuehnenMotiv />
      {ueber ? <T v="klein" fett farbe={f.buehneLeise}>{ueber}</T> : null}
      {titel ? <T v="titel" accessibilityRole="header" farbe={f.buehneText}>{trennen(titel)}</T> : null}
      {unter ? <BuehnenText text={unter} /> : null}
      {fest ? null : buehne}
    </View>
  );
  return (
    <TastaturRahmen grund={f.buehne}>
      <HellerStatus />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets stickyHeaderIndices={fest ? [1] : undefined}>
        {kopfTeil}
        {fest ? (
          <View key="fest" style={{ paddingHorizontal: RAND, paddingVertical: 8, backgroundColor: f.buehne }}>
            {fest}
          </View>
        ) : null}
        {fest && buehne ? <View key="buehne" style={{ paddingHorizontal: RAND, paddingTop: 6, paddingBottom: 28 }}>{buehne}</View> : fest ? <View key="buehne" style={{ height: 20 }} /> : null}
        <View key="blatt" style={{ flexGrow: 1, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: fuss ? 24 : imBlatt ? 40 : UNTEN_FREI }}>
          {children}
          {Platform.OS === "web" ? null : <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />}
        </View>
      </ScrollView>
      {fuss}
    </TastaturRahmen>
  );
}

/** Kleiner Knopf auf der Bühne (oben rechts): Glasfläche mit weißer Schrift. */
export function BuehnenKnopf({ text, onPress, label }: { text: string; onPress: () => void; label?: string }) {
  const f = useFarben();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? text} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 16, borderRadius: RADIUS.pille, justifyContent: "center", backgroundColor: f.buehneFlaeche, opacity: pressed ? 0.7 : 1 })}>
      <T v="klein" farbe={f.buehneText} stil={{ ...SCHRIFT.halb }}>{text}</T>
    </Pressable>
  );
}

/** Plakette auf der Bühne („820 € überfällig“, „Oktober 3.860 €“) – `warnung` rot getönt. */
export function BuehnenMarke({ text, warnung }: { text: string; warnung?: boolean }) {
  const f = useFarben();
  return (
    // darf schrumpfen und umbrechen – sonst würde ein langer Text („… davon 1 überfällig“) rechts abgeschnitten (G2)
    <View style={{ flexShrink: 1, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pille, backgroundColor: warnung ? "rgba(255,105,97,0.22)" : f.buehneFlaeche }}>
      <T v="caption" farbe={warnung ? "#ffc9c4" : f.buehneText} stil={{ ...SCHRIFT.halb }}>{text}</T>
    </View>
  );
}

/** Abschnitt auf dem Blatt: Überschrift links, optional ein Link rechts. */
export function BlattKopf({ titel, rechts, onPress, erste }: { titel: string; rechts?: string; onPress?: () => void; erste?: boolean }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: erste ? 0 : 30, marginBottom: 12 }}>
      <T v="gross" accessibilityRole="header">{titel}</T>
      {rechts && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={{ minHeight: 44, marginVertical: -9, justifyContent: "center" }}>
          {({ pressed }) => <T v="klein" farbe={f.amt} stil={{ ...SCHRIFT.halb, opacity: pressed ? 0.55 : 1 }}>{rechts}</T>}
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Leerer Zustand als Einladung (B7): ein großes, leises Symbol (Standard: Ordner), ein warmer Satz, was jetzt sinnvoll
 * ist, und die Handlung dazu.
 */
export function Leer({ text, unter, children, symbol = "folder" }: { text: string; unter?: string; children?: ReactNode; symbol?: string }) {
  const f = useFarben();
  return (
    <View style={[{ paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, borderRadius: RADIUS.karte, backgroundColor: f.blatt, gap: 18, alignItems: "stretch", borderWidth: 0 }, schattenStil(f)]}>
      <View style={{ alignItems: "center", gap: 8 }}>
        {/* R11 (UX #16): ein Ordner statt des Erfolgshakens – der Haken heißt sonst „erledigt“ */}
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: f.amtHauch, alignItems: "center", justifyContent: "center" }}>
          <Symbol name={symbol} groesse={42} farbe={f.amt} gewicht="regular" />
        </View>
        <T v="gross" stil={{ textAlign: "center", marginTop: 14 }}>{text}</T>
        {unter ? <T leise stil={{ textAlign: "center", maxWidth: 300 }}>{unter}</T> : null}
      </View>
      {children}
    </View>
  );
}

/** Inhalt einer Unterseite: scrollbar, Platz für die Tab-Leiste, Tastatur schiebt mit. */
export function Inhalt({ children, ...rest }: ScrollViewProps) {
  // in einem Tab liegt die schwebende Tab-Leiste über dem Ende – Platz lassen; in Blättern genügt wenig
  const imBlatt = useImBlatt();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: imBlatt ? 40 : UNTEN_FREI }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets {...rest}>
      {children}
    </ScrollView>
  );
}

/** Abschnitt mit Serif-Überschrift über einer Karte – wie eine Zwischenüberschrift im Dokument. */
export function Gruppe({ titel, children, fuss, hilfe, erste }: { titel?: string; children: ReactNode; fuss?: string; hilfe?: string; erste?: boolean }) {
  return (
    <View style={{ marginTop: erste ? 0 : 30 }}>
      {/* alles auf derselben Fluchtlinie wie Karten und Text (A10) – keine eingerückten Überschriften */}
      {titel ? <T v="gross" accessibilityRole="header" stil={{ marginBottom: hilfe ? 3 : 12 }}>{titel}</T> : null}
      {hilfe ? <T v="caption" leise stil={{ marginBottom: 11 }}>{hilfe}</T> : null}
      {children}
      {fuss ? <T v="caption" leise stil={{ marginTop: 8 }}>{fuss}</T> : null}
    </View>
  );
}

/**
 * Phase 1 (RDG): ruhige Fußzeile „keine Rechts- oder Steuerberatung“ mit Rechtsstand – ein Text, damit VoiceOver beides
 * zusammen liest. Nie im PDF (src/rechtshinweis.ts).
 */
export function RechtsHinweis({ art, farbe, oben = 16, pflicht }: { art: HinweisArt; farbe?: string; oben?: number; pflicht?: { pruefVermerk: string | null } }) {
  const h = rechtsHinweis(art, undefined, pflicht);
  return (
    <T v="caption" leise={!farbe} farbe={farbe} stil={{ marginTop: oben }} testID={`rechtshinweis-${art}`}>
      {`${h.text}\n${h.stand}`}
    </T>
  );
}

/** Symbol je Bereich. */
export const BEREICH_SYMBOL: Record<Bereich, string> = {
  arbeitsschutz: "hammer",
  datenschutz: "lock.shield",
  personal: "person.2",
  steuern: "building.columns",
  betrieb: "building.2",
  gastro: "fork.knife",
  beauty: "scissors",
};

/** ISO-Zeitpunkt → TT.MM.JJJJ (deutsche Ortszeit). */
const DATUM_KURZ = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
export const datumKurz = (iso: string) => DATUM_KURZ.format(new Date(iso));
