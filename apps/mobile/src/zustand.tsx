import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { texte, type Texte } from "@amtlos/i18n";
import type { Katalog } from "@amtlos/rules-engine";
import { DEMO_TOKEN, demoAbruf } from "./demo/demo";
import { ApiFehler, ApiKlient, NetzFehler, type Abruf, type Ich, type Sprache } from "./kern/api";
import { StempelWarteschlange, uuidAus, type Fehlgeschlagen, type Stempel } from "./kern/warteschlange";
import { KONFIG } from "./konfig";

const TOKEN = "amtlos.token";
const UNTERNEHMEN = "amtlos.unternehmen";
const SPRACHE = "amtlos.sprache";
const DEMO_STAND = "amtlos.demo";
const demoSpeicher = { lesen: () => AsyncStorage.getItem(DEMO_STAND), schreiben: (v: string) => AsyncStorage.setItem(DEMO_STAND, v) };

interface Zustand {
  bereit: boolean;
  sprache: Sprache;
  t: Texte;
  ich: Ich | null;
  unternehmenId: string | null;
  rolle: string | null;
  klient: ApiKlient;
  /** zählt erfolgreiche Änderungen – Seiten laden dann still neu (E-120) */
  stand: number;
  online: boolean;
  wartend: number;
  /** noch nicht übertragene Stempel (für die Anzeige „läuft seit“ ohne Netz) */
  offeneStempel: Stempel[];
  fehlgeschlagen: Fehlgeschlagen[];
  anmelden(token: string): Promise<void>;
  /** Demo mit Beispieldaten, ohne Server (E-119) */
  demo: boolean;
  demoStarten(): Promise<void>;
  /** Konto und Unternehmen neu laden (z. B. nach dem Anlegen) und ein Unternehmen wählen */
  anmeldenAktualisieren(unternehmenId?: string): Promise<void>;
  /** Profil noch nie ausgefüllt → Schnellstart */
  profilFehlt: boolean | null;
  profilFehltSetzen(wert: boolean): void;
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
/** Token im sicheren Speicher; wo es ihn nicht gibt (Web-Vorschau), im normalen Speicher. */
const geheim = {
  lesen: (k: string) => SecureStore.getItemAsync(k).catch(() => AsyncStorage.getItem(k)),
  schreiben: (k: string, v: string) => SecureStore.setItemAsync(k, v).catch(() => AsyncStorage.setItem(k, v)),
  loeschen: (k: string) => SecureStore.deleteItemAsync(k).catch(() => AsyncStorage.removeItem(k)),
};

export function AmtlosAnbieter({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [sprache, setSprache] = useState<Sprache>(Localization.getLocales()[0]?.languageCode === "en" ? "en" : "de");
  const [ich, setIch] = useState<Ich | null>(null);
  const [profilFehlt, setProfilFehlt] = useState<boolean | null>(null);
  const [unternehmenId, setUnternehmenId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [offeneStempel, setOffeneStempel] = useState<Stempel[]>([]);
  const wartend = offeneStempel.length;
  const [fehlgeschlagen, setFehlgeschlagen] = useState<Fehlgeschlagen[]>([]);
  const token = useRef<string | null>(null);
  const zustand = useRef({ unternehmenId, sprache });
  zustand.current = { unternehmenId, sprache };

  // Demo: dieselbe Klasse, nur die Antworten kommen aus dem Katalog und dem Stand im Gerät
  const demoAntworten = useRef<Abruf | null>(null);
  const standSetzen = useRef<(f: (n: number) => number) => void>(() => undefined);
  const klient = useMemo(() => {
    const echt: Abruf = (url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<Abruf>;
    const abruf: Abruf = (url, init) => {
      if (token.current !== DEMO_TOKEN) return echt(url, init);
      // Katalog erst laden, wenn die Demo gebraucht wird (gut 0,3 MB) – deshalb require statt import
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      demoAntworten.current ??= demoAbruf(require("./demo/katalog.json") as Katalog, undefined, demoSpeicher);
      return demoAntworten.current(url, init);
    };
    return new ApiKlient({
      basis: KONFIG.apiUrl,
      token: async () => token.current,
      unternehmen: () => zustand.current.unternehmenId,
      sprache: () => zustand.current.sprache,
      abruf,
      nachSchreiben: () => standSetzen.current((n) => n + 1),
    });
  }, []);
  const [demo, setDemo] = useState(false);
  const [stand, setStand] = useState(0);
  standSetzen.current = setStand;
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
      zustand.current = { ...zustand.current, unternehmenId: id };
      if (id) {
        const p = await klient.profil().catch(() => null);
        setProfilFehlt(p ? p.version === 0 : false);
      } else setProfilFehlt(true);
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 401) {
        token.current = null;
        await geheim.loeschen(TOKEN);
        setIch(null);
      } else if (e instanceof NetzFehler) setOnline(false);
    }
  }, [klient]);

  useEffect(() => {
    void (async () => {
      const s = await AsyncStorage.getItem(SPRACHE);
      if (s === "de" || s === "en") setSprache(s);
      try {
        token.current = await geheim.lesen(TOKEN);
        setDemo(token.current === DEMO_TOKEN);
        if (token.current) await ichLaden();
        await standLaden();
      } finally {
        setBereit(true);
      }
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
    stand,
    online,
    wartend,
    offeneStempel,
    fehlgeschlagen,
    async anmelden(t) {
      token.current = t;
      setDemo(false);
      await geheim.schreiben(TOKEN, t);
      await ichLaden();
    },
    demo,
    async demoStarten() {
      token.current = DEMO_TOKEN;
      demoAntworten.current = null; // jede Demo beginnt frisch
      await AsyncStorage.removeItem(DEMO_STAND);
      setDemo(true);
      await geheim.schreiben(TOKEN, DEMO_TOKEN);
      await ichLaden();
    },
    async anmeldenAktualisieren(id) {
      if (id) await AsyncStorage.setItem(UNTERNEHMEN, id);
      await ichLaden();
    },
    profilFehlt,
    profilFehltSetzen: setProfilFehlt,
    async abmelden() {
      if (token.current === DEMO_TOKEN) await AsyncStorage.removeItem(DEMO_STAND);
      token.current = null;
      setDemo(false);
      demoAntworten.current = null;
      await geheim.loeschen(TOKEN);
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
