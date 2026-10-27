import { useEffect, useMemo, useRef, useState } from "react";
import { pdfDateiname, vorlageFuer } from "@amtlos/fachlogik";
import { ausgabeHtml } from "../unterlagen/ausgabe";
import { pdfBytes } from "../unterlagen/pdf";
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { ChipLeiste, Feld, Fuss, Hinweis, Karte, Knopf, T, TextKnopf, Wahl } from "../ui/bausteine";
import { useMeldung, useMeldungLeeren } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { kassenAbdeckung } from "../unterlagen/kasse";
import { bilanzierendeGewinnermittlung, gestellteRechnungen, kassenHinweisMit, kassenLage, standardZeitraum, steuerpaket, zeitraeume } from "../unterlagen/steuerpaket";
import { dateiTeilenBytes } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";
import { useProSperre } from "./Pro";
import type { Kanzlei } from "../partner/kanzleien";
import { KanzleienAbschnitt, kanzleienSichtbar } from "./Kanzleien";
import { KontenvorgabenSeite, kontenvorgabenAnzahl } from "./Kontenvorgaben";
import { ANDROID } from "../plattform";
import { bestaetigen } from "../ui/bestaetigen";
import { paketUebergeben } from "../unterlagen/paketUebergabe";

/** Ab so vielen MB warnt das Paket (R9 Performance): Es entsteht ganz im Arbeitsspeicher. */
export const PAKET_MB_WARNUNG = 300;

const MONAT_JAHR = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Paket für die Steuerberatung (E-133): Zeitraum wählen, Kontenrahmen und DATEV-Nummern angeben, ZIP teilen.
 * Das Paket entsteht auf dem Gerät; die Belegdateien werden dafür entschlüsselt.
 * „Steuerberatung finden“ (docs/15) erscheint nur mit gelisteten Kanzleien; `kanzleienZuerst` stellt den Bereich nach
 * oben (Einstieg aus einer Steuer-Pflicht).
 */
export function SteuerberatungSeite({ kanzleienZuerst }: { kanzleienZuerst?: boolean } = {}) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const leeren = useMeldungLeeren();
  // eine Meldung vom vorigen Bildschirm („Beleg gespeichert.“) läge sonst über dem Formular
  useEffect(() => leeren(), [leeren]);
  const sperre = useProSperre();
  // Quartale zuerst – das zuletzt abgeschlossene ist vorausgewählt; dann Monate, dann Jahre
  const rang = (n: string) => (/-Q\d$/.test(n) ? 0 : /^\d{4}-\d{2}$/.test(n) ? 1 : 2);
  const liste = zeitraeume(heute()).sort((a, b) => rang(a.name) - rang(b.name));
  // Rechnungen und Belege im Zeitraum
  const anzahl = (zr: { von: string; bis: string }) => gestellteRechnungen(z.stand).filter((u) => String(u.daten.datum) >= zr.von && String(u.daten.datum) <= zr.bis).length + z.stand.belege.filter((b) => b.datum >= zr.von && b.datum <= zr.bis).length;
  // vorausgewählt: der jüngste Zeitraum mit Daten – zuerst das zuletzt abgeschlossene Quartal, sonst das laufende,
  // sonst (beide leer) doch das abgeschlossene; nie ein leeres Paket als Vorschlag, wenn es ein volles gibt
  const [wahl, setWahl] = useState(() => {
    const abgeschlossen = standardZeitraum(heute());
    const j = heute().slice(0, 4);
    const laufend = `${j}-Q${Math.ceil(Number(heute().slice(5, 7)) / 3)}`;
    const mitDaten = (n: string) => {
      const zr = liste.find((x) => x.name === n);
      return Boolean(zr && anzahl(zr));
    };
    return mitDaten(abgeschlossen) ? abgeschlossen : mitDaten(laufend) ? laufend : abgeschlossen;
  });
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  // Paket für eine gelistete Kanzlei: dasselbe Paket, im Teilen-Menü mit deren Adresse (Mail-Composer ist nicht eingebaut)
  const [ziel, setZiel] = useState<Kanzlei | null>(null);
  // E-221 Befund 6: auf Android geteilt, aber nicht als übergeben bestätigt – Belege des Pakets noch nicht festgeschrieben
  const [offenesPaket, setOffenesPaket] = useState<{ ids: string[]; name: string } | null>(null);
  const sb = z.stand.steuerberatung;
  const zr = liste.find((x) => x.name === wahl)!;
  const anzahlR = gestellteRechnungen(z.stand).filter((u) => String(u.daten.datum) >= zr.von && String(u.daten.datum) <= zr.bis).length;
  const anzahlB = z.stand.belege.filter((b) => b.datum >= zr.von && b.datum <= zr.bis).length;
  // ungefähre Größe: Belegdateien im Zeitraum plus etwa 60 KB je Rechnungs-PDF
  const mb = useMemo(() => {
    let bytes = anzahlR * 60_000;
    for (const b of z.stand.belege) if (b.datei && b.datum >= zr.von && b.datum <= zr.bis) bytes += z.dateiGroesse(b.datei);
    return Math.round(bytes / 1e6);
  }, [z.stand.belege, zr.von, zr.bis, anzahlR]);
  const gross = mb > PAKET_MB_WARNUNG;
  const nameVon = (n: string) => (/^\d{4}$/.test(n) ? `Jahr ${n}` : /Q(\d)$/.test(n) ? `${n.slice(-1)}. Quartal ${n.slice(0, 4)}` : MONAT_JAHR.format(new Date(`${n}-01T00:00:00Z`)));
  const los = async (kanzlei?: Kanzlei) => {
    setFehler(null);
    setHinweis(null);
    setOffenesPaket(null);
    setZiel(kanzlei ?? null);
    // Pro wie bisher – auch für das Paket an eine Kanzlei; Liste und Kontakt bleiben frei
    if (!sperre("steuerberater")) return;
    setLaedt(true);
    try {
      // Belegdateien eine nach der anderen lesen, mit Fortschritt (R9 Performance)
      const dateien: Record<string, Uint8Array> = {};
      const imZeitraum = z.stand.belege.filter((b) => b.datei && b.datum >= zr.von && b.datum <= zr.bis);
      for (const [i, b] of imZeitraum.entries()) {
        setFortschritt(TEXT.steuerpaket_fortschritt_belege(i + 1, imZeitraum.length));
        const bytes = await z.dateiLesen(b.datei!);
        if (bytes) dateien[b.datei!] = bytes;
      }
      // Rechnungen (auch Stornos und Gutschriften) als PDF beilegen – die Kanzlei braucht das Belegbild jeder Ausgangsrechnung
      const rechnungsPdfs: Record<string, Uint8Array> = {};
      const v = vorlageFuer("rechnung");
      const rechnungenImZeitraum = gestellteRechnungen(z.stand).filter((u) => String(u.daten.datum ?? "") >= zr.von && String(u.daten.datum ?? "") <= zr.bis);
      if (v)
        for (const [i, u] of rechnungenImZeitraum.entries()) {
          setFortschritt(TEXT.steuerpaket_fortschritt_pdfs(i + 1, rechnungenImZeitraum.length));
          const bytes = await pdfBytes(ausgabeHtml(z.stand, u, z.pro), pdfDateiname(v, u.daten, heute()), v.querformat).catch(() => null);
          if (bytes) rechnungsPdfs[u.id] = bytes;
        }
      setFortschritt(TEXT.steuerpaket_fortschritt_zip);
      // gezeichnet, bevor das Packen den Thread belegt
      await new Promise((r) => setTimeout(r, 30));
      // E-165: Personenkonten vor dem Paket vergeben und speichern (das Paket vergibt dieselben Nummern) – dauerhaft gleich
      z.personenkontenVergeben();
      const p = steuerpaket(z.stand, zr, sb, dateien, new Date().toISOString(), { rechnungsPdfs });
      setFortschritt(null);
      // R12 GoBD: was im Paket steckt, wird festgeschrieben (ändern nur mit Grund, nie löschen) – die Belege so, wie sie
      // beim Packen im Zeitraum lagen. E-221 Befund 6: nur nach einer Übergabe; auf Android erst nach „Ja, übergeben“
      const ids = z.stand.belege.filter((b) => b.datum >= zr.von && b.datum <= zr.bis).map((b) => b.id);
      const ergebnis = await paketUebergeben({
        teilen: () => dateiTeilenBytes(p.dateiname, p.zip, "application/zip"),
        bestaetigen: () => bestaetigen({ titel: TEXT.e221_paket_frage, text: TEXT.e221_paket_frage_text(ids.length), ja: TEXT.e221_paket_ja, nein: TEXT.e221_paket_nein }),
        festschreiben: () => z.belegeFestschreiben(ids),
        android: ANDROID,
      });
      if (ergebnis === "abgebrochen") return;
      if (ergebnis === "offen") return setOffenesPaket({ ids, name: nameVon(wahl) });
      melden(TEXT.steuerpaket_fertig(p.buchungen));
      if (p.ohneXml) setHinweis(TEXT.steuerpaket_ohne_xml(p.ohneXml));
    } catch {
      setFehler(TEXT.paket_fehler);
    } finally {
      setLaedt(false);
      setFortschritt(null);
    }
  };
  // das Kanzlei-Blatt ruft nach dem Schließen den jeweils aktuellen Stand der Seite auf
  const losRef = useRef(los);
  losRef.current = los;
  const kanzleien = <KanzleienAbschnitt senden={(k) => void losRef.current(k)} kannSenden={Boolean(anzahlR || anzahlB)} pro={z.pro} erste={kanzleienZuerst} />;
  const fehlend = zr ? kassenAbdeckung(z.stand, zr.von, zr.bis) : null;
  const lage = kassenLage(z.stand.profil);
  const kassenVorab = fehlend !== null ? kassenHinweisMit(lage, "ust", fehlend)?.text ?? null : lage !== "keine" && lage !== "unbekannt" ? (lage === "shop" ? TEXT.shop_paket_vorab : TEXT.kasse_paket_vorab) : null;
  return (
    <Unterseite titel={TEXT.steuerpaket_titel} unter={TEXT.steuerpaket_text}>
      <Inhalt>
        {kanzleienZuerst && kanzleienSichtbar() ? <View style={{ marginBottom: 30 }}>{kanzleien}</View> : null}
        <T v="klein" fett>{TEXT.steuerpaket_zeitraum}</T>
        {/* scrollt zum vorausgewählten Zeitraum, mit Seitenrand davor (A16) */}
        <ChipLeiste wert={wahl} aendern={setWahl} optionen={liste.map((x) => ({ wert: x.name, text: nameVon(x.name) }))} stil={{ marginTop: 8 }} />
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
        {/* StB-Prüfung (B-6 u. a.): Kontenvorgaben der Kanzlei – Verrechnungskonto, Gutscheine, Kassendifferenz, Bank, Anlagen */}
        <View style={{ marginTop: 10 }}>
          <TextKnopf symbol="list.number" text={TEXT.stb_kv_einstieg} onPress={() => nav.oeffnen("kontenvorgaben", () => <KontenvorgabenSeite />, true)} />
          <T v="caption" leise>{TEXT.stb_kv_einstieg_text(kontenvorgabenAnzahl(sb.kontenvorgaben))}</T>
        </View>
        <View style={{ marginTop: 14 }}>
          {/* R10 UI: Kasse bzw. Shop laut Check – vor dem Kauf sagen, dass diese Umsätze im Paket fehlen */}
          {/* R12: mit Kassenabschlüssen nur fehlende Tage nennen */}
          {kassenVorab ? <Hinweis art="warnung" symbol="banknote" text={kassenVorab} /> : null}
          {/* R11 (Tischlerei #23): für Gesellschaften mit Bilanz ehrlich sagen, was das Paket ist – eine Zuarbeit, keine Buchführung */}
          {/* StB-Prüfung (A-4): bilanzierende Betriebe bekommen einen Soll-Stapel mit Zahlungseingängen */}
          {bilanzierendeGewinnermittlung(z.stand) ? <Hinweis text={TEXT.stb_paket_bilanz} /> : null}
          {/* StB-Prüfung (A-5): Festschreibung 0 – der Stapel wird beim Import nicht festgeschrieben */}
          <Hinweis text={TEXT.stb_paket_hinweis} />
          {gross ? <Hinweis art="warnung" text={TEXT.steuerpaket_gross(mb)} /> : null}
          {ziel ? <Hinweis symbol="envelope" text={TEXT.kanzlei_senden_ziel(ziel.name, ziel.email)} /> : null}
          {fortschritt ? <Hinweis text={fortschritt} /> : null}
          {hinweis ? <Hinweis text={hinweis} /> : null}
          {offenesPaket ? (
            <View>
              <Hinweis art="warnung" symbol="lock.open" text={TEXT.e221_paket_offen(offenesPaket.name, offenesPaket.ids.length)} />
              <TextKnopf symbol="lock" text={TEXT.e221_paket_doch} onPress={() => { z.belegeFestschreiben(offenesPaket.ids); setOffenesPaket(null); melden(TEXT.e221_paket_fest(offenesPaket.ids.length)); }} />
            </View>
          ) : null}
          {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        </View>
        {kanzleienZuerst ? null : kanzleien}
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.mitPro(gross ? TEXT.trotzdem_erstellen : TEXT.steuerpaket_teilen, z.pro)} symbol="square.and.arrow.up" laedt={laedt} deaktiviert={!anzahlR && !anzahlB} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}
