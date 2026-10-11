import type { NextRequest } from "next/server";
import { rueckrufGET } from "@amtlos/web-kern/auth-routen";

export function GET(req: NextRequest) {
  return rueckrufGET(req, "/");
}
