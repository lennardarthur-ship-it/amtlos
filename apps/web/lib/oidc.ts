import "server-only";
import * as client from "openid-client";
import { konfig } from "./konfig";

let konfiguration: Promise<client.Configuration> | undefined;

/** OIDC-Client (Authorization Code + PKCE) gegen den Identity-Provider (Zitadel, E-014). */
export function oidc(): Promise<client.Configuration> {
  const k = konfig();
  konfiguration ??= client.discovery(new URL(k.oidcIssuer!), k.oidcClientId!, k.oidcClientSecret);
  return konfiguration;
}

export const OIDC_COOKIE = "amtlos_oidc";
export const RUECKRUF = "/auth/rueckruf";
