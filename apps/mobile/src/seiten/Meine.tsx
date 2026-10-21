import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import type { Beleg } from "@amtlos/fachlogik";
import { Betrag, ChipLeiste, Karte, Knopf, T, TextKnopf, Zeile } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { RADIUS, useFarben } from "../ui/thema";
import { belegeFiltern, euroText, rechnungBrutto, filterVerfuegbar, filtern, offeneSumme, rechnungenSortiert, type Filter } from "../unterlagen/ablage";
import { heute, sortiert, type Stand, type Unterlage } from "../unterlagen/speicher";
import { useStandWahl } from "../zustand";
import { BelegErfassen, BelegSeite, BelegZeile } from "./Belege";
import { BuehnenListe, BuehnenMarke, Gruppe, Leer } from "./gemeinsam";
import { useOeffnen, useStarten } from "./starten";
import { useErstellen } from "./Erstellen";
import { Suchfeld, UnterlageZeile, useFehltJe, useUeberfaellig } from "./Unterlagen";
import { BelegErfassenSeite } from "./Belege";
import { useKontrollmappeOeffnen } from "./Kontrollmappe";
import { KasseZeile } from "./Kasse";
import { kasseSichtbar } from "../unterlagen/kasse";

/** Ab so vielen Unterlagen lohnt sich die Suche. */
const SUCHE_AB = 6;

/**
 * Offene Rechnungen auf der Bühne (B2): der große Betrag steht schon auf „Heute“ – hier nur als Plakette mit Anzahl und
 * Summe. Antippen filtert die Liste auf offene Rechnungen (noch einmal: alle); die zweite Plakette sagt, was der Tipp tut.
 */
function OffenAufBuehne({ anzahl, ueberfaellig, cent, aktiv, onPress }: { anzahl: number; ueberfaellig: number; cent: number; aktiv: boolean; onPress: () => void }) {
  if (!anzahl) return <View style={{ flexDirection: "row" }}><BuehnenMarke text={TEXT.kachel_offen_text(0)} /></View>;
  return (
    <Pressable
      // „überfällig“ gehört in die Ansage, der Hinweis sagt, was der Tipp tut
      accessibilityRole="button"
      accessibilityState={{ selected: aktiv }}
      accessibilityLabel={`${TEXT.offene_summe(anzahl, euroText(cent))}${ueberfaellig ? `, ${TEXT.davon_ueberfaellig(ueberfaellig)}` : ""}`}
      accessibilityHint={aktiv ? TEXT.offen_hinweis_alle : TEXT.offen_hinweis_filtern}
      onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", flexWrap: "wrap", gap: 8, opacity: pressed ? 0.75 : 1 })}>
      <BuehnenMarke warnung={Boolean(ueberfaellig)} text={ueberfaellig ? `${TEXT.offene_summe(anzahl, euroText(cent))}\u00a0· ${TEXT.davon_ueberfaellig(ueberfaellig)}` : TEXT.offene_summe(anzahl, euroText(cent))} />
      <BuehnenMarke text={aktiv ? TEXT.filter.alle : TEXT.nur_offene} />
    </Pressable>
  );
}

const SCHRITT = 50;
// einmal angelegt (R9 Performance)
const MONAT_JAHR = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long", year: "numeric" });

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
    else gruppen.push({ monat: m, titel: MONAT_JAHR.format(new Date(`${m}-15T12:00:00Z`)), rechnungen, liste: [u] });
  }
  if (gruppen.length < 2 || liste.length < 6) return [{ monat: "alle", titel: "", rechnungen: false, liste }];
  return gruppen;
}

/** Einträge der virtualisierten Liste (R9 Performance): Monatsüberschriften, Zeilen, Knöpfe – in der Reihenfolge der Seite. */
type Eintrag =
  | { art: "monat"; key: string; titel: string; summe: string | null; erste: boolean }
  | { art: "unterlage"; key: string; u: Unterlage; erste: boolean; letzte: boolean }
  | { art: "mehr"; key: string; anzahl: number }
  | { art: "belegKopf"; key: string; titel?: string }
  | { art: "beleg"; key: string; b: Beleg; erste: boolean; letzte: boolean }
  | { art: "alleBelege"; key: string; anzahl: number };

/** Zeile als Teil einer Karte: erste und letzte mit runden Ecken – sieht aus wie eine Karte um die ganze Gruppe. */
function KartenStueck({ erste, letzte, children }: { erste: boolean; letzte: boolean; children: ReactNode }) {
  return <Karte stil={{ borderRadius: 0, borderTopLeftRadius: erste ? RADIUS.karte : 0, borderTopRightRadius: erste ? RADIUS.karte : 0, borderBottomLeftRadius: letzte ? RADIUS.karte : 0, borderBottomRightRadius: letzte ? RADIUS.karte : 0 }}>{children}</Karte>;
}

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst; Filter und Suche, sobald es sich lohnt. */
export function Meine() {
  // nur die Teile des Stands, die diese Seite zeigt (R9 Performance)
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const belegeAlle = useStandWahl((s) => s.belege);
  const betrieb = useStandWahl((s) => s.betrieb);
  const profil = useStandWahl((s) => s.profil);
  const kasse = useStandWahl((s) => s.kasse);
  const mitKasse = kasseSichtbar({ profil, kasse });
  const f = useFarben();
  const erstellen = useErstellen();
  const nav = useNav();
  const oeffnen = useOeffnen();
  const belegOeffnen = useCallback((id: string) => nav.oeffnen(`beleg-${id}`, () => <BelegSeite id={id} />, true), [nav]);
  const starten = useStarten();
  const mappe = useKontrollmappeOeffnen();
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  // viele Unterlagen: in Schritten zeigen, damit die Liste flüssig bleibt
  const [zeigen, setZeigen] = useState(SCHRITT);
  // nur neu rechnen, wenn sich Unterlagen, Belege, Filter oder Suche ändern – nicht bei jeder Eingabe anderswo
  const alle = useMemo(() => sortiert({ unterlagen } as Stand), [unterlagen]);
  const verfuegbar = useMemo(() => filterVerfuegbar(alle, belegeAlle.length), [alle, belegeAlle.length]);
  const aktiv: Filter = verfuegbar.includes(filter) ? filter : "alle";
  const liste = useMemo(() => {
    const l = filtern(alle, aktiv, suche);
    return aktiv === "rechnungen" || aktiv === "offen" ? rechnungenSortiert(l) : l;
  }, [alle, aktiv, suche]);
  const belege = useMemo(() => (aktiv === "alle" || aktiv === "belege" ? belegeFiltern(belegeAlle, suche) : []), [aktiv, belegeAlle, suche]);
  const offen = useMemo(() => offeneSumme(alle, betrieb, heute()), [alle, betrieb]);
  const hatRechnungen = useMemo(() => alle.some((u) => u.vorlage === "rechnung" && u.festgeschrieben), [alle]);
  const entwuerfe = useMemo(() => alle.filter((u) => u.vorlage === "rechnung" && !u.festgeschrieben).length, [alle]);
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const eintraege = useMemo(() => {
    const e: Eintrag[] = [];
    const gruppen = liste.length ? nachMonat(liste.slice(0, zeigen), aktiv === "rechnungen" || aktiv === "offen") : [];
    gruppen.forEach((g, gi) => {
      if (g.titel) e.push({ art: "monat", key: `m-${g.monat}`, titel: g.titel, summe: g.rechnungen ? euroText(g.liste.reduce((a, u) => a + rechnungBrutto(u, betrieb), 0)) : null, erste: gi === 0 });
      g.liste.forEach((u, i) => e.push({ art: "unterlage", key: `u-${u.id}`, u, erste: i === 0, letzte: i === g.liste.length - 1 }));
    });
    if (liste.length > zeigen) e.push({ art: "mehr", key: "mehr", anzahl: Math.min(SCHRITT, liste.length - zeigen) });
    const gezeigt = aktiv === "belege" ? belege : belege.slice(0, 5);
    if (gezeigt.length) {
      e.push({ art: "belegKopf", key: "belege", titel: aktiv === "alle" ? TEXT.belege_titel : undefined });
      gezeigt.forEach((b, i) => e.push({ art: "beleg", key: `b-${b.id}`, b, erste: i === 0, letzte: i === gezeigt.length - 1 }));
      if (aktiv === "alle" && belege.length > gezeigt.length) e.push({ art: "alleBelege", key: "alle-belege", anzahl: belege.length });
    }
    return e;
  }, [liste, zeigen, aktiv, belege, betrieb]);
  const zeile = useCallback(
    (e: Eintrag) => {
      switch (e.art) {
        case "monat":
          return (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, marginTop: e.erste ? 0 : 18 }}>
              <T v="klein" fett leise accessibilityRole="header">{e.titel}</T>
              {e.summe ? <Betrag v="klein" farbe={f.tinteLeise}>{e.summe}</Betrag> : null}
            </View>
          );
        case "unterlage":
          return (
            <KartenStueck erste={e.erste} letzte={e.letzte}>
              <UnterlageZeile u={e.u} ueber={ueberJe.get(e.u.id) ?? 0} letzte={e.letzte} fehlt={fehltJe.get(e.u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
            </KartenStueck>
          );
        case "mehr":
          return <TextKnopf symbol="chevron.down" text={TEXT.weitere_zeigen(e.anzahl)} onPress={() => setZeigen((n) => n + SCHRITT)} stil={{ marginTop: 4 }} />;
        case "belegKopf":
          return <View style={{ marginTop: 30 }}>{e.titel ? <T v="gross" accessibilityRole="header" stil={{ marginBottom: 12 }}>{e.titel}</T> : null}</View>;
        case "beleg":
          return (
            <KartenStueck erste={e.erste} letzte={e.letzte}>
              <BelegZeile b={e.b} letzte={e.letzte} onPress={belegOeffnen} />
            </KartenStueck>
          );
        case "alleBelege":
          return <TextKnopf text={TEXT.alle_belege(e.anzahl)} onPress={() => setFilter("belege")} />;
      }
    },
    [f.tinteLeise, ueberJe, fehltJe, betrieb, oeffnen, belegOeffnen],
  );
  const leer = !alle.length && !belegeAlle.length && !kasse.length;
  const kopf = leer ? (
    <Leer text={TEXT.meine_leer} unter={TEXT.meine_leer_text}>
      <View style={{ gap: 10 }}>
        <Knopf symbol="plus" text={TEXT.rechnung_schreiben} onPress={() => starten("rechnung")} />
        <Knopf ton symbol="doc.viewfinder" text={TEXT.beleg_erfassen} onPress={() => nav.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />)} />
        <TextKnopf symbol="doc.text" text={TEXT.zu_den_unterlagen} onPress={erstellen.oeffnen} stil={{ alignSelf: "center" }} />
        {mitKasse ? <Karte stil={{ marginTop: 8 }}><KasseZeile /></Karte> : null}
      </View>
    </Leer>
  ) : (
    <View>
      {/* R11 (UX #1): die Kontrollmappe dort, wo man bei einer Kontrolle sucht – nicht nur unter „Mein Betrieb“ */}
      <Karte stil={{ marginBottom: 14 }}>
        <Zeile symbol="folder" ton="blau" titel={TEXT.kontrollmappe_zeile} text={TEXT.r11_mappe_zeile_kurz} onPress={mappe} letzte={!mitKasse} />
        {/* R12: Kasse (Tagesabschlüsse) bei Betrieben mit Kasse oder Laden */}
        {mitKasse ? <KasseZeile /> : null}
      </Karte>
      {alle.length + belegeAlle.length >= SUCHE_AB ? (
        <View style={{ marginBottom: 12 }}>
          <Suchfeld wert={suche} setzen={setSuche} label={TEXT.meine_suchen} />
        </View>
      ) : null}
      {verfuegbar.length > 1 ? <ChipLeiste wert={aktiv} aendern={setFilter} optionen={verfuegbar.map((w) => ({ wert: w, text: TEXT.filter[w] }))} stil={{ marginBottom: 12 }} /> : null}
      {!liste.length && !belege.length ? (
        <View style={{ marginTop: 8 }}>
          <T leise>{TEXT.meine_nichts}</T>
          {/* leere Treffer mit dem Weg zurück: Filter bzw. Suche zurücksetzen */}
          {aktiv !== "alle" ? (
            <TextKnopf symbol="xmark.circle" text={TEXT.filter_zuruecksetzen} onPress={() => { setFilter("alle"); setSuche(""); }} />
          ) : suche ? (
            <TextKnopf symbol="xmark.circle" text={TEXT.suche_leeren} onPress={() => setSuche("")} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
  return (
    <BuehnenListe
      // immer eine Zeile über dem Titel – sonst springt der Titel, sobald die erste Unterlage da ist (A18)
      ueber={alle.length ? TEXT.meine_stand(alle.length, entwuerfe) : TEXT.noch_leer}
      titel={TEXT.meine_titel}
      buehne={hatRechnungen ? <OffenAufBuehne anzahl={offen.anzahl} ueberfaellig={offen.ueberfaellig} cent={offen.cent} aktiv={aktiv === "offen"} onPress={() => setFilter(aktiv === "offen" ? "alle" : "offen")} /> : undefined}
      kopf={kopf}
      daten={leer ? [] : eintraege}
      zeile={zeile}
      schluessel={eintragSchluessel}
      fuss={
        leer ? null : (
          <Gruppe titel={TEXT.beleg_erfassen}>
            <BelegErfassen kompakt />
          </Gruppe>
        )
      }
    />
  );
}

const eintragSchluessel = (e: Eintrag) => e.key;
