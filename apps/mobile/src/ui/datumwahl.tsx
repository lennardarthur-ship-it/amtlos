import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as TEXT } from "../texte";
import { Knopf, Symbol, T } from "./bausteine";
import { RADIUS, ZIEL, useFarben } from "./thema";

const isoAusDatum = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const datumAusIso = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date());

/**
 * Kalender-Knopf neben einem Datumsfeld (iPhone): öffnet den eingebauten Kalender in einem Bogen von unten.
 * Tippen bleibt möglich – der Kalender ist der schnelle Weg für Daten, die nicht „heute“ sind.
 */
export function DatumWahl({ label, wert, aendern }: { label: string; wert: string | null; aendern: (iso: string) => void }) {
  const f = useFarben();
  const inset = useSafeAreaInsets();
  const [offen, setOffen] = useState(false);
  const [datum, setDatum] = useState<Date>(() => datumAusIso(wert));
  const oeffnen = () => {
    setDatum(datumAusIso(wert));
    setOffen(true);
  };
  const uebernehmen = () => {
    aendern(isoAusDatum(datum));
    setOffen(false);
  };
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${TEXT.datum_waehlen}: ${label}`} onPress={oeffnen} style={({ pressed }) => ({ width: 50, minHeight: 50, borderRadius: RADIUS.klein, alignItems: "center", justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
        <Symbol name="calendar" groesse={20} farbe={f.amtTief} gewicht="semibold" />
      </Pressable>
      <Modal visible={offen} transparent animationType="slide" onRequestClose={() => setOffen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.abbrechen} onPress={() => setOffen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <View style={{ backgroundColor: f.blatt, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(inset.bottom, 12) + 8, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T fett accessibilityRole="header">{label}</T>
            <Pressable accessibilityRole="button" accessibilityLabel={TEXT.abbrechen} onPress={() => setOffen(false)} hitSlop={8} style={{ width: ZIEL - 8, height: ZIEL - 8, alignItems: "center", justifyContent: "center" }}>
              <Symbol name="xmark" groesse={18} farbe={f.tinte} />
            </Pressable>
          </View>
          <DateTimePicker value={datum} mode="date" display="inline" locale="de-DE" themeVariant="light" accentColor={f.amt} onChange={(_, d) => d && setDatum(d)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Knopf ton text={TEXT.heute} onPress={() => { aendern(isoAusDatum(new Date())); setOffen(false); }} stil={{ flex: 1 }} />
            <Knopf text={TEXT.datum_uebernehmen} onPress={uebernehmen} stil={{ flex: 2 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
