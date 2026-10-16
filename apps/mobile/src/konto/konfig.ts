import { Platform } from "react-native";

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

/** Entwicklungszugang (Kennung statt Anmeldung) nur in Entwicklung, Web-Tests oder ausdrücklich freigegebenen Builds. */
const devErlaubt = __DEV__ || Platform.OS === "web" || process.env.EXPO_PUBLIC_DEV_ANMELDUNG === "1";

/** Ein Store-Build mit Server, aber ohne Anmeldedienst bietet kein Konto an – statt einer Anmeldung, die nie klappt. */
export const syncAngeboten = API_URL.length > 0 && (OIDC_ISSUER.length > 0 || devErlaubt);
export const devAnmeldung = syncAngeboten && !OIDC_ISSUER;
