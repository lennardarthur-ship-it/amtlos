import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, PasswortFeld, Schalter, Symbol, T, TextKnopf } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useMeldung } from "../ui/meldung";
import { RADIUS, useFarben } from "../ui/thema";
import { PASSWORT_EMPFOHLEN, SicherungsFehler, fehlendeDateien, passwortSchwaeche, base64, schluesselAusPasswort, schluesselKennung, sicherungErstellen, sicherungLesenMitDateien, sicherungMitSchluessel, sicherungsDatei, sicherungsDateiLesen, sicherungsKdf, sicherungsName, type Dateien, type SicherungsSchluessel } from "../unterlagen/sicherung";
import { cloudBeiseitelegen, cloudDateiLesen, cloudDateiSchreiben, cloudDateien, cloudLesen, cloudSchreiben, cloudVerfuegbar } from "../unterlagen/cloud";
import { autoSchluesselHolen, autoSchluesselLoeschen, autoSchluesselSpeichern } from "../unterlagen/schluesselbund";
import { dateiTeilen, dateiTeilenBytes, dateiWaehlen, zufall } from "../unterlagen/sicherungDatei";
import { dokumentHtml, pdfDateiname, vorlageFuer } from "@amtlos/fachlogik";
import { offenesArchiv } from "../unterlagen/archiv";
import { pdfBytes } from "../unterlagen/pdf";
import { gestellteRechnungen } from "../unterlagen/steuerpaket";
import { betriebFuerDokument } from "../pro/regeln";
import { letzteVollsicherung, nachweisText, vollsicherungFaellig } from "../unterlagen/sicherungNachweis";
import { absenderFuer, dateienImStand, heute, sicherungFaellig, ungesichert, zusammenfuehren, type Stand } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { BuehnenBlatt } from "./gemeinsam";
import { useProSperre } from "./Pro";

/** Kurz warten, damit der Ladezustand gezeichnet ist, bevor die Schlüsselableitung den Thread belegt. */
const gleich = () => new Promise((r) => setTimeout(r, 30));

/** Ab so vielen Belegdateien bzw. so vielen MB warnt die Sicherung als Datei (R9 Performance) */
export const SICHERUNG_DATEIEN_WARNUNG = 50;
export const SICHERUNG_MB_WARNUNG = 150;

/** Neues Passwort brauchbar: stark genug (H-1) und zweimal gleich eingegeben. */
export const passwortBereit = (pw: string, pw2: string) => passwortSchwaeche(pw) === null && pw === pw2;

/**
 * Neues Passwort zweimal: Die Anforderung (mindestens 12 Zeichen oder drei Wörter, nichts Naheliegendes) steht beim
 * Tippen ruhig als Hilfe darunter und wird erst nach dem Verlassen des Felds zum Fehler; „stimmen nicht überein“
 * ebenso erst nach dem zweiten Feld.
 */
export function PasswortPaar({ label, pw, pw2, setPw, setPw2 }: { label: string; pw: string; pw2: string; setPw: (w: string) => void; setPw2: (w: string) => void }) {
  const [verlassen1, setVerlassen1] = useState(false);
  const [verlassen2, setVerlassen2] = useState(false);
  const schwaeche = passwortSchwaeche(pw);
  const text = schwaeche === "einfach" ? TEXT.passwort_einfach : TEXT.passwort_anforderung(PASSWORT_EMPFOHLEN);
  return (
    <View>
      <PasswortFeld neu label={label} wert={pw} aendern={setPw} onBlur={() => setVerlassen1(true)} hinweis={schwaeche ? text : null} fehler={(verlassen1 || schwaeche === "einfach") && pw.length > 0 && schwaeche ? text : null} />
      <PasswortFeld neu label={TEXT.passwort_wiederholen} wert={pw2} aendern={setPw2} onBlur={() => setVerlassen2(true)} fehler={(verlassen2 || pw2.length >= pw.length) && pw2.length > 0 && pw !== pw2 ? TEXT.passwort_ungleich : null} />
    </View>
  );
}

/** Daten verschlüsselt sichern (E-125): Passwort zweimal, dann Datei ins Teilen-Menü. Nichts geht im Klartext raus. */
export function SicherungSeite() {
  const z = useAmtlos();
  const nav = useNav();
  const [erledigt, setErledigt] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "fehler"; text: string } | null>(null);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  // große Sicherung (R9 Performance): Die Sicherungsdatei entsteht ganz im Arbeitsspeicher – ab etwa 50 Belegdateien
  // oder 150 MB droht auf dem iPhone der Abbruch. Dann vorher warnen und die iCloud-Sicherung empfehlen.
  const umfang = useMemo(() => {
    const namen = new Set(dateienImStand(z.stand));
    let bytes = 0;
    for (const n of namen) bytes += z.dateiGroesse(n);
    // Base64 in der Sicherungsdatei: etwa ein Drittel mehr als die Datei selbst
    return { dateien: namen.size, mb: Math.round((bytes * 1.37) / 1e6) };
  }, [z.stand.belege, z.stand.belegArchiv, z.stand.kasse, z.stand.mitarbeiter]);
  const gross = umfang.dateien > SICHERUNG_DATEIEN_WARNUNG || umfang.mb > SICHERUNG_MB_WARNUNG;
  const bereit = passwortBereit(pw, pw2);
  const letzte = letzteVollsicherung(z.stand.sicherungsNachweis);
  const los = async () => {
    setMeldung(null);
    setLaedt(true);
    try {
      await gleich();
      const gesichert = z.stand;
      const { dateien } = await z.dateienFuerSicherung(gesichert, (n, von) => setFortschritt(TEXT.sicherung_fortschritt(n, von)));
      setFortschritt(null);
      const fehlend = fehlendeDateien(gesichert, dateien);
      const text = sicherungErstellen(gesichert, pw, zufall, new Date(), undefined, dateien);
      // abgebrochen: keine Sicherung – die Erinnerung bleibt und „Alle Daten löschen“ bleibt gesperrt
      if (!(await dateiTeilen(sicherungsName(heute()), text))) return;
      // fehlen Belegdateien, ist die Sicherung nicht vollständig (H3): teilen ja, aber nicht als gesichert zählen
      if (fehlend.length) {
        setMeldung({ art: "fehler", text: TEXT.sicherung_dateien_fehlen(fehlend.length) });
        setPw("");
        setPw2("");
        setErledigt(true);
        return;
      }
      z.gesichert(gesichert);
      // StB GoBD (D-11): Nachweis der Vollsicherung außerhalb des Geräts (nur vollständig)
      z.sicherungNachweisen("datei");
      setMeldung({ art: "erfolg", text: TEXT.sicherung_fertig });
      // fertig: Passwort aus dem Feld, Knopf wird zu „Fertig“ – keine doppelte Sicherung aus Versehen
      setPw("");
      setPw2("");
      setErledigt(true);
    } catch {
      setMeldung({ art: "fehler", text: TEXT.sicherung_fehler });
    } finally {
      setLaedt(false);
      setFortschritt(null);
    }
  };
  return (
    <BuehnenBlatt
      titel={TEXT.sicherung_titel}
      unter={TEXT.sicherung_text}
      fuss={
          <Fuss>
            {erledigt ? (
              <Knopf text={TEXT.fertig} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
            ) : (
              <Knopf text={laedt ? TEXT.sicherung_laeuft : gross ? TEXT.sicherung_trotzdem : TEXT.sicherung_erstellen} symbol="lock" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
            )}
          </Fuss>
      }
    >
      {erledigt ? null : <PasswortPaar label={TEXT.passwort} pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />}
      <View style={{ marginTop: 18 }}>
        <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
        {/* StB GoBD (D-11): Nachweis der letzten Vollsicherung außerhalb des Geräts */}
        <Hinweis text={`${TEXT.stb_letzte_vollsicherung(letzte ? nachweisText(letzte) : null)} ${z.stand.cloudSicherung ? TEXT.stb_vollsicherung_icloud : TEXT.stb_vollsicherung_hinweis}`} symbol="clock" />
        {gross && !erledigt ? <Hinweis art="warnung" text={TEXT.sicherung_gross(umfang.dateien, umfang.mb)} symbol="icloud" /> : null}
        {fortschritt ? <Hinweis text={fortschritt} /> : null}
        {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
      </View>
      <OffenesArchiv />
    </BuehnenBlatt>
  );
}

/**
 * R12 GoBD: offenes Archiv (CSV/JSON, PDF, XML, Originaldateien) – lesbar ohne Amtlos und ohne Passwort über die
 * Aufbewahrungsfrist (§ 147 Abs. 2 AO). Ergänzt die verschlüsselte Sicherung, ersetzt sie nicht.
 */
export function OffenesArchiv() {
  const z = useAmtlos();
  const melden = useMeldung();
  const [laedt, setLaedt] = useState(false);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const los = async () => {
    setFehler(false);
    setLaedt(true);
    try {
      await gleich();
      const s = z.stand;
      const dateien: Record<string, Uint8Array> = {};
      let fehlend = 0;
      for (const n of dateienImStand(s)) {
        const b = await z.dateiLesen(n);
        if (b) dateien[n] = b;
        else fehlend++;
      }
      const rechnungsPdfs: Record<string, Uint8Array> = {};
      const v = vorlageFuer("rechnung");
      const rechnungen = gestellteRechnungen(s);
      if (v)
        for (const [i, u] of rechnungen.entries()) {
          setFortschritt(TEXT.r12g_archiv_fortschritt(i + 1, rechnungen.length));
          const bytes = await pdfBytes(dokumentHtml(v, u.daten, betriebFuerDokument(absenderFuer(s, u), z.pro)), pdfDateiname(v, u.daten, heute()), v.querformat).catch(() => null);
          if (bytes) rechnungsPdfs[u.id] = bytes;
        }
      setFortschritt(null);
      const a = offenesArchiv(s, dateien, new Date().toISOString(), { rechnungsPdfs });
      if (await dateiTeilenBytes(a.dateiname, a.zip, "application/zip")) {
        // StB GoBD (D-11): lesbare Vollsicherung außerhalb des Geräts – nur mit allen Belegdateien als Nachweis
        if (!fehlend) z.sicherungNachweisen("archiv");
        melden(TEXT.r12g_archiv_fertig);
      }
    } catch {
      setFehler(true);
    } finally {
      setLaedt(false);
      setFortschritt(null);
    }
  };
  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <T fett accessibilityRole="header">{TEXT.r12g_archiv_titel}</T>
      <T v="klein" leise>{TEXT.r12g_archiv_text}</T>
      <Knopf ton symbol="folder" text={TEXT.r12g_archiv_knopf} laedt={laedt} onPress={() => void los()} />
      {fortschritt ? <Hinweis text={fortschritt} /> : null}
      {fehler ? <Hinweis art="fehler" text={TEXT.r12g_archiv_fehler} /> : null}
    </View>
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
    <BuehnenBlatt
      titel={TEXT.wiederherstellen_titel}
      unter={TEXT.wiederherstellen_text}
      fuss={
          <Fuss>
            {gelesen ? (
              <Knopf
                text={TEXT.jetzt_wiederherstellen}
                onPress={() =>
                  void z
                    .zusammenfuehren(gelesen)
                    .then(async (r) => {
                      const fehler = await z.dateienEinspielen(dateien);
                      // Belegdateien, die sich nicht ablegen ließen, nicht als Erfolg verbuchen (G4)
                      melden(fehler ? `${TEXT.wiederhergestellt_text(r.neu, r.aktualisiert)} ${TEXT.wiederherstellen_dateien_fehler(fehler)}` : TEXT.wiederhergestellt_text(r.neu, r.aktualisiert), fehler ? "info" : undefined);
                      fertig?.();
                      nav.zurueck();
                    })
                    .catch(() => setFehler(TEXT.wiederherstellen_fehler))
                }
                stil={{ flex: 1 }}
              />
            ) : (
              <Knopf text={laedt ? TEXT.wird_geoeffnet : TEXT.oeffnen} laedt={laedt} deaktiviert={!datei || !pw} onPress={() => void oeffnen()} stil={{ flex: 1 }} />
            )}
          </Fuss>
      }
    >
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
          stil={{ marginTop: 4 }}
        />
      ) : null}
      {datei && !gelesen ? <PasswortFeld label={TEXT.passwort} wert={pw} aendern={(w) => { setPw(w); setFehler(null); }} onSubmitEditing={() => void oeffnen()} /> : null}
      {hinweis ? <Hinweis text={hinweis} symbol="icloud" /> : null}
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {gelesen ? <Vorschau aktuell={z.stand} gelesen={gelesen} /> : null}
    </BuehnenBlatt>
  );
}

function Vorschau({ aktuell, gelesen }: { aktuell: Stand; gelesen: Stand }) {
  const z = zusammenfuehren(aktuell, gelesen);
  return (
    <View style={{ marginTop: 16, gap: 6 }}>
      <Hinweis art="erfolg" text={TEXT.inhalt_sicherung(gelesen.betrieb.name, gelesen.unterlagen.length, gelesen.mitarbeiter.length, gelesen.kunden.length, gelesen.belege.length, gelesen.kasse.length)} />
      <Hinweis text={TEXT.zusammenfuehren_text(z.neu, z.aktualisiert, z.behalten)} />
      {z.nummernKonflikte.length ? <Hinweis art="fehler" text={TEXT.nummern_konflikt(z.nummernKonflikte)} /> : null}
      {z.festKonflikte.length ? <Hinweis art="fehler" text={TEXT.fest_konflikt(z.festKonflikte)} /> : null}
      {z.mehrfachStorniert.length ? <Hinweis art="fehler" text={TEXT.mehrfach_storniert(z.mehrfachStorniert)} /> : null}
    </View>
  );
}

/**
 * Lohnt die Erinnerung an eine Sicherung? Erst wenn es etwas Unersetzliches gibt – mindestens drei geteilte Unterlagen
 * bzw. Belege, oder das erste davon ist mindestens sieben Tage alt (R11, UX #12).
 */
export function sicherungLohnt(s: Pick<Stand, "unterlagen" | "belege">, jetzt: Date): boolean {
  const zeiten = [...s.unterlagen.filter((u) => u.festgeschrieben || u.ausgegeben).map((u) => (u.festgeschrieben ?? u.ausgegeben)!), ...s.belege.map((b) => b.erstellt)].filter(Boolean).sort();
  if (!zeiten.length) return false;
  if (zeiten.length >= 3) return true;
  return jetzt.getTime() - new Date(zeiten[0]!).getTime() >= 7 * 86_400_000;
}

/**
 * Hinweis „Zeit für eine Sicherung“ (E-129): ungesicherte Änderungen, letzte Sicherung älter als eine Woche. Sonst
 * StB GoBD (D-11): monatlich an die Vollsicherung außerhalb des Geräts erinnern (auch bei laufender iCloud-Sicherung).
 */
export function SicherungsKarte() {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const jetzt = new Date();
  const faellig = sicherungFaellig(z.stand, jetzt);
  // erst, wenn es etwas Unersetzliches gibt: eine geteilte Rechnung oder einen Beleg – nicht schon nach einem Entwurf
  // R11 (UX #12): nicht gleich nach der ersten Rechnung – erst ab drei geteilten Unterlagen bzw. Belegen oder sieben Tage
  // nach dem ersten
  const wertvoll = sicherungLohnt(z.stand, jetzt);
  const voll = faellig ? null : vollsicherungFaellig(z.stand, jetzt, wertvoll);
  if ((!faellig && !voll) || !wertvoll) return null;
  const titel = faellig ? TEXT.sicherung_faellig_titel : TEXT.stb_vollsicherung_titel;
  const satz = faellig ? TEXT.sicherung_faellig(faellig.tage) : TEXT.stb_vollsicherung_faellig(voll!.tage);
  return (
    // kompakt: eine Zeile mit Symbol, Satz und Pfeil – der Hinweis soll auffallen, nicht die Seite beherrschen
    <Pressable accessibilityRole="button" accessibilityLabel={`${titel}. ${satz}`} onPress={() => nav.oeffnen("sicherung", () => <SicherungSeite />, true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.baldHauch, marginBottom: 18, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: f.baldKreis, alignItems: "center", justifyContent: "center" }}>
        <Symbol name="exclamationmark.shield" groesse={20} farbe={f.bald} gewicht="semibold" />
      </View>
      <View style={{ flex: 1 }}>
        <T fett>{titel}</T>
        <T v="caption" leise numberOfLines={2}>{satz}</T>
      </View>
      <Symbol name="chevron.right" groesse={14} farbe={f.bald} gewicht="semibold" />
    </Pressable>
  );
}

/**
 * Belegdateien, die in iCloud noch fehlen, einzeln hochladen (je Datei einmal). Liefert die Zahl der Dateien, die
 * sich auf dem Gerät nicht lesen ließen (H3) – dann ist die Sicherung nicht vollständig.
 */
async function belegeHochladen(z: ReturnType<typeof useAmtlos>, k: SicherungsSchluessel, stand: Stand): Promise<number> {
  const kennung = schluesselKennung(k.salz);
  const da = await cloudDateien(kennung);
  let fehlend = 0;
  for (const datei of dateienImStand(stand)) {
    if (da.has(datei)) continue;
    const bytes = await z.dateiLesen(datei);
    if (bytes) await cloudDateiSchreiben(kennung, datei, sicherungsDatei(bytes, k.schluessel, zufall));
    else fehlend++;
  }
  return fehlend;
}

/** Belegdateien einer iCloud-Sicherung holen, die nicht in der Sicherungsdatei selbst stecken. */
async function belegeAusCloud(text: string, stand: Stand, schluessel: Uint8Array, vorhanden: Dateien): Promise<Dateien> {
  const kdf = sicherungsKdf(text);
  if (!kdf) return vorhanden;
  const kennung = schluesselKennung(kdf.salz);
  const d: Dateien = { ...vorhanden };
  for (const datei of dateienImStand(stand)) {
    if (d[datei]) continue;
    const roh = await cloudDateiLesen(kennung, datei);
    const bytes = roh ? sicherungsDateiLesen(roh, schluessel) : null;
    if (bytes) d[datei] = base64(bytes);
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
    <Karte stil={{ marginBottom: 10, paddingBottom: 12 }}>
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
    </Karte>
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
  const [fehlend, setFehlend] = useState(0);
  const bereit = passwortBereit(pw, pw2);
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
      const ohne = await belegeHochladen(z, k, stand);
      await cloudSchreiben(sicherungMitSchluessel(stand, k, zufall, new Date()));
      z.cloudSicherungSetzen(true);
      // nur vollständig gilt als gesichert (H3)
      if (ohne) {
        setFehlend(ohne);
        return;
      }
      z.gesichert(stand);
      nav.zurueck();
    } catch {
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  };
  return (
    <BuehnenBlatt
      titel={TEXT.icloud_auto}
      unter={TEXT.icloud_einrichten_text}
      fuss={
          <Fuss>
            <Knopf text={laedt ? TEXT.sicherung_laeuft : TEXT.icloud_einschalten} symbol="icloud" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
          </Fuss>
      }
    >
      <PasswortPaar label={TEXT.passwort} pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />
      <View style={{ marginTop: 18 }}>
        <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
        {fehler ? <Hinweis art="fehler" text={TEXT.icloud_fehler} /> : null}
        {fehlend ? <Hinweis art="fehler" text={TEXT.sicherung_dateien_fehlen(fehlend)} /> : null}
      </View>
    </BuehnenBlatt>
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
        const ohne = await belegeHochladen(z, k, gesichert);
        await cloudSchreiben(sicherungMitSchluessel(gesichert, k, zufall, new Date()));
        // fehlt eine Belegdatei, gilt die Sicherung nicht als vollständig (H3) – die Erinnerung bleibt
        if (!ohne) z.gesichert(gesichert);
      })().catch(() => undefined);
    }, 20_000);
    return () => clearTimeout(zeit);
  }, [offen, z.stand.geaendert]);
  return null;
}
