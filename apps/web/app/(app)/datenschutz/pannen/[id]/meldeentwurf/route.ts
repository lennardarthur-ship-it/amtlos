import { durchreichen } from "@/lib/aktion";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  return durchreichen(`/v1/datenpannen/${id}/meldeentwurf`);
}
