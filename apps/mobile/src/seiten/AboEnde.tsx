/**
 * E-200: Hinweis bei Kündigung bzw. Ende von Pro (`pro/aboEnde.ts`): Die Aufzeichnungs- und Aufbewahrungspflichten laufen
 * weiter (Rechnungen, Belege, Kasse) – mit Weg zum kostenlosen Export. Auf „Heute“ und unter „Mein Betrieb“; weggetippt
 * je Anlass.
 */
import { View } from "react-native";
import { aboHinweis } from "../pro/aboEnde";
import { T as TEXT } from "../texte";
import { Hinweis, Karte, Knopf, TextKnopf } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useAmtlos } from "../zustand";
import { PruefexportSeite } from "./Pruefexport";

const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export function AboEndeHinweis({ stil }: { stil?: object } = {}) {
  const z = useAmtlos();
  const nav = useNav();
  const h = aboHinweis({ pro: z.pro, proBekannt: z.proBekannt, abo: z.abo, proZuletzt: z.stand.proZuletzt, gesehen: z.stand.aboHinweisGesehen });
  if (!h) return null;
  const text = h.art === "gekuendigt" ? TEXT.e200_abo_gekuendigt(h.endetAm ? datumDe(h.endetAm) : null) : TEXT.e200_abo_beendet;
  return (
    <Karte stil={{ marginBottom: 18, paddingVertical: 12, gap: 10, ...stil }}>
      <Hinweis art="warnung" text={text} />
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Knopf ton symbol="square.and.arrow.up" text={TEXT.e200_abo_export} onPress={() => nav.oeffnen("pruefexport", () => <PruefexportSeite />, true)} stil={{ flex: 1 }} />
        <TextKnopf text={TEXT.e200_abo_verstanden} onPress={() => z.aboHinweisWeg(h.schluessel)} />
      </View>
    </Karte>
  );
}
