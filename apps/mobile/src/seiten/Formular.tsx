import { useEffect, useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { PRUEFHINWEIS, cent, dateiname, dokumentHtml, eintragAusVorschlag, fehlendeAngaben, neuerEintrag, sichtbar, unterlagenName, vorlageFuer, type Daten, type EinfachesFeld, type Eintrag, type EintragWert, type ListenFeld, type Vorschlag } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, BausteinListe, DatumFeld, Feld, Hinweis, Karte, Knopf, MehrfachWahl, Schalter, Symbol, T, UhrzeitFeld, Wahl } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RADIUS, ZIEL, useFarben } from "../ui/thema";
import { heute } from "../unterlagen/speicher";
import { drucken, pdfTeilen } from "../unterlagen/pdf";
import { useAmtlos } from "../zustand";
import { Gruppe, Inhalt } from "./gemeinsam";

/** Antippbare Formulierungen unter einem Textfeld: ersetzen (einzeilig) oder als neue Zeile anhängen (mehrzeilig). */
function Vorschlaege({ liste, wert, mehrzeilig, setzen }: { liste: string[]; wert: string; mehrzeilig: boolean; setzen: (w: string) => void }) {
  const f = useFarben();
  const [alle, setAlle] = useState(false);
  const zeilen = wert.split("\n").map((z) => z.trim());
  const sichtbar = alle ? liste : liste.slice(0, 6);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {sichtbar.map((v) => {
        const drin = mehrzeilig ? zeilen.includes(v) : wert.trim() === v;
        return (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: drin }}
            accessibilityLabel={`${drin ? TEXT.vorschlag_entfernen : TEXT.vorschlag_uebernehmen}: ${v}`}
            onPress={() => {
              if (!mehrzeilig) return setzen(drin ? "" : v);
              setzen(drin ? zeilen.filter((z) => z !== v).join("\n") : [wert.trim(), v].filter(Boolean).join("\n"));
            }}
            style={{ maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: drin ? f.amtHauch : f.papier, borderWidth: 1, borderColor: drin ? f.amt : f.linie }}
          >
            <Symbol name={drin ? "checkmark" : "plus"} groesse={12} farbe={drin ? f.amt : f.tinteLeise} />
            <T v="caption" farbe={drin ? f.amtTief : f.tinte} numberOfLines={2} stil={{ flexShrink: 1 }}>{v}</T>
          </Pressable>
        );
      })}
      {liste.length > 6 && !alle ? (
        <Pressable accessibilityRole="button" onPress={() => setAlle(true)} style={{ paddingHorizontal: 10, paddingVertical: 7 }}>
          <T v="caption" fett farbe={f.amt}>{TEXT.mehr_vorschlaege(liste.length - 6)}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Ein Eingabefeld je Feldart. */
function Eingabe({ feld, wert, setzen }: { feld: EinfachesFeld; wert: EintragWert | undefined; setzen: (w: EintragWert) => void }) {
  const text = typeof wert === "string" ? wert : "";
  switch (feld.art) {
    case "text":
    case "mehrzeilig":
      return (
        <View>
          <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} mehrzeilig={feld.art === "mehrzeilig"} />
          {feld.vorschlaege?.length ? <Vorschlaege liste={feld.vorschlaege} wert={text} mehrzeilig={feld.art === "mehrzeilig"} setzen={setzen} /> : null}
        </View>
      );
    case "bausteine":
      return <BausteinListe label={feld.label} hilfe={feld.hilfe} werte={Array.isArray(wert) ? wert : []} aendern={setzen} optionen={feld.optionen} />;
    case "datum":
      return <DatumFeld label={feld.label} hilfe={feld.hilfe} wert={text || null} aendern={setzen} />;
    case "uhrzeit":
      return <UhrzeitFeld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} />;
    case "betrag":
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} keyboardType="decimal-pad" placeholder="0,00" fehler={text.trim() && cent(text) === null ? TEXT.betrag_falsch : null} />;
    case "zahl":
      return <Feld label={feld.label} hilfe={feld.hilfe} wert={text} aendern={setzen} keyboardType="decimal-pad" fehler={text.trim() && cent(text) === null ? TEXT.zahl_falsch : null} />;
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

const titelText = (feld: ListenFeld, e: Eintrag) => (typeof e[feld.titelFeld] === "string" ? (e[feld.titelFeld] as string).trim() : "");

/** Vorschläge für eine Liste: nach Gruppe filtern, ankreuzen, übernehmen. Schon übernommene sind markiert. */
function VorschlagSeite({ feld, vorhanden, uebernehmen }: { feld: ListenFeld; vorhanden: string[]; uebernehmen: (v: Vorschlag[]) => void }) {
  const f = useFarben();
  const nav = useNav();
  const alle = feld.vorschlaege ?? [];
  const gruppen = [...new Set(alle.map((v) => v.gruppe).filter((g): g is string => Boolean(g)))];
  const [gruppe, setGruppe] = useState<string | null>(gruppen.length > 1 ? null : (gruppen[0] ?? null));
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const liste = alle.filter((v) => !gruppe || v.gruppe === gruppe);
  const istDa = (v: Vorschlag) => vorhanden.includes(titelText(feld, v.werte) || v.titel);
  return (
    <Unterseite titel={TEXT.vorschlaege_titel}>
      <Inhalt>
        <T v="titel" accessibilityRole="header">{feld.label}</T>
        <T leise stil={{ marginTop: 4 }}>{TEXT.vorschlaege_text}</T>
        {gruppen.length > 1 ? (
          <View style={{ marginTop: 6 }}>
            <Wahl label={feld.gruppenLabel ?? TEXT.gruppe} wert={gruppe ?? ""} aendern={(g) => setGruppe(g || null)} optionen={[{ wert: "", text: TEXT.alle }, ...gruppen.map((g) => ({ wert: g, text: g }))]} />
          </View>
        ) : null}
        {gewaehlt.size ? (
          <Knopf
            text={TEXT.uebernehmen(gewaehlt.size)}
            symbol="plus"
            onPress={() => {
              uebernehmen(alle.filter((v) => gewaehlt.has(v.titel)));
              nav.zurueck();
            }}
            stil={{ marginTop: 16 }}
          />
        ) : null}
        <Karte stil={{ marginTop: 16 }}>
          {liste.map((v, i) => {
            const da = istDa(v);
            const an = da || gewaehlt.has(v.titel);
            return (
              <Pressable
                key={`${v.gruppe}-${v.titel}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: an, disabled: da }}
                aria-checked={an}
                disabled={da}
                onPress={() => setGewaehlt((g) => { const n = new Set(g); if (n.has(v.titel)) n.delete(v.titel); else n.add(v.titel); return n; })}
                style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise, opacity: da ? 0.55 : pressed ? 0.7 : 1 })}
              >
                <Symbol name={an ? "checkmark.square.fill" : "square"} groesse={20} farbe={an ? f.amt : f.tinteLeise} />
                <View style={{ flex: 1 }}>
                  <T v="klein" fett={an}>{v.titel}</T>
                  <T v="caption" leise stil={{ marginTop: 2 }}>{[da ? TEXT.schon_drin : null, !gruppe && v.gruppe ? v.gruppe : null, v.quelle ? `${TEXT.quelle}: ${v.quelle}` : null].filter(Boolean).join(" · ")}</T>
                </View>
              </Pressable>
            );
          })}
        </Karte>
        <Knopf
          text={gewaehlt.size ? TEXT.uebernehmen(gewaehlt.size) : TEXT.nichts_gewaehlt}
          deaktiviert={!gewaehlt.size}
          symbol="plus"
          onPress={() => {
            uebernehmen(alle.filter((v) => gewaehlt.has(v.titel)));
            nav.zurueck();
          }}
          stil={{ marginTop: 18 }}
        />
      </Inhalt>
    </Unterseite>
  );
}

/** Liste von Einträgen: zugeklappt mit Titel, der bearbeitete Eintrag aufgeklappt. */
function ListenEingabe({ feld, eintraege, setzen }: { feld: ListenFeld; eintraege: Eintrag[]; setzen: (e: Eintrag[]) => void }) {
  const f = useFarben();
  const nav = useNav();
  const { stand } = useAmtlos();
  // aktuelle Einträge für die Vorschlagsseite, die später übernimmt
  const aktuell = useRef(eintraege);
  aktuell.current = eintraege;
  const [offen, setOffen] = useState<number | null>(eintraege.length === 1 ? 0 : null);
  const titelVon = (e: Eintrag, i: number) => {
    const roh = typeof e[feld.titelFeld] === "string" ? (e[feld.titelFeld] as string).trim().split("\n")[0]! : "";
    const t = /^\d{4}-\d{2}-\d{2}$/.test(roh) ? roh.split("-").reverse().join(".") : roh;
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
      {feld.vorschlaege?.length ? (
        <Knopf
          symbol="checklist"
          text={TEXT.aus_vorschlaegen(feld.vorschlaege.length)}
          onPress={() =>
            nav.oeffnen(`vorschlaege-${feld.id}`, () => (
              <VorschlagSeite
                feld={feld}
                vorhanden={aktuell.current.map((e) => titelText(feld, e))}
                uebernehmen={(neu) => {
                  // leere Einträge (nur Startwerte) ersetzen, damit keine leere Zeile übrig bleibt
                  const behalten = aktuell.current.filter((e) => feld.felder.some((x) => (x.art === "text" || x.art === "mehrzeilig") && typeof e[x.id] === "string" && (e[x.id] as string).trim()));
                  setzen([...behalten, ...neu.map((v) => eintragAusVorschlag(feld, v, stand.betrieb, heute()))]);
                  setOffen(null);
                }}
              />
            ))
          }
        />
      ) : null}
      <Knopf
        leise
        symbol="plus"
        text={feld.vorschlaege?.length ? TEXT.eigener_eintrag(feld.eintrag) : TEXT.hinzufuegen(feld.eintrag)}
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
  const fehlt = fehlendeAngaben(vorlage, daten, stand.betrieb);
  const ergebnis = vorlage.ergebnis?.(daten) ?? [];
  const html = () => dokumentHtml(vorlage, daten, stand.betrieb);
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

        {ergebnis.length ? (
          <Gruppe titel={TEXT.ergebnis}>
            <Karte>
              {ergebnis.map(([k, w], i) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
                  <T stil={{ flex: 1 }}>{k}</T>
                  <T fett={i === ergebnis.length - 1} stil={{ fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" }}>{w}</T>
                </View>
              ))}
            </Karte>
          </Gruppe>
        ) : null}

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
          <T v="caption" leise stil={{ marginBottom: 10 }}>{PRUEFHINWEIS}</T>
          <Knopf text={TEXT.pdf_teilen} symbol="square.and.arrow.up" laedt={pdfLaedt} onPress={() => void teilen()} />
          <Knopf leise text={TEXT.drucken} symbol="printer" onPress={() => void drucken(html(), dateiname(vorlage, daten, heute()), vorlage.querformat).catch(() => setFehler(TEXT.pdf_fehler))} stil={{ marginTop: 10 }} />
          {vorlage.alsText ? <Knopf leise text={TEXT.als_text} symbol="doc.on.doc" onPress={() => void Share.share({ message: vorlage.alsText!(daten, stand.betrieb) }).catch(() => undefined)} stil={{ marginTop: 10 }} /> : null}
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
