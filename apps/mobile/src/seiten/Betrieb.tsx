import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { BUNDESLAENDER, HAUSFARBEN, PERSONEN_FELDER, VERSTEUERUNG, VORLAGEN, emailGueltig, ibanGueltig, plzGueltig, type Betrieb as BetriebDaten, type PersonenArt } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { logoWaehlen } from "../unterlagen/logo";
import { AuswahlZeile } from "../ui/auswahlseite";
import { type Ton, DatumFeld, Feld, Fuss, Initialen, Karte, Knopf, Schalter, Suchfeld, Symbol, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND, RADIUS, useFarben, weich } from "../ui/thema";
import { allesLoeschenErlaubt, aufbewahrungspflichtig, betriebFehlt, neueId, personenSortiert, PERSONEN_LISTE } from "../unterlagen/speicher";
import { entsperren, sperreMoeglich } from "../unterlagen/sperre";
import { KATALOG, regelwert } from "../pflichten/check";
import { APP_VERSION } from "../version";
import { useAmtlos } from "../zustand";
import { bestaetigen } from "../ui/bestaetigen";
import { Ansage, Felder } from "./felder";
import { BuehnenSeite, Gruppe, Inhalt, datumKurz } from "./gemeinsam";
import { CheckProfilZeile } from "./Pflichten";
import { CloudZeile, SicherungSeite, WiederherstellenSeite } from "./Sicherung";
import { ProZeile, useProSperre } from "./Pro";
import { CodeEinloesenKnopf } from "./Partner";
import { paywallVerfuegbar } from "../pro/kauf";
import { UeberGruppe } from "./Recht";
import { SteuerberatungSeite } from "./Steuerberatung";
import { KontrollmappeSeite } from "./Kontrollmappe";
import { KontoZeile } from "./Konto";
import { gemischteUmsaetze, vorsteuerquoteAus } from "../unterlagen/ustAusRechnungen";
import { MitarbeiterZusatz } from "./Mitarbeiter";
import { StaettenSeite, staettenText } from "./BetriebStaetten";
import { syncAngeboten } from "../konto/konfig";
import { useKonto } from "../konto/konto";

/** Eine gespeicherte Person bearbeiten (E-124). Eine neue Person ohne Namen verschwindet beim Verlassen wieder. */
export function PersonSeite({ art, id, neu }: { art: PersonenArt; id: string; neu?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
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
        {/* R12 Personal: Betriebsstätte, Aufenthaltstitel, doppelter Name */}
        {art === "mitarbeiter" ? <MitarbeiterZusatz p={p} /> : null}
        {/* E-165: Personenkonto des Kunden – vergeben von der App, nur zum Ansehen */}
        {art === "kunde" && p.personenkonto ? <T v="caption" leise stil={{ marginTop: 10 }}>{TEXT.person_personenkonto(p.personenkonto)}</T> : null}
        <TextKnopf
          symbol="trash"
          gefahr
          text={TEXT.loeschen}
          onPress={() =>
            void bestaetigen({ titel: TEXT.loeschen_wirklich, ja: TEXT.loeschen_ja }).then((ok) => {
              if (!ok) return;
              z.personLoeschen(art, id);
              melden(TEXT.geloescht);
              nav.zurueck();
            })
          }
          stil={{ marginTop: 24 }}
        />
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.fertig} onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Beschäftigte laut Pflichten-Check (0, wenn unbekannt) – für die Brücke „aus dem Check – jetzt eintragen“. */
function ausCheckBeschaeftigte(profil: Record<string, unknown>): number {
  const n = profil["beschaeftigte.gesamt"];
  return typeof n === "number" && n > 0 ? n : 0;
}

/** Gespeicherte Mitarbeiter bzw. Kunden – eigene Seite mit Liste und „hinzufügen“. */
function PersonenSeite({ art }: { art: PersonenArt }) {
  const z = useAmtlos();
  const nav = useNav();
  const [suche, setSuche] = useState("");
  const alle = personenSortiert(z.stand[PERSONEN_LISTE[art]]);
  const s = suche.trim().toLocaleLowerCase("de");
  const liste = s ? alle.filter((p) => `${p.name} ${p.anschrift ?? ""} ${p.taetigkeit ?? ""}`.toLocaleLowerCase("de").includes(s)) : alle;
  const oeffnen = (id: string, neu = false) => nav.oeffnen(`person-${id}`, () => <PersonSeite art={art} id={id} neu={neu} />, true);
  const anlegen = () => {
    const id = neueId();
    z.personSetzen(art, { id, name: "" });
    oeffnen(id, true);
  };
  return (
    <Unterseite titel={art === "mitarbeiter" ? TEXT.mitarbeiter_titel : TEXT.kunden_titel} unter={TEXT.personen_text[art]}>
      <Inhalt>
        {alle.length > 6 ? (
          <View style={{ marginTop: 14 }}>
            <Suchfeld wert={suche} setzen={setSuche} label={TEXT.liste_suchen} />
          </View>
        ) : null}
        {s && !liste.length ? <T v="klein" leise stil={{ marginTop: 14 }}>{TEXT.keine_treffer}</T> : null}
        {liste.length ? (
          <Karte stil={{ marginTop: 14 }}>
            {liste.map((p, i) => (
              <Zeile key={p.id} links={<Initialen name={p.name} />} titel={p.name} text={(art === "mitarbeiter" ? p.taetigkeit : p.anschrift)?.split("\n")[0] || undefined} onPress={() => oeffnen(p.id)} letzte={i === liste.length - 1} />
            ))}
          </Karte>
        ) : !s ? (
          <T v="klein" leise stil={{ marginTop: 14 }}>{art === "mitarbeiter" && ausCheckBeschaeftigte(z.stand.profil) ? TEXT.r11_mitarbeiter_bruecke_text(ausCheckBeschaeftigte(z.stand.profil)) : TEXT.personen_leer[art]}</T>
        ) : null}
        <Knopf ton symbol="plus" text={TEXT.person_hinzufuegen[art]} onPress={anlegen} stil={{ marginTop: 16 }} />
      </Inhalt>
    </Unterseite>
  );
}

type Teil = "angaben" | "steuer" | "auftritt" | "gesellschaft";
const TEILE: Teil[] = ["angaben", "steuer", "auftritt", "gesellschaft"];

/**
 * „Gesellschaft“ (Rechtsform, Register) nur zeigen, wenn sie passen kann: nicht für Einzelunternehmen und Freiberufler
 * laut Pflichten-Check – außer es steht schon etwas darin.
 */
function mitGesellschaft(profil: Record<string, unknown>, b: BetriebDaten): boolean {
  const rf = profil.rechtsform;
  if (rf !== "einzelunternehmen" && rf !== "freiberuf") return true;
  return [b.rechtsform, b.registergericht, b.registernummer, b.vertretung].some((x) => (x ?? "").trim());
}

/** Rechtsform aus dem Pflichten-Check als Text für „Mein Betrieb“ (R10) – Einzelunternehmen und Freiberuf ohne Register. */
const RECHTSFORM_AUS_CHECK: Record<string, string> = { gbr: "GbR", ek: "e. K.", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG", partg: "PartG", partg_mbb: "PartG mbB" };

/** Plausibilität (IBAN-Prüfsumme, PLZ, E-Mail) – nur als Hinweis am Feld, gespeichert wird trotzdem. */
function pruefung(k: keyof BetriebDaten, w: string): string | null {
  if (k === "iban") return ibanGueltig(w) ? null : TEXT.iban_ungueltig;
  if (k === "plz") return plzGueltig(w) ? null : TEXT.plz_ungueltig;
  if (k === "email") return emailGueltig(w) ? null : TEXT.email_ungueltig;
  return null;
}

/**
 * Absender einer Rechnung eintragen – nur Angaben und Steuer/Bank, mit „Fertig“ zurück in den Ablauf (statt des
 * ganzen Betriebsformulars). Die Angaben landen wie immer unter „Mein Betrieb“.
 */
export function AbsenderSeite() {
  const nav = useNav();
  return (
    <Unterseite titel={TEXT.absender_titel} unter={TEXT.absender_text}>
      <Inhalt>
        <BetriebFormular teile={["angaben", "steuer"]} />
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.absender_fertig} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/**
 * Angaben zum Betrieb – speichern sich bei jeder Eingabe. Ohne `teil` das ganze Formular (erster Eintrag), sonst nur
 * ein Abschnitt (Unterseiten von „Mein Betrieb“).
 */
export function BetriebFormular({ teil, teile }: { teil?: Teil; teile?: Teil[] }) {
  const { stand, betriebSpeichern, pro } = useAmtlos();
  const sperre = useProSperre();
  const f = useFarben();
  const [b, setB] = useState<BetriebDaten>(stand.betrieb);
  // E-165: Vorsteuerquote nur zeigen, wenn es steuerfreie und steuerpflichtige Rechnungen gibt (oder schon eine Quote)
  const gemischt = gemischteUmsaetze(stand.unterlagen, stand.betrieb);
  // geprüft wird ein Feld erst nach dem Verlassen (beim Tippen wäre jede halbe IBAN „ungültig“) – gespeicherte Werte sofort
  const [verlassen, setVerlassen] = useState<Set<keyof BetriebDaten>>(() => new Set((["iban", "plz", "email"] as const).filter((k) => (stand.betrieb[k] ?? "").trim())));
  const feld = (k: keyof BetriebDaten) => ({
    wert: b[k] ?? "",
    aendern: (w: string) => {
      const neu = { ...b, [k]: w };
      setB(neu);
      betriebSpeichern(neu);
    },
    fehler: verlassen.has(k) ? pruefung(k, b[k] ?? "") : null,
    onBlur: () => setVerlassen((v) => (v.has(k) ? v : new Set(v).add(k))),
  });
  const zeigt = (t: Teil) => (teile ? teile.includes(t) : !teil || teil === t) && (t !== "gesellschaft" || Boolean(teil) || mitGesellschaft(stand.profil, b));
  // Rechtsform aus dem Pflichten-Check vorbelegen, solange sie leer ist (R10) – einmal beim Öffnen des Abschnitts
  // eine GbR im Gesellschaftsregister führt den Zusatz „eGbR“ (§ 707a Abs. 2 BGB)
  const ausCheck = stand.profil.rechtsform === "gbr" && stand.profil["gesellschaft.handelsregister"] === "eingetragen" ? "eGbR" : RECHTSFORM_AUS_CHECK[String(stand.profil.rechtsform ?? "")];
  useEffect(() => {
    if (zeigt("gesellschaft") && ausCheck && !(b.rechtsform ?? "").trim()) feld("rechtsform").aendern(ausCheck);
    // nur beim Öffnen des Formulars
  }, []);
  const kopf = (t: Teil, titel: string, text?: string) =>
    teil ? (
      <T leise stil={{ marginBottom: 12 }}>{text ?? TEXT.teil_text[t]}</T>
    ) : (
      <View style={{ marginTop: t === "angaben" ? 0 : 20, marginBottom: 8, marginLeft: 4 }}>
        <T v="klein" fett leise accessibilityRole="header">{titel}</T>
        {text ? <T v="caption" leise stil={{ marginTop: 2 }}>{text}</T> : null}
      </View>
    );
  return (
    <View>
      {!teil && !teile ? <T leise stil={{ marginBottom: 12 }}>{TEXT.betrieb_text}</T> : null}
      {zeigt("angaben") ? (
        <View>
          {teil ? kopf("angaben", "") : null}
          <Karte stil={{ paddingBottom: 14 }}>
            <Feld label={TEXT.b_name} {...feld("name")} textContentType="organizationName" />
            <Feld label={TEXT.b_strasse} {...feld("strasse")} textContentType="streetAddressLine1" />
            {/* PLZ und Ort nebeneinander; die Meldung zur PLZ steht darunter über die ganze Breite – neben „Ort“ verschöbe sie das Raster (G7) */}
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Feld label={TEXT.b_plz} {...feld("plz")} ohneFehlerText keyboardType="number-pad" textContentType="postalCode" />
              </View>
              <View style={{ flex: 2 }}>
                <Feld label={TEXT.b_ort} {...feld("ort")} textContentType="addressCity" />
              </View>
            </View>
            {feld("plz").fehler ? <T v="caption" farbe={f.frist} stil={{ marginTop: 5 }}>{feld("plz").fehler}</T> : null}
            <AuswahlZeile label={TEXT.b_bundesland} wert={b.bundesland || null} aendern={(w) => feld("bundesland").aendern(w)} optionen={BUNDESLAENDER.map((l) => ({ wert: l, text: l }))} />
            <Feld label={TEXT.b_verantwortlich} {...feld("verantwortlich")} textContentType="name" />
            <Feld label={TEXT.b_telefon} {...feld("telefon")} keyboardType="phone-pad" textContentType="telephoneNumber" />
            <Feld label={TEXT.b_email} {...feld("email")} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoCorrect={false} spellCheck={false} />
          </Karte>
        </View>
      ) : null}
      {zeigt("steuer") ? (
        <View>
          {kopf("steuer", TEXT.b_steuer)}
          <Karte stil={{ paddingBottom: 14 }}>
            <Feld label={TEXT.b_steuernummer} {...feld("steuernummer")} keyboardType="numbers-and-punctuation" autoCorrect={false} spellCheck={false} />
            <Feld label={TEXT.b_ust_idnr} {...feld("ust_idnr")} autoCapitalize="characters" autoCorrect={false} spellCheck={false} />
            <Feld label={TEXT.b_iban} {...feld("iban")} autoCapitalize="characters" autoCorrect={false} spellCheck={false} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Feld label={TEXT.b_bank} {...feld("bank")} />
              </View>
              <View style={{ flex: 1.3 }}>
                <Feld label={TEXT.b_bic} {...feld("bic")} autoCapitalize="characters" autoCorrect={false} spellCheck={false} />
              </View>
            </View>
            {/* R11 (Kosmetik #25): Soll ist der Normalfall und vorausgewählt; Ist nur auf Antrag */}
            <Wahl label={TEXT.b_versteuerung} hilfe={TEXT.b_versteuerung_hilfe} wert={b.versteuerung || "soll"} aendern={(w) => feld("versteuerung").aendern(w)} optionen={VERSTEUERUNG.map((o) => ({ wert: o.wert, text: TEXT.r11_versteuerung[o.wert] ?? o.text }))} />
            {/* R11 (Kosmetik #2/#8): Wechsel von der Kleinunternehmerregelung – bis wann galt sie? */}
            <DatumFeld label={TEXT.b_ku_bis} hilfe={TEXT.b_ku_bis_hilfe} wert={b.ku_bis || null} aendern={(w) => feld("ku_bis").aendern(w ?? "")} ohneHeute />
            {/* E-165 (StB-Prüfung 5.2): Vorsteuerquote nur bei steuerfreien und steuerpflichtigen Umsätzen */}
            {gemischt || (b.vorsteuerquote ?? "").trim() ? <Feld label={TEXT.b_vorsteuerquote} hilfe={TEXT.b_vorsteuerquote_hilfe} {...feld("vorsteuerquote")} keyboardType="decimal-pad" placeholder="z. B. 13" optional fehler={(b.vorsteuerquote ?? "").trim() && vorsteuerquoteAus(b) === null ? TEXT.beleg_vst_anteil_falsch : null} /> : null}
          </Karte>
        </View>
      ) : null}
      {zeigt("auftritt") ? (
        <View>
          {kopf("auftritt", TEXT.b_auftritt, TEXT.b_auftritt_text)}
          <Karte stil={{ paddingVertical: 14, gap: 12 }}>
            {!pro ? <T v="caption" leise>{TEXT.pro_grund.briefkopf(0)}</T> : null}
            <LogoWahl logo={b.logo ?? ""} setzen={(l) => (!l || sperre("briefkopf")) && feld("logo").aendern(l)} />
            <FarbWahl farbe={b.farbe ?? ""} setzen={(c) => sperre("briefkopf") && feld("farbe").aendern(c)} />
            <Feld label={TEXT.b_website} {...feld("website")} keyboardType="url" autoCapitalize="none" placeholder="z. B. www.salon-sonne.de" autoCorrect={false} spellCheck={false} />
          </Karte>
        </View>
      ) : null}
      {zeigt("gesellschaft") ? (
        <View>
          {kopf("gesellschaft", TEXT.b_gesellschaft, TEXT.b_gesellschaft_text)}
          <Karte stil={{ paddingBottom: 14 }}>
            <Feld label={TEXT.b_rechtsform} {...feld("rechtsform")} placeholder="z. B. GmbH" />
            <Feld label={TEXT.b_registergericht} {...feld("registergericht")} placeholder="z. B. Amtsgericht München" />
            <Feld label={TEXT.b_registernummer} {...feld("registernummer")} placeholder="z. B. HRB 123456" autoCapitalize="characters" autoCorrect={false} spellCheck={false} />
            <Feld label={TEXT.b_vertretung} {...feld("vertretung")} placeholder="Vor- und Nachname, mehrere mit Komma" />
          </Karte>
        </View>
      ) : null}
      <T v="caption" leise stil={{ marginTop: 8, marginLeft: 4 }}>{TEXT.gespeichert_auto}</T>
    </View>
  );
}

/** Unterseite für einen Abschnitt der Betriebsangaben. */
function TeilSeite({ teil }: { teil: Teil }) {
  return (
    <Unterseite titel={TEXT.teil_titel[teil]}>
      <Inhalt>
        <BetriebFormular teil={teil} />
      </Inhalt>
    </Unterseite>
  );
}

/** Kurze Zusammenfassung je Abschnitt für die Übersicht – was drinsteht, sonst was dort hingehört. */
function zusammenfassung(b: BetriebDaten, teil: Teil): string {
  const w = (k: keyof BetriebDaten) => (b[k] ?? "").trim();
  switch (teil) {
    case "angaben": {
      const anschrift = [w("strasse"), [w("plz"), w("ort")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return [anschrift, w("email") || w("telefon")].filter(Boolean).join(" · ") || TEXT.teil_leer.angaben;
    }
    case "steuer": {
      const da = [w("steuernummer") && TEXT.b_steuernummer, w("ust_idnr") && TEXT.b_ust_idnr, w("iban") && TEXT.b_iban, w("versteuerung") && (w("versteuerung") === "ist" ? "Ist-Versteuerung" : "Soll-Versteuerung")].filter(Boolean) as string[];
      return da.length ? da.join(" · ") : TEXT.teil_leer.steuer;
    }
    case "auftritt": {
      const da = [w("logo") && TEXT.b_logo, HAUSFARBEN.find((h) => h.wert === w("farbe"))?.text, w("website")].filter(Boolean) as string[];
      return da.length ? da.join(" · ") : TEXT.teil_leer.auftritt;
    }
    case "gesellschaft": {
      const da = [w("rechtsform"), w("registernummer")].filter(Boolean);
      return da.length ? da.join(" · ") : TEXT.teil_leer.gesellschaft;
    }
  }
}

const TEIL_SYMBOL: Record<Teil, string> = { angaben: "building.2", steuer: "building.columns", auftritt: "paintpalette", gesellschaft: "doc.text" };
const TEIL_TON: Record<Teil, Ton> = { angaben: "amt", steuer: "blau", auftritt: "lila", gesellschaft: "gold" };

/** Kopf der Übersicht: Logo oder Anfangsbuchstabe in der Hausfarbe, Name und Ort. */
/** Kopf auf der Bühne (E-142): Logo bzw. Anfangsbuchstabe, Name groß, Ort und Verantwortliche – antippen bearbeitet. */
function BetriebKopf({ b, onPress }: { b: BetriebDaten; onPress: () => void }) {
  const f = useFarben();
  const farbe = b.farbe || HAUSFARBEN[0]!.wert;
  const leer = betriebFehlt(b);
  if (leer)
    return (
      <View style={{ gap: 16 }}>
        <T v="grossTitel" accessibilityRole="header" farbe={f.buehneText}>{TEXT.betrieb_titel}</T>
        <T farbe={f.buehneLeise}>{TEXT.betrieb_zeile_text}</T>
        <Knopf buehne text={TEXT.betrieb_eintragen} onPress={onPress} />
      </View>
    );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${b.name}: ${TEXT.teil_titel.angaben}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, opacity: pressed ? 0.75 : 1 })}>
      {b.logo ? (
        <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Image source={{ uri: b.logo }} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityLabel={TEXT.b_logo} />
        </View>
      ) : (
        <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: farbe, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.18)" }}>
          <T v="titel" farbe="#ffffff">{b.name.trim().charAt(0).toUpperCase()}</T>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="titel" accessibilityRole="header" numberOfLines={2} farbe={f.buehneText}>{b.name.trim()}</T>
        <T v="klein" numberOfLines={2} farbe={f.buehneLeise} stil={{ marginTop: 2 }}>{[b.ort.trim(), b.verantwortlich.trim()].filter(Boolean).join(" · ") || TEXT.teil_leer.angaben}</T>
      </View>
      <Symbol name="chevron.right" groesse={15} farbe={f.buehneLeise} gewicht="semibold" />
    </Pressable>
  );
}

/** Tab „Mein Betrieb“: Übersicht wie in den iOS-Einstellungen – jede Gruppe auf einer eigenen Seite. */
/** Präfix der beiseitegelegten (unlesbaren) Stände – wie in zustand.tsx (`${SCHLUESSEL}.unlesbar.`) */
const BEISEITE_PRAEFIX = "amtlos.unterlagen.v1.unlesbar.";

/** Gibt es beiseitegelegte Stände (H4)? Nur dann steht „Beiseitegelegte Daten erneut öffnen“ da. */
function useBeiseitegelegt(stand: unknown): boolean {
  const [da, setDa] = useState(false);
  useEffect(() => {
    let aktiv = true;
    void AsyncStorage.getAllKeys()
      .then((k) => aktiv && setDa(k.some((x) => x.startsWith(BEISEITE_PRAEFIX))))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [stand]);
  return da;
}

export function Betrieb() {
  const z = useAmtlos();
  const { allesLoeschen } = z;
  const nav = useNav();
  const melden = useMeldung();
  const beiseite = useBeiseitegelegt(z.ladefehler);
  const [versucht, setVersucht] = useState(false);
  const [frage, setFrage] = useState(false);
  const [zaehler, setZaehler] = useState(0);
  const fest = aufbewahrungspflichtig(z.stand).length;
  const darfLoeschen = z.ladefehler || allesLoeschenErlaubt(z.stand);
  const b = z.stand.betrieb;
  const oeffneTeil = (t: Teil) => nav.oeffnen(`betrieb-${t}`, () => <TeilSeite teil={t} />);
  const oeffneAlles = () =>
    nav.oeffnen("betrieb", () => (
      <Unterseite titel={TEXT.betrieb_titel}>
        <Inhalt>
          <BetriebFormular />
        </Inhalt>
      </Unterseite>
    ));
  const personen = (art: PersonenArt) => personenSortiert(z.stand[PERSONEN_LISTE[art]]);
  // R11 (UX #14, Berater #17): Sätze zur Synchronisation nur, wenn sie auf diesem Gerät eingerichtet ist
  const konto = useKonto();
  const syncAn = syncAngeboten && konto.status === "aktiv";
  // R11 (Berater d): Beschäftigte laut Check, aber noch niemand eingetragen – Brücke zur Liste
  const ausCheck = ausCheckBeschaeftigte(z.stand.profil);
  const teileSichtbar = TEILE.filter((t) => t !== "gesellschaft" || mitGesellschaft(z.stand.profil, b));
  return (
    <BuehnenSeite key={zaehler} ueber={betriebFehlt(b) ? undefined : TEXT.betrieb_titel} buehne={<BetriebKopf b={b} onPress={betriebFehlt(b) ? oeffneAlles : () => oeffneTeil("angaben")} />}>
      <ProZeile />
      {/* Phase 2.3: Partner-Lizenzen über Apples Angebotscodes – Apples Einlöseblatt, nie ein eigener Freischaltweg */}
      {paywallVerfuegbar && !z.pro ? <CodeEinloesenKnopf leise /> : null}
      <Gruppe titel={TEXT.betrieb_gruppe}>
        <Karte>
          {teileSichtbar.map((t) => (
            <Zeile key={t} symbol={TEIL_SYMBOL[t]} ton={TEIL_TON[t]} titel={TEXT.teil_titel[t]} text={zusammenfassung(b, t)} onPress={() => oeffneTeil(t)} />
          ))}
          {/* R12 (Bäckerei #7): Betriebsstätten – der Betrieb ist Betriebsstätte 1 */}
          <Zeile symbol="storefront" ton="blau" titel={TEXT.r12p_staetten_titel} text={staettenText(z.stand)} onPress={() => nav.oeffnen("staetten", () => <StaettenSeite betriebOeffnen={() => oeffneTeil("angaben")} />)} letzte />
        </Karte>
      </Gruppe>
      <CheckProfilZeile />
      <Gruppe titel={TEXT.steuerpaket_titel}>
        <Karte>
          <Zeile symbol="briefcase" ton="gold" titel={TEXT.steuerpaket_zeile} text={TEXT.steuerpaket_zeile_text} onPress={() => nav.oeffnen("steuerberatung", () => <SteuerberatungSeite />, true)} letzte />
        </Karte>
      </Gruppe>
      <Gruppe titel={TEXT.kontrollmappe_gruppe_titel}>
        <Karte>
          <Zeile symbol="folder" ton="blau" titel={TEXT.kontrollmappe_zeile} text={TEXT.kontrollmappe_zeile_text} onPress={() => nav.oeffnen("kontrollmappe", () => <KontrollmappeSeite />, true)} letzte />
        </Karte>
      </Gruppe>
      <Gruppe titel={TEXT.personen_gruppe}>
        <Karte>
          {(["mitarbeiter", "kunde"] as PersonenArt[]).map((art, i) => {
            const l = personen(art);
            return (
              <Zeile
                key={art}
                symbol={art === "mitarbeiter" ? "person.2" : "person.crop.circle"} ton={art === "mitarbeiter" ? "lila" : "blau"}
                titel={art === "mitarbeiter" ? TEXT.mitarbeiter_titel : TEXT.kunden_titel}
                text={l.length ? TEXT.personen_anzahl[art](l.length) : art === "mitarbeiter" && ausCheck ? TEXT.r11_mitarbeiter_bruecke(ausCheck) : TEXT.personen_leer_kurz[art]}
                onPress={() => nav.oeffnen(`personen-${art}`, () => <PersonenSeite art={art} />)}
                letzte={i === 1}
              />
            );
          })}
        </Karte>
      </Gruppe>
      <Gruppe titel={TEXT.daten_titel} fuss={syncAn ? TEXT.daten_text_sync : syncAngeboten ? TEXT.r11_daten_text_ohne_sync : TEXT.daten_text}>
        <Datenschutz />
        <KontoZeile />
        <CloudZeile />
        {/* Sichern und Wiederherstellen als Listenzeilen – wie in den iPhone-Einstellungen */}
        <Karte>
          <Zeile symbol="lock.fill" titel={TEXT.sichern} label={TEXT.sichern} text={TEXT.letzte_sicherung(z.stand.letzteSicherung ? datumKurz(z.stand.letzteSicherung) : null)} onPress={() => nav.oeffnen("sicherung", () => <SicherungSeite />, true)} />
          <Zeile symbol="arrow.clockwise" ton="blau" titel={TEXT.wiederherstellen} label={TEXT.wiederherstellen} onPress={() => nav.oeffnen("wiederherstellen", () => <WiederherstellenSeite fertig={() => setZaehler((x) => x + 1)} />, true)} letzte />
        </Karte>
      </Gruppe>
      {beiseite && !z.ladefehler ? (
        <Karte stil={{ marginTop: 16 }}>
          <Zeile
            symbol="arrow.clockwise"
            ton="blau"
            titel={TEXT.beiseitegelegte_versuchen}
            onPress={() => {
              if (versucht) return;
              setVersucht(true);
              void z.beiseitegelegteVersuchen().then((n) => melden(TEXT.beiseitegelegte_ergebnis(n))).finally(() => setVersucht(false));
            }}
            letzte
          />
        </Karte>
      ) : null}
      <Gruppe fuss={syncAn ? `${TEXT.alles_loeschen_text} ${TEXT.r11_alles_loeschen_sync} ${TEXT.r11_alles_loeschen_kopien_sync}` : `${TEXT.alles_loeschen_text} ${TEXT.alles_loeschen_kopien_hinweis}`}>
        {frage && !darfLoeschen ? (
          <Karte stil={{ paddingVertical: 14, gap: 10 }}>
            <T>{TEXT.r12p_loeschen_gesperrt(fest, regelwert("steuern.aufbewahrung.belege_jahre") ?? 8)}</T>
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
                  void (async () => {
                    // Ladefehler (H4): nur nach einer zweiten, ausdrücklichen Bestätigung – die unlesbaren Daten bleiben beiseitegelegt
                    if (z.ladefehler && !(await bestaetigen({ titel: TEXT.ladefehler_alles_loeschen_wirklich, text: TEXT.ladefehler_alles_loeschen_text, ja: TEXT.alles_loeschen }))) return;
                    await allesLoeschen(z.ladefehler);
                    setFrage(false);
                    setZaehler((x) => x + 1);
                  })()
                }
                stil={{ flex: 1 }}
              />
              <Knopf ton text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <Karte>
            <Zeile gefahr titel={TEXT.alles_loeschen} label={TEXT.alles_loeschen} onPress={() => { weich(); setFrage(true); }} letzte />
          </Karte>
        )}
      </Gruppe>
      <Gruppe titel={TEXT.ueber_titel}>
        <UeberGruppe />
      </Gruppe>
      <View style={{ marginTop: 28, gap: 4, paddingHorizontal: 4 }}>
        <T v="caption" leise>{TEXT.ueber_version(APP_VERSION, VORLAGEN.length, KATALOG.pflichten.length)}</T>
        <T v="caption" leise>{TEXT.ueber}</T>
      </View>
    </BuehnenSeite>
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
  const { pro } = useAmtlos();
  const [fehler, setFehler] = useState(false);
  const waehlen = () => {
    setFehler(false);
    void logoWaehlen()
      .then((l) => l && setzen(l))
      .catch(() => setFehler(true));
  };
  return (
    <View style={{ gap: 8 }}>
      <T v="klein" fett>{TEXT.mitPro(TEXT.b_logo, pro)}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 120, height: 56, borderRadius: RADIUS.klein, borderWidth: 1, borderColor: f.linie, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 112, height: 48 }} resizeMode="contain" accessibilityLabel={TEXT.b_logo} /> : <T v="caption" leise>{TEXT.kein_logo}</T>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextKnopf symbol="photo" text={logo ? TEXT.logo_aendern : TEXT.logo_waehlen} onPress={waehlen} />
          {logo ? <TextKnopf symbol="trash" text={TEXT.logo_entfernen} onPress={() => setzen("")} /> : null}
        </View>
      </View>
      {fehler ? <Ansage v="caption" fett={false} farbe={f.frist} text={TEXT.logo_fehler} /> : null}
    </View>
  );
}

/** Hausfarbe aus einer kleinen, für Druck und Lesbarkeit geprüften Auswahl. */
function FarbWahl({ farbe, setzen }: { farbe: string; setzen: (c: string) => void }) {
  const f = useFarben();
  const { pro } = useAmtlos();
  return (
    <View style={{ gap: 8 }}>
      <T v="klein" fett>{TEXT.mitPro(TEXT.b_farbe, pro)}</T>
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
