import { Linking, View } from "react-native";
import { BEREICHE, VORLAGEN, fehlendeAngaben, unterlagenName, vorlageFuer, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Hinweis, Karte, Knopf, Symbol, T, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { pflichtenFuer, rechtsgrundlagen } from "../unterlagen/katalog";
import { betriebFehlt, sortiert, type Unterlage } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { BetriebFormular } from "./Betrieb";
import { Formular } from "./Formular";
import { BEREICH_SYMBOL, Gruppe, Inhalt, Seite, datumKurz } from "./gemeinsam";

/** Zeile für eine eigene Unterlage: Name, wann geändert, was noch fehlt. */
export function UnterlageZeile({ u, letzte, onPress }: { u: Unterlage; letzte: boolean; onPress: () => void }) {
  const f = useFarben();
  const v = vorlageFuer(u.vorlage)!;
  const n = fehlendeAngaben(v, u.daten).length;
  return (
    <Zeile
      links={<Symbol name="doc.richtext" groesse={22} farbe={n ? f.bald : f.amt} />}
      titel={unterlagenName(v, u.daten)}
      text={`${TEXT.geaendert(datumKurz(u.geaendert))} · ${n ? TEXT.fehlen(n) : TEXT.vollstaendig}`}
      onPress={onPress}
      letzte={letzte}
    />
  );
}

/** Was eine Vorlage ist, wozu man sie braucht, Rechtsgrundlage – und los. */
function VorlageSeite({ id }: { id: string }) {
  const { stand, anlegen } = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const v = vorlageFuer(id)!;
  const eigene = sortiert(stand).filter((u) => u.vorlage === id);
  const oeffnen = (uid: string) => nav.oeffnen(`formular-${uid}`, () => <Formular id={uid} />);
  const pflichten = pflichtenFuer(v);
  const quellen = pflichten.flatMap((p) => p.quellen).filter((q, i, a) => a.findIndex((x) => x.url === q.url) === i);
  return (
    <Unterseite titel={v.titel}>
      <Inhalt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Symbol name={BEREICH_SYMBOL[v.bereich]} groesse={22} farbe={f.amt} />
          <T v="klein" leise>{BEREICHE.find((b) => b.id === v.bereich)?.titel}</T>
        </View>
        <T v="grossTitel" accessibilityRole="header" stil={{ marginTop: 6, fontSize: 30, lineHeight: 36 }}>{v.titel}</T>
        <T stil={{ marginTop: 8 }}>{v.beschreibung}</T>
        <Knopf text={eigene.length ? TEXT.neu_ausfuellen : TEXT.ausfuellen} symbol="plus" onPress={() => oeffnen(anlegen(id).id)} stil={{ marginTop: 20 }} />

        {eigene.length ? (
          <Gruppe titel={TEXT.vorhanden}>
            <Karte>
              {eigene.map((u, i) => (
                <UnterlageZeile key={u.id} u={u} letzte={i === eigene.length - 1} onPress={() => oeffnen(u.id)} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}

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
        <Gruppe titel={TEXT.grundlage}>
          <T>{rechtsgrundlagen(v).join(" · ")}</T>
        </Gruppe>
        {quellen.length ? (
          <Gruppe titel={TEXT.quellen}>
            <Karte>
              {quellen.map((q, i) => (
                <Zeile key={q.url} titel={q.titel} text={q.url.replace(/^https?:\/\//, "").split("/")[0]} rechts={<Symbol name="arrow.right" groesse={16} />} onPress={() => void Linking.openURL(q.url)} letzte={i === quellen.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        <View style={{ marginTop: 20 }}>
          <Hinweis text={TEXT.nicht_geprueft} />
        </View>
      </Inhalt>
    </Unterseite>
  );
}

function VorlageZeile({ v, anzahl, letzte, onPress }: { v: Vorlage; anzahl: number; letzte: boolean; onPress: () => void }) {
  const f = useFarben();
  return (
    <Zeile
      titel={v.titel}
      text={v.beschreibung}
      onPress={onPress}
      letzte={letzte}
      rechts={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {anzahl ? (
            <View accessibilityLabel={`${anzahl} angelegt`} style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: f.amtHauch }}>
              <T v="caption" fett farbe={f.amtTief}>{anzahl}</T>
            </View>
          ) : null}
          <Symbol name="chevron.right" groesse={16} />
        </View>
      }
    />
  );
}

/** Startseite: alle Vorlagen nach Bereich – der Nutzer wählt selbst, was er braucht. */
export function Unterlagen() {
  const { stand } = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  return (
    <Seite titel={TEXT.unterlagen_titel} unterzeile={TEXT.unterlagen_unter}>
      {betriebFehlt(stand.betrieb) ? (
        <Karte stil={{ paddingVertical: 14, gap: 12, marginBottom: 4 }} rahmen={f.amt}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Symbol name="building.2" groesse={22} farbe={f.amt} />
            <T stil={{ flex: 1 }}>{TEXT.betrieb_hinweis}</T>
          </View>
          <Knopf
            text={TEXT.betrieb_eintragen}
            onPress={() =>
              nav.oeffnen("betrieb", () => (
                <Unterseite titel={TEXT.betrieb_titel}>
                  <Inhalt>
                    <BetriebFormular />
                  </Inhalt>
                </Unterseite>
              ))
            }
          />
        </Karte>
      ) : null}
      {BEREICHE.map((b) => {
        const liste = VORLAGEN.filter((v) => v.bereich === b.id);
        return (
          <View key={b.id} style={{ marginTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginLeft: 2 }}>
              <Symbol name={BEREICH_SYMBOL[b.id]} groesse={18} farbe={f.tinteLeise} />
              <T v="klein" fett leise accessibilityRole="header">{b.titel}</T>
            </View>
            <Karte>
              {liste.map((v, i) => (
                <VorlageZeile key={v.id} v={v} anzahl={stand.unterlagen.filter((u) => u.vorlage === v.id).length} letzte={i === liste.length - 1} onPress={() => nav.oeffnen(`vorlage-${v.id}`, () => <VorlageSeite id={v.id} />)} />
              ))}
            </Karte>
          </View>
        );
      })}
      <T v="caption" leise stil={{ marginTop: 24 }}>{TEXT.ueber}</T>
    </Seite>
  );
}
