/**
 * Konto und Synchronisation (E-134) sind nur in Builds an, für die ein Server eingetragen ist. Ohne
 * `EXPO_PUBLIC_API_URL` (Testpaket, Expo Go) bleibt alles wie bisher nur auf dem Gerät – die App zeigt dann nichts
 * davon. Ohne `EXPO_PUBLIC_OIDC_ISSUER` meldet sich die App über den Entwicklungszugang des Servers an (nur dev/test).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const OIDC_ISSUER = process.env.EXPO_PUBLIC_OIDC_ISSUER ?? "";
export const OIDC_CLIENT_ID = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? "";
/** manche Anbieter (z. B. Auth0) brauchen die Zielgruppe der API schon bei der Anmeldung */
export const OIDC_AUDIENCE = process.env.EXPO_PUBLIC_OIDC_AUDIENCE ?? "";

export const syncAngeboten = API_URL.length > 0;
export const devAnmeldung = syncAngeboten && !OIDC_ISSUER;
