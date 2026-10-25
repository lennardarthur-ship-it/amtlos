/** Web (Vorschau, Rundgang): Sicherung als Download, Auswahl über das Dateifeld des Browsers. */
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { CONTAINER_KENNUNG, istContainer, type Leser, type Schreiber } from "./sicherungContainer";

export const zufall = (n: number) => Crypto.getRandomBytes(n);

export async function dateiTeilen(name: string, text: string, mimeType = "application/octet-stream"): Promise<boolean> {
  const g = globalThis as unknown as { document: { createElement(t: string): { href: string; download: string; click(): void } }; URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: string[], o: { type: string }) => unknown };
  const url = g.URL.createObjectURL(new g.Blob([text], { type: mimeType }));
  const a = g.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => g.URL.revokeObjectURL(url), 1000);
  return true;
}

export async function dateiWaehlen(): Promise<{ name: string; text: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: { text(): Promise<string> } };
  const text = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  return { name: a.name, text };
}

export async function dateiTeilenBytes(name: string, bytes: Uint8Array, mimeType: string): Promise<boolean> {
  const g = globalThis as unknown as { document: { createElement(t: string): { href: string; download: string; click(): void } }; URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: unknown[], o: { type: string }) => unknown };
  const url = g.URL.createObjectURL(new g.Blob([bytes], { type: mimeType }));
  const a = g.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => g.URL.revokeObjectURL(url), 1000);
  return true;
}

export async function dateiWaehlenBytes(typen: string[]): Promise<{ name: string; bytes: Uint8Array; mime: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: typen, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: { arrayBuffer(): Promise<ArrayBuffer> } };
  const puffer = a.file ? await a.file.arrayBuffer() : await (await fetch(a.uri)).arrayBuffer();
  return { name: a.name, bytes: new Uint8Array(puffer), mime: a.mimeType ?? "" };
}

type Anker = { document: { createElement(t: string): { href: string; download: string; click(): void } }; URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: unknown[], o: { type: string }) => unknown };

/** Web: Sicherung in Stücken sammeln, als Blob herunterladen (der Browser hält die Stücke, nicht ein großer Text). */
export async function sicherungTeilen<T>(name: string, schreiben: (s: Schreiber) => Promise<T>): Promise<{ geteilt: boolean; ergebnis: T }> {
  const stuecke: Uint8Array[] = [];
  const ergebnis = await schreiben({ schreiben: async (b) => void stuecke.push(b) });
  const g = globalThis as unknown as Anker;
  const url = g.URL.createObjectURL(new g.Blob(stuecke, { type: "application/octet-stream" }));
  const a = g.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => g.URL.revokeObjectURL(url), 1000);
  return { geteilt: true, ergebnis };
}

export interface GewaehlteSicherung {
  name: string;
  text: string | null;
  leser: (() => Promise<Leser>) | null;
  entfernen(): void;
}

type BlobTeil = { size: number; slice(a: number, b: number): { arrayBuffer(): Promise<ArrayBuffer> }; text(): Promise<string> };

export async function sicherungWaehlen(): Promise<GewaehlteSicherung | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: BlobTeil };
  const blob: BlobTeil = a.file ?? ((await (await fetch(a.uri)).blob()) as unknown as BlobTeil);
  const anfang = new Uint8Array(await blob.slice(0, CONTAINER_KENNUNG.length).arrayBuffer());
  if (!istContainer(anfang)) return { name: a.name, text: await blob.text(), leser: null, entfernen: () => undefined };
  const leser = async (): Promise<Leser> => {
    let pos = 0;
    return {
      lesen: async (n) => {
        const b = new Uint8Array(await blob.slice(pos, Math.min(blob.size, pos + n)).arrayBuffer());
        pos += b.length;
        return b;
      },
    };
  };
  return { name: a.name, text: null, leser, entfernen: () => undefined };
}
