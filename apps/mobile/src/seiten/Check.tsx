import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, ScrollView, View } from "react-native";
import type { Frage } from "@amtlos/i18n";
import { T as TEXT } from "../texte";
import { Auswahl, DatumFeld, Fakt, Feld, Fuss, Hinweis, Stempel, Symbol, Karte, Knopf, MehrfachWahl, T, TextKnopf, ZurueckKnopf } from "../ui/bausteine";
import { HellerStatus, TastaturRahmen, useKopf, useNav } from "../ui/navigation";
import { BLATT_OBEN, RADIUS, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { CHECK_FELDER, auswertung, checkFragenAnzahl, beantwortet, checkFragen, dringlichkeit, folgeAntworten, offeneFragenNachWirkung, selten, terminStand, zaehlung, zusatzFragen, type Profil } from "../pflichten/check";
import { heute } from "../unterlagen/speicher";
import { umsatzFakten } from "../unterlagen/kuUmsatz";
import { GesperrtePflichten, PflichtZeile } from "./Pflichten";
import { langBestehend, schonDaKandidaten } from "./schonDa";
import { WasHastDuSchon } from "./WasHastDu";
import { useAmtlos } from "../zustand";
import { checkHinweis, rechtsHinweis } from "../rechtshinweis";
import { bezahlschirmNachCheck, freiePflichten, weiterePflichten } from "../pro/regeln";
import { paywallVerfuegbar } from "../pro/kauf";
import { ProSeite } from "./Pro";

/**
 * R11 (UX #3/#5): Branchen aus Schritt 1, die auch Sofortmelde-Branchen sind – vorbelegt, damit niemand „Gastronomie“
 * zweimal angibt. Nur, solange die Sofortmelde-Frage noch unbeantwortet ist.
 */
const SOFORTMELDE_AUS_BRANCHE: Record<string, string> = { gastronomie_lebensmittel: "gastronomie", bau: "bau", transport_logistik: "spedition_logistik", gebaeudereinigung: "gebaeudereinigung" };
const sofortmeldeAus = (branchen: Wert | undefined) => (Array.isArray(branchen) ? [...new Set(branchen.map((b) => SOFORTMELDE_AUS_BRANCHE[b]).filter((x): x is string => Boolean(x)))].sort() : []);
/** Vorbelegung nur, solange die Frage offen ist oder noch genau die frühere Vorbelegung trägt (nie eine eigene Antwort überschreiben). */
function sofortmeldeVorbelegung(profil: Profil, branchen: Wert): Profil {
  const jetzt = profil["personal.sofortmeldebranchen"];
  const frueher = sofortmeldeAus(profil["taetigkeit.branchen"]);
  const offen = !beantwortet(profil, "personal.sofortmeldebranchen") || (Array.isArray(jetzt) && frueher.length > 0 && [...jetzt].sort().join() === frueher.join());
  if (!offen) return {};
  const neu = sofortmeldeAus(branchen);
  return neu.length ? { "personal.sofortmeldebranchen": neu } : beantwortet(profil, "personal.sofortmeldebranchen") ? { "personal.sofortmeldebranchen": null } : {};
}

type Wert = Profil[string];

/** R12 (Bäckerei #1): Haken, die aus der Branche vorbelegt sind – „aus deiner Branche“ statt stumm gesetzt. */
function herkunftFuer(feld: string, profil: Profil): Record<string, string> | undefined {
  if (feld !== "personal.sofortmeldebranchen") return undefined;
  const jetzt = profil[feld];
  const aus = sofortmeldeAus(profil["taetigkeit.branchen"]).filter((b) => Array.isArray(jetzt) && jetzt.includes(b));
  return aus.length ? Object.fromEntries(aus.map((b) => [b, TEXT.r12_aus_branche])) : undefined;
}

/** R12 (Kfz #6): Rechtsform aus dem Check für „Mein Betrieb“ (Geschäftsbriefe, § 35a GmbHG) – nur Gesellschaften und e. K. */
const RECHTSFORM_TEXT: Record<string, string> = { gbr: "GbR", ek: "e. K.", ohg: "OHG", kg: "KG", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG", partg: "PartG", partg_mbb: "PartG mbB" };
/** R11 (Nutzertest Gründerin #8): Ja/Nein-Fragen mit „Weiß ich nicht“ */
const WEISS_NICHT = ["kasse.elektronisch", "ust.kleinunternehmer"];

/**
 * Eingabe je Fragenart aus dem Fragebogen (packages/i18n/fragen.ts). `aufBlur`: Zahlen und Text erst beim Verlassen
 * des Felds (oder mit der Eingabetaste) übernehmen – wo jede Antwort sofort neu rechnet („Kurz klären“).
 */
export function Antwort({ f, wert, setzen, aufBlur, herkunft }: { f: Frage; wert: Wert | undefined; setzen: (w: Wert, weiter?: boolean) => void; aufBlur?: boolean; /** R12 (Bäckerei #1): woher ein vorbelegter Haken kommt, je Option */ herkunft?: Record<string, string> }) {
  const roh = Object.entries(f.optionen ?? {}).map(([k, t]) => ({ wert: k, text: t.de }));
  // R11 (UX #5): bei Mehrfachauswahl „Keine davon“ zuerst – als zwölfte Option lag sie unter dem sichtbaren Bereich
  const optionen = f.art === "mehrfach" ? [...roh.filter((o) => o.wert.startsWith("keine")), ...roh.filter((o) => !o.wert.startsWith("keine"))] : roh;
  switch (f.art) {
    case "auswahl":
      return <Auswahl gross ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : null} aendern={(w) => setzen(w, true)} optionen={optionen} />;
    case "mehrfach":
      return <MehrfachWahl gross ohneLabel label={f.frage.de} werte={Array.isArray(wert) ? wert : []} aendern={(w) => setzen(w)} optionen={optionen.map((o) => ({ ...o, herkunft: herkunft?.[o.wert] }))} />;
    case "janein":
      return (
        <Auswahl
          gross
          ohneLabel
          label={f.frage.de}
          wert={wert === true ? "ja" : wert === false ? "nein" : null}
          // R11 (Nutzertest Gründerin #8): „Weiß ich nicht“ bei Kasse und Kleinunternehmerregelung – lässt die Angabe offen
          aendern={(w) => setzen(w === "unklar" ? null : w === "ja", true)}
          optionen={[
            { wert: "ja", text: TEXT.ja },
            { wert: "nein", text: TEXT.nein },
            ...(WEISS_NICHT.includes(f.feld) ? [{ wert: "unklar", text: TEXT.r11_weiss_nicht }] : []),
          ]}
        />
      );
    case "zahl":
    case "betrag":
      return <ZahlFeld label={f.frage.de} wert={typeof wert === "number" ? wert : null} setzen={(n) => setzen(n)} aufBlur={aufBlur} />;
    case "datum":
      return <DatumFeld ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : null} aendern={(d) => setzen(d)} />;
    default:
      return aufBlur ? <TextFeld label={f.frage.de} wert={typeof wert === "string" ? wert : ""} setzen={(t) => setzen(t || null)} /> : <Feld ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : ""} aendern={(t) => setzen(t || null)} />;
  }
}

function ZahlFeld({ label, wert, setzen, aufBlur }: { label: string; wert: number | null; setzen: (n: number | null) => void; aufBlur?: boolean }) {
  const [text, setText] = useState(wert === null ? "" : String(wert));
  const uebernehmen = (t = text) => setzen(t === "" ? null : Number(t));
  return (
    <Feld
      ohneLabel
      label={label}
      wert={text}
      aendern={(t) => {
        const rein = t.replace(/[^0-9]/g, "");
        setText(rein);
        if (!aufBlur) uebernehmen(rein);
      }}
      onBlur={aufBlur ? () => uebernehmen() : undefined}
      onSubmitEditing={aufBlur ? () => uebernehmen() : undefined}
      keyboardType="number-pad"
    />
  );
}

function TextFeld({ label, wert, setzen }: { label: string; wert: string; setzen: (t: string) => void }) {
  const [text, setText] = useState(wert);
  return <Feld ohneLabel label={label} wert={text} aendern={setText} onBlur={() => setzen(text)} onSubmitEditing={() => setzen(text)} />;
}

/** Fortschritt als ein durchgehender 4-pt-Balken (B9) – gezählt in Fragen, nicht in Kästchen. */
function Fortschritt({ n, aktuell, label }: { n: number; aktuell: number; label?: string }) {
  const f = useFarben();
  const anteil = n ? Math.min(1, Math.max(0, aktuell / n)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: n, now: aktuell, text: label }} style={{ paddingHorizontal: RAND, paddingVertical: 10 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: f.linie, overflow: "hidden" }}>
        <View style={{ width: `${anteil * 100}%`, minWidth: anteil ? 4 : 0, height: 4, borderRadius: 2, backgroundColor: f.amt }} />
      </View>
    </View>
  );
}

/**
 * Pflichten-Check (E-126): eine Frage je Bildschirm, Auswahl springt gleich weiter. Ohne `felder` der ganze Check mit
 * Einleitung (inkl. Prüfhinweis) und Ergebnis; mit `felder` nur diese Nachfragen (z. B. für unklare Pflichten).
 */
export function CheckAblauf({ felder, einleitung = true }: { felder?: string[]; einleitung?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const voll = !felder;
  // Nachfragen: nur, was beim Öffnen noch fehlte – beantwortete Fragen verschwinden nicht mitten im Ablauf
  const [liste, setListe] = useState<string[]>(() => felder ?? [...CHECK_FELDER]);
  const [zusatz, setZusatz] = useState(false);
  const [extra, setExtra] = useState<string[]>([]);
  // Kern-Bedingungen (z. B. Minijob nur mit Beschäftigten) nur im ganzen Check; Zusatz- und Nachfragen werden immer gestellt
  const fragen = checkFragen(z.stand.profil, liste, voll ? extra : liste);
  const [i, setI] = useState(voll && einleitung ? -1 : 0);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vorleser = useRef(false);
  useEffect(() => {
    // im Web meldet react-native-web immer „an“ – dort gibt es kein VoiceOver-Problem
    if (Platform.OS === "web") return;
    void AccessibilityInfo.isScreenReaderEnabled().then((an) => (vorleser.current = an));
    const abo = AccessibilityInfo.addEventListener("screenReaderChanged", (an: boolean) => (vorleser.current = an));
    return () => abo.remove();
  }, []);
  useEffect(() => () => {
    if (zeit.current) clearTimeout(zeit.current);
  }, []);
  const amEnde = i >= fragen.length;
  // Grundfragen und Zusatzfragen getrennt zählen – „Schritt 1 von 10“ darf nicht still zu „13 von 17“ werden
  const extraN = fragen.filter((q) => extra.includes(q.feld)).length;
  const basisN = fragen.length - extraN;
  const [zwischen, setZwischen] = useState(false);
  const zwischenschirm = zwischen && extraN > 0 && i === basisN;
  const frage = i >= 0 && !amEnde && !(zwischen && extraN > 0 && i === basisN) ? fragen[i] : undefined;
  // R11 (UX #6/#7): „Frage 5“ ohne wandernde Gesamtzahl; der Balken geht von der Höchstzahl der Grundfragen aus
  const schrittText = frage ? (extra.includes(frage.feld) ? TEXT.zusatz_schritt(i - basisN + 1, extraN) : voll ? TEXT.r11_frage(i + 1) : TEXT.schritt(i + 1, basisN)) : "";
  // R11 (UX #2/#4): übersprungene Grundfragen – auf dem Zwischenschirm beim Namen nennen und direkt anbieten
  const uebersprungen = voll ? fragen.slice(0, basisN).filter((q) => !beantwortet(z.stand.profil, q.feld)) : [];
  // nach „Offene Frage beantworten“: danach zurück zum Zwischenschirm statt durch alle Fragen danach
  const [nachtrag, setNachtrag] = useState(false);
  // R12 (UX #1/#2): „Was hast du schon?“ vor dem Ergebnis, für Betriebe älter als vier Wochen – die Hauptzahl ist dann endgültig
  const [schonFertig, setSchonFertig] = useState(false);
  // neue Frage ansagen – sonst merkt VoiceOver den Wechsel nicht (der Fokus bleibt auf dem Weiter-Knopf)
  useEffect(() => {
    if (frage) AccessibilityInfo.announceForAccessibility(`${schrittText}: ${frage.frage.de}`);
  }, [frage?.feld]);
  const weiter = () => {
    if (zeit.current) clearTimeout(zeit.current);
    if (i + 1 >= fragen.length && !voll) return nav.zurueck();
    if (nachtrag) {
      setNachtrag(false);
      setZwischen(true);
      return setI(basisN);
    }
    setI(i + 1);
  };
  const setzen = (feld: string, w: Wert, springen?: boolean) => {
    const bl = feld === "bundesland" && typeof w === "string" ? frage?.optionen?.[w]?.de : undefined;
    // R10: was aus der Antwort folgt, gleich mit (z. B. „Freiberuflich“ ⇒ freier Beruf, keine zweite Frage danach)
    z.profilSetzen({ ...folgeAntworten(feld, w, z.stand.profil), ...(feld === "taetigkeit.branchen" ? sofortmeldeVorbelegung(z.stand.profil, w) : {}), [feld]: w }, bl);
    // R12 (Kfz #6): Rechtsform gleich in „Mein Betrieb“, solange dort keine steht – Rechnungen prüfen damit § 35a GmbHG
    if (feld === "rechtsform" && typeof w === "string" && RECHTSFORM_TEXT[w] && !(z.stand.betrieb.rechtsform ?? "").trim()) z.betriebSpeichern({ ...z.stand.betrieb, rechtsform: RECHTSFORM_TEXT[w] });
    // Freigabe Rechtsanwalt 22.10.2026 (B.16): eine GbR im Gesellschaftsregister führt den Zusatz „eGbR“ (§ 707a Abs. 2 BGB)
    if (feld === "gesellschaft.handelsregister" && w === "eingetragen" && z.stand.profil.rechtsform === "gbr" && ["", "GbR"].includes((z.stand.betrieb.rechtsform ?? "").trim())) z.betriebSpeichern({ ...z.stand.betrieb, rechtsform: "eGbR" });
    // mit VoiceOver nicht von selbst weiterspringen – sonst verliert man unangekündigt die Frage
    if (springen && !vorleser.current) {
      if (zeit.current) clearTimeout(zeit.current);
      zeit.current = setTimeout(weiter, 280);
    }
  };
  // nach den Grundfragen: bis zu fünf Zusatzfragen, die die meisten unklaren Pflichten klären (E-127)
  useEffect(() => {
    if (!voll || !amEnde || zusatz) return;
    setZusatz(true);
    // R10: auch Kern-Felder, die der Check für diesen Betrieb übersprungen hat (z. B. Geräte bei einer Agentur), als Zusatzfrage
    const gestellt = new Set(fragen.map((q) => q.feld));
    const neu = zusatzFragen(z.stand.profil, heute(), 8, z.stand.unterlagen, z.stand.mitarbeiter).filter((f) => !gestellt.has(f));
    if (neu.length) {
      setExtra(neu);
      setListe((l) => [...l.filter((x) => !neu.includes(x)), ...neu]);
      setZwischen(true);
    }
  }, [voll, amEnde, zusatz, z.stand.profil, liste]);
  const roh = useMemo(() => (amEnde && voll && zusatz ? auswertung(z.stand.profil, heute(), z.stand.unterlagen, z.stand.mitarbeiter, umsatzFakten(z.stand, heute())) : null), [amEnde, voll, zusatz, z.stand.profil, z.stand.unterlagen, z.stand.mitarbeiter, z.stand.kasse, z.stand.sachentnahmen]);
  // E-192: mit dem Stand der Haken – ein versäumter Termin steht vorn (wie im Pflichten-Tab)
  const a = useMemo(() => (roh ? terminStand(roh, z.stand, heute()) : null), [roh, z.stand.erledigt, z.stand.zeiten]);
  const d = useMemo(() => (a ? dringlichkeit(a, { erledigt: z.stand.erledigt, unterlagen: z.stand.unterlagen, betrieb: z.stand.betrieb }, heute()) : null), [a, z.stand.erledigt, z.stand.unterlagen, z.stand.betrieb]);
  // R10: Pflichten, Hinweise und Optionen getrennt (Rechtsprüfung) – „Mit diesen fängst du an“ nur echte Pflichten
  const zahl = a ? zaehlung(a.gilt) : { pflichten: 0, hinweise: 0, optionen: 0 };
  // R11 (Berater d, UX #9): eine Hauptzahl – was jetzt dran ist (wie „Jetzt dran“ im Pflichten-Tab). Was Lohnbüro bzw.
  // Steuerberatung erledigt, zählt nicht mit und steht nie unter „Mit diesen 3 fängst du an“; die Liste kommt aus
  // derselben Rechnung wie die Zahl.
  const jetztDran = d?.jetzt ?? [];
  // E-188: ohne Pro genau die freien Pflichten (die ersten 3 nach Dringlichkeit) – die übrigen nur als Zahl
  const frei = useMemo(() => (a && !z.pro ? freiePflichten(a, z.stand.betrieb, heute()) : null), [a, z.pro, z.stand.betrieb]);
  const anfangen = frei && a ? [...frei].map((id) => a.gilt.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : (jetztDran.length ? jetztDran : a ? a.gilt.filter((p) => p.einordnung === "pflicht" && !p.lohnbuero) : []).slice(0, 3);
  const genauer = useMemo(() => (a ? offeneFragenNachWirkung(a, z.stand.profil).length : 0), [a, z.stand.profil]);
  const schonListe = useMemo(() => (a && langBestehend(z.stand.profil, heute()) ? schonDaKandidaten(a, { erledigt: z.stand.erledigt, unterlagen: z.stand.unterlagen, betrieb: z.stand.betrieb }, heute()) : []), [a, z.stand.profil, z.stand.erledigt, z.stand.unterlagen, z.stand.betrieb]);
  // E-188: „Was hast du schon?“ nennt viele Pflichten beim Namen – ohne Pro entfällt der Schritt
  const schon = Boolean(a) && z.pro && !schonFertig && schonListe.length > 0;
  // E-188: nach dem ersten ganzen Pflichten-Check einmal von selbst der Bezahlschirm („N Pflichten kommen für dich in Frage“, E-189) –
  // als Blatt über dem Ergebnis, das darunter stehen bleibt; „Später“ schließt. Danach nur über die üblichen Anlässe.
  const ergebnisDa = voll && Boolean(a) && !schon;
  const nachCheck = bezahlschirmNachCheck({ pro: z.pro, proBekannt: z.proBekannt, verfuegbar: paywallVerfuegbar, gezeigt: z.stand.bezahlschirmNachCheck });
  useEffect(() => {
    if (!ergebnisDa || !nachCheck) return;
    // kurz warten, damit man das Ergebnis zuerst sieht
    const t = setTimeout(() => {
      z.bezahlschirmNachCheckVermerken();
      nav.oeffnen("pro", () => <ProSeite anlass="check" anzahl={zahl.pflichten} />, true);
    }, 900);
    return () => clearTimeout(t);
  }, [ergebnisDa, nachCheck]);
  const schliessen = () => {
    // „Pflichten“ ist der erste Tab (E-129): Check schließen und dorthin wechseln
    z.erfolg();
    nav.zurueck();
    z.tabWechseln("pflichten");
  };
  // Auftakt, Zwischenstand und Ergebnis auf der Bühne (E-144); die Fragen selbst auf hellem Grund
  const buehne = !schon && (i < 0 || zwischenschirm || Boolean(a));
  useKopf({ titel: TEXT.check_titel, schliessen: true, buehne });
  if (schon && a) return <WasHastDuSchon liste={schonListe} fertig={() => setSchonFertig(true)} />;

  return (
    <View style={{ flex: 1, backgroundColor: buehne ? f.buehne : f.papier }}>
      {buehne ? <HellerStatus /> : null}
      {buehne ? null : i < basisN ? <Fortschritt n={voll ? Math.max(basisN, checkFragenAnzahl(z.stand.profil)) : basisN} aktuell={Math.max(0, i)} label={schrittText} /> : extraN && !zwischenschirm && !amEnde ? <Fortschritt n={extraN} aktuell={i - basisN} label={schrittText} /> : <Fortschritt n={1} aktuell={1} />}
      <TastaturRahmen grund={buehne ? f.buehne : undefined}>
        <ScrollView key={i} contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 12, paddingBottom: a ? 0 : 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {i < 0 ? (
            <View>
              {/* Auftakt wie Apples Einführungsbildschirme: großes Symbol, Titel und Text mittig */}
              <View style={{ alignItems: "center", paddingTop: 24 }}>
                <Symbol name="checklist" groesse={64} farbe={f.minze} gewicht="regular" />
                <T v="titel" accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 22, textAlign: "center" }}>{TEXT.check_einleitung_titel}</T>
                <T farbe={f.buehneLeise} stil={{ marginTop: 10, textAlign: "center" }}>{TEXT.check_einleitung_text}</T>
              </View>
              <View style={{ marginTop: 26, flexDirection: "row", gap: 10, padding: 14, borderRadius: RADIUS.knopf, backgroundColor: f.buehneFlaeche }}>
                <Symbol name="info.circle" groesse={17} farbe={f.minze} gewicht="semibold" />
                <T v="klein" farbe={f.buehneLeise} stil={{ flex: 1 }}>{checkHinweis()}</T>
              </View>
            </View>
          ) : zwischenschirm ? (
            <View style={{ paddingTop: 16 }}>
              <Stempel groesse={72} farbe={f.minze} />
              <T v="titel" accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 18 }}>{uebersprungen.length ? TEXT.r11_fast_titel(uebersprungen.length) : TEXT.zwischen_titel}</T>
              {/* R11 (UX #4): die übersprungene Frage beim Namen – „Geschafft“ und danach „nicht fertig“ widersprachen sich */}
              {uebersprungen.length ? <T farbe={f.buehneText} stil={{ marginTop: 10, ...SCHRIFT.halb }}>{TEXT.r11_fast_frage(uebersprungen[0]!.frage.de, uebersprungen.length)}</T> : null}
              <T farbe={f.buehneLeise} stil={{ marginTop: 10 }}>{TEXT.zwischen_text(extraN)}</T>
            </View>
          ) : frage ? (
            <View>
              <T v="caption" leise>{schrittText}</T>
              <T v="titel" accessibilityRole="header" stil={{ marginTop: 4 }}>{frage.frage.de}</T>
              {frage.hilfe ? <T leise stil={{ marginTop: 8 }}>{frage.hilfe.de}</T> : null}
              {frage.art === "mehrfach" ? <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.r11_mehrere_moeglich}</T> : null}
              <View style={{ marginTop: 12 }}>
                <Antwort key={frage.feld} f={frage} wert={z.stand.profil[frage.feld]} setzen={(w, s) => setzen(frage.feld, w, s)} herkunft={herkunftFuer(frage.feld, z.stand.profil)} />
              </View>
            </View>
          ) : a ? (
            <View style={{ flexGrow: 1 }}>
              <View style={{ paddingTop: 12, paddingBottom: 28 }}>
                <Stempel groesse={72} farbe={f.minze} />
                {/* R11 (Berater d): eine Hauptzahl – was jetzt dran ist; alles andere klein darunter bzw. im Blatt */}
                <View accessible accessibilityRole="header" accessibilityLabel={TEXT.r11_ergebnis_label(jetztDran.length)} style={{ marginTop: 18 }}>
                  <T maxFontSizeMultiplier={1.4} farbe={f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 56, lineHeight: 60, letterSpacing: -2, fontVariant: ["tabular-nums"] }}>{String(jetztDran.length)}</T>
                  <T v="titel" farbe={f.buehneText} stil={{ marginTop: 2 }}>{TEXT.r11_ergebnis_haupt(jetztDran.length)}</T>
                </View>
                <T v="klein" farbe={f.buehneLeise} stil={{ marginTop: 8 }}>{TEXT.r10_ergebnis_gesamt(zahl.pflichten, zahl.hinweise, zahl.optionen, selten(a.gilt))}</T>
              </View>
              <View style={{ flexGrow: 1, marginHorizontal: -RAND, paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: 32, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne }}>
              {anfangen.length ? (
                <View>
                  <T v="gross">{TEXT.ergebnis_anfangen(anfangen.length)}</T>
                  <Karte stil={{ marginTop: 10 }}>
                    {anfangen.map((p, k, l) => (
                      <PflichtZeile key={p.id} p={p} erledigt={false} ohneWichtig letzte={k === l.length - 1} />
                    ))}
                  </Karte>
                </View>
              ) : null}
              {frei && a ? <GesperrtePflichten anzahl={weiterePflichten(a, frei)} /> : null}
              <Karte stil={{ marginTop: 16 }}>
                {[
                  { symbol: "doc.text", ton: "amt" as const, text: TEXT.ergebnis_vorlagen(a.gilt.filter((p) => p.vorlage).length) },
                  ...(a.gruendung.length ? [{ symbol: "flag", ton: "leise" as const, text: TEXT.ergebnis_gruendung(a.gruendung.length) }] : []),
                  ...(a.beiEinstellung.length ? [{ symbol: "person.2", ton: "leise" as const, text: TEXT.r10_bei_einstellung_titel(a.beiEinstellung.length) }] : []),
                  // „37 weitere hängen ab“ war mehr als die Pflichten selbst – stattdessen, wie viele Antworten es genauer machen
                  ...(a.unbekannt.length ? [{ symbol: "questionmark.circle", ton: "leise" as const, text: genauer ? TEXT.r11_ergebnis_genauer(genauer) : TEXT.ergebnis_unbekannt(a.unbekannt.length) }] : []),
                ].map((x, k, l) => (
                  <Fakt key={x.symbol} symbol={x.symbol} ton={x.ton} text={x.text} letzte={k === l.length - 1} />
                ))}
              </Karte>
              <View style={{ marginTop: 18 }}>
                {/* Phase 1 (RDG): keine Rechts- oder Steuerberatung, mit Rechtsstand */}
                <Hinweis text={rechtsHinweis("pflichten").ganz} />
              </View>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
              </View>
            </View>
          ) : null}
        </ScrollView>
        {/* Zwischenschirm (B6): das Ergebnis ist der Hauptweg, „Genauer machen“ das freiwillige Extra */}
        <Fuss buehne={buehne && !a} ueber={zwischenschirm ? <TextKnopf buehne text={TEXT.zwischen_genauer_n(extraN)} onPress={() => setZwischen(false)} stil={{ alignSelf: "center" }} /> : undefined}>
          {i > 0 ? (
            <ZurueckKnopf buehne={buehne && !a} label={TEXT.vorheriger_schritt} onPress={() => { if (zeit.current) clearTimeout(zeit.current); setI(i - 1); }} />
          ) : null}
          {i < 0 ? (
            <Knopf buehne text={TEXT.check_starten} onPress={() => setI(0)} stil={{ flex: 1 }} />
          ) : zwischenschirm ? (
            uebersprungen.length ? (
              // R11 (UX #2): bei übersprungenen Grundfragen ist „Offene Frage beantworten“ der Hauptweg
              <View style={{ flex: 1, gap: 8 }}>
                <Knopf buehne text={TEXT.r11_offene_beantworten} onPress={() => { setZwischen(false); setNachtrag(true); setI(fragen.indexOf(uebersprungen[0]!)); }} />
                <Knopf glas text={TEXT.zwischen_ergebnis} onPress={() => { setZwischen(false); setI(fragen.length); }} />
              </View>
            ) : (
              <Knopf buehne text={TEXT.zwischen_ergebnis} onPress={() => { setZwischen(false); setI(fragen.length); }} stil={{ flex: 1 }} />
            )
          ) : frage ? (
            // ohne Antwort heißt der Knopf „Überspringen“ – nie ein grauer, scheinbar gesperrter „Weiter“-Knopf
            <Knopf ton={!beantwortet(z.stand.profil, frage.feld)} text={beantwortet(z.stand.profil, frage.feld) ? TEXT.weiter : TEXT.check_ueberspringen} onPress={weiter} stil={{ flex: 1 }} />
          ) : !a ? (
            // kurz bevor die Zusatzfragen feststehen: kein Knopf, der den Check vorzeitig schließt
            <Knopf text={TEXT.weiter} deaktiviert onPress={() => undefined} stil={{ flex: 1 }} />
          ) : (
            // R12 (UX #2): „Was hast du schon?“ kam schon vor dem Ergebnis – von hier in den Pflichten-Tab
            <Knopf text={TEXT.pflichten_ansehen} onPress={schliessen} stil={{ flex: 1 }} />
          )}
        </Fuss>
      </TastaturRahmen>
    </View>
  );
}
