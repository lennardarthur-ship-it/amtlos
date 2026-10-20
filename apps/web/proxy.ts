import { NextResponse, type NextRequest } from "next/server";
import { csp } from "@/lib/csp";
import { pfadSichtbar } from "@/lib/umfang";

export function proxy(req: NextRequest) {
  // Seiten versteckter Module antworten mit 404 (E-110); die Module bleiben im Code.
  // Rewrite auf eine Route, die es nicht gibt → Next rendert not-found.tsx mit Status 404
  const antwort = (kopf: Headers) =>
    pfadSichtbar(req.nextUrl.pathname) ? NextResponse.next({ request: { headers: kopf } }) : NextResponse.rewrite(new URL("/_versteckt", req.url), { request: { headers: kopf } });
  const nonce = btoa(crypto.randomUUID());
  const richtlinie = csp(nonce);
  const kopf = new Headers(req.headers);
  kopf.set("x-nonce", nonce);
  kopf.set("content-security-policy", richtlinie);
  const r = antwort(kopf);
  r.headers.set("Content-Security-Policy", richtlinie);
  return r;
}

export const config = {
  // Alle Seiten außer statischen Dateien; Prefetch-Anfragen ohne neue Nonce (sie liefern keine Inline-Skripte)
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
