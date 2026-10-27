/**
 * R12 Personal (Zoll #2): Fassungen festgeschriebener Nachweise (Arbeitszeit, NachwG, Ausweis-Hinweis). Eine Korrektur
 * legt die geltende Fassung unverändert ab und macht die Unterlage wieder zum Entwurf – mit Datum und Grund, die im PDF
 * stehen („Fassung 2 vom … – ersetzt die Fassung vom …“). Frühere Fassungen bleiben als PDF abrufbar.
 */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { pdfDateiname, vorlageFuer, type Daten } from "@amtlos/fachlogik";
import { fassungHtml } from "../unterlagen/ausgabe";
import { T as TEXT } from "../texte";
import { Feld, Fuss, Hinweis, Karte, Knopf, T, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, useFarben } from "../ui/thema";
import { pdfTeilen } from "../unterlagen/pdf";
import { heute, type Fassung } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Ansage } from "./felder";
import { Inhalt, datumKurz } from "./gemeinsam";

/** Vorschläge für den Grund einer Korrektur je Vorlage. */
const GRUENDE: Record<string, string[]> = {
  arbeitszeitnachweis: ["Weitere Arbeitstage ergänzt", "Tippfehler bei einer Uhrzeit berichtigt", "Pause nachgetragen", "Falsches Datum berichtigt"],
  nachweis_arbeitsbedingungen: ["Lohnerhöhung", "Änderung der Arbeitszeit", "Tippfehler berichtigt"],
  ausweis_hinweis: ["Tippfehler im Namen berichtigt", "Datum berichtigt"],
};

/** Korrektur anlegen: Grund eingeben (Pflicht), dann wird die geltende Fassung abgelegt. */
export function KorrekturSeite({ id }: { id: string }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  if (!u) return <Unterseite titel="">{null}</Unterseite>;
  const vorschlaege = GRUENDE[u.vorlage] ?? [];
  const los = () => {
    if (!grund.trim()) return setFehler(TEXT.r12p_grund_fehlt);
    z.korrigieren(id, grund.trim());
    melden(TEXT.r12p_korrektur_angelegt, "info");
    nav.zurueck();
  };
  return (
    <Unterseite titel={TEXT.r12p_korrektur_titel} unter={TEXT.r12p_korrektur_unter}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 4, paddingBottom: 32 }}>
        <Hinweis art="info" symbol="lock" text={TEXT.r12p_korrektur_text(u.festgeschrieben ? datumKurz(u.festgeschrieben) : "")} />
        <Karte stil={{ marginTop: 14, paddingBottom: 14 }}>
          <Feld label={TEXT.r12p_grund} hilfe={TEXT.r12p_grund_hilfe} wert={grund} aendern={(w) => { setGrund(w); setFehler(null); }} mehrzeilig />
          {vorschlaege.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <Wahl wert={vorschlaege.includes(grund) ? grund : null} aendern={(w) => { setGrund(w); setFehler(null); }} optionen={vorschlaege.map((t) => ({ wert: t, text: t }))} />
            </ScrollView>
          ) : null}
        </Karte>
      </Inhalt>
      <Fuss ueber={fehler ? <Ansage text={fehler} farbe={f.frist} /> : undefined}>
        <Knopf text={TEXT.r12p_korrektur_los} symbol="pencil" onPress={los} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Liste der Fassungen unter dem Abschluss: geltende bzw. in Arbeit, dann die früheren – jede als PDF teilbar. */
export function FassungenKarte({ id }: { id: string }) {
  const z = useAmtlos();
  const melden = useMeldung();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const v = u ? vorlageFuer(u.vorlage) : undefined;
  if (!u || !v || !u.fassungen?.length) return null;
  // E-220 (8b): eine frühere Fassung mit ihrem eigenen Absender bzw. genau wie damals gedruckt – nicht mit „Mein Betrieb“ von heute
  const teilen = async (f2: Fassung) => {
    const ok = await pdfTeilen(fassungHtml(z.stand, u.vorlage, f2, z.pro), pdfDateiname(v, f2.daten, heute()), v.querformat).catch(() => false);
    if (!ok) melden(TEXT.pdf_fehler, "info");
  };
  const grund = (d: Daten) => (typeof d.fassung_grund === "string" && d.fassung_grund.trim() ? d.fassung_grund.trim() : null);
  const nr = u.fassungen.length + 1;
  return (
    <View style={{ marginTop: 24 }}>
      <T v="gross" accessibilityRole="header" stil={{ marginBottom: 11 }}>{TEXT.r12p_fassungen_titel}</T>
      <Karte>
        <Zeile symbol={u.festgeschrieben ? "lock" : "pencil"} ton={u.festgeschrieben ? "amt" : "bald"} titel={TEXT.r12p_fassung_aktuell(nr, u.festgeschrieben ? datumKurz(u.festgeschrieben) : null)} text={grund(u.daten) ?? undefined} />
        {[...u.fassungen].reverse().map((f2, i) => (
          <Zeile key={f2.festgeschrieben} symbol="doc.text" ton="leise" titel={TEXT.r12p_fassung_frueher(nr - 1 - i, datumKurz(f2.festgeschrieben), datumKurz(f2.ersetzt))} text={grund(f2.daten) ?? TEXT.r12p_fassung_pdf} onPress={() => void teilen(f2)} letzte={i === u.fassungen!.length - 1} />
        ))}
      </Karte>
      <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{TEXT.r12p_fassungen_hilfe}</T>
    </View>
  );
}
