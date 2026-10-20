import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Hinweis, Karte, Knopf, T, useGrosseSchrift } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { SCHRIFT, useFarben } from "../ui/thema";
import { stundeIn, zeitzoneAbweichend } from "../ui/zeit";
import { euroText, monatsSumme, offeneSumme } from "../unterlagen/ablage";
import { heute, sortiert } from "../unterlagen/speicher";
import { dringlichkeit, fortschritt, istErledigt } from "../pflichten/check";
import { useAmtlos } from "../zustand";
import { BelegErfassenSeite } from "./Belege";
import { BlattKopf, BuehnenMarke, BuehnenSeite, GrosserBetrag } from "./gemeinsam";
import { Balken, Einladung, PflichtZeile, checkGemacht, nichtsDranText, useAuswertung } from "./Pflichten";
import { SicherungsKarte } from "./Sicherung";
import { useOeffnen, useStarten } from "./starten";
import { UnterlageZeile, useFehltJe, useUeberfaellig } from "./Unterlagen";

/**
 * „Heute“ (E-142): Auf der Bühne steht, was Kunden noch schulden – dazu die zwei häufigsten Handlungen. Auf dem Blatt
 * darunter: was als Nächstes ansteht (überfällige Rechnungen zuerst, dann Pflichten), der Fortschritt und das zuletzt
 * Bearbeitete.
 */
export function Heute() {
  const z = useAmtlos();
  const f = useFarben();
  const { stand, tabWechseln } = z;
  const nav = useNav();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const a = useAuswertung();
  const tag = heute();
  const gemacht = checkGemacht(stand.profil);
  const { erledigt, unterlagen, betrieb } = stand;

  const { naechste, fs } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    const d = dringlichkeit(a, e, tag);
    return { naechste: [...d.jetzt, ...d.naechsteWochen].slice(0, 3), fs: fortschritt(a, e) };
  }, [a, erledigt, unterlagen, betrieb, tag]);
  const offen = useMemo(() => offeneSumme(unterlagen, betrieb, tag), [unterlagen, betrieb, tag]);
  const monat = useMemo(() => monatsSumme(unterlagen, betrieb, tag.slice(0, 7)), [unterlagen, betrieb, tag]);
  // überfällige Rechnungen gehören zu „Als Nächstes“ – Geld, das fehlt, ist dringender als jede Liste
  const ueberfaellig = useMemo(() => unterlagen.filter((u) => (ueberJe.get(u.id) ?? 0) > 0).sort((x, y) => (ueberJe.get(y.id) ?? 0) - (ueberJe.get(x.id) ?? 0)).slice(0, 2), [unterlagen, ueberJe]);
  const hatRechnungen = unterlagen.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  const zuletzt = sortiert(stand).slice(0, 3);
  const jetzt = new Date();
  const datum = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" }).format(jetzt);
  const monatsName = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long" }).format(jetzt);
  const stunde = stundeIn(jetzt);
  // auf Reisen (G10): Datum und Fristen bleiben in deutscher Zeit – das dazusagen, wenn das Gerät anders tickt
  const ueber = zeitzoneAbweichend(jetzt) ? TEXT.datum_deutsche_zeit(datum) : datum;
  const zeilen = ueberfaellig.length + naechste.length;
  const grosseSchrift = useGrosseSchrift();

  const buehne = (
    <View style={{ gap: 26 }}>
      {hatRechnungen && !offen.anzahl ? (
        // nichts offen (B2): kein großes „0,00 €“, sondern das Erfreuliche – alles bezahlt, dazu der Umsatz des Monats
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TEXT.heute_bezahlt_label(monatsName, euroText(monat.cent))}
          accessibilityHint={TEXT.oeffnet_unterlagen}
          onPress={() => tabWechseln("meine")} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.75 : 1 })}>
          <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.mittel }}>{TEXT.umsatz_monat(monatsName)}</T>
          <GrosserBetrag cent={monat.cent} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <BuehnenMarke text={TEXT.kachel_offen_text(0)} />
          </View>
        </Pressable>
      ) : hatRechnungen ? (
        <Pressable
          accessibilityRole="button"
          // alles, was auf der Fläche steht, auch für VoiceOver – nicht nur den Betrag
          accessibilityLabel={TEXT.offen_label(euroText(offen.cent), offen.ueberfaellig ? TEXT.davon_ueberfaellig(offen.ueberfaellig) : TEXT.kachel_offen_text(offen.anzahl), TEXT.monat_summe(monatsName, euroText(monat.cent)))}
          accessibilityHint={TEXT.oeffnet_unterlagen}
          onPress={() => tabWechseln("meine")} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.75 : 1 })}>
          <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.mittel }}>{TEXT.offen_bei_kunden}</T>
          <GrosserBetrag cent={offen.cent} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {offen.ueberfaellig ? <BuehnenMarke warnung text={TEXT.davon_ueberfaellig(offen.ueberfaellig)} /> : <BuehnenMarke text={TEXT.kachel_offen_text(offen.anzahl)} />}
            <BuehnenMarke text={TEXT.monat_summe(monatsName, euroText(monat.cent))} />
          </View>
        </Pressable>
      ) : (
        <T v="grossTitel" accessibilityRole="header" farbe={f.buehneText} stil={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}>{TEXT.gruss(stunde)}</T>
      )}
      {/* große Schrift: untereinander, sonst brechen die Wörter mitten im Knopf */}
      <View style={{ flexDirection: grosseSchrift ? "column" : "row", gap: 10 }}>
        <Knopf buehne symbol="plus" text={TEXT.kurz_rechnung} onPress={() => starten("rechnung")} stil={{ flex: grosseSchrift ? undefined : 1, paddingHorizontal: 12 }} />
        <Knopf glas symbol="doc.viewfinder" text={TEXT.kurz_beleg} onPress={() => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />)} stil={{ flex: grosseSchrift ? undefined : 1, paddingHorizontal: 12 }} />
      </View>
    </View>
  );

  return (
    <BuehnenSeite ueber={ueber} buehne={buehne}>
      {z.speicherFehler ? <Hinweis art="fehler" text={z.speicherFehlerArt === "schreiben" ? TEXT.speicher_fehler_schreiben : TEXT.speicher_fehler} /> : null}
      <SicherungsKarte />
      {gemacht ? (
        <View>
          <BlattKopf erste titel={TEXT.als_naechstes} rechts={TEXT.alle_pflichten} onPress={() => tabWechseln("pflichten")} />
          {zeilen ? (
            <Karte>
              {ueberfaellig.map((u, i) => (
                <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === zeilen - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
              ))}
              {naechste.map((p, i) => (
                <PflichtZeile key={p.id} p={p} erledigt={istErledigt(p, { erledigt, unterlagen, betrieb })} ohneWichtig={Boolean(p.naechsterTermin)} letzte={ueberfaellig.length + i === zeilen - 1} />
              ))}
            </Karte>
          ) : (
            <Hinweis art="erfolg" text={nichtsDranText(stand.erinnerungen)} />
          )}
          {fs.gesamt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Balken prozent={fs.prozent} label={TEXT.fortschritt_text(fs.fertig, fs.gesamt)} />
              </View>
              <T v="caption" leise stil={{ ...SCHRIFT.halb }}>{TEXT.fortschritt_text(fs.fertig, fs.gesamt)}</T>
            </View>
          ) : null}
        </View>
      ) : (
        <Einladung />
      )}

      {zuletzt.length ? (
        <View>
          <BlattKopf titel={TEXT.zuletzt} rechts={unterlagen.length > zuletzt.length ? TEXT.alle_anzeigen : undefined} onPress={() => tabWechseln("meine")} />
          <Karte>
            {zuletzt.map((u, i) => (
              <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === zuletzt.length - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
            ))}
          </Karte>
        </View>
      ) : null}
    </BuehnenSeite>
  );
}
