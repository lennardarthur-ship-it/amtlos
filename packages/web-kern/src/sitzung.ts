import "server-only";
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { konfig } from "./konfig";

const COOKIE = () => `${konfig().cookiePraefix}_sitzung`;
const UNTERNEHMEN_COOKIE = () => `${konfig().cookiePraefix}_unternehmen`;

export interface Sitzung {
  /** Zugriffstoken für die API (OIDC oder Entwicklungs-Token) */
  token: string;
  /** Ablauf in Sekunden seit Epoche */
  ablauf: number;
  sub: string;
  /** Für OIDC-Abmeldung */
  idToken?: string;
}

function schluessel(): Uint8Array {
  return createHash("sha256").update(konfig().sitzungSchluessel).digest();
}

const cookieOptionen = (maxAge: number) => ({
  httpOnly: true,
  secure: konfig().webUrl.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Sitzung verschlüsselt im Cookie (JWE, A256GCM): kein Serverzustand, Token nie im Browser-JavaScript lesbar. */
export async function sitzungSetzen(s: Sitzung): Promise<void> {
  const jwe = await new EncryptJWT({ ...s }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setExpirationTime(s.ablauf).encrypt(schluessel());
  (await cookies()).set(COOKIE(), jwe, cookieOptionen(Math.max(0, s.ablauf - Math.floor(Date.now() / 1000))));
}

export async function sitzung(): Promise<Sitzung | undefined> {
  const wert = (await cookies()).get(COOKIE())?.value;
  if (!wert) return undefined;
  try {
    const { payload } = await jwtDecrypt(wert, schluessel());
    const s = payload as unknown as Sitzung;
    return s.ablauf > Date.now() / 1000 + 30 ? s : undefined;
  } catch {
    return undefined;
  }
}

export async function sitzungBeenden(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE());
  c.delete(UNTERNEHMEN_COOKIE());
}

export async function gewaehltesUnternehmen(): Promise<string | undefined> {
  return (await cookies()).get(UNTERNEHMEN_COOKIE())?.value;
}

export async function unternehmenWaehlen(id: string): Promise<void> {
  (await cookies()).set(UNTERNEHMEN_COOKIE(), id, cookieOptionen(60 * 60 * 24 * 365));
}
