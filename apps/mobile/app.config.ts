/**
 * Dynamische Ergänzung zu `app.json` (App-Review R7). Alles Feste steht weiter in `app.json` (liest auch
 * `werkzeuge/store-check.mjs`); hier kommt nur hinzu, was vom Build abhängt:
 *
 * Privacy Manifest – E-Mail-Adresse, Name und Benutzer-ID fallen nur mit Konto und Synchronisation an (E-134). Sie
 * stehen deshalb nur in Builds mit `EXPO_PUBLIC_API_URL` im Manifest; ein Build ohne Sync deklariert allein die
 * Kaufhistorie (RevenueCat), passend zu den Angaben in App Store Connect.
 *
 * Marke (docs/14-marke.md): Anzeigename (auch CFBundleDisplayName) und die Platzhalter {{MARKE}} in den Texten von
 * `app.json` (z. B. Berechtigungstexte) kommen aus packages/marke/marke.json. Bundle-ID und URL-Schema stehen dort nur
 * zur Übersicht unter „technisch“ und bleiben in `app.json` maßgeblich (test/marke.test.ts prüft, dass beide gleich sind).
 */
import type { ConfigContext, ExpoConfig } from "expo/config";
import { MARKE, markeEinsetzenTief } from "@amtlos/marke";

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

/**
 * E-240: Inhalts-Updates über expo-updates (Katalog, Texte, JS – keine nativen Änderungen), Runbook
 * docs/inhalte-aktualisieren.md. **Standard aus:** Die App fragt dann nie einen Update-Server an (`updates.enabled: false`,
 * es gilt nur das eingebaute Bündel). Eingeschaltet nur mit `INHALTS_UPDATES=1` beim Build – erst, wenn die
 * Datenschutzhinweise die Abfrage beim Update-Server nennen und freigegeben sind (PRUEFLISTE T-367, Gründerentscheidung
 * T-366); der Store-Check verlangt das.
 *
 * Server: EAS Update (`https://u.expo.dev/<projectId>`, braucht `eas init`) oder ein eigener Server nach dem
 * expo-updates-Protokoll (`INHALTS_UPDATES_URL`, z. B. beim eigenen Hoster). Laden beim Start im Hintergrund, ohne auf das
 * Netz zu warten (`fallbackToCacheTimeout: 0`); ein geladenes Update gilt erst beim nächsten Start, nie mitten in der
 * Sitzung. `runtimeVersion` per Fingerabdruck der nativen Teile: ein Update erreicht nur Builds mit genau denselben
 * nativen Modulen und derselben nativen Konfiguration (kein Absturz durch fehlende Module, auch wenn `version` beim
 * Store-Release nicht erhöht wurde).
 */
export function mitInhaltsUpdates(config: ExpoConfig, env: Record<string, string | undefined>): ExpoConfig {
  const projectId = (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? "";
  const url = (env.INHALTS_UPDATES_URL ?? "").trim() || (projectId ? `https://u.expo.dev/${projectId}` : "");
  const an = env.INHALTS_UPDATES === "1" && url.length > 0;
  if (!an) return { ...config, updates: { enabled: false, checkAutomatically: "NEVER" } };
  return { ...config, runtimeVersion: { policy: "fingerprint" }, updates: { enabled: true, url, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 } };
}

/** Sichtbaren Namen einsetzen: {{MARKE}} in allen Texten, Anzeigename auf dem Home-Bildschirm. */
export function mitMarke(config: ExpoConfig): ExpoConfig {
  const c = markeEinsetzenTief(config);
  return { ...c, name: MARKE.name, ios: { ...c.ios, infoPlist: { ...c.ios?.infoPlist, CFBundleDisplayName: MARKE.name } } };
}

export default ({ config }: ConfigContext): ExpoConfig => mitInhaltsUpdates(mitBuild(mitMarke(config as ExpoConfig), (process.env.EXPO_PUBLIC_API_URL ?? "").trim().length > 0), process.env);
