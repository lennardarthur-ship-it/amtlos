import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Betrieb, Daten, Person, PersonAngaben, PersonenArt } from "@amtlos/fachlogik";
import { LEERER_STAND, aendern, anlegen, betriebSetzen, felderSetzen, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, type Stand, type Unterlage } from "./unterlagen/speicher";

/** Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. */
const SCHLUESSEL = "amtlos.unterlagen.v1";

export type Tab = "unterlagen" | "meine" | "betrieb";

interface Zustand {
  bereit: boolean;
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
  kopieren(id: string): Unterlage | null;
  loeschen(id: string): void;
  allesLoeschen(): Promise<void>;
}

const Kontext = createContext<Zustand | null>(null);

export function useAmtlos(): Zustand {
  const z = useContext(Kontext);
  if (!z) throw new Error("useAmtlos außerhalb von AmtlosAnbieter");
  return z;
}

export function AmtlosAnbieter({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [stand, setStand] = useState<Stand>(LEERER_STAND);
  const [tab, tabWechseln] = useState<Tab>("unterlagen");
  // aktueller Stand für Handlungen, die sofort ein Ergebnis zurückgeben (anlegen, kopieren)
  const aktuell = useRef(stand);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SCHLUESSEL)
      .then((json) => {
        aktuell.current = standAus(json);
        setStand(aktuell.current);
      })
      .catch(() => undefined)
      .finally(() => setBereit(true));
  }, []);

  /** Neuen Stand übernehmen und kurz danach speichern (Tippen erzeugt viele Änderungen). */
  const setzen = useCallback((s: Stand) => {
    aktuell.current = s;
    setStand(s);
    if (zeit.current) clearTimeout(zeit.current);
    zeit.current = setTimeout(() => void AsyncStorage.setItem(SCHLUESSEL, JSON.stringify(aktuell.current)).catch(() => undefined), 300);
  }, []);

  const wert = useMemo<Zustand>(
    () => ({
      bereit,
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
      kopieren: (id) => {
        const [s, u] = kopieren(aktuell.current, id, new Date());
        setzen(s);
        return u;
      },
      loeschen: (id) => setzen(loeschen(aktuell.current, id)),
      allesLoeschen: async () => {
        if (zeit.current) clearTimeout(zeit.current);
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
        await AsyncStorage.removeItem(SCHLUESSEL);
      },
    }),
    [bereit, stand, tab, setzen],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
