import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { KATEGORIEN, STEUERSAETZE, ZAHLUNGSWEGE, belegAusERechnung, belegSummen, cent, eRechnungAusPdf, eRechnungLesen, kategorieFuer, type Beleg } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { regelwert } from "../pflichten/check";
import { AuswahlZeile } from "../ui/auswahlseite";
import { DatumFeld, Feld, Fuss, Hinweis, Karte, Knopf, Schalter, Symbol, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, istIos, useFarben, weich } from "../ui/thema";
import { belegFoto } from "../unterlagen/belegfoto";
import { ausUtf8, base64 } from "../unterlagen/sicherung";
import { dateiTeilenBytes, dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { heute, neueId } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt, datumKurz } from "./gemeinsam";

const euro = (c: number) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100)} €`;
const betragText = (c: number) => (c ? new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(c / 100) : "");
const endung = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf", xml: "application/xml" };

/** Neuer, leerer Beleg (von Hand oder mit Foto). */
function leererBeleg(quelle: Beleg["quelle"], datei: string | null): Beleg {
  const jetzt = new Date().toISOString();
  return { id: neueId(), datum: heute(), lieferant: "", nummer: null, kategorie: "sonstiges", steuer: [{ satz: 19, brutto_cent: 0 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei, quelle, erstellt: jetzt, geaendert: jetzt };
}

/**
 * Beleg erfassen (E-133): Foto, Datei (PDF, Bild, E-Rechnung) oder von Hand. Eine E-Rechnung (XRechnung, ZUGFeRD)
 * füllt den Beleg selbst aus; die Originaldatei wird unverändert und verschlüsselt aufbewahrt.
 */
export function useBelegErfassen() {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const oeffnen = (b: Beleg, neu: boolean) => nav.oeffnen(`beleg-${b.id}`, () => <BelegSeite id={b.id} neu={neu} />, true);
  const anlegen = (b: Beleg, neu = true) => {
    z.belegSetzen(b);
    oeffnen(b, neu);
  };
  return {
    hand: () => anlegen(leererBeleg("hand", null)),
    foto: async (kamera: boolean) => {
      try {
        const bytes = await belegFoto(kamera);
        if (!bytes) return;
        anlegen(leererBeleg("foto", await z.dateiSpeichern(bytes, "jpg")));
      } catch (e) {
        melden((e as Error).message === "kamera" ? TEXT.beleg_kamera_verweigert : TEXT.beleg_fehler, "info");
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
          const b = { ...belegAusERechnung(gelesen, neueId(), new Date().toISOString()), datei: name };
          anlegen(b, false);
          melden(TEXT.erechnung_gelesen(gelesen.lieferant.name, euro(gelesen.summen.brutto_cent)));
          return;
        }
        if (art === "xml") melden(TEXT.erechnung_unlesbar, "info");
        anlegen(leererBeleg("foto", name));
      } catch {
        melden(TEXT.beleg_fehler, "info");
      }
    },
  };
}

/** Möglichkeiten zum Erfassen als Karte – auf „Vorlagen“ und in der Ablage. */
export function BelegErfassen({ kompakt }: { kompakt?: boolean }) {
  const f = useFarben();
  const e = useBelegErfassen();
  const zeilen = [
    ...(istIos ? [{ symbol: "camera", titel: TEXT.beleg_foto, text: TEXT.beleg_foto_text, los: () => void e.foto(true) }] : []),
    { symbol: "doc.text", titel: TEXT.beleg_datei, text: TEXT.beleg_datei_text, los: () => void e.datei() },
    ...(istIos ? [{ symbol: "photo", titel: TEXT.beleg_aus_fotos, text: undefined as string | undefined, los: () => void e.foto(false) }] : []),
    { symbol: "pencil", titel: TEXT.beleg_hand, text: kompakt ? undefined : TEXT.beleg_hand_text, los: e.hand },
  ];
  return (
    <Karte>
      {zeilen.map((z, i) => (
        <Zeile key={z.titel} links={<Symbol name={z.symbol} groesse={22} farbe={f.amt} />} titel={z.titel} text={z.text} onPress={z.los} letzte={i === zeilen.length - 1} />
      ))}
    </Karte>
  );
}

/** Zeile in Listen: Lieferant, Datum, Betrag, Kategorie bzw. was fehlt. */
export function BelegZeile({ b, letzte, onPress }: { b: Beleg; letzte: boolean; onPress: () => void }) {
  const f = useFarben();
  const s = belegSummen(b);
  const unvollstaendig = !b.lieferant.trim() || !s.brutto_cent;
  return (
    <Zeile
      links={<Symbol name={b.quelle === "erechnung" ? "doc.text" : b.datei ? "doc.viewfinder" : "pencil"} groesse={22} farbe={unvollstaendig ? f.bald : f.amt} />}
      titel={b.lieferant.trim() || TEXT.beleg_ohne_lieferant}
      text={`${datumKurz(`${b.datum}T12:00:00Z`)} · ${euro(s.brutto_cent)} · ${unvollstaendig ? TEXT.beleg_unvollstaendig : kategorieFuer(b.kategorie).titel}`}
      onPress={onPress}
      letzte={letzte}
    />
  );
}

/** Vorschau der Belegdatei: Foto als Bild, sonst Name mit „Original teilen“. */
function DateiVorschau({ b }: { b: Beleg }) {
  const z = useAmtlos();
  const f = useFarben();
  const [bild, setBild] = useState<string | null>(null);
  const art = endung(b.datei ?? "");
  useEffect(() => {
    if (!b.datei || !["jpg", "jpeg", "png"].includes(art)) return;
    let aktiv = true;
    void z.dateiLesen(b.datei).then((bytes) => aktiv && bytes && setBild(`data:${MIME[art]};base64,${base64(bytes)}`));
    return () => {
      aktiv = false;
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
  const [frage, setFrage] = useState(false);
  const b = z.stand.belege.find((x) => x.id === id);
  const zRef = useRef(z);
  zRef.current = z;
  // Betragsfelder als Text, damit Eingaben wie „12,“ nicht verloren gehen
  const [betraege, setBetraege] = useState<string[]>(() => (b?.steuer ?? []).map((s) => betragText(s.brutto_cent)));
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
    <Unterseite titel={b.lieferant.trim() || TEXT.beleg_neu}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 4, paddingBottom: 32 }}>
        <DateiVorschau b={b} />
        {b.quelle === "erechnung" ? <Hinweis art="erfolg" text={TEXT.beleg_aus_erechnung} /> : null}
        <Feld label={TEXT.beleg_lieferant} wert={b.lieferant} aendern={(w) => setze({ lieferant: w })} placeholder="z. B. Friseurbedarf Müller" />
        <DatumFeld label={TEXT.beleg_datum} hilfe={TEXT.beleg_datum_hilfe} wert={b.datum} aendern={(d) => d && setze({ datum: d })} />
        <Feld label={TEXT.beleg_nummer} wert={b.nummer ?? ""} aendern={(w) => setze({ nummer: w || null })} />
        {b.steuer.map((x, i) => (
          <View key={i}>
            <Feld label={b.steuer.length > 1 ? TEXT.beleg_betrag_satz(x.satz) : TEXT.beleg_betrag} wert={betraege[i] ?? ""} aendern={(w) => betragSetzen(i, w)} keyboardType="decimal-pad" placeholder="0,00" fehler={(betraege[i] ?? "").trim() && cent(betraege[i]!) === null ? TEXT.betrag_falsch : null} />
            <Wahl label={TEXT.beleg_satz} wert={String(x.satz) as "19" | "7" | "0"} aendern={(w) => setze({ steuer: b.steuer.map((y, j) => (j === i ? { ...y, satz: Number(w) } : y)) })} optionen={STEUERSAETZE.map((p) => ({ wert: String(p) as "19" | "7" | "0", text: `${p} %` }))} />
            {b.steuer.length > 1 ? <TextKnopf symbol="xmark" leise text={TEXT.entfernen} onPress={() => { weich(); setBetraege(betraege.filter((_, j) => j !== i)); setze({ steuer: b.steuer.filter((_, j) => j !== i) }); }} /> : null}
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
              <T fett={i === 2} stil={{ fontVariant: ["tabular-nums"] }}>{w}</T>
            </View>
          ))}
        </Karte>
        <Schalter label={TEXT.beleg_vorsteuer} hilfe={TEXT.beleg_vorsteuer_hilfe} wert={b.vorsteuer} aendern={(w) => setze({ vorsteuer: w })} />
        <AuswahlZeile label={TEXT.beleg_kategorie} wert={b.kategorie} aendern={(w) => setze({ kategorie: w })} optionen={KATEGORIEN.map((x) => ({ wert: x.id, text: x.titel }))} />
        {k.hinweis ? <T v="caption" leise stil={{ marginTop: 4 }}>{k.hinweis}</T> : null}
        <Wahl label={TEXT.beleg_zahlung} wert={b.zahlung} aendern={(w) => setze({ zahlung: w })} optionen={ZAHLUNGSWEGE} />
        <DatumFeld label={TEXT.beleg_bezahlt} hilfe={TEXT.beleg_bezahlt_hilfe} wert={b.bezahlt ?? null} aendern={(d) => setze({ bezahlt: d })} />
        <Feld label={TEXT.beleg_notiz} wert={b.notiz ?? ""} aendern={(w) => setze({ notiz: w || null })} mehrzeilig />
        {frage ? (
          <Karte stil={{ paddingVertical: 14, gap: 10, marginTop: 24 }}>
            <T fett>{TEXT.loeschen_wirklich}</T>
            <T v="klein" leise>{TEXT.beleg_loeschen_hinweis(regelwert("steuern.aufbewahrung.belege_jahre") ?? 8)}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf
                gefahr
                text={TEXT.loeschen_ja}
                onPress={() => {
                  z.belegLoeschen(id);
                  melden(TEXT.geloescht, "info");
                  nav.zurueck();
                }}
                stil={{ flex: 1 }}
              />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <TextKnopf symbol="trash" gefahr text={TEXT.loeschen} onPress={() => { weich(); setFrage(true); }} stil={{ marginTop: 24 }} />
        )}
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.fertig} onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Seite „Beleg erfassen“ – von „Vorlagen“ aus. */
export function BelegErfassenSeite() {
  return (
    <Unterseite titel={TEXT.beleg_erfassen}>
      <Inhalt>
        <T leise stil={{ marginBottom: 14 }}>{TEXT.beleg_erfassen_text}</T>
        <BelegErfassen />
      </Inhalt>
    </Unterseite>
  );
}
