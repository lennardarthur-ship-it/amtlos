import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Schalter, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RADIUS, RAND, useFarben } from "../ui/thema";
import { KATEGORIE_TITEL, auswertung, beantwortet, dringlichkeit, erinnerungsPlan, fortschritt, frageZu, istErledigt, offeneFragenNachWirkung, type PflichtInfo } from "../pflichten/check";
import { allesAbsagen, erinnerungenMoeglich, erlaubnisAnfragen, planen } from "../pflichten/erinnerungen";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Antwort, CheckAblauf } from "./Check";
import { SicherungsKarte } from "./Sicherung";
import { Gruppe, Inhalt, Seite, datumKurz } from "./gemeinsam";
import { useStarten } from "./starten";

const datumDe = (iso: string) => datumKurz(`${iso}T12:00:00Z`);

/** Auswertung des Katalogs für das gespeicherte Profil – nur neu, wenn sich Antworten oder der Tag ändern. */
export function useAuswertung() {
  const { stand } = useAmtlos();
  const tag = heute();
  return useMemo(() => auswertung(stand.profil, tag), [stand.profil, tag]);
}

/** Hat jemand den Check schon gemacht? (die erste Frage ist beantwortet) */
export const checkGemacht = (profil: Record<string, unknown>) => beantwortet(profil as never, "taetigkeit.branchen") || beantwortet(profil as never, "rechtsform");

function Balken({ prozent }: { prozent: number }) {
  const f = useFarben();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: prozent }} style={{ height: 8, borderRadius: 4, backgroundColor: f.linieLeise, overflow: "hidden" }}>
      <View style={{ width: `${prozent}%`, height: 8, borderRadius: 4, backgroundColor: f.amt }} />
    </View>
  );
}

function PflichtDetail({ id }: { id: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const starten = useStarten();
  const a = useAuswertung();
  const p = [...a.gilt, ...a.gruendung, ...a.unbekannt].find((x) => x.id === id);
  if (!p) return <Unterseite titel="">{null}</Unterseite>;
  const gilt = a.gilt.includes(p) || a.gruendung.includes(p);
  const abgehakt = istErledigt(p, { ...z.stand, unterlagen: [] });
  // wiederkehrend: der Haken gilt für den nächsten Termin, danach ist die Pflicht wieder offen
  const abhaken = () => z.erledigtSetzen(p.id, abgehakt ? null : heute(), abgehakt ? null : p.wiederkehrend ? p.naechsterTermin : null);
  const durchUnterlage = !abgehakt && istErledigt(p, { ...z.stand, erledigt: {} });
  const zeile = (titel: string, wert: string) => (
    <View style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: f.linieLeise }}>
      <T v="caption" fett leise>{titel}</T>
      <T v="klein" stil={{ marginTop: 2 }}>{wert}</T>
    </View>
  );
  return (
    <Unterseite titel={TEXT.pflicht_titel}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: 32 }}>
        <T v="caption" leise>{KATEGORIE_TITEL[p.kategorie] ?? p.kategorie}</T>
        <T v="titel" accessibilityRole="header" stil={{ marginTop: 4 }}>{p.titel}</T>
        <T stil={{ marginTop: 8 }}>{p.kurz}</T>
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
        {gilt && p.vorlage ? (
          <TextKnopf symbol={abgehakt ? "xmark.circle" : "checkmark.circle"} text={abgehakt ? TEXT.haken_entfernen : TEXT.als_erledigt} onPress={abhaken} stil={{ marginTop: 8 }} />
        ) : null}
      </Inhalt>
      {gilt ? (
        <Fuss>
          {p.vorlage ? (
            <Knopf text={TEXT.unterlage_erstellen} symbol="plus" onPress={() => starten(p.vorlage!)} stil={{ flex: 1 }} />
          ) : (
            <Knopf ton={abgehakt} text={abgehakt ? TEXT.haken_entfernen : TEXT.als_erledigt} symbol={abgehakt ? undefined : "checkmark"} onPress={abhaken} stil={{ flex: 1 }} />
          )}
        </Fuss>
      ) : null}
    </Unterseite>
  );
}

function PflichtZeile({ p, letzte, erledigt }: { p: PflichtInfo; letzte: boolean; erledigt: boolean }) {
  const f = useFarben();
  const nav = useNav();
  const unter = erledigt ? TEXT.erledigt : p.naechsterTermin ? TEXT.naechster_termin(datumDe(p.naechsterTermin)) : p.vorlage ? TEXT.unterlage_in_amtlos : p.schwere === "hoch" ? TEXT.wichtig : p.kurz;
  return (
    <Zeile
      links={<Symbol name={erledigt ? "checkmark.circle.fill" : p.schwere === "hoch" ? "exclamationmark.circle" : "circle"} groesse={22} farbe={erledigt ? f.amt : p.schwere === "hoch" ? f.bald : f.tinteLeise} />}
      titel={p.titel}
      text={unter}
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
  const fs = fortschritt(a, z.stand);
  const fertig = (p: PflichtInfo) => istErledigt(p, z.stand);
  const offen = offeneFragenNachWirkung(a, z.stand.profil);
  const kategorien = Object.keys(KATEGORIE_TITEL).filter((k) => a.gilt.some((p) => p.kategorie === k));
  const sonst = a.gilt.filter((p) => !KATEGORIE_TITEL[p.kategorie]);
  const d = dringlichkeit(a, z.stand, heute());
  return (
    <View>
      <T v="titel" accessibilityRole="header">{TEXT.ergebnis_titel(a.gilt.length)}</T>
      <View style={{ marginTop: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T v="klein" fett>{TEXT.fortschritt_text(fs.fertig, fs.gesamt)}</T>
          <T v="klein" fett stil={{ fontVariant: ["tabular-nums"] }}>{fs.prozent} %</T>
        </View>
        <Balken prozent={fs.prozent} />
        <T v="caption" leise>{TEXT.pflichten_quelle}</T>
      </View>
      <ErinnerungsSchalter />
      {d.jetzt.length ? (
        <Gruppe titel={TEXT.jetzt_dran(d.jetzt.length)}>
          <Karte>
            {d.jetzt.map((p, i) => (
              <PflichtZeile key={p.id} p={p} erledigt={false} letzte={i === d.jetzt.length - 1} />
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
      <T v="klein" fett leise accessibilityRole="header" stil={{ marginTop: 28, marginLeft: 4 }}>{TEXT.alle_nach_bereich}</T>
      {kategorien.map((k) => {
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
      {sonst.length ? (
        <Gruppe titel="Weitere">
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
          <TextKnopf symbol={gruendungZeigen ? "chevron.up" : "chevron.down"} text={gruendungZeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => setGruendungZeigen(!gruendungZeigen)} stil={{ marginLeft: 4 }} />
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
          <TextKnopf symbol={zeigen ? "chevron.up" : "chevron.down"} text={zeigen ? TEXT.liste_verbergen : TEXT.liste_zeigen} onPress={() => setZeigen(!zeigen)} stil={{ marginLeft: 4 }} />
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
      <Karte stil={{ paddingVertical: 14, gap: 18 }}>
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
      </Karte>
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

/** Erster Tab (E-129): die Pflichten sind der Kern – vor dem Check die Einladung, danach „Jetzt dran“. */
export function PflichtenTab() {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const gemacht = checkGemacht(z.stand.profil);
  return (
    <Seite titel={TEXT.tabs.pflichten} unterzeile={gemacht ? TEXT.pflichten_tab_unter : undefined}>
      <SicherungsKarte />
      {gemacht ? (
        <PflichtenInhalt />
      ) : (
        <View style={{ padding: 20, borderRadius: RADIUS.karte, backgroundColor: f.amtHauch, gap: 14 }}>
          <T v="titel" farbe={f.amtTief} accessibilityRole="header">{TEXT.pflichten_karte_titel}</T>
          <T farbe={f.amtTief}>{TEXT.pflichten_einladung}</T>
          <Knopf text={TEXT.pflichten_check_starten} onPress={() => nav.oeffnen("check", () => <CheckAblauf />, true)} />
        </View>
      )}
    </Seite>
  );
}

/** Lokale Erinnerungen an Fristen einschalten (ohne Server). */
function ErinnerungsSchalter() {
  const z = useAmtlos();
  const [fehler, setFehler] = useState(false);
  if (!erinnerungenMoeglich) return null;
  return (
    <View style={{ marginTop: 8 }}>
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
    </View>
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
  const f = useFarben();
  const n = Object.values(z.stand.profil).filter((w) => w !== null && w !== undefined).length;
  return (
    <Gruppe titel={TEXT.check_profil_titel}>
      <Karte>
        <Zeile links={<Symbol name="checklist" groesse={22} farbe={f.amt} />} titel={checkGemacht(z.stand.profil) ? TEXT.angaben_aendern : TEXT.pflichten_check_starten} text={checkGemacht(z.stand.profil) ? TEXT.check_profil_text(n) : TEXT.check_profil_leer} onPress={() => nav.oeffnen("check", () => <CheckAblauf einleitung={!checkGemacht(z.stand.profil)} />, true)} letzte />
      </Karte>
    </Gruppe>
  );
}
