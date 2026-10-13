import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { KU_HINWEIS, PRUEFHINWEIS, dateiname, dokumentHtml, eRechnungAus, vorlageFuer, xrechnungUbl } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { DatumFeld, Fuss, Hinweis, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { RADIUS, useFarben } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { drucken, pdfTeilen } from "../unterlagen/pdf";
import { NUMMER_DOPPELT, fehltFuer } from "../unterlagen/pruefung";
import { dateiTeilen } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
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
  return (
    <View>
      <T v="titel" accessibilityRole="header" stil={{ fontSize: 28, lineHeight: 34 }}>{fest ? (v.storno && !d.storno_zu ? TEXT.geteilt_titel : TEXT.festgeschrieben_titel) : fertig ? TEXT.fertig : TEXT.fast_fertig}</T>
      {fest ? (
        <View style={{ marginTop: 10 }}>
          {v.storno && !d.storno_zu ? (
            // der Erfolgsmoment: geteilt – nicht „festgeschrieben“ als Warnung
            <Hinweis art="erfolg" symbol="checkmark.circle" text={TEXT.geteilt_text(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(u.festgeschrieben!)))} />
          ) : (
            <Hinweis symbol="lock" text={TEXT.festgeschrieben_text(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(u.festgeschrieben!)), Boolean(v.storno))} />
          )}
          {storno ? <Hinweis art="erfolg" text={TEXT.storniert_durch(String(storno.daten.nummer ?? ""))} /> : null}
          {typeof d.storno_zu === "string" && d.storno_zu ? <Hinweis text={TEXT.storniert_zu(d.storno_zu)} /> : null}
          {v.storno && !u.storniertDurch ? <Zahlung id={id} /> : null}
        </View>
      ) : fertig ? (
        <View style={{ marginTop: 10 }}>
          <Hinweis art="erfolg" text={TEXT.alles_drin} />
        </View>
      ) : (
        <View accessibilityRole="summary" style={{ marginTop: 12, backgroundColor: f.baldHauch, borderRadius: RADIUS.klein, paddingHorizontal: 14, paddingVertical: 10 }}>
          <T v="klein" fett>{TEXT.fehlen(alle.length)}</T>
          {jeSchritt.flatMap((l, i) => l.map((x) => ({ text: x, schritt: i, betrieb: false }))).concat(extra).map((x, i) => (
            <View key={`${x.text}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
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
      )}
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {v.festschreiben && !fest ? <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.wird_festgeschrieben}</T> : null}
      {zaehlt ? <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.pro_rest(rest, FREI_JE_MONAT)}</T> : null}

      {ergebnis.length ? (
        <Karte stil={{ marginTop: 18 }}>
          {ergebnis.map(([k, w], i) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
              <T stil={{ flex: 1 }} fett={i === ergebnis.length - 1}>{k}</T>
              <T fett={i === ergebnis.length - 1} stil={{ flexShrink: 1, textAlign: "right" }}>{w}</T>
            </View>
          ))}
        </Karte>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel={TEXT.vorschau_oeffnen} onPress={() => nav.oeffnen(`vorschau-${id}`, () => <VorschauSeite id={id} />, true)} style={({ pressed }) => ({ marginTop: 18, opacity: pressed ? 0.85 : 1 })}>
        <Vorschau html={html} quer={v.querformat} hoehe={v.querformat ? 260 : 400} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>
          <Symbol name="eye" groesse={17} farbe={f.amt} />
          <T v="klein" fett farbe={f.amt}>{TEXT.vorschau_oeffnen}</T>
        </View>
      </Pressable>
      <T v="caption" leise>{PRUEFHINWEIS}</T>

      <T v="klein" fett leise accessibilityRole="header" stil={{ marginTop: 28, marginBottom: 8, marginLeft: 4 }}>{fest ? TEXT.angaben : TEXT.angaben_bearbeiten}</T>
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

      <T v="klein" fett leise accessibilityRole="header" stil={{ marginTop: 28, marginBottom: 2, marginLeft: 4 }}>{TEXT.mehr}</T>
      <View style={{ marginLeft: 4 }}>
        {v.eRechnung && eRechnung ? <TextKnopf symbol="doc.text" text={TEXT.mitPro(TEXT.e_rechnung, z.pro)} onPress={() => void eRechnung()} /> : null}
        {eFehlt.length ? (
          <View style={{ backgroundColor: f.baldHauch, borderRadius: RADIUS.klein, padding: 12, marginVertical: 4 }}>
            <T v="klein" fett>{TEXT.e_rechnung_fehlt}</T>
            {eFehlt.map((x) => (
              <T key={x} v="klein" stil={{ marginTop: 2 }}>• {x}</T>
            ))}
          </View>
        ) : null}
        <TextKnopf symbol="printer" text={TEXT.drucken} onPress={() => void druckenLos()} />
        {v.alsText ? <TextKnopf symbol="doc.on.doc" text={TEXT.als_text} onPress={() => void Share.share({ message: v.alsText!(d, z.stand.betrieb) }).catch(() => undefined)} /> : null}
        <TextKnopf
          symbol="plus.circle"
          text={TEXT.kopie}
          onPress={() => {
            const k = z.kopieren(id);
            if (k) {
              melden(TEXT.kopie_angelegt);
              nav.oeffnen(`ablauf-${k.id}`, () => <Ablauf id={k.id} />, true);
            }
          }}
        />
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
  const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
  return (
    <Karte stil={{ marginTop: 10, paddingVertical: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Symbol name={u.bezahlt ? "checkmark.circle.fill" : "clock"} groesse={20} farbe={u.bezahlt ? f.amt : f.bald} />
        <T fett stil={{ flex: 1 }}>{u.bezahlt ? (erstattung ? TEXT.erstattet_am(datumDe(u.bezahlt)) : TEXT.bezahlt_am(datumDe(u.bezahlt))) : TEXT.offen_zahlung}</T>
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
