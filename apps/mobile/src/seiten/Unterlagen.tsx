import { memo, useMemo, useState } from "react";
import { View } from "react-native";
import { ANLAESSE, BEREICHE, KURZ, VORLAGEN, unterlagenName, vorlageFuer, type Anlass, type Betrieb, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Karte, Knopf, Suchfeld, Symbol, T, TextKnopf, Wahl, Zeile, useGrosseSchrift, type Ton } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { isoliert } from "../ui/trennen";
import { betriebFehlt, heute, sortiert, type Stand, type Unterlage } from "../unterlagen/speicher";
import { useAktionen, useStandWahl } from "../zustand";
import { euroText, fehltJeBerechnen, offeneIds, rechnungBrutto, tageUeberfaellig } from "../unterlagen/ablage";
import { BetriebFormular } from "./Betrieb";
import { BEREICH_SYMBOL, BuehnenBlatt, Gruppe, Inhalt, datumKurz } from "./gemeinsam";
import { useOeffnen, useStarten, useZiel } from "./starten";
import { BelegErfassenSeite } from "./Belege";
import { KontrollmappeSeite } from "./Kontrollmappe";

/** R11 (UX #1): Suchbegriffe, bei denen die Kontrollmappe als erster Treffer erscheint */
const KONTROLLE = /kontroll|mappe|prüf|pruef|zoll|gesundheitsamt|lebensmittel(ü|ue)berwachung|gewerbeaufsicht|berufsgenossenschaft|\bbg\b|nachweis/;
/** R11 (Berater d): Anlass der eigenen Branche zuerst – „Salon und Kosmetik“ stand hinter „Café, Restaurant“ */
const ANLASS_JE_BRANCHE: Record<string, string> = { gastronomie_lebensmittel: "gastro", beauty_kosmetik: "beauty" };

/** Symbol je Anlass. */
/** Ton je Anlass (B11): ruhig grün, nur „Wenn etwas schiefgeht“ in Bernstein – Wort und Symbol tragen die Bedeutung. */
const ANLASS_TON: Record<string, Ton> = { panne: "bald" };

const ANLASS_SYMBOL: Record<string, string> = {
  einstellen: "person.badge.plus",
  gruenden: "flag",
  laufend: "arrow.triangle.2.circlepath",
  steuern: "building.columns",
  website: "globe",
  datenschutz: "lock.shield",
  sicherheit: "hammer",
  gastro: "fork.knife",
  beauty: "scissors",
  panne: "exclamationmark.triangle",
};

/** Zuletzt geändert: „Heute“, „Gestern“ oder das Datum – kurz, damit die Zeile nicht umbricht. */
function wann(iso: string): string {
  const tag = heute(new Date(iso));
  const h = heute();
  if (tag === h) return TEXT.heute;
  // gestern = heute minus ein Tag (Kalender in deutscher Zeit, ohne einen weiteren Formatter-Aufruf je Zeile)
  const g = new Date(`${h}T12:00:00Z`);
  g.setUTCDate(g.getUTCDate() - 1);
  if (tag === g.toISOString().slice(0, 10)) return TEXT.gestern;
  return datumKurz(iso);
}

const datumText = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? datumKurz(`${iso}T12:00:00Z`) : null);

/**
 * Zeile für eine eigene Unterlage. Rechnungen zeigen, wonach man sucht: Kunde, Betrag, Nummer, Rechnungsdatum,
 * Status. Andere Unterlagen: Name, wann geändert, was noch fehlt. `fehlt` rechnet die Liste einmal für alle aus.
 */
export const UnterlageZeile = memo(function UnterlageZeile({ u, letzte, fehlt, betrieb, onPress, ueber = 0 }: { u: Unterlage; letzte: boolean; fehlt: number; betrieb: Betrieb; onPress: (id: string) => void; ueber?: number }) {
  // zuletzt bearbeitet oder geteilt
  const zuletzt = u.ausgegeben && u.ausgegeben > u.geaendert ? u.ausgegeben : u.geaendert;
  const v = vorlageFuer(u.vorlage)!;
  const ton = fehlt && !u.festgeschrieben ? "bald" : "amt";
  if (v.storno) {
    const nummer = typeof u.daten.nummer === "string" ? u.daten.nummer.trim() : "";
    const datum = (typeof u.daten.datum === "string" && datumText(u.daten.datum)) || wann(zuletzt);
    const storno = typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() ? u.daten.storno_zu.trim() : "";
    const kunde = typeof u.daten.kunde_name === "string" ? u.daten.kunde_name.trim() : "";
    const brutto = rechnungBrutto(u, betrieb);
    // Status als Plakette rechts – wie in den Rechnungslisten guter Buchhaltungs-Apps; „überfällig“ nach dem eigenen Zahlungsziel
    // Konfliktkopie (K1): aufbewahrt, zählt aber nirgends – das muss in der Liste sofort zu sehen sein
    const marke = u.konfliktKopieVon
      ? { text: TEXT.marke.konfliktkopie, ton: "frist" as const }
      : u.storniertDurch
      ? { text: TEXT.marke.storniert, ton: "leise" as const }
      : u.festgeschrieben && !storno
        ? u.bezahlt
          ? { text: TEXT.marke.bezahlt, ton: "amt" as const }
          : ueber > 0
            ? { text: TEXT.marke.ueberfaellig, ton: "frist" as const }
            : { text: TEXT.marke.offen, ton: "bald" as const }
        : !u.festgeschrieben
          ? { text: TEXT.marke.entwurf, ton: "leise" as const }
          : undefined;
    // überfällig: „seit … fällig“ statt des Datums – passt in eine Zeile neben die Marke
    const zusatz = !u.festgeschrieben && fehlt ? TEXT.fehlen(fehlt) : ueber > 0 && !u.bezahlt ? TEXT.ueberfaellig_seit(ueber) : "";
    return (
      <Zeile
        symbol="eurosign"
        ton={ueber > 0 && !u.bezahlt ? "frist" : ton}
        titel={storno ? TEXT.storno_titel(nummer, storno) : isoliert(kunde) || TEXT.rechnung_ohne_kunde}
        // geschütztes Leerzeichen vor dem Trenner: eine umbrechende Zeile beginnt nie mit „·“ (A15)
        text={[storno ? isoliert(kunde) : nummer, ueber > 0 && !u.bezahlt && !fehlt ? "" : datum, zusatz].filter(Boolean).join("\u00a0· ")}
        wert={brutto ? euroText(brutto) : undefined}
        marke={marke}
        onPress={() => onPress(u.id)}
        letzte={letzte}
      />
    );
  }
  const status = u.festgeschrieben ? TEXT.festgeschrieben_kurz : fehlt ? TEXT.fehlen(fehlt) : TEXT.vollstaendig;
  return <Zeile symbol="doc.text" ton={ton} titel={unterlagenName(v, u.daten)} text={`${wann(zuletzt)}\u00a0· ${status}`} marke={u.konfliktKopieVon ? { text: TEXT.marke.konfliktkopie, ton: "frist" } : undefined} onPress={() => onPress(u.id)} letzte={letzte} />;
});

// Überfällige je Unterlagenliste und Tag – Heute, Unterlagen und Meine teilen sich eine Rechnung (R9 Performance)
const ueberZwischen = new WeakMap<Unterlage[], { tag: string; je: Map<string, number> }>();

/** Tage über dem Zahlungsziel je offener Rechnung – einmal je Stand berechnet. */
export function useUeberfaellig(): Map<string, number> {
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const tag = heute();
  return useMemo(() => {
    const da = ueberZwischen.get(unterlagen);
    if (da?.tag === tag) return da.je;
    const ids = offeneIds(unterlagen);
    const je = new Map(unterlagen.filter((u) => ids.has(u.id)).map((u) => [u.id, tageUeberfaellig(u, tag, ids)]));
    ueberZwischen.set(unterlagen, { tag, je });
    return je;
  }, [unterlagen, tag]);
}

export function useFehltJe(): Map<string, number> {
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const betrieb = useStandWahl((s) => s.betrieb);
  return useMemo(() => fehltJeBerechnen({ unterlagen, betrieb }), [unterlagen, betrieb]);
}

/** Vorlage in einer Liste: Titel und ein Satz in Alltagssprache. Antippen startet sofort. */
function VorlagenListe({ liste }: { liste: Vorlage[] }) {
  const starten = useStarten();
  return (
    <Karte>
      {liste.map((v, i) => (
        <Zeile key={v.id} titel={v.titel} text={KURZ[v.id] ?? v.beschreibung} onPress={() => starten(v.id)} letzte={i === liste.length - 1} />
      ))}
    </Karte>
  );
}

export function AnlassSeite({ a }: { a: Anlass }) {
  return (
    <Unterseite titel={a.titel} unter={a.text}>
      <Inhalt>
        <VorlagenListe liste={a.vorlagen.map((id) => vorlageFuer(id)!)} />
      </Inhalt>
    </Unterseite>
  );
}

export { Suchfeld };

const passt = (s: string) => (v: Vorlage) => !s || `${v.titel} ${KURZ[v.id] ?? ""} ${v.beschreibung}`.toLowerCase().includes(s);

function Treffer({ s, setzen }: { s: string; setzen?: (w: string) => void }) {
  const ziel = useZiel();
  const liste = VORLAGEN.filter(passt(s));
  const mappe = KONTROLLE.test(s) ? (
    <Karte stil={{ marginBottom: liste.length ? 12 : 0 }}>
      <Zeile symbol="folder" ton="blau" titel={TEXT.kontrollmappe_zeile} text={TEXT.r11_mappe_zeile_kurz} onPress={() => ziel((n) => n.oeffnen("kontrollmappe", () => <KontrollmappeSeite />))} letzte />
    </Karte>
  ) : null;
  if (liste.length || mappe) return <View>{mappe}{liste.length ? <VorlagenListe liste={liste} /> : null}</View>;
  // nichts gefunden (B7): nicht nur „nichts da“, sondern Vorschläge, mit denen es weitergeht
  return (
    <View style={{ gap: 12 }}>
      <T leise>{TEXT.nichts_gefunden}</T>
      {setzen ? (
        <View style={{ gap: 4 }}>
          <T v="klein" fett>{TEXT.suche_vielleicht}</T>
          <Wahl wert={null} aendern={setzen} optionen={TEXT.suche_beispiele.map((b) => ({ wert: b, text: b }))} />
        </View>
      ) : null}
    </View>
  );
}

/** Alle Vorlagen nach Bereich – für alle, die wissen, was sie suchen. */
function AlleSeite() {
  const f = useFarben();
  const [suche, setSuche] = useState("");
  const s = suche.trim().toLowerCase();
  return (
    <Unterseite titel={TEXT.alle_titel}>
      <Inhalt>
        <Suchfeld wert={suche} setzen={setSuche} />
        {s ? (
          <View style={{ marginTop: 16 }}>
            <Treffer s={s} setzen={setSuche} />
          </View>
        ) : (
          BEREICHE.map((b) => (
            <View key={b.id} style={{ marginTop: 22 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Symbol name={BEREICH_SYMBOL[b.id]} groesse={18} farbe={f.tinteLeise} />
                <T v="klein" fett leise accessibilityRole="header">{b.titel}</T>
              </View>
              <VorlagenListe liste={VORLAGEN.filter((v) => v.bereich === b.id)} />
            </View>
          ))
        )}
      </Inhalt>
    </Unterseite>
  );
}

/**
 * Unterlagen (E-124; seit E-129 zweiter Tab hinter „Pflichten“): oben die häufigste Handlung (Rechnung), dann zuletzt
 * bearbeitete Unterlagen und Anlässe in Alltagssprache. Alle Vorlagen gibt es über „Alle Unterlagen“ und die Suche.
 */
export function Unterlagen(_: { schliessen?: boolean }) {
  const { tabWechseln } = useAktionen();
  const unterlagen = useStandWahl((s) => s.unterlagen);
  const betrieb = useStandWahl((s) => s.betrieb);
  const nav = useNav();
  const ziel = useZiel();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const [suche, setSuche] = useState("");
  const grosseSchrift = useGrosseSchrift();
  const s = suche.trim().toLowerCase();
  const zuletzt = useMemo(() => sortiert({ unterlagen } as Stand).slice(0, 3), [unterlagen]);
  const profil = useStandWahl((x) => x.profil);
  const anlaesse = useMemo(() => {
    const branchen = Array.isArray(profil["taetigkeit.branchen"]) ? (profil["taetigkeit.branchen"] as string[]) : [];
    const eigene = new Set(branchen.map((b) => ANLASS_JE_BRANCHE[b]).filter(Boolean));
    return [...ANLAESSE.filter((a) => eigene.has(a.id)), ...ANLAESSE.filter((a) => !eigene.has(a.id))];
  }, [profil]);
  const zuAnlass = (a: Anlass) => (a.vorlagen.length === 1 ? starten(a.vorlagen[0]!) : nav.oeffnen(`anlass-${a.id}`, () => <AnlassSeite a={a} />));
  return (
    <BuehnenBlatt
      titel={TEXT.neu_titel}
      unter={TEXT.unterlagen_unter}
      // das Suchfeld bleibt beim Tippen oben stehen, die Treffer scrollen darunter (A17)
      fest={<Suchfeld buehne wert={suche} setzen={setSuche} />}
      buehne={
        s ? undefined : (
          // große Schrift: untereinander, sonst wird „Rechnung“ abgeschnitten (M5, wie auf „Heute“)
          <View style={{ flexDirection: grosseSchrift ? "column" : "row", gap: 10 }}>
            <Knopf buehne symbol="plus" text={TEXT.kurz_rechnung} onPress={() => starten("rechnung")} stil={{ flex: grosseSchrift ? undefined : 1, paddingHorizontal: 12 }} />
            <Knopf glas symbol="doc.viewfinder" text={TEXT.kurz_beleg} onPress={() => ziel((n) => n.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />))} stil={{ flex: grosseSchrift ? undefined : 1, paddingHorizontal: 12 }} />
          </View>
        )
      }
    >
      {s ? (
        <Treffer s={s} setzen={setSuche} />
      ) : (
        <View>
          {betriebFehlt(betrieb) ? (
            <Karte stil={{ marginBottom: 6 }}>
              <Zeile
                symbol="building.2"
                titel={TEXT.betrieb_eintragen}
                text={TEXT.betrieb_zeile_text}
                letzte
                onPress={() =>
                  nav.oeffnen("betrieb", () => (
                    <Unterseite titel={TEXT.betrieb_titel}>
                      <Inhalt>
                        <BetriebFormular />
                      </Inhalt>
                    </Unterseite>
                  ))
                }
              />
            </Karte>
          ) : null}
          {zuletzt.length ? (
            <Gruppe erste={!betriebFehlt(betrieb)} titel={TEXT.zuletzt}>
              <Karte>
                {zuletzt.map((u, i) => (
                  <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === zuletzt.length - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={betrieb} onPress={oeffnen} />
                ))}
              </Karte>
              {unterlagen.length > zuletzt.length ? <TextKnopf text={TEXT.alle_anzeigen} onPress={() => ziel(() => tabWechseln("meine"))} /> : null}
            </Gruppe>
          ) : null}

          <Gruppe erste={!zuletzt.length && !betriebFehlt(betrieb)} titel={TEXT.wofuer}>
            <Karte>
              {anlaesse.map((a, i) => (
                <Zeile key={a.id} symbol={ANLASS_SYMBOL[a.id] ?? "doc.text"} ton={ANLASS_TON[a.id] ?? "amt"} titel={a.titel} text={a.text} onPress={() => zuAnlass(a)} letzte={i === anlaesse.length - 1} />
              ))}
            </Karte>
          </Gruppe>
          <Karte stil={{ marginTop: 16 }}>
            <Zeile symbol="list.bullet" ton="leise" titel={TEXT.alle_unterlagen(VORLAGEN.length)} onPress={() => nav.oeffnen("alle", () => <AlleSeite />)} letzte />
          </Karte>
        </View>
      )}
      <T v="caption" leise stil={{ marginTop: 24 }}>{TEXT.ueber}</T>
    </BuehnenBlatt>
  );
}
