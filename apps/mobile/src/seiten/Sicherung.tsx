import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, PasswortFeld, Schalter, Symbol, T, TextKnopf } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useMeldung } from "../ui/meldung";
import { RADIUS, useFarben } from "../ui/thema";
import { PASSWORT_EMPFOHLEN, SicherungsFehler, passwortSchwaeche, schluesselAusPasswort, schluesselKennung, sicherungMitSchluessel, sicherungsDatei, sicherungsDateiLesen, sicherungsKdf, sicherungsName, type SicherungsSchluessel } from "../unterlagen/sicherung";
import { belegeErgaenzt, containerOeffnen, containerSchreiben, textSicherungOeffnen, type GeoeffneteSicherung } from "../unterlagen/sicherungContainer";
import { ORDNER_WAHL, cloudBeiseitelegen, cloudDateiLesen, cloudDateiSchreiben, cloudDateien, cloudLesen, cloudSchreiben, cloudVerfuegbar, ordnerStatus, ordnerVergessen, ordnerWaehlen, type OrdnerStatus } from "../unterlagen/cloud";
import { bestaetigen } from "../ui/bestaetigen";
import { ANDROID } from "../plattform";
import { autoSchluesselHolen, autoSchluesselLoeschen, autoSchluesselSpeichern } from "../unterlagen/schluesselbund";
import { dateiTeilenBytes, sicherungTeilen, sicherungWaehlen, zufall, type GewaehlteSicherung } from "../unterlagen/sicherungDatei";
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

/** Ab so vielen Belegdateien bzw. so vielen MB weist die Sicherung als Datei auf Dauer und Größe hin (R9, E-194) */
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

/**
 * Android (E-190): Das Teilen-Menü von Android meldet nicht, ob die Datei wirklich gespeichert oder gesendet wurde
 * (expo-sharing kehrt auch nach „Zurück“ zurück). Damit ein Abbruch nicht als Sicherung zählt (Löschschutz, Nachweis
 * GoBD), fragt die App dort nach. Auf dem iPhone meldet das Teilen-Menü den Abbruch selbst – keine Frage.
 */
async function geteiltBestaetigt(): Promise<boolean> {
  if (!ANDROID) return true;
  return bestaetigen({ titel: TEXT.sicherung_geteilt_frage, text: TEXT.sicherung_geteilt_text, ja: TEXT.sicherung_geteilt_ja, nein: TEXT.sicherung_geteilt_nein });
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
  // große Sicherung: Seit E-194 entsteht die Datei Stück für Stück (Container, Version 3) – kein Absturz mehr, aber sie
  // dauert und ist groß. Dann vorher darauf hinweisen.
  const umfang = useMemo(() => {
    const namen = new Set(dateienImStand(z.stand));
    let bytes = 0;
    for (const n of namen) bytes += z.dateiGroesse(n);
    return { dateien: namen.size, mb: Math.round(bytes / 1e6) };
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
      const k = schluesselAusPasswort(pw, zufall);
      // E-194: Container Stück für Stück in eine Datei im Cache – je Belegdatei einzeln gelesen, nie alles im Speicher
      const { geteilt, ergebnis } = await sicherungTeilen(sicherungsName(heute()), (ziel) =>
        containerSchreiben(ziel, gesichert, k, zufall, { namen: dateienImStand(gesichert), lesen: z.dateiLesen }, new Date(), (n, von) => setFortschritt(TEXT.sicherung_fortschritt(n, von))),
      );
      setFortschritt(null);
      const fehlend = ergebnis.fehlend;
      // abgebrochen: keine Sicherung – die Erinnerung bleibt und „Alle Daten löschen“ bleibt gesperrt
      if (!geteilt) return;
      // Android (E-190) meldet einen Abbruch des Teilens nicht – erst nach ausdrücklichem „Ja“ zählt die Sicherung
      if (!(await geteiltBestaetigt())) return;
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
              <Knopf text={laedt ? TEXT.sicherung_laeuft : TEXT.sicherung_erstellen} symbol="lock" laedt={laedt} deaktiviert={!bereit} onPress={() => void los()} stil={{ flex: 1 }} />
            )}
          </Fuss>
      }
    >
      {erledigt ? null : <PasswortPaar label={TEXT.passwort} pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />}
      <View style={{ marginTop: 18 }}>
        <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
        {/* StB GoBD (D-11): Nachweis der letzten Vollsicherung außerhalb des Geräts */}
        <Hinweis text={`${TEXT.stb_letzte_vollsicherung(letzte ? nachweisText(letzte) : null)} ${z.stand.cloudSicherung ? TEXT.stb_vollsicherung_icloud : TEXT.stb_vollsicherung_hinweis}`} symbol="clock" />
        {gross && !erledigt ? <Hinweis text={TEXT.sicherung_gross(umfang.dateien, umfang.mb)} symbol="clock" /> : null}
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
      if ((await dateiTeilenBytes(a.dateiname, a.zip, "application/zip")) && (await geteiltBestaetigt())) {
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
  const [datei, setDateiIntern] = useState<GewaehlteSicherung | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [laedt, setLaedt] = useState(false);
  // geöffnete Sicherung: Stand zur Vorschau, Belegdateien werden erst beim Wiederherstellen einzeln gelesen (E-194)
  const [geoeffnet, setGeoeffnet] = useState<GeoeffneteSicherung | null>(null);
  const gelesen = geoeffnet?.stand ?? null;
  const [fehler, setFehler] = useState<string | null>(null);
  const cloud = useCloud();
  // gewählte Datei: die vorige Kopie im Cache wegräumen, beim Verlassen der Seite auch die letzte
  const zuletzt = useRef<GewaehlteSicherung | null>(null);
  const setDatei = (d: GewaehlteSicherung | null) => {
    if (zuletzt.current && zuletzt.current !== d) zuletzt.current.entfernen();
    zuletzt.current = d;
    setDateiIntern(d);
  };
  useEffect(() => () => zuletzt.current?.entfernen(), []);
  const waehlen = async () => {
    setFehler(null);
    setHinweis(null);
    setGeoeffnet(null);
    const d = await sicherungWaehlen().catch(() => null);
    if (d) setDatei(d);
  };
  const oeffnen = async () => {
    if (!datei) return;
    setFehler(null);
    setLaedt(true);
    try {
      await gleich();
      // Version 3 (Container) Stück für Stück; Version 1/2 als Text – dann können Belegfotos der automatischen
      // Sicherung (auch über „Dateien“ gewählt) einzeln daneben liegen
      setGeoeffnet(datei.leser ? await containerOeffnen(datei.leser, pw) : mitCloudBelegen(textSicherungOeffnen(datei.text ?? "", pw)));
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
            {geoeffnet ? (
              <Knopf
                text={TEXT.jetzt_wiederherstellen}
                onPress={() =>
                  void z
                    .zusammenfuehren(geoeffnet.stand)
                    .then(async (r) => {
                      const fehler = await z.dateienEinspielen(geoeffnet);
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
      {cloud || ORDNER_WAHL ? (
        <TextKnopf
          symbol="icloud"
          text={cloud ? TEXT.aus_icloud : TEXT.ordner_laden}
          onPress={() =>
            void (async () => {
              // Android (E-190): ohne erreichbaren Ordner zuerst die Ordnerauswahl (z. B. auf einem neuen Smartphone)
              if (!cloud && ORDNER_WAHL && (await ordnerWaehlen())?.art !== "ok") return;
              const text = await cloudLesen();
              setGeoeffnet(null);
              if (text) setDatei({ name: TEXT.icloud_sicherung_name, text, leser: null, entfernen: () => undefined });
              else setHinweis(TEXT.icloud_leer);
            })()
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
  const ordner = useOrdnerStatus(z.stand.cloudSicherung);
  const jetzt = new Date();
  // E-190: Android – die automatische Sicherung in den Ordner ist eingeschaltet, aber der Zugriff fehlt
  if (z.stand.cloudSicherung && ordner?.art === "kein_zugriff") {
    const satz = TEXT.ordner_kein_zugriff(ordner.name);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${TEXT.ordner_kein_zugriff_titel}. ${satz}`} onPress={() => void ordnerNeuWaehlen(z).catch(() => undefined)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.karte, backgroundColor: f.baldHauch, marginBottom: 18, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: f.baldKreis, alignItems: "center", justifyContent: "center" }}>
          <Symbol name="xmark.icloud" groesse={20} farbe={f.bald} gewicht="semibold" />
        </View>
        <View style={{ flex: 1 }}>
          <T fett>{TEXT.ordner_kein_zugriff_titel}</T>
          <T v="caption" leise numberOfLines={3}>{satz}</T>
          <T v="caption" fett farbe={f.bald}>{TEXT.ordner_neu}</T>
        </View>
      </Pressable>
    );
  }
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

/**
 * Belegdateien einer automatischen Sicherung, die nicht in der Sicherungsdatei selbst stecken (Belegordner in iCloud
 * bzw. im gewählten Ordner) – je Datei einzeln nachgeladen, erst beim Einspielen (E-194; vorher alle auf einmal als
 * Base64 im Speicher).
 */
function mitCloudBelegen(g: GeoeffneteSicherung): GeoeffneteSicherung {
  const kennung = schluesselKennung(g.kdf.salz);
  return {
    ...g,
    ...belegeErgaenzt(g, g.stand, async (name) => {
      const roh = await cloudDateiLesen(kennung, name);
      return roh ? sicherungsDateiLesen(roh, g.schluessel) : null;
    }),
  };
}

/**
 * Zustand des Sicherungsordners (nur Android, E-190) – beim Öffnen und bei jeder Rückkehr in die App neu geprüft
 * (die Berechtigung kann außerhalb der App entfallen). null: kein Ordner-System (iPhone, Web) oder noch nicht geprüft.
 */
export function useOrdnerStatus(an = true): OrdnerStatus | null {
  const [st, setSt] = useState<OrdnerStatus | null>(null);
  const pruefen = useCallback(() => {
    if (ORDNER_WAHL && an) void ordnerStatus().then(setSt).catch(() => undefined);
  }, [an]);
  useEffect(() => {
    pruefen();
    if (!ORDNER_WAHL || !an) return;
    const abo = AppState.addEventListener("change", (a) => {
      if (a === "active") pruefen();
    });
    return () => abo.remove();
  }, [pruefen, an]);
  return ORDNER_WAHL ? st : null;
}

/**
 * Sichern wie nach einer Änderung (AutoSicherung): erst die fehlenden Belegdateien, dann der Stand ohne Fotos. Liefert
 * false, wenn nichts geschrieben werden konnte (kein Schlüssel, Ziel nicht erreichbar).
 */
async function automatischSichern(z: ReturnType<typeof useAmtlos>): Promise<boolean> {
  const k = await autoSchluesselHolen();
  if (!k || !(await cloudVerfuegbar())) return false;
  const gesichert = z.aktuellerStand();
  // erst die Belegdateien (einzeln, nur fehlende), dann der Stand ohne Fotos – so verweist er nie auf Fehlendes
  const ohne = await belegeHochladen(z, k, gesichert);
  await cloudSchreiben(sicherungMitSchluessel(gesichert, k, zufall, new Date()));
  // fehlt eine Belegdatei, gilt die Sicherung nicht als vollständig (H3) – die Erinnerung bleibt
  if (!ohne) z.gesichert(gesichert);
  return true;
}

/**
 * Android (E-190): Ordner neu wählen (Zugriff verloren oder anderer Ordner) und gleich sichern. Liegt im neuen Ordner
 * eine Sicherung mit anderem Schlüssel (anderes Passwort, anderes Gerät), wird sie beiseitegelegt statt überschrieben.
 */
async function ordnerNeuWaehlen(z: ReturnType<typeof useAmtlos>, melden?: (t: string) => void): Promise<OrdnerStatus | null> {
  const st = await ordnerWaehlen();
  if (st?.art !== "ok") return st;
  const k = await autoSchluesselHolen();
  const vorhanden = await cloudLesen();
  const kdf = vorhanden ? sicherungsKdf(vorhanden) : null;
  if (vorhanden && (!k || !kdf || schluesselKennung(kdf.salz) !== schluesselKennung(k.salz))) {
    await cloudBeiseitelegen(vorhanden);
    melden?.(TEXT.ordner_beiseite);
  }
  await automatischSichern(z).catch(() => undefined);
  return st;
}

/** iCloud verfügbar? (nur im eigenen App-Build mit iCloud-Anmeldung) */
export function useCloud(): boolean {
  const [da, setDa] = useState(false);
  useEffect(() => {
    void cloudVerfuegbar().then(setDa);
  }, []);
  return da;
}

/**
 * Schalter unter „Deine Daten“: automatisch verschlüsselt in iCloud sichern (E-129). In Expo Go unsichtbar. Android
 * (E-190): automatisch in einen gewählten Ordner – immer sichtbar (die Ordnerauswahl gibt es auch in Expo Go), dazu der
 * gewählte Ordner, „Anderen Ordner wählen“ und bei verlorenem Zugriff der Hinweis mit „Ordner neu wählen“.
 */
export function CloudZeile() {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const cloud = useCloud();
  const sperre = useProSperre();
  const ordner = useOrdnerStatus(z.stand.cloudSicherung);
  const [st, setSt] = useState<OrdnerStatus | null>(null);
  const zeigen = st ?? ordner;
  if (!cloud && !ORDNER_WAHL) return null;
  const neu = () => void ordnerNeuWaehlen(z, melden).then((x) => x && setSt(x)).catch(() => undefined);
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
          if (ORDNER_WAHL) void ordnerVergessen();
        }
      }}
    />
    {ORDNER_WAHL && z.stand.cloudSicherung && zeigen ? (
      zeigen.art === "kein_zugriff" ? (
        <View style={{ gap: 6 }}>
          <Hinweis art="warnung" text={TEXT.ordner_kein_zugriff(zeigen.name)} symbol="xmark.icloud" />
          <Knopf ton symbol="folder.badge.plus" text={TEXT.ordner_neu} onPress={neu} />
        </View>
      ) : zeigen.art === "ok" ? (
        <View>
          <T v="klein" leise>{TEXT.ordner_gewaehlt(zeigen.name)}</T>
          <TextKnopf symbol="folder.badge.plus" text={TEXT.ordner_anderer} onPress={neu} />
        </View>
      ) : null
    ) : null}
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
  // Android (E-190): zuerst der Ordner – ein schon gewählter, erreichbarer wird übernommen
  const vorher = useOrdnerStatus();
  const [ordner, setOrdner] = useState<OrdnerStatus | null>(null);
  const gewaehlt = ordner ?? vorher;
  const ordnerOk = !ORDNER_WAHL || gewaehlt?.art === "ok";
  const bereit = passwortBereit(pw, pw2) && ordnerOk;
  const waehlen = () => void ordnerWaehlen().then((x) => x && setOrdner(x)).catch(() => setFehler(true));
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
          const r = textSicherungOeffnen(vorhanden, pw);
          k = { schluessel: r.schluessel, salz: r.kdf.salz, iterationen: r.kdf.iterationen };
          await z.zusammenfuehren(r.stand);
          await z.dateienEinspielen(mitCloudBelegen(r));
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
      {ORDNER_WAHL ? (
        <View style={{ marginBottom: 14, gap: 6 }}>
          {gewaehlt?.art === "ok" ? <Karte stil={{ paddingVertical: 12 }}><T fett numberOfLines={1}>{TEXT.ordner_gewaehlt(gewaehlt.name)}</T></Karte> : null}
          {gewaehlt?.art === "kein_zugriff" ? <Hinweis art="warnung" text={TEXT.ordner_kein_zugriff(gewaehlt.name)} /> : null}
          <Knopf ton symbol="folder.badge.plus" text={gewaehlt?.art === "ok" ? TEXT.ordner_anderer : TEXT.ordner_waehlen} onPress={waehlen} />
          <T v="caption" leise>{TEXT.ordner_tipp}</T>
        </View>
      ) : null}
      <PasswortPaar label={TEXT.passwort} pw={pw} pw2={pw2} setPw={setPw} setPw2={setPw2} />
      <View style={{ marginTop: 18 }}>
        <Hinweis art="warnung" text={TEXT.sicherung_warnung} symbol="lock" />
        {ORDNER_WAHL && !ordnerOk && passwortBereit(pw, pw2) ? <Hinweis text={TEXT.ordner_fehlt} symbol="folder" /> : null}
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
      void automatischSichern(z).catch(() => undefined);
    }, 20_000);
    return () => clearTimeout(zeit);
  }, [offen, z.stand.geaendert]);
  return null;
}
