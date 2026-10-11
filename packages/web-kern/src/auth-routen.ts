import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SignJWT } from "jose";
import * as client from "openid-client";
import { konfig } from "./konfig";
import { OIDC_COOKIE, RUECKRUF, oidc } from "./oidc";
import { sichererPfad } from "./pfad";
import { sitzung, sitzungBeenden, sitzungSetzen } from "./sitzung";

/** GET /auth/anmelden?weiter=/pfad – Authorization Code mit PKCE starten (E-014). */
export async function anmeldenGET(req?: NextRequest): Promise<NextResponse> {
  const k = konfig();
  const roh = req?.nextUrl.searchParams.get("weiter");
  const weiter = roh ? sichererPfad(roh, "") : "";
  if (k.authModus === "dev") return NextResponse.redirect(new URL(weiter ? `/anmelden?weiter=${encodeURIComponent(weiter)}` : "/anmelden", k.webUrl));
  const cfg = await oidc();
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const ziel = client.buildAuthorizationUrl(cfg, {
    redirect_uri: new URL(RUECKRUF, k.webUrl).href,
    scope: "openid profile email",
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
  });
  (await cookies()).set(OIDC_COOKIE, JSON.stringify({ verifier, state, weiter }), {
    httpOnly: true, secure: k.webUrl.startsWith("https://"), sameSite: "lax", path: RUECKRUF, maxAge: 600,
  });
  return NextResponse.redirect(ziel);
}

/** GET /auth/rueckruf – Code gegen Token tauschen, Sitzung setzen. */
export async function rueckrufGET(req: NextRequest, ziel = "/"): Promise<NextResponse> {
  const k = konfig();
  const jar = await cookies();
  const gespeichert = jar.get(OIDC_COOKIE)?.value;
  jar.delete({ name: OIDC_COOKIE, path: RUECKRUF });
  if (!gespeichert) return NextResponse.redirect(new URL("/anmelden?fehler=1", k.webUrl));
  try {
    const { verifier, state, weiter } = JSON.parse(gespeichert) as { verifier: string; state: string; weiter?: string };
    // Öffentliche URL verwenden (hinter dem Proxy kennt die Anfrage nur die interne Adresse)
    const aktuell = new URL(`${RUECKRUF}${req.nextUrl.search}`, k.webUrl);
    const tokens = await client.authorizationCodeGrant(await oidc(), aktuell, { pkceCodeVerifier: verifier, expectedState: state });
    await sitzungSetzen({
      token: tokens.access_token,
      ablauf: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 3600),
      sub: tokens.claims()?.sub ?? "",
      ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    });
    return NextResponse.redirect(new URL(sichererPfad(weiter, ziel), k.webUrl));
  } catch {
    return NextResponse.redirect(new URL("/anmelden?fehler=1", k.webUrl));
  }
}

/** POST /auth/abmelden – lokal und beim Identity-Provider abmelden. */
export async function abmeldenPOST(): Promise<NextResponse> {
  const k = konfig();
  const s = await sitzung();
  await sitzungBeenden();
  if (k.authModus === "oidc" && s?.idToken) {
    const ziel = client.buildEndSessionUrl(await oidc(), { id_token_hint: s.idToken, post_logout_redirect_uri: new URL("/anmelden", k.webUrl).href });
    return NextResponse.redirect(ziel, 303);
  }
  return NextResponse.redirect(new URL("/anmelden", k.webUrl), 303);
}

/** Entwicklungs-Login (E-062): nur AUTH_MODUS=dev, in staging/prod verweigert die Konfiguration den Start. */
export async function devAnmelden(kennung: string): Promise<boolean> {
  const k = konfig();
  if (k.authModus !== "dev") throw new Error("Entwicklungs-Login ist deaktiviert");
  const sub = kennung.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!sub) return false;
  const ablauf = Math.floor(Date.now() / 1000) + 12 * 3600;
  const token = await new SignJWT({ email: `${sub}@example.org`, name: sub })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("amtlos-dev")
    .setExpirationTime(ablauf)
    .sign(new TextEncoder().encode(k.devJwtSecret!));
  await sitzungSetzen({ token, ablauf, sub });
  return true;
}
