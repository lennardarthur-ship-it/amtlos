import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { useMeldung } from "../ui/meldung";
import { BausteinListe, Fristblatt, Fuss, Hinweis, Kachel, Karte, Knopf, Schalter, SchnellKachel, Symbol, T, TextKnopf, Zeile, tageBis } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, RADIUS, SCHRIFT, useFarben, weich } from "../ui/thema";
import { KATEGORIE_TITEL, auswertung, beantwortet, dringlichkeit, erinnerungsPlan, fortschritt, frageZu, gruendungsSchritte, haken, istErledigt, offeneFragenNachWirkung, selten, type PflichtInfo } from "../pflichten/check";
import { allesAbsagen, erinnerungenMoeglich, erlaubnisAnfragen, planen } from "../pflichten/erinnerungen";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Antwort, CheckAblauf } from "./Check";
import { SicherungsKarte } from "./Sicherung";
import { BuehnenBlatt, BuehnenKnopf, BuehnenSeite, Gruppe, Inhalt, datumKurz } from "./gemeinsam";
import { useOeffnen, useStarten } from "./starten";
import { useErstellen } from "./Erstellen";

const datumDe = (iso: string) => datumKurz(`${iso}T12:00:00Z`);

/** Auswertung des Katalogs für das gespeicherte Profil (und Ereignisse aus den Unterlagen) – nur neu, wenn sich Antworten, Unterlagen oder der Tag ändern. */
export function useAuswertung() {
  const { stand } = useAmtlos();
  const tag = heute();
  return useMemo(() => auswertung(stand.profil, tag, stand.unterlagen), [stand.profil, stand.unterlagen, tag]);
}

/** Hat jemand den Check schon gemacht? (die erste Frage ist beantwortet) */
export const checkGemacht = (profil: Record<string, unknown>) => beantwortet(profil as never, "taetigkeit.branchen") || beantwortet(profil as never, "rechtsform");

export function Balken({ prozent, grund, farbe, label }: { prozent: number; grund?: string; farbe?: string; label?: string }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: prozent, text: label }} style={{ height: 8, borderRadius: 4, backgroundColor: grund ?? f.linie, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(prozent, 2)}%`, height: 8, borderRadius: 4, backgroundColor: farbe ?? f.amt }} />
    </View>
  );
}

function PflichtDetail({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const melden = useMeldung();
  const a = useAuswertung();
  const p = [...a.gilt, ...a.gruendung, ...a.unbekannt].find((x) => x.id === id);
  if (!p) return <Unterseite titel="">{null}</Unterseite>;
  // schon angefangen? Dann die vorhandene Unterlage öffnen statt mit „Ausfüllen“ eine zweite anzulegen
  const vorhanden = p.vorlage ? z.stand.unterlagen.filter((u) => u.vorlage === p.vorlage && !u.storniertDurch).sort((x, y) => (y.ausgegeben ?? y.geaendert).localeCompare(x.ausgegeben ?? x.geaendert))[0] : undefined;
  const gilt = a.gilt.includes(p) || a.gruendung.includes(p);
  const abgehakt = istErledigt(p, { ...z.stand, unterlagen: [] });
  // wiederkehrend: der Haken gilt für den nächsten Termin, danach ist die Pflicht wieder offen
  const abhaken = () => {
    z.erledigtSetzen(p.id, abgehakt ? null : heute(), abgehakt ? null : p.wiederkehrend ? p.naechsterTermin : null);
    melden(abgehakt ? TEXT.haken_entfernt : TEXT.als_erledigt_vermerkt);
  };
  const durchUnterlage = !abgehakt && istErledigt(p, { ...z.stand, erledigt: {} });
  // erste Zeile ohne Linie oben – sonst doppelte Linie am Kartenrand
  let erste = true;
  const zeile = (titel: string, wert: string) => {
    const oben = erste ? 0 : 1;
    erste = false;
    return (
    <View style={{ paddingVertical: 10, borderTopWidth: oben, borderColor: f.linieLeise }}>
      <T v="caption" fett leise>{titel}</T>
      <T v="klein" stil={{ marginTop: 2 }}>{wert}</T>
    </View>
    );
  };
  const termin = p.naechsterTermin && !abgehakt ? p.naechsterTermin : null;
  const tage = termin ? tageBis(termin, heute()) : 0;
  const fuss = gilt ? (
    <Fuss>
      {p.vorlage ? (
        // Haken als zweiter Knopf im Fuß – nicht als Textlink halb unter der Leiste
        <>
          <Knopf ton text={abgehakt ? TEXT.haken_entfernen_kurz : TEXT.als_erledigt_kurz} symbol={abgehakt ? "xmark" : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
          {vorhanden ? <Knopf text={TEXT.unterlage_oeffnen_kurz} onPress={() => oeffnen(vorhanden.id)} stil={{ flex: 1.3 }} /> : <Knopf text={TEXT.unterlage_erstellen_kurz} symbol="plus" onPress={() => starten(p.vorlage!)} stil={{ flex: 1.3 }} />}
        </>
      ) : (
        <Knopf ton={abgehakt} text={abgehakt ? TEXT.haken_entfernen : TEXT.als_erledigt} symbol={abgehakt ? undefined : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
      )}
    </Fuss>
  ) : null;
  return (
    <BuehnenBlatt
      kopf={TEXT.pflicht_titel}
      ueber={KATEGORIE_TITEL[p.kategorie] ?? p.kategorie}
      titel={p.titel}
      unter={p.kurz}
      fuss={fuss}
      buehne={
        termin ? (
          // der nächste Termin groß: Tage bis dahin und das Datum – das Wichtigste zuerst
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 6 }}>
            {/* die Zahl steht daneben in Worten („In 11 Tagen fällig“) – für VoiceOver verborgen */}
            <T accessibilityElementsHidden importantForAccessibility="no" aria-hidden maxFontSizeMultiplier={1.4} farbe={tage < 0 ? "#ffc9c4" : f.minze} stil={{ ...SCHRIFT.display, fontSize: 52, lineHeight: 54, letterSpacing: -2 }}>{String(Math.abs(tage))}</T>
            <View style={{ paddingBottom: 6, flex: 1 }}>
              <T fett farbe={f.buehneText}>{fristText(termin)}</T>
              <T v="klein" farbe={f.buehneLeise}>{new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${termin}T12:00:00Z`))}</T>
            </View>
          </View>
        ) : abgehakt ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Symbol name="checkmark.circle.fill" groesse={20} farbe={f.minze} />
            <T fett farbe={f.buehneText}>{TEXT.erledigt_am(datumDe(haken(z.stand.erledigt[p.id])?.datum ?? heute()))}</T>
          </View>
        ) : undefined
      }
    >
      {durchUnterlage ? <Hinweis art="erfolg" text={TEXT.erledigt_durch_unterlage} /> : null}
      {gilt && vorhanden ? (
        <Karte stil={{ marginTop: 8 }}>
          <Zeile symbol="doc.text" ton="amt" titel={TEXT.deine_unterlage(vorlageFuer(vorhanden.vorlage)?.titel ?? vorhanden.vorlage)} text={vorhanden.ausgegeben ? TEXT.unterlage_geteilt_am(datumKurz(vorhanden.ausgegeben)) : TEXT.unterlage_entwurf_vom(datumKurz(vorhanden.geaendert))} onPress={() => oeffnen(vorhanden.id)} letzte />
        </Karte>
      ) : null}
      {/* einmalige Pflicht mit Vorlage: erledigt ist sie erst, wenn die Unterlage gedruckt oder geteilt ist */}
      {gilt && p.vorlage && !p.wiederkehrend && !abgehakt && !durchUnterlage ? <Hinweis text={TEXT.pflicht_drucken_erledigt} /> : null}
      {p.wiederkehrend && p.naechsterTermin ? <Hinweis text={TEXT.wiederkehrend_hinweis(datumDe(p.naechsterTermin))} /> : null}
      <Karte stil={{ marginTop: 8, paddingTop: 0 }}>
        {p.grund ? zeile(TEXT.warum, p.grund) : null}
        {/* der Termin steht oben auf der Bühne – hier nur, wenn die Pflicht abgehakt ist */}
        {p.naechsterTermin && abgehakt ? zeile(TEXT.naechster_termin("").replace(/:\s*$/, ""), datumDe(p.naechsterTermin)) : null}
        {p.stelle ? zeile(TEXT.zustaendig, p.stelle) : null}
        {zeile(TEXT.einstufung, TEXT.schwere[p.schwere])}
      </Karte>
      {p.erklaerung ? <T v="klein" stil={{ marginTop: 16 }}>{p.erklaerung}</T> : null}
      {gilt && p.vorlagen.length > 1 ? (
        // mehrere Vorlagen zu einer Pflicht (z. B. Gefahrstoffverzeichnis und Betriebsanweisung): alle zum Ausfüllen
        <Gruppe titel={TEXT.vorlagen_zur_pflicht}>
          <Karte>
            {p.vorlagen.map((vid, i) => (
              <Zeile key={vid} symbol="doc.text" ton="amt" titel={vorlageFuer(vid)?.titel ?? vid} rechts={<Symbol name="plus" groesse={16} />} onPress={() => starten(vid)} letzte={i === p.vorlagen.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      {p.rechtsgrundlage.length ? (
        <Gruppe titel={TEXT.grundlage}>
          <T v="klein">{p.rechtsgrundlage.join(" · ")}</T>
        </Gruppe>
      ) : null}
      {p.quellen.length ? (
        <Gruppe titel={TEXT.quellen}>
          <Karte>
            {p.quellen.map((q, i) => (
              <Zeile key={q.url} titel={q.titel} text={q.url.replace(/^https?:\/\//, "").split("/")[0]} rechts={<Symbol name="arrow.right" groesse={16} />} onPress={() => void Linking.openURL(q.url)} letzte={i === p.quellen.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      <T v="caption" leise stil={{ marginTop: 16 }}>{TEXT.pflichten_quelle}</T>
    </BuehnenBlatt>
  );
}

/** Termin in Alltagssprache: „In 11 Tagen fällig“, „Morgen fällig“, „Seit 3 Tagen überfällig“ – weiter weg mit Datum. */
export function fristText(termin: string, tag = heute()): string {
  const n = tageBis(termin, tag);
  if (n < 0) return TEXT.frist_ueber(-n);
  if (n === 0) return TEXT.frist_heute;
  if (n === 1) return TEXT.frist_morgen;
  if (n <= 30) return TEXT.frist_in(n);
  return TEXT.naechster_termin(datumDe(termin));
}

/** Symbol je Bereich des Katalogs – vor Pflichten ohne Termin. */
const BEREICH_SYMBOL_KAT: Record<string, string> = { gruendung: "flag", gesellschaft: "building.columns", steuern: "eurosign", personal: "person.2", arbeitsschutz: "hammer", datenschutz: "lock.shield", it_sicherheit: "lock", ki: "sparkles", online: "globe", produkte: "tray", branche: "storefront" };

export function PflichtZeile({ p, letzte, erledigt, ohneWichtig }: { p: PflichtInfo; letzte: boolean; erledigt: boolean; ohneWichtig?: boolean }) {
  const nav = useNav();
  const termin = !erledigt && p.naechsterTermin ? p.naechsterTermin : null;
  // das Datum steht im Fristblatt – im Text nur kurz (ohne Jahr, wenn es dieses Jahr ist)
  const fern = termin ? tageBis(termin, heute()) > 30 : false;
  const unter = erledigt ? TEXT.erledigt : termin ? (fern ? fristText(termin) : `${fristText(termin)}\u00a0· ${datumDe(termin).slice(0, 6)}`) : p.vorlage ? TEXT.unterlage_in_amtlos : p.kurz;
  const wichtig = !erledigt && !ohneWichtig && p.schwere === "hoch";
  return (
    <Zeile
      // mit Termin: das Fristblatt (Datum auf einen Blick); ohne Termin eine ruhige graue Kachel mit dem Bereich (A24) –
      // kein bernsteinfarbenes „!“, das wie eine Frist aussieht
      links={termin ? <Fristblatt termin={termin} heute={heute()} /> : <Kachel symbol={erledigt ? "checkmark" : BEREICH_SYMBOL_KAT[p.kategorie] ?? "doc.text"} ton={erledigt ? "amt" : "leise"} groesse={46} />}
      titel={p.titel}
      text={unter}
      // „Wichtig“ als Plakette unter dem Titel – VoiceOver liest sie mit
      marke={wichtig ? { text: TEXT.wichtig, ton: "bald" } : undefined}
      onPress={() => nav.oeffnen(`pflicht-${p.id}`, () => <PflichtDetail id={p.id} />, true)}
      letzte={letzte}
    />
  );
}

/** Alle geltenden Pflichten nach Bereich, oben der Fortschritt; unklare Pflichten mit den Fragen, die sie klären. */
/** Inhalt von „Deine Pflichten“ – als Tab (Start) und als Unterseite. */
function PflichtenInhalt() {
  const z = useAmtlos();
  const nav = useNav();
  const a = useAuswertung();
  const [zeigen, setZeigen] = useState(false);
  const [gruendungZeigen, setGruendungZeigen] = useState(false);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const { erledigt, unterlagen, profil, betrieb } = z.stand;
  const tag = heute();
  // Dringlichkeit und offene Fragen nur neu rechnen, wenn sich Haken, Unterlagen oder Antworten ändern – nicht bei jedem Tippen anderswo
  const { offen, kategorien, sonst, d } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    return {
      offen: offeneFragenNachWirkung(a, profil),
      kategorien: Object.keys(KATEGORIE_TITEL).filter((k) => a.gilt.some((p) => p.kategorie === k)),
      sonst: a.gilt.filter((p) => !KATEGORIE_TITEL[p.kategorie]),
      d: dringlichkeit(a, e, tag),
    };
  }, [a, erledigt, unterlagen, profil, betrieb, tag]);
  const fertig = (p: PflichtInfo) => istErledigt(p, { erledigt, unterlagen, betrieb });
  return (
    <View>
      {d.jetzt.length ? (
        <Gruppe erste titel={TEXT.jetzt_dran(d.jetzt.length)}>
          <Karte>
            {d.jetzt.map((p, i) => (
              // sind alle „wichtig“, sagt das Wort nichts – dann zählt der Termin
              <PflichtZeile key={p.id} p={p} erledigt={false} ohneWichtig={d.jetzt.every((x) => x.schwere === "hoch")} letzte={i === d.jetzt.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : (
        <Gruppe erste titel={TEXT.jetzt_dran(0)}>
          <Hinweis art="erfolg" text={nichtsDranText(z.stand.erinnerungen)} />
        </Gruppe>
      )}
      <SchonErledigt />
      {d.naechsteWochen.length ? (
        <Gruppe titel={TEXT.naechste_wochen(d.naechsteWochen.length)}>
          <Karte>
            {d.naechsteWochen.map((p, i) => (
              <PflichtZeile key={p.id} p={p} erledigt={false} letzte={i === d.naechsteWochen.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      <ErinnerungsSchalter />
      <KurzKlaeren offen={offen} unklar={a.unbekannt.length} />
      <T v="gross" accessibilityRole="header" stil={{ marginTop: 30 }}>{TEXT.alle_nach_bereich}</T>
      {/* die vollständige Liste erst auf Wunsch – oben steht, was jetzt zu tun ist */}
      <TextKnopf erweitert={alleZeigen} symbol={alleZeigen ? "chevron.up" : "chevron.down"} text={alleZeigen ? TEXT.liste_verbergen : TEXT.alle_pflichten_zeigen(a.gilt.length)} onPress={() => { weich(); setAlleZeigen(!alleZeigen); }} />
      {alleZeigen && kategorien.map((k) => {
        const l = a.gilt.filter((p) => p.kategorie === k);
        return (
          <Gruppe key={k} titel={KATEGORIE_TITEL[k]}>
            <Karte>
              {l.map((p, i) => (
                <PflichtZeile key={p.id} p={p} erledigt={fertig(p)} letzte={i === l.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        );
      })}
      {alleZeigen && sonst.length ? (
        <Gruppe titel={TEXT.weitere_pflichten}>
          <Karte>
            {sonst.map((p, i) => (
              <PflichtZeile key={p.id} p={p} erledigt={fertig(p)} letzte={i === sonst.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      {a.gruendung.length ? (
        <Gruppe titel={TEXT.gruendung_titel(a.gruendung.length)} fuss={TEXT.gruendung_text}>
          {a.gruendung.some((p) => !fertig(p)) ? <Knopf ton symbol="checkmark" text={TEXT.gruendung_alle} onPress={() => a.gruendung.filter((p) => !fertig(p)).forEach((p) => z.erledigtSetzen(p.id, heute()))} /> : null}
          <TextKnopf erweitert={gruendungZeigen} symbol={gruendungZeigen ? "chevron.up" : "chevron.down"} text={gruendungZeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => { weich(); setGruendungZeigen(!gruendungZeigen); }} />
          {gruendungZeigen ? (
            <Karte>
              {a.gruendung.map((p, i) => (
                <PflichtZeile key={p.id} p={p} erledigt={fertig(p)} letzte={i === a.gruendung.length - 1} />
              ))}
            </Karte>
          ) : null}
        </Gruppe>
      ) : null}
      {a.unbekannt.length ? (
        <Gruppe titel={TEXT.offen_angaben_titel(a.unbekannt.length)} fuss={TEXT.offen_angaben_text}>
          <TextKnopf erweitert={zeigen} symbol={zeigen ? "chevron.up" : "chevron.down"} text={zeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => { weich(); setZeigen(!zeigen); }} />
          {zeigen ? (
            <Karte>
              {a.unbekannt.map((p, i) => (
                <Zeile key={p.id} titel={p.titel} text={p.kurz} onPress={() => nav.oeffnen(`pflicht-${p.id}`, () => <PflichtDetail id={p.id} />, true)} letzte={i === a.unbekannt.length - 1} />
              ))}
            </Karte>
          ) : null}
        </Gruppe>
      ) : null}
      <TextKnopf symbol="pencil" text={TEXT.angaben_aendern} onPress={() => nav.oeffnen("check", () => <CheckAblauf einleitung={false} />, true)} stil={{ marginTop: 20 }} />
      <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.pflichten_quelle}</T>
    </View>
  );
}

/**
 * „Kurz klären“ (E-129): statt einer langen Liste unklarer Pflichten die drei Fragen, die am meisten klären – direkt
 * hier beantwortbar. Die gezeigten Fragen bleiben stehen, solange die Seite sichtbar ist (Stand beim Erscheinen):
 * sonst verschwände eine Frage mitten in der Antwort (Mehrfachauswahl, Zahl nach der ersten Ziffer). Neu gewählt wird
 * erst, wenn man zurückkommt; beantwortete Fragen zeigen dann kein „klärt …“ mehr.
 */
function KurzKlaeren({ offen, unklar }: { offen: { feld: string; anzahl: number }[]; unklar: number }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const sichtbar = useIsFocused();
  const [felder, setFelder] = useState(() => offen.slice(0, 3).map((o) => o.feld));
  useEffect(() => {
    if (sichtbar) setFelder(offen.slice(0, 3).map((o) => o.feld));
    // nur beim Erscheinen neu wählen – nicht bei jeder Antwort
  }, [sichtbar]);
  if (!felder.length) return null;
  const weitere = offen.filter((o) => !felder.includes(o.feld));
  return (
    <Gruppe titel={TEXT.kurz_klaeren_titel} fuss={TEXT.kurz_klaeren_text(unklar)}>
      <View style={{ gap: 22 }}>
        {felder.map((feld) => {
          const fr = frageZu(feld);
          if (!fr) return null;
          const anzahl = offen.find((o) => o.feld === feld)?.anzahl ?? 0;
          return (
            <View key={feld} style={{ gap: 6 }}>
              <T fett>{fr.frage.de}</T>
              {anzahl && !beantwortet(z.stand.profil, feld) ? <T v="caption" farbe={f.amt}>{TEXT.klaert(anzahl)}</T> : null}
              <Antwort f={fr} wert={z.stand.profil[feld]} setzen={(w) => z.profilSetzen({ [feld]: w })} aufBlur />
            </View>
          );
        })}
      </View>
      {weitere.length ? <TextKnopf symbol="questionmark.circle" text={TEXT.weitere_fragen(weitere.length)} onPress={() => nav.oeffnen("nachfragen", () => <CheckAblauf felder={weitere.map((o) => o.feld)} />, true)} /> : null}
    </Gruppe>
  );
}

/** „Gerade ist nichts dringend.“ – und nur dann eine Erinnerung versprechen, wenn sie eingeschaltet ist. */
export function nichtsDranText(erinnerungen: boolean): string {
  return erinnerungenMoeglich ? `${TEXT.nichts_dran} ${TEXT.nichts_dran_erinnerung(erinnerungen)}` : TEXT.nichts_dran;
}

/**
 * „Schon erledigt?“ für junge Betriebe (weniger als sechs Monate): die offenen Gründungsschritte zum Ankreuzen –
 * mehrere auf einmal abhaken statt jede Pflicht einzeln zu öffnen.
 */
function SchonErledigt() {
  const z = useAmtlos();
  const melden = useMeldung();
  const a = useAuswertung();
  const { erledigt, unterlagen, betrieb, profil } = z.stand;
  const tag = heute();
  const l = useMemo(() => gruendungsSchritte(a, profil, { erledigt, unterlagen, betrieb }, tag), [a, profil, erledigt, unterlagen, betrieb, tag]);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  if (!l.length) return null;
  const auswahl = gewaehlt.filter((id) => l.some((p) => p.id === id));
  return (
    <Gruppe titel={TEXT.schon_erledigt_titel} hilfe={TEXT.schon_erledigt_text}>
      <Karte stil={{ paddingBottom: 14 }}>
        <BausteinListe label={TEXT.schon_erledigt_titel} werte={auswahl} aendern={setGewaehlt} optionen={l.map((p) => ({ wert: p.id, text: p.titel }))} />
        <Knopf
          ton
          text={TEXT.schon_erledigt_knopf(auswahl.length)}
          deaktiviert={!auswahl.length}
          onPress={() => {
            for (const id of auswahl) z.erledigtSetzen(id, heute());
            melden(TEXT.schon_erledigt_fertig(auswahl.length));
            setGewaehlt([]);
          }}
          stil={{ marginTop: 12 }}
        />
      </Karte>
    </Gruppe>
  );
}

export function PflichtenSeite() {
  return (
    <Unterseite titel={TEXT.pflichten_titel}>
      <Inhalt>
        <PflichtenInhalt />
      </Inhalt>
    </Unterseite>
  );
}

/** Einladung zum Pflichten-Check auf dem Blatt von „Heute“: getöntes Symbol, Titel, Satz, Knopf. */
export function Einladung() {
  const nav = useNav();
  return (
    <Karte stil={{ paddingVertical: 20, gap: 10 }}>
      <Kachel symbol="checklist" groesse={48} />
      <T v="gross" accessibilityRole="header" stil={{ fontSize: 22, lineHeight: 28, marginTop: 4 }}>{TEXT.pflichten_karte_titel}</T>
      <T v="klein" leise>{TEXT.pflichten_einladung}</T>
      <Knopf text={TEXT.pflichten_check_starten} onPress={() => nav.oeffnen("check", () => <CheckAblauf />, true)} stil={{ marginTop: 8 }} />
    </Karte>
  );
}

/**
 * Erster Bildschirm vor dem Check: die Einladung zum Check und in drei Sätzen, was Amtlos tut – mit direkten Wegen
 * zur Rechnung und zu den Vorlagen, damit niemand vor einer leeren Seite steht.
 */
function Start() {
  const erstellen = useErstellen();
  const f = useFarben();
  const starten = useStarten();
  return (
    <View>
      {/* wer gleich etwas erledigen will, findet es ohne Scrollen */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SchnellKachel symbol="eurosign" text={TEXT.start_rechnung} onPress={() => starten("rechnung")} />
        <SchnellKachel ton="leise" symbol="doc.text" text={TEXT.start_vorlagen} onPress={erstellen.oeffnen} />
      </View>
      <Gruppe titel={TEXT.start_so_hilft}>
        <Karte>
          {TEXT.start_punkte.map((p, i) => (
            <View key={p.titel}>
              <View style={{ paddingVertical: 14, borderBottomWidth: i === TEXT.start_punkte.length - 1 ? 0 : HAARLINIE, borderColor: f.linie }}>
                <T fett>{p.titel}</T>
                <T v="klein" leise stil={{ marginTop: 2 }}>{p.text}</T>
              </View>
            </View>
          ))}
        </Karte>
      </Gruppe>
    </View>
  );
}

/** Monatskürzel und Termine je Monat für die nächsten zwölf Monate (ab dem laufenden Monat). */
function jahresblick(gilt: PflichtInfo[], tag: string) {
  const [j, m] = tag.split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(j, m - 1 + i, 15));
    const schluessel = d.toISOString().slice(0, 7);
    const termine = gilt.reduce((n, p) => n + p.termine.filter((t) => t.startsWith(schluessel)).length, 0);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", ...o }).format(d);
    return { schluessel, kurz: fmt({ month: "short" }).replace(".", ""), lang: fmt({ month: "long", year: "numeric" }), termine, jetzt: i === 0 };
  });
}

/**
 * Jahresblick auf der Bühne (E-142): zwölf Monatskacheln ab jetzt, je Monat die Zahl der Termine aus den geltenden
 * Pflichten. Der laufende Monat in Minze, Monate mit Terminen getönt, ruhige Monate gestrichelt.
 */
function Jahresblick({ gilt, tag }: { gilt: PflichtInfo[]; tag: string }) {
  const f = useFarben();
  const monate = useMemo(() => jahresblick(gilt, tag), [gilt, tag]);
  // VoiceOver: eine Zusammenfassung für die ganze Reihe (nur Monate mit Terminen) statt zwölf einzelner Kacheln
  const zusammen = TEXT.jahr_zusammen(monate.filter((m) => m.termine).map((m) => TEXT.monat_termine(m.lang, m.termine)));
  return (
    <View accessible accessibilityRole="summary" accessibilityLabel={zusammen} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {monate.map((mo) => (
        <View
          key={mo.schluessel}
          accessible
          accessibilityRole="text"
          accessibilityLabel={TEXT.monat_termine(mo.lang, mo.termine)}
          style={{ width: "15.2%", flexGrow: 1, minHeight: 54, borderRadius: RADIUS.klein, padding: 7, justifyContent: "space-between", backgroundColor: mo.jetzt ? f.minze : mo.termine ? "rgba(127,227,184,0.16)" : "transparent", borderWidth: mo.jetzt || mo.termine ? 0 : 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.3)" }}
        >
          <T v="caption" maxFontSizeMultiplier={1.5} farbe={mo.jetzt ? f.buehneKnopfText : f.buehneLeise} stil={{ ...SCHRIFT.halb, fontSize: 12, lineHeight: 14 }}>{mo.kurz}</T>
          {mo.termine ? <T maxFontSizeMultiplier={1.5} farbe={mo.jetzt ? f.buehneKnopfText : f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 17, lineHeight: 19 }}>{String(mo.termine)}</T> : null}
        </View>
      ))}
    </View>
  );
}

/** Erster Tab (E-129, E-142): auf der Bühne der Fortschritt und das Jahr; vor dem Check die Einladung dazu. */
export function PflichtenTab() {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const a = useAuswertung();
  const gemacht = checkGemacht(z.stand.profil);
  const { erledigt, unterlagen, betrieb } = z.stand;
  const tag = heute();
  const { fs, bald } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    return { fs: fortschritt(a, e), bald: dringlichkeit(a, e, tag).jetzt.length };
  }, [a, erledigt, unterlagen, betrieb, tag]);
  const check = () => nav.oeffnen("check", () => <CheckAblauf einleitung={!gemacht} />, true);
  return (
    <BuehnenSeite
      ueber={gemacht ? TEXT.fortschritt_text(fs.fertig, fs.gesamt) : TEXT.tabs.pflichten}
      rechts={gemacht ? <BuehnenKnopf text={TEXT.jahr_neu_pruefen} onPress={check} /> : undefined}
      // groß, was in den nächsten zwei Wochen ansteht – die Gesamtzahl klein darunter (sie erschlägt sonst)
      titel={gemacht ? TEXT.ergebnis_bald(bald) : TEXT.pflichten_karte_titel}
      satz
      buehne={
        gemacht ? (
          <View style={{ gap: 14 }}>
            <T v="klein" farbe={f.buehneLeise} stil={{ marginTop: -10 }}>{TEXT.ergebnis_gesamt(a.gilt.length, selten(a.gilt))}</T>
            <T v="klein" fett accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 8 }}>{TEXT.jahr_titel}</T>
            <Jahresblick gilt={a.gilt} tag={tag} />
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <T farbe={f.buehneLeise}>{TEXT.pflichten_einladung}</T>
            <Knopf buehne text={TEXT.pflichten_check_starten} onPress={check} />
          </View>
        )
      }
    >
      <SicherungsKarte />
      {gemacht ? <PflichtenInhalt /> : <Start />}
    </BuehnenSeite>
  );
}

/** Lokale Erinnerungen an Fristen einschalten (ohne Server). */
function ErinnerungsSchalter() {
  const z = useAmtlos();
  const [fehler, setFehler] = useState(false);
  if (!erinnerungenMoeglich) return null;
  return (
    <Karte stil={{ marginTop: 16, paddingBottom: 12 }}>
      <Schalter
        label={TEXT.erinnern}
        hilfe={TEXT.erinnern_hilfe}
        wert={z.stand.erinnerungen}
        aendern={(an) => {
          setFehler(false);
          if (!an) return z.erinnerungenSetzen(false);
          void erlaubnisAnfragen().then((ok) => (ok ? z.erinnerungenSetzen(true) : setFehler(true)));
        }}
      />
      {/* bleibt stehen, bis man es erneut versucht – mit dem Weg in die Einstellungen */}
      {fehler ? (
        <View>
          <Hinweis art="fehler" text={TEXT.erinnern_verweigert} />
          <TextKnopf symbol="gearshape" text={TEXT.einstellungen_oeffnen} onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
    </Karte>
  );
}

/** Setzt die lokalen Erinnerungen neu, wenn sich Antworten, Haken oder Unterlagen ändern (rendert nichts). */
export function ErinnerungsPlaner() {
  const z = useAmtlos();
  const a = useAuswertung();
  const plan = useMemo(() => (z.stand.erinnerungen ? erinnerungsPlan(a, z.stand, heute()) : []), [a, z.stand]);
  const schluessel = JSON.stringify(plan);
  useEffect(() => {
    if (!erinnerungenMoeglich || !z.bereit) return;
    const zeit = setTimeout(() => void (z.stand.erinnerungen ? planen(plan) : allesAbsagen()).catch(() => undefined), 800);
    return () => clearTimeout(zeit);
    // nur bei geändertem Plan neu setzen (der Plan steckt im Schlüssel)
  }, [schluessel, z.stand.erinnerungen, z.bereit]);
  return null;
}

/** Zeile unter „Mein Betrieb“: Antworten im Check ansehen und ändern. */
export function CheckProfilZeile() {
  const z = useAmtlos();
  const nav = useNav();
  const n = Object.values(z.stand.profil).filter((w) => w !== null && w !== undefined).length;
  return (
    <Gruppe titel={TEXT.check_profil_titel}>
      <Karte>
        <Zeile symbol="checklist" titel={checkGemacht(z.stand.profil) ? TEXT.angaben_aendern : TEXT.pflichten_check_starten} text={checkGemacht(z.stand.profil) ? TEXT.check_profil_text(n) : TEXT.check_profil_leer} onPress={() => nav.oeffnen("check", () => <CheckAblauf einleitung={!checkGemacht(z.stand.profil)} />, true)} letzte />
      </Karte>
    </Gruppe>
  );
}
