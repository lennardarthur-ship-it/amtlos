import { useMemo } from "react";
import { Linking, Pressable, View } from "react-native";
import { rechtsstandHinweisTexte } from "../pflichten/aktualitaet";
import { PLATTFORM } from "../plattform";
import { aktualisierenLink } from "../rechtliches";
import { T as TEXT } from "../texte";
import { Karte, Symbol, T, TextKnopf } from "../ui/bausteine";
import { RADIUS, useFarben } from "../ui/thema";
import { heute } from "../unterlagen/speicher";

/**
 * E-240: „Rechtsstand vom TT.MM.JJJJ – bitte App aktualisieren“ auf „Heute“ (Karte) und in der Einleitung des
 * Pflichten-Checks (`buehne`). Nur ein Hinweis mit Link zur Store-Seite – nichts wird gesperrt. Im Web (Vorschau) ohne Link.
 */
export function RechtsstandHinweis({ buehne }: { buehne?: boolean }) {
  const f = useFarben();
  const tag = heute();
  const h = useMemo(() => rechtsstandHinweisTexte(tag), [tag]);
  if (!h) return null;
  const link = PLATTFORM === "web" ? "" : aktualisierenLink();
  const oeffnen = link ? () => void Linking.openURL(link).catch(() => undefined) : undefined;
  if (buehne) {
    return (
      <Pressable disabled={!oeffnen} onPress={oeffnen} accessibilityRole={oeffnen ? "link" : "text"} accessibilityLabel={`${h.titel}. ${h.text}`} accessibilityHint={oeffnen ? TEXT.e240_aktualisieren : undefined} style={{ marginTop: 12, flexDirection: "row", gap: 10, padding: 14, borderRadius: RADIUS.knopf, backgroundColor: f.buehneFlaeche }}>
        <Symbol name="arrow.triangle.2.circlepath" groesse={17} farbe={f.minze} gewicht="semibold" />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="klein" fett farbe={f.buehneText}>{h.titel}</T>
          <T v="klein" farbe={f.buehneLeise}>{h.text}</T>
          {oeffnen ? <T v="klein" fett farbe={f.minze}>{TEXT.e240_aktualisieren}</T> : null}
        </View>
      </Pressable>
    );
  }
  return (
    <Karte stil={{ marginBottom: 18 }}>
      <View accessible accessibilityRole="text" style={{ flexDirection: "row", gap: 12, paddingTop: 14, paddingBottom: oeffnen ? 4 : 14 }}>
        <Symbol name="arrow.triangle.2.circlepath" groesse={20} farbe={f.bald} gewicht="semibold" />
        <View style={{ flex: 1, gap: 4 }}>
          <T fett>{h.titel}</T>
          <T v="klein" leise>{h.text}</T>
        </View>
      </View>
      {oeffnen ? <TextKnopf text={TEXT.e240_aktualisieren} onPress={oeffnen} stil={{ marginLeft: 32 }} /> : null}
    </Karte>
  );
}
