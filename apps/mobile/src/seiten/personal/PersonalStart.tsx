import { useState } from "react";
import { View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Beschaeftigter, Checkliste } from "../../kern/typen";
import { Abschnitt, DatumFeld, Feld, Fristblatt, Hinweis, Karte, Knopf, Status, Symbol, T, Wahl, Zeile } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, Leer, Seite, useAktion, useLaden } from "../gemeinsam";
import { PflichtBlatt } from "../Pflicht";
import { StempelKarte } from "../Stempeln";
import { Schwellen } from "./Schwellen";
import { Unterweisungen } from "./Unterweisungen";
import { Zeiten } from "./Zeiten";

const ARTEN = ["vollzeit", "teilzeit", "minijob", "azubi", "werkstudent"] as const;

/** Personal (6.6): Stempeln zuerst, dann das Team und die Werkzeuge. Lohnabrechnung macht Amtlos nicht. */
export function PersonalStart() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten, neu, laedt } = useLaden(() => klient.holen<Beschaeftigter[]>("/v1/beschaeftigte"), [unternehmenId]);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const zustand = (b: Beschaeftigter) =>
    b.austritt
      ? fuelle(b.austritt < heute ? t.personal.ausgeschieden : t.personal.endet, { datum: datumLang(b.austritt, sprache) })
      : fuelle(b.eintritt > heute ? t.personal.ab : t.personal.seit, { datum: datumLang(b.eintritt, sprache) });
  const aktive = daten?.filter((b) => !b.austritt || b.austritt >= heute) ?? [];
  return (
    <Seite titel={t.personal.titel} laedt={laedt} neu={neu}>
      {aktive.length ? <StempelKarte wartendNeu={daten} /> : null}

      <Abschnitt titel={t.personal.team} rechts={<T v="klein" leise>{aktive.length}</T>}>
        {daten && !daten.length ? <Leer text={t.mobil.personal_leer} /> : null}
        {daten?.length ? (
          <Karte>
            {daten.map((b, i) => (
              <Zeile key={b.id} links={<Symbol name="person" groesse={20} farbe={b.austritt && b.austritt < heute ? f.tinteLeise : f.amt} />} titel={`${b.vorname} ${b.nachname}`} text={`${(t.personal.arten as Record<string, string>)[b.art]} · ${zustand(b)}`} onPress={() => nav.oeffnen(`person-${b.id}`, () => <Person id={b.id} geaendert={() => void neu()} />)} letzte={i === daten.length - 1} />
            ))}
          </Karte>
        ) : null}
        <Knopf text={t.personal.neu} symbol="person.badge.plus" onPress={() => nav.oeffnen("person-neu", () => <PersonNeu fertig={() => void neu()} />)} stil={{ marginTop: 12 }} />
      </Abschnitt>

      <Karte stil={{ marginTop: 24 }}>
        <Zeile links={<Symbol name="clock" groesse={20} farbe={f.amt} />} titel={t.personal.zeiten} text={t.mobil.zeiten_text} onPress={() => nav.oeffnen("zeiten", () => <Zeiten />)} />
        <Zeile links={<Symbol name="graduationcap" groesse={20} farbe={f.amt} />} titel={t.personal.unterweisungen} text={t.mobil.unterweisungen_text} onPress={() => nav.oeffnen("unterweisungen", () => <Unterweisungen />)} />
        <Zeile links={<Symbol name="chart.bar" groesse={20} farbe={f.amt} />} titel={t.personal.schwellen_titel} text={t.mobil.schwellen_kurz} onPress={() => nav.oeffnen("schwellen", () => <Schwellen />)} letzte />
      </Karte>
      <T v="caption" leise stil={{ marginTop: 12 }}>{t.personal.lohn}</T>
    </Seite>
  );
}

/** Jemand Neues fängt an: Einstellung melden – danach zeigt die Checkliste, was zu tun ist. */
function PersonNeu({ fertig }: { fertig: () => void }) {
  const { t, klient } = useAmtlos();
  const nav = useNav();
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [art, setArt] = useState<(typeof ARTEN)[number] | null>(null);
  const [eintritt, setEintritt] = useState<string | null>(null);
  const [stunden, setStunden] = useState("");
  const aktion = useAktion();
  return (
    <Unterseite titel={t.personal.neu}>
      <Inhalt>
        <T leise>{t.personal.text}</T>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        <Feld label={t.personal.vorname} wert={vorname} aendern={setVorname} autoCapitalize="words" textContentType="givenName" />
        <Feld label={t.personal.nachname} wert={nachname} aendern={setNachname} autoCapitalize="words" textContentType="familyName" />
        <Wahl label={t.personal.art} wert={art} aendern={setArt} optionen={ARTEN.map((a) => ({ wert: a, text: (t.personal.arten as Record<string, string>)[a]! }))} />
        <DatumFeld label={t.personal.eintritt} wert={eintritt} aendern={setEintritt} />
        <Feld label={t.personal.wochenstunden} wert={stunden} aendern={setStunden} keyboardType="decimal-pad" />
        <Knopf
          text={t.personal.erfassen}
          deaktiviert={!vorname.trim() || !nachname.trim() || !art || !eintritt}
          laedt={aktion.laedt}
          onPress={() =>
            void aktion.ausfuehren(async () => {
              const b = await klient.schicken<Beschaeftigter>("/v1/beschaeftigte", "POST", { vorname, nachname, art, eintritt, wochenstunden: stunden ? Number(stunden.replace(",", ".")) : null });
              fertig();
              nav.zurueck();
              // Gleich die Checkliste zeigen – das ist der eigentliche Nutzen der Einstellung in Amtlos
              setTimeout(() => nav.oeffnen(`person-${b.id}`, () => <Person id={b.id} geaendert={fertig} />), 260);
            })
          }
          stil={{ marginTop: 24 }}
        />
      </Inhalt>
    </Unterseite>
  );
}

/** Eine Person: Checkliste aus Einstellung/Austritt, Angaben ändern, Austritt erfassen. */
function Person({ id, geaendert }: { id: string; geaendert: () => void }) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const { daten, neu, laedt } = useLaden(() => klient.holen<Checkliste>(`/v1/beschaeftigte/${id}/checkliste`), [id, unternehmenId]);
  const [austritt, setAustritt] = useState<string | null>(null);
  const [blatt, setBlatt] = useState<Checkliste["schritte"][number] | null>(null);
  const aktion = useAktion();
  const b = daten?.beschaeftigter;
  const gruppen = (["einstellung", "austritt"] as const).map((anlass) => ({ anlass, schritte: daten?.schritte.filter((s) => s.anlass === anlass) ?? [] }));
  return (
    <Unterseite titel={b ? `${b.vorname} ${b.nachname}` : t.personal.titel}>
      <Inhalt laedt={laedt} neu={neu}>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {b ? <T leise>{(t.personal.arten as Record<string, string>)[b.art]} · {fuelle(t.personal.seit, { datum: datumLang(b.eintritt, sprache) })}</T> : null}
        <Gruppe titel={t.personal.checkliste} fuss={t.personal.checkliste_text}>
          {daten && !daten.schritte.length ? <Leer text={t.mobil.checkliste_leer} /> : null}
          {gruppen.filter((g) => g.schritte.length).map((g) => (
            <View key={g.anlass} style={{ marginBottom: 12 }}>
              <T v="klein" fett leise stil={{ marginBottom: 6 }}>{g.anlass === "einstellung" ? t.personal.anlass_einstellung : t.personal.anlass_austritt}</T>
              <Karte>
                {g.schritte.map((s, i) => (
                  <Zeile
                    key={`${s.pflicht_id}|${s.periode}`}
                    links={<Fristblatt datum={s.faellig_am} status={s.status} sprache={sprache} />}
                    titel={s.titel}
                    text={(t.status as Record<string, string>)[s.status]}
                    rechts={s.status === "erledigt" ? <Status status="erledigt" text="" /> : undefined}
                    onPress={() => setBlatt(s)}
                    letzte={i === g.schritte.length - 1}
                  />
                ))}
              </Karte>
            </View>
          ))}
        </Gruppe>
        {b && !b.austritt ? (
          <Gruppe titel={t.personal.austritt}>
            <Karte stil={{ paddingBottom: 14 }}>
              <DatumFeld label={t.personal.austritt} wert={austritt} aendern={setAustritt} />
              <Knopf leise text={t.personal.austritt_knopf} deaktiviert={!austritt} laedt={aktion.laedt} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/beschaeftigte/${id}/austritt`, "POST", { datum: austritt }); geaendert(); await neu(); })} stil={{ marginTop: 14 }} />
            </Karte>
          </Gruppe>
        ) : null}
      </Inhalt>
      <PflichtBlatt
        karte={blatt ? { pflicht_id: blatt.pflicht_id, periode: blatt.periode, titel: blatt.titel, kurz: blatt.kurz, status: blatt.status, faellig_am: blatt.faellig_am } : null}
        offen={Boolean(blatt)}
        schliessen={() => setBlatt(null)}
        geaendert={() => void neu()}
      />
    </Unterseite>
  );
}
