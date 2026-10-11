import Constants from "expo-constants";

/** Einstellungen aus app.json → expo.extra (je Build-Profil überschreibbar). */
interface Extra { apiUrl: string; webUrl: string; authModus: "dev" | "oidc" | "demo"; oidcIssuer: string | null; oidcClientId: string | null; eas?: { projectId?: string } }

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const KONFIG: Extra = {
  apiUrl: extra.apiUrl ?? "http://localhost:3001",
  webUrl: extra.webUrl ?? "https://app.amtlos.de",
  // "demo": nur die Demo ohne Server (Testpaket für Expo Go, E-119)
  authModus: extra.authModus === "oidc" || extra.authModus === "demo" ? extra.authModus : "dev",
  oidcIssuer: extra.oidcIssuer ?? null,
  oidcClientId: extra.oidcClientId ?? null,
  eas: extra.eas,
};
