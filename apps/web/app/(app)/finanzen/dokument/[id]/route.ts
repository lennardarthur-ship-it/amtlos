import { apiAntwort } from "@/lib/api";

/** Dateien (Rechnungs-PDF, XRechnung, Belege) über die Sitzung abrufen – die API verlangt das Token. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const r = await apiAntwort(`/v1/dokumente/${id}/datei`);
  if (!r.ok) return new Response("Nicht gefunden", { status: 404 });
  const kopf = new Headers();
  for (const k of ["content-type", "content-disposition", "x-content-sha256"]) {
    const v = r.headers.get(k);
    if (v) kopf.set(k, v);
  }
  kopf.set("cache-control", "private, no-store");
  return new Response(r.body, { status: 200, headers: kopf });
}
