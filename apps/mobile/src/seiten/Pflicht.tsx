import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { datumLang, fuelle, schrittFuerFakt } from "@amtlos/i18n";
import { ApiFehler, NetzFehler, type Karte } from "../kern/api";
import { Feld, Fristblatt, Hinweis, Knopf, Status, Stempel, Symbol, T } from "../ui/bausteine";
import { RADIUS, RAND, ZIEL, istIos, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { useLaden } from "./gemeinsam";
import { Schnellstart } from "./Schnellstart";

/**
 * Pflicht-Karte als Blatt von unten (Seitenvertrag docs/04): Was · Bis wann · Erledigen · Warum · Was sonst · Mehr · Quellen.
 * Erledigen ist ein Tipp mit Haptik; der Stempel ist der eine animierte Moment der App (E-117).
 */
export function PflichtBlatt({ karte, offen, schliessen, geaendert }: { karte: Karte | null; offen: boolean; schliessen: () => void; geaendert: () => void }) {
  const { t, sprache, klient } = useAmtlos();
  const f = useFarben();
  const { daten: d, fehler, neu } = useLaden(() => (karte ? klient.pflicht(karte.pflicht_id, karte.periode) : Promise.resolve(null)), [karte?.pflicht_id, karte?.periode]);
  const [laedt, setLaedt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [notizOffen, setNotizOffen] = useState(false);
  const [notiz, setNotiz] = useState("");
  // Fehlende Angabe direkt hier beantworten (E-120): der passende Fragen-Schritt öffnet sich als Blatt
  const [frageSchritt, setFrageSchritt] = useState<string | null>(null);
  const [profil, setProfil] = useState<Record<string, unknown>>({});
  async function angabeErgaenzen() {
    const fakt = d?.fehlende_fakten.find((x) => schrittFuerFakt(x));
    const schritt = fakt ? schrittFuerFakt(fakt) : undefined;
    if (!schritt) return;
    setProfil((await klient.profil().catch(() => ({ daten: {} }))).daten ?? {});
    setFrageSchritt(schritt);
  }
  const stempel = useRef(new Animated.Value(0)).current;
  const erledigt = d?.status === "erledigt";
  // Alle Rollen dürfen erledigen (Rollenmodell: erledigen ja, Angaben ändern nein – deshalb „am Computer“ bei zu klärenden Angaben)

  useEffect(() => {
    stempel.setValue(erledigt ? 1 : 0);
  }, [erledigt, stempel, karte?.pflicht_id]);

  async function erledigen() {
    if (!karte) return;
    setLaedt(true);
    setMeldung(null);
    try {
      await klient.erledigen(karte.pflicht_id, karte.periode, notiz.trim() || null);
      setNotiz("");
      setNotizOffen(false);
      if (istIos) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stempel.setValue(0);
      Animated.spring(stempel, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
      await neu();
      geaendert();
    } catch (e) {
      setMeldung(e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e));
    } finally {
      setLaedt(false);
    }
  }
  async function wiederOeffnen() {
    if (!karte) return;
    setLaedt(true);
    try {
      await klient.wiederOeffnen(karte.pflicht_id, karte.periode);
      Animated.timing(stempel, { toValue: 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      await neu();
      geaendert();
    } catch (e) {
      setMeldung(e instanceof ApiFehler ? e.message : t.mobil.fehler_netz);
    } finally {
      setLaedt(false);
    }
  }

  const status = (t.status as Record<string, string>)[d?.status ?? karte?.status ?? "offen"] ?? "";
  return (
    <Modal visible={offen} animationType="slide" presentationStyle="pageSheet" onRequestClose={schliessen}>
      <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["bottom"]}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12, paddingTop: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.mobil.schliessen} onPress={schliessen} style={{ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center", borderRadius: ZIEL / 2, backgroundColor: f.blatt }}>
            <Symbol name="xmark" groesse={16} farbe={f.tinte} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingBottom: 48 }}>
          {karte ? (
            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              <Fristblatt datum={d?.faellig_am ?? karte.faellig_am} status={d?.status ?? karte.status} sprache={sprache} gross />
              <View style={{ flex: 1, paddingTop: 4 }}>
                <T v="titel" accessibilityRole="header">{d?.titel ?? karte.titel}</T>
                <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <Status status={d?.status ?? karte.status} text={status} />
                  {(d?.faellig_am ?? karte.faellig_am) ? <T v="caption" leise>{fuelle(t.pflichten.bis, { datum: datumLang((d?.faellig_am ?? karte.faellig_am)!, sprache) })}</T> : null}
                </View>
              </View>
            </View>
          ) : null}
          <T stil={{ marginTop: 16 }}>{d?.kurz ?? karte?.kurz}</T>

          {d?.ungeprueft ? <Hinweis text={t.karte.ungeprueft} /> : null}
          {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
          {meldung ? <Hinweis art="fehler" text={meldung} /> : null}

          {/* Erledigen */}
          <View style={{ marginTop: 20, minHeight: 64, justifyContent: "center" }}>
            {erledigt ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Animated.View style={{ transform: [{ scale: stempel.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }], opacity: stempel }}>
                  <Stempel text={d?.erledigt_am ? fuelle(t.karte.erledigt_am, { datum: datumLang(d.erledigt_am.slice(0, 10), sprache) }) : t.status.erledigt} />
                </Animated.View>
                <Knopf leise text={t.karte.wieder_oeffnen} onPress={() => void wiederOeffnen()} laedt={laedt} />
              </View>
            ) : d && d.ergebnis === "gilt" ? (
              <View>
                <Knopf text={t.karte.erledigen} symbol="checkmark" onPress={() => void erledigen()} laedt={laedt} />
                <T v="caption" leise stil={{ marginTop: 8 }}>{t.karte.erledigen_hinweis}</T>
                {notizOffen ? (
                  <Feld label={t.karte.notiz} wert={notiz} aendern={setNotiz} mehrzeilig />
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setNotizOffen(true)} style={{ minHeight: 40, justifyContent: "center", alignSelf: "flex-start" }}>
                    <T v="klein" farbe={f.amt}>{t.karte.notiz_zeigen}</T>
                  </Pressable>
                )}
              </View>
            ) : d && d.ergebnis === "unbekannt" ? (
              <View style={{ borderRadius: RADIUS.karte, borderWidth: 1, borderStyle: "dashed", borderColor: f.tinteLeise, padding: 14 }}>
                <T fett>{t.karte.zu_klaeren}</T>
                {d.zu_klaeren?.length ? (
                  <>
                    <T v="klein" leise stil={{ marginTop: 4 }}>{t.karte.zu_klaeren_text}</T>
                    {d.zu_klaeren.map((z) => (
                      <T key={z} v="klein" stil={{ marginTop: 4 }}>• {z}</T>
                    ))}
                  </>
                ) : null}
                {d.fehlende_fakten.some((x) => schrittFuerFakt(x)) ? (
                  <Knopf text={t.karte.angabe_ergaenzen} onPress={() => void angabeErgaenzen()} stil={{ marginTop: 12, alignSelf: "flex-start" }} />
                ) : (
                  <T v="klein" leise stil={{ marginTop: 4 }}>{t.mobil.angabe_am_computer}</T>
                )}
              </View>
            ) : d && d.status === "nicht_zutreffend" && d.nicht_zutreffend_grund ? (
              <Hinweis art="erfolg" text={d.nicht_zutreffend_grund} />
            ) : null}
          </View>

          {d?.warum?.length ? (
            <View style={{ marginTop: 24 }}>
              <T v="gross" accessibilityRole="header">{t.karte.warum}</T>
              {d.warum.map((w) => (
                <View key={w} style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.amt, marginTop: 9 }} />
                  <T stil={{ flex: 1 }}>{w}</T>
                </View>
              ))}
            </View>
          ) : null}

          {d ? (
            <View style={{ marginTop: 24 }}>
              <T v="gross" accessibilityRole="header">{t.karte.sonst}</T>
              <T stil={{ marginTop: 6 }}>{d.sanktion.text}</T>
            </View>
          ) : null}

          {d ? (
            <View style={{ marginTop: 24 }}>
              <T v="gross" accessibilityRole="header">{t.karte.mehr}</T>
              <T stil={{ marginTop: 6 }}>{d.erklaerung}</T>
              <View style={{ marginTop: 10 }}>
                <T v="klein" leise>{t.karte.stelle}</T>
                <T>{d.stelle}</T>
              </View>
              {d.begriffe.map((b) => (
                <View key={b.begriff} style={{ marginTop: 10 }}>
                  <T fett>{b.begriff}</T>
                  <T v="klein">{b.erklaerung}</T>
                </View>
              ))}
            </View>
          ) : null}

          {d?.nachweise?.length ? (
            <View style={{ marginTop: 24 }}>
              <T v="gross" accessibilityRole="header">{t.karte.nachweise}</T>
              {d.nachweise.map((n) => (
                <T key={n.id} v="klein" stil={{ marginTop: 6 }}>{datumLang(n.erstellt_am.slice(0, 10), sprache)}{n.notiz ? ` · ${n.notiz}` : ""}</T>
              ))}
            </View>
          ) : null}

          {d ? (
            <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: f.linie }}>
              <T v="klein" fett>{t.karte.quellen}</T>
              <T v="klein" leise stil={{ marginTop: 2 }}>{d.rechtsgrundlage.join(", ")}</T>
              {d.quellen.map((q) => (
                <Pressable key={q.url} accessibilityRole="link" onPress={() => void Linking.openURL(q.url)} style={{ minHeight: ZIEL - 8, justifyContent: "center" }}>
                  <T v="klein" farbe={f.amt} stil={{ textDecorationLine: "underline" }}>{q.titel}</T>
                </Pressable>
              ))}
              {d.pruefung.geprueft_am ? <T v="caption" leise>{fuelle(t.mobil.geprueft_am, { datum: datumLang(d.pruefung.geprueft_am, sprache) })}</T> : null}
              <T v="caption" leise stil={{ marginTop: 10 }}>{t.karte.keine_beratung}</T>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <Modal visible={Boolean(frageSchritt)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFrageSchritt(null)}>
        {frageSchritt ? (
          <Schnellstart
            phase="alle"
            nurSchritt={frageSchritt}
            profilStart={profil}
            abbrechen={() => setFrageSchritt(null)}
            fertig={() => {
              setFrageSchritt(null);
              // Mit der neuen Angabe ist neu gerechnet: Karte neu laden, Listen dahinter auch
              void neu();
              geaendert();
            }}
          />
        ) : null}
      </Modal>
    </Modal>
  );
}
