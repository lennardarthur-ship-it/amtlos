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
import { useAmtlos } from "../zustand";
import { tresorServer } from "./api";
import { API_URL, syncAngeboten } from "./konfig";
import { anmelden, beiAenderung, kontoIdMerken, kontoVergessen, sitzungLesen, sitzungVergessen, syncSchluesselLesen, syncSchluesselSpeichern, syncSchluesselVergessen, tokenHolen } from "./sitzung";
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
  nummernKonflikte: string[];
  /** angemeldet ohne Schlüssel: gibt es auf dem Server schon eine Synchronisation? (null = unbekannt) */
  serverEingerichtet: boolean | null;
  anmelden(kennung?: string): Promise<boolean>;
  abmelden(): Promise<void>;
  einrichten(passwort: string): Promise<void>;
  verbinden(passwort: string): Promise<void>;
  /** synchronisieren; true bei Erfolg (Fehler stehen in `fehler`) */
  jetzt(): Promise<boolean>;
  passwortAendern(neu: string): Promise<void>;
  /** Synchronisation beenden und alles auf dem Server löschen (die Daten auf den Geräten bleiben) */
  beenden(): Promise<void>;
  /** Konto löschen: Konto und alle Sync-Daten auf dem Server; die Daten auf dem Gerät bleiben */
  kontoLoeschen(): Promise<void>;
}

const ZULETZT = "amtlos.sync.zuletzt.v1";
const Kontext = createContext<Konto | null>(null);

export function useKonto(): Konto {
  const k = useContext(Kontext);
  if (!k) throw new Error("useKonto außerhalb von KontoAnbieter");
  return k;
}

const gleich = () => new Promise((r) => setTimeout(r, 30));
const alsFehler = (e: unknown): SyncFehler => (e instanceof SyncFehler ? e : new SyncFehler("netz"));

export function KontoAnbieter({ children }: { children: ReactNode }) {
  const z = useAmtlos();
  const zRef = useRef(z);
  zRef.current = z;
  const [status, setStatus] = useState<KontoStatus>(syncAngeboten ? "laedt" : "aus");
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [letzte, setLetzte] = useState<string | null>(null);
  const [fehler, setFehler] = useState<FehlerArt | null>(null);
  const [nummernKonflikte, setNummernKonflikte] = useState<string[]>([]);
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
  const fehlerMerken = useCallback(async (e: unknown) => {
    const f = alsFehler(e);
    setFehler(f.art);
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

  // AutoSync: nach Änderungen (kurz gewartet) und beim Öffnen der App
  const zuletzt = useRef<string | undefined>(undefined);
  const laeuftRef = useRef(false);
  const nochmal = useRef(false);

  const jetzt = useCallback(async (): Promise<boolean> => {
    if (laeuftRef.current) {
      nochmal.current = true;
      return true;
    }
    const k = await syncSchluesselLesen();
    if (!k) return false;
    laeuftRef.current = true;
    setLaeuft(true);
    try {
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
        zufall,
        lokal: () => (gelesen = zRef.current.aktuellerStand()),
        uebernehmen: (s) => {
          const inzwischen = zRef.current.aktuellerStand() !== gelesen;
          zRef.current.syncUebernehmen(s);
          // inzwischen Neues eingegeben? Dann bleibt die Markierung offen und es folgt gleich die nächste Runde
          if (!inzwischen) zuletzt.current = zRef.current.aktuellerStand().geaendert;
        },
        dateiLokal: (n) => zRef.current.dateiLesen(n),
        dateiAblegen: (n, b) => zRef.current.dateiAblegenUnter(n, b),
      };
      const r = await synchronisieren(u);
      const wann = new Date().toISOString();
      setLetzte(wann);
      void AsyncStorage.setItem(ZULETZT, wann).catch(() => undefined);
      setNummernKonflikte(r.nummernKonflikte);
      setFehler(null);
      return true;
    } catch (e) {
      await fehlerMerken(e);
      return false;
    } finally {
      laeuftRef.current = false;
      setLaeuft(false);
      if (nochmal.current) {
        nochmal.current = false;
        setTimeout(() => void jetzt(), 500);
      }
    }
  }, [server, kontoPruefen, fehlerMerken]);

  const automatisch = status === "aktiv" && z.pro && z.bereit && !z.ladefehler;
  const geaendert = z.stand.geaendert;
  useEffect(() => {
    if (!automatisch || geaendert === zuletzt.current) return;
    const t = setTimeout(() => void jetzt(), zuletzt.current === undefined ? 800 : 4000);
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
      nummernKonflikte,
      serverEingerichtet,
      anmelden: async (kennung) => {
        setFehler(null);
        try {
          const s = await anmelden(kennung);
          await neuLesen();
          return Boolean(s);
        } catch (e) {
          setFehler(alsFehler(e).art);
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
          throw await fehlerMerken(e);
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
          if (f.art !== "passwort") await fehlerMerken(f);
          throw f;
        } finally {
          setLaeuft(false);
        }
        zuletzt.current = undefined;
        await jetzt();
      },
      jetzt,
      passwortAendern: async (neu) => {
        const k = await syncSchluesselLesen();
        if (!k) throw new SyncFehler("format");
        await gleich();
        try {
          await server.schluesselSetzen(huelleErstellen(k.k, neu, zufall));
        } catch (e) {
          throw await fehlerMerken(e);
        }
      },
      beenden: async () => {
        try {
          await server.loeschen();
        } catch (e) {
          throw await fehlerMerken(e);
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
          throw await fehlerMerken(e);
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
    [status, name, laeuft, letzte, fehler, nummernKonflikte, serverEingerichtet, server, neuLesen, kontoPruefen, fehlerMerken, jetzt],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
