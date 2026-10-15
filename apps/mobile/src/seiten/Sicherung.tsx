import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Feld, Fuss, Hinweis, Karte, Knopf, Schalter, Symbol, T, TextKnopf } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { useMeldung } from "../ui/meldung";
import { RADIUS, useFarben } from "../ui/thema";
import { RAND } from "../ui/thema";
import { PASSWORT_MINDESTLAENGE, SicherungsFehler, base64, schluesselAusPasswort, schluesselKennung, sicherungErstellen, sicherungLesenMitDateien, sicherungMitSchluessel, sicherungsDatei, sicherungsDateiLesen, sicherungsKdf, sicherungsName, type Dateien, type SicherungsSchluessel } from "../unterlagen/sicherung";
import { cloudBeiseitelegen, cloudDateiLesen, cloudDateiSchreiben, cloudDateien, cloudLesen, cloudSchreiben, cloudVerfuegbar } from "../unterlagen/cloud";
import { autoSchluesselHolen, autoSchluesselLoeschen, autoSchluesselSpeichern } from "../unterlagen/schluesselbund";
import { dateiTeilen, dateiWaehlen, zufall } from "../unterlagen/sicherungDatei";
import { heute, sicherungFaellig, ungesichert, zusammenfuehren, type Stand } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";
import { useProSperre } from "./Pro";

/** Kurz warten, damit der Ladezustand gezeichnet ist, bevor die Schlüsselableitung den Thread belegt. */
const gleich = () => new Promise((r) => setTimeout(r, 30));

/** Daten verschlüsselt sichern (E-125): Passwort zweimal, dann Datei ins Teilen-Menü. Nichts geht im Klartext raus. */
export function SicherungSeite() {
  const z = useAmtlos();
  const nav = useNav();
  const [erledigt, setErledigt] = useState(false);
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
      const gesichert = z.stand;
      const text = sicherungErstellen(gesichert, pw, zufall, new Date(), undefined, await z.dateienFuerSicherung(gesichert));
      // abgebrochen: keine Sicherung – die Erinnerung bleibt und „Alle Daten löschen“ bleibt gesperrt
      if (!(await dateiTeilen(sicherungsName(heute()), text))) return;
      z.gesichert(gesichert);
      setMeldung({ art: "erfolg", text: TEXT.sicherung_fertig });
      // fertig: Passwort aus dem Feld, Knopf wird zu „Fertig“ – keine doppelte Sicherung aus Versehen
      setPw("");
      setPw2("");
      setErledigt(true);
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
          <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
          {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
        </View>
      </Inhalt>
      <Fuss>
        {erledigt ? (
          <Knopf text={TEXT.fertig} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
        ) : (
          <Knopf text={laedt ? TEXT.sicherung_laeuft : TEXT.sicherung_erstellen} symbol="lock" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
        )}
      </Fuss>
    </Unterseite>
  );
}

/** Sicherung wiederherstellen: Datei wählen, Passwort, Inhalt ansehen, dann zusammenführen – Neueres bleibt (E-129). */
export function WiederherstellenSeite({ fertig }: { fertig?: () => void }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const [datei, setDatei] = useState<{ name: string; text: string } | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [gelesen, setGelesen] = useState<Stand | null>(null);
  const [dateien, setDateien] = useState<Dateien>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const cloud = useCloud();
  const waehlen = async () => {
    setFehler(null);
    setHinweis(null);
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
      const r = sicherungLesenMitDateien(datei.text, pw);
      // Sicherungen der automatischen iCloud-Sicherung (auch über „Dateien“ gewählt): Belegfotos liegen einzeln daneben
      setDateien(await belegeAusCloud(datei.text, r.stand, r.schluessel, r.dateien));
      setGelesen(r.stand);
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
        {cloud ? (
          <TextKnopf
            symbol="icloud"
            text={TEXT.aus_icloud}
            onPress={() =>
              void cloudLesen().then((text) => {
                setGelesen(null);
                if (text) setDatei({ name: TEXT.icloud_sicherung_name, text });
                else setHinweis(TEXT.icloud_leer);
              })
            }
            stil={{ marginLeft: 4, marginTop: 4 }}
          />
        ) : null}
        {datei && !gelesen ? <Feld label={TEXT.passwort} wert={pw} aendern={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" onSubmitEditing={() => void oeffnen()} /> : null}
        {hinweis ? <Hinweis text={hinweis} symbol="icloud" /> : null}
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {gelesen ? <Vorschau aktuell={z.stand} gelesen={gelesen} /> : null}
      </Inhalt>
      <Fuss>
        {gelesen ? (
          <Knopf
            text={TEXT.jetzt_wiederherstellen}
            onPress={() =>
              void z.zusammenfuehren(gelesen).then(async (r) => {
                await z.dateienEinspielen(dateien);
                melden(TEXT.wiederhergestellt_text(r.neu, r.aktualisiert));
                fertig?.();
                nav.zurueck();
              })
            }
            stil={{ flex: 1 }}
          />
        ) : (
          <Knopf text={laedt ? TEXT.wird_geoeffnet : TEXT.oeffnen} laedt={laedt} deaktiviert={!datei || !pw} onPress={() => void oeffnen()} stil={{ flex: 1 }} />
        )}
      </Fuss>
    </Unterseite>
  );
}

function Vorschau({ aktuell, gelesen }: { aktuell: Stand; gelesen: Stand }) {
  const z = zusammenfuehren(aktuell, gelesen);
  return (
    <View style={{ marginTop: 16, gap: 6 }}>
      <Hinweis art="erfolg" text={TEXT.inhalt_sicherung(gelesen.betrieb.name, gelesen.unterlagen.length, gelesen.mitarbeiter.length, gelesen.kunden.length, gelesen.belege.length)} />
      <Hinweis text={TEXT.zusammenfuehren_text(z.neu, z.aktualisiert, z.behalten)} />
      {z.nummernKonflikte.length ? <Hinweis art="fehler" text={TEXT.nummern_konflikt(z.nummernKonflikte)} /> : null}
    </View>
  );
}

/** Hinweis „Zeit für eine Sicherung“ (E-129): ungesicherte Änderungen, letzte Sicherung älter als eine Woche. */
export function SicherungsKarte() {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const faellig = sicherungFaellig(z.stand, new Date());
  if (!faellig) return null;
  return (
    // kompakt: eine Zeile mit Symbol, Satz und Pfeil – der Hinweis soll auffallen, nicht die Seite beherrschen
    <Pressable accessibilityRole="button" accessibilityLabel={`${TEXT.sicherung_faellig_titel}. ${TEXT.sicherung_faellig(faellig.tage)}`} onPress={() => nav.oeffnen("sicherung", () => <SicherungSeite />, true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.baldHauch, marginBottom: 18, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: f.papier, alignItems: "center", justifyContent: "center" }}>
        <Symbol name="exclamationmark.shield" groesse={20} farbe={f.bald} gewicht="semibold" />
      </View>
      <View style={{ flex: 1 }}>
        <T fett>{TEXT.sicherung_faellig_titel}</T>
        <T v="caption" leise numberOfLines={2}>{TEXT.sicherung_faellig(faellig.tage)}</T>
      </View>
      <Symbol name="chevron.right" groesse={14} farbe={f.bald} gewicht="semibold" />
    </Pressable>
  );
}

/** Belegdateien, die in iCloud noch fehlen, einzeln hochladen (je Datei einmal). */
async function belegeHochladen(z: ReturnType<typeof useAmtlos>, k: SicherungsSchluessel, stand: Stand): Promise<void> {
  const kennung = schluesselKennung(k.salz);
  const da = await cloudDateien(kennung);
  for (const b of stand.belege) {
    if (!b.datei || da.has(b.datei)) continue;
    const bytes = await z.dateiLesen(b.datei);
    if (bytes) await cloudDateiSchreiben(kennung, b.datei, sicherungsDatei(bytes, k.schluessel, zufall));
  }
}

/** Belegdateien einer iCloud-Sicherung holen, die nicht in der Sicherungsdatei selbst stecken. */
async function belegeAusCloud(text: string, stand: Stand, schluessel: Uint8Array, vorhanden: Dateien): Promise<Dateien> {
  const kdf = sicherungsKdf(text);
  if (!kdf) return vorhanden;
  const kennung = schluesselKennung(kdf.salz);
  const d: Dateien = { ...vorhanden };
  for (const b of stand.belege) {
    if (!b.datei || d[b.datei]) continue;
    const roh = await cloudDateiLesen(kennung, b.datei);
    const bytes = roh ? sicherungsDateiLesen(roh, schluessel) : null;
    if (bytes) d[b.datei] = base64(bytes);
  }
  return d;
}

/** iCloud verfügbar? (nur im eigenen App-Build mit iCloud-Anmeldung) */
export function useCloud(): boolean {
  const [da, setDa] = useState(false);
  useEffect(() => {
    void cloudVerfuegbar().then(setDa);
  }, []);
  return da;
}

/** Schalter unter „Deine Daten“: automatisch verschlüsselt in iCloud sichern (E-129). In Expo Go unsichtbar. */
export function CloudZeile() {
  const z = useAmtlos();
  const nav = useNav();
  const cloud = useCloud();
  const sperre = useProSperre();
  if (!cloud) return null;
  return (
    <Schalter
      label={TEXT.mitPro(TEXT.icloud_auto, z.pro)}
      hilfe={TEXT.icloud_auto_hilfe}
      wert={z.stand.cloudSicherung}
      aendern={(an) => {
        // einschalten gehört zu Pro; eine laufende Sicherung läuft weiter, auch wenn Pro endet (Daten gehen vor)
        if (an) {
          if (sperre("icloud")) nav.oeffnen("cloud", () => <CloudSicherungSeite />, true);
        }
        else {
          z.cloudSicherungSetzen(false);
          void autoSchluesselLoeschen().catch(() => undefined);
        }
      }}
    />
  );
}

/** Automatische iCloud-Sicherung einrichten: einmal ein Passwort, der abgeleitete Schlüssel bleibt im Schlüsselbund. */
function CloudSicherungSeite() {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState(false);
  const bereit = pw.length >= PASSWORT_MINDESTLAENGE && pw === pw2;
  const los = async () => {
    setFehler(false);
    setLaedt(true);
    try {
      await gleich();
      // Liegt schon eine Sicherung in iCloud (z. B. vom alten iPhone), nie einfach überschreiben:
      // öffnet das Passwort sie, wird sie zuerst übernommen; sonst wird sie beiseitegelegt.
      const vorhanden = await cloudLesen();
      let k: SicherungsSchluessel | null = null;
      if (vorhanden) {
        try {
          const r = sicherungLesenMitDateien(vorhanden, pw);
          const kdf = sicherungsKdf(vorhanden)!;
          k = { schluessel: r.schluessel, salz: kdf.salz, iterationen: kdf.iterationen };
          await z.zusammenfuehren(r.stand);
          await z.dateienEinspielen(await belegeAusCloud(vorhanden, r.stand, r.schluessel, r.dateien));
          melden(TEXT.icloud_uebernommen);
        } catch {
          await cloudBeiseitelegen(vorhanden);
        }
      }
      k ??= schluesselAusPasswort(pw, zufall);
      await autoSchluesselSpeichern(k);
      const stand = z.aktuellerStand();
      await belegeHochladen(z, k, stand);
      await cloudSchreiben(sicherungMitSchluessel(stand, k, zufall, new Date()));
      z.cloudSicherungSetzen(true);
      z.gesichert(stand);
      nav.zurueck();
    } catch {
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  };
  return (
    <Unterseite titel={TEXT.icloud_auto}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 12, paddingBottom: 32 }}>
        <T>{TEXT.icloud_einrichten_text}</T>
        <Feld label={TEXT.passwort} wert={pw} aendern={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={pw.length > 0 && pw.length < PASSWORT_MINDESTLAENGE ? TEXT.passwort_kurz(PASSWORT_MINDESTLAENGE) : null} />
        <Feld label={TEXT.passwort_wiederholen} wert={pw2} aendern={setPw2} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={pw2.length > 0 && pw !== pw2 ? TEXT.passwort_ungleich : null} />
        <View style={{ marginTop: 18 }}>
          <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
          {fehler ? <Hinweis art="fehler" text={TEXT.icloud_fehler} /> : null}
        </View>
      </Inhalt>
      <Fuss>
        <Knopf text={laedt ? TEXT.sicherung_laeuft : TEXT.icloud_einschalten} symbol="icloud" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Sichert bei eingeschalteter iCloud-Sicherung kurz nach jeder Änderung (rendert nichts). */
export function AutoSicherung() {
  const z = useAmtlos();
  const offen = z.bereit && z.stand.cloudSicherung && ungesichert(z.stand);
  useEffect(() => {
    if (!offen) return;
    const zeit = setTimeout(() => {
      void (async () => {
        const k = await autoSchluesselHolen();
        if (!k || !(await cloudVerfuegbar())) return;
        const gesichert = z.aktuellerStand();
        // erst die Belegdateien (einzeln, nur fehlende), dann der Stand ohne Fotos – so verweist er nie auf Fehlendes
        await belegeHochladen(z, k, gesichert);
        await cloudSchreiben(sicherungMitSchluessel(gesichert, k, zufall, new Date()));
        z.gesichert(gesichert);
      })().catch(() => undefined);
    }, 20_000);
    return () => clearTimeout(zeit);
  }, [offen, z.stand.geaendert]);
  return null;
}
