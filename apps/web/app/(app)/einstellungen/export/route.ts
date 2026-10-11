import { durchreichen } from "@/lib/aktion";

export async function GET() {
  return durchreichen("/v1/export");
}
