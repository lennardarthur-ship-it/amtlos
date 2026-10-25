/**
 * Web (Vorschau, Rundgang): kein Schlüsselbund, keine Dateien – der Stand liegt wie bisher unverschlüsselt im Browser
 * (AsyncStorage → localStorage). Gleiche Schnittstelle wie `standSpeicher.ts` (E-194).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALT_BEISEITE, ALT_SCHLUESSEL, LadeFehler } from "./standAblage";

const lesbar = (t: string) => {
  try {
    const w = JSON.parse(t) as unknown;
    return Boolean(w && typeof w === "object");
  } catch {
    return false;
  }
};

export const standSpeicher = {
  laden: async (): Promise<{ text: string | null; schluessel: Uint8Array | null }> => {
    const text = await AsyncStorage.getItem(ALT_SCHLUESSEL);
    if (text !== null && !lesbar(text)) throw new LadeFehler("unlesbar");
    return { text, schluessel: null };
  },
  speichern: (text: string, _k: Uint8Array | null): Promise<void> => AsyncStorage.setItem(ALT_SCHLUESSEL, text),
  beiseitelegen: async (_k: Uint8Array | null): Promise<void> => {
    const t = await AsyncStorage.getItem(ALT_SCHLUESSEL);
    if (t !== null) await AsyncStorage.setItem(`${ALT_BEISEITE}${new Date().toISOString()}`, t);
    await AsyncStorage.removeItem(ALT_SCHLUESSEL);
  },
  beiseitegelegtVorhanden: async (): Promise<boolean> => (await AsyncStorage.getAllKeys()).some((k) => k.startsWith(ALT_BEISEITE)),
  beiseitegelegteOeffnen: async (_schluessel: readonly Uint8Array[]): Promise<string[]> => {
    const aus: string[] = [];
    for (const k of (await AsyncStorage.getAllKeys()).filter((x) => x.startsWith(ALT_BEISEITE)).sort()) {
      const t = await AsyncStorage.getItem(k);
      if (t && lesbar(t)) aus.push(t);
    }
    return aus;
  },
  allesLoeschen: async (nachLadefehler: boolean): Promise<void> => {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k === ALT_SCHLUESSEL || (!nachLadefehler && k.startsWith(`${ALT_SCHLUESSEL}.`)));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  },
};
