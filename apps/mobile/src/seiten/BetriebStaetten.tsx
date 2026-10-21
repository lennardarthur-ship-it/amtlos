/**
 * R12 (Bäckerei #3, #7): Betriebsstätten – Filialen mit Name und Anschrift. Betriebsstätte 1 ist der Betrieb selbst
 * (Anschrift aus „Mein Betrieb“). Kassen, Mitarbeiter und Unterlagen lassen sich zuordnen; die Kontrollmappe filtert
 * danach, die Kassenmeldung bekommt je Betriebsstätte ein Blatt.
 */
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { Feld, Fuss, Karte, Knopf, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { bestaetigen } from "../ui/bestaetigen";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND } from "../ui/thema";
import { HAUPT_STAETTE, alleStaetten, neueId, staetteVon, type Betriebsstaette, type Stand } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";

/** Kurze Zusammenfassung für „Mein Betrieb“. */
export function staettenText(s: Pick<Stand, "betrieb" | "betriebsstaetten">): string {
  const n = 1 + s.betriebsstaetten.length;
  return n === 1 ? TEXT.r12p_staetten_eine : TEXT.r12p_staetten_anzahl(n, alleStaetten(s).map((x) => x.name));
}

/** Eine weitere Betriebsstätte bearbeiten – eine neue ohne Namen verschwindet beim Verlassen wieder. */
function StaetteSeite({ id, neu }: { id: string; neu?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const st = z.stand.betriebsstaetten.find((x) => x.id === id);
  const zRef = useRef(z);
  zRef.current = z;
  useEffect(
    () => () => {
      const jetzt = zRef.current.stand.betriebsstaetten.find((x) => x.id === id);
      if (neu && jetzt && !jetzt.name.trim()) zRef.current.staetteLoeschen(id);
    },
    [id, neu],
  );
  if (!st) return <Unterseite titel="">{null}</Unterseite>;
  const setze = (k: keyof Betriebsstaette, w: string) => z.staetteSetzen({ ...st, [k]: w });
  return (
    <Unterseite titel={st.name.trim() || TEXT.r12p_staette_neu}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 4, paddingBottom: 32 }}>
        <Karte stil={{ paddingBottom: 14 }}>
          <Feld label={TEXT.r12p_staette_name} wert={st.name} aendern={(w) => setze("name", w)} placeholder={TEXT.r12p_staette_name_beispiel} />
          <Feld label={TEXT.b_strasse} wert={st.strasse} aendern={(w) => setze("strasse", w)} textContentType="streetAddressLine1" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Feld label={TEXT.b_plz} wert={st.plz} aendern={(w) => setze("plz", w)} keyboardType="number-pad" textContentType="postalCode" />
            </View>
            <View style={{ flex: 2 }}>
              <Feld label={TEXT.b_ort} wert={st.ort} aendern={(w) => setze("ort", w)} textContentType="addressCity" />
            </View>
          </View>
        </Karte>
        <T v="caption" leise stil={{ marginTop: 8, marginLeft: 4 }}>{TEXT.r12p_staette_hilfe}</T>
        <TextKnopf
          symbol="trash"
          gefahr
          text={TEXT.loeschen}
          onPress={() =>
            void bestaetigen({ titel: TEXT.loeschen_wirklich, text: TEXT.r12p_staette_loeschen_text, ja: TEXT.loeschen_ja }).then((ok) => {
              if (!ok) return;
              z.staetteLoeschen(id);
              melden(TEXT.geloescht);
              nav.zurueck();
            })
          }
          stil={{ marginTop: 24 }}
        />
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.fertig} onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Liste der Betriebsstätten: der Betrieb zuerst, dann die Filialen; „hinzufügen“. */
export function StaettenSeite({ betriebOeffnen }: { betriebOeffnen: () => void }) {
  const z = useAmtlos();
  const nav = useNav();
  const haupt = staetteVon(z.stand, HAUPT_STAETTE);
  const oeffnen = (id: string, neu = false) => nav.oeffnen(`staette-${id}`, () => <StaetteSeite id={id} neu={neu} />, true);
  const anlegen = () => {
    const id = neueId();
    z.staetteSetzen({ id, name: "", strasse: "", plz: "", ort: z.stand.betrieb.ort });
    oeffnen(id, true);
  };
  return (
    <Unterseite titel={TEXT.r12p_staetten_titel} unter={TEXT.r12p_staetten_unter}>
      <Inhalt>
        <Karte stil={{ marginTop: 14 }}>
          <Zeile symbol="building.2" ton="amt" titel={`1 · ${haupt.name}`} text={haupt.anschrift || TEXT.teil_leer.angaben} onPress={betriebOeffnen} letzte={!z.stand.betriebsstaetten.length} />
          {z.stand.betriebsstaetten.map((st, i) => {
            const x = staetteVon(z.stand, st.id);
            return <Zeile key={st.id} symbol="storefront" ton="blau" titel={`${i + 2} · ${x.name}`} text={x.anschrift || TEXT.r12p_staette_ohne_anschrift} onPress={() => oeffnen(st.id)} letzte={i === z.stand.betriebsstaetten.length - 1} />;
          })}
        </Karte>
        <Knopf ton symbol="plus" text={TEXT.r12p_staette_hinzufuegen} onPress={anlegen} stil={{ marginTop: 16 }} />
        <T v="caption" leise stil={{ marginTop: 12, marginLeft: 4 }}>{TEXT.r12p_staetten_text}</T>
      </Inhalt>
    </Unterseite>
  );
}

/**
 * Auswahl der Betriebsstätte (nur mit mehr als einer): für Mitarbeiter, Unterlagen und Kassen. `wert` ist die ID
 * („haupt“ bzw. leer = Betrieb).
 */
export function StaettenWahl({ wert, aendern, label, hilfe }: { wert: string | null | undefined; aendern: (id: string) => void; label?: string; hilfe?: string }) {
  const z = useAmtlos();
  if (!z.stand.betriebsstaetten.length) return null;
  const optionen = alleStaetten(z.stand).map((x) => ({ wert: x.id, text: x.name }));
  return <Wahl label={label ?? TEXT.r12p_staette_label} hilfe={hilfe} wert={wert && optionen.some((o) => o.wert === wert) ? wert : HAUPT_STAETTE} aendern={aendern} optionen={optionen} />;
}
