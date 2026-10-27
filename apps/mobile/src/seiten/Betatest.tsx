import { useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BETATEST_SCHLUESSEL, BETATEST_UMGEBUNG, betatestAngenommen, betatestAnnahme, betatestHinweis, betatestZeitraum, type BetatestZeitraum } from "../betatest";
import { geheimLesen, geheimSchreiben } from "../konto/geheim";
import { T as TEXT } from "../texte";
import { Kachel, Knopf, T } from "../ui/bausteine";
import { useFarben } from "../ui/thema";

/**
 * E-234 (Rechtsanwalt 27.10.2026, R5): In Betatest-Builds erst der Testhinweis mit „Ich nehme teil“ – vor jeder Nutzung.
 * Der Zeitpunkt bleibt im Schlüsselbund dieses Geräts (nicht im Stand, nicht in Sicherungen). Ohne gültigen Testzeitraum
 * bleibt die Testversion gesperrt (kein Hinweis mit Platzhaltern). Außerhalb von Betatest-Builds unverändert.
 */
export function BetatestTor({ children }: { children: React.ReactNode }) {
  if (!BETATEST_UMGEBUNG.an) return <>{children}</>;
  return <BetatestPruefung>{children}</BetatestPruefung>;
}

function BetatestPruefung({ children }: { children: React.ReactNode }) {
  const zeitraum = betatestZeitraum(BETATEST_UMGEBUNG.von, BETATEST_UMGEBUNG.bis);
  const [stand, setStand] = useState<"laedt" | "offen" | "angenommen">("laedt");
  useEffect(() => {
    if (!zeitraum) return;
    let aktiv = true;
    void geheimLesen(BETATEST_SCHLUESSEL)
      .then((roh) => aktiv && setStand(betatestAngenommen(roh, zeitraum) ? "angenommen" : "offen"))
      .catch(() => aktiv && setStand("offen"));
    return () => {
      aktiv = false;
    };
  }, [zeitraum?.von, zeitraum?.bis]);
  if (!zeitraum) return <BetatestSeite zeitraum={null} />;
  if (stand === "angenommen") return <>{children}</>;
  if (stand === "laedt") return null;
  return (
    <BetatestSeite
      zeitraum={zeitraum}
      annehmen={() => {
        const a = betatestAnnahme(zeitraum);
        void geheimSchreiben(BETATEST_SCHLUESSEL, JSON.stringify(a)).catch(() => undefined).finally(() => setStand("angenommen"));
      }}
    />
  );
}

export function BetatestSeite({ zeitraum, annehmen }: { zeitraum: BetatestZeitraum | null; annehmen?: () => void }) {
  const f = useFarben();
  if (!zeitraum)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: f.papier, padding: 24, gap: 14 }}>
        <Kachel symbol="exclamationmark.triangle" groesse={60} />
        <T v="titel" accessibilityRole="header">{TEXT.betatest_ohne_zeitraum_titel}</T>
        <T>{TEXT.betatest_ohne_zeitraum}</T>
      </SafeAreaView>
    );
  const h = betatestHinweis(zeitraum, { art: "app", testflight: Platform.OS === "ios" });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, gap: 12 }}>
        <Kachel symbol="hammer" groesse={60} />
        <T v="titel" accessibilityRole="header" stil={{ marginTop: 6 }}>{h.titel}</T>
        {h.absaetze.map((a) => (
          <T key={a.slice(0, 3)} v="klein">{a}</T>
        ))}
        <T v="klein" fett>{h.bestaetigung}</T>
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 10, gap: 12, borderTopWidth: 1, borderColor: f.linieLeise }}>
        <Knopf text={TEXT.betatest_teilnehmen} onPress={() => annehmen?.()} />
        <T v="caption" leise>{TEXT.betatest_gespeichert}</T>
      </View>
    </SafeAreaView>
  );
}
