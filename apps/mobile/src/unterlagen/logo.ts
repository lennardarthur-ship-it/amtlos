/** Logo für den Briefkopf (E-129): aus den Fotos wählen, auf höchstens 800 px Breite verkleinern, als PNG-Data-URL. */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export async function logoWaehlen(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width > 800) ctx.resize({ width: 800 });
  const bild = await ctx.renderAsync();
  const fertig = await bild.saveAsync({ format: SaveFormat.PNG, base64: true });
  return fertig.base64 ? `data:image/png;base64,${fertig.base64}` : null;
}
