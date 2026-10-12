import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { PRUEFHINWEIS, dateiname, dokumentHtml, fehlendeAngaben, vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RADIUS, useFarben } from "../ui/thema";
import { Vorschau } from "../ui/Vorschau";
import { drucken, pdfTeilen } from "../unterlagen/pdf";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Ablauf, fehltJeSchritt } from "./Ablauf";
import { BetriebFormular } from "./Betrieb";
import { Inhalt } from "./gemeinsam";

/** PDF erstellen und teilen – mit Ladezustand und Fehlermeldung. */
export function useTeilen(id: string) {
  const z = useAmtlos();
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const los = async () => {
    const u = z.stand.unterlagen.find((x) => x.id === id);
    const v = u ? vorlageFuer(u.vorlage) : undefined;
    if (!u || !v) return;
    setFehler(null);
    setLaedt(true);
    try {
      await pdfTeilen(dokumentHtml(v, u.daten, z.stand.betrieb), dateiname(v, u.daten, heute()), v.querformat);
    } catch {
      setFehler(TEXT.pdf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  return { laedt, fehler, los };
}

function VorschauSeite({ id }: { id: string }) {
  const z = useAmtlos();
  const teilen = useTeilen(id);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return <Unterseite titel="">{null}</Unterseite>;
  return (
    <Unterseite titel={TEXT.vorschau}>
      <View style={{ flex: 1 }}>
        <Vorschau html={dokumentHtml(v, u.daten, z.stand.betrieb)} quer={v.querformat} />
      </View>
      <Fuss>
        <Knopf text={TEXT.pdf_teilen} symbol="square.and.arrow.up" laedt={teilen.laedt} onPress={() => void teilen.los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

function BetriebSeite() {
  return (
    <Unterseite titel={TEXT.betrieb_titel}>
      <Inhalt>
        <BetriebFormular />
      </Inhalt>
    </Unterseite>
  );
}

/**
 * Abschluss eines Ablaufs (E-124): Stand („Fertig“ bzw. was fehlt, mit Sprung zum Schritt), Ergebnis, Vorschau des
 * Dokuments, Übersicht der Schritte und weitere Möglichkeiten. Der Hauptknopf „PDF teilen“ steht im Fuß des Ablaufs.
 */
export function Abschluss({ id, springen, fehler }: { id: string; springen: (schritt: number) => void; fehler: string | null }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [druckFehler, setDruckFehler] = useState<string | null>(null);
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v) return null;
  const d = u.daten;
  const jeSchritt = fehltJeSchritt(v, d);
  const alle = fehlendeAngaben(v, d, z.stand.betrieb);
  const imFormular = new Set(jeSchritt.flat());
  // Prüfungen außerhalb der Schritte: einem Schritt zuordnen, wenn ein Feld dort so heißt; sonst „Mein Betrieb“ bzw. ohne Sprung
  const extra = alle.filter((x) => !imFormular.has(x)).map((x) => ({ text: x, schritt: v.abschnitte.findIndex((a) => a.felder.some((feld) => feld.label === x)), betrieb: x.includes("(Mein Betrieb)") }));
  const html = dokumentHtml(v, d, z.stand.betrieb);
  const ergebnis = v.ergebnis?.(d) ?? [];
  const fertig = alle.length === 0;
  return (
    <View>
      <T v="titel" accessibilityRole="header" stil={{ fontSize: 28, lineHeight: 34 }}>{fertig ? TEXT.fertig : TEXT.fast_fertig}</T>
      {fertig ? (
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
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.im_betrieb}: ${x.text}`} onPress={() => nav.oeffnen("betrieb-aus-ablauf", () => <BetriebSeite />, true)} />
              ) : x.schritt >= 0 ? (
                <TextKnopf text={TEXT.ergaenzen} label={`${TEXT.ergaenzen}: ${x.text}`} onPress={() => springen(x.schritt)} />
              ) : null}
            </View>
          ))}
          <T v="caption" leise stil={{ marginTop: 6 }}>{TEXT.fehlt_text}</T>
        </View>
      )}
      {fehler ?? druckFehler ? <Hinweis art="fehler" text={(fehler ?? druckFehler)!} /> : null}

      {ergebnis.length ? (
        <Karte stil={{ marginTop: 18 }}>
          {ergebnis.map(([k, w], i) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
              <T stil={{ flex: 1 }} fett={i === ergebnis.length - 1}>{k}</T>
              <T fett={i === ergebnis.length - 1} stil={{ fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" }}>{w}</T>
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

      <T v="klein" fett leise accessibilityRole="header" stil={{ marginTop: 28, marginBottom: 8, marginLeft: 4 }}>{TEXT.angaben_bearbeiten}</T>
      <Karte>
        {v.abschnitte.map((a, i) => (
          <Zeile
            key={i}
            links={<Symbol name={jeSchritt[i]!.length ? "exclamationmark.circle" : "checkmark.circle.fill"} groesse={20} farbe={jeSchritt[i]!.length ? f.bald : f.amt} />}
            titel={a.titel ?? ""}
            text={jeSchritt[i]!.length ? TEXT.eintrag_fehlt(jeSchritt[i]!.length) : TEXT.schritt_fertig}
            onPress={() => springen(i)}
            letzte={i === v.abschnitte.length - 1}
          />
        ))}
      </Karte>

      <T v="klein" fett leise accessibilityRole="header" stil={{ marginTop: 28, marginBottom: 2, marginLeft: 4 }}>{TEXT.mehr}</T>
      <View style={{ marginLeft: 4 }}>
        <TextKnopf symbol="printer" text={TEXT.drucken} onPress={() => void drucken(html, dateiname(v, d, heute()), v.querformat).catch(() => setDruckFehler(TEXT.pdf_fehler))} />
        {v.alsText ? <TextKnopf symbol="doc.on.doc" text={TEXT.als_text} onPress={() => void Share.share({ message: v.alsText!(d, z.stand.betrieb) }).catch(() => undefined)} /> : null}
        <TextKnopf
          symbol="plus.circle"
          text={TEXT.kopie}
          onPress={() => {
            const k = z.kopieren(id);
            if (k) nav.oeffnen(`ablauf-${k.id}`, () => <Ablauf id={k.id} />, true);
          }}
        />
        {loeschFrage ? (
          <Karte stil={{ paddingVertical: 14, gap: 10, marginTop: 6 }}>
            <T fett>{TEXT.loeschen_wirklich}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf gefahr text={TEXT.loeschen_ja} onPress={() => z.loeschen(id)} stil={{ flex: 1 }} />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setLoeschFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <TextKnopf symbol="trash" gefahr text={TEXT.loeschen} onPress={() => setLoeschFrage(true)} />
        )}
      </View>
    </View>
  );
}
