import { useState, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { T as TEXT } from "../texte";
import { RAND, SCHRIFT } from "../ui/thema";
import { Betrag, Karte, Knopf, T, TextKnopf, Wahl } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { belegeFiltern, euroText, rechnungBrutto, filterVerfuegbar, filtern, offeneSumme, rechnungenSortiert, type Filter } from "../unterlagen/ablage";
import { heute, sortiert, type Unterlage } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { BelegErfassen, BelegSeite, BelegZeile } from "./Belege";
import { BuehnenMarke, BuehnenSeite, GrosserBetrag, Gruppe, Leer } from "./gemeinsam";
import { useOeffnen, useStarten } from "./starten";
import { useErstellen } from "./Erstellen";
import { Suchfeld, UnterlageZeile, useFehltJe, useUeberfaellig } from "./Unterlagen";
import { BelegErfassenSeite } from "./Belege";

/** Ab so vielen Unterlagen lohnt sich die Suche. */
const SUCHE_AB = 6;

/**
 * Offene Rechnungen auf der Bühne (E-142): der Betrag groß, darunter Anzahl bzw. „davon überfällig“. Antippen filtert
 * die Liste auf offene Rechnungen (noch einmal: alle) – die Plakette sagt, was der nächste Tipp tut.
 */
function OffenAufBuehne({ anzahl, ueberfaellig, cent, aktiv, onPress }: { anzahl: number; ueberfaellig: number; cent: number; aktiv: boolean; onPress: () => void }) {
  const f = useFarben();
  return (
    <Pressable
      // nur ein Knopf, wenn es etwas zu filtern gibt; „überfällig“ gehört in die Ansage, der Hinweis sagt, was der Tipp tut
      accessibilityRole={anzahl ? "button" : "text"}
      accessibilityState={anzahl ? { selected: aktiv } : undefined}
      accessibilityLabel={anzahl ? `${TEXT.offene_summe(anzahl, euroText(cent))}${ueberfaellig ? `, ${TEXT.davon_ueberfaellig(ueberfaellig)}` : ""}` : TEXT.alles_bezahlt}
      accessibilityHint={anzahl ? (aktiv ? TEXT.offen_hinweis_alle : TEXT.offen_hinweis_filtern) : undefined}
      onPress={anzahl ? onPress : undefined} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.75 : 1 })}>
      <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.mittel }}>{TEXT.offen_bei_kunden}</T>
      <GrosserBetrag cent={cent} groesse={48} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <BuehnenMarke warnung={Boolean(ueberfaellig)} text={anzahl ? (ueberfaellig ? TEXT.davon_ueberfaellig(ueberfaellig) : TEXT.kachel_offen_text(anzahl)) : TEXT.alles_bezahlt} />
        {anzahl ? <BuehnenMarke text={aktiv ? TEXT.filter.alle : TEXT.nur_offene} /> : null}
      </View>
    </Pressable>
  );
}

const SCHRITT = 50;

/**
 * Liste in Monatsgruppen: Rechnungen nach Rechnungsdatum, sonst nach letzter Bearbeitung. Liegt alles in einem Monat
 * oder sind es nur wenige Einträge, bleibt es eine Gruppe ohne Überschrift.
 */
function nachMonat(liste: Unterlage[], rechnungen: boolean) {
  const schluessel = (u: Unterlage) => (rechnungen && typeof u.daten.datum === "string" && /^\d{4}-\d{2}/.test(u.daten.datum) ? u.daten.datum.slice(0, 7) : (u.ausgegeben && u.ausgegeben > u.geaendert ? u.ausgegeben : u.geaendert).slice(0, 7));
  const gruppen: { monat: string; titel: string; rechnungen: boolean; liste: Unterlage[] }[] = [];
  for (const u of liste) {
    const m = schluessel(u);
    const g = gruppen.at(-1);
    if (g && g.monat === m) g.liste.push(u);
    else gruppen.push({ monat: m, titel: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long", year: "numeric" }).format(new Date(`${m}-15T12:00:00Z`)), rechnungen, liste: [u] });
  }
  if (gruppen.length < 2 || liste.length < 6) return [{ monat: "alle", titel: "", rechnungen: false, liste }];
  return gruppen;
}

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst; Filter und Suche, sobald es sich lohnt. */
export function Meine() {
  const { stand } = useAmtlos();
  const f = useFarben();
  const erstellen = useErstellen();
  const nav = useNav();
  const oeffnen = useOeffnen();
  const belegOeffnen = (id: string) => nav.oeffnen(`beleg-${id}`, () => <BelegSeite id={id} />, true);
  const starten = useStarten();
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  // viele Unterlagen: in Schritten zeigen, damit die Liste flüssig bleibt
  const [zeigen, setZeigen] = useState(SCHRITT);
  // nur neu rechnen, wenn sich Unterlagen, Belege, Filter oder Suche ändern – nicht bei jeder Eingabe anderswo
  const alle = useMemo(() => sortiert(stand), [stand.unterlagen]);
  const verfuegbar = useMemo(() => filterVerfuegbar(alle, stand.belege.length), [alle, stand.belege.length]);
  const aktiv: Filter = verfuegbar.includes(filter) ? filter : "alle";
  const liste = useMemo(() => {
    const l = filtern(alle, aktiv, suche);
    return aktiv === "rechnungen" || aktiv === "offen" ? rechnungenSortiert(l) : l;
  }, [alle, aktiv, suche]);
  const belege = useMemo(() => (aktiv === "alle" || aktiv === "belege" ? belegeFiltern(stand.belege, suche) : []), [aktiv, stand.belege, suche]);
  const belegeGezeigt = aktiv === "belege" ? belege : belege.slice(0, 5);
  const offen = useMemo(() => offeneSumme(alle, stand.betrieb, heute()), [alle, stand.betrieb]);
  const hatRechnungen = alle.some((u) => u.vorlage === "rechnung" && u.festgeschrieben);
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  return (
    <BuehnenSeite
      ueber={alle.length ? TEXT.anzahl_unterlagen(alle.length) : undefined}
      titel={TEXT.meine_titel}
      buehne={hatRechnungen ? <OffenAufBuehne anzahl={offen.anzahl} ueberfaellig={offen.ueberfaellig} cent={offen.cent} aktiv={aktiv === "offen"} onPress={() => setFilter(aktiv === "offen" ? "alle" : "offen")} /> : undefined}
    >
      {alle.length || stand.belege.length ? (
        <View>
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
            // nach Monaten gegliedert (bei Rechnungen nach Rechnungsdatum, mit Monatssumme) – lange Listen bleiben lesbar
            <View style={{ gap: 18 }}>
              {nachMonat(liste.slice(0, zeigen), aktiv === "rechnungen" || aktiv === "offen").map((g) => (
                <View key={g.monat}>
                  {g.titel ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, marginHorizontal: 2 }}>
                      <T v="klein" fett leise accessibilityRole="header">{g.titel}</T>
                      {g.rechnungen ? <Betrag v="klein" farbe={f.tinteLeise}>{euroText(g.liste.reduce((a, u) => a + rechnungBrutto(u, stand.betrieb), 0))}</Betrag> : null}
                    </View>
                  ) : null}
                  <Karte>
                    {g.liste.map((u, i, l) => (
                      <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === l.length - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={stand.betrieb} onPress={oeffnen} />
                    ))}
                  </Karte>
                </View>
              ))}
            </View>
          ) : !belege.length ? (
            <View style={{ marginTop: 8 }}>
              <T leise>{TEXT.meine_nichts}</T>
              {/* leere Treffer mit dem Weg zurück: Filter bzw. Suche zurücksetzen */}
              {aktiv !== "alle" ? (
                <TextKnopf symbol="xmark.circle" text={TEXT.filter_zuruecksetzen} onPress={() => { setFilter("alle"); setSuche(""); }} stil={{ marginLeft: 4 }} />
              ) : suche ? (
                <TextKnopf symbol="xmark.circle" text={TEXT.suche_leeren} onPress={() => setSuche("")} stil={{ marginLeft: 4 }} />
              ) : null}
            </View>
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
        <Leer symbol="folder" text={TEXT.meine_leer} unter={TEXT.meine_leer_text}>
          <View style={{ gap: 10 }}>
            <Knopf symbol="plus" text={TEXT.rechnung_schreiben} onPress={() => starten("rechnung")} />
            <Knopf ton symbol="doc.viewfinder" text={TEXT.beleg_erfassen} onPress={() => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />)} />
            <TextKnopf symbol="doc.text" text={TEXT.zu_den_unterlagen} onPress={erstellen.oeffnen} stil={{ alignSelf: "center" }} />
          </View>
        </Leer>
      )}
    </BuehnenSeite>
  );
}
