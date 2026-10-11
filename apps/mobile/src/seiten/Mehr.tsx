import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Absatz, Hinweis, Knopf, Titel } from "../ui/bausteine";
import { GROESSE, ZIEL, useFarben } from "../ui/thema";
import { pushEinschalten, type PushErgebnis } from "../push";
import { useAmtlos } from "../zustand";
import { Seite } from "./gemeinsam";

function Auswahl({ titel, optionen, aktiv, waehlen }: { titel: string; optionen: { wert: string; text: string }[]; aktiv: string | null; waehlen: (w: string) => void }) {
  const f = useFarben();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titel} style={{ marginVertical: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: GROESSE.gross, fontWeight: "700", color: f.tinte, marginBottom: 4 }}>
        {titel}
      </Text>
      {optionen.map((o) => (
        <Pressable key={o.wert} accessibilityRole="radio" accessibilityState={{ checked: o.wert === aktiv }} onPress={() => waehlen(o.wert)} style={{ minHeight: ZIEL, justifyContent: "center", borderBottomWidth: 1, borderColor: f.linie }}>
          <Text style={{ fontSize: GROESSE.basis, color: o.wert === aktiv ? f.amt : f.tinte, fontWeight: o.wert === aktiv ? "700" : "400" }}>
            {o.wert === aktiv ? "✓ " : ""}
            {o.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Mehr() {
  const { t, ich, unternehmenId, unternehmenWaehlen, sprache, spracheSetzen, abmelden, klient } = useAmtlos();
  const f = useFarben();
  const [push, setPush] = useState<PushErgebnis | null>(null);
  const PUSH_TEXT: Record<PushErgebnis, { art: "erfolg" | "fehler" | "info"; text: string }> = {
    aktiv: { art: "erfolg", text: t.mobil.push_aktiv },
    verweigert: { art: "info", text: t.mobil.push_verweigert },
    kein_geraet: { art: "info", text: t.mobil.push_kein_geraet },
    fehler: { art: "fehler", text: t.mobil.fehler_netz },
  };
  return (
    <Seite>
      <Titel>{t.mobil.tabs.mehr}</Titel>
      {ich && ich.unternehmen.length > 1 ? (
        <Auswahl titel={t.mobil.unternehmen} aktiv={unternehmenId} waehlen={(id) => void unternehmenWaehlen(id)} optionen={ich.unternehmen.map((u) => ({ wert: u.id, text: u.name }))} />
      ) : null}
      <Auswahl titel={t.mobil.sprache} aktiv={sprache} waehlen={(s) => void spracheSetzen(s === "en" ? "en" : "de")} optionen={[{ wert: "de", text: "Deutsch" }, { wert: "en", text: "English" }]} />
      <View style={{ marginVertical: 12 }}>
        <Text accessibilityRole="header" style={{ fontSize: GROESSE.gross, fontWeight: "700", color: f.tinte }}>
          {t.mobil.push}
        </Text>
        <Absatz>{t.mobil.push_text}</Absatz>
        {push ? <Hinweis art={PUSH_TEXT[push].art} text={PUSH_TEXT[push].text} /> : null}
        <Knopf leise text={t.mobil.push_aktivieren} onPress={() => void pushEinschalten(klient).then(setPush)} />
      </View>
      {ich ? <Absatz leise>{ich.konto.email}</Absatz> : null}
      <Knopf leise gefahr text={t.mobil.abmelden} onPress={() => void abmelden()} />
    </Seite>
  );
}
