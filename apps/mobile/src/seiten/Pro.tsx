import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { LINKS } from "../rechtliches";
import { T as TEXT } from "../texte";
import { trennen } from "../ui/trennen";
import { Betrag, Fuss, Hinweis, Kachel, Karte, Knopf, Symbol, T, TextKnopf, useGrosseSchrift } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { BuehnenBlatt } from "./gemeinsam";
import { HAARLINIE, RADIUS, useFarben } from "../ui/thema";
import { angebote, kaufAktiv, kaufen, paywallVerfuegbar, testmodus, wiederherstellen, type Angebot } from "../pro/kauf";
import { ersparnis, knopfText, naechsterMonat, preisZeile } from "../pro/bezahltext";
import { PRO_VORTEILE, VORLAGEN_FREI_JE_MONAT, uebrig, type ProFunktion } from "../pro/regeln";
import { useAmtlos } from "../zustand";
import { syncAngeboten } from "../konto/konfig";
import { DatenschutzSeite } from "./Recht";

/** „Synchronisation“ nur zeigen, wenn dieser Build einen Server hat (E-134). */
const VORTEILE = PRO_VORTEILE.filter((v) => v !== "sync" || syncAngeboten);
/** Reihenfolge nach Nutzen (E-156): „Pflichten erfüllen, Kontrollen bestehen“ – Vorlagen als PDF, Erinnerungen, Kontrollmappe zuerst. */
const NACH_NUTZEN: ProFunktion[] = PRO_VORTEILE;
const VORTEIL_SYMBOL: Record<ProFunktion, string> = { pdf: "square.and.arrow.up", erinnerungen: "bell", kontrollmappe: "folder", pflicht_details: "checklist", e_rechnung: "doc.text", ust_uebernahme: "percent", steuerberater: "briefcase", sync: "arrow.triangle.2.circlepath", icloud: "icloud", briefkopf: "paintpalette" };

/** Vorteil als Kachel im 2×2-Raster: Symbol, kurzer Titel, ein Satz. */
function VorteilKachel({ v }: { v: ProFunktion }) {
  const f = useFarben();
  const gross = useGrosseSchrift();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${TEXT.pro_vorteil[v].titel}. ${TEXT.pro_vorteil[v].text(VORLAGEN_FREI_JE_MONAT)}`} style={{ flexBasis: gross ? "100%" : "46%", flexGrow: 1, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.blatt, gap: 8 }}>
      <Kachel symbol={VORTEIL_SYMBOL[v]} groesse={36} />
      <T fett stil={{ marginTop: 2 }}>{trennen(TEXT.pro_kachel[v])}</T>
      <T v="caption" leise>{trennen(TEXT.pro_vorteil[v].text(VORLAGEN_FREI_JE_MONAT))}</T>
    </View>
  );
}


/**
 * Bezahlschirm (E-132): warum Pro, was Pro bringt, Angebote aus dem Store. Ohne Store-Anbindung lässt sich Pro nur im
 * Testmodus (Entwicklung, Testpaket, `EXPO_PUBLIC_PRO_TESTMODUS=1`) testweise einschalten; ein Store-Build ohne Kauf
 * zeigt keinen Kaufknopf (App-Review B2). Der Preis nach dem Testzeitraum steht gleich groß direkt über dem Knopf (R3).
 * Pflichtangaben für Abos (Verlängerung, Kündigung, Nutzungsbedingungen, Datenschutz) stehen unter dem Knopf.
 */
export function ProSeite({ grund, danach }: { grund?: ProFunktion; /** nach erfolgreichem Kauf bzw. Einschalten (z. B. Erinnerungen einschalten) */ danach?: () => void }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const [liste, setListe] = useState<Angebot[] | null>(kaufAktiv ? null : []);
  const [wahl, setWahl] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Angebote aus dem Store; kommt keins (z. B. Abo noch nicht freigegeben), sagen wir das und bieten „Erneut laden“
  const angeboteLaden = () => {
    if (!kaufAktiv) return;
    setListe(null);
    setFehler(null);
    angebote()
      .then((l) => {
        setListe(l);
        // R12 (UX #12): Jahresabo vorausgewählt
        setWahl((l.find((a) => a.zeitraum === "jährlich") ?? l[0])?.id ?? null);
        if (!l.length) setFehler(TEXT.pro_laden_fehler);
      })
      .catch(() => {
        setListe([]);
        setFehler(TEXT.pro_laden_fehler);
      });
  };
  useEffect(angeboteLaden, []);
  const fertig = (aktiv: boolean, text: string) => {
    z.proAktualisieren(aktiv);
    if (aktiv) {
      melden(text);
      nav.zurueck();
      danach?.();
    }
  };
  const los = async () => {
    setFehler(null);
    if (!kaufAktiv) {
      if (!testmodus) return;
      // nur der Testschalter – nicht den Store-Status setzen, sonst bliebe Pro nach „testweise ausschalten“ an (M3)
      z.proTestSetzen(true);
      melden(TEXT.pro_test_an);
      nav.zurueck();
      return danach?.();
    }
    if (!wahl) return;
    setLaedt(true);
    try {
      fertig(await kaufen(wahl), TEXT.pro_willkommen);
    } catch {
      setFehler(TEXT.pro_kauf_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const zurueckholen = async () => {
    setFehler(null);
    setLaedt(true);
    try {
      const ok = await wiederherstellen();
      if (ok) fertig(true, TEXT.pro_wiederhergestellt);
      else setFehler(TEXT.pro_nichts_gefunden);
    } catch {
      setFehler(TEXT.pro_wiederherstellen_fehler);
    } finally {
      setLaedt(false);
    }
  };
  const gewaehlt = liste?.find((a) => a.id === wahl);
  const knopf = knopfText({ kaufAktiv, testmodus, gewaehlt });
  const reihe = NACH_NUTZEN.filter((x) => VORTEILE.includes(x));
  const sortiert = grund ? [grund, ...reihe.filter((x) => x !== grund)] : reihe;
  const haupt = sortiert.slice(0, 4);
  const weitere = sortiert.slice(4);
  const rest = uebrig(z.stand.unterlagen, new Date());
  // R12 (UX #12): „Immer kostenlos“ zugeklappt – der Pro-Nutzen steht vorn; der Ausweg ist ein eigener Knopf
  const [freiOffen, setFreiOffen] = useState(false);
  const spart = liste ? ersparnis(liste) : null;
  const ausweg = grund === "pdf" && !z.pro ? TEXT.r12_pro_entwurf(naechsterMonat(new Date()), VORLAGEN_FREI_JE_MONAT) : null;
  return (
    <BuehnenBlatt
      fuss={
        <Fuss
          ueber={
            !z.pro && kaufAktiv && gewaehlt ? (
              <View accessible accessibilityRole="text" style={{ alignItems: "center" }}>
                <T fett stil={{ textAlign: "center" }}>{preisZeile(gewaehlt)}</T>
                <T v="caption" leise stil={{ textAlign: "center" }}>{TEXT.pro_kuendbar}</T>
              </View>
            ) : null
          }
        >
          {z.pro ? (
            <Knopf ton text={TEXT.pro_aktiv} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
          ) : knopf ? (
            <View style={{ flex: 1, gap: 4 }}>
              <Knopf text={knopf} laedt={laedt} deaktiviert={kaufAktiv ? !wahl : !testmodus} onPress={() => void los()} />
              {/* R12 (UX #12), E-156: der Ausweg als zweiter Knopf – die Vorlage bleibt als Entwurf, am Monatsersten ist wieder eine frei */}
              {ausweg ? <TextKnopf text={ausweg} onPress={nav.zurueck} stil={{ alignSelf: "center" }} /> : null}
            </View>
          ) : (
            <Knopf ton text={TEXT.schliessen} onPress={nav.zurueck} stil={{ flex: 1 }} />
          )}
        </Fuss>
      }
      // zuerst der Nutzen (E-156): Pflichten erfüllen, Kontrollen bestehen – nicht Logo und Hausfarbe
      ueber={TEXT.pro_marke}
      // R12 (UX #12): Überschrift aus dem Anlass („Vorlage 2 diesen Monat – mit Pro ohne Limit“)
      titel={grund ? TEXT.r12_pro_anlass[grund](VORLAGEN_FREI_JE_MONAT) : TEXT.pro_wert_titel}
      unter={grund ? TEXT.pro_grund[grund](VORLAGEN_FREI_JE_MONAT) : TEXT.pro_wert_text}
    >
      {/* die vier stärksten Vorteile als Raster – der Grund, aus dem der Bezahlschirm aufging, steht vorn */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {haupt.map((v) => (
          <VorteilKachel key={v} v={v} />
        ))}
      </View>
      {weitere.length ? (
        <Karte stil={{ marginTop: 10 }}>
          <T v="caption" fett leise stil={{ paddingTop: 12 }}>{TEXT.pro_ausserdem}</T>
          {weitere.map((v, i, l) => (
            <View key={v} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 11, borderBottomWidth: i === l.length - 1 ? 0 : HAARLINIE, borderColor: f.linie }}>
              <Symbol name={VORTEIL_SYMBOL[v]} groesse={18} farbe={f.amt} />
              <T v="klein" stil={{ flex: 1 }}>{TEXT.pro_vorteil[v].titel}</T>
            </View>
          ))}
        </Karte>
      ) : null}
      <View style={{ marginTop: 10 }}>
        {freiOffen ? <Hinweis art="erfolg" text={TEXT.pro_frei_bleibt} /> : null}
        <TextKnopf symbol={freiOffen ? "chevron.up" : "chevron.down"} erweitert={freiOffen} text={TEXT.r12_pro_frei_knopf} onPress={() => setFreiOffen(!freiOffen)} />
      </View>
      {!z.pro ? <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.pro_rest(rest, VORLAGEN_FREI_JE_MONAT)}</T> : null}

      {kaufAktiv ? (
        liste === null ? (
          <ActivityIndicator color={f.amt} style={{ marginTop: 24 }} accessibilityLabel={TEXT.pro_laedt} />
        ) : (
          <View accessibilityRole="radiogroup" style={{ marginTop: 20, gap: 10 }}>
            {liste.map((a) => {
              const an = a.id === wahl;
              return (
                <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: an }} onPress={() => setWahl(a.id)} style={{ padding: 16, borderRadius: RADIUS.karte, borderWidth: 2, borderColor: an ? f.amt : f.linie, backgroundColor: an ? f.amtHauch : f.blatt, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: an ? 7 : 1.5, borderColor: an ? f.amt : f.rahmen, backgroundColor: f.blatt }} />
                  <View style={{ flex: 1 }}>
                    <T fett>{a.zeitraum ? TEXT.pro_zeitraum(a.zeitraum) : a.titel}</T>
                    {/* R12 (UX #12): Ersparnis des Jahresabos – aus den Store-Preisen berechnet */}
                    {a.zeitraum === "jährlich" && spart ? <T v="klein" fett farbe={f.amt}>{TEXT.r12_pro_spart(spart)}</T> : null}
                    {a.test ? <T v="klein" farbe={f.amt}>{TEXT.pro_test_zeitraum(a.test)}</T> : null}
                  </View>
                  <Betrag>{a.preis}</Betrag>
                </Pressable>
              );
            })}
          </View>
        )
      ) : (
        <View style={{ marginTop: 16 }}>
          <Hinweis text={testmodus ? TEXT.pro_testmodus : TEXT.pro_nicht_verfuegbar} symbol="info.circle" />
        </View>
      )}
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {kaufAktiv && liste !== null && !liste.length ? <TextKnopf symbol="arrow.clockwise" text={TEXT.erneut_laden} onPress={angeboteLaden} /> : null}
      {z.pro && testmodus ? <TextKnopf symbol="xmark.circle" text={TEXT.pro_test_aus} onPress={() => {
            z.proTestSetzen(false);
            // ohne echten Kauf gibt es kein Abo: Store-Status mit zurücksetzen; mit Kauf beim Store neu fragen (M3)
            z.proAktualisieren(kaufAktiv ? undefined : false);
          }} stil={{ marginTop: 8 }} /> : null}

      <T v="caption" leise stil={{ marginTop: 18 }}>{TEXT.pro_abo_text}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
        <TextKnopf text={TEXT.nutzungsbedingungen} leise onPress={() => void Linking.openURL(LINKS.nutzung)} />
        <TextKnopf text={TEXT.datenschutz} leise onPress={() => nav.oeffnen("datenschutz", () => <DatenschutzSeite />)} />
        {kaufAktiv ? <TextKnopf text={TEXT.pro_wiederherstellen} leise onPress={() => void zurueckholen()} /> : null}
      </View>
    </BuehnenBlatt>
  );
}

/**
 * Prüft eine Pro-Funktion: mit Pro true, sonst öffnet sich der Bezahlschirm (mit Grund) und es kommt false zurück.
 * `danach` läuft, wenn Pro auf dem Bezahlschirm aktiv wird (z. B. die Erinnerungen gleich einschalten).
 */
export function useProSperre() {
  const z = useAmtlos();
  const nav = useNav();
  return (f: ProFunktion, danach?: () => void): boolean => {
    if (z.pro) return true;
    nav.oeffnen("pro", () => <ProSeite grund={f} danach={danach} />, true);
    return false;
  };
}

/**
 * Zeile unter „Mein Betrieb“: Pro-Status, öffnet den Bezahlschirm. Ohne Kauf und ohne Testmodus (Store-Build ohne
 * RevenueCat-Schlüssel) entfällt der Einstieg ganz (App-Review B2).
 */
export function ProZeile() {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const rest = uebrig(z.stand.unterlagen, new Date());
  if (!paywallVerfuegbar && !z.pro) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => nav.oeffnen("pro", () => <ProSeite />, true)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {/* ruhige Karte wie die übrigen – die lauteste Fläche des Bildschirms soll nicht die Werbung sein */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.blatt }}>
        <Kachel symbol={z.pro ? "checkmark.seal.fill" : "sparkles"} ton="amt" />
        <View style={{ flex: 1 }}>
          <T fett>{z.pro ? TEXT.pro_aktiv : TEXT.pro_titel}</T>
          <T v="klein" leise>{z.pro ? TEXT.pro_aktiv_text : TEXT.pro_rest(rest, VORLAGEN_FREI_JE_MONAT)}</T>
        </View>
        <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" />
      </View>
    </Pressable>
  );
}
