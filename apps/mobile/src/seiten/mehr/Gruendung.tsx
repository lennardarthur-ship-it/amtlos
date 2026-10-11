import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Linking, Modal, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Fragebogen, Gruendung as GruendungT, GruendungSchritt } from "../../kern/typen";
import { Hinweis, Karte, Knopf, Status, Symbol, T } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { istIos, useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useAktion, useLaden } from "../gemeinsam";
import { PflichtBlatt } from "../Pflicht";
import { Schnellstart } from "../Schnellstart";

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig"]);
const FRAGEBOGEN = "gruendung.fragebogen_steuerliche_erfassung";

function wertText(wert: number, einheit: string, s: "de" | "en") {
  const zahl = new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB").format(wert);
  return einheit === "EUR" ? `${zahl} €` : einheit === "prozent" ? `${zahl} %` : `${zahl} ${einheit}`;
}

/** Gründungsassistent (6.2): alle Schritte in der Reihenfolge ihrer Voraussetzungen, mit Sperre und Fortschritt. */
export function Gruendung({ geaendert }: { geaendert?: () => void } = {}) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten: g, neu, laedt, fehler } = useLaden(() => klient.holen<GruendungT>("/v1/gruendung"), [unternehmenId]);
  const [blatt, setBlatt] = useState<GruendungSchritt | null>(null);
  const aktion = useAktion();
  const fs = g?.fortschritt;

  async function erledigen(s: GruendungSchritt) {
    await aktion.ausfuehren(async () => {
      await klient.erledigen(s.pflicht_id, s.periode);
      if (istIos) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await neu();
      geaendert?.();
    });
  }

  return (
    <Unterseite titel={t.gruendung.titel}>
      <Inhalt laedt={laedt} neu={neu}>
        <T leise>{t.gruendung.text}</T>
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {fs?.gesamt ? (
          <View style={{ marginTop: 16 }}>
            <T fett>{fuelle(t.gruendung.fortschritt, { n: fs.erledigt, gesamt: fs.gesamt })}</T>
            <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: fs.gesamt, now: fs.erledigt }} style={{ marginTop: 8, height: 6, borderRadius: 3, backgroundColor: f.linieLeise, overflow: "hidden" }}>
              <View style={{ width: `${Math.round((fs.erledigt / fs.gesamt) * 100)}%`, height: 6, backgroundColor: f.amt }} />
            </View>
          </View>
        ) : g ? (
          <T stil={{ marginTop: 16 }}>{t.gruendung.leer}</T>
        ) : null}
        {fs?.fertig ? <Hinweis art="erfolg" text={`${t.gruendung.fertig_titel} ${t.gruendung.fertig_text}`} /> : null}

        {g?.kapitalgesellschaft && g.kennzahlen.length ? (
          <Gruppe titel={fuelle(t.gruendung.eckdaten, { rechtsform: g.kapitalgesellschaft === "ug" ? "UG" : "GmbH" })}>
            <Karte stil={{ paddingVertical: 8 }}>
              {g.kennzahlen.map((k) => (
                <View key={k.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 }}>
                  <T v="klein" stil={{ flex: 1 }}>{k.bezeichnung}</T>
                  <T v="klein" fett>{wertText(k.wert, k.einheit, sprache)}</T>
                </View>
              ))}
              {g.kennzahlen.some((k) => k.ungeprueft) ? <T v="caption" leise stil={{ paddingBottom: 6 }}>({t.gruendung.ungeprueft})</T> : null}
            </Karte>
          </Gruppe>
        ) : null}

        {g?.schritte.map((s, i) => {
          const fertig = s.status === "erledigt";
          const gesperrt = s.gesperrt_durch.length > 0;
          return (
            <View key={`${s.pflicht_id}|${s.periode}`} style={{ flexDirection: "row", gap: 14, marginTop: 20 }}>
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: fertig ? f.amt : gesperrt ? f.linie : f.tinte, backgroundColor: fertig ? f.amt : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {fertig ? <Symbol name="checkmark" groesse={16} farbe={f.blatt} gewicht="bold" /> : <T fett farbe={gesperrt ? f.tinteLeise : f.tinte}>{i + 1}</T>}
                </View>
                {i < g.schritte.length - 1 ? <View style={{ width: 2, flex: 1, marginTop: 4, backgroundColor: fertig ? f.amt : f.linieLeise }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 4 }}>
                <T v="gross" farbe={gesperrt && !fertig ? f.tinteLeise : f.tinte} onPress={() => setBlatt(s)} accessibilityRole="button">{s.titel}</T>
                <T v="klein" leise stil={{ marginTop: 2 }}>{s.kurz}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6, alignItems: "center" }}>
                  <Status status={s.status} text={(t.status as Record<string, string>)[s.status] ?? s.status} />
                  {s.faellig_am && !fertig ? <T v="caption" leise>{fuelle(t.gruendung.faellig, { datum: datumLang(s.faellig_am, sprache) })}</T> : null}
                  {s.stelle ? <T v="caption" leise>{s.stelle}</T> : null}
                </View>
                {gesperrt && !fertig ? <T v="klein" fett stil={{ marginTop: 6 }}>{fuelle(t.gruendung.erst, { liste: s.gesperrt_durch.map((v) => v.titel).join(", ") })}</T> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  {s.pflicht_id === FRAGEBOGEN && !fertig ? <Knopf text={t.mobil.fragebogen_vorbereiten} symbol="doc.text" onPress={() => nav.oeffnen("fragebogen", () => <FragebogenSeite />)} /> : null}
                  {!fertig && !gesperrt && OFFEN.has(s.status) && s.ergebnis === "gilt" ? <Knopf leise text={t.gruendung.erledigen} symbol="checkmark" onPress={() => void erledigen(s)} laedt={aktion.laedt} /> : null}
                  {s.status === "angabe_fehlt" ? <Knopf leise text={t.gruendung.angaben} onPress={() => setBlatt(s)} /> : null}
                </View>
              </View>
            </View>
          );
        })}
      </Inhalt>
      <PflichtBlatt karte={blatt} offen={Boolean(blatt)} schliessen={() => setBlatt(null)} geaendert={() => { void neu(); geaendert?.(); }} />
    </Unterseite>
  );
}

/** Fragebogen zur steuerlichen Erfassung: Angaben aus dem Profil, Fehlendes direkt ergänzen, dann in ELSTER übertragen. */
function FragebogenSeite() {
  const { t, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const { daten: v, neu } = useLaden(async () => {
    const [fb, profil] = await Promise.all([klient.holen<Fragebogen>("/v1/gruendung/fragebogen"), klient.profil()]);
    return { ...fb, profil: profil.daten ?? {} };
  }, [unternehmenId]);
  const [schritt, setSchritt] = useState<string | null>(null);
  return (
    <Unterseite titel={t.fragebogen.titel}>
      <Inhalt>
        <T>{t.fragebogen.text}</T>
        <T v="caption" leise stil={{ marginTop: 6 }}>{t.fragebogen.hinweis_vorbereitung}</T>
        {v?.hinweise.includes("verzicht_bindet") ? <Hinweis text={t.fragebogen.verzicht_bindet} /> : null}
        {v?.abschnitte.map((a) => (
          <Gruppe key={a.titel} titel={a.titel}>
            <Karte>
              {a.angaben.map((g, i) => (
                <View key={g.feld} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === a.angaben.length - 1 ? 0 : 1, borderColor: f.linieLeise }}>
                  <T v="klein" stil={{ flex: 1 }}>{g.label}</T>
                  {g.wert ? (
                    <T v="klein" fett stil={{ flex: 1, textAlign: "right" }}>{g.wert}</T>
                  ) : (
                    <T v="klein" fett farbe={f.amt} onPress={g.schritt ? () => setSchritt(g.schritt) : undefined} accessibilityRole={g.schritt ? "button" : undefined}>
                      {t.fragebogen.fehlt}{g.schritt ? ` · ${t.fragebogen.ergaenzen}` : ""}
                    </T>
                  )}
                </View>
              ))}
            </Karte>
          </Gruppe>
        ))}
        {v ? (
          <Gruppe titel={t.fragebogen.uebermitteln_titel}>
            <Karte stil={{ paddingVertical: 12 }}>
              <T>{t.fragebogen.nicht_verfuegbar} {v.uebermittlung.grund}</T>
              {v.uebermittlung.alternative ? (
                <>
                  <T v="klein" leise stil={{ marginTop: 8 }}>{fuelle(t.fragebogen.alternative, { titel: v.uebermittlung.alternative.titel })}</T>
                  <Knopf text={v.uebermittlung.alternative.titel} symbol="globe" onPress={() => void Linking.openURL(v.uebermittlung.alternative!.url)} stil={{ marginTop: 12 }} />
                </>
              ) : null}
            </Karte>
          </Gruppe>
        ) : null}
      </Inhalt>
      <Modal visible={Boolean(schritt)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSchritt(null)}>
        {schritt && v ? <Schnellstart phase="alle" nurSchritt={schritt} profilStart={v.profil} abbrechen={() => setSchritt(null)} fertig={() => { setSchritt(null); void neu(); }} /> : null}
      </Modal>
    </Unterseite>
  );
}
