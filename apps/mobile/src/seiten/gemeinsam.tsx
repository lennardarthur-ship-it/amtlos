import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, type ScrollViewProps } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
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

export function Seite({ laedt, neu, children, ...rest }: ScrollViewProps & { laedt?: boolean; neu?: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={neu ? <RefreshControl refreshing={Boolean(laedt)} onRefresh={neu} /> : undefined} {...rest}>
      {children}
    </ScrollView>
  );
}
