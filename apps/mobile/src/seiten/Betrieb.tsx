import { useState } from "react";
import { Share, View } from "react-native";
import type { Betrieb as BetriebDaten } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Feld, Karte, Knopf, T } from "../ui/bausteine";
import { useAmtlos } from "../zustand";
import { Gruppe, Seite } from "./gemeinsam";

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
        <Feld label={TEXT.b_verantwortlich} {...feld("verantwortlich")} textContentType="name" />
        <Feld label={TEXT.b_telefon} {...feld("telefon")} keyboardType="phone-pad" textContentType="telephoneNumber" />
        <Feld label={TEXT.b_email} {...feld("email")} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
      </Karte>
      <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{TEXT.gespeichert_auto}</T>
    </View>
  );
}

/** Tab „Mein Betrieb“: Angaben, Datensicherung, alles löschen. */
export function Betrieb() {
  const { stand, allesLoeschen } = useAmtlos();
  const [frage, setFrage] = useState(false);
  const [zaehler, setZaehler] = useState(0);
  return (
    <Seite titel={TEXT.betrieb_titel}>
      {/* nach „alles löschen“ neu einhängen, damit die Felder leer sind */}
      <BetriebFormular key={zaehler} />
      <Gruppe titel={TEXT.daten_titel} fuss={TEXT.daten_text}>
        <Knopf leise symbol="square.and.arrow.up" text={TEXT.sichern} onPress={() => void Share.share({ title: "Amtlos-Daten", message: JSON.stringify(stand, null, 2) }).catch(() => undefined)} />
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
              <Knopf leise text={TEXT.abbrechen} onPress={() => setFrage(false)} stil={{ flex: 1 }} />
            </View>
          </Karte>
        ) : (
          <Knopf leise gefahr symbol="trash" text={TEXT.alles_loeschen} onPress={() => setFrage(true)} />
        )}
      </Gruppe>
      <T v="caption" leise stil={{ marginTop: 24 }}>{TEXT.ueber}</T>
    </Seite>
  );
}
