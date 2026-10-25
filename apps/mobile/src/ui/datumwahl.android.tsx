import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Symbol } from "./bausteine";
import { RADIUS, useFarben } from "./thema";

const isoAusDatum = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const datumAusIso = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date());

/**
 * Kalender-Knopf neben einem Datumsfeld – Android (E-190). Der Kalender von Android ist ein eigener Dialog des Systems
 * und lässt sich nicht wie auf dem iPhone in einen Bogen einbetten: Antippen öffnet ihn direkt,
 * „Übernehmen“ setzt das Datum, „Heute“ (dritter Knopf – den gibt es nur im klassischen Dialog, nicht in Material 3) den heutigen Tag, „Abbrechen“ (oder Zurück) ändert nichts. Tippen bleibt möglich.
 */
export function DatumWahl({ label, wert, aendern }: { label: string; wert: string | null; aendern: (iso: string) => void }) {
  const f = useFarben();
  const oeffnen = () =>
    DateTimePickerAndroid.open({
      value: datumAusIso(wert),
      mode: "date",
      firstDayOfWeek: 1,
      positiveButton: { label: TEXT.datum_uebernehmen },
      negativeButton: { label: TEXT.abbrechen },
      neutralButton: { label: TEXT.heute },
      onValueChange: (_e, d) => aendern(isoAusDatum(d)),
      onNeutralButtonPress: () => aendern(isoAusDatum(new Date())),
    });
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${TEXT.datum_waehlen}: ${label}`} onPress={oeffnen} style={({ pressed }) => ({ width: 50, minHeight: 50, borderRadius: RADIUS.klein, alignItems: "center", justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
        <Symbol name="calendar" groesse={20} farbe={f.amtTief} gewicht="semibold" />
      </Pressable>
    </View>
  );
}
