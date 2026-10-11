import { useState } from "react";
import { Pressable, View } from "react-native";
import { datumLang } from "@amtlos/i18n";
import type { Ereignis } from "../../kern/typen";
import { DatumFeld, Hinweis, Karte, Knopf, Symbol, T } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { RADIUS, ZIEL, useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useAktion, useLaden } from "../gemeinsam";

/** Ereignisse, die Nutzer selbst melden (wie apps/web melden): Einstellung/Austritt laufen über Personal. */
const MELDBAR = ["neuer_arbeitsplatz", "neue_taetigkeit", "arbeitsunfall", "schwangerschaft_mitgeteilt", "neuer_vertriebskanal", "kasse_angeschafft", "kasse_ausser_betrieb", "rechtsformwechsel", "sitzverlegung", "gesellschafterwechsel", "betriebsaufgabe"] as const;

/** Änderung melden: Was ist passiert, wann? Danach rechnet Amtlos die Pflichten neu. */
export function Melden({ geaendert }: { geaendert?: () => void } = {}) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const { daten, neu } = useLaden(() => klient.holen<Ereignis[]>("/v1/ereignisse"), [unternehmenId]);
  const [typ, setTyp] = useState<string | null>(null);
  const [datum, setDatum] = useState<string | null>(null);
  const aktion = useAktion();
  const namen = t.ereignis as Record<string, string>;
  const eigene = daten?.filter((e) => !e.storniert_ereignis_id) ?? [];
  return (
    <Unterseite titel={t.melden.titel}>
      <Inhalt>
        <T leise>{t.melden.text}</T>
        <T v="caption" leise stil={{ marginTop: 6 }}>{t.melden.personal_hinweis} {t.personal.titel}.</T>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        <T v="klein" fett stil={{ marginTop: 18 }}>{t.melden.typ}</T>
        <View accessibilityRole="radiogroup" style={{ marginTop: 6 }}>
          {MELDBAR.map((x) => {
            const an = typ === x;
            return (
              <Pressable key={x} accessibilityRole="radio" accessibilityState={{ checked: an }} onPress={() => setTyp(x)} style={{ minHeight: ZIEL, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, marginTop: 6, borderRadius: RADIUS.klein, borderWidth: 1.5, borderColor: an ? f.amt : f.linie, backgroundColor: an ? f.amtHauch : f.blatt }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: an ? f.amt : f.tinteLeise, backgroundColor: an ? f.amt : "transparent" }} />
                <T stil={{ flex: 1 }}>{namen[x]}</T>
              </Pressable>
            );
          })}
        </View>
        <DatumFeld label={t.melden.datum} wert={datum} aendern={setDatum} />
        <Knopf
          text={t.melden.knopf}
          deaktiviert={!typ || !datum}
          laedt={aktion.laedt}
          onPress={() => void aktion.ausfuehren(async () => { await klient.schicken("/v1/ereignisse", "POST", { typ, datum }); setTyp(null); await neu(); geaendert?.(); }, t.melden.gemeldet)}
          stil={{ marginTop: 20 }}
        />
        {eigene.length ? (
          <Gruppe titel={t.melden.bisher}>
            <Karte>
              {eigene.map((e, i) => (
                <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === eigene.length - 1 ? 0 : 1, borderColor: f.linieLeise }}>
                  <Symbol name="flag" groesse={18} farbe={e.storniert ? f.tinteLeise : f.amt} />
                  <View style={{ flex: 1 }}>
                    <T fett farbe={e.storniert ? f.tinteLeise : f.tinte} stil={e.storniert ? { textDecorationLine: "line-through" } : undefined}>{namen[e.typ] ?? e.typ}</T>
                    <T v="caption" leise>{datumLang(e.datum, sprache)}{e.storniert ? ` · ${t.melden.storniert}` : ""}</T>
                  </View>
                  {!e.storniert && (MELDBAR as readonly string[]).includes(e.typ) ? (
                    <Pressable accessibilityRole="button" onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/ereignisse/${e.id}/storno`, "POST"); await neu(); geaendert?.(); })} style={{ minHeight: 40, justifyContent: "center" }}>
                      <T v="klein" farbe={f.amt}>{t.melden.stornieren}</T>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Karte>
          </Gruppe>
        ) : null}
      </Inhalt>
    </Unterseite>
  );
}
