import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LINKS } from "../rechtliches";
import { T as TEXT } from "../texte";
import { Betrag, Fuss, Hinweis, Karte, Knopf, KopfKnopf, Symbol, T, TextKnopf } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { HAARLINIE, RADIUS, RAND, schattenStil, useFarben } from "../ui/thema";
import { angebote, kaufAktiv, kaufen, wiederherstellen, type Angebot } from "../pro/kauf";
import { FREI_JE_MONAT, PRO_VORTEILE, uebrig, type ProFunktion } from "../pro/regeln";
import { useAmtlos } from "../zustand";
import { syncAngeboten } from "../konto/konfig";
import { DatenschutzSeite } from "./Recht";

/** „Synchronisation“ nur zeigen, wenn dieser Build einen Server hat (E-134). */
const VORTEILE = PRO_VORTEILE.filter((v) => v !== "sync" || syncAngeboten);


/**
 * Bezahlschirm (E-132): warum Pro, was Pro bringt, Angebote aus dem Store. Ohne Store-Anbindung (Testpaket) lässt
 * sich Pro testweise einschalten. Pflichtangaben für Abos (Verlängerung, Kündigung, Nutzungsbedingungen, Datenschutz)
 * stehen unter dem Knopf.
 */
export function ProSeite({ grund }: { grund?: ProFunktion }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const [liste, setListe] = useState<Angebot[] | null>(kaufAktiv ? null : []);
  const [wahl, setWahl] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!kaufAktiv) return;
    angebote()
      .then((l) => {
        setListe(l);
        setWahl(l[0]?.id ?? null);
      })
      .catch(() => {
        setListe([]);
        setFehler(TEXT.pro_laden_fehler);
      });
  }, []);
  const fertig = (aktiv: boolean, text: string) => {
    z.proAktualisieren(aktiv);
    if (aktiv) {
      melden(text);
      nav.zurueck();
    }
  };
  const los = async () => {
    setFehler(null);
    if (!kaufAktiv) {
      z.proTestSetzen(true);
      return fertig(true, TEXT.pro_test_an);
    }
    if (!wahl) return;
    setLaedt(true);
    try {
      fertig(await kaufen(wahl), TEXT.pro_willkommen);
    } catch {
      setFehler(TEXT.pro_kauf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const zurueckholen = async () => {
    setFehler(null);
    setLaedt(true);
    try {
      const ok = await wiederherstellen();
      if (ok) fertig(true, TEXT.pro_wiederhergestellt);
      else setFehler(TEXT.pro_nichts_gefunden);
    } catch {
      setFehler(TEXT.pro_wiederherstellen_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const gewaehlt = liste?.find((a) => a.id === wahl);
  const rest = uebrig(z.stand.unterlagen, new Date());
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["top", "left", "right"]}>
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: RAND - 8 }}>
        <KopfKnopf symbol="xmark" label={TEXT.schliessen} onPress={nav.zurueck} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingBottom: 24 }}>
        {/* wie Apples eigene Abo-Seiten: App-Symbol, Titel und ein Satz mittig */}
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-require-imports -- Bild aus den Assets */}
          <Image source={require("../../assets/icon.png")} style={{ width: 84, height: 84, borderRadius: 19 }} accessibilityIgnoresInvertColors />
          <T v="grossTitel" accessibilityRole="header" stil={{ marginTop: 16, textAlign: "center" }}>{TEXT.pro_titel}</T>
          <T leise stil={{ marginTop: 6, textAlign: "center", maxWidth: 320 }}>{grund ? TEXT.pro_grund[grund](FREI_JE_MONAT) : TEXT.pro_unter}</T>
        </View>
        <Karte stil={{ marginTop: 16 }}>
          {/* der Grund, aus dem der Bezahlschirm aufging, steht oben */}
          {(grund ? [grund, ...VORTEILE.filter((x) => x !== grund)] : VORTEILE).map((v, i, l) => (
            <View key={v} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={{ paddingTop: 17 }}>
                <Symbol name="checkmark" groesse={15} farbe={f.amt} gewicht="bold" />
              </View>
              <View style={{ flex: 1, paddingVertical: 14, borderBottomWidth: i === l.length - 1 ? 0 : HAARLINIE, borderColor: f.linie }}>
                <T fett>{TEXT.pro_vorteil[v].titel}</T>
                <T v="klein" leise stil={{ marginTop: 2 }}>{TEXT.pro_vorteil[v].text(FREI_JE_MONAT)}</T>
              </View>
            </View>
          ))}
        </Karte>
        <View style={{ marginTop: 10 }}>
          <Hinweis art="erfolg" text={TEXT.pro_frei_bleibt} />
        </View>
        {!z.pro ? <T v="caption" leise stil={{ marginTop: 4, marginLeft: 4 }}>{TEXT.pro_rest(rest, FREI_JE_MONAT)}</T> : null}

        {kaufAktiv ? (
          liste === null ? (
            <ActivityIndicator color={f.amt} style={{ marginTop: 24 }} accessibilityLabel={TEXT.pro_laedt} />
          ) : (
            <View accessibilityRole="radiogroup" style={{ marginTop: 20, gap: 10 }}>
              {liste.map((a) => {
                const an = a.id === wahl;
                return (
                  <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: an }} onPress={() => setWahl(a.id)} style={{ padding: 16, borderRadius: RADIUS.karte, borderWidth: 2, borderColor: an ? f.amt : f.linie, backgroundColor: an ? f.amtHauch : f.blatt, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: an ? 7 : 1.5, borderColor: an ? f.amt : f.rahmen, backgroundColor: f.blatt }} />
                    <View style={{ flex: 1 }}>
                      <T fett>{a.zeitraum ? TEXT.pro_zeitraum(a.zeitraum) : a.titel}</T>
                      {a.test ? <T v="klein" farbe={f.amt}>{TEXT.pro_test_zeitraum(a.test)}</T> : null}
                    </View>
                    <Betrag>{a.preis}</Betrag>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : (
          <View style={{ marginTop: 16 }}>
            <Hinweis text={TEXT.pro_testmodus} symbol="info.circle" />
          </View>
        )}
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {z.pro && !kaufAktiv ? <TextKnopf symbol="xmark.circle" text={TEXT.pro_test_aus} onPress={() => z.proTestSetzen(false)} stil={{ marginTop: 8 }} /> : null}

        <T v="caption" leise stil={{ marginTop: 18 }}>{TEXT.pro_abo_text}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
          <TextKnopf text={TEXT.nutzungsbedingungen} leise onPress={() => void Linking.openURL(LINKS.nutzung)} />
          <TextKnopf text={TEXT.datenschutz} leise onPress={() => nav.oeffnen("datenschutz", () => <DatenschutzSeite />)} />
          {kaufAktiv ? <TextKnopf text={TEXT.pro_wiederherstellen} leise onPress={() => void zurueckholen()} /> : null}
        </View>
      </ScrollView>
      <Fuss ueber={gewaehlt?.test ? <T v="caption" leise stil={{ textAlign: "center" }}>{TEXT.pro_danach(gewaehlt.preis, gewaehlt.zeitraum)}</T> : null}>
        {z.pro ? (
          <Knopf ton text={TEXT.pro_aktiv} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
        ) : (
          <Knopf text={!kaufAktiv ? TEXT.pro_test_einschalten : gewaehlt?.test ? TEXT.pro_test_starten : TEXT.pro_abonnieren} laedt={laedt} deaktiviert={kaufAktiv && !wahl} onPress={() => void los()} stil={{ flex: 1 }} />
        )}
      </Fuss>
    </SafeAreaView>
  );
}

/** Prüft eine Pro-Funktion: mit Pro true, sonst öffnet sich der Bezahlschirm (mit Grund) und es kommt false zurück. */
export function useProSperre() {
  const z = useAmtlos();
  const nav = useNav();
  return (f: ProFunktion): boolean => {
    if (z.pro) return true;
    nav.oeffnen("pro", () => <ProSeite grund={f} />, true);
    return false;
  };
}

/** Zeile unter „Mein Betrieb“: Pro-Status, öffnet den Bezahlschirm. */
export function ProZeile() {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const rest = uebrig(z.stand.unterlagen, new Date());
  return (
    <Pressable accessibilityRole="button" onPress={() => nav.oeffnen("pro", () => <ProSeite />, true)} style={({ pressed }) => ({ marginTop: 16, opacity: pressed ? 0.75 : 1 })}>
      {/* ruhige Karte wie die übrigen – die lauteste Fläche des Bildschirms soll nicht die Werbung sein */}
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 0 }, schattenStil(f)]}>
        <View style={{ flex: 1 }}>
          <T fett>{z.pro ? TEXT.pro_aktiv : TEXT.pro_titel}</T>
          <T v="klein" leise>{z.pro ? TEXT.pro_aktiv_text : TEXT.pro_rest(rest, FREI_JE_MONAT)}</T>
        </View>
        <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" />
      </View>
    </Pressable>
  );
}
