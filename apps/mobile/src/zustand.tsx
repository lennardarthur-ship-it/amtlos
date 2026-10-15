import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as StoreReview from "expo-store-review";
import { AppState } from "react-native";
import { sollFragen } from "./pro/bewertung";
import { kaufAktiv, proAktiv } from "./pro/kauf";
import { nonce, schluesselHolen, schluesselLoeschen } from "./unterlagen/schluesselbund";
import { istTresor, tresorOeffnen, tresorSchliessen } from "./unterlagen/tresor";
import type { Beleg, Betrieb, Daten, Person, PersonAngaben, PersonenArt } from "@amtlos/fachlogik";
import { dateiAblegen, dateiEntfernen, dateiHolen } from "./unterlagen/dateien";
import { base64, ausBase64, type Dateien } from "./unterlagen/sicherung";
import { kontoVergessen } from "./konto/sitzung";
import { syncZusammenfuehren } from "./konto/sync";
import { LEERER_STAND, belegLoeschen, belegSetzen, neueId, steuerberatungSetzen, aendern, allesLoeschenErlaubt, anlegen, ausgeben, bezahltSetzen, zusammenfuehren, type Zusammenfuehrung, betriebSetzen, erledigtSetzen, felderSetzen, istLesbar, profilSetzen, stornieren, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, type Stand, type Unterlage } from "./unterlagen/speicher";

/** Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. Seit E-129 verschlüsselt (Schlüssel im Schlüsselbund). */
const SCHLUESSEL = "amtlos.unterlagen.v1";

export type Tab = "heute" | "pflichten" | "meine" | "betrieb";

interface Zustand {
  bereit: boolean;
  /** gespeicherte Daten ließen sich nicht lesen – dann wird nichts überschrieben */
  ladefehler: boolean;
  /** gespeicherte Daten liegen verschlüsselt (auf iPhone/Android; im Web nicht) */
  verschluesselt: boolean;
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
  /** PDF geteilt oder gedruckt (schreibt Rechnungen fest) */
  ausgeben(id: string): void;
  erinnerungenSetzen(an: boolean): void;
  stornieren(id: string): Unterlage | null;
  kopieren(id: string): Unterlage | null;
  loeschen(id: string): void;
  /** löscht alles – verweigert (false), solange aufbewahrungspflichtige Unterlagen nicht gesichert sind */
  allesLoeschen(): Promise<boolean>;
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
  /** löscht den Beleg und seine Datei */
  belegLoeschen(id: string): void;
  /** Datei verschlüsselt ablegen; liefert den Dateinamen (mit Endung) */
  dateiSpeichern(bytes: Uint8Array, endung: string): Promise<string>;
  dateiLesen(name: string): Promise<Uint8Array | null>;
  /** alle Belegdateien als Base64 – für die Sicherung */
  dateienFuerSicherung(s?: Stand): Promise<Dateien>;
  /** Belegdateien aus einer Sicherung ablegen (vorhandene bleiben) */
  dateienEinspielen(d: Dateien): Promise<void>;
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

  const laden = useCallback(async () => {
    const lesen = async () => {
      const json = await AsyncStorage.getItem(SCHLUESSEL);
      if (istTresor(json)) {
        // verschlüsselt: ohne Schlüssel (oder bei falschem) nichts überschreiben
        const k = await schluesselHolen(false);
        if (!k) throw new Error("Schlüssel fehlt");
        schluessel.current = k;
        setVerschluesselt(true);
        return standAus(tresorOeffnen(json!, k));
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
    } catch {
      sperre.current = true;
      setLadefehler(true);
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
  const ladefehlerAufheben = useCallback(async () => {
    if (!sperre.current) return;
    const alt = await AsyncStorage.getItem(SCHLUESSEL).catch(() => null);
    if (alt) await AsyncStorage.setItem(`${SCHLUESSEL}.unlesbar.${new Date().toISOString()}`, alt);
    let k = await schluesselHolen(true).catch(() => null);
    if (!k) {
      // Schlüssel beschädigt: neu anlegen (die beiseitegelegten Daten bleiben, wie sie sind)
      await schluesselLoeschen().catch(() => undefined);
      k = await schluesselHolen(true).catch(() => null);
    }
    schluessel.current = k;
    setVerschluesselt(Boolean(k));
    sperre.current = false;
    setLadefehler(false);
  }, []);

  const schreiben = useCallback(() => {
    if (zeit.current) clearTimeout(zeit.current);
    zeit.current = null;
    if (sperre.current) return;
    const json = JSON.stringify(aktuell.current);
    const k = schluessel.current;
    void AsyncStorage.setItem(SCHLUESSEL, k ? tresorSchliessen(json, k, nonce()) : json).catch(() => undefined);
  }, []);

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

  const wert = useMemo<Zustand>(
    () => ({
      bereit,
      ladefehler,
      verschluesselt,
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
      ausgeben: (id) => setzen(ausgeben(aktuell.current, id, new Date())),
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
        if (sperre.current) await ladefehlerAufheben();
        const z = zusammenfuehren(aktuell.current, g);
        setzen(z.stand);
        return z;
      },
      neuLaden: () => laden(),
      neuBeginnen: async () => {
        await ladefehlerAufheben();
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
      pro: storePro || (!kaufAktiv && stand.proTest),
      proAktualisieren: (aktiv) => (aktiv === undefined ? void proAktiv().then(setStorePro) : setStorePro(aktiv)),
      proTestSetzen: (an) => setzen({ ...aktuell.current, proTest: an }),
      steuerberatungSetzen: (sb) => setzen(steuerberatungSetzen(aktuell.current, sb)),
      belegSetzen: (b) => setzen(belegSetzen(aktuell.current, b, new Date())),
      belegLoeschen: (id) => {
        const b = aktuell.current.belege.find((x) => x.id === id);
        if (b?.datei) dateiEntfernen(b.datei);
        setzen(belegLoeschen(aktuell.current, id));
      },
      dateiSpeichern: async (bytes, endung) => {
        const name = `${neueId()}.${endung.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
        await dateiAblegen(name, bytes, schluessel.current);
        return name;
      },
      dateiLesen: (name) => dateiHolen(name, schluessel.current).catch(() => null),
      dateienFuerSicherung: async (s) => {
        const d: Dateien = {};
        for (const b of (s ?? aktuell.current).belege) {
          if (!b.datei) continue;
          const bytes = await dateiHolen(b.datei, schluessel.current).catch(() => null);
          if (bytes) d[b.datei] = base64(bytes);
        }
        return d;
      },
      dateienEinspielen: async (d) => {
        for (const [name, b64] of Object.entries(d)) {
          if (await dateiHolen(name, schluessel.current).catch(() => null)) continue;
          await dateiAblegen(name, ausBase64(b64), schluessel.current).catch(() => undefined);
        }
      },
      aktuellerStand: () => aktuell.current,
      syncUebernehmen: (entfernt) => {
        const vorher = aktuell.current;
        const neu = syncZusammenfuehren(vorher, entfernt).stand;
        // nichts Neues: Stand nicht als geändert markieren (sonst gälte er als ungesichert und die iCloud-Sicherung liefe erneut)
        const ohneZeit = (x: Stand) => JSON.stringify({ ...x, geaendert: undefined });
        if (ohneZeit(neu) === ohneZeit(vorher)) return;
        // auf einem anderen Gerät gelöschte Belege: Datei hier auch entfernen
        const bleiben = new Set(neu.belege.map((b) => b.datei).filter(Boolean));
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
      allesLoeschen: async () => {
        if (!sperre.current && !allesLoeschenErlaubt(aktuell.current)) return false;
        if (zeit.current) clearTimeout(zeit.current);
        for (const b of aktuell.current.belege) if (b.datei) dateiEntfernen(b.datei);
        sperre.current = false;
        setLadefehler(false);
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
        await AsyncStorage.removeItem(SCHLUESSEL);
        await schluesselLoeschen().catch(() => undefined);
        // Synchronisation auf diesem Gerät beenden – sonst kämen die Daten vom Server zurück (E-134)
        await kontoVergessen();
        schluessel.current = await schluesselHolen(true).catch(() => null);
        return true;
      },
    }),
    [bereit, ladefehler, verschluesselt, stand, tab, setzen, schreiben, storePro, laden, ladefehlerAufheben],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
