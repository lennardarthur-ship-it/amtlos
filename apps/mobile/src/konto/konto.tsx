/**
 * Konto und Synchronisation in der App (E-134): Zustand der Anmeldung, Einrichten und Verbinden mit dem Sync-Passwort,
 * automatische Synchronisation nach Änderungen und beim Öffnen der App. Ohne Server im Build (`syncAngeboten`) ist
 * alles aus und die App bleibt rein lokal.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { proKontoTrennen, proKontoVerbinden } from "../pro/kauf";
import { zufall } from "../unterlagen/sicherungDatei";
import { useAktionen, useAmtlosStatus, useStandWahl } from "../zustand";
import { tresorServer } from "./api";
import { API_URL, syncAngeboten } from "./konfig";
import { anmelden, beiAenderung, kontoIdMerken, kontoVergessen, sitzungLesen, sitzungVergessen, syncSchluesselLesen, syncSchluesselSpeichern, syncSchluesselVergessen, syncZaehlerLesen, syncZaehlerMerken, tokenHolen } from "./sitzung";
import { SyncFehler, huelleErstellen, huelleOeffnen, synchronisieren, zufallsSchluessel, type SyncUmgebung } from "./sync";

export type KontoStatus = "aus" | "laedt" | "abgemeldet" | "ohneSchluessel" | "aktiv";
export type FehlerArt = SyncFehler["art"];

interface Konto {
  status: KontoStatus;
  /** E-Mail bzw. Kennung der Anmeldung */
  name: string;
  laeuft: boolean;
  /** letzte erfolgreiche Synchronisation (ISO) */
  letzte: string | null;
  fehler: FehlerArt | null;
  /** Fehler kam von einer Handlung (Einrichten, Beenden …), nicht vom automatischen Abgleich */
  fehlerBeiHandlung: boolean;
  nummernKonflikte: string[];
  /** letzte Synchronisation: verschieden festgeschriebene Unterlagen (K1), mehrfach stornierte Rechnungen (K2) */
  festKonflikte: string[];
  mehrfachStorniert: string[];
  /** letzte Synchronisation: Belegdateien, die auf dem Server beschädigt sind bzw. nirgends mehr liegen (M5) */
  defekteDateien: string[];
  fehlendeDateien: string[];
  /** angemeldet ohne Schlüssel: gibt es auf dem Server schon eine Synchronisation? (null = unbekannt) */
  serverEingerichtet: boolean | null;
  anmelden(kennung?: string): Promise<boolean>;
  abmelden(): Promise<void>;
  einrichten(passwort: string): Promise<void>;
  verbinden(passwort: string): Promise<void>;
  /** synchronisieren; true bei Erfolg (Fehler stehen in `fehler`) */
  jetzt(): Promise<boolean>;
  /**
   * Sync-Passwort ändern (M-6): nur mit dem bisherigen Passwort – es muss die Hülle auf dem Server öffnen und den
   * Schlüssel dieses Geräts ergeben. Ohne `alt` wird abgelehnt (SyncFehler „passwort“).
   */
  passwortAendern(neu: string, alt?: string): Promise<void>;
  /** Synchronisation beenden und alles auf dem Server löschen (die Daten auf den Geräten bleiben) */
  beenden(): Promise<void>;
  /** Konto löschen: Konto und alle Sync-Daten auf dem Server; die Daten auf dem Gerät bleiben */
  kontoLoeschen(): Promise<void>;
}

const ZULETZT = "amtlos.sync.zuletzt.v1";
/** Automatisch synchronisieren frühestens so lange nach der letzten Änderung (R9 Performance; beim Öffnen sofort) */
export const SYNC_NACH_MS = 30_000;
const Kontext = createContext<Konto | null>(null);

export function useKonto(): Konto {
  const k = useContext(Kontext);
  if (!k) throw new Error("useKonto außerhalb von KontoAnbieter");
  return k;
}

const gleich = () => new Promise((r) => setTimeout(r, 30));
const alsFehler = (e: unknown): SyncFehler => (e instanceof SyncFehler ? e : new SyncFehler("netz"));

export function KontoAnbieter({ children }: { children: ReactNode }) {
  // nur Handlungen, Status und der Änderungszeitpunkt – nicht bei jeder Eingabe neu zeichnen (R9 Performance)
  const aktionen = useAktionen();
  const amtlosStatus = useAmtlosStatus();
  const geaendert = useStandWahl((s) => s.geaendert);
  const zRef = useRef(aktionen);
  zRef.current = aktionen;
  const [status, setStatus] = useState<KontoStatus>(syncAngeboten ? "laedt" : "aus");
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [letzte, setLetzte] = useState<string | null>(null);
  const [fehler, setFehler] = useState<FehlerArt | null>(null);
  const [fehlerBeiHandlung, setFehlerBeiHandlung] = useState(false);
  const [nummernKonflikte, setNummernKonflikte] = useState<string[]>([]);
  const [festKonflikte, setFestKonflikte] = useState<string[]>([]);
  const [mehrfachStorniert, setMehrfachStorniert] = useState<string[]>([]);
  const [defekteDateien, setDefekteDateien] = useState<string[]>([]);
  const [fehlendeDateien, setFehlendeDateien] = useState<string[]>([]);
  const [serverEingerichtet, setServerEingerichtet] = useState<boolean | null>(null);
  const server = useMemo(() => tresorServer(API_URL, tokenHolen), []);

  const neuLesen = useCallback(async () => {
    if (!syncAngeboten) return;
    const s = await sitzungLesen();
    const k = s ? await syncSchluesselLesen() : null;
    setName(s?.name ?? "");
    setStatus(!s ? "abgemeldet" : k ? "aktiv" : "ohneSchluessel");
  }, []);

  useEffect(() => {
    if (!syncAngeboten) return;
    void neuLesen();
    void AsyncStorage.getItem(ZULETZT).then((v) => setLetzte(v)).catch(() => undefined);
    return beiAenderung(() => void neuLesen());
  }, [neuLesen]);

  /** Fehler auswerten: abgelaufene Anmeldung entfernt nur die Sitzung, der Schlüssel bleibt. */
  const fehlerMerken = useCallback(async (e: unknown, handlung = false) => {
    const f = alsFehler(e);
    setFehler(f.art);
    setFehlerBeiHandlung(handlung);
    if (f.art === "anmeldung") await sitzungVergessen();
    return f;
  }, []);

  /** Konto-ID kennen: Käufe zuordnen (RevenueCat), Schlüssel eines anderen Kontos verwerfen. */
  const kontoPruefen = useCallback(async (kontoId: string | undefined) => {
    if (!kontoId) return;
    await kontoIdMerken(kontoId);
    void proKontoVerbinden(kontoId).then((pro) => pro && zRef.current.proAktualisieren(true));
    const k = await syncSchluesselLesen();
    if (k && k.konto !== kontoId) {
      await syncSchluesselVergessen();
      throw new SyncFehler("passwort");
    }
  }, []);

  // AutoSync: nach Änderungen (gewartet, R9 Performance: jede Runde verschlüsselt den ganzen Stand) und beim Öffnen der App
  const zuletzt = useRef<string | undefined>(undefined);
  const laeuftRef = useRef<Promise<boolean> | null>(null);
  const nochmal = useRef(false);

  const runde = useCallback(async (): Promise<boolean> => {
    setLaeuft(true);
    try {
      const k = await syncSchluesselLesen();
      if (!k) return false;
      let gelesen = zRef.current.aktuellerStand();
      const u: SyncUmgebung = {
        api: {
          ...server,
          holen: async () => {
            const t = await server.holen();
            // auf einem anderen Gerät beendet: hier auch beenden (die Daten auf dem Gerät bleiben)
            if (!t) await syncSchluesselVergessen();
            await kontoPruefen(t?.konto_id);
            return t;
          },
        },
        sync: k.k,
        // Stand an das Konto binden, alte Stände ablehnen (M-1)
        ...(k.konto ? { konto: k.konto, zaehlerLesen: syncZaehlerLesen, zaehlerMerken: syncZaehlerMerken } : {}),
        zufall,
        lokal: () => (gelesen = zRef.current.aktuellerStand()),
        uebernehmen: (s) => {
          const inzwischen = zRef.current.aktuellerStand() !== gelesen;
          zRef.current.syncUebernehmen(s);
          // inzwischen Neues eingegeben? Dann bleibt die Markierung offen und es folgt gleich die nächste Runde
          if (!inzwischen) zuletzt.current = zRef.current.aktuellerStand().geaendert;
        },
        dateiLokal: (n) => zRef.current.dateiLesen(n),
        dateiVorhanden: (n) => zRef.current.dateiVorhanden(n),
        dateiAblegen: (n, b) => zRef.current.dateiAblegenUnter(n, b),
      };
      const r = await synchronisieren(u);
      const wann = new Date().toISOString();
      setLetzte(wann);
      void AsyncStorage.setItem(ZULETZT, wann).catch(() => undefined);
      setNummernKonflikte(r.nummernKonflikte);
      setFestKonflikte(r.festKonflikte);
      setMehrfachStorniert(r.mehrfachStorniert);
      setDefekteDateien(r.defekteDateien);
      setFehlendeDateien(r.fehlendeDateien);
      setFehler(null);
      return true;
    } catch (e) {
      await fehlerMerken(e);
      return false;
    } finally {
      setLaeuft(false);
      if (nochmal.current) {
        nochmal.current = false;
        setTimeout(() => void jetztRef.current(), 500);
      }
    }
  }, [server, kontoPruefen, fehlerMerken]);

  /** Synchronisieren; läuft schon eine Runde, deren Ergebnis abwarten – danach folgt eine Runde für inzwischen Geändertes. */
  const jetzt = useCallback((): Promise<boolean> => {
    if (laeuftRef.current) {
      nochmal.current = true;
      return laeuftRef.current;
    }
    const r = runde();
    laeuftRef.current = r;
    // aufräumen, wie auch immer die Runde endet – sonst hinge die Synchronisation bis zum Neustart
    void r.finally(() => {
      if (laeuftRef.current === r) laeuftRef.current = null;
    });
    return r;
  }, [runde]);
  const jetztRef = useRef(jetzt);
  jetztRef.current = jetzt;

  const automatisch = status === "aktiv" && amtlosStatus.pro && amtlosStatus.bereit && !amtlosStatus.ladefehler;
  useEffect(() => {
    if (!automatisch || geaendert === zuletzt.current) return;
    const t = setTimeout(() => void jetzt(), zuletzt.current === undefined ? 800 : SYNC_NACH_MS);
    return () => clearTimeout(t);
  }, [automatisch, geaendert, jetzt]);
  useEffect(() => {
    if (!automatisch) return;
    const abo = AppState.addEventListener("change", (a) => {
      if (a === "active") void jetzt();
    });
    return () => abo.remove();
  }, [automatisch, jetzt]);

  // angemeldet ohne Schlüssel: nachsehen, ob schon eingerichtet ist (neues Gerät → Passwort eingeben)
  useEffect(() => {
    if (status !== "ohneSchluessel") return;
    setServerEingerichtet(null);
    server
      .holen()
      .then(async (t) => {
        setServerEingerichtet(Boolean(t));
        if (t?.konto_id) await kontoIdMerken(t.konto_id);
        if (t?.konto_id) void proKontoVerbinden(t.konto_id).then((pro) => pro && zRef.current.proAktualisieren(true));
      })
      .catch((e: unknown) => void fehlerMerken(e));
  }, [status, server, fehlerMerken]);

  const wert = useMemo<Konto>(
    () => ({
      status,
      name,
      laeuft,
      letzte,
      fehler,
      fehlerBeiHandlung,
      nummernKonflikte,
      festKonflikte,
      mehrfachStorniert,
      defekteDateien,
      fehlendeDateien,
      serverEingerichtet,
      anmelden: async (kennung) => {
        setFehler(null);
        try {
          const s = await anmelden(kennung);
          await neuLesen();
          return Boolean(s);
        } catch (e) {
          setFehler(alsFehler(e).art);
          setFehlerBeiHandlung(true);
          return false;
        }
      },
      abmelden: async () => {
        await kontoVergessen();
        await proKontoTrennen();
        setFehler(null);
        setNummernKonflikte([]);
        zuletzt.current = undefined;
      },
      einrichten: async (passwort) => {
        setFehler(null);
        setLaeuft(true);
        try {
          await gleich();
          const k = zufallsSchluessel(zufall);
          const huelle = huelleErstellen(k, passwort, zufall);
          const r = await server.einrichten(huelle);
          await kontoPruefen(r.konto_id);
          await syncSchluesselSpeichern(k, r.konto_id ?? "");
        } catch (e) {
          throw await fehlerMerken(e, true);
        } finally {
          setLaeuft(false);
        }
        zuletzt.current = undefined;
        await jetzt();
      },
      verbinden: async (passwort) => {
        setFehler(null);
        setLaeuft(true);
        try {
          await gleich();
          const t = await server.holen();
          if (!t) throw new SyncFehler("format");
          const k = huelleOeffnen(t.schluessel, passwort);
          await kontoPruefen(t.konto_id);
          await syncSchluesselSpeichern(k, t.konto_id ?? "");
        } catch (e) {
          const f = alsFehler(e);
          // falsches Passwort ist kein Zustand, nur eine Rückmeldung auf der Seite
          if (f.art !== "passwort") await fehlerMerken(f, true);
          throw f;
        } finally {
          setLaeuft(false);
        }
        zuletzt.current = undefined;
        await jetzt();
      },
      jetzt,
      passwortAendern: async (neu, alt) => {
        const k = await syncSchluesselLesen();
        if (!k) throw new SyncFehler("format");
        // wer das Gerät entsperrt in der Hand hat, soll das Passwort nicht ohne das bisherige ändern können (M-6)
        if (!alt) throw new SyncFehler("passwort");
        await gleich();
        try {
          const t = await server.holen();
          if (!t) throw new SyncFehler("format");
          const bisher = huelleOeffnen(t.schluessel, alt);
          if (bisher.length !== k.k.length || bisher.some((b, i) => b !== k.k[i])) throw new SyncFehler("passwort");
          // Hinweis: Der Sync-Schlüssel selbst bleibt (keine Schlüsselrotation) – Belegdateien auf dem Server lassen
          // sich nicht überschreiben; dafür bräuchte es einen eigenen Server-Endpunkt.
          await server.schluesselSetzen(huelleErstellen(k.k, neu, zufall));
        } catch (e) {
          // falsches bisheriges Passwort ist nur eine Rückmeldung auf der Seite, kein Zustand
          if (e instanceof SyncFehler && e.art === "passwort") throw e;
          throw await fehlerMerken(e, true);
        }
      },
      beenden: async () => {
        try {
          await server.loeschen();
        } catch (e) {
          throw await fehlerMerken(e, true);
        }
        await syncSchluesselVergessen();
        setFehler(null);
        setNummernKonflikte([]);
        setLetzte(null);
        void AsyncStorage.removeItem(ZULETZT).catch(() => undefined);
        zuletzt.current = undefined;
      },
      kontoLoeschen: async () => {
        try {
          await server.kontoLoeschen();
        } catch (e) {
          throw await fehlerMerken(e, true);
        }
        await kontoVergessen();
        await proKontoTrennen();
        setFehler(null);
        setNummernKonflikte([]);
        setLetzte(null);
        void AsyncStorage.removeItem(ZULETZT).catch(() => undefined);
        zuletzt.current = undefined;
      },
    }),
    [status, name, laeuft, letzte, fehler, fehlerBeiHandlung, nummernKonflikte, festKonflikte, mehrfachStorniert, defekteDateien, fehlendeDateien, serverEingerichtet, server, neuLesen, kontoPruefen, fehlerMerken, jetzt],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
