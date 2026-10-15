import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Betrag, Hinweis, Kachel, Karte, SchnellKachel, T, TextKnopf, type Ton } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { RADIUS, schattenStil, useFarben } from "../ui/thema";
import { euroText, monatsSumme, offeneSumme } from "../unterlagen/ablage";
import { heute, sortiert } from "../unterlagen/speicher";
import { dringlichkeit, istErledigt } from "../pflichten/check";
import { useAmtlos } from "../zustand";
import { BelegErfassenSeite } from "./Belege";
import { useErstellen } from "./Erstellen";
import { Gruppe, Seite } from "./gemeinsam";
import { Einladung, PflichtZeile, checkGemacht, useAuswertung } from "./Pflichten";
import { SicherungsKarte } from "./Sicherung";
import { useOeffnen, useStarten } from "./starten";
import { UnterlageZeile, useFehltJe, useUeberfaellig } from "./Unterlagen";

/** Kennzahl als Kachel: Beschriftung, großer Betrag, eine Zeile dazu – antippen führt zur Liste dahinter. */
function Kennzahl({ label, wert, text, ton = "amt", symbol, onPress }: { label: string; wert: string; text: string; ton?: Ton; symbol: string; onPress: () => void }) {
  const f = useFarben();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${wert}, ${text}`}
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, minWidth: 0, padding: 14, gap: 10, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: f.schatten ? 0 : 1, borderColor: f.linie, opacity: pressed ? 0.7 : 1 }, schattenStil(f)]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Kachel symbol={symbol} ton={ton} groesse={26} />
        <T v="caption" fett leise numberOfLines={1} stil={{ flex: 1 }}>{label}</T>
      </View>
      <View>
        <Betrag v="gross" stil={{ fontSize: 23, lineHeight: 28 }} >{wert}</Betrag>
        <T v="caption" leise numberOfLines={2}>{text}</T>
      </View>
    </Pressable>
  );
}

/**
 * „Heute“ (E-138): der Startbildschirm. Was als Nächstes ansteht (Fristblatt), was offen ist und was diesen Monat
 * berechnet wurde, die häufigsten Handlungen und das zuletzt Bearbeitete – ein Blick statt vier Tabs.
 */
export function Heute() {
  const z = useAmtlos();
  const { stand, tabWechseln } = z;
  const nav = useNav();
  const erstellen = useErstellen();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const a = useAuswertung();
  const tag = heute();
  const gemacht = checkGemacht(stand.profil);
  const { erledigt, unterlagen, betrieb } = stand;

  const naechste = useMemo(() => {
    const d = dringlichkeit(a, { erledigt, unterlagen, betrieb }, tag);
    return [...d.jetzt, ...d.diesenMonat].slice(0, 3);
  }, [a, erledigt, unterlagen, betrieb, tag]);
  const offen = useMemo(() => offeneSumme(unterlagen, betrieb, tag), [unterlagen, betrieb, tag]);
  const monat = useMemo(() => monatsSumme(unterlagen, betrieb, tag.slice(0, 7)), [unterlagen, betrieb, tag]);
  const hatRechnungen = unterlagen.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  const zuletzt = sortiert(stand).slice(0, 3);
  const jetzt = new Date();
  const datum = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" }).format(jetzt);
  const stunde = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).format(jetzt));
  const monatsName = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long" }).format(jetzt);

  return (
    <Seite titel={TEXT.gruss(stunde)} ueber={datum}>
      <SicherungsKarte />
      {gemacht ? (
        <View>
          <T v="gross" accessibilityRole="header" stil={{ marginBottom: 11, marginLeft: 2 }}>{TEXT.als_naechstes}</T>
          {naechste.length ? (
            <Karte>
              {naechste.map((p, i) => (
                <PflichtZeile key={p.id} p={p} erledigt={istErledigt(p, { erledigt, unterlagen, betrieb })} ohneWichtig={Boolean(p.naechsterTermin)} letzte={i === naechste.length - 1} />
              ))}
            </Karte>
          ) : (
            <Hinweis art="erfolg" text={TEXT.nichts_dran_kurz} />
          )}
          <TextKnopf text={TEXT.alle_pflichten} symbol="checklist" onPress={() => tabWechseln("pflichten")} stil={{ marginLeft: 2 }} />
        </View>
      ) : (
        <Einladung />
      )}

      {hatRechnungen ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
          <Kennzahl label={TEXT.kachel_offen} symbol={offen.ueberfaellig ? "exclamationmark.circle" : offen.anzahl ? "clock" : "checkmark.circle"} ton={offen.ueberfaellig ? "frist" : offen.anzahl ? "bald" : "amt"} wert={euroText(offen.cent)} text={offen.ueberfaellig ? TEXT.davon_ueberfaellig(offen.ueberfaellig) : TEXT.kachel_offen_text(offen.anzahl)} onPress={() => tabWechseln("meine")} />
          <Kennzahl label={monatsName} symbol="eurosign" wert={euroText(monat.cent)} text={TEXT.kachel_monat_text(monat.anzahl)} onPress={() => tabWechseln("meine")} />
        </View>
      ) : null}

      <Gruppe titel={TEXT.schnell_titel}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <SchnellKachel symbol="eurosign" text={TEXT.rechnung_schreiben} onPress={() => starten("rechnung")} />
          <SchnellKachel symbol="doc.viewfinder" text={TEXT.beleg_erfassen} onPress={() => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />)} />
          <SchnellKachel symbol="square.grid.2x2" text={TEXT.vorlage_waehlen} onPress={erstellen.oeffnen} />
        </View>
      </Gruppe>

      {zuletzt.length ? (
        <Gruppe titel={TEXT.zuletzt}>
          <Karte>
            {zuletzt.map((u, i) => (
              <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === zuletzt.length - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
            ))}
          </Karte>
          {unterlagen.length > zuletzt.length ? <TextKnopf text={TEXT.alle_anzeigen} onPress={() => tabWechseln("meine")} stil={{ marginLeft: 2 }} /> : null}
        </Gruppe>
      ) : null}
    </Seite>
  );
}
