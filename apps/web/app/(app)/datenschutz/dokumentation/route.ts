import { durchreichen } from "@/lib/aktion";

export function GET() {
  return durchreichen("/v1/datenschutz/dokumentation");
}
