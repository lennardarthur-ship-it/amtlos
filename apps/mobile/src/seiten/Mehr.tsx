import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import { pushEinschalten, type PushErgebnis } from "../push";
import { Abschnitt, Hinweis, Knopf, Symbol, T, Zeile } from "../ui/bausteine";
import { RADIUS, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Seite, useLaden } from "./gemeinsam";
import { KONFIG } from "../konfig";

function Auswahl({ optionen, aktiv, waehlen, label }: { optionen: { wert: string; text: string }[]; aktiv: string | null; waehlen: (w: string) => void; label: string }) {
  const f = useFarben();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {optionen.map((o) => {
        const an = o.wert === aktiv;
        return (
          <Pressable key={o.wert} accessibilityRole="radio" accessibilityState={{ checked: an }} onPress={() => waehlen(o.wert)} style={{ minHeight: ZIEL - 10, paddingHorizontal: 14, borderRadius: 19, justifyContent: "center", backgroundColor: an ? f.tinte : f.blatt, borderWidth: 1, borderColor: an ? f.tinte : f.linie }}>
            <T v="klein" fett farbe={an ? f.papier : f.tinte}>{o.text}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Mehr() {
  const { t, sprache, ich, unternehmenId, unternehmenWaehlen, spracheSetzen, abmelden, klient, demo } = useAmtlos();
  const f = useFarben();
  const [push, setPush] = useState<PushErgebnis | null>(null);
  const { daten: abo } = useLaden(() => klient.abo(), [unternehmenId]);
  const PUSH_TEXT: Record<PushErgebnis, { art: "erfolg" | "fehler" | "info"; text: string }> = {
    aktiv: { art: "erfolg", text: t.mobil.push_aktiv },
    verweigert: { art: "info", text: t.mobil.push_verweigert },
    kein_geraet: { art: "info", text: t.mobil.push_kein_geraet },
    fehler: { art: "fehler", text: t.mobil.fehler_netz },
  };
  const web = KONFIG.webUrl;
  return (
    <Seite titel={t.mobil.tabs.mehr}>
      {ich && ich.unternehmen.length > 1 ? (
        <Abschnitt titel={t.mobil.unternehmen}>
          <Auswahl label={t.mobil.unternehmen} aktiv={unternehmenId} waehlen={(id) => void unternehmenWaehlen(id)} optionen={ich.unternehmen.map((u) => ({ wert: u.id, text: u.name }))} />
        </Abschnitt>
      ) : null}

      <View style={{ marginTop: -16 }} />
      <Abschnitt titel={t.mobil.push}>
        <T v="klein" leise>{t.mobil.push_text}</T>
        {demo ? (
          <Hinweis text={t.mobil.demo_push} symbol="bell" />
        ) : (
          <>
            {push ? <Hinweis art={PUSH_TEXT[push].art} text={PUSH_TEXT[push].text} /> : null}
            <Knopf leise symbol="bell" text={t.mobil.push_aktivieren} onPress={() => void pushEinschalten(klient).then(setPush)} stil={{ marginTop: 10, alignSelf: "flex-start" }} />
          </>
        )}
      </Abschnitt>

      <Abschnitt titel={t.mobil.sprache}>
        <Auswahl label={t.mobil.sprache} aktiv={sprache} waehlen={(s) => void spracheSetzen(s === "en" ? "en" : "de")} optionen={[{ wert: "de", text: "Deutsch" }, { wert: "en", text: "English" }]} />
      </Abschnitt>

      <Abschnitt titel={t.mobil.konto}>
        <View style={{ backgroundColor: f.blatt, borderRadius: RADIUS.karte, borderWidth: 1, borderColor: f.linie, paddingHorizontal: 14 }}>
          {abo && !demo ? (
            <Zeile
              links={<Symbol name="checkmark" groesse={20} farbe={abo.schreibbar ? f.amt : f.frist} />}
              titel={(t.abo.status as Record<string, string>)[abo.status] ?? abo.status}
              text={abo.status === "test" ? fuelle(t.mobil.test_bis, { datum: datumLang(abo.test_bis, sprache) }) : t.mobil.abo_web}
            />
          ) : null}
          {demo ? null : <Zeile links={<Symbol name="globe" groesse={20} />} titel={t.mobil.am_computer} text={web.replace(/^https?:\/\//, "")} onPress={() => void Linking.openURL(web)} />}
          <Zeile links={<Symbol name="person.2" groesse={20} />} titel={ich?.konto.anzeigename ?? ""} text={ich?.konto.email} letzte />
        </View>
        <Knopf leise gefahr symbol="rectangle.portrait.and.arrow.right" text={demo ? t.mobil.demo_beenden : t.mobil.abmelden} onPress={() => void abmelden()} stil={{ marginTop: 16, alignSelf: "flex-start" }} />
      </Abschnitt>

      {/* Rechtsseiten liegen im Web; die Demo hat keine Website dahinter */}
      {demo ? null : <View style={{ marginTop: 32, flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        {(["impressum", "datenschutz", "agb"] as const).map((seite) => (
          <Pressable key={seite} accessibilityRole="link" onPress={() => void Linking.openURL(`${web}/recht/${seite}`)} style={{ minHeight: 32, justifyContent: "center" }}>
            <T v="caption" leise stil={{ textDecorationLine: "underline" }}>{t.recht[seite]}</T>
          </Pressable>
        ))}
      </View>}
    </Seite>
  );
}
