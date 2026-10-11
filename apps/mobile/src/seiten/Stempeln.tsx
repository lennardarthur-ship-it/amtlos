import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import { dauerSeit, uhrzeit } from "../kern/zeit";
import { Hinweis, Knopf, Symbol, T } from "../ui/bausteine";
import { RADIUS, SCHRIFT, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Leer, Seite, useLaden } from "./gemeinsam";

/** Zeiterfassung am Handy (6.6): Person wählen, ein großer Knopf. Geht auch ohne Netz (E-108). */
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
  const [, tick] = useState(0);
  useEffect(() => {
    const takt = setInterval(() => tick((n) => n + 1), 30_000); // laufende Dauer aktualisieren
    return () => clearInterval(takt);
  }, []);
  const person = daten?.personen.find((p) => p.id === gewaehlt) ?? daten?.personen[0];
  const letzterOffen = person ? [...offeneStempel].reverse().find((s2) => s2.beschaeftigter_id === person.id && s2.unternehmen_id === unternehmenId) : undefined;
  const laeuft = letzterOffen ? (letzterOffen.art === "kommen" ? { beginn: letzterOffen.zeitpunkt } : undefined) : person ? daten?.laufend.find((l) => l.beschaeftigter_id === person.id) : undefined;

  async function tippen(art: "kommen" | "gehen") {
    if (!person) return;
    await stempeln({ art, beschaeftigter_id: person.id, ...(art === "gehen" ? { pause_minuten: Math.max(0, Math.min(1440, Number(pause) || 0)) } : {}) });
    setMeldung(fuelle(t.mobil.gestempelt, { zeit: uhrzeit(new Date().toISOString(), sprache) }));
    setPause("0");
    await neu();
  }

  return (
    <Seite titel={t.zeit.titel} laedt={laedt} neu={neu}>
      {!online ? <Hinweis text={t.mobil.offline} symbol="wifi.slash" /> : null}
      {wartend ? <Hinweis text={fuelle(t.mobil.wartend, { n: wartend })} symbol="arrow.triangle.2.circlepath" /> : null}
      {fehlgeschlagen.length ? (
        <View>
          <Hinweis art="fehler" text={fuelle(t.mobil.fehlgeschlagen, { n: fehlgeschlagen.length })} />
          <Knopf leise text={t.mobil.fehlgeschlagen_verwerfen} onPress={fehlgeschlageneVerwerfen} stil={{ alignSelf: "flex-start" }} />
        </View>
      ) : null}
      {fehler && !daten ? <Hinweis art="fehler" text={fehler} /> : null}
      {meldung ? <Hinweis art="erfolg" text={meldung} /> : null}
      {daten && !daten.personen.length ? <Leer text={t.mobil.keine_personen} /> : null}

      {daten && daten.personen.length > 1 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t.mobil.person} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {daten.personen.map((p) => {
            const an = person?.id === p.id;
            const aktiv = daten.laufend.some((l) => l.beschaeftigter_id === p.id);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: an }}
                onPress={() => setGewaehlt(p.id)}
                style={{ minHeight: ZIEL - 8, paddingHorizontal: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: an ? f.tinte : f.blatt, borderWidth: 1, borderColor: an ? f.tinte : f.linie }}
              >
                {aktiv ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.amt }} /> : null}
                <T v="klein" fett farbe={an ? f.papier : f.tinte}>{p.vorname} {p.nachname}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {person ? (
        <View style={{ backgroundColor: f.blatt, borderRadius: RADIUS.karte, borderWidth: 1.5, borderColor: laeuft ? f.amt : f.linie, padding: 20, alignItems: "center" }}>
          <T v="klein" leise>{person.vorname} {person.nachname}</T>
          {laeuft ? (
            <>
              <T v="grossTitel" stil={{ marginTop: 6, fontVariant: ["tabular-nums"] }}>{dauerSeit(laeuft.beginn)}</T>
              <T v="klein" leise>{fuelle(t.mobil.laeuft_seit, { zeit: uhrzeit(laeuft.beginn, sprache) })}</T>
              <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <T v="klein" nativeID="pause">{t.mobil.pause}</T>
                <TextInput
                  accessibilityLabel={t.mobil.pause}
                  accessibilityLabelledBy="pause"
                  keyboardType="number-pad"
                  value={pause}
                  onChangeText={setPause}
                  style={{ minHeight: 40, width: 72, textAlign: "center", borderWidth: 1, borderColor: f.linie, borderRadius: 8, color: f.tinte, backgroundColor: f.papier, fontFamily: SCHRIFT.regular, fontSize: 17 }}
                />
              </View>
              <Knopf text={t.mobil.gehen} symbol="stop.fill" onPress={() => void tippen("gehen")} stil={{ marginTop: 18, alignSelf: "stretch" }} />
            </>
          ) : (
            <>
              <View style={{ marginTop: 10, marginBottom: 6 }}><Symbol name="clock" groesse={40} farbe={f.tinteLeise} gewicht="light" /></View>
              <Knopf text={t.mobil.kommen} symbol="play.fill" onPress={() => void tippen("kommen")} stil={{ marginTop: 12, alignSelf: "stretch" }} />
            </>
          )}
        </View>
      ) : null}
    </Seite>
  );
}
