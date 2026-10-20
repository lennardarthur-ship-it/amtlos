import { memo, useEffect, useRef, useState } from "react";
import { Image, Linking, View } from "react-native";
import { KATEGORIEN, STEUERSAETZE, STEUERSCHULD_ARTEN, ZAHLUNGSWEGE, belegAusERechnung, belegSummen, cent, eRechnungAusPdf, eRechnungLesen, kaeuferFremd, kategorieFuer, steuerschuldBetrag, type Beleg } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { regelwert } from "../pflichten/check";
import { AuswahlZeile } from "../ui/auswahlseite";
import { DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, Schalter, Symbol, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { istIos, useFarben, weich } from "../ui/thema";
import { belegFoto } from "../unterlagen/belegfoto";
import { ausUtf8 } from "../unterlagen/sicherung";
import { dateiTeilenBytes, dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { belegEndgueltigLoeschbar, leererBeleg, neueId } from "../unterlagen/speicher";
import { istKleinunternehmer } from "../unterlagen/steuerpaket";
import { useAmtlos } from "../zustand";
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
          const b = { ...belegAusERechnung(gelesen, neueId(), new Date().toISOString(), { kleinunternehmer: ku, betrieb }), datei: name };
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
    ...(istIos ? [{ symbol: "camera", titel: TEXT.beleg_foto, text: TEXT.beleg_foto_text, los: () => void e.foto(true) }] : []),
    { symbol: "doc.text", titel: TEXT.beleg_datei, text: TEXT.beleg_datei_text, los: () => void e.datei() },
    ...(istIos ? [{ symbol: "photo", titel: TEXT.beleg_aus_fotos, text: undefined as string | undefined, los: () => void e.foto(false) }] : []),
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
  const b = z.stand.belege.find((x) => x.id === id);
  const zRef = useRef(z);
  zRef.current = z;
  // Betragsfelder als Text, damit Eingaben wie „12,“ nicht verloren gehen
  const [betraege, setBetraege] = useState<string[]>(() => (b?.steuer ?? []).map((s) => betragText(s.brutto_cent)));
  // Kleinunternehmer ziehen keine Vorsteuer ab: der Schalter steht dann unter „Weitere Angaben“ (außer er ist an)
  const ku = istKleinunternehmer(z.stand);
  const [vorsteuerOffen, setVorsteuerOffen] = useState(false);
  useEffect(
    () => () => {
      const jetzt = zRef.current.stand.belege.find((x) => x.id === id);
      if (neu && jetzt && !jetzt.lieferant.trim() && !jetzt.datei && !belegSummen(jetzt).brutto_cent) zRef.current.belegLoeschen(id);
    },
    [id, neu],
  );
  if (!b) return <Unterseite titel="">{null}</Unterseite>;
  const setze = (werte: Partial<Beleg>) => z.belegSetzen({ ...b, ...werte });
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
        {b.quelle === "erechnung" ? <Hinweis art="erfolg" text={TEXT.beleg_aus_erechnung} /> : null}
        <Feld label={TEXT.beleg_lieferant} wert={b.lieferant} aendern={(w) => setze({ lieferant: w })} placeholder="z. B. Friseurbedarf Müller" />
        <DatumFeld label={TEXT.beleg_datum} hilfe={TEXT.beleg_datum_hilfe} wert={b.datum} aendern={(d) => d && setze({ datum: d })} />
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
        <Wahl label={TEXT.beleg_zahlung} wert={b.zahlung} aendern={(w) => setze(w === "bar" && !b.bezahlt && b.datum ? { zahlung: w, bezahlt: b.datum } : { zahlung: w })} optionen={ZAHLUNGSWEGE} />
        <DatumFeld label={TEXT.beleg_bezahlt} hilfe={TEXT.beleg_bezahlt_hilfe} wert={b.bezahlt ?? null} aendern={(d) => setze({ bezahlt: d })} />
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
        <TextKnopf
          symbol="trash"
          gefahr
          text={belegEndgueltigLoeschbar(b) ? TEXT.loeschen : TEXT.beleg_ungueltig_knopf}
          onPress={() => {
            const jahre = regelwert("steuern.aufbewahrung.belege_jahre") ?? 8;
            // in der Aufbewahrungsfrist wird nicht gelöscht, sondern mit Grund ungültig markiert (H2)
            const endgueltig = belegEndgueltigLoeschbar(b);
            void bestaetigen(endgueltig ? { titel: TEXT.loeschen_wirklich, text: TEXT.beleg_loeschen_hinweis(jahre), ja: TEXT.loeschen_ja } : { titel: TEXT.beleg_ungueltig_wirklich, text: TEXT.beleg_ungueltig_text(jahre), ja: TEXT.beleg_ungueltig_ja }).then((ok) => {
              if (!ok) return;
              const r = z.belegLoeschen(id, TEXT.beleg_ungueltig_grund);
              melden(r === "ungueltig" ? TEXT.beleg_ungueltig_gesetzt : TEXT.geloescht, "info");
              nav.zurueck();
            });
          }}
          stil={{ marginTop: 24 }}
        />
    </BuehnenBlatt>
  );
}

/** Seite „Beleg erfassen“ – von „Vorlagen“ aus. */
export function BelegErfassenSeite() {
  return (
    <BuehnenBlatt titel={TEXT.beleg_erfassen} unter={TEXT.beleg_erfassen_text}>
      <BelegErfassen />
    </BuehnenBlatt>
  );
}
