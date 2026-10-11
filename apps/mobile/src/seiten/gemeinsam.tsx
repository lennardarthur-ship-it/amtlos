import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type ScrollViewProps } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
import { T } from "../ui/bausteine";
import { RAND, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";

/** Lädt Daten von der API, mit Ziehen zum Aktualisieren und verständlichen Fehlern. */
export function useLaden<T>(laden: () => Promise<T>, abh: unknown[]) {
  const { t } = useAmtlos();
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const neu = useCallback(async () => {
    setLaedt(true);
    try {
      setDaten(await laden());
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e));
    } finally {
      setLaedt(false);
    }
    // abh: bewusst vom Aufrufer bestimmt (z. B. Unternehmen), nicht die Ladefunktion selbst
  }, abh);
  useEffect(() => {
    void neu();
  }, [neu]);
  return { daten, fehler, laedt, neu };
}

/** Seitenrahmen mit großem Titel (iOS-Stil) und optionaler Unterzeile, z. B. dem heutigen Datum. */
export function Seite({ titel, unterzeile, laedt, neu, children, kopfRechts, ...rest }: ScrollViewProps & { titel: string; unterzeile?: string; laedt?: boolean; neu?: () => void; kopfRechts?: ReactNode }) {
  const f = useFarben();
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 8, paddingBottom: 120 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={neu ? <RefreshControl refreshing={Boolean(laedt)} onRefresh={neu} tintColor={f.tinteLeise} /> : undefined}
      {...rest}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          {unterzeile ? <T v="klein" leise>{unterzeile}</T> : null}
          <T v="grossTitel" accessibilityRole="header">{titel}</T>
        </View>
        {kopfRechts}
      </View>
      {children}
    </ScrollView>
  );
}

/** Leerer Zustand als Einladung: ein Satz, was jetzt sinnvoll ist. */
export function Leer({ text }: { text: string }) {
  const f = useFarben();
  return (
    <View style={{ paddingVertical: 28, paddingHorizontal: 16, borderRadius: 14, backgroundColor: f.amtHauch }}>
      <T fett farbe={f.amt}>{text}</T>
    </View>
  );
}

/** Inhalt einer Unterseite: scrollbar, Ziehen zum Aktualisieren, Platz für die Tab-Leiste. */
export function Inhalt({ laedt, neu, children, ...rest }: ScrollViewProps & { laedt?: boolean; neu?: () => void }) {
  const f = useFarben();
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 16, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      refreshControl={neu ? <RefreshControl refreshing={Boolean(laedt)} onRefresh={neu} tintColor={f.tinteLeise} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

/** Fehler der API in einen Satz: Meldung und, falls vorhanden, die fehlenden Angaben. */
export function fehlerText(e: unknown, netz: string): string {
  if (e instanceof NetzFehler) return netz;
  if (e instanceof ApiFehler) return e.message;
  return String(e);
}

/** Eine Handlung mit Ladezustand und Fehlermeldung (Speichern, Stellen, Löschen …). */
export function useAktion() {
  const { t } = useAmtlos();
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const ausfuehren = useCallback(
    async <T,>(f: () => Promise<T>, erfolg?: string): Promise<T | undefined> => {
      setLaedt(true);
      setFehler(null);
      setMeldung(null);
      try {
        const r = await f();
        if (erfolg) setMeldung(erfolg);
        return r;
      } catch (e) {
        setFehler(fehlerText(e, t.mobil.fehler_netz));
        return undefined;
      } finally {
        setLaedt(false);
      }
    },
    [t],
  );
  return { laedt, fehler, meldung, ausfuehren, setFehler, setMeldung };
}

/** Abschnittstitel klein über einer Karte, wie in iOS-Einstellungen. */
export function Gruppe({ titel, children, fuss }: { titel?: string; children: ReactNode; fuss?: string }) {
  return (
    <View style={{ marginTop: 24 }}>
      {titel ? <T v="klein" fett leise stil={{ marginBottom: 8, marginLeft: 4 }}>{titel}</T> : null}
      {children}
      {fuss ? <T v="caption" leise stil={{ marginTop: 6, marginLeft: 4 }}>{fuss}</T> : null}
    </View>
  );
}
