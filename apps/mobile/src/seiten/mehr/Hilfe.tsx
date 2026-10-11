import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type { Begriff } from "../../kern/typen";
import { Karte, Symbol, T } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { RADIUS, SCHRIFT, ZIEL, useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useLaden } from "../gemeinsam";

/** Anleitungen zu den Kernmodulen (wie apps/web hilfe, ohne ausgeblendete Module, E-110). */
const KERN_ANLEITUNGEN = ["einstellen", "unterweisen", "zeiten", "rechnung", "app"];

/** Hilfe: kurze Anleitungen und alle Fachbegriffe aus dem Katalog, durchsuchbar. */
export function Hilfe() {
  const { t, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const { daten } = useLaden(() => klient.holen<Begriff[]>("/v1/glossar"), [unternehmenId]);
  const [suche, setSuche] = useState("");
  const [offen, setOffen] = useState<string | null>(null);
  const anleitungen = (t.hilfe.anleitungen as unknown as { id: string; titel: string; schritte: string[] }[]).filter((a) => KERN_ANLEITUNGEN.includes(a.id));
  const treffer = (daten ?? []).filter((b) => !suche.trim() || `${b.begriff} ${b.erklaerung}`.toLowerCase().includes(suche.trim().toLowerCase()));
  return (
    <Unterseite titel={t.hilfe.titel}>
      <Inhalt>
        <Gruppe titel={t.hilfe.anleitungen_titel}>
          <Karte>
            {anleitungen.map((a, i) => (
              <View key={a.id} style={{ borderBottomWidth: i === anleitungen.length - 1 ? 0 : 1, borderColor: f.linieLeise }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: offen === a.id }} onPress={() => setOffen(offen === a.id ? null : a.id)} style={{ minHeight: ZIEL, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                  <T fett stil={{ flex: 1 }}>{a.titel}</T>
                  <Symbol name={offen === a.id ? "chevron.left" : "chevron.right"} groesse={14} />
                </Pressable>
                {offen === a.id
                  ? a.schritte.map((s, j) => (
                      <View key={j} style={{ flexDirection: "row", gap: 10, paddingBottom: 10 }}>
                        <T fett farbe={f.amt}>{j + 1}.</T>
                        <T v="klein" stil={{ flex: 1 }}>{s}</T>
                      </View>
                    ))
                  : null}
              </View>
            ))}
          </Karte>
        </Gruppe>
        <Gruppe titel={t.hilfe.begriffe_titel}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: ZIEL, borderRadius: RADIUS.klein, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie, paddingHorizontal: 12, marginBottom: 12 }}>
            <Symbol name="magnifyingglass" groesse={16} />
            <TextInput accessibilityLabel={t.mobil.suchen} value={suche} onChangeText={setSuche} placeholder={t.mobil.suchen} placeholderTextColor={f.tinteLeise} style={{ flex: 1, minHeight: ZIEL, color: f.tinte, fontFamily: SCHRIFT.regular, fontSize: 17 }} clearButtonMode="while-editing" />
          </View>
          {daten && !treffer.length ? <T leise>{t.hilfe.leer}</T> : null}
          {treffer.map((b) => (
            <Karte key={b.begriff} stil={{ marginBottom: 10, paddingVertical: 12 }}>
              <T fett>{b.begriff}</T>
              <T v="klein" stil={{ marginTop: 2 }}>{b.erklaerung}</T>
              <T v="caption" leise stil={{ marginTop: 6 }}>{t.hilfe.vorkommen}: {b.pflichten.map((p) => p.titel).join(", ")}</T>
            </Karte>
          ))}
        </Gruppe>
      </Inhalt>
    </Unterseite>
  );
}
