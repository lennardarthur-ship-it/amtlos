import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ANBIETER, NUTZUNGSBEDINGUNGEN, datenschutzAbschnitte, zustimmungNoetig } from "../rechtliches";
import { syncAngeboten } from "../konto/konfig";
import { T as TEXT } from "../texte";
import { Kachel, Kaestchen, Knopf, T, TextKnopf } from "../ui/bausteine";
import { useFarben } from "../ui/thema";
import { useAktionen, useAmtlosStatus, useStandWahl } from "../zustand";

const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Vorprüfung Recht (21.10.2026, § 305 Abs. 2 BGB): Einbeziehung der eigenen Nutzungsbedingungen beim ersten Start und
 * nach jeder neuen Fassung. Aktiv erst mit `NUTZUNGSBEDINGUNGEN.freigegeben` (rechtliches.ts) – bis dahin gilt Apples
 * Standard-EULA und der Start bleibt unverändert. Kein Konto, ein Kästchen (anfangs leer) und „Weiter“ (App Review);
 * bei Ladefehlern fragt die App nicht, damit Wiederherstellen erreichbar bleibt. Gespeichert werden Fassung und Zeitpunkt.
 */
export function ZustimmungTor({ children }: { children: React.ReactNode }) {
  const { bereit, ladefehler } = useAmtlosStatus();
  const zustimmung = useStandWahl((s) => s.nutzungsbedingungen);
  if (!bereit || ladefehler || !zustimmungNoetig(zustimmung)) return <>{children}</>;
  return <ZustimmungSeite neu={Boolean(zustimmung)} />;
}

export function ZustimmungSeite({ neu }: { neu: boolean }) {
  const f = useFarben();
  const { nutzungsbedingungenAnnehmen } = useAktionen();
  const [an, setAn] = useState(false);
  const [datenschutz, setDatenschutz] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, gap: 14 }}>
        <Kachel symbol="doc.plaintext" groesse={60} />
        <T v="titel" accessibilityRole="header" stil={{ marginTop: 6 }}>{neu ? TEXT.vr_titel_neu : TEXT.vr_titel}</T>
        <T>{neu ? TEXT.vr_text_neu(datumDe(NUTZUNGSBEDINGUNGEN.fassung)) : TEXT.vr_text}</T>
        <View>
          <TextKnopf text={TEXT.vr_bedingungen_lesen} label={TEXT.vr_bedingungen_link} onPress={() => void Linking.openURL(NUTZUNGSBEDINGUNGEN.url).catch(() => undefined)} />
          <TextKnopf text={datenschutz ? TEXT.vr_datenschutz_zu : TEXT.vr_datenschutz_lesen} symbol={datenschutz ? "chevron.up" : "chevron.down"} erweitert={datenschutz} onPress={() => setDatenschutz((d) => !d)} />
        </View>
        {datenschutz ? (
          <View style={{ gap: 12, paddingVertical: 4 }}>
            {ANBIETER.name ? (
              <View>
                <T fett accessibilityRole="header">{TEXT.verantwortlich_titel}</T>
                <T v="klein" stil={{ marginTop: 4 }}>{TEXT.verantwortlich_ist(ANBIETER.name, ANBIETER.anschrift, ANBIETER.email)}{ANBIETER.vertretung ? ` ${TEXT.vr_vertreten(ANBIETER.vertretung)}` : ""}</T>
              </View>
            ) : null}
            {datenschutzAbschnitte(syncAngeboten).map((a) => (
              <View key={a.titel}>
                <T fett accessibilityRole="header">{a.titel}</T>
                <T v="klein" stil={{ marginTop: 4 }}>{a.text}</T>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 10, gap: 12, borderTopWidth: 1, borderColor: f.linieLeise }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: an }}
          aria-checked={an}
          accessibilityLabel={TEXT.vr_akzeptieren}
          onPress={() => setAn((x) => !x)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
        >
          <Kaestchen an={an} />
          <T fett stil={{ flex: 1 }}>{TEXT.vr_akzeptieren}</T>
        </Pressable>
        <Knopf text={TEXT.vr_weiter} deaktiviert={!an} onPress={() => nutzungsbedingungenAnnehmen(NUTZUNGSBEDINGUNGEN.fassung)} />
        <T v="caption" leise>{TEXT.vr_gespeichert}</T>
      </View>
    </SafeAreaView>
  );
}
