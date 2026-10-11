import { useState } from "react";
import { View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Beschaeftigter, Unterweisung, UnterweisungKurz } from "../../kern/typen";
import { DatumFeld, Feld, Hinweis, Karte, Knopf, Stempel, T, Wahl, Zeile } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";

/** Unterweisungen (6.6): anlegen, von jeder Person mit ihrem Namen bestätigen lassen, abschließen. */
export function Unterweisungen() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const nav = useNav();
  const { daten, neu, laedt } = useLaden(() => klient.holen<UnterweisungKurz[]>("/v1/unterweisungen?art=arbeitsschutz"), [unternehmenId]);
  return (
    <Unterseite titel={t.unterweisung.titel}>
      <Inhalt laedt={laedt} neu={neu}>
        <T leise>{t.unterweisung.text}</T>
        {daten && !daten.length ? <View style={{ marginTop: 16 }}><Leer text={t.unterweisung.leer} /></View> : null}
        {daten?.length ? (
          <Karte stil={{ marginTop: 16 }}>
            {daten.map((u, i) => (
              <Zeile key={u.id} titel={u.thema} text={`${datumLang(u.datum, sprache)} · ${u.abgeschlossen_am ? fuelle(t.unterweisung.abgeschlossen, { datum: datumLang(u.abgeschlossen_am.slice(0, 10), sprache) }) : fuelle(t.unterweisung.bestaetigt, { n: u.bestaetigt })}`} onPress={() => nav.oeffnen(`unterweisung-${u.id}`, () => <UnterweisungSeite id={u.id} geaendert={() => void neu()} />)} letzte={i === daten.length - 1} />
            ))}
          </Karte>
        ) : null}
        <Knopf text={t.unterweisung.neu} symbol="plus" onPress={() => nav.oeffnen("unterweisung-neu", () => <UnterweisungNeu fertig={() => void neu()} />)} stil={{ marginTop: 20 }} />
      </Inhalt>
    </Unterseite>
  );
}

function UnterweisungNeu({ fertig }: { fertig: () => void }) {
  const { t, klient, ich } = useAmtlos();
  const nav = useNav();
  const [thema, setThema] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [datum, setDatum] = useState<string | null>(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
  const [von, setVon] = useState(ich?.konto.anzeigename ?? "");
  const aktion = useAktion();
  return (
    <Unterseite titel={t.unterweisung.neu}>
      <Inhalt>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        <Feld label={t.unterweisung.thema} wert={thema} aendern={setThema} />
        <Feld label={t.unterweisung.inhalt} wert={inhalt} aendern={setInhalt} mehrzeilig />
        <DatumFeld label={t.unterweisung.datum} wert={datum} aendern={setDatum} />
        <Feld label={t.unterweisung.durchgefuehrt_von} wert={von} aendern={setVon} autoCapitalize="words" />
        <Knopf
          text={t.unterweisung.anlegen}
          deaktiviert={!thema.trim() || !inhalt.trim() || !datum || !von.trim()}
          laedt={aktion.laedt}
          onPress={() =>
            void aktion.ausfuehren(async () => {
              const u = await klient.schicken<{ id: string }>("/v1/unterweisungen", "POST", { thema, inhalt, datum, durchgefuehrt_von: von, art: "arbeitsschutz" });
              fertig();
              nav.zurueck();
              setTimeout(() => nav.oeffnen(`unterweisung-${u.id}`, () => <UnterweisungSeite id={u.id} geaendert={fertig} />), 260);
            })
          }
          stil={{ marginTop: 24 }}
        />
      </Inhalt>
    </Unterseite>
  );
}

/** Eine Unterweisung: Inhalt lesen, je Person mit Namen bestätigen, dann abschließen (erledigt die Pflichten). */
function UnterweisungSeite({ id, geaendert }: { id: string; geaendert: () => void }) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const nav = useNav();
  const { daten, neu } = useLaden(async () => {
    const [u, personen] = await Promise.all([klient.holen<Unterweisung>(`/v1/unterweisungen/${id}`), klient.holen<Beschaeftigter[]>("/v1/beschaeftigte")]);
    return { u, personen: personen.filter((p) => !p.austritt) };
  }, [id, unternehmenId]);
  const [person, setPerson] = useState<string | null>(null);
  const [name, setName] = useState("");
  const aktion = useAktion();
  const u = daten?.u;
  const offen = daten?.personen.filter((p) => !u?.teilnahmen.some((x) => x.beschaeftigter_id === p.id)) ?? [];
  return (
    <Unterseite titel={u?.thema ?? t.unterweisung.titel}>
      <Inhalt>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        {u ? (
          <>
            <T v="klein" leise>{datumLang(u.datum, sprache)} · {u.durchgefuehrt_von}</T>
            <Karte stil={{ marginTop: 12, paddingVertical: 14 }}>
              <T>{u.inhalt}</T>
            </Karte>
            {u.abgeschlossen_am ? (
              <View style={{ marginTop: 20 }}>
                <Stempel text={fuelle(t.unterweisung.abgeschlossen, { datum: datumLang(u.abgeschlossen_am.slice(0, 10), sprache) })} />
              </View>
            ) : null}
            <Gruppe titel={t.unterweisung.teilnahmen}>
              {u.teilnahmen.length ? (
                <Karte>
                  {u.teilnahmen.map((x, i) => (
                    <Zeile key={x.beschaeftigter_id} titel={`${x.vorname ?? ""} ${x.nachname ?? ""}`.trim() || x.name_bestaetigt} text={new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(x.bestaetigt_am))} letzte={i === u.teilnahmen.length - 1} />
                  ))}
                </Karte>
              ) : (
                <T leise>{t.unterweisung.keine_teilnahmen}</T>
              )}
            </Gruppe>
            {!u.abgeschlossen_am ? (
              <>
                {offen.length ? (
                  <Gruppe titel={t.unterweisung.bestaetigen_titel} fuss={t.unterweisung.bestaetigen_text}>
                    <Karte stil={{ paddingBottom: 14, paddingTop: 12 }}>
                      <Wahl label={t.unterweisung.person} wert={person} aendern={setPerson} optionen={offen.map((p) => ({ wert: p.id, text: `${p.vorname} ${p.nachname}` }))} />
                      <Feld label={t.unterweisung.name} wert={name} aendern={setName} autoCapitalize="words" textContentType="name" />
                      <Knopf
                        text={t.unterweisung.bestaetigen_knopf}
                        deaktiviert={!person || !name.trim()}
                        laedt={aktion.laedt}
                        onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/unterweisungen/${id}/bestaetigen`, "POST", { beschaeftigter_id: person, name }); setPerson(null); setName(""); await neu(); geaendert(); })}
                        stil={{ marginTop: 16 }}
                      />
                    </Karte>
                  </Gruppe>
                ) : daten?.personen.length ? (
                  <Hinweis art="erfolg" text={t.unterweisung.alle_bestaetigt} />
                ) : null}
                <Knopf
                  text={t.mobil.unterweisung_abschliessen}
                  deaktiviert={!u.teilnahmen.length}
                  laedt={aktion.laedt}
                  onPress={() =>
                    void aktion.ausfuehren(async () => {
                      const r = await klient.schicken<{ erledigte_pflichten: number }>(`/v1/unterweisungen/${id}/abschliessen`, "POST");
                      await neu();
                      geaendert();
                      aktion.setMeldung(fuelle(t.unterweisung.erledigt, { n: r.erledigte_pflichten }));
                    })
                  }
                  stil={{ marginTop: 24 }}
                />
                <T v="caption" leise stil={{ marginTop: 6 }}>{t.unterweisung.abschliessen_text}</T>
                {!u.teilnahmen.length ? (
                  <Knopf leise gefahr text={t.unterweisung.loeschen} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/unterweisungen/${id}`, "DELETE"); geaendert(); nav.zurueck(); })} stil={{ marginTop: 16 }} />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Inhalt>
    </Unterseite>
  );
}
