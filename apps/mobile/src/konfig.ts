import Constants from "expo-constants";

/** Einstellungen aus app.json → expo.extra (je Build-Profil überschreibbar). */
interface Extra { apiUrl: string; authModus: "dev" | "oidc"; oidcIssuer: string | null; oidcClientId: string | null; eas?: { projectId?: string } }

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const KONFIG: Extra = {
  apiUrl: extra.apiUrl ?? "http://localhost:3001",
  authModus: extra.authModus === "oidc" ? "oidc" : "dev",
  oidcIssuer: extra.oidcIssuer ?? null,
  oidcClientId: extra.oidcClientId ?? null,
  eas: extra.eas,
};
