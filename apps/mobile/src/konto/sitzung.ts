/**
 * Anmeldung (E-134): OIDC mit PKCE über den Browser des Systems (Konto beim Identity-Provider, kein Passwort in der
 * App) – im Entwicklungsmodus über `POST /v1/dev/token`. Sitzung und Sync-Schlüssel liegen im Schlüsselbund.
 */
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { ausBase64, base64 } from "../unterlagen/sicherung";
import { API_URL, OIDC_AUDIENCE, OIDC_CLIENT_ID, OIDC_ISSUER, devAnmeldung } from "./konfig";
import { geheimLesen, geheimLoeschen, geheimSchreiben } from "./geheim";
import { SyncFehler } from "./sync";

WebBrowser.maybeCompleteAuthSession();

const SITZUNG = "amtlos.sitzung.v1";
const SYNC = "amtlos.sync.v1";
/** höchster gesehener Zähler des Sync-Stands (M-1) – gehört zum Sync-Schlüssel und geht mit ihm */
const ZAEHLER = "amtlos.sync.zaehler.v1";

export async function syncZaehlerLesen(): Promise<number> {
  const n = Number(await geheimLesen(ZAEHLER).catch(() => null));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
export async function syncZaehlerMerken(n: number): Promise<void> {
  if (n > (await syncZaehlerLesen())) await geheimSchreiben(ZAEHLER, String(n));
}

export interface Sitzung {
  token: string;
  refresh?: string;
  /** Ablauf des Tokens (ms seit 1970) */
  bis: number;
  /** Anzeige: E-Mail bzw. Kennung */
  name: string;
  /** Konto-ID des Servers (auch App-User-ID bei RevenueCat), sobald bekannt */
  kontoId?: string;
}

const hoerer = new Set<() => void>();
/** über Änderungen an Sitzung oder Sync-Schlüssel benachrichtigen (z. B. „Alle Daten löschen“) */
export function beiAenderung(f: () => void): () => void {
  hoerer.add(f);
  return () => hoerer.delete(f);
}
const melden = () => hoerer.forEach((f) => f());

export async function sitzungLesen(): Promise<Sitzung | null> {
  const roh = await geheimLesen(SITZUNG).catch(() => null);
  if (!roh) return null;
  try {
    const s = JSON.parse(roh) as Sitzung;
    return typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

async function sitzungSpeichern(s: Sitzung): Promise<void> {
  await geheimSchreiben(SITZUNG, JSON.stringify(s));
  melden();
}

export async function kontoIdMerken(kontoId: string): Promise<void> {
  const s = await sitzungLesen();
  if (s && s.kontoId !== kontoId) await sitzungSpeichern({ ...s, kontoId });
}

/** Sync-Schlüssel dieses Geräts und das Konto, zu dem er gehört. */
export async function syncSchluesselLesen(): Promise<{ k: Uint8Array; konto: string } | null> {
  const roh = await geheimLesen(SYNC).catch(() => null);
  if (!roh) return null;
  try {
    const d = JSON.parse(roh) as { k: string; konto: string };
    const k = ausBase64(d.k);
    return k.length === 32 && typeof d.konto === "string" ? { k, konto: d.konto } : null;
  } catch {
    return null;
  }
}

export async function syncSchluesselSpeichern(k: Uint8Array, konto: string): Promise<void> {
  const wert = JSON.stringify({ k: base64(k), konto });
  // neuer Schlüssel: neue Zählung
  await geheimLoeschen(ZAEHLER).catch(() => undefined);
  await geheimSchreiben(SYNC, wert);
  // erst verwenden, wenn er sich wieder lesen lässt
  if ((await geheimLesen(SYNC)) !== wert) throw new SyncFehler("format");
  melden();
}

/** Sync auf diesem Gerät beenden (Server bleibt, wie er ist). */
export async function syncSchluesselVergessen(): Promise<void> {
  await geheimLoeschen(SYNC).catch(() => undefined);
  await geheimLoeschen(ZAEHLER).catch(() => undefined);
  melden();
}

/** Anmeldung abgelaufen: nur die Sitzung entfernen – nach erneuter Anmeldung geht es mit demselben Schlüssel weiter. */
export async function sitzungVergessen(): Promise<void> {
  await geheimLoeschen(SITZUNG).catch(() => undefined);
  melden();
}

/** Abmelden: Sitzung und Sync-Schlüssel vom Gerät entfernen – die Daten auf dem Gerät bleiben. */
export async function kontoVergessen(): Promise<void> {
  await geheimLoeschen(SITZUNG).catch(() => undefined);
  await geheimLoeschen(SYNC).catch(() => undefined);
  await geheimLoeschen(ZAEHLER).catch(() => undefined);
  melden();
}

let entdeckt: Promise<AuthSession.DiscoveryDocument> | null = null;
const entdecken = () => (entdeckt ??= AuthSession.fetchDiscoveryAsync(OIDC_ISSUER).catch((e: unknown) => {
  entdeckt = null;
  throw e;
}));

const ausAntwort = (t: AuthSession.TokenResponse, name: string, alt?: Sitzung): Sitzung => ({
  token: t.accessToken,
  refresh: t.refreshToken ?? alt?.refresh,
  bis: Date.now() + (t.expiresIn ?? 3600) * 1000,
  name,
  ...(alt?.kontoId ? { kontoId: alt.kontoId } : {}),
});

/** Name aus dem ID-Token (nur zur Anzeige, nicht geprüft – geprüft wird das Zugriffstoken auf dem Server). */
function nameAusIdToken(idToken: string | undefined): string {
  try {
    const teil = idToken?.split(".")[1];
    if (!teil) return "";
    const json = JSON.parse(new TextDecoder().decode(ausBase64(teil.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(teil.length / 4) * 4, "=")))) as { email?: string; name?: string };
    return json.email ?? json.name ?? "";
  } catch {
    return "";
  }
}

/**
 * Anmelden. Entwicklungsmodus: `kennung` (z. B. „lena“) – der Server stellt ein Token aus. Sonst öffnet sich die
 * Anmeldeseite des Identity-Providers; Abbrechen liefert null.
 */
export async function anmelden(kennung?: string): Promise<Sitzung | null> {
  if (devAnmeldung) {
    const r = await fetch(`${API_URL}/v1/dev/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kennung: kennung ?? "" }) }).catch(() => null);
    if (!r) throw new SyncFehler("netz");
    if (!r.ok) throw new SyncFehler("anmeldung");
    const d = (await r.json()) as { token: string; laeuft_ab_in: number };
    const s: Sitzung = { token: d.token, bis: Date.now() + d.laeuft_ab_in * 1000, name: (kennung ?? "").trim().toLowerCase() };
    await sitzungSpeichern(s);
    return s;
  }
  const discovery = await entdecken().catch(() => {
    throw new SyncFehler("netz");
  });
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "amtlos", path: "anmeldung" });
  const req = new AuthSession.AuthRequest({
    clientId: OIDC_CLIENT_ID,
    redirectUri,
    scopes: ["openid", "profile", "email", "offline_access"],
    usePKCE: true,
    ...(OIDC_AUDIENCE ? { extraParams: { audience: OIDC_AUDIENCE } } : {}),
  });
  const ergebnis = await req.promptAsync(discovery);
  if (ergebnis.type === "cancel" || ergebnis.type === "dismiss") return null;
  if (ergebnis.type !== "success" || !ergebnis.params.code) throw new SyncFehler("anmeldung");
  const t = await AuthSession.exchangeCodeAsync({ clientId: OIDC_CLIENT_ID, code: ergebnis.params.code, redirectUri, extraParams: { code_verifier: req.codeVerifier ?? "" } }, discovery).catch(() => {
    throw new SyncFehler("anmeldung");
  });
  const s = ausAntwort(t, nameAusIdToken(t.idToken));
  await sitzungSpeichern(s);
  return s;
}

/** Gültiges Zugriffstoken – erneuert es bei Bedarf; ohne gültige Anmeldung SyncFehler „anmeldung“. */
export async function tokenHolen(): Promise<string> {
  const s = await sitzungLesen();
  if (!s) throw new SyncFehler("anmeldung");
  if (s.bis - 60_000 > Date.now()) return s.token;
  if (!s.refresh || devAnmeldung) throw new SyncFehler("anmeldung");
  const discovery = await entdecken().catch(() => {
    throw new SyncFehler("netz");
  });
  const t = await AuthSession.refreshAsync({ clientId: OIDC_CLIENT_ID, refreshToken: s.refresh }, discovery).catch(() => {
    throw new SyncFehler("anmeldung");
  });
  const neu = ausAntwort(t, s.name, s);
  await sitzungSpeichern(neu);
  return neu.token;
}
