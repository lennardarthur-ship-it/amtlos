import { durchreichen } from "@/lib/aktion";

export function GET(req: Request) {
  const monat = new URL(req.url).searchParams.get("monat") ?? "";
  if (!/^\d{4}-\d{2}$/.test(monat)) return new Response("monat fehlt", { status: 400 });
  return durchreichen(`/v1/zeiten/export?monat=${monat}`);
}
