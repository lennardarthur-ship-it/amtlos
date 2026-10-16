import { memo, useMemo, useState } from "react";
import { View } from "react-native";
import { ANLAESSE, BEREICHE, KURZ, VORLAGEN, unterlagenName, vorlageFuer, type Anlass, type Betrieb, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Karte, Knopf, Suchfeld, Symbol, T, TextKnopf, Zeile, type Ton } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, useFarben } from "../ui/thema";
import { fehltFuer } from "../unterlagen/pruefung";
import { betriebFehlt, heute, sortiert, type Unterlage } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { euroText, offeneIds, rechnungBrutto, tageUeberfaellig } from "../unterlagen/ablage";
import { BetriebFormular } from "./Betrieb";
import { BEREICH_SYMBOL, BuehnenBlatt, Gruppe, Inhalt, datumKurz } from "./gemeinsam";
import { useOeffnen, useStarten, useZiel } from "./starten";
import { BelegErfassenSeite } from "./Belege";

/** Symbol je Anlass. */
/** Zweitfarbe je Anlass – Kategorien unterscheiden sich auf einen Blick (Wort und Symbol tragen die Bedeutung). */
const ANLASS_TON: Record<string, Ton> = { einstellen: "lila", gruenden: "gold", laufend: "amt", steuern: "blau", website: "lila", datenschutz: "blau", sicherheit: "gold", gastro: "amt", beauty: "lila", panne: "bald" };

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
  if (tag === heute()) return TEXT.heute;
  if (tag === heute(new Date(Date.now() - 864e5))) return TEXT.gestern;
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
    const marke = u.storniertDurch
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
    const zusatz = !u.festgeschrieben && fehlt ? TEXT.fehlen(fehlt) : ueber > 0 && !u.bezahlt ? TEXT.ueberfaellig_seit(ueber) : "";
    return (
      <Zeile
        symbol="eurosign"
        ton={ueber > 0 && !u.bezahlt ? "frist" : ton}
        titel={storno ? TEXT.storno_titel(nummer, storno) : kunde || TEXT.rechnung_ohne_kunde}
        text={[storno ? kunde : nummer, datum, zusatz].filter(Boolean).join(" · ")}
        wert={brutto ? euroText(brutto) : undefined}
        marke={marke}
        onPress={() => onPress(u.id)}
        letzte={letzte}
      />
    );
  }
  const status = u.festgeschrieben ? TEXT.festgeschrieben_kurz : fehlt ? TEXT.fehlen(fehlt) : TEXT.vollstaendig;
  return <Zeile symbol="doc.text" ton={ton} titel={unterlagenName(v, u.daten)} text={`${wann(zuletzt)} · ${status}`} onPress={() => onPress(u.id)} letzte={letzte} />;
});

/** Tage über dem Zahlungsziel je offener Rechnung – einmal je Stand berechnet. */
export function useUeberfaellig(): Map<string, number> {
  const { stand } = useAmtlos();
  const tag = heute();
  return useMemo(() => {
    const ids = offeneIds(stand.unterlagen);
    return new Map(stand.unterlagen.filter((u) => ids.has(u.id)).map((u) => [u.id, tageUeberfaellig(u, tag, ids)]));
  }, [stand.unterlagen, tag]);
}

/** Fehlende Angaben je Unterlage – einmal je Stand berechnet, nicht in jeder Zeile. */
export function useFehltJe(): Map<string, number> {
  const { stand } = useAmtlos();
  return useMemo(() => new Map(stand.unterlagen.map((u) => [u.id, fehltFuer(stand, u).length])), [stand.unterlagen, stand.betrieb]);
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

function AnlassSeite({ a }: { a: Anlass }) {
  return (
    <Unterseite titel={a.titel}>
      <Inhalt>
        <T leise stil={{ marginBottom: 14 }}>{a.text}</T>
        <VorlagenListe liste={a.vorlagen.map((id) => vorlageFuer(id)!)} />
      </Inhalt>
    </Unterseite>
  );
}

export { Suchfeld };

const passt = (s: string) => (v: Vorlage) => !s || `${v.titel} ${KURZ[v.id] ?? ""} ${v.beschreibung}`.toLowerCase().includes(s);

function Treffer({ s }: { s: string }) {
  const liste = VORLAGEN.filter(passt(s));
  return <View style={{ marginTop: 16 }}>{liste.length ? <VorlagenListe liste={liste} /> : <T leise>{TEXT.nichts_gefunden}</T>}</View>;
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
          <Treffer s={s} />
        ) : (
          BEREICHE.map((b) => (
            <View key={b.id} style={{ marginTop: 22 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginLeft: 2 }}>
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
  const { stand, tabWechseln } = useAmtlos();
  const nav = useNav();
  const ziel = useZiel();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const fehltJe = useFehltJe();
  const ueberJe = useUeberfaellig();
  const [suche, setSuche] = useState("");
  const s = suche.trim().toLowerCase();
  const zuletzt = sortiert(stand).slice(0, 3);
  const zuAnlass = (a: Anlass) => (a.vorlagen.length === 1 ? starten(a.vorlagen[0]!) : nav.oeffnen(`anlass-${a.id}`, () => <AnlassSeite a={a} />));
  return (
    <BuehnenBlatt
      titel={TEXT.neu_titel}
      unter={TEXT.unterlagen_unter}
      buehne={
        <View style={{ gap: 12, marginTop: 4 }}>
          <Suchfeld buehne wert={suche} setzen={setSuche} />
          {s ? null : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf buehne symbol="plus" text={TEXT.kurz_rechnung} onPress={() => starten("rechnung")} stil={{ flex: 1, paddingHorizontal: 12 }} />
              <Knopf glas symbol="doc.viewfinder" text={TEXT.kurz_beleg} onPress={() => ziel((n) => n.oeffnen("beleg-erfassen", () => <BelegErfassenSeite />))} stil={{ flex: 1, paddingHorizontal: 12 }} />
            </View>
          )}
        </View>
      }
    >
      {s ? (
        <Treffer s={s} />
      ) : (
        <View>
          {betriebFehlt(stand.betrieb) ? (
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
            <Gruppe erste={!betriebFehlt(stand.betrieb)} titel={TEXT.zuletzt}>
              <Karte>
                {zuletzt.map((u, i) => (
                  <UnterlageZeile key={u.id} u={u} ueber={ueberJe.get(u.id) ?? 0} letzte={i === zuletzt.length - 1} fehlt={fehltJe.get(u.id) ?? 0} betrieb={stand.betrieb} onPress={oeffnen} />
                ))}
              </Karte>
              {stand.unterlagen.length > zuletzt.length ? <TextKnopf text={TEXT.alle_anzeigen} onPress={() => ziel(() => tabWechseln("meine"))} stil={{ marginLeft: 4 }} /> : null}
            </Gruppe>
          ) : null}

          <Gruppe erste={!zuletzt.length && !betriebFehlt(stand.betrieb)} titel={TEXT.wofuer}>
            <Karte>
              {ANLAESSE.map((a, i) => (
                <Zeile key={a.id} symbol={ANLASS_SYMBOL[a.id] ?? "doc.text"} ton={ANLASS_TON[a.id] ?? "amt"} titel={a.titel} text={a.text} onPress={() => zuAnlass(a)} letzte={i === ANLAESSE.length - 1} />
              ))}
            </Karte>
          </Gruppe>
          <Karte stil={{ marginTop: 16 }}>
            <Zeile symbol="list.bullet" ton="leise" titel={TEXT.alle_unterlagen(VORLAGEN.length)} onPress={() => nav.oeffnen("alle", () => <AlleSeite />)} letzte />
          </Karte>
        </View>
      )}
      <T v="caption" leise stil={{ marginTop: 24, paddingHorizontal: RAND / 5 }}>{TEXT.ueber}</T>
    </BuehnenBlatt>
  );
}
