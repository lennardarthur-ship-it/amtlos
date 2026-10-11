import { NextResponse, type NextRequest } from "next/server";
import { pfadSichtbar } from "@/lib/umfang";

/** Seiten versteckter Module antworten mit 404 (E-110); die Module bleiben im Code. */
export function proxy(req: NextRequest) {
  // Rewrite auf eine Route, die es nicht gibt → Next rendert not-found.tsx mit Status 404
  if (!pfadSichtbar(req.nextUrl.pathname)) return NextResponse.rewrite(new URL("/_versteckt", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/datenschutz/:path*", "/personal/:path*", "/online/:path*", "/branche/:path*", "/experten/:path*", "/frag/:path*", "/radar/:path*", "/kanzlei/:path*"] };
