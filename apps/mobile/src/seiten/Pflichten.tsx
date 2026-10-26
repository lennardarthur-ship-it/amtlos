import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { plusTage } from "@amtlos/fristen";
import { vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { useMeldung } from "../ui/meldung";
import { BausteinListe, Fristblatt, Fuss, Hinweis, Kachel, Karte, Knopf, Schalter, SchnellKachel, Symbol, T, TextKnopf, Zeile, tageBis } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, SCHRIFT, useFarben, weich } from "../ui/thema";
import { AUSWEIS_JE_PERSON, KATEGORIE_TITEL, ZEIT_JE_PERSON, aufzeichnungsStand, auswertung, ausweisStand, beantwortet, dringendOhneTermin, dringlichkeit, erledigtDurch, fortschritt, frageZu, gruendungsSchritte, gueltigBis, haken, hakenOhne, istErledigt, offeneFragenNachWirkung, offeneKernFragen, offeneVoraussetzungen, selten, terminStand, zaehlung, type PflichtInfo } from "../pflichten/check";
import { erinnerungsPlan } from "../pflichten/erinnerungsplan";
import { allesAbsagen, erinnerungenMoeglich, erlaubnisAnfragen, planen } from "../pflichten/erinnerungen";
import { LEERER_STAND, heute } from "../unterlagen/speicher";
import { umsatzFakten } from "../unterlagen/kuUmsatz";
import { useAmtlos, useStandWahl } from "../zustand";
import { Antwort, CheckAblauf } from "./Check";
import { SicherungsKarte } from "./Sicherung";
import { BuehnenBlatt, BuehnenKnopf, BuehnenSeite, Gruppe, Inhalt, RechtsHinweis, datumKurz } from "./gemeinsam";
import { useOeffnen, useStarten } from "./starten";
import { useErstellen } from "./Erstellen";
import { Jahresraster } from "./Jahresraster";
import { useProSperre } from "./Pro";
import { kanzleienSichtbar } from "./Kanzleien";
import { SteuerberatungSeite } from "./Steuerberatung";
import { erinnerungenAbgleichen, erinnerungenAktiv, freiePflichten, pflichtAnsicht, weiterePflichten } from "../pro/regeln";
import { GEWERBE_PFLICHT } from "../gewerbe/felder";
import { GewerbeOnlineSeite } from "./GewerbeOnline";

const datumDe = (iso: string) => datumKurz(`${iso}T12:00:00Z`);
const TAG_LANG = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Auswertung des Katalogs für das gespeicherte Profil (und Ereignisse aus den Unterlagen) – nur neu, wenn sich Antworten,
 * Unterlagen oder der Tag ändern. E-192: danach (billig) der Stand der Haken – versäumte Termine bleiben sichtbar.
 */
export function useAuswertung() {
  const roh = useAuswertungOhneHaken();
  const erledigt = useStandWahl((s) => s.erledigt);
  const zeiten = useStandWahl((s) => s.zeiten);
  const tag = heute();
  // nur die Zeitpunkte der Antworten zählen (ab wann die App eine Pflicht begleitet), nicht jede andere Änderung
  const antworten = Object.entries(zeiten).filter(([k]) => k.startsWith("profil:")).sort().join("|");
  return useMemo(() => terminStand(roh, { erledigt, zeiten }, tag), [roh, erledigt, antworten, tag]);
}

function useAuswertungOhneHaken() {
  const profil = useStandWahl((s) => s.profil);
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const mitarbeiter = useStandWahl((s) => s.mitarbeiter);
  const tag = heute();
  // die Auswertung braucht aus den Unterlagen nur durchgeführte Unterweisungen und IfSG-Belehrungen (Ereignisse) – nur sie
  // bestimmen, ob neu gerechnet wird, nicht jeder Tastendruck in einer Rechnung (R9 Performance)
  const unterweisungen = useMemo(() => unterlagen.filter((u) => (u.vorlage === "unterweisung" || u.vorlage === "ifsg_belehrung") && u.ausgegeben && !u.storniertDurch), [unterlagen]);
  const schluessel = unterweisungen.map((u) => `${u.id}:${String(u.daten.datum ?? "")}`).join("|");
  // R10: aus „Mitarbeiter“ zählen Geburtsdatum (unter 18) und „Beschäftigt seit“ (Neueinstellung)
  // R12 (Zoll #1, #6): Name, Art und „Beschäftigt bis“ bestimmen die Nachweise je Person
  const personen = mitarbeiter.map((m) => `${m.name ?? ""}:${m.geburtsdatum ?? ""}:${m.beginn ?? ""}:${m.art ?? ""}:${m.ende ?? ""}:${m.staatsangehoerigkeit ?? ""}`).join("|");
  // Kleinunternehmer-Wächter (C.23, Steuerberater 22.10.2026): vereinnahmter Umsatz aus Rechnungen, Zahlungseingängen und Kasse
  const kasse = useStandWahl((s) => s.kasse);
  const sachentnahmen = useStandWahl((s) => s.sachentnahmen);
  const betrieb = useStandWahl((s) => s.betrieb);
  // nur festgeschriebene Rechnungen zählen (unveränderlich) – neu gerechnet wird bei neuen Rechnungen, Zahlungsvermerken und Stornos
  const rechnungen = useMemo(() => unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben).map((u) => `${u.id}:${u.bezahlt ?? ""}:${JSON.stringify(u.zahlungen ?? [])}:${u.storniertDurch ?? ""}:${u.konfliktKopieVon ?? ""}`).join("|"), [unterlagen]);
  const finanzen = useMemo(() => umsatzFakten({ ...LEERER_STAND, profil, unterlagen, kasse, sachentnahmen, betrieb }, tag), [profil, rechnungen, kasse, sachentnahmen, betrieb, tag]);
  const umsatz = JSON.stringify(finanzen);
  // `schluessel`, `personen` und `umsatz` stehen für alles, was die Auswertung daraus liest – bewusst statt der Listen
  return useMemo(() => auswertung(profil, tag, unterweisungen, mitarbeiter, finanzen), [profil, schluessel, personen, umsatz, tag]);
}

/**
 * E-188: Pflichten, die ohne Pro sichtbar sind (die ersten 3 aus dem Check) – mit Pro `null` (alle sichtbar).
 */
export function useFreiePflichten(): ReadonlySet<string> | null {
  const a = useAuswertung();
  const pro = useAmtlos().pro;
  const betrieb = useStandWahl((s) => s.betrieb);
  const tag = heute();
  return useMemo(() => (pro ? null : freiePflichten(a, betrieb, tag)), [pro, a, betrieb, tag]);
}

/** E-188: an Stelle der übrigen Pflichten ohne Pro – nur die Zahl, kein Titel, ein Knopf zum Bezahlschirm. */
export function GesperrtePflichten({ anzahl }: { anzahl: number }) {
  const f = useFarben();
  const sperre = useProSperre();
  if (anzahl <= 0) return null;
  return (
    <View style={{ marginTop: 10, padding: 16, borderRadius: 14, backgroundColor: f.amtHauch, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Symbol name="lock" groesse={18} farbe={f.amtTief} />
        <T fett farbe={f.amtTief} stil={{ flex: 1 }}>{TEXT.pflichten_gesperrt(anzahl)}</T>
      </View>
      <T v="klein">{TEXT.pflichten_gesperrt_text}</T>
      <TextKnopf symbol="chevron.right" text={TEXT.pflichten_pro_knopf} onPress={() => void sperre("pflichten")} />
    </View>
  );
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

export function PflichtDetail({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const melden = useMeldung();
  const nav = useNav();
  const a = useAuswertung();
  const roh = [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt].find((x) => x.id === id);
  const frei = useFreiePflichten();
  if (!roh) return <Unterseite titel="">{null}</Unterseite>;
  // E-188: ohne Pro nur die ersten 3 Pflichten – eine andere (z. B. über einen Verweis geöffnet) bleibt gesperrt
  if (frei && !frei.has(id)) return <Unterseite titel={TEXT.pflicht_titel}><Inhalt><Hinweis text={TEXT.pflicht_gesperrt} symbol="lock" /><GesperrtePflichten anzahl={Math.max(1, weiterePflichten(a, frei))} /></Inhalt></Unterseite>;
  // E-156: ohne Pro der Überblick (Titel, Kurztext, Termin, Abhaken) – die Details als kurzer Hinweis auf Pro
  const p = pflichtAnsicht(roh, z.pro);
  // schon angefangen? Dann die vorhandene Unterlage öffnen statt mit „Ausfüllen“ eine zweite anzulegen
  const vorhanden = p.vorlage ? z.stand.unterlagen.filter((u) => u.vorlage === p.vorlage && !u.storniertDurch).sort((x, y) => (y.ausgegeben ?? y.geaendert).localeCompare(x.ausgegeben ?? x.geaendert))[0] : undefined;
  const gilt = a.gilt.includes(roh) || a.gruendung.includes(roh) || a.beiEinstellung.includes(roh);
  const abgehakt = istErledigt(p, { ...z.stand, unterlagen: [] });
  // wiederkehrend: der Haken gilt für den nächsten Termin, danach ist die Pflicht wieder offen
  // R11 (Nutzertest Gründerin #7, E-087): erst abhakbar, wenn die Voraussetzungen erledigt sind (z. B. ELSTER-Konto vor dem Fragebogen)
  const vorher = abgehakt ? [] : offeneVoraussetzungen(p, a, z.stand);
  const abhaken = () => {
    if (vorher.length) return melden(TEXT.r11_erst_erledigen(vorher.map((x) => x.titel)));
    // E-192: der Haken einer wiederkehrenden Pflicht gilt für ihren ältesten offenen Termin; entfernt man ihn, gilt der Termin davor als erledigt
    const ohne = abgehakt ? hakenOhne(p, z.stand.erledigt[p.id]) : null;
    if (abgehakt) z.erledigtSetzen(p.id, ohne?.datum ?? null, ohne?.termin ?? null);
    else z.erledigtSetzen(p.id, heute(), p.wiederkehrend ? p.naechsterTermin : null);
    melden(abgehakt ? TEXT.haken_entfernt : TEXT.als_erledigt_vermerkt);
  };
  // R10: laufende Pflicht – welche Unterlage erledigt sie gerade und bis wann; „bestaetigen“: nur der Haken erledigt
  const unterlageFertig = abgehakt ? null : erledigtDurch(p, z.stand);
  const durchUnterlage = Boolean(unterlageFertig);
  const bestaetigen = p.erledigung.art === "bestaetigen" ? p.erledigung.bestaetigung ?? TEXT.als_erledigt_kurz : null;
  const laufendBis = unterlageFertig && p.erledigung.art === "laufend" && p.erledigung.naechsterTerminAus ? gueltigBis(unterlageFertig, p.erledigung.naechsterTerminAus) : null;
  const zeitraumText = (iso: string) => (p.erledigung.zeitraum === "jahr" ? iso.slice(0, 4) : new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long", year: "numeric" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)));
  const lohnWer = p.lohnbuero ? TEXT.r10_lohn_wer[String(z.stand.profil["personal.lohn_durch"])] : undefined;
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
          {/* R10 UI (Mehmet #24): schon durch eine Unterlage erledigt – kein zweites „Erledigt“ daneben */}
          {durchUnterlage && !bestaetigen ? null : <Knopf ton text={abgehakt ? (bestaetigen ? TEXT.r10_bestaetigen_entfernen : TEXT.haken_entfernen_kurz) : bestaetigen ?? TEXT.als_erledigt_kurz} symbol={abgehakt ? "xmark" : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />}
          {/* die eigene Unterlage öffnet immer; die Vorlage zur Pflicht starten gehört zu den Pro-Details (E-156) */}
          {vorhanden ? <Knopf text={TEXT.unterlage_oeffnen_kurz} onPress={() => oeffnen(vorhanden.id)} stil={{ flex: 1.3 }} /> : <Knopf text={TEXT.unterlage_erstellen_kurz} symbol="plus" onPress={() => starten(p.vorlage!)} stil={{ flex: 1.3 }} />}
        </>
      ) : (
        <Knopf ton={abgehakt} text={abgehakt ? (bestaetigen ? TEXT.r10_bestaetigen_entfernen : TEXT.haken_entfernen) : bestaetigen ?? TEXT.als_erledigt} symbol={abgehakt ? undefined : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
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
            {/* R11 (Gründerin #15): die Zahl beschriftet – „noch 42 Tage“ statt einer nackten „42“ */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ alignItems: "flex-start" }}>
              <T v="caption" maxFontSizeMultiplier={1.4} farbe={f.buehneLeise} stil={{ ...SCHRIFT.halb }}>{TEXT.r11_tage_vor(tage)}</T>
              <T maxFontSizeMultiplier={1.4} farbe={tage < 0 ? "#ffc9c4" : f.minze} stil={{ ...SCHRIFT.display, fontSize: 52, lineHeight: 54, letterSpacing: -2 }}>{String(Math.abs(tage))}</T>
              <T v="caption" maxFontSizeMultiplier={1.4} farbe={f.buehneLeise} stil={{ ...SCHRIFT.halb, marginTop: -2 }}>{TEXT.r11_tage_nach(tage)}</T>
            </View>
            <View style={{ paddingBottom: 6, flex: 1 }}>
              <T fett farbe={f.buehneText}>{fristText(termin)}</T>
              <T v="klein" farbe={f.buehneLeise}>{TAG_LANG.format(new Date(`${termin}T12:00:00Z`))}</T>
            </View>
          </View>
        ) : abgehakt ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Symbol name="checkmark.circle.fill" groesse={20} farbe={f.minze} />
            <T fett farbe={f.buehneText}>{bestaetigen ? TEXT.r10_bestaetigt_am(bestaetigen, datumDe(haken(z.stand.erledigt[p.id])?.datum ?? heute())) : TEXT.erledigt_am(datumDe(haken(z.stand.erledigt[p.id])?.datum ?? heute()))}</T>
          </View>
        ) : undefined
      }
    >
      {durchUnterlage ? <Hinweis art="erfolg" text={laufendBis ? `${TEXT.erledigt_durch_unterlage} ${TEXT.r10_laufend_bis(datumDe(laufendBis))}` : TEXT.erledigt_durch_unterlage} /> : null}
      {p.einordnung !== "pflicht" ? <Hinweis text={TEXT.r10_einordnung[p.einordnung] ?? ""} /> : null}
      {lohnWer ? <Hinweis text={TEXT.r10_lohn_hinweis(lohnWer)} /> : null}
      {gilt && !abgehakt ? <NachweisJePerson p={p} /> : null}
      {gilt && vorher.length ? <Hinweis text={TEXT.r11_erst_erledigen(vorher.map((x) => x.titel))} /> : null}
      {gilt && vorhanden ? (
        <Karte stil={{ marginTop: 8 }}>
          <Zeile symbol="doc.text" ton="amt" titel={TEXT.deine_unterlage(vorlageFuer(vorhanden.vorlage)?.titel ?? vorhanden.vorlage)} text={vorhanden.ausgegeben ? TEXT.unterlage_geteilt_am(datumKurz(vorhanden.ausgegeben)) : TEXT.unterlage_entwurf_vom(datumKurz(vorhanden.geaendert))} onPress={() => oeffnen(vorhanden.id)} letzte />
        </Karte>
      ) : null}
      {/* einmalige Pflicht mit Vorlage: erledigt ist sie erst, wenn die Unterlage gedruckt oder geteilt ist */}
      {gilt && p.vorlage && !p.wiederkehrend && !abgehakt && !durchUnterlage && p.erledigung.art === "einmalig" ? <Hinweis text={TEXT.pflicht_drucken_erledigt} /> : null}
      {/* R10: laufende Pflichten und Pflichten, die erst mit einer Bestätigung erledigt sind */}
      {gilt && p.erledigung.art === "laufend" ? <Hinweis text={p.erledigung.zeitraum ? TEXT.r10_laufend(p.erledigung.zeitraum, zeitraumText(heute())) : TEXT.r10_laufend_termin} /> : null}
      {gilt && bestaetigen && !abgehakt ? <Hinweis text={TEXT.r10_bestaetigen_hinweis(bestaetigen)} /> : null}
      {/* E-200: Beitragsnachweis – der Termin ist der letzte Tag zum Übermitteln (Eingang um 0 Uhr am Tag danach) */}
      {gilt && termin && p.uebermittelnVortag ? <Hinweis text={TEXT.e200_uebermitteln_hinweis(datumDe(termin), datumDe(plusTage(termin, 1)))} /> : null}
      {p.wiederkehrend && p.naechsterTermin ? <Hinweis text={TEXT.wiederkehrend_hinweis(datumDe(p.naechsterTermin))} /> : null}
      {/* Gewerbe online anmelden – Schritt für Schritt: frei, auch ohne Pro */}
      {p.id === GEWERBE_PFLICHT ? (
        <Karte stil={{ marginTop: 8 }}>
          <Zeile symbol="globe" ton="amt" titel={TEXT.go_einstieg} text={TEXT.go_einstieg_text} onPress={() => nav.oeffnen("gewerbe-online", () => <GewerbeOnlineSeite />, true)} letzte />
        </Karte>
      ) : null}
      {p.teaser ? <ProTeaser /> : null}
      <Karte stil={{ marginTop: 8, paddingTop: 0 }}>
        {p.grund ? zeile(TEXT.warum, p.grund) : null}
        {/* der Termin steht oben auf der Bühne – hier nur, wenn die Pflicht abgehakt ist */}
        {p.naechsterTermin && abgehakt ? zeile(TEXT.naechster_termin("").replace(/:\s*$/, ""), datumDe(p.naechsterTermin)) : null}
        {p.stelle ? zeile(TEXT.zustaendig, p.stelle) : null}
        {zeile(TEXT.einstufung, TEXT.schwere[p.schwere])}
      </Karte>
      {p.erklaerung ? <T v="klein" stil={{ marginTop: 16 }}>{p.erklaerung}</T> : null}
      {p.sanktion ? (
        <Gruppe titel={TEXT.folgen}>
          <T v="klein">{p.sanktion}</T>
        </Gruppe>
      ) : null}
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
              <Zeile key={q.url} titel={q.titel} text={q.url.replace(/^https?:\/\//, "").split("/")[0]} rechts={<Symbol name="arrow.right" groesse={16} />} onPress={() => void Linking.openURL(q.url)} link letzte={i === p.quellen.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      {/* docs/15: nur bei Steuer-Pflichten und nur, wenn Kanzleien gelistet sind – frei, ohne Pro */}
      {p.kategorie === "steuern" && kanzleienSichtbar() ? (
        <Karte stil={{ marginTop: 24 }}>
          <Zeile symbol="briefcase" ton="amt" titel={TEXT.kanzlei_finden} text={TEXT.kanzlei_finden_text} onPress={() => nav.oeffnen("steuerberatung", () => <SteuerberatungSeite kanzleienZuerst />, true)} letzte />
        </Karte>
      ) : null}
      <RechtsHinweis art="pflichten" pflicht={p} />
    </BuehnenBlatt>
  );
}

/** E-156: an Stelle der Pflicht-Details ohne Pro – was Pro dazu zeigt, ein Knopf zum Bezahlschirm. */
function ProTeaser() {
  const f = useFarben();
  const sperre = useProSperre();
  return (
    <View style={{ marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: f.amtHauch, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Symbol name="sparkles" groesse={18} farbe={f.amtTief} />
        <T fett farbe={f.amtTief} stil={{ flex: 1 }}>{TEXT.pro_pflicht_teaser_titel}</T>
      </View>
      <T v="klein">{TEXT.pro_pflicht_teaser_text}</T>
      <TextKnopf symbol="chevron.right" text={TEXT.pro_pflicht_teaser_knopf} onPress={() => void sperre("pflicht_details")} />
    </View>
  );
}

/** R12 (Zoll #1, #6): für wen der Nachweis fehlt – Arbeitszeit nach § 17 MiLoG und Ausweis-Hinweis. */
function NachweisJePerson({ p }: { p: PflichtInfo }) {
  const z = useAmtlos();
  if (p.id === ZEIT_JE_PERSON) {
    const st = aufzeichnungsStand(p, z.stand);
    if (st.erledigtDurch) return null;
    const text = st.fehlend.length ? st.fehlend.map((x) => TEXT.r12_aufzeichnung_person(x.name, x.seit ? datumDe(x.seit) : null)).join(" ") : TEXT.r12_aufzeichnung_anzahl(st.abgedeckt, st.erforderlich);
    return <Hinweis art="warnung" text={`${text} ${TEXT.r12_aufzeichnung_regel}`} />;
  }
  if (p.id === AUSWEIS_JE_PERSON && p.beschaeftigte?.length) {
    const st = ausweisStand(p, z.stand);
    return st.fehlend.length ? <Hinweis art="warnung" text={st.fehlend.map((x) => TEXT.r12_ausweis_person(x.name, x.grund)).join(" ")} /> : null;
  }
  return null;
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
const BEREICH_SYMBOL_KAT: Record<string, string> = { gruendung: "flag", gesellschaft: "building.columns", steuern: "eurosign", personal: "person.2", arbeitsschutz: "hammer", datenschutz: "lock.shield", it_sicherheit: "lock", ki: "sparkles", online: "globe", produkte: "tray", branche: "storefront", umwelt: "trash" };

export function PflichtZeile({ p, letzte, erledigt, ohneWichtig }: { p: PflichtInfo; letzte: boolean; erledigt: boolean; ohneWichtig?: boolean }) {
  const nav = useNav();
  const z = useAmtlos();
  const termin = !erledigt && p.naechsterTermin ? p.naechsterTermin : null;
  // das Datum steht im Fristblatt – im Text nur kurz (ohne Jahr, wenn es dieses Jahr ist)
  const fern = termin ? tageBis(termin, heute()) > 30 : false;
  const lohn = p.lohnbuero ? TEXT.r10_lohn_durch[String(z.stand.profil["personal.lohn_durch"])] : undefined;
  const basis = erledigt ? TEXT.erledigt : termin ? (fern ? fristText(termin) : `${fristText(termin)}\u00a0· ${datumDe(termin).slice(0, 6)}`) : p.vorlage ? TEXT.unterlage_in_amtlos : p.kurz;
  // R10: was das Lohnbüro bzw. die Steuerberatung macht, steht dabei
  const unter = lohn && !erledigt ? `${lohn}\u00a0· ${basis}` : basis;
  const wichtig = !erledigt && !ohneWichtig && dringendOhneTermin(p) && p.einordnung === "pflicht";
  // R10: Hinweise und Optionen sichtbar als solche (Rechtsprüfung: getrennt zählen und anzeigen)
  const marke = p.einordnung !== "pflicht" ? { text: TEXT.r10_marke[p.einordnung] ?? "", ton: "leise" as const } : wichtig ? { text: TEXT.wichtig, ton: "bald" as const } : undefined;
  return (
    <Zeile
      // mit Termin: das Fristblatt (Datum auf einen Blick); ohne Termin eine ruhige graue Kachel mit dem Bereich (A24) –
      // kein bernsteinfarbenes „!“, das wie eine Frist aussieht
      links={termin ? <Fristblatt termin={termin} heute={heute()} /> : <Kachel symbol={erledigt ? "checkmark" : BEREICH_SYMBOL_KAT[p.kategorie] ?? "doc.text"} ton={erledigt ? "erfolg" : "leise"} groesse={46} />}
      titel={p.titel}
      text={unter}
      // „Wichtig“ als Plakette unter dem Titel – VoiceOver liest sie mit
      marke={marke}
      onPress={() => nav.oeffnen(`pflicht-${p.id}`, () => <PflichtDetail id={p.id} />, true)}
      letzte={letzte}
    />
  );
}

/** Alle geltenden Pflichten nach Bereich, oben der Fortschritt; unklare Pflichten mit den Fragen, die sie klären. */
/** Inhalt von „Deine Pflichten“ – als Tab (Start) und als Unterseite. */
function PflichtenInhalt() {
  const frei = useFreiePflichten();
  return frei ? <PflichtenFrei frei={frei} /> : <PflichtenAlle />;
}

/**
 * E-188: „Deine Pflichten“ ohne Pro – die ersten 3 Pflichten mit Termin und Abhaken, die übrigen nur als Zahl. Keine
 * Titel weiterer Pflichten (auch nicht „Kommt demnächst“, Gründung, „Schon erledigt?“); Fragen, die den Check genauer
 * machen, Erinnerungs-Schalter (öffnet den Bezahlschirm) und der Rechtshinweis bleiben.
 */
function PflichtenFrei({ frei }: { frei: ReadonlySet<string> }) {
  const z = useAmtlos();
  const nav = useNav();
  const a = useAuswertung();
  const { erledigt, unterlagen, betrieb, profil } = z.stand;
  const liste = a.gilt.filter((p) => frei.has(p.id));
  const reihe = [...frei].map((id) => liste.find((p) => p.id === id)).filter((p): p is PflichtInfo => Boolean(p));
  const offen = useMemo(() => offeneFragenNachWirkung(a, profil), [a, profil]);
  const kernOffen = offeneKernFragen(profil);
  return (
    <View>
      {kernOffen.length ? (
        <Gruppe erste titel={TEXT.r10_check_fortsetzen_titel} fuss={TEXT.r10_check_fortsetzen_text(kernOffen.length, frageZu(kernOffen[0]!)?.frage.de, offen.find((o) => o.feld === kernOffen[0])?.anzahl ?? 0)}>
          <Knopf ton symbol="checklist" text={TEXT.r10_check_fortsetzen} onPress={() => nav.oeffnen("nachfragen", () => <CheckAblauf felder={kernOffen} />, true)} />
        </Gruppe>
      ) : null}
      <Gruppe erste={!kernOffen.length} titel={TEXT.pflichten_frei_titel(reihe.length)}>
        {reihe.length ? (
          <Karte>
            {reihe.map((p, i) => (
              <PflichtZeile key={p.id} p={p} erledigt={istErledigt(p, { erledigt, unterlagen, betrieb })} letzte={i === reihe.length - 1} />
            ))}
          </Karte>
        ) : null}
        <GesperrtePflichten anzahl={weiterePflichten(a, frei)} />
      </Gruppe>
      <ErinnerungsSchalter />
      <KurzKlaeren offen={offen} />
      <TextKnopf symbol="pencil" text={TEXT.angaben_aendern} onPress={() => nav.oeffnen("check", () => <CheckAblauf einleitung={false} />, true)} stil={{ marginTop: 20 }} />
      <RechtsHinweis art="pflichten" oben={8} />
    </View>
  );
}

/** „Deine Pflichten“ mit Pro – alles. */
function PflichtenAlle() {
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
  const [einstellungZeigen, setEinstellungZeigen] = useState(false);
  const zahl = zaehlung(a.gilt);
  // R10: abgebrochener Check – die offenen Kern-Fragen weiter beantworten statt von vorn (Nutzertest Lea)
  const kernOffen = offeneKernFragen(profil);
  return (
    <View>
      {kernOffen.length ? (
        <Gruppe erste titel={TEXT.r10_check_fortsetzen_titel} fuss={TEXT.r10_check_fortsetzen_text(kernOffen.length, frageZu(kernOffen[0]!)?.frage.de, offen.find((o) => o.feld === kernOffen[0])?.anzahl ?? 0)}>
          <Knopf ton symbol="checklist" text={TEXT.r10_check_fortsetzen} onPress={() => nav.oeffnen("nachfragen", () => <CheckAblauf felder={kernOffen} />, true)} />
        </Gruppe>
      ) : null}
      {d.jetzt.length ? (
        <Gruppe erste={!kernOffen.length} titel={TEXT.jetzt_dran(d.jetzt.length)}>
          <Karte>
            {d.jetzt.map((p, i) => (
              // sind alle „wichtig“, sagt das Wort nichts – dann zählt der Termin
              <PflichtZeile key={p.id} p={p} erledigt={false} ohneWichtig={d.jetzt.every(dringendOhneTermin)} letzte={i === d.jetzt.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : (
        <Gruppe erste={!kernOffen.length} titel={TEXT.jetzt_dran(0)}>
          <Hinweis art="erfolg" text={nichtsDranText(erinnerungenAktiv(z.stand.erinnerungen, z.pro))} />
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
      {a.kommend.length ? (
        // ruhig: nur zur Kenntnis, ohne Knopf und ohne Warnfarbe
        <Gruppe titel={TEXT.kommt_demnaechst_titel} hilfe={TEXT.kommt_demnaechst_hilfe}>
          <Karte>
            {a.kommend.map((p, i) => (
              <Zeile key={p.id} symbol="calendar" ton="leise" titel={p.titel} text={p.naechsterTermin ? TEXT.gilt_ab(datumDe(p.naechsterTermin)) : p.kurz} letzte={i === a.kommend.length - 1} />
            ))}
          </Karte>
        </Gruppe>
      ) : null}
      <ErinnerungsSchalter />
      <KurzKlaeren offen={offen} />
      <T v="gross" accessibilityRole="header" stil={{ marginTop: 30 }}>{TEXT.alle_nach_bereich}</T>
      {/* die vollständige Liste erst auf Wunsch – oben steht, was jetzt zu tun ist */}
      <TextKnopf erweitert={alleZeigen} symbol={alleZeigen ? "chevron.up" : "chevron.down"} text={alleZeigen ? TEXT.liste_verbergen : TEXT.r10_alle_zeigen(zahl.pflichten, zahl.hinweise, zahl.optionen)} onPress={() => { weich(); setAlleZeigen(!alleZeigen); }} />
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
      {a.beiEinstellung.length ? (
        // R10: Einstellungs-Pflichten eines bestehenden Betriebs ohne neue Einstellung – zur Kenntnis, nicht „jetzt dran“
        <Gruppe titel={TEXT.r10_bei_einstellung_titel(a.beiEinstellung.length)} fuss={TEXT.r10_bei_einstellung_text}>
          <TextKnopf erweitert={einstellungZeigen} symbol={einstellungZeigen ? "chevron.up" : "chevron.down"} text={einstellungZeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => { weich(); setEinstellungZeigen(!einstellungZeigen); }} />
          {einstellungZeigen ? (
            <Karte>
              {a.beiEinstellung.map((p, i) => (
                <PflichtZeile key={p.id} p={p} erledigt={fertig(p)} ohneWichtig letzte={i === a.beiEinstellung.length - 1} />
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
      <RechtsHinweis art="pflichten" oben={8} />
    </View>
  );
}

/**
 * „Kurz klären“ (E-129): statt einer langen Liste unklarer Pflichten die drei Fragen, die am meisten klären – direkt
 * hier beantwortbar. Die gezeigten Fragen bleiben stehen, solange die Seite sichtbar ist (Stand beim Erscheinen):
 * sonst verschwände eine Frage mitten in der Antwort (Mehrfachauswahl, Zahl nach der ersten Ziffer). Neu gewählt wird
 * erst, wenn man zurückkommt; beantwortete Fragen zeigen dann kein „klärt …“ mehr.
 */
function KurzKlaeren({ offen }: { offen: { feld: string; anzahl: number }[] }) {
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
    <Gruppe titel={TEXT.kurz_klaeren_titel} fuss={TEXT.r12_kurz_klaeren_text(offen.length)}>
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
      <RechtsHinweis art="pflichten" oben={24} />
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
  const { fs, d } = useMemo(() => {
    const e = { erledigt, unterlagen, betrieb };
    return { fs: fortschritt(a, e), d: dringlichkeit(a, e, tag) };
  }, [a, erledigt, unterlagen, betrieb, tag]);
  const zahl = zaehlung(a.gilt);
  const check = () => nav.oeffnen("check", () => <CheckAblauf einleitung={!gemacht} />, true);
  const sperre = useProSperre();
  return (
    <BuehnenSeite
      ueber={gemacht ? TEXT.fortschritt_text(fs.fertig, fs.gesamt) : TEXT.tabs.pflichten}
      rechts={gemacht ? <BuehnenKnopf text={TEXT.jahr_neu_pruefen} onPress={check} /> : undefined}
      // groß, was in den nächsten zwei Wochen ansteht – die Gesamtzahl klein darunter (sie erschlägt sonst)
      titel={gemacht ? TEXT.r10_ergebnis_bald(d.termine, d.ohneTermin) : TEXT.pflichten_karte_titel}
      satz
      buehne={
        gemacht ? (
          <View style={{ gap: 14 }}>
            <T v="klein" farbe={f.buehneLeise} stil={{ marginTop: -10 }}>{TEXT.r10_ergebnis_gesamt(zahl.pflichten, zahl.hinweise, zahl.optionen, selten(a.gilt))}</T>
            <T v="klein" fett accessibilityRole="header" farbe={f.buehneText} stil={{ marginTop: 8 }}>{TEXT.jahr_titel}</T>
            {/* R12 (UX #22): sechs Spalten, Monate antippbar (seiten/Jahresraster.tsx) */}
            {z.pro ? <Jahresraster gilt={a.gilt} tag={tag} /> : <BuehnenKnopf text={TEXT.jahr_pro} onPress={() => void sperre("pflichten")} />}
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

/**
 * Lokale Erinnerungen an Fristen einschalten (ohne Server). E-156: Mitteilungen gehören zu Pro – die Fristen selbst
 * stehen für alle in der App. Ohne Pro öffnet der Schalter den Bezahlschirm; wird Pro dort aktiv, fragt Amtlos nach
 * der Erlaubnis und schaltet ein. Im Web (Vorschau, Rundgang) gibt es keine Mitteilungen – dort steht der Schalter nur
 * ohne Pro, als Weg zum Bezahlschirm.
 */
function ErinnerungsSchalter() {
  const z = useAmtlos();
  const sperre = useProSperre();
  const [fehler, setFehler] = useState(false);
  const plan = useErinnerungsPlan();
  if (!erinnerungenMoeglich && z.pro) return null;
  const einschalten = () => void erlaubnisAnfragen().then((ok) => (ok ? z.erinnerungenSetzen(true) : setFehler(true)));
  return (
    <Karte stil={{ marginTop: 16, paddingBottom: 12 }}>
      <Schalter
        label={TEXT.mitPro(TEXT.erinnern, z.pro)}
        hilfe={z.pro ? TEXT.erinnern_hilfe : TEXT.erinnern_hilfe_frei}
        wert={erinnerungenAktiv(z.stand.erinnerungen, z.pro)}
        aendern={(an) => {
          setFehler(false);
          if (!an) return z.erinnerungenSetzen(false);
          if (!sperre("erinnerungen", erinnerungenMoeglich ? einschalten : undefined)) return;
          einschalten();
        }}
      />
      {/* E-192: ehrlich sagen, wenn die geplanten Mitteilungen (Grenze des Systems) vor dem letzten Termin enden */}
      {erinnerungenAktiv(z.stand.erinnerungen, z.pro) && plan.geplantBis ? <Hinweis text={TEXT.erinnern_geplant_bis(datumDe(plan.geplantBis))} /> : null}
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

/** E-192: der Plan der Mitteilungen (alle Termine der nächsten zwölf Monate, höchstens 60 Tage) – leer ohne Pro bzw. Schalter. */
function useErinnerungsPlan() {
  const z = useAmtlos();
  const a = useAuswertung();
  // E-156: Mitteilungen nur mit Pro – endet Pro, werden die geplanten abgesagt; kommt Pro (wieder), neu geplant
  const aktiv = erinnerungenAktiv(z.stand.erinnerungen, z.pro);
  const { erledigt, unterlagen, betrieb } = z.stand;
  const tag = heute();
  return useMemo(() => (aktiv ? erinnerungsPlan(a, { erledigt, unterlagen, betrieb }, tag) : { mitteilungen: [], geplantBis: null }), [a, erledigt, unterlagen, betrieb, aktiv, tag]);
}

/**
 * Setzt die lokalen Erinnerungen neu, wenn sich Antworten, Haken oder Unterlagen ändern – und (E-192) bei jedem Start und
 * jeder Rückkehr in die App, auch ohne geöffnete Pflichten-Seite (in App.tsx ganz oben eingehängt). Rendert nichts.
 */
export function ErinnerungsPlaner() {
  const z = useAmtlos();
  // Rückkehr in den Vordergrund: neu zeichnen (neuer Tag ⇒ neuer Plan) und den Plan in jedem Fall neu setzen
  const [wach, setWach] = useState(0);
  useEffect(() => {
    const abo = AppState.addEventListener("change", (s) => {
      if (s === "active") setWach((n) => n + 1);
    });
    return () => abo.remove();
  }, []);
  const plan = useErinnerungsPlan();
  const schluessel = JSON.stringify(plan.mitteilungen);
  useEffect(() => {
    // erst absagen, wenn feststeht, dass Pro fehlt (Store-Antwort beim Start) – sonst verschwänden Mitteilungen kurz
    if (!erinnerungenMoeglich || !z.bereit || !z.proBekannt) return;
    const zeit = setTimeout(() => void erinnerungenAbgleichen(z.stand.erinnerungen, z.pro, plan.mitteilungen, { planen, allesAbsagen }).catch(() => undefined), 800);
    return () => clearTimeout(zeit);
    // bei geändertem Plan oder Pro-Stand und bei jeder Rückkehr in die App neu setzen (der Plan steckt im Schlüssel)
  }, [schluessel, z.stand.erinnerungen, z.pro, z.proBekannt, z.bereit, wach]);
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
