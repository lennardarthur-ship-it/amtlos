import { Linking, Share, View } from "react-native";
import { ANBIETER, DATENSCHUTZ, LINKS, datenschutzAbschnitte, hilfeZiel } from "../rechtliches";
import { syncAngeboten } from "../konto/konfig";
import { T as TEXT } from "../texte";
import { Hinweis, Karte, T, Zeile } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { Inhalt, RechtsHinweis } from "./gemeinsam";

/**
 * Impressum der App (§ 5 DDG) aus `rechtliches.ts` – fehlende Angaben stehen als „folgt“ da. Das ist nur im
 * Entwicklungsstand erreichbar: `werkzeuge/store-check.mjs` meldet jede leere Pflichtangabe, bevor ein Build eingereicht
 * wird (App-Review B1).
 */
export function ImpressumSeite() {
  const f = useFarben();
  const zeile = (titel: string, wert: string) => (
    <View key={titel} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: f.linieLeise }}>
      <T v="caption" fett leise>{titel}</T>
      <T stil={{ marginTop: 2 }} leise={!wert}>{wert || TEXT.folgt}</T>
    </View>
  );
  return (
    <Unterseite titel={TEXT.impressum}>
      <Inhalt>
        <Karte stil={{ paddingTop: 0 }}>
          {zeile(TEXT.anbieter, ANBIETER.name)}
          {zeile(TEXT.anschrift, ANBIETER.anschrift)}
          {zeile(TEXT.vertreten_durch, ANBIETER.vertretung)}
          {zeile(TEXT.b_email, ANBIETER.email)}
          {ANBIETER.telefon ? zeile(TEXT.b_telefon, ANBIETER.telefon) : null}
          {ANBIETER.register ? zeile(TEXT.register, ANBIETER.register) : null}
          {ANBIETER.ustIdNr ? zeile(TEXT.b_ust_idnr, ANBIETER.ustIdNr) : null}
        </Karte>
      </Inhalt>
    </Unterseite>
  );
}

/** Datenschutzhinweis der App – beschreibt, was die App tut; Freigabe offen (T-77). */
export function DatenschutzSeite() {
  return (
    <Unterseite titel={TEXT.datenschutz}>
      <Inhalt>
        {/* Verantwortlicher mit Kontakt zuerst (Art. 13 Abs. 1 lit. a DSGVO) – aus ANBIETER, nie erfunden */}
        <View style={{ marginBottom: 18 }}>
          <T fett accessibilityRole="header">{TEXT.verantwortlich_titel}</T>
          {ANBIETER.name ? <T v="klein" stil={{ marginTop: 4 }}>{TEXT.verantwortlich_ist(ANBIETER.name, ANBIETER.anschrift, ANBIETER.email)}</T> : <Hinweis text={TEXT.anbieter_folgt} />}
        </View>
        {datenschutzAbschnitte(syncAngeboten).map((a) => (
          <View key={a.titel} style={{ marginBottom: 18 }}>
            <T fett accessibilityRole="header">{a.titel}</T>
            <T v="klein" stil={{ marginTop: 4 }}>{a.text}</T>
          </View>
        ))}
        {!DATENSCHUTZ.freigegeben ? <T v="caption" leise>{TEXT.datenschutz_entwurf}</T> : null}
      </Inhalt>
    </Unterseite>
  );
}

/** Gruppe unter „Mein Betrieb“: Weiterempfehlen, Hilfe, Rechtliches. */
export function UeberGruppe() {
  const nav = useNav();
  const hilfe = hilfeZiel(LINKS.support, ANBIETER.email);
  const teilen = () => void Share.share({ message: TEXT.empfehlen_text(LINKS.appStore || LINKS.website) }).catch(() => undefined);
  const zeilen = [
    { titel: TEXT.empfehlen, symbol: "square.and.arrow.up", onPress: teilen },
    ...(hilfe ? [{ titel: TEXT.hilfe_kontakt, symbol: "questionmark.circle", onPress: () => void Linking.openURL(hilfe) }] : []),
    { titel: TEXT.datenschutz, symbol: "hand.raised", onPress: () => nav.oeffnen("datenschutz", () => <DatenschutzSeite />) },
    { titel: TEXT.impressum, symbol: "info.circle", onPress: () => nav.oeffnen("impressum", () => <ImpressumSeite />) },
    { titel: TEXT.nutzungsbedingungen, symbol: "doc.plaintext", onPress: () => void Linking.openURL(LINKS.nutzung) },
  ];
  return (
    <View>
      <Karte>
        {zeilen.map((z, i) => (
          <Zeile key={z.titel} symbol={z.symbol} titel={z.titel} onPress={z.onPress} letzte={i === zeilen.length - 1} />
        ))}
      </Karte>
      {/* Phase 1 (RDG): keine Rechts- oder Steuerberatung, mit Rechtsstand */}
      <RechtsHinweis art="recht" oben={10} />
    </View>
  );
}
