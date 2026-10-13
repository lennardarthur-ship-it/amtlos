/** Belegfoto (E-133): Kamera oder Fotos, verkleinert auf höchstens 1600 px Breite, JPEG – als Bytes. */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ausBase64 } from "./sicherung";

export async function belegFoto(kamera: boolean): Promise<Uint8Array | null> {
  if (kamera) {
    const erlaubt = await ImagePicker.requestCameraPermissionsAsync();
    if (!erlaubt.granted) throw new Error("kamera");
  }
  const r = kamera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width > 1600) ctx.resize({ width: 1600 });
  const bild = await ctx.renderAsync();
  const fertig = await bild.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return fertig.base64 ? ausBase64(fertig.base64) : null;
}
