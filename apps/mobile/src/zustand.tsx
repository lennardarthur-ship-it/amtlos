import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as StoreReview from "expo-store-review";
import { AppState } from "react-native";
import { sollFragen } from "./pro/bewertung";
import { kaufAktiv, proAktiv, testmodus } from "./pro/kauf";
import { archivLoeschen, archivierteSchluessel, autoSchluesselLoeschen, nonce, schluesselArchivieren, schluesselHolen, schluesselLoeschen, schluesselbundMoeglich } from "./unterlagen/schluesselbund";
import { allesAbsagen } from "./pflichten/erinnerungen";
import { cacheLeeren } from "./unterlagen/aufraeumen";
import { istTresor, tresorOeffnen, tresorSchliessen } from "./unterlagen/tresor";
import type { Beleg, Betrieb, Daten, Person, PersonAngaben, PersonenArt } from "@amtlos/fachlogik";
import { alleDateienEntfernen, dateiAblegen, dateiEntfernen, dateiHolen } from "./unterlagen/dateien";
import { base64, ausBase64, type Dateien } from "./unterlagen/sicherung";
import { kontoVergessen } from "./konto/sitzung";
import { syncZusammenfuehren } from "./konto/sync";
import { LEERER_STAND, StandFehler, ausgabeMoeglich, belegLoeschen, belegSetzen, neueId, steuerberatungSetzen, aendern, allesLoeschenErlaubt, anlegen, ausgeben, bezahltSetzen, zusammenfuehren, type Zusammenfuehrung, betriebSetzen, erledigtSetzen, felderSetzen, istLesbar, profilSetzen, stornieren, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, type Stand, type Unterlage } from "./unterlagen/speicher";

/** Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. Seit E-129 verschlüsselt (Schlüssel im Schlüsselbund). */
const SCHLUESSEL = "amtlos.unterlagen.v1";
/** zuletzt erfolgreich geladene Fassung (G6) – je App-Start einmal; wird bei einem Ladefehler mit beiseitegelegt */
const VORHER = `${SCHLUESSEL}.vorher`;
const BEISEITE = `${SCHLUESSEL}.unlesbar.`;
/** Zusatztext für beiseitegelegte, vorher unverschlüsselte Daten (G-6) */
const BEISEITE_KONTEXT = "beiseite";
/** nach einem Schreibfehler so lange warten, dann erneut versuchen (H5) */
const NEU_VERSUCHEN_MS = 5000;

export type Tab = "heute" | "pflichten" | "meine" | "betrieb";

interface Zustand {
  bereit: boolean;
  /** gespeicherte Daten ließen sich nicht lesen – dann wird nichts überschrieben */
  ladefehler: boolean;
  /** Art des Ladefehlers: „version“ = Daten aus einer neueren App-Version (App aktualisieren), sonst „unlesbar“ */
  ladefehlerArt: "unlesbar" | "version" | null;
  /** gespeicherte Daten liegen verschlüsselt (auf iPhone/Android; im Web nicht) */
  verschluesselt: boolean;
  /**
   * Speichern gescheitert: Schlüsselbund nicht erreichbar (es wird nichts unverschlüsselt gespeichert) oder der
   * Speicher schreibt nicht (z. B. voll, H5). Amtlos versucht es weiter; solange gilt: letzte Änderungen ungesichert.
   */
  speicherFehler: boolean;
  speicherFehlerArt: "schluessel" | "schreiben" | null;
  stand: Stand;
  tab: Tab;
  tabWechseln(t: Tab): void;
  betriebSpeichern(b: Betrieb): void;
  anlegen(vorlageId: string): Unterlage;
  aendern(id: string, daten: Daten): void;
  /** Felder setzen – auf Basis des aktuellen Stands (auch aus Unterseiten heraus sicher) */
  setzen(id: string, werte: Daten): void;
  /** aktuelle Daten einer Unterlage (für Handlungen nach schnellen Eingaben) */
  daten(id: string): Daten | undefined;
  personMerken(art: PersonenArt, angaben: PersonAngaben): void;
  personSetzen(art: PersonenArt, p: Person): void;
  personLoeschen(art: PersonenArt, id: string): void;
  profilSetzen(werte: Stand["profil"], bundeslandName?: string): void;
  erledigtSetzen(pflichtId: string, datum: string | null, termin?: string | null): void;
  /**
   * PDF geteilt oder gedruckt (schreibt Rechnungen fest, H1): `daten` ist der Inhalt, aus dem das PDF erzeugt wurde.
   * Hat sich die Unterlage seitdem geändert (z. B. durch die Synchronisation), wird nicht festgeschrieben – false:
   * PDF neu erzeugen. Die Festschreibung wird sofort gespeichert (G3).
   */
  ausgeben(id: string, daten?: Daten, pdfSha256?: string): boolean;
  erinnerungenSetzen(an: boolean): void;
  stornieren(id: string): Unterlage | null;
  kopieren(id: string): Unterlage | null;
  loeschen(id: string): void;
  /**
   * löscht alles – verweigert (false), solange aufbewahrungspflichtige Unterlagen nicht gesichert sind. Im
   * Ladefehler-Zustand nur mit `trotzLadefehler` (zweite, ausdrückliche Bestätigung, H4): Dann bleiben die
   * unlesbaren Daten beiseitegelegt, ihre Belegdateien und der alte Schlüssel erhalten.
   */
  allesLoeschen(trotzLadefehler?: boolean): Promise<boolean>;
  /** beiseitegelegte (unlesbare) Daten erneut zu öffnen versuchen – Lesbares wird zusammengeführt; liefert die Anzahl */
  beiseitegelegteVersuchen(): Promise<number>;
  /** nach einem Ladefehler: noch einmal lesen bzw. ohne die alten Daten neu beginnen (die bleiben beiseitegelegt) */
  neuLaden(): Promise<void>;
  neuBeginnen(): Promise<void>;
  /** Sicherung zurückspielen, ohne Neueres zu verlieren (E-129) */
  zusammenfuehren(s: Stand): Promise<Zusammenfuehrung>;
  /** Datensicherung erstellt – `stand` ist der gesicherte Stand (Änderungen danach bleiben ungesichert) */
  gesichert(stand?: Stand): void;
  bezahltSetzen(id: string, datum: string | null): void;
  appSperreSetzen(an: boolean): void;
  cloudSicherungSetzen(an: boolean): void;
  /** Amtlos Pro aktiv (Abo im App Store oder – nur im Testmodus – testweise eingeschaltet), E-132 */
  pro: boolean;
  /** Abo-Status beim Store neu abfragen (nach Kauf/Wiederherstellen und beim Start) */
  proAktualisieren(aktiv?: boolean): void;
  proTestSetzen(an: boolean): void;
  /** Erfolgsmoment (Rechnung geteilt, Check fertig, Zahlung vermerkt) – fragt ggf. nach einer Bewertung */
  erfolg(): void;
  steuerberatungSetzen(sb: Stand["steuerberatung"]): void;
  /** Belege (E-133) */
  belegSetzen(b: Beleg): void;
  /**
   * Beleg löschen (H2): leer oder frisch erfasst – endgültig samt Datei („geloescht“); sonst als ungültig markiert,
   * Datensatz und Datei bleiben („ungueltig“). null, wenn es den Beleg nicht gibt.
   */
  belegLoeschen(id: string, grund?: string): "geloescht" | "ungueltig" | null;
  /** Datei verschlüsselt ablegen; liefert den Dateinamen (mit Endung) */
  dateiSpeichern(bytes: Uint8Array, endung: string): Promise<string>;
  dateiLesen(name: string): Promise<Uint8Array | null>;
  /** alle Belegdateien als Base64 – für die Sicherung; `fehlend`: Dateien, die sich nicht lesen ließen (H3) */
  dateienFuerSicherung(s?: Stand): Promise<{ dateien: Dateien; fehlend: string[] }>;
  /** Belegdateien aus einer Sicherung ablegen (vorhandene bleiben); liefert die Zahl der Dateien, die sich nicht ablegen ließen (G4) */
  dateienEinspielen(d: Dateien): Promise<number>;
  /** Synchronisation (E-134): aktueller Stand, zusammengeführten Stand übernehmen, Datei unter ihrem Namen ablegen */
  aktuellerStand(): Stand;
  syncUebernehmen(s: Stand): void;
  dateiAblegenUnter(name: string, bytes: Uint8Array): Promise<void>;
}

const Kontext = createContext<Zustand | null>(null);

export function useAmtlos(): Zustand {
  const z = useContext(Kontext);
  if (!z) throw new Error("useAmtlos außerhalb von AmtlosAnbieter");
  return z;
}

export function AmtlosAnbieter({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [ladefehler, setLadefehler] = useState(false);
  const [ladefehlerArt, setLadefehlerArt] = useState<"unlesbar" | "version" | null>(null);
  const sperre = useRef(false);
  const [stand, setStand] = useState<Stand>(LEERER_STAND);
  const [tab, tabWechseln] = useState<Tab>("heute");
  // aktueller Stand für Handlungen, die sofort ein Ergebnis zurückgeben (anlegen, kopieren)
  const aktuell = useRef(stand);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [storePro, setStorePro] = useState(false);
  useEffect(() => {
    if (!kaufAktiv) return;
    void proAktiv().then(setStorePro);
    const abo = AppState.addEventListener("change", (z) => {
      if (z === "active") void proAktiv().then(setStorePro);
    });
    return () => abo.remove();
  }, []);
  const schluessel = useRef<Uint8Array | null>(null);
  const [verschluesselt, setVerschluesselt] = useState(false);
  const [speicherFehlerArt, setSpeicherFehlerArt] = useState<"schluessel" | "schreiben" | null>(null);
  const setSpeicherFehler = useCallback((art: "schluessel" | "schreiben" | null) => setSpeicherFehlerArt(art), []);
  const nochmal = useRef<ReturnType<typeof setTimeout> | null>(null);

  const laden = useCallback(async () => {
    const lesen = async () => {
      const json = await AsyncStorage.getItem(SCHLUESSEL);
      if (istTresor(json)) {
        // verschlüsselt: ohne Schlüssel (oder bei falschem) nichts überschreiben
        const k = await schluesselHolen(false);
        if (!k) throw new Error("Schlüssel fehlt");
        schluessel.current = k;
        setVerschluesselt(true);
        const s = standAus(tresorOeffnen(json!, k));
        // lesbar: diese Fassung als Vorversion merken (G6) – ein späterer Ladefehler hat dann etwas zum Zurückholen
        await AsyncStorage.setItem(VORHER, json!).catch(() => undefined);
        return s;
      }
      // Unlesbares nie mit einem leeren Stand überschreiben (Datenverlust)
      if (!istLesbar(json)) throw new Error("unlesbar");
      const s = standAus(json);
      // ältere, unverschlüsselte Daten: Schlüssel anlegen und gleich verschlüsselt speichern
      const k = await schluesselHolen(true).catch(() => null);
      if (k) {
        schluessel.current = k;
        setVerschluesselt(true);
        if (json) await AsyncStorage.setItem(SCHLUESSEL, tresorSchliessen(JSON.stringify(s), k, nonce()));
      }
      return s;
    };
    try {
      const s = await lesen();
      aktuell.current = s;
      setStand(s);
      sperre.current = false;
      setLadefehler(false);
      setLadefehlerArt(null);
    } catch (e) {
      sperre.current = true;
      setLadefehler(true);
      setLadefehlerArt(e instanceof StandFehler && e.art === "version" ? "version" : "unlesbar");
    } finally {
      setBereit(true);
    }
  }, []);
  useEffect(() => {
    void laden();
  }, [laden]);

  /**
   * Nach einem Ladefehler bewusst neu anfangen (Wiederherstellen oder „Neu beginnen“): die unlesbaren Daten nicht
   * löschen, sondern beiseitelegen, Schlüssel bei Bedarf neu anlegen, dann wieder speichern.
   */
  const ladefehlerAufheben = useCallback(async (): Promise<boolean> => {
    if (!sperre.current) return true;
    let k: Uint8Array | null;
    try {
      k = await schluesselHolen(true);
    } catch {
      // Schlüssel beschädigt: nie löschen, sondern archivieren (H4) – die beiseitegelegten Daten hängen vielleicht an
      // ihm. Lässt sich der Schlüsselbund gar nicht lesen (vorübergehend), wirft das Archivieren: dann abbrechen.
      try {
        await schluesselArchivieren();
        k = await schluesselHolen(true);
      } catch {
        return false;
      }
    }
    // unlesbare Daten und die letzte lesbare Fassung beiseitelegen – nie löschen, nie im Klartext (G-6)
    try {
      const zeit = new Date().toISOString();
      const ablegen = async (text: string | null, name: string) => {
        if (!text) return;
        await AsyncStorage.setItem(name, istTresor(text) || !k ? text : tresorSchliessen(text, k, nonce(), BEISEITE_KONTEXT));
      };
      await ablegen(await AsyncStorage.getItem(SCHLUESSEL), `${BEISEITE}${zeit}`);
      await ablegen(await AsyncStorage.getItem(VORHER), `${BEISEITE}${zeit}-vorher`);
    } catch {
      return false;
    }
    schluessel.current = k;
    setVerschluesselt(Boolean(k));
    sperre.current = false;
    setLadefehler(false);
    setLadefehlerArt(null);
    return true;
  }, []);

  const schreiben = useCallback(() => {
    if (zeit.current) clearTimeout(zeit.current);
    zeit.current = null;
    if (nochmal.current) clearTimeout(nochmal.current);
    nochmal.current = null;
    if (sperre.current) return;
    const json = JSON.stringify(aktuell.current);
    const k = schluessel.current;
    // Schreibfehler (Speicher voll, AsyncStorage gestört) nie verschlucken (H5): melden und es erneut versuchen
    const ergebnis = (p: Promise<void>) =>
      void p
        .then(() => setSpeicherFehler(null))
        .catch(() => {
          setSpeicherFehler("schreiben");
          if (!nochmal.current) nochmal.current = setTimeout(() => schreibenRef.current(), NEU_VERSUCHEN_MS);
        });
    if (k) {
      ergebnis(AsyncStorage.setItem(SCHLUESSEL, tresorSchliessen(json, k, nonce())));
      return;
    }
    // nur die Web-Vorschau hat keinen Schlüsselbund – dort liegt alles im Browser
    if (!schluesselbundMoeglich) {
      ergebnis(AsyncStorage.setItem(SCHLUESSEL, json));
      return;
    }
    // auf dem Gerät nie unverschlüsselt speichern (E-143): Schlüssel noch einmal holen, sonst Bescheid geben
    void schluesselHolen(true)
      .then((neu) => {
        if (!neu) throw new Error("Schlüssel fehlt");
        schluessel.current = neu;
        setVerschluesselt(true);
        setSpeicherFehler(null);
        return AsyncStorage.setItem(SCHLUESSEL, tresorSchliessen(JSON.stringify(aktuell.current), neu, nonce())).catch(() => {
          setSpeicherFehler("schreiben");
          if (!nochmal.current) nochmal.current = setTimeout(() => schreibenRef.current(), NEU_VERSUCHEN_MS);
        });
      })
      .catch(() => setSpeicherFehler("schluessel"));
  }, [setSpeicherFehler]);
  const schreibenRef = useRef(schreiben);
  schreibenRef.current = schreiben;

  /** Neuen Stand übernehmen und kurz danach speichern (Tippen erzeugt viele Änderungen). */
  const setzen = useCallback(
    (neu: Stand) => {
      const s = { ...neu, geaendert: new Date().toISOString() };
      aktuell.current = s;
      setStand(s);
      if (zeit.current) clearTimeout(zeit.current);
      zeit.current = setTimeout(schreiben, 300);
    },
    [schreiben],
  );

  // Geht die App in den Hintergrund, sofort speichern – sonst fehlt nach dem Beenden die letzte Eingabe
  useEffect(() => {
    const abo = AppState.addEventListener("change", (z) => {
      if (z !== "active" && zeit.current) schreiben();
    });
    return () => abo.remove();
  }, [schreiben]);

  /** Beiseitegelegte Stände mit dem aktuellen und den archivierten Schlüsseln öffnen; Lesbares zusammenführen (H4). */
  const beiseitegelegteVersuchen = useCallback(async (): Promise<number> => {
    if (sperre.current) return 0;
    const namen = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(BEISEITE)).sort();
    const schluesselListe = [schluessel.current, ...(await archivierteSchluessel().catch(() => []))].filter((k): k is Uint8Array => Boolean(k));
    const oeffnen = (text: string): string | null => {
      if (!istTresor(text)) return text;
      for (const k of schluesselListe) {
        try {
          return tresorOeffnen(text, k, BEISEITE_KONTEXT);
        } catch {
          /* nächster Schlüssel */
        }
      }
      return null;
    };
    let n = 0;
    for (const name of namen) {
      const text = await AsyncStorage.getItem(name).catch(() => null);
      let klar = text ? oeffnen(text) : null;
      // beiseitegelegter, vorher unverschlüsselter Stand liegt verschlüsselt in einer zweiten Hülle
      if (klar && istTresor(klar)) klar = oeffnen(klar);
      if (!klar) continue;
      try {
        const s = standAus(klar);
        setzen(zusammenfuehren(aktuell.current, s).stand);
        n++;
      } catch {
        /* weiter unlesbar – bleibt beiseitegelegt */
      }
    }
    return n;
  }, [setzen]);

  const wert = useMemo<Zustand>(
    () => ({
      bereit,
      ladefehler,
      ladefehlerArt,
      verschluesselt,
      speicherFehler: speicherFehlerArt !== null,
      speicherFehlerArt,
      stand,
      tab,
      tabWechseln,
      betriebSpeichern: (b) => setzen(betriebSetzen(aktuell.current, b)),
      anlegen: (vorlageId) => {
        const [s, u] = anlegen(aktuell.current, vorlageId, new Date());
        setzen(s);
        return u;
      },
      aendern: (id, daten) => setzen(aendern(aktuell.current, id, daten, new Date())),
      setzen: (id, werte) => setzen(felderSetzen(aktuell.current, id, werte, new Date())),
      daten: (id) => aktuell.current.unterlagen.find((u) => u.id === id)?.daten,
      personMerken: (art, angaben) => setzen(personMerken(aktuell.current, art, angaben)),
      personSetzen: (art, p) => setzen(personSetzen(aktuell.current, art, p)),
      personLoeschen: (art, id) => setzen(personLoeschen(aktuell.current, art, id)),
      profilSetzen: (werte, bl) => setzen(profilSetzen(aktuell.current, werte, bl)),
      erledigtSetzen: (pid, datum, termin) => setzen(erledigtSetzen(aktuell.current, pid, datum, termin)),
      ausgeben: (id, daten, pdfSha256) => {
        if (!ausgabeMoeglich(aktuell.current, id, daten)) return false;
        setzen(ausgeben(aktuell.current, id, new Date(), daten, pdfSha256));
        // Festschreibung sofort speichern, nicht erst nach der Wartezeit (G3)
        schreiben();
        return true;
      },
      erinnerungenSetzen: (an) => setzen({ ...aktuell.current, erinnerungen: an }),
      stornieren: (id) => {
        const [s, u] = stornieren(aktuell.current, id, new Date());
        setzen(s);
        return u;
      },
      kopieren: (id) => {
        const [s, u] = kopieren(aktuell.current, id, new Date());
        setzen(s);
        return u;
      },
      loeschen: (id) => setzen(loeschen(aktuell.current, id)),
      zusammenfuehren: async (g) => {
        // Wiederherstellen nach einem Ladefehler: erst die unlesbaren Daten beiseitelegen, dann speichern
        if (sperre.current && !(await ladefehlerAufheben())) throw new Error("Ladefehler nicht aufgehoben");
        const z = zusammenfuehren(aktuell.current, g);
        setzen(z.stand);
        return z;
      },
      neuLaden: () => laden(),
      beiseitegelegteVersuchen,
      neuBeginnen: async () => {
        if (!(await ladefehlerAufheben())) return;
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
      },
      gesichert: (gesichertStand) => {
        const jetzt = new Date().toISOString();
        // inzwischen geändert? Dann gilt die Sicherung nur bis zum gesicherten Stand. Die Sicherung selbst ändert nichts.
        const bis = gesichertStand && gesichertStand.geaendert !== aktuell.current.geaendert && gesichertStand.geaendert ? gesichertStand.geaendert : jetzt;
        aktuell.current = { ...aktuell.current, letzteSicherung: bis };
        setStand(aktuell.current);
        schreiben();
      },
      bezahltSetzen: (id, datum) => setzen(bezahltSetzen(aktuell.current, id, datum)),
      appSperreSetzen: (an) => setzen({ ...aktuell.current, appSperre: an }),
      cloudSicherungSetzen: (an) => setzen({ ...aktuell.current, cloudSicherung: an }),
      pro: storePro || (testmodus && stand.proTest),
      proAktualisieren: (aktiv) => (aktiv === undefined ? void proAktiv().then(setStorePro) : setStorePro(aktiv)),
      proTestSetzen: (an) => setzen({ ...aktuell.current, proTest: an }),
      steuerberatungSetzen: (sb) => setzen(steuerberatungSetzen(aktuell.current, sb)),
      belegSetzen: (b) => setzen(belegSetzen(aktuell.current, b, new Date())),
      belegLoeschen: (id, grund) => {
        const b = aktuell.current.belege.find((x) => x.id === id);
        if (!b) return null;
        const neu = belegLoeschen(aktuell.current, id, new Date(), grund);
        setzen(neu);
        // ungültig markiert: Datei bleibt (Aufbewahrungspflicht); nur endgültig Gelöschtes verliert sie
        if (neu.belegArchiv.some((x) => x.id === id)) return "ungueltig";
        if (b.datei) dateiEntfernen(b.datei);
        return "geloescht";
      },
      dateiSpeichern: async (bytes, endung) => {
        const name = `${neueId()}.${endung.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
        await dateiAblegen(name, bytes, schluessel.current);
        return name;
      },
      dateiLesen: (name) => dateiHolen(name, schluessel.current).catch(() => null),
      dateienFuerSicherung: async (s) => {
        const d: Dateien = {};
        const fehlend: string[] = [];
        const st = s ?? aktuell.current;
        for (const b of [...st.belege, ...st.belegArchiv]) {
          if (!b.datei || d[b.datei]) continue;
          // eine fehlende oder unlesbare Datei nie still übergehen (H3) – die Sicherung wäre sonst unvollständig
          const bytes = await dateiHolen(b.datei, schluessel.current).catch(() => null);
          if (bytes) d[b.datei] = base64(bytes);
          else fehlend.push(b.datei);
        }
        return { dateien: d, fehlend };
      },
      dateienEinspielen: async (d) => {
        let fehler = 0;
        for (const [name, b64] of Object.entries(d)) {
          if (await dateiHolen(name, schluessel.current).catch(() => null)) continue;
          await dateiAblegen(name, ausBase64(b64), schluessel.current).catch(() => {
            fehler++;
          });
        }
        return fehler;
      },
      aktuellerStand: () => aktuell.current,
      syncUebernehmen: (entfernt) => {
        const vorher = aktuell.current;
        const neu = syncZusammenfuehren(vorher, entfernt).stand;
        // nichts Neues: Stand nicht als geändert markieren (sonst gälte er als ungesichert und die iCloud-Sicherung liefe erneut)
        const ohneZeit = (x: Stand) => JSON.stringify({ ...x, geaendert: undefined });
        if (ohneZeit(neu) === ohneZeit(vorher)) return;
        // auf einem anderen Gerät gelöschte Belege: Datei hier auch entfernen (ungültig markierte behalten ihre Datei)
        const bleiben = new Set([...neu.belege, ...neu.belegArchiv].map((b) => b.datei).filter(Boolean));
        for (const b of vorher.belege) if (b.datei && !bleiben.has(b.datei)) dateiEntfernen(b.datei);
        setzen(neu);
      },
      dateiAblegenUnter: (name, bytes) => dateiAblegen(name, bytes, schluessel.current),
      erfolg: () => {
        const jetzt = new Date();
        const b = { ...aktuell.current.bewertung, erfolge: aktuell.current.bewertung.erfolge + 1 };
        const fragen = sollFragen(b, jetzt);
        setzen({ ...aktuell.current, bewertung: fragen ? { ...b, gefragt: jetzt.toISOString() } : b });
        if (fragen) {
          // kurz warten, bis Teilen-Menü oder Meldung weg sind
          setTimeout(() => void StoreReview.isAvailableAsync().then((ok) => (ok ? StoreReview.requestReview() : undefined)).catch(() => undefined), 1200);
        }
      },
      allesLoeschen: async (trotzLadefehler) => {
        // Ladefehler (H4): nur nach ausdrücklicher zweiter Bestätigung – und dann ohne die unlesbaren Daten, ihre
        // Belegdateien und ihren Schlüssel anzurühren (sie werden beiseitegelegt, nicht gelöscht)
        const nachLadefehler = sperre.current;
        if (nachLadefehler) {
          if (!trotzLadefehler || !(await ladefehlerAufheben())) return false;
        } else if (!allesLoeschenErlaubt(aktuell.current)) return false;
        if (zeit.current) clearTimeout(zeit.current);
        if (!nachLadefehler) {
          for (const b of [...aktuell.current.belege, ...aktuell.current.belegArchiv]) if (b.datei) dateiEntfernen(b.datei);
          // auch Reste: verwaiste Belegdateien, beiseitegelegte unlesbare Stände, Vorversion (E-143)
          alleDateienEntfernen();
          const reste = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(`${SCHLUESSEL}.`));
          if (reste.length) await AsyncStorage.multiRemove(reste).catch(() => undefined);
        }
        cacheLeeren();
        await autoSchluesselLoeschen().catch(() => undefined);
        // geplante Erinnerungen gleich absagen, nicht erst beim nächsten Öffnen der Pflichten (G-12)
        await allesAbsagen().catch(() => undefined);
        // bis der neue Schlüssel da ist, nichts schreiben – sonst landete Neues unter dem gelöschten Schlüssel (E-144)
        sperre.current = true;
        schluessel.current = null;
        setLadefehler(false);
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
        await AsyncStorage.removeItem(SCHLUESSEL);
        if (nachLadefehler) {
          // der Schlüssel der beiseitegelegten Daten bleibt im Archiv
          await schluesselArchivieren().catch(() => undefined);
        } else {
          await schluesselLoeschen().catch(() => undefined);
          await archivLoeschen().catch(() => undefined);
        }
        // Synchronisation auf diesem Gerät beenden – sonst kämen die Daten vom Server zurück (E-134)
        await kontoVergessen();
        schluessel.current = await schluesselHolen(true).catch(() => null);
        sperre.current = false;
        return true;
      },
    }),
    [bereit, ladefehler, ladefehlerArt, verschluesselt, speicherFehlerArt, stand, tab, setzen, schreiben, storePro, laden, ladefehlerAufheben, beiseitegelegteVersuchen],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
