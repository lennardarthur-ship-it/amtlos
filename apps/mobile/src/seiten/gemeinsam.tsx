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
