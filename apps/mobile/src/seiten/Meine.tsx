import { useState } from "react";
import { ScrollView, View } from "react-native";
import { T as TEXT } from "../texte";
import { Karte, Knopf, Symbol, T, Wahl } from "../ui/bausteine";
import { useFarben } from "../ui/thema";
import { euroText, filterVerfuegbar, filtern, offeneSumme, type Filter } from "../unterlagen/ablage";
import { sortiert } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Leer, Seite } from "./gemeinsam";
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
      {anzahl ? <Knopf ton text={aktiv ? TEXT.filter.alle : TEXT.filter.offen} onPress={onPress} stil={{ minHeight: 36, paddingHorizontal: 12 }} /> : null}
    </Karte>
  );
}

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst; Filter und Suche, sobald es sich lohnt. */
export function Meine() {
  const { stand, tabWechseln } = useAmtlos();
  const oeffnen = useOeffnen();
  const starten = useStarten();
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  const alle = sortiert(stand);
  const verfuegbar = filterVerfuegbar(alle);
  const aktiv: Filter = verfuegbar.includes(filter) ? filter : "alle";
  const liste = filtern(alle, aktiv, suche);
  const offen = offeneSumme(alle, stand.betrieb);
  const hatRechnungen = alle.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  return (
    <Seite titel={TEXT.meine_titel} unterzeile={alle.length ? TEXT.anzahl_unterlagen(alle.length) : undefined}>
      {alle.length ? (
        <View>
          {hatRechnungen ? <OffeneKarte anzahl={offen.anzahl} cent={offen.cent} aktiv={aktiv === "offen"} onPress={() => setFilter(aktiv === "offen" ? "alle" : "offen")} /> : null}
          {alle.length >= SUCHE_AB ? (
            <View style={{ marginBottom: 12 }}>
              <Suchfeld wert={suche} setzen={setSuche} label={TEXT.meine_suchen} />
            </View>
          ) : null}
          {verfuegbar.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Wahl wert={aktiv} aendern={setFilter} optionen={verfuegbar.map((w) => ({ wert: w, text: TEXT.filter[w] }))} />
            </ScrollView>
          ) : null}
          {liste.length ? (
            <Karte>
              {liste.map((u, i) => (
                <UnterlageZeile key={u.id} u={u} letzte={i === liste.length - 1} onPress={() => oeffnen(u.id)} />
              ))}
            </Karte>
          ) : (
            <T leise stil={{ marginTop: 8 }}>{TEXT.meine_nichts}</T>
          )}
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
