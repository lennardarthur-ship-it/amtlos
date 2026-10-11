import { View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import type { Schwellen as SchwellenT } from "../../kern/typen";
import { Karte, T } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Inhalt, useLaden } from "../gemeinsam";

/** Wenn dein Team wächst (6.6): je Stufe die neu hinzukommenden Pflichten – mit deinen heutigen Angaben gerechnet. */
export function Schwellen() {
  const { t, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const { daten, neu, laedt } = useLaden(() => klient.holen<SchwellenT>("/v1/personal/schwellen"), [unternehmenId]);
  return (
    <Unterseite titel={t.personal.schwellen_titel}>
      <Inhalt laedt={laedt} neu={neu}>
        <T leise>{t.personal.schwellen_text}</T>
        {daten ? <T fett stil={{ marginTop: 12 }}>{fuelle(t.personal.schwellen_aktuell, { n: daten.aktuell })}</T> : null}
        {daten?.schwellen.map((s) => (
          <Karte key={s.ab} stil={{ marginTop: 12, paddingVertical: 12 }}>
            <T fett>{fuelle(t.personal.schwelle_ab, { n: s.ab })}</T>
            {!s.neu.length && !s.zu_pruefen.length ? <T v="klein" leise stil={{ marginTop: 4 }}>{t.personal.schwelle_nichts}</T> : null}
            {s.neu.map((p) => (
              <View key={p.pflicht_id} style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.amt, marginTop: 8 }} />
                <T v="klein" stil={{ flex: 1 }}>{p.titel}</T>
              </View>
            ))}
            {s.zu_pruefen.length ? <T v="caption" leise stil={{ marginTop: 8 }}>{t.personal.zu_pruefen}: {s.zu_pruefen.map((p) => p.titel).join(", ")}</T> : null}
          </Karte>
        ))}
      </Inhalt>
    </Unterseite>
  );
}
