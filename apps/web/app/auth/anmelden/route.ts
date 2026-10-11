import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as client from "openid-client";
import { konfig } from "@/lib/konfig";
import { OIDC_COOKIE, RUECKRUF, oidc } from "@/lib/oidc";

export async function GET() {
  const k = konfig();
  if (k.authModus === "dev") return NextResponse.redirect(new URL("/anmelden", k.webUrl));
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
  (await cookies()).set(OIDC_COOKIE, JSON.stringify({ verifier, state }), {
    httpOnly: true, secure: k.webUrl.startsWith("https://"), sameSite: "lax", path: RUECKRUF, maxAge: 600,
  });
  return NextResponse.redirect(ziel);
}
