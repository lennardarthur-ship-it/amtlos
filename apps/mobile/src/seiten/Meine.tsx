import { useState } from "react";
import { ScrollView, View } from "react-native";
import { T as TEXT } from "../texte";
import { RAND } from "../ui/thema";
import { Karte, Knopf, Symbol, T, TextKnopf, Wahl } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { belegeFiltern, euroText, filterVerfuegbar, filtern, offeneSumme, type Filter } from "../unterlagen/ablage";
import { sortiert } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { BelegErfassen, BelegSeite, BelegZeile } from "./Belege";
import { Gruppe, Leer, Seite } from "./gemeinsam";
import { useOeffnen, useStarten } from "./starten";
import { Suchfeld, UnterlageZeile } from "./Unterlagen";

/** Ab so vielen Unterlagen lohnt sich die Suche. */
const SUCHE_AB = 6;

/** Offene Rechnungen auf einen Blick – antippen filtert die Liste. */
function OffeneKarte({ anzahl, cent, aktiv, onPress }: { anzahl: number; cent: number; aktiv: boolean; onPress: () => void }) {
  const f = useFarben();
  return (
    <Karte stil={{ marginBottom: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: aktiv ? f.baldHauch : f.blatt }}>
      <Symbol name={anzahl ? "clock" : "checkmark.circle.fill"} groesse={22} farbe={anzahl ? f.bald : f.amt} />
      <View style={{ flex: 1 }}>
        <T fett>{anzahl ? TEXT.offene_summe(anzahl, euroText(cent)) : TEXT.alles_bezahlt}</T>
        {anzahl ? <T v="caption" leise>{TEXT.offene_hilfe}</T> : null}
      </View>
      {anzahl ? <Knopf ton text={aktiv ? TEXT.filter.alle : TEXT.filter.offen} onPress={onPress} stil={{ minHeight: 44, paddingHorizontal: 12 }} /> : null}
    </Karte>
  );
}

const SCHRITT = 50;

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst; Filter und Suche, sobald es sich lohnt. */
export function Meine() {
  const { stand, tabWechseln } = useAmtlos();
  const nav = useNav();
  const oeffnen = useOeffnen();
  const belegOeffnen = (id: string) => nav.oeffnen(`beleg-${id}`, () => <BelegSeite id={id} />, true);
  const starten = useStarten();
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  // viele Unterlagen: in Schritten zeigen, damit die Liste flüssig bleibt
  const [zeigen, setZeigen] = useState(SCHRITT);
  const alle = sortiert(stand);
  const verfuegbar = filterVerfuegbar(alle, stand.belege.length);
  const aktiv: Filter = verfuegbar.includes(filter) ? filter : "alle";
  const liste = filtern(alle, aktiv, suche);
  const belege = aktiv === "alle" || aktiv === "belege" ? belegeFiltern(stand.belege, suche) : [];
  const belegeGezeigt = aktiv === "belege" ? belege : belege.slice(0, 5);
  const offen = offeneSumme(alle, stand.betrieb);
  const hatRechnungen = alle.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  return (
    <Seite titel={TEXT.meine_titel} unterzeile={alle.length ? TEXT.anzahl_unterlagen(alle.length) : undefined}>
      {alle.length || stand.belege.length ? (
        <View>
          {hatRechnungen ? <OffeneKarte anzahl={offen.anzahl} cent={offen.cent} aktiv={aktiv === "offen"} onPress={() => setFilter(aktiv === "offen" ? "alle" : "offen")} /> : null}
          {alle.length + stand.belege.length >= SUCHE_AB ? (
            <View style={{ marginBottom: 12 }}>
              <Suchfeld wert={suche} setzen={setSuche} label={TEXT.meine_suchen} />
            </View>
          ) : null}
          {verfuegbar.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, marginHorizontal: -RAND }} contentContainerStyle={{ paddingHorizontal: RAND }}>
              <Wahl wert={aktiv} aendern={setFilter} optionen={verfuegbar.map((w) => ({ wert: w, text: TEXT.filter[w] }))} />
            </ScrollView>
          ) : null}
          {liste.length ? (
            <Karte>
              {liste.slice(0, zeigen).map((u, i, l) => (
                <UnterlageZeile key={u.id} u={u} letzte={i === l.length - 1} onPress={() => oeffnen(u.id)} />
              ))}
            </Karte>
          ) : !belege.length ? (
            <T leise stil={{ marginTop: 8 }}>{TEXT.meine_nichts}</T>
          ) : null}
          {liste.length > zeigen ? (
            <TextKnopf symbol="chevron.down" text={TEXT.weitere_zeigen(Math.min(SCHRITT, liste.length - zeigen))} onPress={() => setZeigen((n) => n + SCHRITT)} stil={{ marginLeft: 4, marginTop: 4 }} />
          ) : null}
          {belegeGezeigt.length ? (
            <Gruppe titel={aktiv === "alle" ? TEXT.belege_titel : undefined}>
              <Karte>
                {belegeGezeigt.map((b, i) => (
                  <BelegZeile key={b.id} b={b} letzte={i === belegeGezeigt.length - 1} onPress={() => belegOeffnen(b.id)} />
                ))}
              </Karte>
              {aktiv === "alle" && belege.length > belegeGezeigt.length ? <TextKnopf text={TEXT.alle_belege(belege.length)} onPress={() => setFilter("belege")} stil={{ marginLeft: 4 }} /> : null}
            </Gruppe>
          ) : null}
          <Gruppe titel={TEXT.beleg_erfassen}>
            <BelegErfassen kompakt />
          </Gruppe>
        </View>
      ) : (
        <Leer text={TEXT.meine_leer}>
          <View style={{ gap: 10 }}>
            <Knopf text={TEXT.zu_den_unterlagen} onPress={() => tabWechseln("unterlagen")} />
            <Knopf ton symbol="plus" text={TEXT.rechnung_schreiben} onPress={() => starten("rechnung")} />
          </View>
        </Leer>
      )}
    </Seite>
  );
}
