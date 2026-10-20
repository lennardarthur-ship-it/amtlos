/**
 * Dynamische Ergänzung zu `app.json` (App-Review R7). Alles Feste steht weiter in `app.json` (liest auch
 * `werkzeuge/store-check.mjs`); hier kommt nur hinzu, was vom Build abhängt:
 *
 * Privacy Manifest – E-Mail-Adresse, Name und Benutzer-ID fallen nur mit Konto und Synchronisation an (E-134). Sie
 * stehen deshalb nur in Builds mit `EXPO_PUBLIC_API_URL` im Manifest; ein Build ohne Sync deklariert allein die
 * Kaufhistorie (RevenueCat), passend zu den Angaben in App Store Connect.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

type Datenart = { NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean; NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] };

const nurMitSync = (typ: string): Datenart => ({
  NSPrivacyCollectedDataType: typ,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
});

/** Datenarten, die nur ein Build mit Synchronisation erhebt (Konto beim Anmeldedienst und Server). */
export const SYNC_DATENARTEN: Datenart[] = [
  nurMitSync("NSPrivacyCollectedDataTypeEmailAddress"),
  nurMitSync("NSPrivacyCollectedDataTypeName"),
  nurMitSync("NSPrivacyCollectedDataTypeUserID"),
];

/** Konfiguration für einen Build – `sync` folgt `EXPO_PUBLIC_API_URL` (wie `src/konto/konfig.ts`). */
export function mitBuild(config: ExpoConfig, sync: boolean): ExpoConfig {
  if (!sync) return config;
  const manifest = config.ios?.privacyManifests ?? {};
  const vorhanden = new Set((manifest.NSPrivacyCollectedDataTypes ?? []).map((d) => d.NSPrivacyCollectedDataType));
  return {
    ...config,
    ios: {
      ...config.ios,
      privacyManifests: {
        ...manifest,
        NSPrivacyCollectedDataTypes: [...(manifest.NSPrivacyCollectedDataTypes ?? []), ...SYNC_DATENARTEN.filter((d) => !vorhanden.has(d.NSPrivacyCollectedDataType))],
      },
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => mitBuild(config as ExpoConfig, (process.env.EXPO_PUBLIC_API_URL ?? "").trim().length > 0);
