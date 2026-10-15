import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { T as TEXT } from "../texte";
import { useMeldung } from "../ui/meldung";
import { Betrag, Fristblatt, Fuss, Hinweis, Kachel, Karte, Knopf, Motiv, Schalter, SchnellKachel, Symbol, T, TextKnopf, Zeile, tageBis } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, RADIUS, RAND, SCHRIFT, useFarben, weich } from "../ui/thema";
import { KATEGORIE_TITEL, auswertung, beantwortet, dringlichkeit, erinnerungsPlan, fortschritt, frageZu, haken, istErledigt, offeneFragenNachWirkung, type PflichtInfo } from "../pflichten/check";
import { allesAbsagen, erinnerungenMoeglich, erlaubnisAnfragen, planen } from "../pflichten/erinnerungen";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Antwort, CheckAblauf } from "./Check";
import { SicherungsKarte } from "./Sicherung";
import { Gruppe, Inhalt, Seite, datumKurz } from "./gemeinsam";
import { useStarten } from "./starten";
import { useErstellen } from "./Erstellen";

const datumDe = (iso: string) => datumKurz(`${iso}T12:00:00Z`);

/** Auswertung des Katalogs für das gespeicherte Profil – nur neu, wenn sich Antworten oder der Tag ändern. */
export function useAuswertung() {
  const { stand } = useAmtlos();
  const tag = heute();
  return useMemo(() => auswertung(stand.profil, tag), [stand.profil, tag]);
}

/** Hat jemand den Check schon gemacht? (die erste Frage ist beantwortet) */
export const checkGemacht = (profil: Record<string, unknown>) => beantwortet(profil as never, "taetigkeit.branchen") || beantwortet(profil as never, "rechtsform");

function Balken({ prozent, grund, farbe }: { prozent: number; grund?: string; farbe?: string }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: prozent }} style={{ height: 8, borderRadius: 4, backgroundColor: grund ?? f.flaeche, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(prozent, 2)}%`, height: 8, borderRadius: 4, backgroundColor: farbe ?? f.amt }} />
    </View>
  );
}

function PflichtDetail({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const starten = useStarten();
  const melden = useMeldung();
  const a = useAuswertung();
  const p = [...a.gilt, ...a.gruendung, ...a.unbekannt].find((x) => x.id === id);
  if (!p) return <Unterseite titel="">{null}</Unterseite>;
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
  return (
    <Unterseite titel={TEXT.pflicht_titel}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: 32 }}>
        <T v="caption" leise>{KATEGORIE_TITEL[p.kategorie] ?? p.kategorie}</T>
        <T v="titel" accessibilityRole="header" stil={{ marginTop: 4 }}>{p.titel}</T>
        <T stil={{ marginTop: 8 }}>{p.kurz}</T>
        {p.naechsterTermin && !abgehakt ? (
          // der nächste Termin als Fristblatt mit Abstand in Tagen – das Wichtigste zuerst
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}>
            <Fristblatt termin={p.naechsterTermin} heute={heute()} groesse={56} />
            <View style={{ flex: 1 }}>
              <T fett farbe={tageBis(p.naechsterTermin, heute()) < 0 ? f.frist : undefined}>{fristText(p.naechsterTermin)}</T>
              <T v="klein" leise>{new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${p.naechsterTermin}T12:00:00Z`))}</T>
            </View>
          </View>
        ) : null}
        {abgehakt ? <Hinweis art="erfolg" symbol="checkmark.circle" text={TEXT.erledigt_am(datumDe(haken(z.stand.erledigt[p.id])?.datum ?? heute()))} /> : null}
        {durchUnterlage ? <Hinweis art="erfolg" text={TEXT.erledigt_durch_unterlage} /> : null}
        {p.wiederkehrend && p.naechsterTermin ? <Hinweis text={TEXT.wiederkehrend_hinweis(datumDe(p.naechsterTermin))} /> : null}
        <Karte stil={{ marginTop: 16, paddingTop: 0 }}>
          {p.grund ? zeile(TEXT.warum, p.grund) : null}
          {p.naechsterTermin ? zeile(TEXT.naechster_termin("").trim(), datumDe(p.naechsterTermin)) : null}
          {p.stelle ? zeile(TEXT.zustaendig, p.stelle) : null}
          {zeile(TEXT.einstufung, TEXT.schwere[p.schwere])}
        </Karte>
        {p.erklaerung ? <T v="klein" stil={{ marginTop: 16 }}>{p.erklaerung}</T> : null}
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
      </Inhalt>
      {gilt ? (
        <Fuss>
          {p.vorlage ? (
            // Haken als zweiter Knopf im Fuß – nicht als Textlink halb unter der Leiste
            <>
              <Knopf ton text={abgehakt ? TEXT.haken_entfernen_kurz : TEXT.als_erledigt_kurz} symbol={abgehakt ? "xmark" : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
              <Knopf text={TEXT.unterlage_erstellen_kurz} symbol="plus" onPress={() => starten(p.vorlage!)} stil={{ flex: 1.3 }} />
            </>
          ) : (
            <Knopf ton={abgehakt} text={abgehakt ? TEXT.haken_entfernen : TEXT.als_erledigt} symbol={abgehakt ? undefined : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
          )}
        </Fuss>
      ) : null}
    </Unterseite>
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

export function PflichtZeile({ p, letzte, erledigt, ohneWichtig }: { p: PflichtInfo; letzte: boolean; erledigt: boolean; ohneWichtig?: boolean }) {
  const f = useFarben();
  const nav = useNav();
  const termin = !erledigt && p.naechsterTermin ? p.naechsterTermin : null;
  // das Datum steht im Fristblatt – im Text nur kurz (ohne Jahr, wenn es dieses Jahr ist)
  const fern = termin ? tageBis(termin, heute()) > 30 : false;
  const unter = erledigt ? TEXT.erledigt : termin ? (fern ? fristText(termin) : `${fristText(termin)} · ${datumDe(termin).slice(0, 6)}`) : p.vorlage ? TEXT.unterlage_in_amtlos : p.schwere === "hoch" ? TEXT.wichtig : p.kurz;
  return (
    <Zeile
      // mit Termin: das Fristblatt (Datum auf einen Blick); sonst der Status als Form
      links={termin ? <Fristblatt termin={termin} heute={heute()} /> : <Symbol name={erledigt ? "checkmark.circle.fill" : p.schwere === "hoch" ? "exclamationmark.circle" : "circle"} groesse={22} farbe={erledigt ? f.amt : p.schwere === "hoch" ? f.bald : f.rahmen} />}
      // „Wichtig“ steckt sonst nur im Symbol – für VoiceOver mit ansagen
      titel={p.titel}
      text={!erledigt && !ohneWichtig && p.schwere === "hoch" && unter !== TEXT.wichtig ? `${TEXT.wichtig} · ${unter}` : unter}
      onPress={() => nav.oeffnen(`pflicht-${p.id}`, () => <PflichtDetail id={p.id} />, true)}
      letzte={letzte}
    />
  );
}

/** Alle geltenden Pflichten nach Bereich, oben der Fortschritt; unklare Pflichten mit den Fragen, die sie klären. */
/** Inhalt von „Deine Pflichten“ – als Tab (Start) und als Unterseite. */
function PflichtenInhalt() {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const a = useAuswertung();
  const [zeigen, setZeigen] = useState(false);
  const [gruendungZeigen, setGruendungZeigen] = useState(false);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const { erledigt, unterlagen, profil, betrieb } = z.stand;
  const tag = heute();
  // Fortschritt, Dringlichkeit und offene Fragen nur neu rechnen, wenn sich Haken, Unterlagen oder Antworten ändern – nicht bei jedem Tippen anderswo
  const { fs, offen, kategorien, sonst, d } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    return {
      fs: fortschritt(a, e),
      offen: offeneFragenNachWirkung(a, profil),
      kategorien: Object.keys(KATEGORIE_TITEL).filter((k) => a.gilt.some((p) => p.kategorie === k)),
      sonst: a.gilt.filter((p) => !KATEGORIE_TITEL[p.kategorie]),
      d: dringlichkeit(a, e, tag),
    };
  }, [a, erledigt, unterlagen, profil, betrieb, tag]);
  const fertig = (p: PflichtInfo) => istErledigt(p, { erledigt, unterlagen, betrieb });
  return (
    <View>
      {/* Fortschritt auf der Bühne: große Zahl in Minze, darunter der Balken */}
      <View style={{ padding: 22, borderRadius: RADIUS.buehne, backgroundColor: f.buehne, gap: 14, overflow: "hidden" }}>
        <T v="gross" farbe={f.buehneText} accessibilityRole="header">{TEXT.ergebnis_titel(a.gilt.length)}</T>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <Betrag farbe={f.minze} stil={{ fontFamily: SCHRIFT.display, fontSize: 48, lineHeight: 52, letterSpacing: -1.6 }}>{`${fs.prozent} %`}</Betrag>
          <T v="klein" farbe={f.buehneLeise} stil={{ marginBottom: 8, textAlign: "right", flexShrink: 1 }}>{TEXT.fortschritt_text(fs.fertig, fs.gesamt)}</T>
        </View>
        <Balken prozent={fs.prozent} grund="rgba(255,255,255,0.14)" farbe={f.minze} />
      </View>
      <T v="caption" leise stil={{ marginTop: 8, marginLeft: 2 }}>{TEXT.pflichten_quelle}</T>
      <ErinnerungsSchalter />
      {d.jetzt.length ? (
        <Gruppe titel={TEXT.jetzt_dran(d.jetzt.length)}>
          <Karte>
            {d.jetzt.map((p, i) => (
              // sind alle „wichtig“, sagt das Wort nichts – dann zählt der Termin
              <PflichtZeile key={p.id} p={p} erledigt={false} ohneWichtig={d.jetzt.every((x) => x.schwere === "hoch")} letzte={i === d.jetzt.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : (
        <Gruppe titel={TEXT.jetzt_dran(0)}>
          <Hinweis art="erfolg" text={TEXT.nichts_dran} />
        </Gruppe>
      )}
      {d.diesenMonat.length ? (
        <Gruppe titel={TEXT.diesen_monat(d.diesenMonat.length)}>
          <Karte>
            {d.diesenMonat.map((p, i) => (
              <PflichtZeile key={p.id} p={p} erledigt={false} letzte={i === d.diesenMonat.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      {offen.length ? <KurzKlaeren offen={offen} unklar={a.unbekannt.length} /> : null}
      <T v="gross" accessibilityRole="header" stil={{ marginTop: 30, marginLeft: 2 }}>{TEXT.alle_nach_bereich}</T>
      {/* die vollständige Liste erst auf Wunsch – oben steht, was jetzt zu tun ist */}
      <TextKnopf symbol={alleZeigen ? "chevron.up" : "chevron.down"} text={alleZeigen ? TEXT.liste_verbergen : TEXT.alle_pflichten_zeigen(a.gilt.length)} onPress={() => { weich(); setAlleZeigen(!alleZeigen); }} stil={{ marginLeft: 4 }} />
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
          <TextKnopf symbol={gruendungZeigen ? "chevron.up" : "chevron.down"} text={gruendungZeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => { weich(); setGruendungZeigen(!gruendungZeigen); }} stil={{ marginLeft: 4 }} />
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
          <TextKnopf symbol={zeigen ? "chevron.up" : "chevron.down"} text={zeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => { weich(); setZeigen(!zeigen); }} stil={{ marginLeft: 4 }} />
          {zeigen ? (
            <Karte>
              {a.unbekannt.map((p, i) => (
                <Zeile key={p.id} titel={p.titel} text={p.kurz} onPress={() => nav.oeffnen(`pflicht-${p.id}`, () => <PflichtDetail id={p.id} />, true)} letzte={i === a.unbekannt.length - 1} />
              ))}
            </Karte>
          ) : null}
        </Gruppe>
      ) : null}
      <TextKnopf symbol="pencil" text={TEXT.angaben_aendern} onPress={() => nav.oeffnen("check", () => <CheckAblauf einleitung={false} />, true)} stil={{ marginTop: 20, marginLeft: 4 }} />
    </View>
  );
}

/**
 * „Kurz klären“ (E-129): statt einer langen Liste unklarer Pflichten die drei Fragen, die am meisten klären – direkt
 * hier beantwortbar. Jede Antwort rechnet sofort neu.
 */
function KurzKlaeren({ offen, unklar }: { offen: { feld: string; anzahl: number }[]; unklar: number }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const oben = offen.slice(0, 3);
  return (
    <Gruppe titel={TEXT.kurz_klaeren_titel} fuss={TEXT.kurz_klaeren_text(unklar)}>
      <View style={{ gap: 22 }}>
        {oben.map((o) => {
          const fr = frageZu(o.feld);
          if (!fr) return null;
          return (
            <View key={o.feld} style={{ gap: 6 }}>
              <T fett>{fr.frage.de}</T>
              <T v="caption" farbe={f.amt}>{TEXT.klaert(o.anzahl)}</T>
              <Antwort f={fr} wert={z.stand.profil[o.feld]} setzen={(w) => z.profilSetzen({ [o.feld]: w })} />
            </View>
          );
        })}
      </View>
      {offen.length > oben.length ? <TextKnopf symbol="questionmark.circle" text={TEXT.weitere_fragen(offen.length - oben.length)} onPress={() => nav.oeffnen("nachfragen", () => <CheckAblauf felder={offen.slice(oben.length).map((o) => o.feld)} />, true)} stil={{ marginLeft: 4 }} /> : null}
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

/** Einladung zum Pflichten-Check auf der Bühne – mit dem §-Motiv in Minze (Start und „Heute“). */
export function Einladung() {
  const nav = useNav();
  const f = useFarben();
  // die Bühne: die eine dunkle Fläche der App; oben rechts das angeschnittene Motiv, darunter Titel, Text, Knopf
  return (
    <View style={{ padding: 22, paddingTop: 136, borderRadius: RADIUS.buehne, backgroundColor: f.buehne, gap: 12, overflow: "hidden" }}>
        <Motiv zeichen="§" groesse={220} farbe={f.minze} stil={{ right: 10, top: -66 }} />
        <T v="titel" farbe={f.buehneText} accessibilityRole="header" stil={{ maxWidth: 260 }}>{TEXT.pflichten_karte_titel}</T>
        <T farbe={f.buehneLeise}>{TEXT.pflichten_einladung}</T>
        <Knopf buehne text={TEXT.pflichten_check_starten} symbol="arrow.right" onPress={() => nav.oeffnen("check", () => <CheckAblauf />, true)} stil={{ marginTop: 6 }} />
      </View>
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
      <Einladung />
      {/* wer gleich etwas erledigen will, findet es ohne Scrollen */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <SchnellKachel symbol="eurosign" text={TEXT.start_rechnung} onPress={() => starten("rechnung")} />
        <SchnellKachel ton="lila" symbol="doc.text" text={TEXT.start_vorlagen} onPress={erstellen.oeffnen} />
      </View>
      <Gruppe titel={TEXT.start_so_hilft}>
        <Karte>
          {TEXT.start_punkte.map((p, i) => (
            <View key={p.titel} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              <View style={{ paddingTop: 14 }}>
                <Kachel symbol={p.symbol} />
              </View>
              <View style={{ flex: 1, paddingVertical: 14, borderBottomWidth: i === TEXT.start_punkte.length - 1 ? 0 : HAARLINIE, borderColor: f.linie }}>
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

/** Erster Tab (E-129): die Pflichten sind der Kern – vor dem Check die Einladung, danach „Jetzt dran“. */
export function PflichtenTab() {
  const z = useAmtlos();
  const gemacht = checkGemacht(z.stand.profil);
  return (
    <Seite titel={TEXT.tabs.pflichten} unterzeile={gemacht ? TEXT.pflichten_tab_unter : undefined}>
      <SicherungsKarte />
      {gemacht ? <PflichtenInhalt /> : <Start />}
    </Seite>
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
      {fehler ? <Hinweis art="fehler" text={TEXT.erinnern_verweigert} /> : null}
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
