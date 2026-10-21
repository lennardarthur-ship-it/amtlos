import { Linking, View } from "react-native";
import { BEREICHE, KURZ, PRUEFHINWEIS, vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Karte, Symbol, T, Zeile } from "../ui/bausteine";
import { Unterseite } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { pflichtenFuer, rechtsgrundlagen } from "../unterlagen/katalog";
import { mitVorlagenHinweis } from "../rechtshinweis";
import { BEREICH_SYMBOL, Gruppe, Inhalt, RechtsHinweis } from "./gemeinsam";

/** „Wozu brauche ich das?“ – Zweck, Rechtsgrundlage und Quellen einer Vorlage, nur auf Nachfrage (E-124). */
export function InfoSeite({ id }: { id: string }) {
  const f = useFarben();
  const v = vorlageFuer(id)!;
  const pflichten = pflichtenFuer(v);
  const quellen = pflichten.flatMap((p) => p.quellen).filter((q, i, a) => a.findIndex((x) => x.url === q.url) === i);
  return (
    <Unterseite titel={v.titel}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Symbol name={BEREICH_SYMBOL[v.bereich]} groesse={18} farbe={f.tinteLeise} />
          <T v="klein" leise>{BEREICHE.find((b) => b.id === v.bereich)?.titel}</T>
        </View>
        <T stil={{ marginTop: 8 }}>{KURZ[v.id] ?? v.beschreibung}</T>
        <T leise stil={{ marginTop: 8 }}>{v.beschreibung}</T>
        {pflichten.length ? (
          <Gruppe titel={TEXT.wozu}>
            <Karte stil={{ paddingVertical: 4 }}>
              {pflichten.map((p, i) => (
                <View key={p.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
                  <T fett>{p.titel}</T>
                  <T v="klein" leise stil={{ marginTop: 2 }}>{p.kurz}</T>
                </View>
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {rechtsgrundlagen(v).length || v.grundlage ? (
          <Gruppe titel={TEXT.grundlage}>
            <T>{v.grundlage ?? rechtsgrundlagen(v).join(" · ")}</T>
          </Gruppe>
        ) : null}
        {quellen.length ? (
          <Gruppe titel={TEXT.quellen}>
            <Karte>
              {quellen.map((q, i) => (
                <Zeile key={q.url} titel={q.titel} text={q.url.replace(/^https?:\/\//, "").split("/")[0]} rechts={<Symbol name="arrow.right" groesse={16} />} onPress={() => void Linking.openURL(q.url)} letzte={i === quellen.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {/* Prüfstand als ruhige Fußnote (R10) – deutlich gesagt wird er einmal zu Beginn des Pflichten-Checks */}
        {mitVorlagenHinweis(v) ? <RechtsHinweis art="vorlage" oben={20} /> : null}
        <T v="caption" leise stil={{ marginTop: mitVorlagenHinweis(v) ? 4 : 20 }}>{PRUEFHINWEIS}</T>
      </Inhalt>
    </Unterseite>
  );
}
