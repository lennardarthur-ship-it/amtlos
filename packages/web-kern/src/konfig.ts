import "server-only";

export interface WebKonfig {
  umgebung: "dev" | "test" | "staging" | "prod";
  apiUrl: string;
  webUrl: string;
  authModus: "oidc" | "dev";
  devJwtSecret?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  sitzungSchluessel: string;
  /** Cookie-Präfix je Anwendung (Web: amtlos, Studio: amtlos_studio) */
  cookiePraefix: string;
}

let cache: WebKonfig | undefined;

export function konfig(): WebKonfig {
  if (cache) return cache;
  const e = process.env;
  const umgebung = (e.UMGEBUNG ?? "dev") as WebKonfig["umgebung"];
  const k: WebKonfig = {
    umgebung,
    apiUrl: e.API_INTERN_URL ?? e.API_URL ?? "http://localhost:3001",
    webUrl: e.WEB_URL ?? "http://localhost:3000",
    authModus: (e.AUTH_MODUS ?? "oidc") as WebKonfig["authModus"],
    devJwtSecret: e.DEV_JWT_SECRET,
    oidcIssuer: e.OIDC_ISSUER,
    oidcClientId: e.OIDC_CLIENT_ID,
    oidcClientSecret: e.OIDC_CLIENT_SECRET,
    sitzungSchluessel: e.SITZUNG_SCHLUESSEL ?? "",
    cookiePraefix: e.COOKIE_PRAEFIX ?? "amtlos",
  };
  const fehler: string[] = [];
  if (k.sitzungSchluessel.length < 32) fehler.push("SITZUNG_SCHLUESSEL (≥ 32 Zeichen) fehlt");
  if (k.authModus === "dev" && (umgebung === "prod" || umgebung === "staging")) fehler.push("AUTH_MODUS=dev ist in staging und prod verboten");
  if (k.authModus === "dev" && !k.devJwtSecret) fehler.push("DEV_JWT_SECRET fehlt");
  if (k.authModus === "oidc" && (!k.oidcIssuer || !k.oidcClientId)) fehler.push("OIDC_ISSUER und OIDC_CLIENT_ID fehlen");
  if (fehler.length) throw new Error(`Web-Konfiguration ungültig: ${fehler.join("; ")}`);
  cache = k;
  return k;
}
