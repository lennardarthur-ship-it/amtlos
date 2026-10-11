import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import type { Beleg, FinanzUebersicht } from "../../kern/typen";
import { Hinweis, Karte, Symbol, T, Zeile, euroText } from "../../ui/bausteine";
import { useNav } from "../../ui/navigation";
import { RADIUS, useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { fotoWaehlen } from "../foto";
import { Seite, useLaden } from "../gemeinsam";
import { Angaben } from "./Angaben";
import { BelegBearbeiten, Belege } from "./Belege";
import { Kassen } from "./Kassen";
import { Rechnungen } from "./Rechnungen";
import { Ust } from "./Ust";

/** Finanzen (6.5): Beleg fotografieren als erste Handlung, darunter Umsatz und die Werkzeuge. */
export function FinanzenStart() {
  const { t, sprache, klient, unternehmenId, rolle } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten: u, neu, laedt } = useLaden(() => klient.holen<FinanzUebersicht>("/v1/finanzen/uebersicht"), [unternehmenId]);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "fehler" | "info"; text: string } | null>(null);
  const [laedtFoto, setLaedtFoto] = useState(false);
  const darf = rolle === "inhaber" || rolle === "admin" || rolle === "steuerberater";

  async function foto(kamera: boolean) {
    setMeldung(null);
    const r = await fotoWaehlen(kamera);
    if (r === "verweigert") return setMeldung({ art: "fehler", text: t.mobil.kamera_verweigert });
    if (!r) return;
    setVorschau(r.uri);
    setLaedtFoto(true);
    try {
      const b = await klient.schicken<Beleg>("/v1/belege", "POST", r.daten);
      setMeldung({ art: "erfolg", text: t.mobil.beleg_hochgeladen });
      void neu();
      // Gleich die Angaben ergänzen lassen – Betrag und Umsatzsteuer braucht die Voranmeldung
      nav.oeffnen(`beleg-${b.id}`, () => <BelegBearbeiten beleg={b} fertig={() => void neu()} />);
    } catch (e) {
      setMeldung({ art: "fehler", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLaedtFoto(false);
    }
  }

  const prozent = u?.grenze ? Math.floor(u.grenze.anteil * 1000) / 10 : 0;
  return (
    <Seite titel={t.finanzen.titel} laedt={laedt} neu={neu}>
      {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.mobil.beleg_kamera}
          disabled={!darf || laedtFoto}
          onPress={() => void foto(true)}
          style={({ pressed }) => ({ flex: 2, minHeight: 120, borderRadius: RADIUS.karte, backgroundColor: f.amt, alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: !darf ? 0.5 : pressed ? 0.85 : 1 })}
        >
          {vorschau && laedtFoto ? (
            <Image source={{ uri: vorschau }} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.35 }} accessible={false} />
          ) : null}
          <Symbol name="camera" groesse={34} farbe={f.blatt} gewicht="regular" />
          <T fett farbe={f.blatt} stil={{ marginTop: 8 }}>{t.mobil.beleg_kamera}</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.mobil.beleg_galerie}
          disabled={!darf || laedtFoto}
          onPress={() => void foto(false)}
          style={({ pressed }) => ({ flex: 1, minHeight: 120, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie, alignItems: "center", justifyContent: "center", opacity: !darf ? 0.5 : pressed ? 0.85 : 1, padding: 8 })}
        >
          <Symbol name="photo.on.rectangle" groesse={28} farbe={f.amt} />
          <T v="klein" fett farbe={f.amt} stil={{ marginTop: 8, textAlign: "center" }}>{t.mobil.aus_fotos}</T>
        </Pressable>
      </View>
      {!darf ? <Hinweis text={t.mobil.beleg_nur_inhaber} /> : null}

      {u ? (
        <Karte stil={{ marginTop: 20, paddingVertical: 14 }}>
          <T v="klein" leise>{fuelle(t.finanzen.umsatz, { jahr: u.jahr })}</T>
          <T v="titel" stil={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{euroText(Math.round(u.umsatz_eur * 100), sprache)}</T>
          {u.kleinunternehmer && u.grenze ? (
            <View style={{ marginTop: 12 }}>
              <T v="klein" fett>{t.finanzen.grenze}: {fuelle(t.finanzen.grenze_stand, { anteil: prozent.toLocaleString(sprache === "de" ? "de-DE" : "en-GB"), grenze: euroText(u.grenze.wert_eur * 100, sprache) })}</T>
              <View style={{ marginTop: 6, height: 6, borderRadius: 3, backgroundColor: f.linieLeise, overflow: "hidden" }} accessibilityElementsHidden>
                <View style={{ width: `${Math.min(100, prozent)}%`, height: 6, backgroundColor: u.grenze.anteil >= 0.95 ? f.frist : u.grenze.anteil >= 0.8 ? f.bald : f.amt }} />
              </View>
              {u.grenze.anteil >= 0.8 ? <T v="klein" fett stil={{ marginTop: 6 }}>{u.grenze.anteil >= 0.95 ? t.finanzen.warnung_95 : t.finanzen.warnung_80}</T> : null}
              <T v="caption" leise stil={{ marginTop: 4 }}>{t.finanzen.grenze_hinweis}{u.grenze.ungeprueft ? ` (${t.finanzen.ungeprueft})` : ""}</T>
            </View>
          ) : null}
        </Karte>
      ) : null}

      <Karte stil={{ marginTop: 16 }}>
        <Zeile links={<Symbol name="doc.text" groesse={20} farbe={f.amt} />} titel={t.finanzen.rechnungen} text={u?.entwuerfe ? fuelle(t.finanzen.entwuerfe, { n: u.entwuerfe }) : t.finanzen.rechnungen_text} onPress={() => nav.oeffnen("rechnungen", () => <Rechnungen />)} />
        <Zeile links={<Symbol name="tray" groesse={20} farbe={f.amt} />} titel={t.finanzen.belege} text={u ? fuelle(t.finanzen.belege_anzahl, { n: u.belege }) : t.finanzen.belege_text} onPress={() => nav.oeffnen("belege", () => <Belege />)} />
        <Zeile links={<Symbol name="percent" groesse={20} farbe={f.amt} />} titel={t.mobil.ust_kurz} text={t.finanzen.ust_text} onPress={() => nav.oeffnen("ust", () => <Ust />)} />
        <Zeile links={<Symbol name="creditcard" groesse={20} farbe={f.amt} />} titel={t.finanzen.kassen} text={t.finanzen.kassen_text} onPress={() => nav.oeffnen("kassen", () => <Kassen />)} />
        <Zeile links={<Symbol name="building.columns" groesse={20} farbe={f.amt} />} titel={t.mobil.angaben_kurz} text={t.finanzen.angaben_text} onPress={() => nav.oeffnen("angaben", () => <Angaben />)} letzte />
      </Karte>
    </Seite>
  );
}
