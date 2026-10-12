import { useState } from "react";
import { TextInput, View } from "react-native";
import { ANLAESSE, BEREICHE, KURZ, VORLAGEN, fehlendeAngaben, unterlagenName, vorlageFuer, type Anlass, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { GROESSE, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { betriebFehlt, sortiert, type Unterlage } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { BetriebFormular } from "./Betrieb";
import { BEREICH_SYMBOL, Gruppe, Inhalt, Seite, datumKurz } from "./gemeinsam";
import { PflichtenKarte, checkGemacht } from "./Pflichten";
import { useOeffnen, useStarten } from "./starten";

/** Symbol je Anlass. */
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

/** Zeile für eine eigene Unterlage: Name, wann geändert, was noch fehlt. */
export function UnterlageZeile({ u, letzte, onPress }: { u: Unterlage; letzte: boolean; onPress: () => void }) {
  const f = useFarben();
  const { stand } = useAmtlos();
  const v = vorlageFuer(u.vorlage)!;
  const n = fehlendeAngaben(v, u.daten, stand.betrieb).length;
  return (
    <Zeile
      links={<Symbol name="doc.richtext" groesse={22} farbe={n ? f.bald : f.amt} />}
      titel={unterlagenName(v, u.daten)}
      text={`${TEXT.geaendert(datumKurz(u.geaendert))} · ${n ? TEXT.fehlen(n) : TEXT.vollstaendig}`}
      onPress={onPress}
      letzte={letzte}
    />
  );
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

function Suchfeld({ wert, setzen }: { wert: string; setzen: (w: string) => void }) {
  const f = useFarben();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie }}>
      <Symbol name="magnifyingglass" groesse={18} />
      <TextInput
        accessibilityLabel={TEXT.suchen}
        placeholder={TEXT.suchen}
        placeholderTextColor={f.tinteLeise}
        value={wert}
        onChangeText={setzen}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={{ flex: 1, minHeight: 44, color: f.tinte, fontFamily: SCHRIFT.regular, fontSize: GROESSE.basis }}
      />
    </View>
  );
}

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
 * Startseite (E-124): oben die häufigste Handlung (Rechnung), dann zuletzt bearbeitete Unterlagen und Anlässe in
 * Alltagssprache. Alle Vorlagen gibt es über „Alle Unterlagen“ und die Suche.
 */
export function Unterlagen() {
  const { stand, tabWechseln } = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const starten = useStarten();
  const oeffnen = useOeffnen();
  const [suche, setSuche] = useState("");
  const s = suche.trim().toLowerCase();
  const zuletzt = sortiert(stand).slice(0, 3);
  const zuAnlass = (a: Anlass) => (a.vorlagen.length === 1 ? starten(a.vorlagen[0]!) : nav.oeffnen(`anlass-${a.id}`, () => <AnlassSeite a={a} />));
  return (
    <Seite titel={TEXT.unterlagen_titel} unterzeile={TEXT.unterlagen_unter}>
      <Suchfeld wert={suche} setzen={setSuche} />
      {s ? (
        <Treffer s={s} />
      ) : (
        <View>
          {betriebFehlt(stand.betrieb) ? (
            <Karte stil={{ marginTop: 16 }}>
              <Zeile
                links={<Symbol name="building.2" groesse={22} farbe={f.amt} />}
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
          <PflichtenKarte />
          <Knopf ton={!checkGemacht(stand.profil)} text={TEXT.rechnung_schreiben} symbol="plus" onPress={() => starten("rechnung")} stil={{ marginTop: 16 }} />

          {zuletzt.length ? (
            <Gruppe titel={TEXT.zuletzt}>
              <Karte>
                {zuletzt.map((u, i) => (
                  <UnterlageZeile key={u.id} u={u} letzte={i === zuletzt.length - 1} onPress={() => oeffnen(u.id)} />
                ))}
              </Karte>
              {stand.unterlagen.length > zuletzt.length ? <TextKnopf text={TEXT.alle_anzeigen} onPress={() => tabWechseln("meine")} stil={{ marginLeft: 4 }} /> : null}
            </Gruppe>
          ) : null}

          <Gruppe titel={TEXT.wofuer}>
            <Karte>
              {ANLAESSE.map((a, i) => (
                <Zeile key={a.id} links={<Symbol name={ANLASS_SYMBOL[a.id] ?? "doc.text"} groesse={22} farbe={f.amt} />} titel={a.titel} text={a.text} onPress={() => zuAnlass(a)} letzte={i === ANLAESSE.length - 1} />
              ))}
            </Karte>
          </Gruppe>
          <Karte stil={{ marginTop: 16 }}>
            <Zeile links={<Symbol name="list.bullet" groesse={22} farbe={f.tinteLeise} />} titel={TEXT.alle_unterlagen(VORLAGEN.length)} onPress={() => nav.oeffnen("alle", () => <AlleSeite />)} letzte />
          </Karte>
        </View>
      )}
      <T v="caption" leise stil={{ marginTop: 24, paddingHorizontal: RAND / 5 }}>{TEXT.ueber}</T>
    </Seite>
  );
}
