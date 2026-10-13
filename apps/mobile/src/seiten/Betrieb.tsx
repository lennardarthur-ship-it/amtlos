import { useEffect, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { BUNDESLAENDER, HAUSFARBEN, PERSONEN_FELDER, VERSTEUERUNG, type Betrieb as BetriebDaten, type PersonenArt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { logoWaehlen } from "../unterlagen/logo";
import { Auswahl, Feld, Fuss, Karte, Knopf, Schalter, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, useFarben } from "../ui/thema";
import { allesLoeschenErlaubt, aufbewahrungspflichtig, neueId, personenSortiert, PERSONEN_LISTE } from "../unterlagen/speicher";
import { entsperren, sperreMoeglich } from "../unterlagen/sperre";
import { regelwert } from "../pflichten/check";
import { useAmtlos } from "../zustand";
import { Felder } from "./felder";
import { Gruppe, Inhalt, Seite, datumKurz } from "./gemeinsam";
import { CheckProfilZeile } from "./Pflichten";
import { CloudZeile, SicherungSeite, WiederherstellenSeite } from "./Sicherung";

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
    wert: b[k] ?? "",
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
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 2 }}>
            <Feld label={TEXT.b_bank} {...feld("bank")} />
          </View>
          <View style={{ flex: 1.3 }}>
            <Feld label={TEXT.b_bic} {...feld("bic")} autoCapitalize="characters" />
          </View>
        </View>
        <Auswahl label={TEXT.b_versteuerung} wert={b.versteuerung || null} aendern={(w) => feld("versteuerung").aendern(w)} optionen={VERSTEUERUNG} />
      </Karte>
      <T v="klein" fett leise stil={{ marginTop: 20, marginLeft: 4 }}>{TEXT.b_auftritt}</T>
      <T v="caption" leise stil={{ marginTop: 2, marginBottom: 8, marginLeft: 4 }}>{TEXT.b_auftritt_text}</T>
      <Karte stil={{ paddingVertical: 14, gap: 12 }}>
        <LogoWahl logo={b.logo ?? ""} setzen={(l) => feld("logo").aendern(l)} />
        <FarbWahl farbe={b.farbe ?? ""} setzen={(c) => feld("farbe").aendern(c)} />
        <Feld label={TEXT.b_website} {...feld("website")} keyboardType="url" autoCapitalize="none" placeholder="z. B. www.salon-sonne.de" />
      </Karte>
      <T v="klein" fett leise stil={{ marginTop: 20, marginLeft: 4 }}>{TEXT.b_gesellschaft}</T>
      <T v="caption" leise stil={{ marginTop: 2, marginBottom: 8, marginLeft: 4 }}>{TEXT.b_gesellschaft_text}</T>
      <Karte stil={{ paddingBottom: 14 }}>
        <Feld label={TEXT.b_rechtsform} {...feld("rechtsform")} placeholder="z. B. GmbH" />
        <Feld label={TEXT.b_registergericht} {...feld("registergericht")} placeholder="z. B. Amtsgericht München" />
        <Feld label={TEXT.b_registernummer} {...feld("registernummer")} placeholder="z. B. HRB 123456" autoCapitalize="characters" />
        <Feld label={TEXT.b_vertretung} {...feld("vertretung")} placeholder="Vor- und Nachname, mehrere mit Komma" />
      </Karte>
      <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{TEXT.gespeichert_auto}</T>
    </View>
  );
}

/** Tab „Mein Betrieb“: Angaben, Datensicherung, alles löschen. */
export function Betrieb() {
  const z = useAmtlos();
  const { allesLoeschen } = z;
  const nav = useNav();
  const [frage, setFrage] = useState(false);
  const [zaehler, setZaehler] = useState(0);
  const fest = aufbewahrungspflichtig(z.stand).length;
  const darfLoeschen = z.ladefehler || allesLoeschenErlaubt(z.stand);
  return (
    <Seite titel={TEXT.betrieb_titel}>
      {/* nach „alles löschen“ neu einhängen, damit die Felder leer sind */}
      <BetriebFormular key={zaehler} />
      <CheckProfilZeile />
      <Personen art="mitarbeiter" />
      <Personen art="kunde" />
      <Gruppe titel={TEXT.daten_titel} fuss={TEXT.daten_text}>
        <Datenschutz />
        <CloudZeile />
        <T v="klein" leise stil={{ marginLeft: 4, marginBottom: 8 }}>{TEXT.letzte_sicherung(z.stand.letzteSicherung ? datumKurz(z.stand.letzteSicherung) : null)}</T>
        <Knopf ton symbol="lock" text={TEXT.sichern} onPress={() => nav.oeffnen("sicherung", () => <SicherungSeite />, true)} />
        <TextKnopf symbol="arrow.clockwise" text={TEXT.wiederherstellen} onPress={() => nav.oeffnen("wiederherstellen", () => <WiederherstellenSeite fertig={() => setZaehler((x) => x + 1)} />, true)} stil={{ marginLeft: 4, marginTop: 4 }} />
      </Gruppe>
      <Gruppe fuss={TEXT.alles_loeschen_text}>
        {frage && !darfLoeschen ? (
          <Karte stil={{ paddingVertical: 14, gap: 10 }}>
            <T>{TEXT.loeschen_gesperrt(fest, regelwert("steuern.aufbewahrung.belege_jahre") ?? 8)}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf symbol="lock" text={TEXT.jetzt_sichern} onPress={() => { setFrage(false); nav.oeffnen("sicherung", () => <SicherungSeite />, true); }} stil={{ flex: 1 }} />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : frage ? (
          <Karte stil={{ paddingVertical: 14, gap: 10 }}>
            <T fett>{TEXT.loeschen_wirklich}</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Knopf
                gefahr
                text={TEXT.loeschen_ja}
                onPress={() =>
                  void allesLoeschen().then(() => {
                    setFrage(false);
                    setZaehler((x) => x + 1);
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

/** Verschlüsselung (Anzeige) und App-Sperre mit Face ID (E-129). */
function Datenschutz() {
  const z = useAmtlos();
  const f = useFarben();
  const [moeglich, setMoeglich] = useState(false);
  useEffect(() => {
    void sperreMoeglich().then(setMoeglich);
  }, []);
  if (!z.verschluesselt && !moeglich) return null;
  return (
    <Karte stil={{ paddingVertical: 12, gap: 10, marginBottom: 10 }}>
      {z.verschluesselt ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Symbol name="lock.shield" groesse={20} farbe={f.amt} />
          <View style={{ flex: 1 }}>
            <T fett>{TEXT.verschluesselt}</T>
            <T v="klein" leise>{TEXT.verschluesselt_hilfe}</T>
          </View>
        </View>
      ) : null}
      {moeglich ? (
        <Schalter
          label={TEXT.app_sperre}
          hilfe={TEXT.app_sperre_hilfe}
          wert={z.stand.appSperre}
          aendern={(an) => void entsperren(TEXT.entsperren_grund).then((ok) => ok && z.appSperreSetzen(an))}
        />
      ) : null}
    </Karte>
  );
}

/** Logo für den Briefkopf wählen oder entfernen. */
function LogoWahl({ logo, setzen }: { logo: string; setzen: (l: string) => void }) {
  const f = useFarben();
  const [fehler, setFehler] = useState(false);
  const waehlen = () => {
    setFehler(false);
    void logoWaehlen()
      .then((l) => l && setzen(l))
      .catch(() => setFehler(true));
  };
  return (
    <View style={{ gap: 8 }}>
      <T v="klein" fett>{TEXT.b_logo}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 120, height: 56, borderRadius: 8, borderWidth: 1, borderColor: f.linie, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 112, height: 48 }} resizeMode="contain" accessibilityLabel={TEXT.b_logo} /> : <T v="caption" leise>{TEXT.kein_logo}</T>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextKnopf symbol="photo" text={logo ? TEXT.logo_aendern : TEXT.logo_waehlen} onPress={waehlen} />
          {logo ? <TextKnopf symbol="trash" text={TEXT.logo_entfernen} onPress={() => setzen("")} /> : null}
        </View>
      </View>
      {fehler ? <T v="caption" farbe={f.frist}>{TEXT.logo_fehler}</T> : null}
    </View>
  );
}

/** Hausfarbe aus einer kleinen, für Druck und Lesbarkeit geprüften Auswahl. */
function FarbWahl({ farbe, setzen }: { farbe: string; setzen: (c: string) => void }) {
  const f = useFarben();
  return (
    <View style={{ gap: 8 }}>
      <T v="klein" fett>{TEXT.b_farbe}</T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {HAUSFARBEN.map((h) => {
          const an = (farbe || HAUSFARBEN[0]!.wert) === h.wert;
          return (
            <Pressable key={h.wert} accessibilityRole="radio" accessibilityLabel={h.text} accessibilityState={{ checked: an }} onPress={() => setzen(h.wert)} hitSlop={4} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: h.wert, borderWidth: an ? 3 : 0, borderColor: f.tinte, alignItems: "center", justifyContent: "center" }}>
              {an ? <Symbol name="checkmark" groesse={16} farbe="#ffffff" gewicht="bold" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
