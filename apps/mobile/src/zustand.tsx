import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Betrieb, Daten, Person, PersonAngaben, PersonenArt } from "@amtlos/fachlogik";
import { LEERER_STAND, aendern, anlegen, ausgeben, betriebSetzen, erledigtSetzen, felderSetzen, istLesbar, profilSetzen, stornieren, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, type Stand, type Unterlage } from "./unterlagen/speicher";

/** Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. */
const SCHLUESSEL = "amtlos.unterlagen.v1";

export type Tab = "unterlagen" | "meine" | "betrieb";

interface Zustand {
  bereit: boolean;
  /** gespeicherte Daten ließen sich nicht lesen – dann wird nichts überschrieben */
  ladefehler: boolean;
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
  allesLoeschen(): Promise<void>;
  /** alles durch einen wiederhergestellten Stand ersetzen (Datensicherung) */
  ersetzen(s: Stand): void;
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
  const [tab, tabWechseln] = useState<Tab>("unterlagen");
  // aktueller Stand für Handlungen, die sofort ein Ergebnis zurückgeben (anlegen, kopieren)
  const aktuell = useRef(stand);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SCHLUESSEL)
      .then((json) => {
        // Unlesbares nie mit einem leeren Stand überschreiben (Datenverlust)
        if (!istLesbar(json)) {
          sperre.current = true;
          setLadefehler(true);
          return;
        }
        aktuell.current = standAus(json);
        setStand(aktuell.current);
      })
      .catch(() => {
        sperre.current = true;
        setLadefehler(true);
      })
      .finally(() => setBereit(true));
  }, []);

  const schreiben = useCallback(() => {
    if (zeit.current) clearTimeout(zeit.current);
    zeit.current = null;
    if (sperre.current) return;
    void AsyncStorage.setItem(SCHLUESSEL, JSON.stringify(aktuell.current)).catch(() => undefined);
  }, []);

  /** Neuen Stand übernehmen und kurz danach speichern (Tippen erzeugt viele Änderungen). */
  const setzen = useCallback(
    (s: Stand) => {
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
      ersetzen: (s) => setzen(s),
      allesLoeschen: async () => {
        if (zeit.current) clearTimeout(zeit.current);
        sperre.current = false;
        setLadefehler(false);
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
        await AsyncStorage.removeItem(SCHLUESSEL);
      },
    }),
    [bereit, ladefehler, stand, tab, setzen],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
