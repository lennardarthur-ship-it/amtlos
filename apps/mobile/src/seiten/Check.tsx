import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, ScrollView, View } from "react-native";
import type { Frage } from "@amtlos/i18n";
import { T as TEXT } from "../texte";
import { Auswahl, DatumFeld, Fakt, Feld, Fuss, Hinweis, Symbol, Karte, Knopf, MehrfachWahl, T, TextKnopf, ZurueckKnopf } from "../ui/bausteine";
import { HellerStatus, TastaturRahmen, useKopf, useNav } from "../ui/navigation";
import { RADIUS, RAND, useFarben } from "../ui/thema";
import { CHECK_FELDER, auswertung, beantwortet, checkFragen, zusatzFragen, type Profil } from "../pflichten/check";
import { heute } from "../unterlagen/speicher";
import { PflichtZeile } from "./Pflichten";
import { useAmtlos } from "../zustand";

type Wert = Profil[string];

/** Eingabe je Fragenart aus dem Fragebogen (packages/i18n/fragen.ts). */
export function Antwort({ f, wert, setzen }: { f: Frage; wert: Wert | undefined; setzen: (w: Wert, weiter?: boolean) => void }) {
  const optionen = Object.entries(f.optionen ?? {}).map(([k, t]) => ({ wert: k, text: t.de }));
  switch (f.art) {
    case "auswahl":
      return <Auswahl gross ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : null} aendern={(w) => setzen(w, true)} optionen={optionen} />;
    case "mehrfach":
      return <MehrfachWahl gross ohneLabel label={f.frage.de} werte={Array.isArray(wert) ? wert : []} aendern={(w) => setzen(w)} optionen={optionen} />;
    case "janein":
      return (
        <Auswahl
          gross
          ohneLabel
          label={f.frage.de}
          wert={wert === true ? "ja" : wert === false ? "nein" : null}
          aendern={(w) => setzen(w === "ja", true)}
          optionen={[
            { wert: "ja", text: TEXT.ja },
            { wert: "nein", text: TEXT.nein },
          ]}
        />
      );
    case "zahl":
    case "betrag":
      return <ZahlFeld label={f.frage.de} wert={typeof wert === "number" ? wert : null} setzen={(n) => setzen(n)} />;
    case "datum":
      return <DatumFeld ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : null} aendern={(d) => setzen(d)} />;
    default:
      return <Feld ohneLabel label={f.frage.de} wert={typeof wert === "string" ? wert : ""} aendern={(t) => setzen(t || null)} />;
  }
}

function ZahlFeld({ label, wert, setzen }: { label: string; wert: number | null; setzen: (n: number | null) => void }) {
  const [text, setText] = useState(wert === null ? "" : String(wert));
  return (
    <Feld
      ohneLabel
      label={label}
      wert={text}
      aendern={(t) => {
        const rein = t.replace(/[^0-9]/g, "");
        setText(rein);
        setzen(rein === "" ? null : Number(rein));
      }}
      keyboardType="number-pad"
    />
  );
}

function Fortschritt({ n, aktuell }: { n: number; aktuell: number }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: n, now: aktuell }} style={{ flexDirection: "row", gap: 4, paddingHorizontal: RAND, paddingVertical: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < aktuell ? f.amt : f.linie }} />
      ))}
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
  const fragen = checkFragen(z.stand.profil, liste);
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
  const weiter = () => {
    if (zeit.current) clearTimeout(zeit.current);
    if (i + 1 >= fragen.length && !voll) return nav.zurueck();
    setI(i + 1);
  };
  const setzen = (feld: string, w: Wert, springen?: boolean) => {
    const bl = feld === "bundesland" && typeof w === "string" ? frage?.optionen?.[w]?.de : undefined;
    z.profilSetzen({ [feld]: w }, bl);
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
    const neu = zusatzFragen(z.stand.profil, heute()).filter((f) => !liste.includes(f));
    if (neu.length) {
      setExtra(neu);
      setListe((l) => [...l, ...neu]);
      setZwischen(true);
    }
  }, [voll, amEnde, zusatz, z.stand.profil, liste]);
  const a = useMemo(() => (amEnde && voll && zusatz ? auswertung(z.stand.profil, heute(), z.stand.unterlagen) : null), [amEnde, voll, zusatz, z.stand.profil, z.stand.unterlagen]);
  // Auftakt, Zwischenstand und Ergebnis auf der Bühne (E-144); die Fragen selbst auf hellem Grund
  const buehne = i < 0 || zwischenschirm || Boolean(a);
  useKopf({ titel: TEXT.check_titel, schliessen: true, buehne });

  return (
    <View style={{ flex: 1, backgroundColor: buehne ? f.buehne : f.papier }}>
      {buehne ? <HellerStatus /> : null}
      {buehne ? null : i < basisN ? <Fortschritt n={basisN} aktuell={Math.max(0, i)} /> : extraN && !zwischenschirm && !amEnde ? <Fortschritt n={extraN} aktuell={i - basisN} /> : <Fortschritt n={1} aktuell={1} />}
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
              <View style={{ marginTop: 26, flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: f.buehneFlaeche }}>
                <Symbol name="info.circle" groesse={17} farbe={f.minze} gewicht="semibold" />
                <T v="klein" farbe={f.buehneLeise} stil={{ flex: 1 }}>{TEXT.check_hinweis}</T>
              </View>
            </View>
          ) : zwischenschirm ? (
            <View style={{ paddingTop: 16 }}>
              <Symbol name="checkmark.circle.fill" groesse={60} farbe={f.minze} gewicht="regular" />
              <T v="titel" accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 18 }}>{TEXT.zwischen_titel}</T>
              <T farbe={f.buehneLeise} stil={{ marginTop: 10 }}>{TEXT.zwischen_text(extraN)}</T>
            </View>
          ) : frage ? (
            <View>
              <T v="caption" leise>{extra.includes(frage.feld) ? TEXT.zusatz_schritt(i - basisN + 1, extraN) : TEXT.schritt(i + 1, basisN)}</T>
              <T v="titel" accessibilityRole="header" stil={{ marginTop: 4 }}>{frage.frage.de}</T>
              {frage.hilfe ? <T leise stil={{ marginTop: 8 }}>{frage.hilfe.de}</T> : null}
              <View style={{ marginTop: 12 }}>
                <Antwort key={frage.feld} f={frage} wert={z.stand.profil[frage.feld]} setzen={(w, s) => setzen(frage.feld, w, s)} />
              </View>
            </View>
          ) : a ? (
            <View style={{ flexGrow: 1 }}>
              <View style={{ paddingTop: 12, paddingBottom: 28 }}>
                <Symbol name="checkmark.circle.fill" groesse={60} farbe={f.minze} gewicht="regular" />
                <T v="titel" accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 18 }}>{TEXT.ergebnis_titel(a.gilt.length)}</T>
              </View>
              <View style={{ flexGrow: 1, marginHorizontal: -RAND, paddingHorizontal: RAND, paddingTop: 24, paddingBottom: 32, backgroundColor: f.papier, borderTopLeftRadius: RADIUS.buehne, borderTopRightRadius: RADIUS.buehne }}>
              {a.gilt.length ? (
                <View>
                  <T v="gross">{TEXT.ergebnis_anfangen(Math.min(3, a.gilt.length))}</T>
                  <Karte stil={{ marginTop: 10 }}>
                    {a.gilt.slice(0, 3).map((p, k, l) => (
                      <PflichtZeile key={p.id} p={p} erledigt={false} ohneWichtig letzte={k === l.length - 1} />
                    ))}
                  </Karte>
                </View>
              ) : null}
              <Karte stil={{ marginTop: 16 }}>
                {[
                  { symbol: "doc.text", ton: "amt" as const, text: TEXT.ergebnis_vorlagen(a.gilt.filter((p) => p.vorlage).length) },
                  ...(a.gilt.some((p) => p.schwere === "hoch") ? [{ symbol: "exclamationmark.circle", ton: "bald" as const, text: TEXT.ergebnis_wichtig(a.gilt.filter((p) => p.schwere === "hoch").length) }] : []),
                  ...(a.gruendung.length ? [{ symbol: "flag", ton: "leise" as const, text: TEXT.ergebnis_gruendung(a.gruendung.length) }] : []),
                  ...(a.unbekannt.length ? [{ symbol: "questionmark.circle", ton: "leise" as const, text: TEXT.ergebnis_unbekannt(a.unbekannt.length) }] : []),
                ].map((x, k, l) => (
                  <Fakt key={x.symbol} symbol={x.symbol} ton={x.ton} text={x.text} letzte={k === l.length - 1} />
                ))}
              </Karte>
              <View style={{ marginTop: 18 }}>
                <Hinweis text={TEXT.pflichten_quelle} />
              </View>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: -1000, height: 1000, backgroundColor: f.papier }} />
              </View>
            </View>
          ) : null}
        </ScrollView>
        <Fuss buehne={buehne && !a} ueber={zwischenschirm ? <TextKnopf buehne text={TEXT.zwischen_ergebnis} onPress={() => { setZwischen(false); setI(fragen.length); }} stil={{ alignSelf: "center" }} /> : undefined}>
          {i > 0 ? (
            <ZurueckKnopf buehne={buehne && !a} label={TEXT.vorheriger_schritt} onPress={() => { if (zeit.current) clearTimeout(zeit.current); setI(i - 1); }} />
          ) : null}
          {i < 0 ? (
            <Knopf buehne text={TEXT.check_starten} onPress={() => setI(0)} stil={{ flex: 1 }} />
          ) : zwischenschirm ? (
            <Knopf buehne text={TEXT.zwischen_genauer} onPress={() => setZwischen(false)} stil={{ flex: 1 }} />
          ) : frage ? (
            // ohne Antwort heißt der Knopf „Überspringen“ – nie ein grauer, scheinbar gesperrter „Weiter“-Knopf
            <Knopf ton={!beantwortet(z.stand.profil, frage.feld)} text={beantwortet(z.stand.profil, frage.feld) ? TEXT.weiter : TEXT.check_ueberspringen} onPress={weiter} stil={{ flex: 1 }} />
          ) : !a ? (
            // kurz bevor die Zusatzfragen feststehen: kein Knopf, der den Check vorzeitig schließt
            <Knopf text={TEXT.weiter} deaktiviert onPress={() => undefined} stil={{ flex: 1 }} />
          ) : (
            <Knopf
              text={TEXT.pflichten_ansehen}
              onPress={() => {
                // „Pflichten“ ist der erste Tab (E-129): Check schließen und dorthin wechseln
                z.erfolg();
                nav.zurueck();
                z.tabWechseln("pflichten");
              }}
              stil={{ flex: 1 }}
            />
          )}
        </Fuss>
      </TastaturRahmen>
    </View>
  );
}
