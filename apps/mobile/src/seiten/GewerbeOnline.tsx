import { useMemo, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { DatumFeld, Hinweis, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { HAARLINIE, RADIUS, SCHRIFT, useFarben } from "../ui/thema";
import { haken, offeneVoraussetzungen } from "../pflichten/check";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { LAENDER } from "../gewerbe/portale";
import { FRAGEBOGEN_PFLICHT, GEWERBE_PFLICHT, GEWERBE_VORLAGE, anmeldetagGueltig, bedarf, datenblattVon, fehlende, fehltText, geltendeErlaubnisse, gewerbeFelder, rechtsformFuer, wegFuer, type OnlineFeld } from "../gewerbe/felder";
import { Ablauf } from "./Ablauf";
import { AbsenderSeite } from "./Betrieb";
import { BetriebTeilSeite } from "./Absender";
import { PflichtDetail, useAuswertung } from "./Pflichten";
import { BuehnenBlatt, Gruppe, RechtsHinweis, datumKurz } from "./gemeinsam";
import { useStarten } from "./starten";

const datumDe = (iso: string) => datumKurz(`${iso}T12:00:00Z`);
/** Kopieren in die Zwischenablage: im Browser über die Zwischenablage-Schnittstelle; auf dem iPhone ist der Wert markierbar (kein expo-clipboard). */
const zwischenablage = Platform.OS === "web" && typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);
/** Felder aus „Mein Betrieb“, die unter „Rechtsform und Register“ stehen */
const GESELLSCHAFT = new Set(["registername", "register", "vertretung"]);

/**
 * Gewerbe online anmelden – Schritt für Schritt (§ 14 GewO): die Angaben des Vordrucks GewA 1 mit den Werten des
 * Betriebs zum Abschreiben bzw. Kopieren, was man fürs Portal braucht, der Weg zum Online-Antrag des Bundeslands und das
 * Abhaken danach. Frei (ohne Pro). Die App übermittelt nichts. Logik: gewerbe/felder.ts und gewerbe/portale.ts.
 *
 * `ergaenzen`: aus dem Abschluss des Datenblatts – springt zurück in dessen Ablauf zum passenden Schritt.
 */
export function GewerbeOnlineSeite({ unterlageId, ergaenzen }: { unterlageId?: string; ergaenzen?: (schritt: number) => void }) {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const starten = useStarten();
  const melden = useMeldung();
  const a = useAuswertung();
  const { betrieb, profil, erledigt } = z.stand;
  const u = datenblattVon(z.stand, unterlageId);
  const felder = useMemo(() => gewerbeFelder({ daten: u?.daten, betrieb, profil }), [u?.daten, betrieb, profil]);
  const weg = useMemo(() => wegFuer(betrieb, profil), [betrieb, profil]);
  const geltend = useMemo(() => [...a.gilt, ...a.gruendung], [a]);
  const erlaubnisse = geltendeErlaubnisse(geltend);
  const rechtsform = rechtsformFuer(u?.daten, betrieb, profil);
  const liste = bedarf(weg, rechtsform, betrieb.name, erlaubnisse);
  const offen = fehlende(felder);
  const pflicht = geltend.find((p) => p.id === GEWERBE_PFLICHT);
  const fragebogen = geltend.some((p) => p.id === FRAGEBOGEN_PFLICHT);
  const tagVermerkt = haken(erledigt[GEWERBE_PFLICHT])?.datum ?? null;
  const [tag, setTag] = useState<string | null>(heute());
  const [tagFehler, setTagFehler] = useState(false);
  const vorlage = vorlageFuer(GEWERBE_VORLAGE);

  const zumDatenblatt = (feld?: string) => {
    const schritt = feld && vorlage ? vorlage.abschnitte.findIndex((x) => x.felder.some((y) => y.id === feld)) : 0;
    if (ergaenzen) {
      nav.zurueck();
      ergaenzen(Math.max(0, schritt));
    } else if (u) nav.oeffnen(`ablauf-${u.id}`, () => <Ablauf id={u.id} start={Math.max(0, schritt)} />, true);
    else starten(GEWERBE_VORLAGE);
  };
  const zumBetrieb = (id: string) => (GESELLSCHAFT.has(id) ? nav.oeffnen("betrieb-gesellschaft", () => <BetriebTeilSeite teil="gesellschaft" />, true) : nav.oeffnen("absender", () => <AbsenderSeite />, true));
  const kopieren = (x: OnlineFeld) => {
    if (!x.wert) return;
    void navigator.clipboard.writeText(x.wert).then(
      () => melden(TEXT.go_kopiert(x.label)),
      () => melden(TEXT.go_kopieren_hinweis, "info"),
    );
  };
  const zumAntrag = () => void Linking.openURL(weg.url).catch(() => melden(TEXT.go_portal_fehler, "info"));
  const pflichtOeffnen = (id: string) => nav.oeffnen(`pflicht-${id}`, () => <PflichtDetail id={id} />, true);
  const abhaken = () => {
    if (!anmeldetagGueltig(tag, heute())) return setTagFehler(true);
    setTagFehler(false);
    const vorher = pflicht ? offeneVoraussetzungen(pflicht, a, z.stand) : [];
    if (vorher.length) return melden(TEXT.r11_erst_erledigen(vorher.map((x) => x.titel)));
    z.erledigtSetzen(GEWERBE_PFLICHT, tag);
    melden(TEXT.go_erledigt_vermerkt);
    z.erfolg();
  };
  const landName = weg.land.land ? LAENDER[weg.land.land] : null;
  const landText = !landName ? TEXT.go_land_fehlt : weg.land.unsicher ? TEXT.go_land_unsicher(landName, betrieb.plz.trim()) : weg.land.herkunft === "angabe" ? TEXT.go_land(landName) : TEXT.go_land_plz(landName, betrieb.plz.trim());

  return (
    <BuehnenBlatt
      kopf={TEXT.go_titel}
      titel={TEXT.go_einstieg}
      unter={TEXT.go_unter}
      buehne={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Symbol name={offen.length ? "exclamationmark.circle" : "checkmark.circle.fill"} groesse={18} farbe={f.minze} gewicht="semibold" />
          <T v="klein" farbe={f.buehneText} stil={{ flex: 1, ...SCHRIFT.halb }}>{tagVermerkt ? TEXT.go_erledigt_am(datumDe(tagVermerkt)) : offen.length ? TEXT.go_fehlen(offen.length) : TEXT.go_alles_da}</T>
        </View>
      }
    >
      {!u ? (
        <View style={{ marginBottom: 12 }}>
          <Hinweis text={TEXT.go_kein_datenblatt} />
          <Knopf ton symbol="doc.text" text={TEXT.go_datenblatt_anlegen} onPress={() => starten(GEWERBE_VORLAGE)} />
        </View>
      ) : null}

      <Gruppe erste titel={TEXT.go_schritt_angaben} hilfe={zwischenablage ? undefined : TEXT.go_kopieren_hinweis}>
        <Karte>
          {felder.map((x, i) => (
            <FeldZeile key={x.id} x={x} letzte={i === felder.length - 1} kopieren={zwischenablage ? () => kopieren(x) : undefined} ergaenzen={() => (x.ergaenzen === "betrieb" ? zumBetrieb(x.id) : zumDatenblatt(x.datenblattFeld))} />
          ))}
        </Karte>
      </Gruppe>

      <Gruppe titel={TEXT.go_schritt_brauchst}>
        <Karte>
          {liste.map((b, i) => (
            <View key={b.id} style={{ paddingVertical: 12, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie, gap: 2 }}>
              <T fett>{b.titel}</T>
              <T v="klein">{b.text}</T>
              {b.id === "erlaubnis" ? (
                <View style={{ marginTop: 4 }}>
                  <T v="caption" leise>{TEXT.go_b_erlaubnis_katalog}</T>
                  {erlaubnisse.map((id) => {
                    const p = geltend.find((x) => x.id === id);
                    return p ? <TextKnopf key={id} symbol="chevron.right" text={p.titel} onPress={() => pflichtOeffnen(id)} /> : null;
                  })}
                </View>
              ) : null}
            </View>
          ))}
        </Karte>
        {weg.gemeinde ? <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.go_gebuehr_quelle(weg.gemeinde.quelleKurz, datumDe(weg.gemeinde.geprueftAm))}</T> : null}
      </Gruppe>

      <Gruppe titel={TEXT.go_schritt_antrag}>
        <T v="klein">{landText}</T>
        {weg.portal.land === "bund" ? <T v="klein" stil={{ marginTop: 6 }}>{TEXT.go_portal_bund}</T> : null}
        <Knopf symbol="globe" text={TEXT.go_zum_antrag} onPress={zumAntrag} stil={{ marginTop: 14 }} />
        <T v="caption" leise stil={{ marginTop: 6, textAlign: "center" }}>{TEXT.go_zum_portal(weg.portal.name)}</T>
        <T v="caption" leise stil={{ marginTop: 10 }}>{TEXT.go_quelle(weg.portal.quelleKurz, datumDe(weg.portal.geprueftAm))}</T>
      </Gruppe>

      <Gruppe titel={TEXT.go_schritt_danach}>
        <Karte stil={{ paddingVertical: 14, gap: 8 }}>
          {tagVermerkt ? (
            <View style={{ gap: 4 }}>
              <Hinweis art="erfolg" text={TEXT.go_erledigt_am(datumDe(tagVermerkt))} />
              <TextKnopf symbol="xmark" text={TEXT.go_erledigt_aufheben} onPress={() => z.erledigtSetzen(GEWERBE_PFLICHT, null)} />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <T fett>{TEXT.go_erledigt_titel}</T>
              <T v="klein">{TEXT.go_erledigt_text}</T>
              <DatumFeld label={TEXT.go_erledigt_tag} wert={tag} aendern={(d) => { setTag(d); setTagFehler(false); }} />
              {tagFehler ? <Hinweis art="fehler" text={TEXT.go_erledigt_tag_fehlt} /> : null}
              <Knopf ton symbol="checkmark" text={TEXT.go_erledigt_knopf} onPress={abhaken} />
            </View>
          )}
        </Karte>
        <T v="klein" stil={{ marginTop: 12 }}>{TEXT.go_fragebogen}</T>
        {fragebogen ? (
          <Karte stil={{ marginTop: 8 }}>
            <Zeile symbol="doc.text" ton="amt" titel={TEXT.go_fragebogen_link} onPress={() => pflichtOeffnen(FRAGEBOGEN_PFLICHT)} letzte />
          </Karte>
        ) : null}
      </Gruppe>

      <T v="klein" fett stil={{ marginTop: 28 }}>{TEXT.go_nichts_uebermittelt}</T>
      <RechtsHinweis art="vorlage" oben={8} />
    </BuehnenBlatt>
  );
}

/** Eine Angabe: Feldnummer, Bezeichnung, Wert (markierbar, im Web mit „Kopieren“) oder was fehlt, kurzer Hinweis. */
function FeldZeile({ x, letzte, kopieren, ergaenzen }: { x: OnlineFeld; letzte: boolean; kopieren?: () => void; ergaenzen: () => void }) {
  const f = useFarben();
  const kopf = x.nr === null ? TEXT.go_feld_vorweg : TEXT.go_feld_nr(x.nr);
  return (
    <View testID={`go-feld-${x.id}`} style={{ paddingVertical: 12, borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie, gap: 2 }}>
      <T v="caption" leise>{kopf}</T>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T fett>{x.label}</T>
          {x.status === "ok" ? (
            <T selectable stil={{ writingDirection: "ltr" }}>{x.wert}</T>
          ) : x.status === "fehlt" ? (
            <View style={{ alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.pille, backgroundColor: f.baldHauch, marginTop: 2 }}>
              <T v="klein" farbe={f.tinte} stil={{ ...SCHRIFT.halb }}>{fehltText(x)}</T>
            </View>
          ) : (
            <T v="klein" leise>{x.status === "portal" ? TEXT.go_portal : TEXT.go_entfaellt}</T>
          )}
        </View>
        {x.status === "ok" && kopieren ? <TextKnopf symbol="doc.on.doc" text={TEXT.go_kopieren} label={TEXT.go_kopieren_label(x.label)} onPress={kopieren} stil={{ marginTop: -6 }} /> : null}
      </View>
      <T v="caption" leise stil={{ marginTop: 2 }}>{x.hinweis}</T>
      {x.status === "fehlt" ? <TextKnopf symbol="pencil" text={x.ergaenzen === "betrieb" ? TEXT.go_betrieb_ergaenzen : TEXT.go_datenblatt_ergaenzen} label={`${x.ergaenzen === "betrieb" ? TEXT.go_betrieb_ergaenzen : TEXT.go_datenblatt_ergaenzen}: ${x.label}`} onPress={ergaenzen} /> : null}
    </View>
  );
}
