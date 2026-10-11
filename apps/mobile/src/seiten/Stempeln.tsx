import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import { dauerSeit, uhrzeit } from "../kern/zeit";
import { Absatz, Hinweis, Karte, Knopf, Titel } from "../ui/bausteine";
import { GROESSE, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Seite, useLaden } from "./gemeinsam";

/** Zeiterfassung am Handy (6.6): Kommen und Gehen, auch ohne Netz (E-108). */
export function Stempeln() {
  const { t, sprache, klient, unternehmenId, stempeln, wartend, offeneStempel, fehlgeschlagen, online, fehlgeschlageneVerwerfen } = useAmtlos();
  const f = useFarben();
  const monat = new Date().toISOString().slice(0, 7);
  const { daten, fehler, laedt, neu } = useLaden(async () => {
    const [personen, laufend] = await Promise.all([klient.beschaeftigte(), klient.laufend(monat)]);
    return { personen: personen.filter((p) => !p.austritt), laufend };
  }, [unternehmenId, wartend]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [pause, setPause] = useState("0");
  const [meldung, setMeldung] = useState<string | null>(null);
  const person = daten?.personen.find((p) => p.id === gewaehlt) ?? (daten?.personen.length === 1 ? daten.personen[0] : undefined);
  // Noch nicht übertragene Stempel zählen mit: der letzte entscheidet, ob gerade eine Zeit läuft
  const letzterOffen = person ? [...offeneStempel].reverse().find((s2) => s2.beschaeftigter_id === person.id && s2.unternehmen_id === unternehmenId) : undefined;
  const laeuft = letzterOffen
    ? letzterOffen.art === "kommen"
      ? { beschaeftigter_id: letzterOffen.beschaeftigter_id, beginn: letzterOffen.zeitpunkt }
      : undefined
    : person
      ? daten?.laufend.find((l) => l.beschaeftigter_id === person.id)
      : undefined;

  async function tippen(art: "kommen" | "gehen") {
    if (!person) return;
    await stempeln({ art, beschaeftigter_id: person.id, ...(art === "gehen" ? { pause_minuten: Math.max(0, Math.min(1440, Number(pause) || 0)) } : {}) });
    setMeldung(fuelle(t.mobil.gestempelt, { zeit: uhrzeit(new Date().toISOString(), sprache) }));
    setPause("0");
    await neu();
  }

  return (
    <Seite laedt={laedt} neu={neu}>
      <Titel>{t.zeit.titel}</Titel>
      {!online ? <Hinweis text={t.mobil.offline} /> : null}
      {wartend ? <Hinweis text={fuelle(t.mobil.wartend, { n: wartend })} /> : null}
      {fehlgeschlagen.length ? (
        <View>
          <Hinweis art="fehler" text={fuelle(t.mobil.fehlgeschlagen, { n: fehlgeschlagen.length })} />
          <Knopf leise text={t.mobil.fehlgeschlagen_verwerfen} onPress={fehlgeschlageneVerwerfen} />
        </View>
      ) : null}
      {fehler && !daten ? <Hinweis art="fehler" text={fehler} /> : null}
      {meldung ? <Hinweis art="erfolg" text={meldung} /> : null}
      {daten && !daten.personen.length ? <Absatz>{t.mobil.keine_personen}</Absatz> : null}
      {daten && daten.personen.length > 1 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t.mobil.person} style={{ marginVertical: 8 }}>
          <Text style={{ fontWeight: "700", color: f.tinte, fontSize: GROESSE.basis, marginBottom: 4 }}>{t.mobil.person}</Text>
          {daten.personen.map((p) => {
            const an = person?.id === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: an }}
                onPress={() => setGewaehlt(p.id)}
                style={{ minHeight: ZIEL, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: f.linie }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: f.amt, alignItems: "center", justifyContent: "center" }}>
                  {an ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: f.amt }} /> : null}
                </View>
                <Text style={{ color: f.tinte, fontSize: GROESSE.basis }}>
                  {p.vorname} {p.nachname}
                  {daten.laufend.some((l) => l.beschaeftigter_id === p.id) ? " ●" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {person ? (
        <Karte rand={laeuft ? "amt" : undefined}>
          <Text style={{ fontSize: GROESSE.gross, fontWeight: "700", color: f.tinte }}>
            {person.vorname} {person.nachname}
          </Text>
          {laeuft ? (
            <View>
              <Absatz>{fuelle(t.mobil.laeuft_seit, { zeit: `${uhrzeit(laeuft.beginn, sprache)} (${dauerSeit(laeuft.beginn)})` })}</Absatz>
              <Text nativeID="pause" style={{ fontWeight: "700", color: f.tinte, marginTop: 10 }}>{t.mobil.pause}</Text>
              <TextInput
                accessibilityLabel={t.mobil.pause}
                accessibilityLabelledBy="pause"
                keyboardType="number-pad"
                value={pause}
                onChangeText={setPause}
                style={{ minHeight: ZIEL, borderWidth: 2, borderColor: f.linie, borderRadius: 6, paddingHorizontal: 12, color: f.tinte, backgroundColor: f.blatt, fontSize: GROESSE.basis, marginVertical: 6, maxWidth: 140 }}
              />
              <Knopf text={t.mobil.gehen} onPress={() => void tippen("gehen")} />
            </View>
          ) : (
            <Knopf text={t.mobil.kommen} onPress={() => void tippen("kommen")} />
          )}
        </Karte>
      ) : null}
    </Seite>
  );
}
