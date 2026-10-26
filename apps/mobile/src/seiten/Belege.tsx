import { memo, useEffect, useRef, useState } from "react";
import { Image, Linking, View } from "react-native";
import { ANLAGE_ARTEN, KATEGORIEN, STEUERSAETZE, STEUERSCHULD_ARTEN, ZAHLUNGSWEGE, belegAusERechnung, belegGezahlt, belegSummen, belegTeilabzug, cent, eRechnungAusPdf, eRechnungLesen, kaeuferFremd, kategorieFuer, steuerschuldBetrag, vorsteuerAnteilAus, vorsteuerAufteilung, zeitDe, type Beleg } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { regelwert } from "../pflichten/check";
import { AuswahlZeile } from "../ui/auswahlseite";
import { DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, Schalter, Symbol, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { istNativ, useFarben, weich } from "../ui/thema";
import { belegFoto } from "../unterlagen/belegfoto";
import { ausUtf8 } from "../unterlagen/sicherung";
import { dateiTeilenBytes, dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { BELEG_KONFLIKT_GRUND, belegEndgueltigLoeschbar, leererBeleg, neueId } from "../unterlagen/speicher";
import { istKleinunternehmer } from "../unterlagen/steuerpaket";
import { gemischteUmsaetze, nurSteuerfreieUmsaetze, vorsteuerquoteAus } from "../unterlagen/ustAusRechnungen";
import { useAmtlos } from "../zustand";
import { erstellenErlaubt } from "../pro/regeln";
import { ProSeite } from "./Pro";
import { bestaetigen } from "../ui/bestaetigen";
import { BuehnenBlatt, GrosserBetrag, datumKurz } from "./gemeinsam";
import { useAnsage } from "./felder";

// Formatter einmal anlegen (R9 Performance)
const EURO = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BETRAG = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const euro = (c: number) => `${EURO.format(c / 100)} €`;
const betragText = (c: number) => (c ? BETRAG.format(c / 100) : "");
const endung = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf", xml: "application/xml" };

/**
 * Beleg erfassen (E-133): Foto, Datei (PDF, Bild, E-Rechnung) oder von Hand. Eine E-Rechnung (XRechnung, ZUGFeRD)
 * füllt den Beleg selbst aus; die Originaldatei wird unverändert und verschlüsselt aufbewahrt.
 */
export function useBelegErfassen() {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  // Startwert für „Vorsteuer abziehbar“: aus der Antwort im Pflichten-Check
  const ku = z.stand.profil["ust.kleinunternehmer"] === true;
  // R11: Rechnungsdatum der E-Rechnung in der Kleinunternehmerzeit („Mein Betrieb“) – Vorsteuer aus
  const kuZeit = (datum: string | null) => !!datum && !!z.stand.betrieb.ku_bis && datum <= z.stand.betrieb.ku_bis;
  // Kamera verweigert: bleibender Hinweis mit „Einstellungen öffnen“ statt einer Meldung, die gleich wieder verschwindet
  const [kameraVerweigert, setKameraVerweigert] = useState(false);
  const oeffnen = (b: Beleg, neu: boolean) => nav.oeffnen(`beleg-${b.id}`, () => <BelegSeite id={b.id} neu={neu} />, true);
  const anlegen = (b: Beleg, neu = true) => {
    z.belegSetzen(b);
    oeffnen(b, neu);
  };
  return {
    kameraVerweigert,
    hand: () => anlegen(leererBeleg("hand", null, ku)),
    foto: async (kamera: boolean) => {
      try {
        const bytes = await belegFoto(kamera);
        if (!bytes) return;
        setKameraVerweigert(false);
        anlegen(leererBeleg("foto", await z.dateiSpeichern(bytes, "jpg"), ku));
      } catch (e) {
        if ((e as Error).message === "kamera") setKameraVerweigert(true);
        else melden(TEXT.beleg_fehler, "info");
      }
    },
    datei: async () => {
      try {
        const d = await dateiWaehlenBytes(["application/pdf", "application/xml", "text/xml", "image/*"]);
        if (!d) return;
        const art = endung(d.name) || (d.mime.includes("pdf") ? "pdf" : d.mime.includes("xml") ? "xml" : "jpg");
        const text = art === "xml" ? ausUtf8(d.bytes) : art === "pdf" ? eRechnungAusPdf(d.bytes) : null;
        const gelesen = text ? eRechnungLesen(text) : null;
        const name = await z.dateiSpeichern(d.bytes, art);
        if (gelesen) {
          // R10: Käufer der E-Rechnung gegen „Mein Betrieb“ prüfen – fremd adressiert: Vorsteuer aus, Warnung
          const betrieb = { name: z.stand.betrieb.name, plz: z.stand.betrieb.plz, verantwortlich: z.stand.betrieb.verantwortlich };
          const b = { ...belegAusERechnung(gelesen, neueId(), new Date().toISOString(), { kleinunternehmer: ku || kuZeit(gelesen.datum), nurSteuerfrei: nurSteuerfreieUmsaetze(z.stand.unterlagen, z.stand.betrieb), gemischt: gemischteUmsaetze(z.stand.unterlagen, z.stand.betrieb), vorsteuerquote: vorsteuerquoteAus(z.stand.betrieb), betrieb }), datei: name };
          anlegen(b, false);
          if (kaeuferFremd(gelesen, betrieb)) melden(TEXT.beleg_kaeufer_fremd, "info");
          else melden(TEXT.erechnung_gelesen(gelesen.lieferant.name, euro(gelesen.summen.brutto_cent)));
          return;
        }
        if (art === "xml") melden(TEXT.erechnung_unlesbar, "info");
        anlegen(leererBeleg("foto", name, ku));
      } catch {
        melden(TEXT.beleg_fehler, "info");
      }
    },
  };
}

/** Möglichkeiten zum Erfassen als Karte – auf „Vorlagen“ und in der Ablage. */
export function BelegErfassen({ kompakt }: { kompakt?: boolean }) {
  const e = useBelegErfassen();
  const zeilen = [
    ...(istNativ ? [{ symbol: "camera", titel: TEXT.beleg_foto, text: TEXT.beleg_foto_text, los: () => void e.foto(true) }] : []),
    { symbol: "doc.text", titel: TEXT.beleg_datei, text: TEXT.beleg_datei_text, los: () => void e.datei() },
    ...(istNativ ? [{ symbol: "photo", titel: TEXT.beleg_aus_fotos, text: undefined as string | undefined, los: () => void e.foto(false) }] : []),
    { symbol: "pencil", titel: TEXT.beleg_hand, text: kompakt ? undefined : TEXT.beleg_hand_text, los: e.hand },
  ];
  return (
    <View>
      {e.kameraVerweigert ? <KameraVerweigert /> : null}
      <Karte>
        {zeilen.map((z, i) => (
          <Zeile key={z.titel} symbol={z.symbol} titel={z.titel} text={z.text} onPress={z.los} letzte={i === zeilen.length - 1} />
        ))}
      </Karte>
    </View>
  );
}

/** Kein Zugriff auf die Kamera: bleibt stehen, bis ein Foto klappt – mit Sprung in die Einstellungen der App. */
function KameraVerweigert() {
  useAnsage(TEXT.beleg_kamera_verweigert);
  return (
    <View style={{ marginBottom: 8 }}>
      <Hinweis art="warnung" symbol="camera" text={TEXT.beleg_kamera_verweigert} />
      <TextKnopf symbol="gearshape" text={TEXT.einstellungen_oeffnen} onPress={() => void Linking.openSettings().catch(() => undefined)} />
    </View>
  );
}

/** Zeile in Listen: Lieferant, Datum, Betrag, Kategorie bzw. was fehlt. `onPress` bekommt die ID (gleichbleibende Funktion, memo). */
export const BelegZeile = memo(function BelegZeile({ b, letzte, onPress }: { b: Beleg; letzte: boolean; onPress: (id: string) => void }) {
  const s = belegSummen(b);
  const unvollstaendig = !b.lieferant.trim() || !s.brutto_cent;
  return (
    <Zeile
      symbol={b.quelle === "erechnung" ? "doc.text" : b.datei ? "doc.viewfinder" : "pencil"} ton={unvollstaendig ? "bald" : "amt"}
      titel={b.lieferant.trim() || TEXT.beleg_ohne_lieferant}
      text={`${datumKurz(`${b.datum}T12:00:00Z`)} · ${unvollstaendig ? TEXT.beleg_unvollstaendig : kategorieFuer(b.kategorie).titel}`}
      wert={s.brutto_cent ? euro(s.brutto_cent) : undefined}
      onPress={() => onPress(b.id)}
      letzte={letzte}
    />
  );
});

/** Vorschau der Belegdatei: Foto als Bild, sonst Name mit „Original teilen“. */
function DateiVorschau({ b }: { b: Beleg }) {
  const z = useAmtlos();
  const f = useFarben();
  const [bild, setBild] = useState<string | null>(null);
  const art = endung(b.datei ?? "");
  useEffect(() => {
    if (!b.datei || !["jpg", "jpeg", "png"].includes(art)) return;
    let aktiv = true;
    let entfernen: (() => void) | null = null;
    // als vorübergehende Datei statt data-URI: kein weiteres Base64 des ganzen Fotos (R9 Performance); beim Verlassen weg
    void z.dateiAnzeigen(b.datei, MIME[art] ?? "application/octet-stream").then((a) => {
      if (!a) return;
      if (!aktiv) return a.entfernen();
      entfernen = a.entfernen;
      setBild(a.uri);
    });
    return () => {
      aktiv = false;
      entfernen?.();
    };
  }, [b.datei, art]);
  if (!b.datei) return null;
  const teilen = async () => {
    const bytes = await z.dateiLesen(b.datei!);
    if (bytes) await dateiTeilenBytes(`Beleg-${b.datum}.${art}`, bytes, MIME[art] ?? "application/octet-stream").catch(() => undefined);
  };
  return (
    <Karte stil={{ marginTop: 12, paddingVertical: 12, gap: 8 }}>
      {bild ? <Image source={{ uri: bild }} style={{ width: "100%", height: 260, borderRadius: 8, backgroundColor: f.papier }} resizeMode="contain" accessibilityLabel={TEXT.beleg_foto_label} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Symbol name={b.quelle === "erechnung" ? "doc.text" : art === "pdf" ? "doc.richtext" : "photo"} groesse={20} farbe={f.amt} />
        <T v="klein" stil={{ flex: 1 }}>{b.quelle === "erechnung" ? TEXT.beleg_original_erechnung(art.toUpperCase()) : TEXT.beleg_original(art.toUpperCase())}</T>
        <TextKnopf text={TEXT.beleg_teilen} onPress={() => void teilen()} />
      </View>
    </Karte>
  );
}

/** Einen Beleg bearbeiten. Ein neuer Beleg ohne Angaben und ohne Datei verschwindet beim Verlassen wieder. */
export function BelegSeite({ id, neu }: { id: string; neu?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const f = useFarben();
  const gespeichert = z.stand.belege.find((x) => x.id === id);
  // R12 GoBD: festgeschriebener Beleg – Änderungen nur als Korrektur mit Grund (Entwurf bis „Korrektur speichern“)
  const [entwurf, setEntwurf] = useState<Beleg | null>(null);
  const [grund, setGrund] = useState("");
  const [grundFehler, setGrundFehler] = useState(false);
  const [ungueltigGrund, setUngueltigGrund] = useState("");
  const fest = Boolean(gespeichert?.festgeschrieben);
  const gesperrt = fest && !entwurf;
  const b = entwurf ?? gespeichert;
  const zRef = useRef(z);
  zRef.current = z;
  // Betragsfelder als Text, damit Eingaben wie „12,“ nicht verloren gehen
  const [betraege, setBetraege] = useState<string[]>(() => (b?.steuer ?? []).map((s) => betragText(s.brutto_cent)));
  // Kleinunternehmer ziehen keine Vorsteuer ab: der Schalter steht dann unter „Weitere Angaben“ (außer er ist an)
  const ku = istKleinunternehmer(z.stand);
  const kuBis = (z.stand.betrieb.ku_bis ?? "").trim();
  const [vorsteuerOffen, setVorsteuerOffen] = useState(false);
  // E-165: steuerfreie und steuerpflichtige Umsätze – Hinweis „voll nur bei rein steuerpflichtiger Verwendung“
  const gemischt = gemischteUmsaetze(z.stand.unterlagen, z.stand.betrieb);
  // R12: Skonto beim Bezahlen als Text, damit „4,“ beim Tippen nicht verloren geht
  const [skontoText, setSkontoText] = useState(() => betragText(b?.skonto_cent ?? 0));
  useEffect(
    () => () => {
      const jetzt = zRef.current.stand.belege.find((x) => x.id === id);
      if (neu && jetzt && !jetzt.lieferant.trim() && !jetzt.datei && !belegSummen(jetzt).brutto_cent) zRef.current.belegLoeschen(id);
    },
    [id, neu],
  );
  if (!b) return <Unterseite titel="">{null}</Unterseite>;
  const setze = (werte: Partial<Beleg>) => (fest ? (entwurf ? setEntwurf({ ...entwurf, ...werte }) : undefined) : void z.belegSetzen({ ...b, ...werte }));
  const korrekturSpeichern = () => {
    if (!entwurf) return;
    if (!z.belegSetzen(entwurf, grund)) return setGrundFehler(true);
    melden(TEXT.r12g_beleg_korrigiert);
    setEntwurf(null);
    setGrund("");
    setGrundFehler(false);
  };
  const s = belegSummen(b);
  const k = kategorieFuer(b.kategorie);
  const betragSetzen = (i: number, text: string) => {
    const neuTexte = betraege.map((x, j) => (j === i ? text : x));
    setBetraege(neuTexte);
    setze({ steuer: b.steuer.map((x, j) => (j === i ? { ...x, brutto_cent: cent(text) ?? 0 } : x)) });
  };
  return (
    <BuehnenBlatt
      titel={neu ? TEXT.beleg_neu : TEXT.beleg_titel}
      buehne={
        <View style={{ gap: 2 }}>
          <T v="klein" farbe={f.buehneLeise}>{b.lieferant.trim() || TEXT.brutto}</T>
          <GrosserBetrag cent={s.brutto_cent} groesse={44} />
        </View>
      }
      fuss={
        entwurf ? (
          <Fuss ueber={<Feld label={TEXT.r12g_beleg_grund} hilfe={TEXT.r12g_beleg_grund_hilfe} wert={grund} aendern={(w) => { setGrund(w); setGrundFehler(false); }} fehler={grundFehler ? TEXT.r12g_grund_kurz : null} />}>
            <Knopf ton text={TEXT.abbrechen} onPress={() => { setEntwurf(null); setGrund(""); }} stil={{ flex: 1 }} />
            <Knopf symbol="checkmark" text={TEXT.r12g_beleg_korrektur_speichern} onPress={korrekturSpeichern} stil={{ flex: 1 }} />
          </Fuss>
        ) :
        <Fuss>
          <Knopf
            text={TEXT.fertig}
            onPress={() => {
              // sagen, dass und was gespeichert ist – man landet sonst ohne Rückmeldung wieder auf „Beleg erfassen“
              if (b.lieferant.trim() || s.brutto_cent) melden(TEXT.beleg_gespeichert([b.lieferant.trim(), s.brutto_cent ? euro(s.brutto_cent) : ""].filter(Boolean).join(", ")));
              // ein neuer Beleg ohne Angaben und ohne Datei verschwindet beim Verlassen – das nicht still tun
              else if (neu && !b.datei) melden(TEXT.beleg_nichts_gespeichert, "info");
              nav.zurueck();
            }}
            stil={{ flex: 1 }}
          />
        </Fuss>
      }
    >
        <DateiVorschau b={b} />
        {/* R12 GoBD: feste Belegnummer und Erfassungszeitpunkt; festgeschrieben nur mit Grund änderbar */}
        {b.nr ? <T v="caption" leise stil={{ marginTop: 6 }}>{TEXT.r12g_beleg_nr(b.nr, zeitDe(b.erstellt))}</T> : null}
        {fest && gespeichert?.festgeschrieben ? <Hinweis art="info" symbol="lock" text={TEXT.r12g_beleg_fest(zeitDe(gespeichert.festgeschrieben))} /> : null}
        {gesperrt ? <Knopf ton symbol="pencil" text={TEXT.r12g_beleg_korrigieren} onPress={() => setEntwurf(gespeichert!)} stil={{ marginTop: 8 }} /> : null}
        {b.quelle === "erechnung" ? <Hinweis art="erfolg" text={TEXT.beleg_aus_erechnung} /> : null}
        <View pointerEvents={gesperrt ? "none" : "auto"} style={gesperrt ? { opacity: 0.6 } : undefined}>
        <Feld label={TEXT.beleg_lieferant} wert={b.lieferant} aendern={(w) => setze({ lieferant: w })} placeholder="z. B. Friseurbedarf Müller" />
        {/* R11 (Kosmetik #8): Belegdatum in der Kleinunternehmerzeit – Vorsteuer aus (lässt sich wieder einschalten) */}
        <DatumFeld label={TEXT.beleg_datum} hilfe={TEXT.beleg_datum_hilfe} wert={b.datum} aendern={(d) => d && setze(kuBis && d <= kuBis && d !== b.datum && b.vorsteuer ? { datum: d, vorsteuer: false } : { datum: d })} />
        {kuBis && b.datum <= kuBis ? <Hinweis art={b.vorsteuer ? "warnung" : "info"} text={TEXT.beleg_ku_zeit(`${kuBis.slice(8, 10)}.${kuBis.slice(5, 7)}.${kuBis.slice(0, 4)}`)} /> : null}
        <Feld label={TEXT.beleg_nummer} wert={b.nummer ?? ""} aendern={(w) => setze({ nummer: w || null })} />
        {b.steuer.map((x, i) => (
          <View key={i}>
            <Feld label={b.steuer.length > 1 ? TEXT.beleg_betrag_satz(x.satz) : TEXT.beleg_betrag} wert={betraege[i] ?? ""} aendern={(w) => betragSetzen(i, w)} keyboardType="decimal-pad" placeholder="0,00" fehler={(betraege[i] ?? "").trim() && cent(betraege[i]!) === null ? TEXT.betrag_falsch : null} />
            <Wahl label={TEXT.beleg_satz} wert={String(x.satz) as "19" | "7" | "0"} aendern={(w) => setze({ steuer: b.steuer.map((y, j) => (j === i ? { ...y, satz: Number(w) } : y)) })} optionen={STEUERSAETZE.map((p) => ({ wert: String(p) as "19" | "7" | "0", text: `${p} %` }))} />
            {b.steuer.length > 1 ? <TextKnopf symbol="xmark" leise text={TEXT.entfernen} label={TEXT.satz_entfernen(x.satz)} onPress={() => { weich(); setBetraege(betraege.filter((_, j) => j !== i)); setze({ steuer: b.steuer.filter((_, j) => j !== i) }); }} /> : null}
          </View>
        ))}
        {b.steuer.length < 3 ? <TextKnopf symbol="plus" text={TEXT.beleg_weiterer_satz} onPress={() => { weich(); setBetraege([...betraege, ""]); setze({ steuer: [...b.steuer, { satz: b.steuer.some((x) => x.satz === 7) ? 0 : 7, brutto_cent: 0 }] }); }} stil={{ marginTop: 6 }} /> : null}
        <Karte stil={{ marginTop: 14, paddingVertical: 10 }}>
          {[
            [TEXT.netto, euro(s.netto_cent)],
            [TEXT.ust, euro(s.ust_cent)],
            [TEXT.brutto, euro(s.brutto_cent)],
          ].map(([a, w], i) => (
            <View key={a} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
              <T fett={i === 2}>{a}</T>
              <T fett={i === 2}>{w}</T>
            </View>
          ))}
        </Karte>
        {ku ? null : <Schalter label={TEXT.beleg_vorsteuer} hilfe={TEXT.beleg_vorsteuer_hilfe} wert={b.vorsteuer} aendern={(w) => setze({ vorsteuer: w })} />}
        {/* E-165 (StB-Prüfung 5.2): Vorsteuer voll oder anteilig abziehbar (§ 15 Abs. 4 UStG) */}
        {!ku && b.vorsteuer ? <VorsteuerTeil b={b} setze={setze} gemischt={gemischt} /> : null}
        {/* R10: § 13b als Leistungsempfänger – auch für Kleinunternehmer */}
        <Schalter label={TEXT.beleg_steuerschuld} hilfe={TEXT.beleg_steuerschuld_hilfe} wert={!!b.steuerschuld} aendern={(w) => setze({ steuerschuld: w ? (b.steuerschuld ?? "eu") : null })} />
        {b.steuerschuld ? (
          <View>
            <Wahl label={TEXT.beleg_steuerschuld_art} wert={b.steuerschuld} aendern={(w) => setze({ steuerschuld: w })} optionen={STEUERSCHULD_ARTEN} />
            <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.beleg_steuerschuld_betrag(euro(steuerschuldBetrag(b)))}</T>
          </View>
        ) : null}
        <AuswahlZeile label={TEXT.beleg_kategorie} wert={b.kategorie} aendern={(w) => setze({ kategorie: w })} optionen={KATEGORIEN.map((x) => ({ wert: x.id, text: x.titel }))} />
        {k.hinweis ? <T v="caption" leise stil={{ marginTop: 4 }}>{k.hinweis}</T> : null}
        {/* StB-Prüfung (B-10): Anlagenkonto nach Art des Anlageguts */}
        {k.anlage ? <Wahl label={TEXT.stb_anlage_art} hilfe={TEXT.stb_anlage_art_hilfe} wert={b.anlage_art ?? "bga"} aendern={(w) => setze({ anlage_art: w })} optionen={ANLAGE_ARTEN} /> : null}
        <Wahl label={TEXT.beleg_zahlung} wert={b.zahlung} aendern={(w) => setze(w === "bar" && !b.bezahlt && b.datum ? { zahlung: w, bezahlt: b.datum } : { zahlung: w })} optionen={ZAHLUNGSWEGE} />
        <DatumFeld label={TEXT.beleg_bezahlt} hilfe={TEXT.beleg_bezahlt_hilfe} wert={b.bezahlt ?? null} aendern={(d) => setze({ bezahlt: d })} />
        {/* R12: beim Bezahlen abgezogenes Skonto – mindert die Vorsteuer im Monat der Zahlung (§ 17 UStG) */}
        {b.steuerschuld ? null : (
          <View>
            <Feld label={TEXT.r12_beleg_skonto} hilfe={TEXT.r12_beleg_skonto_hilfe} wert={skontoText} aendern={(w) => { setSkontoText(w); const c = cent(w); setze({ skonto_cent: c && c > 0 && c < s.brutto_cent ? c : null }); }} keyboardType="decimal-pad" placeholder="0,00" optional fehler={skontoText.trim() && (cent(skontoText) === null || (cent(skontoText) ?? 0) >= s.brutto_cent) ? TEXT.betrag_falsch : null} />
            {b.skonto_cent ? <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.r12_beleg_gezahlt(euro(belegGezahlt(b)))}</T> : null}
          </View>
        )}
        <Feld label={TEXT.beleg_notiz} wert={b.notiz ?? ""} aendern={(w) => setze({ notiz: w || null })} mehrzeilig />
        {ku ? (
          <View style={{ marginTop: 14 }}>
            <T v="caption" leise>{TEXT.beleg_ku_keine_vorsteuer}</T>
            {vorsteuerOffen || b.vorsteuer ? (
              <Schalter label={TEXT.beleg_vorsteuer} hilfe={TEXT.beleg_vorsteuer_hilfe} wert={b.vorsteuer} aendern={(w) => setze({ vorsteuer: w })} />
            ) : (
              <TextKnopf symbol="chevron.down" text={TEXT.weitere_angaben(1)} erweitert={false} onPress={() => { weich(); setVorsteuerOffen(true); }} />
            )}
          </View>
        ) : null}
        </View>
        {/* R12 GoBD: Änderungsprotokoll des Belegs */}
        {b.historie?.length ? (
          <View style={{ marginTop: 18, gap: 4 }}>
            <T v="klein" fett accessibilityRole="header">{TEXT.r12g_beleg_protokoll}</T>
            {/* E-214: nicht übernommene Korrektur mit Regel, Gerät und ihrem eigenen Grund */}
            {[...b.historie].reverse().map((h, i) => <T key={`${h.bis}-${i}`} v="caption" leise>{TEXT.r12g_beleg_fassung(zeitDe(h.bis), `${h.lieferant || "ohne Lieferant"}, ${euro(h.steuer.reduce((a, x) => a + x.brutto_cent, 0))}, ${kategorieFuer(h.kategorie).titel}`, h.grund === BELEG_KONFLIKT_GRUND ? TEXT.e214_konflikt_grund(h.grund, h.vorrang === "eingang", h.geraet ?? null, h.korrektur_grund ?? null) : (h.grund ?? null))}</T>)}
          </View>
        ) : null}
        {entwurf || belegEndgueltigLoeschbar(b) ? null : <Feld label={TEXT.r12g_beleg_ungueltig_grund} hilfe={TEXT.r12g_beleg_ungueltig_grund_hilfe} wert={ungueltigGrund} aendern={setUngueltigGrund} optional />}
        {entwurf ? null : <TextKnopf
          symbol="trash"
          gefahr
          text={belegEndgueltigLoeschbar(b) ? TEXT.loeschen : TEXT.beleg_ungueltig_knopf}
          onPress={() => {
            const jahre = regelwert("steuern.aufbewahrung.belege_jahre") ?? 8;
            // in der Aufbewahrungsfrist wird nicht gelöscht, sondern mit Grund ungültig markiert (H2)
            const endgueltig = belegEndgueltigLoeschbar(b);
            void bestaetigen(endgueltig ? { titel: TEXT.loeschen_wirklich, text: TEXT.beleg_loeschen_hinweis(jahre), ja: TEXT.loeschen_ja } : { titel: TEXT.beleg_ungueltig_wirklich, text: TEXT.beleg_ungueltig_text(jahre), ja: TEXT.beleg_ungueltig_ja }).then((ok) => {
              if (!ok) return;
              const r = z.belegLoeschen(id, ungueltigGrund.trim() || TEXT.beleg_ungueltig_grund);
              melden(r === "ungueltig" ? TEXT.beleg_ungueltig_gesetzt : TEXT.geloescht, "info");
              nav.zurueck();
            });
          }}
          stil={{ marginTop: 24 }}
        />}
    </BuehnenBlatt>
  );
}

/**
 * E-165 (StB-Prüfung 5.2): Vorsteuer eines Belegs voll oder anteilig abziehbar – Anteil in Prozent oder als Betrag.
 * Darunter, was abziehbar ist und was als Ausgabe zählt. Bei gemischten Umsätzen ein Hinweis, solange „voll“ gewählt ist.
 */
function VorsteuerTeil({ b, setze, gemischt }: { b: Beleg; setze: (w: Partial<Beleg>) => void; gemischt: boolean }) {
  const teile = vorsteuerAufteilung(b);
  const ust = teile.reduce((a, x) => a + x.ust_cent, 0);
  const [anteilig, setAnteilig] = useState(() => belegTeilabzug(b));
  const [art, setArt] = useState<"prozent" | "betrag">(() => (b.vorsteuer_betrag_cent ? "betrag" : "prozent"));
  const [prozentText, setProzentText] = useState(() => (b.vorsteuer_anteil ? String(b.vorsteuer_anteil).replace(".", ",") : ""));
  const [betragTextV, setBetragTextV] = useState(() => betragText(b.vorsteuer_betrag_cent ?? 0));
  if (!ust) return null;
  const abziehbar = teile.reduce((a, x) => a + x.abziehbar_cent, 0);
  const betragFalsch = betragTextV.trim() !== "" && (() => {
    const c = cent(betragTextV);
    return c === null || c <= 0 || c >= ust;
  })();
  return (
    <View>
      <Wahl
        label={TEXT.beleg_vst_umfang}
        wert={anteilig ? "anteilig" : "voll"}
        aendern={(w) => {
          setAnteilig(w === "anteilig");
          if (w === "voll") setze({ vorsteuer_anteil: null, vorsteuer_betrag_cent: null });
        }}
        optionen={[
          { wert: "voll" as const, text: TEXT.beleg_vst_voll },
          { wert: "anteilig" as const, text: TEXT.beleg_vst_anteilig },
        ]}
      />
      {anteilig ? (
        <View>
          <Wahl
            label={TEXT.beleg_vst_art}
            wert={art}
            aendern={(w) => {
              setArt(w);
              // umrechnen, damit der Anteil beim Wechsel erhalten bleibt (13 % → 29,34 € und umgekehrt)
              const teil = belegTeilabzug(b) && abziehbar > 0 && abziehbar < ust;
              if (w === "prozent") {
                const text = prozentText.trim() || (teil ? String(Math.round((abziehbar / ust) * 10000) / 100).replace(".", ",") : "");
                setProzentText(text);
                setze({ vorsteuer_betrag_cent: null, vorsteuer_anteil: vorsteuerAnteilAus(text) });
              } else {
                const text = betragTextV.trim() || (teil ? betragText(abziehbar) : "");
                setBetragTextV(text);
                const c = cent(text);
                setze({ vorsteuer_anteil: null, vorsteuer_betrag_cent: c && c > 0 && c < ust ? c : null });
              }
            }}
            optionen={[
              { wert: "prozent" as const, text: TEXT.beleg_vst_prozent },
              { wert: "betrag" as const, text: TEXT.beleg_vst_betrag },
            ]}
          />
          {art === "prozent" ? (
            <Feld label={TEXT.beleg_vst_anteil} hilfe={TEXT.beleg_vst_anteil_hilfe} wert={prozentText} aendern={(w) => { setProzentText(w); setze({ vorsteuer_betrag_cent: null, vorsteuer_anteil: vorsteuerAnteilAus(w) }); }} keyboardType="decimal-pad" placeholder="z. B. 13" fehler={prozentText.trim() && vorsteuerAnteilAus(prozentText) === null ? TEXT.beleg_vst_anteil_falsch : null} />
          ) : (
            <Feld label={TEXT.beleg_vst_betrag_feld} hilfe={TEXT.beleg_vst_anteil_hilfe} wert={betragTextV} aendern={(w) => { setBetragTextV(w); const c = cent(w); setze({ vorsteuer_anteil: null, vorsteuer_betrag_cent: c && c > 0 && c < ust ? c : null }); }} keyboardType="decimal-pad" placeholder="0,00" fehler={betragFalsch ? TEXT.beleg_vst_betrag_falsch(euro(ust)) : null} />
          )}
          <T v="caption" leise stil={{ marginTop: 4 }}>{belegTeilabzug(b) ? TEXT.beleg_vst_ergebnis(euro(abziehbar), euro(ust - abziehbar)) : TEXT.beleg_vst_anteil_fehlt}</T>
        </View>
      ) : gemischt ? (
        <Hinweis art="warnung" text={TEXT.beleg_vst_gemischt} />
      ) : null}
    </View>
  );
}

/** R12 GoBD: ungültig markierte Belege mit Grund – in der Belegliste einsehbar (Nummernlücken erklären sich). */
export function UngueltigeBelege() {
  const z = useAmtlos();
  const [offen, setOffen] = useState(false);
  const l = z.stand.belegArchiv;
  if (!l.length) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <TextKnopf symbol={offen ? "chevron.up" : "chevron.down"} text={TEXT.r12g_belege_ungueltig(l.length)} erweitert={offen} onPress={() => setOffen(!offen)} />
      {offen ? (
        <Karte>
          {l.map((b, i) => <Zeile key={b.id} symbol="xmark.circle" titel={`${b.nr ? `${b.nr} · ` : ""}${b.lieferant.trim() || TEXT.brutto}`} text={TEXT.r12g_beleg_ungueltig_zeile(b.ungueltig ? zeitDe(b.ungueltig) : "–", b.ungueltig_grund ?? "")} wert={euro(belegSummen(b).brutto_cent)} letzte={i === l.length - 1} />)}
        </Karte>
      ) : null}
    </View>
  );
}

/**
 * Seite „Beleg erfassen“ – von „Heute“, „Neu erstellen“ und „Unterlagen“ aus. E-188: einen neuen Beleg erfassen (auch
 * aus einer empfangenen E-Rechnung) gehört zu Pro – ohne Pro steht hier der Bezahlschirm mit Anlass. Vorhandene Belege
 * bleiben in „Unterlagen“ ansehbar, bearbeitbar und exportierbar.
 */
export function BelegErfassenSeite() {
  const z = useAmtlos();
  if (!erstellenErlaubt(z.pro)) return <ProSeite grund="belege" />;
  return (
    <BuehnenBlatt titel={TEXT.beleg_erfassen} unter={TEXT.beleg_erfassen_text}>
      <BelegErfassen />
    </BuehnenBlatt>
  );
}
