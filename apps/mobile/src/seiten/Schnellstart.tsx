import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fragenJePhase, fuelle, schritteJePhase, type Frage } from "@amtlos/i18n";
import { ApiFehler, NetzFehler } from "../kern/api";
import { Hinweis, Knopf, Symbol, T } from "../ui/bausteine";
import { RADIUS, RAND, SCHRIFT, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";

const UNBEKANNT = "__unbekannt__";

/** Formularwert → Profilwert; null = „weiß ich nicht“ (wie im Web, E-111). */
function wertAus(f: Frage, roh: string | string[] | undefined, sprache: "de" | "en"): unknown {
  if (roh === undefined || roh === UNBEKANNT || (Array.isArray(roh) && roh.includes(UNBEKANNT))) return null;
  switch (f.art) {
    case "mehrfach":
      return Array.isArray(roh) && roh.length ? roh : null;
    case "janein":
      return roh === "ja" ? true : roh === "nein" ? false : null;
    case "zahl":
    case "betrag": {
      const text = (sprache === "en" ? String(roh).replace(/,/g, "") : String(roh).replace(/\./g, "").replace(",", ".")).trim();
      return text === "" ? null : Number(text);
    }
    default:
      return String(roh).trim() || null;
  }
}

/**
 * Schnellstart in der App (E-111, E-117): Unternehmen anlegen, dann fünf Schritte mit den Kernfragen.
 * Eine Frage je Bildschirmabschnitt, große Antwortflächen, Fortschritt oben. Nach dem letzten Schritt: Heute.
 */
export function Schnellstart({ fertig, phase = "schnell", profilStart = {}, abbrechen }: { fertig: () => void; phase?: "schnell" | "nachfragen"; profilStart?: Record<string, unknown>; abbrechen?: () => void }) {
  const { t, sprache, klient, ich, anmeldenAktualisieren } = useAmtlos();
  const f = useFarben();
  const [name, setName] = useState("");
  const [profil, setProfil] = useState<Record<string, unknown>>(profilStart);
  // Nachfragen: die Schrittfolge steht beim Start fest (sonst verschwänden beantwortete Fragen aus der Zählung)
  const [basis] = useState<Record<string, unknown>>(profilStart);
  const [antworten, setAntworten] = useState<Record<string, string | string[]>>({});
  const [pos, setPos] = useState(phase === "nachfragen" || ich?.unternehmen.length ? 0 : -1); // -1 = Unternehmen anlegen
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const schritte = useMemo(() => schritteJePhase(phase, phase === "nachfragen" ? basis : profil), [phase, basis, profil]);
  const schritt = schritte[pos];
  const fragen = schritt ? fragenJePhase(schritt, phase, basis) : [];
  const gesamt = schritte.reduce((n, s) => n + fragenJePhase(s, phase, basis).length, 0);
  const bisher = schritte.slice(0, Math.max(0, pos)).reduce((n, s) => n + fragenJePhase(s, phase, basis).length, 0);

  async function unternehmenAnlegen() {
    setLaedt(true);
    setFehler(null);
    try {
      const u = await klient.unternehmenAnlegen(name.trim());
      await anmeldenAktualisieren(u.id);
      setPos(0);
    } catch (e) {
      setFehler(e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e));
    } finally {
      setLaedt(false);
    }
  }

  async function weiter() {
    if (!schritt) return;
    setLaedt(true);
    setFehler(null);
    const daten = { ...profil };
    for (const fr of fragen) daten[fr.feld] = wertAus(fr, antworten[fr.feld], sprache);
    try {
      const p = await klient.profilSpeichern(daten);
      setProfil(p.daten ?? daten);
      const naechste = schritteJePhase(phase, phase === "nachfragen" ? basis : (p.daten ?? daten));
      const i = naechste.findIndex((s) => s.id === schritt.id);
      if (i + 1 < naechste.length) setPos(i + 1);
      else fertig();
    } catch (e) {
      setFehler(e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e));
    } finally {
      setLaedt(false);
    }
  }

  const setzen = (feld: string, wert: string | string[]) => setAntworten((a) => ({ ...a, [feld]: wert }));
  const feldStil = { minHeight: ZIEL, borderWidth: 1.5, borderColor: f.linie, borderRadius: RADIUS.klein, paddingHorizontal: 14, color: f.tinte, backgroundColor: f.blatt, fontFamily: SCHRIFT.regular, fontSize: 17 } as const;

  function Option({ feld, wert, text, mehrfach }: { feld: string; wert: string; text: string; mehrfach?: boolean }) {
    const aktuell = antworten[feld];
    const an = mehrfach ? Array.isArray(aktuell) && aktuell.includes(wert) : aktuell === wert;
    return (
      <Pressable
        accessibilityRole={mehrfach ? "checkbox" : "radio"}
        accessibilityState={{ checked: an }}
        onPress={() => {
          if (!mehrfach) return setzen(feld, wert);
          const liste = Array.isArray(aktuell) ? aktuell : [];
          setzen(feld, an ? liste.filter((x) => x !== wert) : [...liste.filter((x) => x !== UNBEKANNT), wert]);
        }}
        style={{ minHeight: ZIEL + 4, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderRadius: RADIUS.klein, backgroundColor: an ? f.amtHauch : f.blatt, borderWidth: 1.5, borderColor: an ? f.amt : f.linie, marginTop: 8 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: mehrfach ? 5 : 11, borderWidth: 2, borderColor: an ? f.amt : f.tinteLeise, backgroundColor: an ? f.amt : "transparent", alignItems: "center", justifyContent: "center" }}>
          {an ? <Symbol name="checkmark" groesse={13} farbe={f.blatt} gewicht="bold" /> : null}
        </View>
        <T stil={{ flex: 1 }}>{text}</T>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {pos === -1 ? (
            <>
              <T v="klein" leise>{t.onboarding.schnellstart} · {t.onboarding.dauer}</T>
              <T v="grossTitel" accessibilityRole="header" stil={{ marginTop: 4 }}>{t.unternehmen.neu_titel}</T>
              <T leise stil={{ marginTop: 8 }}>{t.unternehmen.neu_text}</T>
              {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
              <T v="klein" fett nativeID="name" stil={{ marginTop: 24 }}>{t.unternehmen.name}</T>
              <TextInput accessibilityLabelledBy="name" accessibilityLabel={t.unternehmen.name} value={name} onChangeText={setName} autoFocus autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => name.trim() && void unternehmenAnlegen()} style={[feldStil, { marginTop: 6 }]} />
              <Knopf text={t.unternehmen.anlegen} onPress={() => void unternehmenAnlegen()} laedt={laedt} deaktiviert={name.trim().length < 2} stil={{ marginTop: 20 }} />
            </>
          ) : schritt ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <T v="klein" leise>{phase === "schnell" ? t.onboarding.schnellstart : t.onboarding.nachfragen_titel} · {fuelle(t.onboarding.schritt, { n: pos + 1, gesamt: schritte.length })}</T>
                {abbrechen ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t.onboarding.spaeter_weiter} onPress={abbrechen} style={{ width: ZIEL - 8, height: ZIEL - 8, alignItems: "center", justifyContent: "center", borderRadius: ZIEL, backgroundColor: f.blatt }}>
                    <Symbol name="xmark" groesse={15} farbe={f.tinte} />
                  </Pressable>
                ) : null}
              </View>
              <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: gesamt, now: bisher }} style={{ marginTop: 8, height: 4, borderRadius: 2, backgroundColor: f.linieLeise, overflow: "hidden" }}>
                <View style={{ width: `${gesamt ? Math.round((bisher / gesamt) * 100) : 0}%`, height: 4, backgroundColor: f.amt }} />
              </View>
              <T v="grossTitel" accessibilityRole="header" stil={{ marginTop: 14 }}>{schritt.titel[sprache]}</T>
              {fehler ? <Hinweis art="fehler" text={fuelle(t.fehler.eingabe, { details: fehler })} /> : null}
              {fragen.map((fr) => (
                <View key={fr.feld} style={{ marginTop: 24 }}>
                  <T v="gross" nativeID={fr.feld}>{fr.frage[sprache]}</T>
                  {fr.hilfe ? <T v="klein" leise stil={{ marginTop: 4 }}>{fr.hilfe[sprache]}</T> : null}
                  {fr.art === "auswahl" || fr.art === "mehrfach" ? (
                    <View accessibilityRole={fr.art === "mehrfach" ? undefined : "radiogroup"} style={{ marginTop: 6 }}>
                      {Object.entries(fr.optionen ?? {}).map(([k, v]) => (
                        <Option key={k} feld={fr.feld} wert={k} text={v[sprache]} mehrfach={fr.art === "mehrfach"} />
                      ))}
                      {fr.art === "auswahl" ? <Option feld={fr.feld} wert={UNBEKANNT} text={t.onboarding.spaeter} /> : null}
                    </View>
                  ) : fr.art === "janein" ? (
                    <View accessibilityRole="radiogroup" style={{ marginTop: 6 }}>
                      <Option feld={fr.feld} wert="ja" text={t.gemeinsam.ja} />
                      <Option feld={fr.feld} wert="nein" text={t.gemeinsam.nein} />
                      <Option feld={fr.feld} wert={UNBEKANNT} text={t.onboarding.spaeter} />
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabelledBy={fr.feld}
                      accessibilityLabel={fr.frage[sprache]}
                      value={typeof antworten[fr.feld] === "string" ? (antworten[fr.feld] as string) : ""}
                      onChangeText={(w) => setzen(fr.feld, w)}
                      keyboardType={fr.art === "zahl" ? "number-pad" : fr.art === "betrag" ? "decimal-pad" : fr.art === "datum" ? "numbers-and-punctuation" : "default"}
                      placeholder={fr.art === "datum" ? "JJJJ-MM-TT" : undefined}
                      placeholderTextColor={f.tinteLeise}
                      style={[feldStil, { marginTop: 10, maxWidth: 240 }]}
                    />
                  )}
                </View>
              ))}
              <Knopf text={pos + 1 < schritte.length ? t.onboarding.weiter : t.onboarding.fertig} symbol="arrow.right" onPress={() => void weiter()} laedt={laedt} stil={{ marginTop: 28 }} />
              {pos > 0 ? <Knopf leise text={t.onboarding.zurueck} onPress={() => setPos(pos - 1)} stil={{ marginTop: 10 }} /> : null}
              <T v="caption" leise stil={{ marginTop: 16 }}>{phase === "schnell" ? t.onboarding.schnell_hinweis : t.onboarding.unterbrechen}</T>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
