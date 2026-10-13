import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { nonce, schluesselHolen, schluesselLoeschen } from "./unterlagen/schluesselbund";
import { istTresor, tresorOeffnen, tresorSchliessen } from "./unterlagen/tresor";
import type { Betrieb, Daten, Person, PersonAngaben, PersonenArt } from "@amtlos/fachlogik";
import { LEERER_STAND, aendern, allesLoeschenErlaubt, anlegen, ausgeben, bezahltSetzen, zusammenfuehren, type Zusammenfuehrung, betriebSetzen, erledigtSetzen, felderSetzen, istLesbar, profilSetzen, stornieren, kopieren, loeschen, personLoeschen, personMerken, personSetzen, standAus, type Stand, type Unterlage } from "./unterlagen/speicher";

/** Alles liegt nur auf dem Gerät (E-121): kein Konto, kein Server. Seit E-129 verschlüsselt (Schlüssel im Schlüsselbund). */
const SCHLUESSEL = "amtlos.unterlagen.v1";

export type Tab = "pflichten" | "unterlagen" | "meine" | "betrieb";

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
  /** Sicherung zurückspielen, ohne Neueres zu verlieren (E-129) */
  zusammenfuehren(s: Stand): Zusammenfuehrung;
  /** Datensicherung erstellt – `stand` ist der gesicherte Stand (Änderungen danach bleiben ungesichert) */
  gesichert(stand?: Stand): void;
  bezahltSetzen(id: string, datum: string | null): void;
  appSperreSetzen(an: boolean): void;
  cloudSicherungSetzen(an: boolean): void;
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
  const [tab, tabWechseln] = useState<Tab>("pflichten");
  // aktueller Stand für Handlungen, die sofort ein Ergebnis zurückgeben (anlegen, kopieren)
  const aktuell = useRef(stand);
  const zeit = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schluessel = useRef<Uint8Array | null>(null);
  const [verschluesselt, setVerschluesselt] = useState(false);

  useEffect(() => {
    const laden = async () => {
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
    laden()
      .then((s) => {
        aktuell.current = s;
        setStand(s);
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
      zusammenfuehren: (g) => {
        const z = zusammenfuehren(aktuell.current, g);
        setzen(z.stand);
        return z;
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
      allesLoeschen: async () => {
        if (!sperre.current && !allesLoeschenErlaubt(aktuell.current)) return false;
        if (zeit.current) clearTimeout(zeit.current);
        sperre.current = false;
        setLadefehler(false);
        aktuell.current = LEERER_STAND;
        setStand(LEERER_STAND);
        await AsyncStorage.removeItem(SCHLUESSEL);
        await schluesselLoeschen().catch(() => undefined);
        schluessel.current = await schluesselHolen(true).catch(() => null);
        return true;
      },
    }),
    [bereit, ladefehler, verschluesselt, stand, tab, setzen, schreiben],
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
