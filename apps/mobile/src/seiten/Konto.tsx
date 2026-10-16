import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { devAnmeldung, syncAngeboten } from "../konto/konfig";
import { useKonto } from "../konto/konto";
import { SyncFehler } from "../konto/sync";
import { T as TEXT } from "../texte";
import { Feld, Fuss, Hinweis, Karte, Knopf, Symbol, T, TextKnopf, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { useFarben, weich } from "../ui/thema";
import { PASSWORT_MINDESTLAENGE } from "../unterlagen/sicherung";
import { useAmtlos } from "../zustand";
import { bestaetigen } from "../ui/bestaetigen";
import { BuehnenBlatt, Gruppe } from "./gemeinsam";
import { ProSeite, useProSperre } from "./Pro";

const zeitpunkt = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Zeile unter „Mein Betrieb“ – nur in Builds mit Server (E-134). */
export function KontoZeile() {
  const k = useKonto();
  const nav = useNav();
  if (!syncAngeboten) return null;
  return (
    <Karte stil={{ marginBottom: 10 }}>
      <Zeile
        symbol="arrow.triangle.2.circlepath"
        titel={TEXT.konto_zeile}
        text={k.status === "aktiv" && k.fehler ? TEXT.konto_fehler[k.fehler] : TEXT.konto_zeile_text[k.status]}
        onPress={() => nav.oeffnen("konto", () => <KontoSeite />, true)}
        letzte
      />
    </Karte>
  );
}

/** Zwei Passwortfelder mit Prüfung – liefert das Passwort, sobald beide passen. */
function NeuesPasswort({ label, setzen }: { label: string; setzen: (pw: string | null) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const pruefen = (a: string, b: string) => setzen(a.length >= PASSWORT_MINDESTLAENGE && a === b ? a : null);
  return (
    <View>
      <Feld label={label} wert={pw} aendern={(w) => { setPw(w); pruefen(w, pw2); }} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={pw.length > 0 && pw.length < PASSWORT_MINDESTLAENGE ? TEXT.passwort_kurz(PASSWORT_MINDESTLAENGE) : null} />
      <Feld label={TEXT.passwort_wiederholen} wert={pw2} aendern={(w) => { setPw2(w); pruefen(pw, w); }} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" fehler={pw2.length > 0 && pw !== pw2 ? TEXT.passwort_ungleich : null} />
    </View>
  );
}

/** Konto und Synchronisation (E-134): anmelden, einrichten bzw. verbinden, Stand, Passwort, beenden. */
export function KontoSeite() {
  const k = useKonto();
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const melden = useMeldung();
  const sperre = useProSperre();
  const [kennung, setKennung] = useState("");
  const [pw, setPw] = useState("");
  const [neuPw, setNeuPw] = useState<string | null>(null);
  const [falsch, setFalsch] = useState(false);
  const [aendern, setAendern] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  const laeuft = useRef(false);
  const machen = async (f2: () => Promise<void>) => {
    // nie zweimal gleichzeitig (z. B. „Konto löschen“ doppelt bestätigt)
    if (laeuft.current) return;
    laeuft.current = true;
    setBeschaeftigt(true);
    try {
      await f2();
    } catch {
      // Anzeige über k.fehler bzw. `falsch`
    } finally {
      laeuft.current = false;
      setBeschaeftigt(false);
    }
  };

  const fehlerText = k.fehler === "netz" && k.fehlerBeiHandlung ? TEXT.konto_fehler.netz_aktion : k.fehler ? TEXT.konto_fehler[k.fehler] : "";
  const fehler = k.fehler && !(k.fehler === "passwort" && falsch) ? <Hinweis art="fehler" text={fehlerText} /> : null;
  let inhalt: React.ReactNode;
  let fuss: React.ReactNode = null;

  if (k.status === "laedt" || k.status === "aus") {
    inhalt = <ActivityIndicator color={f.amt} style={{ marginTop: 32 }} />;
  } else if (k.status === "abgemeldet") {
    const ok = !devAnmeldung || /^[a-z0-9._-]{2,60}$/.test(kennung.trim().toLowerCase());
    inhalt = (
      <View>
        {devAnmeldung ? <Feld label={TEXT.konto_kennung} hilfe={TEXT.konto_kennung_hilfe} wert={kennung} aendern={setKennung} autoCapitalize="none" autoCorrect={false} /> : null}
        {fehler}
      </View>
    );
    fuss = <Knopf text={TEXT.konto_anmelden} symbol="person.crop.circle" laedt={beschaeftigt} deaktiviert={!ok} onPress={() => void machen(async () => void (await k.anmelden(kennung)))} stil={{ flex: 1 }} />;
  } else if (k.status === "ohneSchluessel") {
    if (k.serverEingerichtet === null) {
      inhalt = (
        <View style={{ marginTop: 16, gap: 10 }}>
          {k.fehler ? fehler : <><ActivityIndicator color={f.amt} /><T leise stil={{ textAlign: "center" }}>{TEXT.konto_server_pruefen}</T></>}
        </View>
      );
    } else if (k.serverEingerichtet) {
      inhalt = (
        <View>
          <T fett accessibilityRole="header" stil={{ marginTop: 8 }}>{TEXT.konto_verbinden_titel}</T>
          <T leise stil={{ marginTop: 4 }}>{TEXT.konto_verbinden_text}</T>
          <Feld label={TEXT.konto_passwort} wert={pw} aendern={(w) => { setPw(w); setFalsch(false); }} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" fehler={falsch ? TEXT.konto_fehler.passwort : null} />
          {fehler}
        </View>
      );
      fuss = (
        <Knopf
          text={TEXT.konto_verbinden}
          symbol="lock.open"
          laedt={beschaeftigt || k.laeuft}
          deaktiviert={pw.length < 1}
          onPress={() => {
            if (!sperre("sync")) return;
            void machen(async () => {
              try {
                await k.verbinden(pw);
                melden(TEXT.konto_eingerichtet);
              } catch (e) {
                if (e instanceof SyncFehler && e.art === "passwort") setFalsch(true);
              }
            });
          }}
          stil={{ flex: 1 }}
        />
      );
    } else {
      inhalt = (
        <View>
          <T fett accessibilityRole="header" stil={{ marginTop: 8 }}>{TEXT.konto_einrichten_titel}</T>
          <T leise stil={{ marginTop: 4 }}>{TEXT.konto_einrichten_text}</T>
          <NeuesPasswort label={TEXT.konto_passwort} setzen={setNeuPw} />
          <View style={{ marginTop: 14 }}>
            <Hinweis art="warnung" text={TEXT.konto_passwort_warnung} symbol="key" />
            {fehler}
          </View>
        </View>
      );
      fuss = (
        <Knopf
          text={TEXT.konto_einrichten}
          symbol="arrow.triangle.2.circlepath"
          laedt={beschaeftigt || k.laeuft}
          deaktiviert={!neuPw}
          onPress={() => {
            if (!neuPw || !sperre("sync")) return;
            void machen(async () => {
              await k.einrichten(neuPw);
              melden(TEXT.konto_eingerichtet);
            });
          }}
          stil={{ flex: 1 }}
        />
      );
    }
  } else {
    inhalt = (
      <View>
        <Karte stil={{ paddingVertical: 14, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {k.laeuft ? <ActivityIndicator color={f.amt} /> : <Symbol name={k.fehler ? "exclamationmark.triangle" : "checkmark.circle.fill"} groesse={22} farbe={k.fehler ? f.frist : f.amt} />}
            <T fett>{k.laeuft ? TEXT.konto_laeuft : TEXT.konto_an}</T>
          </View>
          <T v="klein" leise>{TEXT.konto_letzte(k.letzte ? zeitpunkt(k.letzte) : null)}</T>
        </Karte>
        {!z.pro ? (
          <View style={{ marginTop: 10 }}>
            <Hinweis text={TEXT.konto_pro_pause} symbol="pause.circle" />
            <TextKnopf symbol="checkmark.seal" text={TEXT.konto_pro_oeffnen} onPress={() => nav.oeffnen("pro", () => <ProSeite grund="sync" />, true)} />
          </View>
        ) : null}
        {fehler}
        {k.nummernKonflikte.length ? <Hinweis text={TEXT.konto_nummern(k.nummernKonflikte)} symbol="number" /> : null}

        <Gruppe>
          {aendern ? (
            <Karte stil={{ paddingBottom: 14 }}>
              <T v="klein" leise stil={{ marginTop: 12 }}>{TEXT.konto_passwort_aendern_text}</T>
              <NeuesPasswort label={TEXT.konto_passwort_neu} setzen={setNeuPw} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <Knopf
                  text={TEXT.konto_passwort_aendern}
                  laedt={beschaeftigt}
                  deaktiviert={!neuPw}
                  onPress={() =>
                    void machen(async () => {
                      if (!neuPw) return;
                      await k.passwortAendern(neuPw);
                      setAendern(false);
                      melden(TEXT.konto_passwort_geaendert);
                    })
                  }
                  stil={{ flex: 1 }}
                />
                <Knopf ton text={TEXT.abbrechen} onPress={() => setAendern(false)} stil={{ flex: 1 }} />
              </View>
            </Karte>
          ) : (
            <TextKnopf symbol="key" text={TEXT.konto_passwort_aendern} onPress={() => { weich(); setNeuPw(null); setAendern(true); }} />
          )}
        </Gruppe>

        <Gruppe fuss={TEXT.konto_beenden_text}>
          <TextKnopf
            gefahr
            symbol="xmark.icloud"
            text={TEXT.konto_beenden}
            onPress={() =>
              void bestaetigen({ titel: TEXT.konto_beenden_wirklich, text: TEXT.konto_beenden_text, ja: TEXT.konto_beenden_ja }).then((ok) => {
                if (!ok) return;
                void machen(async () => {
                  await k.beenden();
                  melden(TEXT.konto_beendet);
                });
              })
            }
          />
        </Gruppe>
      </View>
    );
    fuss = <Knopf ton={!z.pro} text={TEXT.konto_jetzt} symbol="arrow.triangle.2.circlepath" laedt={k.laeuft} deaktiviert={!z.pro} onPress={() => void k.jetzt().then((ok) => ok && melden(TEXT.konto_fertig))} stil={{ flex: 1 }} />;
  }

  const angemeldet = k.status === "ohneSchluessel" || k.status === "aktiv";
  return (
    <BuehnenBlatt
      titel={TEXT.konto_titel}
      unter={k.status !== "aktiv" ? TEXT.konto_intro : undefined}
      fuss={fuss ? <Fuss>{fuss}</Fuss> : null}
      buehne={
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Symbol name="lock.shield" groesse={20} farbe={f.minze} />
          <T v="klein" farbe={f.buehneLeise} stil={{ flex: 1 }}>{TEXT.konto_e2e}</T>
        </View>
      }
    >
        {inhalt}
        {angemeldet ? (
          <Gruppe titel={TEXT.konto_angemeldet_als(k.name)} fuss={`${TEXT.konto_abmelden_text} ${TEXT.konto_lokal_bleibt}`}>
            <TextKnopf symbol="rectangle.portrait.and.arrow.right" text={TEXT.konto_abmelden} onPress={() => void k.abmelden()} />
          </Gruppe>
        ) : null}
        {angemeldet ? (
          <Gruppe fuss={TEXT.konto_loeschen_text}>
            <TextKnopf
              gefahr
              symbol="trash"
              text={TEXT.konto_loeschen}
              onPress={() =>
                void bestaetigen({ titel: TEXT.konto_loeschen_wirklich, text: TEXT.konto_loeschen_text, ja: TEXT.konto_loeschen_ja }).then((ok) => {
                  if (!ok) return;
                  void machen(async () => {
                    await k.kontoLoeschen();
                    melden(TEXT.konto_geloescht);
                  });
                })
              }
            />
          </Gruppe>
        ) : null}
    </BuehnenBlatt>
  );
}
