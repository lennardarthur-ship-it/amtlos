import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fehlendeAngaben, personAus, personIn, vorlageFuer, type Daten, type Vorlage, type VorlagenAbschnitt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Fuss, Knopf, Symbol, T, TextKnopf, Wahl } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, ZIEL, istIos, useFarben } from "../ui/thema";
import { PERSONEN_LISTE, personenSortiert } from "../unterlagen/speicher";
import { periodeText, perioden, umsaetzeFuer } from "../unterlagen/ustAusRechnungen";
import { useAmtlos } from "../zustand";
import { Abschluss, useTeilen } from "./Abschluss";
import { Felder } from "./felder";
import { InfoSeite } from "./InfoSeite";
import { ListenSchritt } from "./Liste";

/** Fehlende Angaben je Schritt – für „Fast fertig“ und die Übersicht. Prüfungen gegen „Mein Betrieb“ stehen extra. */
export function fehltJeSchritt(v: Vorlage, d: Daten): string[][] {
  return v.abschnitte.map((a) => fehlendeAngaben({ ...v, abschnitte: [a], pruefen: undefined }, d));
}

/** Person aus der Unterlage merken (Mitarbeiter, Kunde) – beim Weitergehen und beim Schließen. */
function merken(v: Vorlage, d: Daten | undefined, z: ReturnType<typeof useAmtlos>) {
  const p = d ? personAus(v, d) : null;
  if (p && v.person) z.personMerken(v.person.art, p);
}

/** Auswahl gespeicherter Mitarbeiter bzw. Kunden über den Feldern eines Schritts. */
function PersonenWahl({ v, id, daten }: { v: Vorlage; id: string; daten: Daten }) {
  const z = useAmtlos();
  if (!v.person) return null;
  const art = v.person.art;
  const personen = personenSortiert(z.stand[PERSONEN_LISTE[art]]);
  const name = typeof daten[v.person.felder.name ?? ""] === "string" ? (daten[v.person.felder.name!] as string).trim().toLocaleLowerCase("de") : "";
  const gewaehlt = personen.find((p) => p.name.trim().toLocaleLowerCase("de") === name)?.id ?? null;
  return (
    <View style={{ marginTop: 8 }}>
      {personen.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -RAND }} contentContainerStyle={{ paddingHorizontal: RAND, paddingVertical: 4 }}>
          <Wahl label={TEXT.gespeicherte[art]} wert={gewaehlt} aendern={(pid) => { const p = personen.find((x) => x.id === pid); if (p) z.setzen(id, personIn(v, p)); }} optionen={personen.map((p) => ({ wert: p.id, text: p.name }))} />
        </ScrollView>
      ) : null}
      <T v="caption" leise stil={{ marginTop: personen.length ? 4 : 0 }}>{TEXT.wird_gemerkt[art]}</T>
    </View>
  );
}

/** Umsatzsteuer-Voranmeldung: Umsätze aus den geteilten Rechnungen eines Monats oder Quartals übernehmen (E-128). */
function AusRechnungen({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const [uebernommen, setUebernommen] = useState<{ periode: string; anzahl: number } | null>(null);
  const liste = perioden(z.stand.unterlagen);
  if (!liste.length) return <T v="caption" leise stil={{ marginTop: 10 }}>{TEXT.aus_rechnungen_leer}</T>;
  return (
    <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: f.amtHauch }}>
      <T v="klein" fett farbe={f.amtTief}>{TEXT.aus_rechnungen_titel}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        <Wahl
          wert={uebernommen?.periode ?? null}
          aendern={(p) => {
            const r = umsaetzeFuer(z.stand.unterlagen, p, z.stand.betrieb);
            if (!r) return;
            z.setzen(id, r.werte);
            setUebernommen({ periode: p, anzahl: r.anzahl });
          }}
          optionen={liste.map((p) => ({ wert: p, text: periodeText(p) }))}
        />
      </ScrollView>
      {uebernommen ? <T v="caption" farbe={f.amtTief} stil={{ marginTop: 8 }}>{TEXT.aus_rechnungen_ok(uebernommen.anzahl)}</T> : null}
    </View>
  );
}

function Schritt({ v, a, index, id, daten, fehlt }: { v: Vorlage; a: VorlagenAbschnitt; index: number; id: string; daten: Daten; fehlt: string[] }) {
  const z = useAmtlos();
  const nav = useNav();
  const mitPerson = v.person && a.felder.some((x) => x.id === v.person!.felder.name);
  return (
    <View>
      <T v="titel" accessibilityRole="header" stil={{ fontSize: 28, lineHeight: 34 }}>{a.titel}</T>
      {a.hilfe ? <T leise stil={{ marginTop: 6 }}>{a.hilfe}</T> : null}
      {index === 0 ? <TextKnopf symbol="questionmark.circle" text={TEXT.wozu_link} onPress={() => nav.oeffnen(`info-${v.id}`, () => <InfoSeite id={v.id} />, true)} stil={{ marginTop: 4 }} /> : null}
      {mitPerson ? <PersonenWahl v={v} id={id} daten={daten} /> : null}
      {v.ausRechnungen && index === 0 ? <AusRechnungen id={id} /> : null}
      <Felder felder={a.felder} werte={daten} fehlt={fehlt} setze={(k, w) => z.setzen(id, { [k]: w })} liste={(f) => <ListenSchritt feld={f} id={id} />} />
    </View>
  );
}

/** Fortschritt: ein Balken je Schritt, der letzte ist „Fertig“. */
function Fortschritt({ n, aktuell }: { n: number; aktuell: number }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: n, now: aktuell + 1 }} accessibilityLabel={TEXT.schritt(aktuell + 1, n)} style={{ flexDirection: "row", gap: 4, paddingHorizontal: RAND, paddingVertical: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= aktuell ? f.amt : f.linie }} />
      ))}
    </View>
  );
}

/**
 * Geführter Ablauf einer Unterlage (E-124): ein Abschnitt je Bildschirm, unten ein Hauptknopf, am Ende der Abschluss mit
 * Vorschau und „PDF teilen“. Gespeichert wird bei jeder Eingabe. Eine neue, unveränderte Unterlage verschwindet beim
 * Schließen wieder. `amEnde`: bestehende Unterlagen öffnen beim Abschluss (Vorschau und Übersicht).
 */
export function Ablauf({ id, neu, amEnde }: { id: string; neu?: boolean; amEnde?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const unterlage = z.stand.unterlagen.find((u) => u.id === id);
  const vorlage = unterlage ? vorlageFuer(unterlage.vorlage) : undefined;
  const n = vorlage?.abschnitte.length ?? 0;
  const fest = Boolean(unterlage?.festgeschrieben);
  const [schritt, setSchritt] = useState(amEnde || fest ? n : 0);
  const teilen = useTeilen(id);
  const anfang = useRef(unterlage ? JSON.stringify(unterlage.daten) : "");
  const zRef = useRef(z);
  zRef.current = z;
  const weg = useRef(false);

  useEffect(
    () => () => {
      const zz = zRef.current;
      const d = zz.daten(id);
      const v = d ? vorlageFuer(zz.stand.unterlagen.find((u) => u.id === id)?.vorlage ?? "") : undefined;
      if (!d || !v) return;
      if (neu && JSON.stringify(d) === anfang.current) zz.loeschen(id);
      else merken(v, d, zz);
    },
    [id, neu],
  );
  useEffect(() => {
    if (!unterlage && !weg.current) {
      weg.current = true;
      nav.zurueck();
    }
  }, [unterlage, nav]);
  if (!unterlage || !vorlage) return <Unterseite titel="">{null}</Unterseite>;

  const daten = unterlage.daten;
  const fehlt = fehlendeAngaben(vorlage, daten, z.stand.betrieb);
  const ergebnis = vorlage.ergebnis?.(daten) ?? [];
  // festgeschriebene Unterlagen zeigen nur noch den Abschluss (GoBD, E-127)
  const amAbschluss = schritt >= n || fest;
  const gehe = (i: number) => {
    if (fest) return;
    merken(vorlage, z.daten(id), z);
    setSchritt(Math.max(0, Math.min(n, i)));
  };
  const letzteZahl = ergebnis.at(-1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: f.papier }} edges={["top", "left", "right"]}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: RAND - 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.schliessen} onPress={nav.zurueck} hitSlop={8} style={{ width: ZIEL, height: ZIEL, alignItems: "center", justifyContent: "center" }}>
          <Symbol name="xmark" groesse={20} farbe={f.tinte} gewicht="semibold" />
        </Pressable>
        <T v="klein" fett numberOfLines={1} stil={{ flex: 1, textAlign: "center" }}>{vorlage.titel}</T>
        <View style={{ minWidth: ZIEL, alignItems: "flex-end" }}>
          {amAbschluss || fest ? null : (
            <Pressable accessibilityRole="button" onPress={() => gehe(n)} hitSlop={8} style={{ height: ZIEL, justifyContent: "center", paddingHorizontal: 4 }}>
              <T v="klein" fett farbe={f.amt}>{TEXT.uebersicht}</T>
            </Pressable>
          )}
        </View>
      </View>
      <Fortschritt n={n + 1} aktuell={fest ? n : schritt} />
      <KeyboardAvoidingView behavior={istIos ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView key={schritt} contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 8, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {amAbschluss ? (
            <Abschluss id={id} springen={gehe} fehler={teilen.fehler} drucken={teilen.drucken} eRechnung={teilen.eRechnung} eFehlt={teilen.eFehlt} />
          ) : (
            <Schritt v={vorlage} a={vorlage.abschnitte[schritt]!} index={schritt} id={id} daten={daten} fehlt={fehlt} />
          )}
        </ScrollView>
        <Fuss
          ueber={
            !amAbschluss && letzteZahl ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T v="klein" leise>{letzteZahl[0]}</T>
                <T v="klein" fett stil={{ fontVariant: ["tabular-nums"] }}>{letzteZahl[1]}</T>
              </View>
            ) : null
          }
        >
          {schritt > 0 && !fest ? (
            <Pressable accessibilityRole="button" accessibilityLabel={TEXT.vorheriger_schritt} onPress={() => gehe(schritt - 1)} style={({ pressed }) => ({ width: ZIEL, height: ZIEL, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: f.amtHauch, opacity: pressed ? 0.7 : 1 })}>
              <Symbol name="chevron.left" groesse={20} farbe={f.amtTief} gewicht="semibold" />
            </Pressable>
          ) : null}
          {amAbschluss ? (
            <Knopf text={TEXT.pdf_teilen} symbol="square.and.arrow.up" laedt={teilen.laedt} onPress={() => void teilen.los()} stil={{ flex: 1 }} />
          ) : (
            <Knopf text={schritt === n - 1 ? TEXT.zum_dokument : TEXT.weiter} onPress={() => gehe(schritt + 1)} stil={{ flex: 1 }} />
          )}
        </Fuss>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
