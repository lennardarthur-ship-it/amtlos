import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Hinweis, Karte, Knopf, T, Zeile, textAus, useGrosseSchrift } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { SCHRIFT, useFarben } from "../ui/thema";
import { zeitzoneAbweichend } from "../ui/zeit";
import { euroText, monatsSumme, offeneSumme } from "../unterlagen/ablage";
import { aufenthaltLaeuftAb, heute, sortiert, type Stand } from "../unterlagen/speicher";
import { PersonSeite } from "./Betrieb";
import { dringlichkeit, fortschritt, istErledigt } from "../pflichten/check";
import { ANLAESSE } from "@amtlos/fachlogik";
import { kontrollbereit } from "../unterlagen/kontrollmappe";
import { useKontrollmappeOeffnen } from "./Kontrollmappe";
import { AnlassSeite } from "./Unterlagen";
import { useAktionen, useAmtlosStatus, useStandWahl } from "../zustand";
import { BelegErfassenSeite } from "./Belege";
import { BlattKopf, BuehnenMarke, BuehnenSeite } from "./gemeinsam";
import { CheckAblauf } from "./Check";
import { Balken, PflichtZeile, checkGemacht, nichtsDranText, useAuswertung } from "./Pflichten";
import { SicherungsKarte } from "./Sicherung";
import { KasseZeile } from "./Kasse";
import { kasseSichtbar } from "../unterlagen/kasse";
import { useOeffnen, useStarten } from "./starten";
import { UnterlageZeile, useFehltJe, useUeberfaellig } from "./Unterlagen";
import { PartnerHinweis } from "./Partner";
import { freiePflichten } from "../pro/regeln";
import { AboEndeHinweis } from "./AboEnde";


// Formatter einmal anlegen (R9 Performance)
const WOCHENTAG = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" });
const MONAT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long" });

/**
 * „Heute“ (E-142, E-189): Auf der Bühne steht der Pflichten-Kompass – wie viele Pflichten jetzt dran sind, wie viele
 * schon erledigt – bzw. vor dem Check die Einladung dazu; Rechnung und Beleg als schnelle Wege darunter. Auf dem Blatt:
 * was als Nächstes ansteht (Pflichten zuerst, dann überfällige Rechnungen), der Fortschritt, die Kontrollmappe, offene
 * Rechnungen und das zuletzt Bearbeitete.
 */
export function Heute() {
  // nur die Teile des Stands, die „Heute“ zeigt (R9 Performance)
  const z = useAmtlosStatus();
  const { tabWechseln } = useAktionen();
  const f = useFarben();
  const erledigt = useStandWahl((s) => s.erledigt);
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const betrieb = useStandWahl((s) => s.betrieb);
  const profil = useStandWahl((s) => s.profil);
  const erinnerungen = useStandWahl((s) => s.erinnerungen);
  const kasse = useStandWahl((s) => s.kasse);
  const mitarbeiter = useStandWahl((s) => s.mitarbeiter);
  const nav = useNav();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const a = useAuswertung();
  const tag = heute();
  const gemacht = checkGemacht(profil);

  const { naechste, fs, bereit, jetztDran } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    const d = dringlichkeit(a, e, tag);
    // R11 (Berater d): „Kontrollbereit: x von y Nachweisen“ – offene Pflichten mit Vorlage, die in die Mappe gehört
    const bereit = kontrollbereit({ unterlagen, betrieb }, a.gilt.filter((p) => !istErledigt(p, e)), tag);
    // E-188: ohne Pro nur die freien Pflichten (die ersten 3 aus dem Check)
    const frei = z.pro ? null : freiePflichten(a, betrieb, tag);
    return { naechste: [...d.jetzt, ...d.naechsteWochen].filter((p) => !frei || frei.has(p.id)).slice(0, 3), fs: fortschritt(a, e), bereit, jetztDran: d.jetzt.length };
  }, [a, erledigt, unterlagen, betrieb, tag, z.pro]);
  const mappe = useKontrollmappeOeffnen();
  const gruenden = ANLAESSE.find((x) => x.id === "gruenden");
  const offen = useMemo(() => offeneSumme(unterlagen, betrieb, tag), [unterlagen, betrieb, tag]);
  const monat = useMemo(() => monatsSumme(unterlagen, betrieb, tag.slice(0, 7)), [unterlagen, betrieb, tag]);
  // überfällige Rechnungen gehören zu „Als Nächstes“ – Geld, das fehlt, ist dringender als jede Liste
  const ueberfaellig = useMemo(() => unterlagen.filter((u) => (ueberJe.get(u.id) ?? 0) > 0).sort((x, y) => (ueberJe.get(y.id) ?? 0) - (ueberJe.get(x.id) ?? 0)).slice(0, 2), [unterlagen, ueberJe]);
  const hatRechnungen = unterlagen.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  const zuletzt = useMemo(() => sortiert({ unterlagen } as Stand).slice(0, 3), [unterlagen]);
  const jetzt = new Date();
  const datum = WOCHENTAG.format(jetzt);
  const monatsName = MONAT.format(jetzt);
  // auf Reisen (G10): Datum und Fristen bleiben in deutscher Zeit – das dazusagen, wenn das Gerät anders tickt
  const ueber = zeitzoneAbweichend(jetzt) ? TEXT.datum_deutsche_zeit(datum) : datum;
  const zeilen = ueberfaellig.length + naechste.length;
  const grosseSchrift = useGrosseSchrift();

  // E-189: Auf der Bühne steht der Pflichten-Kompass – was jetzt dran ist und wie viel schon erledigt ist. Rechnung und
  // Beleg bleiben als schnelle Wege darunter (zurückhaltend), offene Rechnungen stehen auf dem Blatt.
  // R12 (UX #23): große Schrift – kompakte Bühne: kleinere Überschrift, Plaketten nur für VoiceOver, Knöpfe ohne Symbol
  const kompakt = grosseSchrift;
  const titelStil = kompakt ? undefined : { fontSize: 40, lineHeight: 44, letterSpacing: -1.4 };
  const schnelleWege = (
    // große Schrift: nebeneinander ohne Symbol – untereinander füllten die Knöpfe die halbe Bühne
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Knopf glas symbol={kompakt ? undefined : "plus"} text={TEXT.kurz_rechnung} onPress={() => starten("rechnung")} stil={{ flex: 1, paddingHorizontal: kompakt ? 8 : 12 }} />
      <Knopf glas symbol={kompakt ? undefined : "doc.viewfinder"} text={TEXT.kurz_beleg} onPress={() => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />)} stil={{ flex: 1, paddingHorizontal: kompakt ? 8 : 12 }} />
    </View>
  );
  const buehne = gemacht ? (
    <View style={{ gap: kompakt ? 14 : 26 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={TEXT.heute_kompass_label(jetztDran, fs.fertig, fs.gesamt)}
        accessibilityHint={TEXT.heute_kompass_hinweis}
        onPress={() => tabWechseln("pflichten")} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.75 : 1 })}>
        <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.mittel }}>{TEXT.heute_kompass_ueber}</T>
        <T v={kompakt ? "titel" : "grossTitel"} accessibilityRole="header" farbe={f.buehneText} stil={titelStil}>{jetztDran ? TEXT.heute_jetzt_dran(jetztDran) : TEXT.heute_nichts_dran}</T>
        {kompakt || !fs.gesamt ? null : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <BuehnenMarke text={TEXT.fortschritt_text(fs.fertig, fs.gesamt)} />
            {bereit.gesamt ? <BuehnenMarke text={TEXT.heute_kontrolle_marke(bereit.da, bereit.gesamt)} /> : null}
          </View>
        )}
      </Pressable>
      {schnelleWege}
    </View>
  ) : (
    <View style={{ gap: kompakt ? 14 : 22 }}>
      <View style={{ gap: 10 }}>
        <T v={kompakt ? "titel" : "grossTitel"} accessibilityRole="header" farbe={f.buehneText} stil={kompakt ? undefined : { fontSize: 34, lineHeight: 39, letterSpacing: -1.1 }}>{TEXT.pflichten_karte_titel}</T>
        <T v="klein" farbe={f.buehneLeise}>{TEXT.pflichten_einladung}</T>
      </View>
      <Knopf buehne symbol={kompakt ? undefined : "checklist"} text={TEXT.pflichten_check_starten} onPress={() => nav.oeffnen("check", () => <CheckAblauf />, true)} />
      {schnelleWege}
    </View>
  );

  return (
    <BuehnenSeite ueber={ueber} buehne={buehne}>
      {/* Phase 2.3: „Empfohlen von …“ – kleine Zeile, nur wenn ein Partner eingetragen ist */}
      <PartnerHinweis stil={{ marginTop: -4, marginBottom: 10 }} />
      {z.speicherFehler ? <Hinweis art="fehler" text={z.speicherFehlerArt === "schreiben" ? TEXT.speicher_fehler_schreiben : TEXT.speicher_fehler} /> : null}
      {/* E-200: Pro gekündigt bzw. beendet – Aufzeichnungs- und Aufbewahrungspflichten laufen weiter, Export kostenlos */}
      <AboEndeHinweis />
      {/* R11 (UX #12): solange der Check fehlt, steht seine Einladung über jeder Erinnerung */}
      {gemacht ? <SicherungsKarte /> : null}
      {/* R12 (Zoll #5): Aufenthaltstitel, die bald ablaufen – vor jeder anderen Erinnerung */}
      {aufenthaltLaeuftAb({ mitarbeiter }, tag).length ? (
        <Karte stil={{ marginBottom: 18 }}>
          {aufenthaltLaeuftAb({ mitarbeiter }, tag).map((x, i, l) => (
            <Zeile key={x.id} symbol="exclamationmark.triangle" ton={x.tage < 0 ? "frist" : "bald"} titel={TEXT.r12p_heute_aufenthalt(x.name, x.tage)} text={TEXT.r12p_heute_aufenthalt_text(textAus(x.bis))} onPress={() => nav.oeffnen(`person-${x.id}`, () => <PersonSeite art="mitarbeiter" id={x.id} />, true)} letzte={i === l.length - 1} />
          ))}
        </Karte>
      ) : null}
      {/* R12: Betriebe mit Kasse oder Laden – der Tagesabschluss gehört zum Tag */}
      {kasseSichtbar({ profil, kasse }) ? (
        <Karte stil={{ marginBottom: 18 }}>
          <KasseZeile />
        </Karte>
      ) : null}
      {gemacht ? (
        <View>
          <BlattKopf erste titel={TEXT.als_naechstes} rechts={TEXT.alle_pflichten} onPress={() => tabWechseln("pflichten")} />
          {zeilen ? (
            <Karte>
              {naechste.map((p, i) => (
                <PflichtZeile key={p.id} p={p} a={a} erledigt={istErledigt(p, { erledigt, unterlagen, betrieb })} ohneWichtig={Boolean(p.naechsterTermin)} letzte={i === zeilen - 1} />
              ))}
              {ueberfaellig.map((u, i) => (
                <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={naechste.length + i === zeilen - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
              ))}
            </Karte>
          ) : (
            <Hinweis art="erfolg" text={nichtsDranText(erinnerungen)} />
          )}
          {fs.gesamt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Balken prozent={fs.prozent} label={TEXT.fortschritt_text(fs.fertig, fs.gesamt)} />
              </View>
              <T v="caption" leise stil={{ ...SCHRIFT.halb }}>{TEXT.fortschritt_text(fs.fertig, fs.gesamt)}</T>
            </View>
          ) : null}
          {bereit.gesamt ? (
            <Karte stil={{ marginTop: 18 }}>
              <Zeile symbol="folder" ton="blau" titel={TEXT.r11_kontrollbereit(bereit.da, bereit.gesamt)} text={TEXT.r11_kontrollbereit_text} onPress={mappe} letzte />
            </Karte>
          ) : null}
          {hatRechnungen ? (
            <Karte stil={{ marginTop: 18 }}>
              <Zeile
                symbol="eurosign.circle"
                ton={offen.ueberfaellig ? "frist" : undefined}
                titel={offen.anzahl ? TEXT.heute_offen_titel(euroText(offen.cent)) : TEXT.kachel_offen_text(0)}
                text={[offen.ueberfaellig ? TEXT.davon_ueberfaellig(offen.ueberfaellig) : offen.anzahl ? TEXT.kachel_offen_text(offen.anzahl) : "", `${TEXT.umsatz_monat(monatsName)}: ${euroText(monat.cent)}`].filter(Boolean).join(" · ")}
                onPress={() => tabWechseln("meine")}
                letzte
              />
            </Karte>
          ) : null}
        </View>
      ) : (
        <View>
          {/* R11 (Gründerin #17): wer gerade gründet, hat noch nichts zu rechnen – ein eigener Einstieg */}
          {!unterlagen.length && gruenden ? (
            <Karte stil={{ marginTop: 14 }}>
              <Zeile symbol="flag" titel={TEXT.r11_gruende_titel} text={TEXT.r11_gruende_text} onPress={() => nav.oeffnen("anlass-gruenden", () => <AnlassSeite a={gruenden} />)} letzte />
            </Karte>
          ) : null}
          <SicherungsKarte />
        </View>
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
