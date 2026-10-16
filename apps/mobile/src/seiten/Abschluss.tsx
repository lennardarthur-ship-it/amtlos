import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { KU_HINWEIS, PRUEFHINWEIS, dateiname, dokumentHtml, eRechnungAus, vorlageFuer, xrechnungUbl } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { DatumFeld, Fuss, Hinweis, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, RADIUS, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { drucken, pdfTeilen } from "../unterlagen/pdf";
import { NUMMER_DOPPELT, fehltFuer } from "../unterlagen/pruefung";
import { dateiTeilen } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
import { faelligAm } from "../unterlagen/ablage";
import { useAmtlos } from "../zustand";
import { bestaetigen } from "../ui/bestaetigen";
import { AbsenderSeite } from "./Betrieb";
import { Ablauf, fehltJeSchritt } from "./Ablauf";
import { useProSperre } from "./Pro";
import { FREI_JE_MONAT, ausgabeErlaubt, betriebFuerDokument, uebrig } from "../pro/regeln";

/**
 * PDF teilen oder drucken – mit Ladezustand und Fehlermeldung. Dokumente an Kunden (Rechnung) gehen nur vollständig
 * raus; nach dem Teilen bzw. Drucken gilt die Unterlage als ausgegeben und wird ggf. festgeschrieben (E-127).
 */
export function useTeilen(id: string) {
  const z = useAmtlos();
  const sperre = useProSperre();
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ausgabe = async (art: "teilen" | "drucken") => {
    const u = z.stand.unterlagen.find((x) => x.id === id);
    const v = u ? vorlageFuer(u.vorlage) : undefined;
    if (!u || !v) return;
    setFehler(null);
    if (v.kundendokument && fehltFuer(z.stand, u).length) return setFehler(TEXT.erst_vollstaendig);
    // Freikontingent (E-132): erneutes Teilen und Stornos gehen immer
    if (!ausgabeErlaubt(z.stand.unterlagen, u, z.pro, new Date()) && !sperre("pdf")) return;
    setLaedt(art === "teilen");
    try {
      const html = dokumentHtml(v, u.daten, betriebFuerDokument(z.stand.betrieb, z.pro));
      const ok = art === "teilen" ? await pdfTeilen(html, dateiname(v, u.daten, heute()), v.querformat) : await drucken(html, dateiname(v, u.daten, heute()), v.querformat);
      // abgebrochen: nichts festschreiben, nichts vom Freikontingent verbrauchen
      if (!ok) return;
      const erstesMal = !u.ausgegeben;
      z.ausgeben(id);
      if (erstesMal && v.festschreiben) z.erfolg();
    } catch {
      setFehler(TEXT.pdf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const [eFehlt, setEFehlt] = useState<string[]>([]);
  /** E-Rechnung (XRechnung, UBL) als Datei teilen – nur vollständig; zählt wie das PDF als ausgegeben (E-128). */
  const eRechnung = async () => {
    const u = z.stand.unterlagen.find((x) => x.id === id);
    const v = u ? vorlageFuer(u.vorlage) : undefined;
    if (!u || !v?.eRechnung) return;
    setFehler(null);
    if (!sperre("e_rechnung")) return;
    const { daten, fehlt } = eRechnungAus(u.daten, z.stand.betrieb);
    const alle = [...new Set([...fehltFuer(z.stand, u), ...fehlt])];
    setEFehlt(alle);
    if (alle.length) return;
    try {
      if (await dateiTeilen(`E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xrechnungUbl(daten, KU_HINWEIS), "application/xml")) z.ausgeben(id);
    } catch {
      setFehler(TEXT.e_rechnung_fehler);
    }
  };
  return { laedt, fehler, eFehlt, los: () => ausgabe("teilen"), drucken: () => ausgabe("drucken"), eRechnung };
}

function VorschauSeite({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const teilen = useTeilen(id);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return <Unterseite titel="">{null}</Unterseite>;
  return (
    <Unterseite titel={TEXT.vorschau}>
      <View style={{ flex: 1 }}>
        <Vorschau html={dokumentHtml(v, u.daten, betriebFuerDokument(z.stand.betrieb, z.pro))} quer={v.querformat} />
      </View>
      <Fuss ueber={teilen.fehler ? <T v="klein" fett farbe={f.frist} accessibilityRole="alert">{teilen.fehler}</T> : null}>
        <Knopf text={TEXT.pdf_teilen} symbol="square.and.arrow.up" laedt={teilen.laedt} onPress={() => void teilen.los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/**
 * Abschluss eines Ablaufs (E-124): Stand („Fertig“ bzw. was fehlt, mit Sprung zum Schritt), Ergebnis, Vorschau des
 * Dokuments, Übersicht der Schritte und weitere Möglichkeiten. Der Hauptknopf „PDF teilen“ steht im Fuß des Ablaufs.
 */
export function Abschluss({ id, springen, fehler, drucken: druckenLos, eRechnung, eFehlt = [] }: { id: string; springen: (schritt: number) => void; fehler: string | null; drucken: () => Promise<void>; eRechnung?: () => Promise<void>; eFehlt?: string[] }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return null;
  const d = u.daten;
  const jeSchritt = fehltJeSchritt(v, d);
  const alle = fehltFuer(z.stand, u);
  const fest = Boolean(u.festgeschrieben);
  const nummerSchritt = v.fortlaufend ? v.abschnitte.findIndex((a) => a.felder.some((x) => x.id === v.fortlaufend)) : -1;
  const storno = u.storniertDurch ? z.stand.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
  const imFormular = new Set(jeSchritt.flat());
  // Prüfungen außerhalb der Schritte: einem Schritt zuordnen, wenn ein Feld dort so heißt; sonst „Mein Betrieb“ bzw. ohne Sprung
  const extra = alle.filter((x) => !imFormular.has(x)).map((x) => ({ text: x, schritt: x === NUMMER_DOPPELT ? nummerSchritt : v.abschnitte.findIndex((a) => a.felder.some((feld) => feld.label === x)), betrieb: x.includes("(Mein Betrieb)") }));
  const html = dokumentHtml(v, d, betriebFuerDokument(z.stand.betrieb, z.pro));
  const rest = uebrig(z.stand.unterlagen, new Date());
  const zaehlt = !z.pro && !u.ausgegeben && !(typeof d.storno_zu === "string" && d.storno_zu);
  const ergebnis = v.ergebnis?.(d) ?? [];
  const fertig = alle.length === 0;
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  const geteilt = fest && v.storno && !d.storno_zu;
  return (
    <View>
      {/* Bühne (E-142): Stand, Summe und das Dokument als Blatt Papier auf dem tiefen Grün */}
      <View style={{ paddingTop: 8, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {fertig || fest ? <Symbol name={fest && !geteilt ? "lock.fill" : "checkmark.circle.fill"} groesse={20} farbe={f.minze} gewicht="semibold" /> : null}
          <T v="klein" farbe={f.buehneLeise} stil={{ ...SCHRIFT.halb }}>{fest ? (geteilt ? TEXT.geteilt_titel : TEXT.festgeschrieben_titel) : fertig ? TEXT.alles_drin : TEXT.fast_fertig}</T>
        </View>
        {ergebnis.length ? (
          <View>
            <T v="klein" farbe={f.buehneLeise}>{ergebnis.at(-1)![0]}</T>
            <T farbe={f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, fontVariant: ["tabular-nums"] }}>{ergebnis.at(-1)![1]}</T>
          </View>
        ) : (
          <T v="titel" accessibilityRole="header" farbe={f.buehneText}>{fest ? (geteilt ? TEXT.geteilt_titel : TEXT.festgeschrieben_titel) : fertig ? TEXT.fertig : TEXT.fast_fertig}</T>
        )}
      </View>

      {!fest && !fertig ? (
        <View accessibilityRole="summary" style={{ marginTop: 16, backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12 }}>
          <T v="klein" fett>{TEXT.fehlen(alle.length)}</T>
          {jeSchritt.flatMap((l, i) => l.map((x) => ({ text: x, schritt: i, betrieb: false }))).concat(extra).map((x, i) => (
            <View key={`${x.text}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie }}>
              <T v="klein" stil={{ flex: 1 }}>{x.text}</T>
              {x.betrieb ? (
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.im_betrieb}: ${x.text}`} onPress={() => nav.oeffnen("absender", () => <AbsenderSeite />, true)} />
              ) : x.schritt >= 0 ? (
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.ergaenzen}: ${x.text}`} onPress={() => springen(x.schritt)} />
              ) : null}
            </View>
          ))}
          <T v="caption" leise stil={{ marginTop: 6 }}>{v.kundendokument ? TEXT.fehlt_kunde : TEXT.fehlt_text}</T>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel={TEXT.vorschau_oeffnen} onPress={() => nav.oeffnen(`vorschau-${id}`, () => <VorschauSeite id={id} />, true)} style={({ pressed }) => ({ marginTop: 18, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
        <View style={{ borderRadius: RADIUS.blatt, backgroundColor: "#ffffff", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 }}>
          <Vorschau papier html={html} quer={v.querformat} hoehe={v.querformat ? 260 : 440} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 }}>
          <Symbol name="eye" groesse={17} farbe={f.minze} />
          <T v="klein" farbe={f.minze} stil={{ ...SCHRIFT.halb }}>{TEXT.vorschau_oeffnen}</T>
        </View>
      </Pressable>

      {/* das Blatt darunter: Zahlung, Hinweise, Angaben und weitere Möglichkeiten */}
      <View style={{ marginHorizontal: -RAND, marginTop: 10, paddingHorizontal: RAND, paddingTop: 24, paddingBottom: 32, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne }}>
        {fest ? (
          <View>
            {geteilt ? <Hinweis art="erfolg" symbol="checkmark.circle" text={TEXT.geteilt_text(datumDe(u.festgeschrieben!))} /> : <Hinweis symbol="lock" text={TEXT.festgeschrieben_text(datumDe(u.festgeschrieben!), Boolean(v.storno))} />}
            {storno ? <Hinweis art="erfolg" text={TEXT.storniert_durch(String(storno.daten.nummer ?? ""))} /> : null}
            {typeof d.storno_zu === "string" && d.storno_zu ? <Hinweis text={TEXT.storniert_zu(d.storno_zu)} /> : null}
            {v.storno && !u.storniertDurch ? <Zahlung id={id} /> : null}
          </View>
        ) : null}
        {ergebnis.length > 1 ? (
          <Karte stil={{ marginTop: fest ? 12 : 0, paddingVertical: 8 }}>
            {ergebnis.map(([k, w], i) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie }}>
                <T v="klein" leise={i < ergebnis.length - 1} fett={i === ergebnis.length - 1} stil={{ flex: 1 }}>{k}</T>
                <T v="klein" fett={i === ergebnis.length - 1} stil={{ flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] }}>{w}</T>
              </View>
            ))}
          </Karte>
        ) : null}
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {v.festschreiben && !fest ? <T v="caption" leise stil={{ marginTop: 10, marginLeft: 4 }}>{TEXT.wird_festgeschrieben}</T> : null}
        {zaehlt ? <T v="caption" leise stil={{ marginTop: 4, marginLeft: 4 }}>{TEXT.pro_rest(rest, FREI_JE_MONAT)}</T> : null}
        <T v="caption" leise stil={{ marginTop: 4, marginLeft: 4 }}>{PRUEFHINWEIS}</T>

        <T v="gross" accessibilityRole="header" stil={{ marginTop: 30, marginBottom: 12, marginLeft: 4 }}>{fest ? TEXT.angaben : TEXT.angaben_bearbeiten}</T>
        <Karte>
          {v.abschnitte.map((a, i) => (
            <Zeile
              key={i}
              links={<Symbol name={jeSchritt[i]!.length ? "exclamationmark.circle" : "checkmark.circle.fill"} groesse={20} farbe={jeSchritt[i]!.length ? f.bald : f.amt} />}
              titel={a.titel ?? ""}
              text={jeSchritt[i]!.length ? TEXT.eintrag_fehlt(jeSchritt[i]!.length) : TEXT.schritt_fertig}
              onPress={fest ? undefined : () => springen(i)}
              letzte={i === v.abschnitte.length - 1}
            />
          ))}
        </Karte>

        <T v="gross" accessibilityRole="header" stil={{ marginTop: 30, marginBottom: 11, marginLeft: 2 }}>{TEXT.mehr}</T>
        {eFehlt.length ? (
          <View style={{ backgroundColor: f.baldHauch, borderRadius: RADIUS.karte, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10 }}>
            <T v="klein" fett>{TEXT.e_rechnung_fehlt}</T>
            {eFehlt.map((x) => (
              <T key={x} v="klein" stil={{ marginTop: 3 }}>• {x}</T>
            ))}
          </View>
        ) : null}
        <Karte>
          {[
            ...(v.eRechnung && eRechnung ? [{ symbol: "doc.text", titel: TEXT.mitPro(TEXT.e_rechnung, z.pro), los: () => void eRechnung() }] : []),
            { symbol: "printer", titel: TEXT.drucken, los: () => void druckenLos() },
            ...(v.alsText ? [{ symbol: "doc.on.doc", titel: TEXT.als_text, los: () => void Share.share({ message: v.alsText!(d, z.stand.betrieb) }).catch(() => undefined) }] : []),
            {
              symbol: "plus.circle",
              titel: TEXT.kopie,
              los: () => {
                const k = z.kopieren(id);
                if (k) {
                  melden(TEXT.kopie_angelegt);
                  nav.oeffnen(`ablauf-${k.id}`, () => <Ablauf id={k.id} />, true);
                }
              },
            },
          ].map((x, i, l) => (
            <Zeile key={x.symbol} symbol={x.symbol} titel={x.titel} onPress={x.los} letzte={i === l.length - 1} />
          ))}
        </Karte>
        <View style={{ marginTop: 8, marginLeft: 2 }}>
          {/* Rückfragen als System-Dialog – eine Karte am Seitenende läge halb unter Fußleiste oder Meldung */}
          {fest ? (
            v.storno && !u.storniertDurch && !d.storno_zu ? (
              <TextKnopf
                symbol="arrow.uturn.backward"
                gefahr
                text={TEXT.stornieren}
                onPress={() =>
                  void bestaetigen({ titel: TEXT.storno_wirklich, text: TEXT.storno_text, ja: TEXT.storno_ja }).then((ok) => {
                    if (!ok) return;
                    const neu = z.stornieren(id);
                    if (neu) {
                      melden(TEXT.storno_angelegt, "info");
                      nav.oeffnen(`ablauf-${neu.id}`, () => <Ablauf id={neu.id} amEnde />, true);
                    }
                  })
                }
              />
            ) : null
          ) : (
            <TextKnopf
              symbol="trash"
              gefahr
              text={TEXT.loeschen}
              onPress={() =>
                void bestaetigen({ titel: TEXT.loeschen_wirklich, ja: TEXT.loeschen_ja }).then((ok) => {
                  if (!ok) return;
                  z.loeschen(id);
                  melden(TEXT.geloescht, "info");
                })
              }
            />
          )}
        </View>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
      </View>
    </View>
  );
}

/**
 * Zahlungseingang einer festgeschriebenen Rechnung vermerken (E-129) – für die Ist-Versteuerung und den Überblick.
 * Bei einer Stornorechnung: die Erstattung. Der Vermerk gehört nicht zum Inhalt, die Rechnung bleibt unverändert.
 */
function Zahlung({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const [anders, setAnders] = useState(false);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const erstattung = typeof u?.daten.storno_zu === "string" && u.daten.storno_zu !== "";
  const vermerken = (d: string) => {
    z.bezahltSetzen(id, d);
    melden(erstattung ? TEXT.erstattung_vermerkt : TEXT.zahlung_vermerkt);
    z.erfolg();
  };
  if (!u) return null;
  const faellig = faelligAm(u);
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
  return (
    <Karte stil={{ marginTop: 12, paddingVertical: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T fett>{u.bezahlt ? (erstattung ? TEXT.erstattet_am(datumDe(u.bezahlt)) : TEXT.bezahlt_am(datumDe(u.bezahlt))) : TEXT.offen_zahlung}</T>
          {/* Fälligkeit nach dem Zahlungsziel der Rechnung – überfällig in Rot */}
          {!u.bezahlt && !erstattung && faellig ? <T v="klein" farbe={faellig < heute() ? f.frist : undefined} leise={faellig >= heute()}>{faellig < heute() ? TEXT.faellig_war(datumDe(faellig)) : TEXT.faellig_bis(datumDe(faellig))}</T> : null}
        </View>
      </View>
      {u.bezahlt ? (
        <TextKnopf symbol="xmark" text={TEXT.zahlung_entfernen} onPress={() => z.bezahltSetzen(id, null)} />
      ) : (
        <View style={{ gap: 4 }}>
          <Knopf ton symbol="checkmark" text={erstattung ? TEXT.als_erstattet : TEXT.als_bezahlt} onPress={() => vermerken(heute())} />
          {anders ? <DatumFeld label={TEXT.anderes_datum} wert={null} aendern={(d) => d && vermerken(d)} /> : <TextKnopf text={TEXT.anderes_datum} onPress={() => setAnders(true)} />}
        </View>
      )}
      <T v="caption" leise>{TEXT.bezahlt_hilfe}</T>
    </Karte>
  );
}
