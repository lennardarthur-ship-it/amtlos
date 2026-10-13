import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LINKS } from "../rechtliches";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Symbol, T, TextKnopf } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { RADIUS, RAND, ZIEL, useFarben } from "../ui/thema";
import { angebote, kaufAktiv, kaufen, wiederherstellen, type Angebot } from "../pro/kauf";
import { FREI_JE_MONAT, PRO_VORTEILE, uebrig, type ProFunktion } from "../pro/regeln";
import { useAmtlos } from "../zustand";
import { syncAngeboten } from "../konto/konfig";
import { DatenschutzSeite } from "./Recht";

/** „Synchronisation“ nur zeigen, wenn dieser Build einen Server hat (E-134). */
const VORTEILE = PRO_VORTEILE.filter((v) => v !== "sync" || syncAngeboten);

const VORTEIL_SYMBOL: Record<ProFunktion, string> = { pdf: "doc.on.doc", e_rechnung: "doc.text", ust_uebernahme: "percent", steuerberater: "briefcase", icloud: "icloud", sync: "arrow.triangle.2.circlepath", briefkopf: "paintpalette" };

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
      setFehler(TEXT.pro_kauf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const gewaehlt = liste?.find((a) => a.id === wahl);
  const rest = uebrig(z.stand.unterlagen, new Date());
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["top", "left", "right"]}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: RAND - 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.schliessen} onPress={nav.zurueck} hitSlop={8} style={{ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center" }}>
          <Symbol name="xmark" groesse={20} farbe={f.tinte} gewicht="semibold" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: f.amt, alignItems: "center", justifyContent: "center" }}>
          <Symbol name="checkmark.seal.fill" groesse={30} farbe="#ffffff" />
        </View>
        <T v="grossTitel" accessibilityRole="header" stil={{ marginTop: 14 }}>{TEXT.pro_titel}</T>
        <T leise stil={{ marginTop: 6 }}>{grund ? TEXT.pro_grund[grund](FREI_JE_MONAT) : TEXT.pro_unter}</T>
        <Karte stil={{ marginTop: 20, paddingVertical: 4 }}>
          {VORTEILE.map((v, i) => (
            <View key={v} style={{ flexDirection: "row", gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: v === grund ? f.amt : f.amtHauch, alignItems: "center", justifyContent: "center" }}>
                <Symbol name={VORTEIL_SYMBOL[v]} groesse={18} farbe={v === grund ? "#ffffff" : f.amt} />
              </View>
              <View style={{ flex: 1 }}>
                <T fett>{TEXT.pro_vorteil[v].titel}</T>
                <T v="klein" leise stil={{ marginTop: 2 }}>{TEXT.pro_vorteil[v].text(FREI_JE_MONAT)}</T>
              </View>
            </View>
          ))}
        </Karte>
        <T v="caption" leise stil={{ marginTop: 8, marginLeft: 4 }}>{TEXT.pro_frei_bleibt}</T>
        {!z.pro ? <T v="caption" leise stil={{ marginTop: 4, marginLeft: 4 }}>{TEXT.pro_rest(rest, FREI_JE_MONAT)}</T> : null}

        {kaufAktiv ? (
          liste === null ? (
            <ActivityIndicator color={f.amt} style={{ marginTop: 24 }} accessibilityLabel={TEXT.pro_laedt} />
          ) : (
            <View accessibilityRole="radiogroup" style={{ marginTop: 20, gap: 10 }}>
              {liste.map((a) => {
                const an = a.id === wahl;
                return (
                  <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: an }} onPress={() => setWahl(a.id)} style={{ padding: 14, borderRadius: RADIUS.karte, borderWidth: an ? 2 : 1, borderColor: an ? f.amt : f.linie, backgroundColor: an ? f.amtHauch : f.blatt, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Symbol name={an ? "checkmark.circle.fill" : "circle"} groesse={22} farbe={an ? f.amt : f.tinteLeise} />
                    <View style={{ flex: 1 }}>
                      <T fett>{a.zeitraum ? TEXT.pro_zeitraum(a.zeitraum) : a.titel}</T>
                      {a.test ? <T v="klein" farbe={f.amt}>{TEXT.pro_test_zeitraum(a.test)}</T> : null}
                    </View>
                    <T fett stil={{ fontVariant: ["tabular-nums"] }}>{a.preis}</T>
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: z.pro ? f.blatt : f.amt, borderWidth: z.pro ? 1 : 0, borderColor: f.linie }}>
        <Symbol name="checkmark.seal.fill" groesse={26} farbe={z.pro ? f.amt : "#ffffff"} />
        <View style={{ flex: 1 }}>
          <T fett farbe={z.pro ? undefined : "#ffffff"}>{z.pro ? TEXT.pro_aktiv : TEXT.pro_titel}</T>
          <T v="klein" farbe={z.pro ? f.tinteLeise : "#ffffff"}>{z.pro ? TEXT.pro_aktiv_text : TEXT.pro_rest(rest, FREI_JE_MONAT)}</T>
        </View>
        <Symbol name="chevron.right" groesse={16} farbe={z.pro ? undefined : "#ffffff"} />
      </View>
    </Pressable>
  );
}
