/** Web (Vorschau, Rundgang): Sicherung als Download, Auswahl über das Dateifeld des Browsers. */
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";

export const zufall = (n: number) => Crypto.getRandomBytes(n);

export async function dateiTeilen(name: string, text: string): Promise<void> {
  const g = globalThis as unknown as { document: { createElement(t: string): { href: string; download: string; click(): void } }; URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: string[], o: { type: string }) => unknown };
  const url = g.URL.createObjectURL(new g.Blob([text], { type: "application/octet-stream" }));
  const a = g.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => g.URL.revokeObjectURL(url), 1000);
}

export async function dateiWaehlen(): Promise<{ name: string; text: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: { text(): Promise<string> } };
  const text = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  return { name: a.name, text };
}
