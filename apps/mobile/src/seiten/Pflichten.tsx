import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { T as TEXT } from "../texte";
import { useMeldung } from "../ui/meldung";
import { Fristblatt, Fuss, Hinweis, Kachel, Karte, Knopf, Schalter, SchnellKachel, Symbol, T, TextKnopf, Zeile, tageBis } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, SCHRIFT, useFarben, weich } from "../ui/thema";
import { KATEGORIE_TITEL, auswertung, beantwortet, dringlichkeit, erinnerungsPlan, fortschritt, frageZu, haken, istErledigt, offeneFragenNachWirkung, type PflichtInfo } from "../pflichten/check";
import { allesAbsagen, erinnerungenMoeglich, erlaubnisAnfragen, planen } from "../pflichten/erinnerungen";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Antwort, CheckAblauf } from "./Check";
import { SicherungsKarte } from "./Sicherung";
import { BuehnenBlatt, BuehnenKnopf, BuehnenSeite, Gruppe, Inhalt, datumKurz } from "./gemeinsam";
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

export function Balken({ prozent, grund, farbe }: { prozent: number; grund?: string; farbe?: string }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: prozent }} style={{ height: 8, borderRadius: 4, backgroundColor: grund ?? f.linie, overflow: "hidden" }}>
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
  const termin = p.naechsterTermin && !abgehakt ? p.naechsterTermin : null;
  const tage = termin ? tageBis(termin, heute()) : 0;
  const fuss = gilt ? (
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
            <T farbe={tage < 0 ? "#ffc9c4" : f.minze} stil={{ ...SCHRIFT.display, fontSize: 52, lineHeight: 54, letterSpacing: -2 }}>{String(Math.abs(tage))}</T>
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
      {p.wiederkehrend && p.naechsterTermin ? <Hinweis text={TEXT.wiederkehrend_hinweis(datumDe(p.naechsterTermin))} /> : null}
      <Karte stil={{ marginTop: 8, paddingTop: 0 }}>
        {p.grund ? zeile(TEXT.warum, p.grund) : null}
        {/* der Termin steht oben auf der Bühne – hier nur, wenn die Pflicht abgehakt ist */}
        {p.naechsterTermin && abgehakt ? zeile(TEXT.naechster_termin("").trim(), datumDe(p.naechsterTermin)) : null}
        {p.stelle ? zeile(TEXT.zustaendig, p.stelle) : null}
        {zeile(TEXT.einstufung, TEXT.schwere[p.schwere])}
      </Karte>
      {p.erklaerung ? <T v="klein" stil={{ marginTop: 16, marginHorizontal: 4 }}>{p.erklaerung}</T> : null}
      {p.rechtsgrundlage.length ? (
        <Gruppe titel={TEXT.grundlage}>
          <T v="klein" stil={{ marginHorizontal: 4 }}>{p.rechtsgrundlage.join(" · ")}</T>
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
      <T v="caption" leise stil={{ marginTop: 16, marginHorizontal: 4 }}>{TEXT.pflichten_quelle}</T>
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
  const unter = erledigt ? TEXT.erledigt : termin ? (fern ? fristText(termin) : `${fristText(termin)} · ${datumDe(termin).slice(0, 6)}`) : p.vorlage ? TEXT.unterlage_in_amtlos : p.schwere === "hoch" ? TEXT.wichtig : p.kurz;
  return (
    <Zeile
      // mit Termin: das Fristblatt (Datum auf einen Blick); sonst der Status als Form
      links={termin ? <Fristblatt termin={termin} heute={heute()} /> : <Kachel symbol={erledigt ? "checkmark" : p.schwere === "hoch" ? "exclamationmark" : BEREICH_SYMBOL_KAT[p.kategorie] ?? "doc.text"} ton={erledigt ? "amt" : p.schwere === "hoch" ? "bald" : "leise"} groesse={46} />}
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
      <ErinnerungsSchalter />
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
      <T v="caption" leise stil={{ marginTop: 8, marginLeft: 4 }}>{TEXT.pflichten_quelle}</T>
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
        <SchnellKachel ton="lila" symbol="doc.text" text={TEXT.start_vorlagen} onPress={erstellen.oeffnen} />
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
  return (
    <View accessibilityLabel={TEXT.jahr_hinweis} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {monate.map((mo) => (
        <View
          key={mo.schluessel}
          accessible
          accessibilityLabel={TEXT.monat_termine(mo.lang, mo.termine)}
          style={{ width: "15.2%", flexGrow: 1, height: 54, borderRadius: 14, padding: 7, justifyContent: "space-between", backgroundColor: mo.jetzt ? f.minze : mo.termine ? "rgba(127,227,184,0.16)" : "transparent", borderWidth: mo.jetzt || mo.termine ? 0 : 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.3)" }}
        >
          <T v="caption" farbe={mo.jetzt ? f.buehneKnopfText : f.buehneLeise} stil={{ ...SCHRIFT.halb, fontSize: 12, lineHeight: 14 }}>{mo.kurz}</T>
          {mo.termine ? <T farbe={mo.jetzt ? f.buehneKnopfText : f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 17, lineHeight: 19 }}>{String(mo.termine)}</T> : null}
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
  const fs = useMemo(() => fortschritt(a, { erledigt, unterlagen, betrieb }), [a, erledigt, unterlagen, betrieb]);
  const check = () => nav.oeffnen("check", () => <CheckAblauf einleitung={!gemacht} />, true);
  return (
    <BuehnenSeite
      ueber={gemacht ? TEXT.fortschritt_text(fs.fertig, fs.gesamt) : TEXT.tabs.pflichten}
      rechts={gemacht ? <BuehnenKnopf text={TEXT.jahr_neu_pruefen} label={TEXT.angaben_aendern} onPress={check} /> : undefined}
      titel={gemacht ? TEXT.jahr_titel : TEXT.pflichten_karte_titel}
      buehne={
        gemacht ? (
          <Jahresblick gilt={a.gilt} tag={heute()} />
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
