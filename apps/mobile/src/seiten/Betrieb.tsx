import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { BUNDESLAENDER, PERSONEN_FELDER, type Betrieb as BetriebDaten, type PersonenArt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, Feld, Fuss, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, useFarben } from "../ui/thema";
import { neueId, personenSortiert, PERSONEN_LISTE } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Felder } from "./felder";
import { Gruppe, Inhalt, Seite } from "./gemeinsam";
import { CheckProfilZeile } from "./Pflichten";
import { SicherungSeite, WiederherstellenSeite } from "./Sicherung";

/** Eine gespeicherte Person bearbeiten (E-124). Eine neue Person ohne Namen verschwindet beim Verlassen wieder. */
function PersonSeite({ art, id, neu }: { art: PersonenArt; id: string; neu?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const [frage, setFrage] = useState(false);
  const p = z.stand[PERSONEN_LISTE[art]].find((x) => x.id === id);
  const zRef = useRef(z);
  zRef.current = z;
  useEffect(
    () => () => {
      const jetzt = zRef.current.stand[PERSONEN_LISTE[art]].find((x) => x.id === id);
      if (neu && jetzt && !jetzt.name.trim()) zRef.current.personLoeschen(art, id);
    },
    [art, id, neu],
  );
  if (!p) return <Unterseite titel="">{null}</Unterseite>;
  return (
    <Unterseite titel={p.name.trim() || TEXT.person_neu[art]}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 4, paddingBottom: 32 }}>
        <Felder felder={PERSONEN_FELDER[art]} werte={p} fehlt={[]} setze={(k, w) => z.personSetzen(art, { ...p, [k]: typeof w === "string" ? w : null })} />
        {frage ? (
          <Karte stil={{ paddingVertical: 14, gap: 10, marginTop: 24 }}>
            <T fett>{TEXT.loeschen_wirklich}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf gefahr text={TEXT.loeschen_ja} onPress={() => { z.personLoeschen(art, id); nav.zurueck(); }} stil={{ flex: 1 }} />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <TextKnopf symbol="trash" gefahr text={TEXT.loeschen} onPress={() => setFrage(true)} stil={{ marginTop: 24 }} />
        )}
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.fertig} onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Gespeicherte Mitarbeiter bzw. Kunden unter „Mein Betrieb“. */
function Personen({ art }: { art: PersonenArt }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const liste = personenSortiert(z.stand[PERSONEN_LISTE[art]]);
  const oeffnen = (id: string, neu = false) => nav.oeffnen(`person-${id}`, () => <PersonSeite art={art} id={id} neu={neu} />, true);
  return (
    <Gruppe titel={art === "mitarbeiter" ? TEXT.mitarbeiter_titel : TEXT.kunden_titel} fuss={liste.length ? undefined : TEXT.personen_leer[art]}>
      {liste.length ? (
        <Karte>
          {liste.map((p, i) => (
            <Zeile key={p.id} links={<Symbol name="person.crop.circle" groesse={22} farbe={f.tinteLeise} />} titel={p.name} text={(art === "mitarbeiter" ? p.taetigkeit : p.anschrift)?.split("\n")[0] || undefined} onPress={() => oeffnen(p.id)} letzte={i === liste.length - 1} />
          ))}
        </Karte>
      ) : null}
      <TextKnopf
        symbol="plus"
        text={TEXT.person_hinzufuegen[art]}
        onPress={() => {
          const id = neueId();
          z.personSetzen(art, { id, name: "" });
          oeffnen(id, true);
        }}
        stil={{ marginLeft: 4 }}
      />
    </Gruppe>
  );
}

/** Angaben zum Betrieb – speichern sich bei jeder Eingabe. */
export function BetriebFormular() {
  const { stand, betriebSpeichern } = useAmtlos();
  const [b, setB] = useState<BetriebDaten>(stand.betrieb);
  const feld = (k: keyof BetriebDaten) => ({
    wert: b[k],
    aendern: (w: string) => {
      const neu = { ...b, [k]: w };
      setB(neu);
      betriebSpeichern(neu);
    },
  });
  return (
    <View>
      <T leise>{TEXT.betrieb_text}</T>
      <Karte stil={{ marginTop: 12, paddingBottom: 14 }}>
        <Feld label={TEXT.b_name} {...feld("name")} textContentType="organizationName" />
        <Feld label={TEXT.b_strasse} {...feld("strasse")} textContentType="streetAddressLine1" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Feld label={TEXT.b_plz} {...feld("plz")} keyboardType="number-pad" textContentType="postalCode" />
          </View>
          <View style={{ flex: 2 }}>
            <Feld label={TEXT.b_ort} {...feld("ort")} textContentType="addressCity" />
          </View>
        </View>
        <Auswahl label={TEXT.b_bundesland} wert={b.bundesland || null} aendern={(w) => feld("bundesland").aendern(w)} optionen={BUNDESLAENDER.map((l) => ({ wert: l, text: l }))} />
        <Feld label={TEXT.b_verantwortlich} {...feld("verantwortlich")} textContentType="name" />
        <Feld label={TEXT.b_telefon} {...feld("telefon")} keyboardType="phone-pad" textContentType="telephoneNumber" />
        <Feld label={TEXT.b_email} {...feld("email")} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
      </Karte>
      <T v="klein" fett leise stil={{ marginTop: 20, marginBottom: 8, marginLeft: 4 }}>{TEXT.b_steuer}</T>
      <Karte stil={{ paddingBottom: 14 }}>
        <Feld label={TEXT.b_steuernummer} {...feld("steuernummer")} keyboardType="numbers-and-punctuation" />
        <Feld label={TEXT.b_ust_idnr} {...feld("ust_idnr")} autoCapitalize="characters" />
        <Feld label={TEXT.b_iban} {...feld("iban")} autoCapitalize="characters" />
      </Karte>
      <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{TEXT.gespeichert_auto}</T>
    </View>
  );
}

/** Tab „Mein Betrieb“: Angaben, Datensicherung, alles löschen. */
export function Betrieb() {
  const { allesLoeschen } = useAmtlos();
  const nav = useNav();
  const [frage, setFrage] = useState(false);
  const [zaehler, setZaehler] = useState(0);
  return (
    <Seite titel={TEXT.betrieb_titel}>
      {/* nach „alles löschen“ neu einhängen, damit die Felder leer sind */}
      <BetriebFormular key={zaehler} />
      <CheckProfilZeile />
      <Personen art="mitarbeiter" />
      <Personen art="kunde" />
      <Gruppe titel={TEXT.daten_titel} fuss={TEXT.daten_text}>
        <Knopf ton symbol="lock" text={TEXT.sichern} onPress={() => nav.oeffnen("sicherung", () => <SicherungSeite />, true)} />
        <TextKnopf symbol="arrow.clockwise" text={TEXT.wiederherstellen} onPress={() => nav.oeffnen("wiederherstellen", () => <WiederherstellenSeite fertig={() => setZaehler((x) => x + 1)} />, true)} stil={{ marginLeft: 4, marginTop: 4 }} />
      </Gruppe>
      <Gruppe fuss={TEXT.alles_loeschen_text}>
        {frage ? (
          <Karte stil={{ paddingVertical: 14, gap: 10 }}>
            <T fett>{TEXT.loeschen_wirklich}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf
                gefahr
                text={TEXT.loeschen_ja}
                onPress={() =>
                  void allesLoeschen().then(() => {
                    setFrage(false);
                    setZaehler((z) => z + 1);
                  })
                }
                stil={{ flex: 1 }}
              />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <TextKnopf gefahr symbol="trash" text={TEXT.alles_loeschen} onPress={() => setFrage(true)} />
        )}
      </Gruppe>
      <T v="caption" leise stil={{ marginTop: 24 }}>{TEXT.ueber}</T>
    </Seite>
  );
}
