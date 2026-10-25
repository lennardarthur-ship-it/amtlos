import { nachweisAnhaengen, type SicherungsZiel } from "./unterlagen/sicherungNachweis";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import * as StoreReview from "expo-store-review";
import { AppState } from "react-native";
import { sollFragen } from "./pro/bewertung";
import { kaufAktiv, proAktiv, proBeobachten, testmodus } from "./pro/kauf";
import { archivLoeschen, archivierteSchluessel, autoSchluesselLoeschen, schluesselArchivieren, schluesselHolen, schluesselLoeschen, schluesselbundMoeglich } from "./unterlagen/schluesselbund";
import { allesAbsagen } from "./pflichten/erinnerungen";
import { cacheLeeren } from "./unterlagen/aufraeumen";
import { kompaktJson } from "./unterlagen/kompakt";
import { LadeFehler } from "./unterlagen/standAblage";
import { standSpeicher } from "./unterlagen/standSpeicher";
import type { Beleg, Betrieb, Daten, KassenInhalt, Kassenabschluss, Kassensturz, Sachentnahme, Person, PersonAngaben, PersonenArt, Zahlung } from "@amtlos/fachlogik";
import { alleDateienEntfernen, ansichtenAufraeumen, dateiAblegen, dateiAnzeigen, dateiEntfernen, dateiGroesse, dateiHolen, dateiVorhanden } from "./unterlagen/dateien";
import { type BelegQuelle } from "./unterlagen/sicherungContainer";
import { kontoVergessen } from "./konto/sitzung";
import { syncZusammenfuehren } from "./konto/sync";
import { dateienImStand, doppeltePerson, korrigieren, personenZusammenfuehren, staetteLoeschen, staetteSetzen, unterlageStaette, type Betriebsstaette } from "./unterlagen/speicher";
import { personenkontenVergeben } from "./unterlagen/steuerpaket";
import { belegeFestschreiben, kassenbuchFestschreiben, kassensturzSpeichern, sachentnahmeLoeschen, sachentnahmeSpeichern } from "./unterlagen/speicher";
import { LEERER_STAND, StandFehler, ausgabeMoeglich, belegLoeschen, belegSetzen, neueId, steuerberatungSetzen, aendern, allesLoeschenErlaubt, anlegen, ausgeben, bezahltSetzen, kasseKorrigieren, kasseSpeichern, zahlungVermerken, zusammenfuehren, type Zusammenfuehrung, betriebSetzen, erledigtSetzen, felderSetzen, profilSetzen, stornieren, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, standGleich, type Stand, type Unterlage } from "./unterlagen/speicher";

/**
 * Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. Seit E-129 verschlüsselt (Schlüssel im Schlüsselbund),
 * seit E-194 in verschlüsselten Teildateien statt in einem AsyncStorage-Eintrag (`unterlagen/standAblage.ts`). Die beim
 * Start geladene Fassung bleibt als „vorher“ liegen (G6) und wird bei einem Ladefehler mit beiseitegelegt.
 */
/** nach einem Schreibfehler so lange warten, dann erneut versuchen (H5) */
const NEU_VERSUCHEN_MS = 5000;
/**
 * Speichern nach so langer Tipp-Pause (R9 Performance): Jedes Speichern verschlüsselt den ganzen Stand – bei einem großen
 * Betrieb auf dem iPhone mehrere Sekunden. Dazu sofort beim Wechsel in den Hintergrund und beim Verlassen eines Blatts
 * oder einer Unterseite (`sichern`).
 */
export const SPEICHERN_NACH_MS = 1500;

/** Arbeit erst, wenn der JS-Thread frei ist (requestIdleCallback; ersetzt den veralteten InteractionManager). */
const wennFrei = (f: () => void): (() => void) => {
  const g = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  if (g.requestIdleCallback) {
    const h = g.requestIdleCallback(f, { timeout: 1000 });
    return () => g.cancelIdleCallback?.(h);
  }
  const t = setTimeout(f, 0);
  return () => clearTimeout(t);
};

export type Tab = "heute" | "pflichten" | "meine" | "betrieb";

interface Zustand {
  bereit: boolean;
  /** gespeicherte Daten ließen sich nicht lesen – dann wird nichts überschrieben */
  ladefehler: boolean;
  /**
   * Art des Ladefehlers: „version“ = Daten aus einer neueren App-Version (App aktualisieren); „zu_gross“ = der alte
   * Speicher (Android, AsyncStorage) kann den Eintrag nicht mehr lesen (E-194) – er bleibt unangetastet; sonst „unlesbar“
   */
  ladefehlerArt: "unlesbar" | "version" | "zu_gross" | null;
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
  ausgeben(id: string, daten?: Daten, pdfSha256?: string, absender?: Betrieb, eRechnung?: boolean): boolean;
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
  /** StB GoBD (D-11): Vollsicherung außerhalb des Geräts exportiert – Datum und Art als Nachweis festhalten */
  sicherungNachweisen(ziel: SicherungsZiel): void;
  bezahltSetzen(id: string, datum: string | null): void;
  /** R12: Zahlungseingang mit Betrag (und ggf. Skonto/Minderung) vermerken */
  zahlungVermerken(id: string, z: Omit<Zahlung, "id">): void;
  /** R12: Tagesabschluss der Kasse speichern (festgeschrieben, sofort gespeichert) */
  kasseSpeichern(inhalt: KassenInhalt): Kassenabschluss;
  /** R12: Kassenabschluss korrigieren – nur mit Grund */
  kasseKorrigieren(id: string, inhalt: KassenInhalt, grund: string): void;
  /** R12 GoBD: Kassensturz mit Zählprotokoll speichern (unveränderlich, sofort gespeichert) */
  kassensturzSpeichern(k: Omit<Kassensturz, "id" | "zeitpunkt">): Kassensturz;
  /** R12 GoBD: Sachentnahme (unentgeltliche Wertabgabe) speichern bzw. löschen (protokolliert) */
  sachentnahmeSpeichern(e: Omit<Sachentnahme, "id" | "erstellt">): void;
  sachentnahmeLoeschen(id: string): void;
  /** R12 GoBD: Kassenbuch aus den Tagesabschlüssen beim Teilen festschreiben */
  kassenbuchFestschreiben(monat: string, standort: string, daten: Daten, sha256: string): void;
  /** R12 GoBD: Belege festschreiben (nach dem Steuerberater-Paket) */
  belegeFestschreiben(ids: string[]): void;
  /** R12 Personal: festgeschriebenen Nachweis korrigieren – neue Fassung mit Grund, die alte bleibt (sofort gespeichert) */
  korrigieren(id: string, grund: string): void;
  /** R12: Betriebsstätten (Filialen) */
  staetteSetzen(st: Betriebsstaette): void;
  staetteLoeschen(id: string): void;
  /** R12: Unterlage einer Betriebsstätte zuordnen (auch festgeschrieben – keine Änderung am Inhalt) */
  unterlageStaette(id: string, staette: string | null): void;
  /** R12 (Kurier #13): andere Person gleichen Namens, falls vorhanden */
  doppeltePerson(art: PersonenArt, id: string): Person | null;
  /** R12: zwei Einträge derselben Person zusammenführen (`weg` wird gelöscht) */
  personenZusammenfuehren(art: PersonenArt, bleibt: string, weg: string): void;
  appSperreSetzen(an: boolean): void;
  cloudSicherungSetzen(an: boolean): void;
  /** Amtlos Pro aktiv (Abo im App Store oder – nur im Testmodus – testweise eingeschaltet), E-132 */
  pro: boolean;
  /** E-156: der Store hat geantwortet (bzw. es gibt keinen Kauf) – erst dann gilt „kein Pro“ als sicher */
  proBekannt: boolean;
  /** Abo-Status beim Store neu abfragen (nach Kauf/Wiederherstellen und beim Start) */
  proAktualisieren(aktiv?: boolean): void;
  proTestSetzen(an: boolean): void;
  /** E-188: der Bezahlschirm nach dem ersten Pflichten-Check kam von selbst – vermerken, damit er so nur einmal kommt */
  bezahlschirmNachCheckVermerken(): void;
  /** Phase 2.3: Partner für „Empfohlen von …“ setzen bzw. entfernen (null) – nur Anzeige, schaltet nie etwas frei */
  partnerSetzen(id: string | null): void;
  /** Vorprüfung Recht (§ 305 Abs. 2 BGB): Zustimmung zu dieser Fassung der Nutzungsbedingungen mit Zeitpunkt speichern */
  nutzungsbedingungenAnnehmen(fassung: string): void;
  /** Erfolgsmoment (Rechnung geteilt, Check fertig, Zahlung vermerkt) – fragt ggf. nach einer Bewertung */
  erfolg(): void;
  steuerberatungSetzen(sb: Stand["steuerberatung"]): void;
  /** E-165: fehlende Personenkonten vergeben und speichern (nur mit Kontenvorgabe „Personenkonten“) – gibt den Stand zurück */
  personenkontenVergeben(): Stand;
  /** Belege (E-133) */
  /** R12 GoBD: festgeschriebene Belege nur mit Grund – false, wenn die Änderung deshalb nicht übernommen wurde */
  belegSetzen(b: Beleg, grund?: string): boolean;
  /**
   * Beleg löschen (H2): leer oder frisch erfasst – endgültig samt Datei („geloescht“); sonst als ungültig markiert,
   * Datensatz und Datei bleiben („ungueltig“). null, wenn es den Beleg nicht gibt.
   */
  belegLoeschen(id: string, grund?: string): "geloescht" | "ungueltig" | null;
  /** Datei verschlüsselt ablegen; liefert den Dateinamen (mit Endung) */
  dateiSpeichern(bytes: Uint8Array, endung: string): Promise<string>;
  dateiLesen(name: string): Promise<Uint8Array | null>;
  /**
   * Belegdateien aus einer Sicherung ablegen – eine nach der anderen, nie alle zugleich im Speicher (E-194); vorhandene,
   * lesbare Dateien bleiben. Liefert die Zahl der Dateien, die sich nicht ablegen ließen (G4)
   */
  dateienEinspielen(q: BelegQuelle): Promise<number>;
  /** Synchronisation (E-134): aktueller Stand, zusammengeführten Stand übernehmen, Datei unter ihrem Namen ablegen */
  aktuellerStand(): Stand;
  syncUebernehmen(s: Stand): void;
  dateiAblegenUnter(name: string, bytes: Uint8Array): Promise<void>;
  /** Liegt die Belegdatei auf dem Gerät? (ohne sie zu entschlüsseln) */
  dateiVorhanden(name: string): boolean;
  /** Größe der verschlüsselten Belegdatei in Bytes (0, wenn sie fehlt) */
  dateiGroesse(name: string): number;
  /** Belegdatei als vorübergehende Datei zum Anzeigen (Foto); `entfernen` löscht sie wieder */
  dateiAnzeigen(name: string, mime: string): Promise<{ uri: string; entfernen(): void } | null>;
  /** Ausstehende Änderungen gleich speichern, ohne die Tipp-Pause abzuwarten (beim Verlassen eines Formulars) */
  sichern(): void;
}

/** Zustandswerte ohne den Stand (ändern sich selten) */
type StatusFelder = "bereit" | "ladefehler" | "ladefehlerArt" | "verschluesselt" | "speicherFehler" | "speicherFehlerArt" | "tab" | "pro" | "proBekannt";
export type AmtlosStatus = Pick<Zustand, StatusFelder>;
/** Handlungen – über die ganze Laufzeit dieselben Funktionen (R9 Performance: kein Neuzeichnen wegen neuer Funktionen) */
export type AmtlosAktionen = Omit<Zustand, StatusFelder | "stand">;

/**
 * Drei Kontexte (R9 Performance): Stand, Status und Handlungen. `useAmtlos` liefert wie bisher alles zusammen (und
 * zeichnet bei jeder Änderung neu); wer nur Handlungen braucht, nimmt `useAktionen`, wer nur einen Teil des Stands
 * braucht, `useStandWahl` – dann zeichnet ein Tastendruck in einer Unterlage nicht alle Seiten neu.
 */
interface StandQuelle {
  lesen(): Stand;
  abonnieren(f: () => void): () => void;
}
const StandKontext = createContext<Stand | null>(null);
const StatusKontext = createContext<AmtlosStatus | null>(null);
const AktionenKontext = createContext<AmtlosAktionen | null>(null);
const QuelleKontext = createContext<StandQuelle | null>(null);

export function useAmtlos(): Zustand {
  const stand = useContext(StandKontext);
  const status = useContext(StatusKontext);
  const aktionen = useContext(AktionenKontext);
  if (!stand || !status || !aktionen) throw new Error("useAmtlos außerhalb von AmtlosAnbieter");
  return useMemo(() => ({ ...aktionen, ...status, stand }), [aktionen, status, stand]);
}

/** Nur die Handlungen – zeichnet nie wegen Änderungen am Stand neu. */
export function useAktionen(): AmtlosAktionen {
  const a = useContext(AktionenKontext);
  if (!a) throw new Error("useAktionen außerhalb von AmtlosAnbieter");
  return a;
}

/** Nur der Status (Ladefehler, Speicherfehler, Tab, Pro …). */
export function useAmtlosStatus(): AmtlosStatus {
  const s = useContext(StatusKontext);
  if (!s) throw new Error("useAmtlosStatus außerhalb von AmtlosAnbieter");
  return s;
}

/**
 * Ein Teil des Stands; neu gezeichnet wird nur, wenn sich dieser Teil ändert (Vergleich mit Object.is). Der Wähler muss
 * einen vorhandenen Teil liefern (z. B. `(s) => s.unterlagen`), kein neu gebautes Objekt.
 */
export function useStandWahl<T>(waehlen: (s: Stand) => T): T {
  const q = useContext(QuelleKontext);
  if (!q) throw new Error("useStandWahl außerhalb von AmtlosAnbieter");
  return useSyncExternalStore(q.abonnieren, () => waehlen(q.lesen()), () => waehlen(q.lesen()));
}

export function AmtlosAnbieter({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [ladefehler, setLadefehler] = useState(false);
  const [ladefehlerArt, setLadefehlerArt] = useState<"unlesbar" | "version" | "zu_gross" | null>(null);
  const sperre = useRef(false);
  const [stand, setStandIntern] = useState<Stand>(LEERER_STAND);
  const [tab, tabWechseln] = useState<Tab>("heute");
  // aktueller Stand für Handlungen, die sofort ein Ergebnis zurückgeben (anlegen, kopieren)
  const aktuell = useRef(stand);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);
  // geplantes Speichern, sobald der Thread frei ist; ausstehend: es gibt Ungespeichertes
  const frei = useRef<(() => void) | null>(null);
  const ausstehend = useRef(false);
  // Quelle für `useStandWahl`: benachrichtigt Abonnenten, sobald ein neuer Stand gilt
  const abonnenten = useRef(new Set<() => void>());
  const quelle = useMemo<StandQuelle>(
    () => ({
      lesen: () => aktuell.current,
      abonnieren: (f) => {
        abonnenten.current.add(f);
        return () => abonnenten.current.delete(f);
      },
    }),
    [],
  );
  const setStand = useCallback((s: Stand) => {
    setStandIntern(s);
    for (const f of [...abonnenten.current]) f();
  }, []);

  const [storePro, setStorePro] = useState(false);
  // E-156: erst wenn der Store geantwortet hat, steht fest, ob Pro fehlt – vorher keine Erinnerungen absagen
  const [proBekannt, setProBekannt] = useState(!kaufAktiv);
  useEffect(() => {
    if (!kaufAktiv) return;
    void proAktiv().then((an) => {
      setStorePro(an);
      setProBekannt(true);
    });
    const abo = AppState.addEventListener("change", (z) => {
      if (z === "active") void proAktiv().then(setStorePro);
    });
    // Phase 2.3: eingelöste Angebotscodes, Verlängerung, Kündigung – RevenueCat meldet die Berechtigung
    const beobachtung = proBeobachten(setStorePro);
    return () => {
      abo.remove();
      beobachtung();
    };
  }, []);
  const schluessel = useRef<Uint8Array | null>(null);
  const [verschluesselt, setVerschluesselt] = useState(false);
  const [speicherFehlerArt, setSpeicherFehlerArt] = useState<"schluessel" | "schreiben" | null>(null);
  const setSpeicherFehler = useCallback((art: "schluessel" | "schreiben" | null) => setSpeicherFehlerArt(art), []);
  const nochmal = useRef<ReturnType<typeof setTimeout> | null>(null);

  const laden = useCallback(async () => {
    const lesen = async () => {
      // verschlüsselt: ohne Schlüssel (oder bei falschem) wirft die Ablage – dann nichts überschreiben; ein alter
      // AsyncStorage-Eintrag wird dabei geprüft in Teildateien umgezogen (E-194)
      const { text, schluessel: k } = await standSpeicher.laden();
      if (k) {
        schluessel.current = k;
        setVerschluesselt(true);
      }
      return standAus(text);
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
      setLadefehlerArt(e instanceof StandFehler && e.art === "version" ? "version" : e instanceof LadeFehler && e.art === "zu_gross" ? "zu_gross" : "unlesbar");
    } finally {
      setBereit(true);
    }
  }, []);
  useEffect(() => {
    void laden();
    // Ansichtsdateien (entschlüsselte Fotos), die beim letzten Beenden liegen geblieben sind
    ansichtenAufraeumen();
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
      await standSpeicher.beiseitelegen(k);
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
    frei.current?.();
    frei.current = null;
    ausstehend.current = false;
    if (nochmal.current) clearTimeout(nochmal.current);
    nochmal.current = null;
    if (sperre.current) return;
    // große Texte (Logo in jedem Absender-Schnappschuss) nur einmal (E-194)
    const json = kompaktJson(aktuell.current);
    const k = schluessel.current;
    // Schreibfehler (Speicher voll, Dateisystem gestört) nie verschlucken (H5): melden und es erneut versuchen
    const ergebnis = (p: Promise<void>) =>
      void p
        .then(() => setSpeicherFehler(null))
        .catch(() => {
          setSpeicherFehler("schreiben");
          if (!nochmal.current) nochmal.current = setTimeout(() => schreibenRef.current(), NEU_VERSUCHEN_MS);
        });
    if (k) {
      ergebnis(standSpeicher.speichern(json, k));
      return;
    }
    // nur die Web-Vorschau hat keinen Schlüsselbund – dort liegt alles im Browser
    if (!schluesselbundMoeglich) {
      ergebnis(standSpeicher.speichern(json, null));
      return;
    }
    // auf dem Gerät nie unverschlüsselt speichern (E-143): Schlüssel noch einmal holen, sonst Bescheid geben
    void schluesselHolen(true)
      .then((neu) => {
        if (!neu) throw new Error("Schlüssel fehlt");
        schluessel.current = neu;
        setVerschluesselt(true);
        setSpeicherFehler(null);
        return standSpeicher.speichern(kompaktJson(aktuell.current), neu).catch(() => {
          setSpeicherFehler("schreiben");
          if (!nochmal.current) nochmal.current = setTimeout(() => schreibenRef.current(), NEU_VERSUCHEN_MS);
        });
      })
      .catch(() => setSpeicherFehler("schluessel"));
  }, [setSpeicherFehler]);
  const schreibenRef = useRef(schreiben);
  schreibenRef.current = schreiben;

  /** Speichern nach der Tipp-Pause planen – und dann erst, wenn gerade nichts gezeichnet oder getippt wird. */
  const planen = useCallback(() => {
    ausstehend.current = true;
    if (zeit.current) clearTimeout(zeit.current);
    frei.current?.();
    frei.current = null;
    zeit.current = setTimeout(() => {
      zeit.current = null;
      frei.current = wennFrei(() => {
        frei.current = null;
        schreiben();
      });
    }, SPEICHERN_NACH_MS);
  }, [schreiben]);

  /**
   * Formular verlassen: Ausstehendes ohne die restliche Tipp-Pause speichern – sobald der Thread frei ist, also nach der
   * Animation zum Schließen, nicht mittendrin.
   */
  const sichern = useCallback(() => {
    if (!ausstehend.current || frei.current) return;
    if (zeit.current) clearTimeout(zeit.current);
    zeit.current = null;
    frei.current = wennFrei(() => {
      frei.current = null;
      schreiben();
    });
  }, [schreiben]);

  /** Neuen Stand übernehmen und nach der Tipp-Pause speichern (Tippen erzeugt viele Änderungen). */
  const setzen = useCallback(
    (neu: Stand) => {
      const s = { ...neu, geaendert: new Date().toISOString() };
      aktuell.current = s;
      setStand(s);
      planen();
    },
    [planen, setStand],
  );

  // Geht die App in den Hintergrund, sofort speichern – sonst fehlt nach dem Beenden die letzte Eingabe
  useEffect(() => {
    const abo = AppState.addEventListener("change", (z) => {
      if (z !== "active" && ausstehend.current) schreiben();
    });
    return () => abo.remove();
  }, [schreiben]);

  /** Beiseitegelegte Stände mit dem aktuellen und den archivierten Schlüsseln öffnen; Lesbares zusammenführen (H4). */
  const beiseitegelegteVersuchen = useCallback(async (): Promise<number> => {
    if (sperre.current) return 0;
    const schluesselListe = [schluessel.current, ...(await archivierteSchluessel().catch(() => []))].filter((k): k is Uint8Array => Boolean(k));
    const texte = await standSpeicher.beiseitegelegteOeffnen(schluesselListe).catch(() => [] as string[]);
    let n = 0;
    for (const klar of texte) {
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

  const pro = storePro || (testmodus && stand.proTest);
  const status = useMemo<AmtlosStatus>(
    () => ({ bereit, ladefehler, ladefehlerArt, verschluesselt, speicherFehler: speicherFehlerArt !== null, speicherFehlerArt, tab, pro, proBekannt }),
    [bereit, ladefehler, ladefehlerArt, verschluesselt, speicherFehlerArt, tab, pro, proBekannt],
  );

  // alle Abhängigkeiten sind selbst stabil (useCallback ohne wechselnde Werte) – die Handlungen bleiben dieselben
  const aktionen = useMemo<AmtlosAktionen>(
    () => ({
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
      personLoeschen: (art, id) => {
        const datei = aktuell.current[art === "mitarbeiter" ? "mitarbeiter" : "kunden"].find((p) => p.id === id)?.aufenthalt_datei;
        const neu = personLoeschen(aktuell.current, art, id);
        setzen(neu);
        // R12: Kopie des Aufenthaltstitels mit der Person entfernen – wenn sie sonst niemand braucht
        if (datei && !dateienImStand(neu).includes(datei)) dateiEntfernen(datei);
      },
      korrigieren: (id, grund) => {
        setzen(korrigieren(aktuell.current, id, grund, new Date()));
        schreiben();
      },
      staetteSetzen: (st) => setzen(staetteSetzen(aktuell.current, st)),
      staetteLoeschen: (id) => setzen(staetteLoeschen(aktuell.current, id)),
      unterlageStaette: (id, staette) => setzen(unterlageStaette(aktuell.current, id, staette)),
      doppeltePerson: (art, id) => doppeltePerson(aktuell.current, art, id),
      personenZusammenfuehren: (art, bleibt, weg) => setzen(personenZusammenfuehren(aktuell.current, art, bleibt, weg)),
      profilSetzen: (werte, bl) => setzen(profilSetzen(aktuell.current, werte, bl)),
      erledigtSetzen: (pid, datum, termin) => setzen(erledigtSetzen(aktuell.current, pid, datum, termin)),
      ausgeben: (id, daten, pdfSha256, absender, eRechnung) => {
        if (!ausgabeMoeglich(aktuell.current, id, daten)) return false;
        setzen(ausgeben(aktuell.current, id, new Date(), daten, pdfSha256, absender, eRechnung));
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
        // nicht sofort ein zweites Mal den ganzen Stand verschlüsseln (R9 Performance) – mit der nächsten Pause speichern
        planen();
      },
      sicherungNachweisen: (ziel) => {
        // wie „gesichert“: der Nachweis ändert den Inhalt nicht (kein „geaendert“, sonst gälte alles als ungesichert)
        aktuell.current = { ...aktuell.current, sicherungsNachweis: nachweisAnhaengen(aktuell.current.sicherungsNachweis, { am: new Date().toISOString(), ziel }) };
        setStand(aktuell.current);
        planen();
      },
      bezahltSetzen: (id, datum) => {
        let s = bezahltSetzen(aktuell.current, id, datum);
        // Zahlung vor dem Teilen vermerkt: „Schon bezahlt am“ der Rechnung vorbelegen, wenn es noch leer ist – dann steht
        // auf dem PDF keine Zahlungsaufforderung (felderSetzen ändert festgeschriebene Rechnungen nicht)
        const u = s.unterlagen.find((x) => x.id === id);
        if (datum && u && u.vorlage === "rechnung" && !u.festgeschrieben && !String(u.daten.bezahlt_am ?? "").trim()) s = felderSetzen(s, id, { bezahlt_am: datum }, new Date());
        setzen(s);
      },
      zahlungVermerken: (id, zahlung) => setzen(zahlungVermerken(aktuell.current, id, zahlung)),
      kasseSpeichern: (inhalt) => {
        const [s0, k] = kasseSpeichern(aktuell.current, inhalt, new Date());
        let s = s0;
        // R12 GoBD: bar kassierte Rechnungen aus Amtlos – Zahlungseingang an der Rechnung gleich mit vermerken
        for (const r of k.rechnungen_bar ?? []) s = zahlungVermerken(s, r.id, { datum: k.datum, betrag_cent: r.betrag_cent });
        setzen(s);
        // festgeschrieben: sofort speichern wie eine geteilte Rechnung (G3)
        schreiben();
        return k;
      },
      kasseKorrigieren: (id, inhalt, grund) => {
        setzen(kasseKorrigieren(aktuell.current, id, inhalt, grund, new Date()));
        schreiben();
      },
      appSperreSetzen: (an) => setzen({ ...aktuell.current, appSperre: an }),
      cloudSicherungSetzen: (an) => setzen({ ...aktuell.current, cloudSicherung: an }),
      proAktualisieren: (aktiv) => (aktiv === undefined ? void proAktiv().then(setStorePro) : setStorePro(aktiv)),
      proTestSetzen: (an) => setzen({ ...aktuell.current, proTest: an }),
      bezahlschirmNachCheckVermerken: () => {
        if (aktuell.current.bezahlschirmNachCheck) return;
        setzen({ ...aktuell.current, bezahlschirmNachCheck: new Date().toISOString() });
        schreiben();
      },
      partnerSetzen: (id) => {
        const { partnerId: _alt, ...rest } = aktuell.current;
        setzen(id ? { ...rest, partnerId: id } : rest);
      },
      nutzungsbedingungenAnnehmen: (fassung) => {
        setzen({ ...aktuell.current, nutzungsbedingungen: { fassung, zeitpunkt: new Date().toISOString() } });
        schreiben();
      },
      // E-165: beim Einschalten der Personenkonten gleich die Nummern vergeben (danach beim Paket)
      steuerberatungSetzen: (sb) => setzen(personenkontenVergeben(steuerberatungSetzen(aktuell.current, sb))),
      personenkontenVergeben: () => {
        const neu = personenkontenVergeben(aktuell.current);
        if (neu !== aktuell.current) setzen(neu);
        return aktuell.current;
      },
      belegSetzen: (b, grund) => {
        const vorher = aktuell.current;
        const neu = belegSetzen(vorher, b, new Date(), grund);
        if (neu === vorher) return false;
        setzen(neu);
        if (grund) schreiben();
        return true;
      },
      belegeFestschreiben: (ids) => {
        setzen(belegeFestschreiben(aktuell.current, ids, new Date()));
        schreiben();
      },
      kassensturzSpeichern: (k) => {
        const [s, neu] = kassensturzSpeichern(aktuell.current, k, new Date());
        setzen(s);
        schreiben();
        return neu;
      },
      sachentnahmeSpeichern: (e) => {
        setzen(sachentnahmeSpeichern(aktuell.current, e, new Date()));
        schreiben();
      },
      sachentnahmeLoeschen: (id) => {
        setzen(sachentnahmeLoeschen(aktuell.current, id, new Date()));
        schreiben();
      },
      kassenbuchFestschreiben: (monat, standort, daten, sha) => {
        setzen(kassenbuchFestschreiben(aktuell.current, monat, standort, daten, sha, new Date()));
        schreiben();
      },
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
      dateiVorhanden: (name) => dateiVorhanden(name),
      dateiGroesse: (name) => dateiGroesse(name),
      dateiAnzeigen: (name, mime) => dateiAnzeigen(name, schluessel.current, mime).catch(() => null),
      sichern,
      dateienEinspielen: async (q) => {
        const r = await q.dateien(
          // eine vorhandene, lesbare Datei bleibt (geprüft je Datei, erst wenn sie an der Reihe ist)
          async (name) => !(dateiVorhanden(name) && (await dateiHolen(name, schluessel.current).catch(() => null))),
          (name, bytes) => dateiAblegen(name, bytes, schluessel.current),
        );
        return r.fehler;
      },
      aktuellerStand: () => aktuell.current,
      syncUebernehmen: (entfernt) => {
        const vorher = aktuell.current;
        const neu = syncZusammenfuehren(vorher, entfernt).stand;
        // nichts Neues: Stand nicht als geändert markieren (sonst gälte er als ungesichert und die iCloud-Sicherung liefe erneut)
        // inhaltlich vergleichen, gleiche Objekte überspringen (R9 Performance: vorher zweimal JSON.stringify des ganzen Stands)
        if (standGleich(neu, vorher)) return;
        // auf einem anderen Gerät gelöschte Belege: Datei hier auch entfernen (ungültig markierte behalten ihre Datei)
        const bleiben = new Set(dateienImStand(neu));
        for (const b of vorher.belege) if (b.datei && !bleiben.has(b.datei)) dateiEntfernen(b.datei);
        // R12: Aufenthaltstitel einer auf einem anderen Gerät gelöschten Person
        for (const p of vorher.mitarbeiter) if (p.aufenthalt_datei && !bleiben.has(p.aufenthalt_datei)) dateiEntfernen(p.aufenthalt_datei);
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
        zeit.current = null;
        frei.current?.();
        frei.current = null;
        ausstehend.current = false;
        if (!nachLadefehler) {
          for (const name of dateienImStand(aktuell.current)) dateiEntfernen(name);
          // auch Reste: verwaiste Belegdateien (E-143)
          alleDateienEntfernen();
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
        // gespeicherter Stand; ohne Ladefehler auch beiseitegelegte Stände, Vorversion und Ersatzkopie vom Umzug (E-143,
        // E-194) – nach einem Ladefehler bleibt das Beiseitegelegte (H4)
        await standSpeicher.allesLoeschen(nachLadefehler).catch(() => undefined);
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
    [setzen, schreiben, planen, sichern, setStand, laden, ladefehlerAufheben, beiseitegelegteVersuchen],
  );
  return (
    <AktionenKontext.Provider value={aktionen}>
      <QuelleKontext.Provider value={quelle}>
        <StatusKontext.Provider value={status}>
          <StandKontext.Provider value={stand}>{children}</StandKontext.Provider>
        </StatusKontext.Provider>
      </QuelleKontext.Provider>
    </AktionenKontext.Provider>
  );
}
