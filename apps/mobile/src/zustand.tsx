import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { texte, type Texte } from "@amtlos/i18n";
import { ApiFehler, ApiKlient, NetzFehler, type Ich, type Sprache } from "./kern/api";
import { StempelWarteschlange, uuidAus, type Fehlgeschlagen, type Stempel } from "./kern/warteschlange";
import { KONFIG } from "./konfig";

const TOKEN = "amtlos.token";
const UNTERNEHMEN = "amtlos.unternehmen";
const SPRACHE = "amtlos.sprache";

interface Zustand {
  bereit: boolean;
  sprache: Sprache;
  t: Texte;
  ich: Ich | null;
  unternehmenId: string | null;
  rolle: string | null;
  klient: ApiKlient;
  online: boolean;
  wartend: number;
  /** noch nicht übertragene Stempel (für die Anzeige „läuft seit“ ohne Netz) */
  offeneStempel: Stempel[];
  fehlgeschlagen: Fehlgeschlagen[];
  anmelden(token: string): Promise<void>;
  abmelden(): Promise<void>;
  unternehmenWaehlen(id: string): Promise<void>;
  spracheSetzen(s: Sprache): Promise<void>;
  stempeln(st: Omit<Stempel, "client_id" | "zeitpunkt" | "unternehmen_id">): Promise<void>;
  syncen(): Promise<void>;
  fehlgeschlageneVerwerfen(): Promise<void>;
}

const Kontext = createContext<Zustand | null>(null);

export function useAmtlos(): Zustand {
  const z = useContext(Kontext);
  if (!z) throw new Error("useAmtlos außerhalb von AmtlosAnbieter");
  return z;
}

const speicher = { lesen: (k: string) => AsyncStorage.getItem(k), schreiben: (k: string, v: string) => AsyncStorage.setItem(k, v) };

export function AmtlosAnbieter({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [sprache, setSprache] = useState<Sprache>(Localization.getLocales()[0]?.languageCode === "en" ? "en" : "de");
  const [ich, setIch] = useState<Ich | null>(null);
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [offeneStempel, setOffeneStempel] = useState<Stempel[]>([]);
  const wartend = offeneStempel.length;
  const [fehlgeschlagen, setFehlgeschlagen] = useState<Fehlgeschlagen[]>([]);
  const token = useRef<string | null>(null);
  const zustand = useRef({ unternehmenId, sprache });
  zustand.current = { unternehmenId, sprache };

  const klient = useMemo(
    () => new ApiKlient({ basis: KONFIG.apiUrl, token: async () => token.current, unternehmen: () => zustand.current.unternehmenId, sprache: () => zustand.current.sprache }),
    [],
  );
  const schlange = useMemo(() => new StempelWarteschlange(speicher), []);

  const standLaden = useCallback(async () => {
    const s = await schlange.stand();
    setOffeneStempel(s.offen);
    setFehlgeschlagen(s.fehlgeschlagen);
  }, [schlange]);

  const syncen = useCallback(async () => {
    if (!token.current) return;
    const r = await schlange.abarbeiten(klient);
    setOnline(r.offen === 0);
    await standLaden();
  }, [klient, schlange, standLaden]);

  const ichLaden = useCallback(async () => {
    try {
      const i = await klient.ich();
      setIch(i);
      setOnline(true);
      const gemerkt = await AsyncStorage.getItem(UNTERNEHMEN);
      const id = i.unternehmen.find((u) => u.id === gemerkt)?.id ?? i.unternehmen[0]?.id ?? null;
      setUnternehmenId(id);
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 401) {
        token.current = null;
        await SecureStore.deleteItemAsync(TOKEN);
        setIch(null);
      } else if (e instanceof NetzFehler) setOnline(false);
    }
  }, [klient]);

  useEffect(() => {
    void (async () => {
      const s = await AsyncStorage.getItem(SPRACHE);
      if (s === "de" || s === "en") setSprache(s);
      token.current = await SecureStore.getItemAsync(TOKEN);
      if (token.current) await ichLaden();
      await standLaden();
      setBereit(true);
    })();
  }, [ichLaden, standLaden]);

  // Übertragen beim Zurückkehren in die App und alle 30 Sekunden, solange etwas wartet
  useEffect(() => {
    const abo = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncen();
    });
    const takt = setInterval(() => {
      if (wartend > 0) void syncen();
    }, 30_000);
    return () => {
      abo.remove();
      clearInterval(takt);
    };
  }, [syncen, wartend]);

  const wert: Zustand = {
    bereit,
    sprache,
    t: texte(sprache),
    ich,
    unternehmenId,
    rolle: ich?.unternehmen.find((u) => u.id === unternehmenId)?.rolle ?? null,
    klient,
    online,
    wartend,
    offeneStempel,
    fehlgeschlagen,
    async anmelden(t) {
      token.current = t;
      await SecureStore.setItemAsync(TOKEN, t);
      await ichLaden();
    },
    async abmelden() {
      token.current = null;
      await SecureStore.deleteItemAsync(TOKEN);
      setIch(null);
      setUnternehmenId(null);
    },
    async unternehmenWaehlen(id) {
      await AsyncStorage.setItem(UNTERNEHMEN, id);
      setUnternehmenId(id);
    },
    async spracheSetzen(s) {
      await AsyncStorage.setItem(SPRACHE, s);
      setSprache(s);
      // Auch fürs Konto: E-Mails und Push kommen dann in dieser Sprache
      await klient.anfrage("/v1/ich/sprache", "PUT", { sprache: s }, false).catch(() => undefined);
    },
    async stempeln(st) {
      if (!unternehmenId) return;
      // Erst merken, dann senden: geht das Senden schief, bleibt der Stempel mit Gerätezeit erhalten
      await schlange.hinzufuegen({ ...st, unternehmen_id: unternehmenId, client_id: uuidAus(Crypto.getRandomBytes(16)), zeitpunkt: new Date().toISOString() });
      await standLaden();
      await syncen();
    },
    syncen,
    async fehlgeschlageneVerwerfen() {
      await schlange.fehlgeschlageneVerwerfen();
      await standLaden();
    },
  };
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
