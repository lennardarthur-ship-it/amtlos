import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";
import { konfig } from "@/lib/konfig";
import { OIDC_COOKIE, RUECKRUF, oidc } from "@/lib/oidc";
import { sitzungSetzen } from "@/lib/sitzung";

export async function GET(req: NextRequest) {
  const k = konfig();
  const jar = await cookies();
  const gespeichert = jar.get(OIDC_COOKIE)?.value;
  jar.delete({ name: OIDC_COOKIE, path: RUECKRUF });
  if (!gespeichert) return NextResponse.redirect(new URL("/anmelden?fehler=1", k.webUrl));
  try {
    const { verifier, state } = JSON.parse(gespeichert) as { verifier: string; state: string };
    // Öffentliche URL verwenden (hinter dem Proxy kennt die Anfrage nur die interne Adresse)
    const aktuell = new URL(`${RUECKRUF}${req.nextUrl.search}`, k.webUrl);
    const tokens = await client.authorizationCodeGrant(await oidc(), aktuell, { pkceCodeVerifier: verifier, expectedState: state });
    const claims = tokens.claims();
    await sitzungSetzen({
      token: tokens.access_token,
      ablauf: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 3600),
      sub: claims?.sub ?? "",
      ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    });
    return NextResponse.redirect(new URL("/heute", k.webUrl));
  } catch {
    return NextResponse.redirect(new URL("/anmelden?fehler=1", k.webUrl));
  }
}
