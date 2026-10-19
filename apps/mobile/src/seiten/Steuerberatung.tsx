import { useState } from "react";
import { ScrollView, View } from "react-native";
import { T as TEXT } from "../texte";
import { RAND } from "../ui/thema";
import { Feld, Fuss, Hinweis, Karte, Knopf, T, Wahl } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite } from "../ui/navigation";
import { gestellteRechnungen, standardZeitraum, steuerpaket, zeitraeume } from "../unterlagen/steuerpaket";
import { dateiTeilenBytes } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";
import { useProSperre } from "./Pro";

/**
 * Paket für die Steuerberatung (E-133): Zeitraum wählen, Kontenrahmen und DATEV-Nummern angeben, ZIP teilen.
 * Das Paket entsteht auf dem Gerät; die Belegdateien werden dafür entschlüsselt.
 */
export function SteuerberatungSeite() {
  const z = useAmtlos();
  const melden = useMeldung();
  const sperre = useProSperre();
  // Quartale zuerst – das zuletzt abgeschlossene ist vorausgewählt; dann Monate, dann Jahre
  const rang = (n: string) => (/-Q\d$/.test(n) ? 0 : /^\d{4}-\d{2}$/.test(n) ? 1 : 2);
  const liste = zeitraeume(heute()).sort((a, b) => rang(a.name) - rang(b.name));
  const [wahl, setWahl] = useState(() => standardZeitraum(heute()));
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const sb = z.stand.steuerberatung;
  const zr = liste.find((x) => x.name === wahl)!;
  const anzahlR = gestellteRechnungen(z.stand).filter((u) => String(u.daten.datum) >= zr.von && String(u.daten.datum) <= zr.bis).length;
  const anzahlB = z.stand.belege.filter((b) => b.datum >= zr.von && b.datum <= zr.bis).length;
  const nameVon = (n: string) => (/^\d{4}$/.test(n) ? `Jahr ${n}` : /Q(\d)$/.test(n) ? `${n.slice(-1)}. Quartal ${n.slice(0, 4)}` : new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${n}-01T00:00:00Z`)));
  const los = async () => {
    setFehler(null);
    setHinweis(null);
    if (!sperre("steuerberater")) return;
    setLaedt(true);
    try {
      const dateien: Record<string, Uint8Array> = {};
      for (const b of z.stand.belege) {
        if (!b.datei || b.datum < zr.von || b.datum > zr.bis) continue;
        const bytes = await z.dateiLesen(b.datei);
        if (bytes) dateien[b.datei] = bytes;
      }
      const p = steuerpaket(z.stand, zr, sb, dateien, new Date().toISOString());
      if (!(await dateiTeilenBytes(p.dateiname, p.zip, "application/zip"))) return;
      melden(TEXT.steuerpaket_fertig(p.buchungen));
      if (p.ohneXml) setHinweis(TEXT.steuerpaket_ohne_xml(p.ohneXml));
    } catch {
      setFehler(TEXT.paket_fehler);
    } finally {
      setLaedt(false);
    }
  };
  return (
    <Unterseite titel={TEXT.steuerpaket_titel} unter={TEXT.steuerpaket_text}>
      <Inhalt>
        <T v="klein" fett>{TEXT.steuerpaket_zeitraum}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -RAND }} contentContainerStyle={{ paddingHorizontal: RAND }}>
          <Wahl wert={wahl} aendern={setWahl} optionen={liste.map((x) => ({ wert: x.name, text: nameVon(x.name) }))} />
        </ScrollView>
        <Karte stil={{ marginTop: 12, paddingVertical: 12 }}>
          <T fett>{nameVon(wahl)}</T>
          <T v="klein" leise>{TEXT.steuerpaket_inhalt(anzahlR, anzahlB)}</T>
        </Karte>
        {!anzahlR && !anzahlB ? <Hinweis text={TEXT.steuerpaket_leer} /> : null}
        <Wahl label={TEXT.steuerpaket_kontenrahmen} hilfe={TEXT.steuerpaket_kontenrahmen_hilfe} wert={sb.kontenrahmen} aendern={(k) => z.steuerberatungSetzen({ ...sb, kontenrahmen: k })} optionen={[{ wert: "SKR03" as const, text: "SKR03" }, { wert: "SKR04" as const, text: "SKR04" }]} />
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Feld label={TEXT.steuerpaket_berater} wert={sb.beraternummer} aendern={(w) => z.steuerberatungSetzen({ ...sb, beraternummer: w.replace(/\D/g, "").slice(0, 7) })} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Feld label={TEXT.steuerpaket_mandant} wert={sb.mandantennummer} aendern={(w) => z.steuerberatungSetzen({ ...sb, mandantennummer: w.replace(/\D/g, "").slice(0, 7) })} keyboardType="number-pad" />
          </View>
        </View>
        <T v="caption" leise stil={{ marginTop: 6 }}>{TEXT.steuerpaket_nummern_hilfe}</T>
        <View style={{ marginTop: 14 }}>
          <Hinweis text={TEXT.steuerpaket_hinweis} />
          {hinweis ? <Hinweis text={hinweis} /> : null}
          {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        </View>
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.mitPro(TEXT.steuerpaket_teilen, z.pro)} symbol="square.and.arrow.up" laedt={laedt} deaktiviert={!anzahlR && !anzahlB} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}
