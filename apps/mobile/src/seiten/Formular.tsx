import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { dateiname, fehlendeAngaben, neuerEintrag, sichtbar, unterlagenName, vorlageFuer, type Daten, type EinfachesFeld, type Eintrag, type EintragWert, type ListenFeld } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, DatumFeld, Feld, Hinweis, Karte, Knopf, MehrfachWahl, Schalter, Symbol, T, UhrzeitFeld, Wahl } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RADIUS, ZIEL, useFarben } from "../ui/thema";
import { heute } from "../unterlagen/speicher";
import { drucken, pdfTeilen } from "../unterlagen/pdf";
import { useAmtlos } from "../zustand";
import { Gruppe, Inhalt } from "./gemeinsam";

/** Ein Eingabefeld je Feldart. */
function Eingabe({ feld, wert, setzen }: { feld: EinfachesFeld; wert: EintragWert | undefined; setzen: (w: EintragWert) => void }) {
  const text = typeof wert === "string" ? wert : "";
  switch (feld.art) {
    case "text":
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} />;
    case "mehrzeilig":
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} mehrzeilig />;
    case "datum":
      return <DatumFeld label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} />;
    case "uhrzeit":
      return <UhrzeitFeld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} />;
    case "schalter":
      return <Schalter label={feld.label} hilfe={feld.hilfe} wert={wert === true} aendern={setzen} />;
    case "mehrfach":
      return <MehrfachWahl label={feld.label} werte={Array.isArray(wert) ? wert : []} aendern={setzen} optionen={feld.optionen} />;
    case "wahl": {
      // Kurze Optionen als Chips, lange oder viele als Liste
      const lang = feld.optionen.length > 4 || feld.optionen.some((o) => o.text.length > 22);
      return lang ? <Auswahl label={feld.label} wert={text || null} aendern={setzen} optionen={feld.optionen} /> : <Wahl label={feld.label} wert={text || null} aendern={setzen} optionen={feld.optionen} />;
    }
  }
}

/** Liste von Einträgen: zugeklappt mit Titel, der bearbeitete Eintrag aufgeklappt. */
function ListenEingabe({ feld, eintraege, setzen }: { feld: ListenFeld; eintraege: Eintrag[]; setzen: (e: Eintrag[]) => void }) {
  const f = useFarben();
  const { stand } = useAmtlos();
  const [offen, setOffen] = useState<number | null>(eintraege.length === 1 ? 0 : null);
  const titelVon = (e: Eintrag, i: number) => {
    const t = typeof e[feld.titelFeld] === "string" ? (e[feld.titelFeld] as string).trim().split("\n")[0] : "";
    return t || `${feld.eintrag} ${i + 1} ${TEXT.eintrag_leer}`;
  };
  return (
    <View style={{ gap: 10 }}>
      {eintraege.map((e, i) => {
        const auf = offen === i;
        return (
          <Karte key={i} stil={{ paddingBottom: auf ? 14 : 0 }} rahmen={auf ? f.amt : undefined}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: auf }}
              accessibilityLabel={`${feld.eintrag} ${i + 1}: ${titelVon(e, i)}`}
              onPress={() => setOffen(auf ? null : i)}
              style={{ minHeight: ZIEL + 4, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <T v="caption" fett leise stil={{ fontVariant: ["tabular-nums"], width: 18 }}>{i + 1}</T>
              <T fett numberOfLines={auf ? 3 : 1} stil={{ flex: 1 }}>{titelVon(e, i)}</T>
              <Symbol name={auf ? "chevron.up" : "chevron.down"} groesse={16} />
            </Pressable>
            {auf ? (
              <View>
                {feld.felder.filter((x) => sichtbar(x, e)).map((x) => (
                  <Eingabe key={x.id} feld={x} wert={e[x.id]} setzen={(w) => setzen(eintraege.map((y, j) => (j === i ? { ...y, [x.id]: w } : y)))} />
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setzen(eintraege.filter((_, j) => j !== i));
                    setOffen(null);
                  }}
                  style={{ minHeight: ZIEL, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" }}
                >
                  <Symbol name="trash" groesse={16} farbe={f.frist} />
                  <T v="klein" fett farbe={f.frist}>{TEXT.entfernen}</T>
                </Pressable>
              </View>
            ) : null}
          </Karte>
        );
      })}
      <Knopf
        leise
        symbol="plus"
        text={TEXT.hinzufuegen(feld.eintrag)}
        onPress={() => {
          setzen([...eintraege, neuerEintrag(feld, stand.betrieb, heute())]);
          setOffen(eintraege.length);
        }}
      />
    </View>
  );
}

/** Eine Unterlage ausfüllen: speichert bei jeder Eingabe, nennt Fehlendes, erstellt das PDF. */
export function Formular({ id }: { id: string }) {
  const { stand, aendern, kopieren, loeschen } = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const unterlage = stand.unterlagen.find((u) => u.id === id);
  const vorlage = unterlage ? vorlageFuer(unterlage.vorlage) : undefined;
  const [daten, setDaten] = useState<Daten>(unterlage?.daten ?? {});
  const [pdfLaedt, setPdfLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [alleFehlenden, setAlleFehlenden] = useState(false);
  const weg = useRef(false);
  useEffect(() => {
    if (!unterlage && !weg.current) {
      weg.current = true;
      nav.zurueck();
    }
  }, [unterlage, nav]);
  if (!unterlage || !vorlage) return <Unterseite titel="">{null}</Unterseite>;

  const setzen = (k: string, w: Daten[string]) => {
    const neu = { ...daten, [k]: w };
    setDaten(neu);
    aendern(id, neu);
  };
  const fehlt = fehlendeAngaben(vorlage, daten);
  const html = () => vorlage.html(daten, stand.betrieb);
  const teilen = async () => {
    setFehler(null);
    setPdfLaedt(true);
    try {
      await pdfTeilen(html(), dateiname(vorlage, daten, heute()), vorlage.querformat);
    } catch {
      setFehler(TEXT.pdf_fehler);
    } finally {
      setPdfLaedt(false);
    }
  };

  return (
    <Unterseite
      titel={vorlage.titel}
      rechts={
        <Pressable accessibilityRole="button" accessibilityLabel={TEXT.pdf_teilen} onPress={() => void teilen()} hitSlop={8} style={{ height: ZIEL, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Symbol name="square.and.arrow.up" groesse={20} farbe={f.amt} gewicht="semibold" />
          <T fett farbe={f.amt}>PDF</T>
        </Pressable>
      }
    >
      <Inhalt>
        <T v="titel" accessibilityRole="header">{unterlagenName(vorlage, daten)}</T>
        <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.gespeichert_auto}</T>

        {vorlage.abschnitte.map((a, ai) => (
          <Gruppe key={ai} titel={a.titel} hilfe={a.hilfe}>
            {a.felder.filter((x) => sichtbar(x, daten)).map((x) =>
              x.art === "liste" ? (
                <ListenEingabe key={x.id} feld={x} eintraege={(Array.isArray(daten[x.id]) ? daten[x.id] : []) as Eintrag[]} setzen={(e) => setzen(x.id, e)} />
              ) : null,
            )}
            {a.felder.some((x) => x.art !== "liste" && sichtbar(x, daten)) ? (
              <Karte stil={{ paddingBottom: 14 }}>
                {a.felder.filter((x): x is EinfachesFeld => x.art !== "liste" && sichtbar(x, daten)).map((x) => (
                  <Eingabe key={x.id} feld={x} wert={daten[x.id] as EintragWert} setzen={(w) => setzen(x.id, w)} />
                ))}
              </Karte>
            ) : null}
          </Gruppe>
        ))}

        <View style={{ marginTop: 28 }}>
          {fehlt.length ? (
            <View accessibilityRole="summary" style={{ backgroundColor: f.baldHauch, borderRadius: RADIUS.klein, padding: 14, marginBottom: 12 }}>
              <T v="klein" fett>{TEXT.fehlt_noch}</T>
              {(alleFehlenden ? fehlt : fehlt.slice(0, 4)).map((x) => (
                <T key={x} v="klein" stil={{ marginTop: 2 }}>• {x}</T>
              ))}
              {fehlt.length > 4 && !alleFehlenden ? (
                <Pressable accessibilityRole="button" onPress={() => setAlleFehlenden(true)} style={{ minHeight: 36, justifyContent: "center" }}>
                  <T v="klein" fett farbe={f.amt}>{TEXT.und_weitere(fehlt.length - 4)}</T>
                </Pressable>
              ) : null}
              <T v="caption" leise stil={{ marginTop: 6 }}>{TEXT.fehlt_text}</T>
            </View>
          ) : (
            <Hinweis art="erfolg" text={TEXT.vollstaendig} />
          )}
          {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
          <Knopf text={TEXT.pdf_teilen} symbol="square.and.arrow.up" laedt={pdfLaedt} onPress={() => void teilen()} />
          <Knopf leise text={TEXT.drucken} symbol="printer" onPress={() => void drucken(html(), vorlage.querformat).catch(() => setFehler(TEXT.pdf_fehler))} stil={{ marginTop: 10 }} />
        </View>

        <Gruppe fuss={TEXT.kopie_text}>
          <Knopf
            leise
            symbol="doc.on.doc"
            text={TEXT.kopie}
            onPress={() => {
              const k = kopieren(id);
              if (k) nav.oeffnen(`formular-${k.id}`, () => <Formular id={k.id} />);
            }}
          />
        </Gruppe>
        <View style={{ marginTop: 24 }}>
          {loeschFrage ? (
            <Karte stil={{ paddingVertical: 14, gap: 10 }}>
              <T fett>{TEXT.loeschen_wirklich}</T>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Knopf gefahr text={TEXT.loeschen_ja} onPress={() => loeschen(id)} stil={{ flex: 1 }} />
                <Knopf leise text={TEXT.abbrechen} onPress={() => setLoeschFrage(false)} stil={{ flex: 1 }} />
              </View>
            </Karte>
          ) : (
            <Knopf leise gefahr symbol="trash" text={TEXT.loeschen} onPress={() => setLoeschFrage(true)} />
          )}
        </View>
      </Inhalt>
    </Unterseite>
  );
}
