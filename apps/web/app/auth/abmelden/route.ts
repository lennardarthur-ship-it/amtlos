import { NextResponse } from "next/server";
import * as client from "openid-client";
import { konfig } from "@/lib/konfig";
import { oidc } from "@/lib/oidc";
import { sitzung, sitzungBeenden } from "@/lib/sitzung";

export async function POST() {
  const k = konfig();
  const s = await sitzung();
  await sitzungBeenden();
  if (k.authModus === "oidc" && s?.idToken) {
    // Auch beim Identity-Provider abmelden, sonst meldet ein Klick auf „Anmelden“ sofort wieder an
    const ziel = client.buildEndSessionUrl(await oidc(), { id_token_hint: s.idToken, post_logout_redirect_uri: new URL("/anmelden", k.webUrl).href });
    return NextResponse.redirect(ziel, 303);
  }
  return NextResponse.redirect(new URL("/anmelden", k.webUrl), 303);
}
