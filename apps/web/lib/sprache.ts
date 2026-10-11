import "server-only";
import { cookies, headers } from "next/headers";
import { sprache as erkenne, texte, type Sprache } from "@amtlos/i18n";

export const SPRACH_COOKIE = "amtlos_sprache";

/** Sprache aus Einstellung (Cookie) oder Browser; Standard Deutsch. */
export async function aktuelleSprache(): Promise<Sprache> {
  const c = (await cookies()).get(SPRACH_COOKIE)?.value;
  if (c === "de" || c === "en") return c;
  return erkenne((await headers()).get("accept-language"));
}

export async function t() {
  const s = await aktuelleSprache();
  return { s, t: texte(s) };
}
