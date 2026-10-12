import { useState } from "react";
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { Feld, Fuss, Hinweis, Karte, Knopf, T } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { RAND } from "../ui/thema";
import { PASSWORT_MINDESTLAENGE, SicherungsFehler, sicherungErstellen, sicherungLesen, sicherungsName } from "../unterlagen/sicherung";
import { dateiTeilen, dateiWaehlen, zufall } from "../unterlagen/sicherungDatei";
import { heute, type Stand } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";

/** Kurz warten, damit der Ladezustand gezeichnet ist, bevor die Schlüsselableitung den Thread belegt. */
const gleich = () => new Promise((r) => setTimeout(r, 30));

/** Daten verschlüsselt sichern (E-125): Passwort zweimal, dann Datei ins Teilen-Menü. Nichts geht im Klartext raus. */
export function SicherungSeite() {
  const z = useAmtlos();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "fehler"; text: string } | null>(null);
  const kurz = pw.length > 0 && pw.length < PASSWORT_MINDESTLAENGE;
  const ungleich = pw2.length > 0 && pw !== pw2;
  const bereit = pw.length >= PASSWORT_MINDESTLAENGE && pw === pw2;
  const los = async () => {
    setMeldung(null);
    setLaedt(true);
    try {
      await gleich();
      const text = sicherungErstellen(z.stand, pw, zufall);
      await dateiTeilen(sicherungsName(heute()), text);
      setMeldung({ art: "erfolg", text: TEXT.sicherung_fertig });
    } catch {
      setMeldung({ art: "fehler", text: TEXT.sicherung_fehler });
    } finally {
      setLaedt(false);
    }
  };
  return (
    <Unterseite titel={TEXT.sicherung_titel}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 12, paddingBottom: 32 }}>
        <T>{TEXT.sicherung_text}</T>
        <Feld label={TEXT.passwort} wert={pw} aendern={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={kurz ? TEXT.passwort_kurz(PASSWORT_MINDESTLAENGE) : null} />
        <Feld label={TEXT.passwort_wiederholen} wert={pw2} aendern={setPw2} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={ungleich ? TEXT.passwort_ungleich : null} />
        <View style={{ marginTop: 18 }}>
          <Hinweis text={TEXT.sicherung_warnung} symbol="lock" />
          {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
        </View>
      </Inhalt>
      <Fuss>
        <Knopf text={laedt ? TEXT.sicherung_laeuft : TEXT.sicherung_erstellen} symbol="lock" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Sicherung wiederherstellen: Datei wählen, Passwort, Inhalt ansehen, dann alles ersetzen. */
export function WiederherstellenSeite({ fertig }: { fertig?: () => void }) {
  const z = useAmtlos();
  const nav = useNav();
  const [datei, setDatei] = useState<{ name: string; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [gelesen, setGelesen] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const waehlen = async () => {
    setFehler(null);
    setGelesen(null);
    const d = await dateiWaehlen().catch(() => null);
    if (d) setDatei(d);
  };
  const oeffnen = async () => {
    if (!datei) return;
    setFehler(null);
    setLaedt(true);
    try {
      await gleich();
      setGelesen(sicherungLesen(datei.text, pw));
    } catch (e) {
      setFehler(e instanceof SicherungsFehler && e.art === "format" ? TEXT.falsches_format : TEXT.falsches_passwort);
    } finally {
      setLaedt(false);
    }
  };
  return (
    <Unterseite titel={TEXT.wiederherstellen_titel}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 12, paddingBottom: 32 }}>
        <T>{TEXT.wiederherstellen_text}</T>
        {datei ? (
          <Karte stil={{ marginTop: 16, paddingVertical: 12 }}>
            <T fett numberOfLines={1}>{datei.name}</T>
          </Karte>
        ) : null}
        <Knopf ton symbol="folder" text={datei ? TEXT.andere_datei : TEXT.datei_waehlen} onPress={() => void waehlen()} stil={{ marginTop: 12 }} />
        {datei && !gelesen ? <Feld label={TEXT.passwort} wert={pw} aendern={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" onSubmitEditing={() => void oeffnen()} /> : null}
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {gelesen ? (
          <View style={{ marginTop: 16, gap: 6 }}>
            <Hinweis art="erfolg" text={TEXT.inhalt_sicherung(gelesen.betrieb.name, gelesen.unterlagen.length, gelesen.mitarbeiter.length, gelesen.kunden.length)} />
            <Hinweis text={TEXT.ersetzt_alles} />
          </View>
        ) : null}
      </Inhalt>
      <Fuss>
        {gelesen ? (
          <Knopf
            gefahr
            text={TEXT.jetzt_wiederherstellen}
            onPress={() => {
              z.ersetzen(gelesen);
              fertig?.();
              nav.zurueck();
            }}
            stil={{ flex: 1 }}
          />
        ) : (
          <Knopf text={laedt ? TEXT.wird_geoeffnet : TEXT.oeffnen} laedt={laedt} deaktiviert={!datei || !pw} onPress={() => void oeffnen()} stil={{ flex: 1 }} />
        )}
      </Fuss>
    </Unterseite>
  );
}
