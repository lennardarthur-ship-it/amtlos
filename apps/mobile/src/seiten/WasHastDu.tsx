import { useState } from "react";
import { ScrollView, View } from "react-native";
import { T as TEXT } from "../texte";
import { BausteinListe, Fuss, Hinweis, Knopf, T } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { RAND, useFarben } from "../ui/thema";
import type { PflichtInfo } from "../pflichten/check";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { bestaetigungFuer, schonDaGruppen } from "./schonDa";

/**
 * „Was hast du schon?“ – im Check vor dem Ergebnis, für Betriebe, die schon länger als vier Wochen laufen (R11 Berater d,
 * R12 UX #1/#2/#19). Nach Bereichen gegliedert, ohne „Alle auswählen“ (das verleitete zum Durchwinken). Abgehakt wird
 * mit derselben Handlung wie in der Pflicht („Als erledigt markieren“ bzw. die Bestätigung) – jederzeit zurücknehmbar.
 */
export function WasHastDuSchon({ liste, fertig }: { liste: PflichtInfo[]; fertig: () => void }) {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const uebernehmen = () => {
    const tag = heute();
    for (const id of gewaehlt) z.erledigtSetzen(id, tag);
    if (gewaehlt.length) melden(TEXT.r11_schon_fertig(gewaehlt.length));
    fertig();
  };
  const gruppen = schonDaGruppen(liste);
  return (
    <View style={{ flex: 1, backgroundColor: f.papier }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 12, paddingBottom: 32 }}>
        <T v="titel" accessibilityRole="header">{TEXT.r11_schon_titel}</T>
        <T leise stil={{ marginTop: 8 }}>{TEXT.r11_schon_text}</T>
        {gruppen.map((g) => (
          <BausteinListe
            key={g.bereich}
            label={TEXT.r12_schon_bereich(g.titel, g.pflichten.length)}
            werte={gewaehlt.filter((id) => g.pflichten.some((p) => p.id === id))}
            aendern={(w) => setGewaehlt([...gewaehlt.filter((id) => !g.pflichten.some((p) => p.id === id)), ...w])}
            // bei „bestätigen“ (Kasse gemeldet …) steht dabei, was der Haken bestätigt – passend zum Profil (Impressum ohne Website)
            optionen={g.pflichten.map((p) => {
              const b = bestaetigungFuer(p, z.stand.profil);
              return { wert: p.id, text: p.titel, quelle: b ? TEXT.r11_schon_bestaetigt(b) : undefined };
            })}
          />
        ))}
        <View style={{ marginTop: 12 }}>
          <Hinweis text={TEXT.r11_schon_hinweis} />
        </View>
      </ScrollView>
      <Fuss>
        <Knopf symbol="checkmark" text={gewaehlt.length ? TEXT.r11_schon_uebernehmen(gewaehlt.length) : TEXT.r11_schon_nichts} onPress={uebernehmen} stil={{ flex: 1 }} />
      </Fuss>
    </View>
  );
}
