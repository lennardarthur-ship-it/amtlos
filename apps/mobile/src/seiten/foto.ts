import * as ImagePicker from "expo-image-picker";

/** Foto aufnehmen oder aus der Mediathek wählen und als FormData („datei“) für die API vorbereiten. null = abgebrochen. */
export async function fotoWaehlen(kamera: boolean): Promise<{ uri: string; daten: FormData } | "verweigert" | null> {
  const erlaubt = kamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!erlaubt.granted) return "verweigert";
  const opt: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, exif: false };
  const r = kamera ? await ImagePicker.launchCameraAsync(opt) : await ImagePicker.launchImageLibraryAsync(opt);
  const bild = r.canceled ? undefined : r.assets[0];
  if (!bild) return null;
  const daten = new FormData();
  daten.append("datei", { uri: bild.uri, name: bild.fileName ?? "foto.jpg", type: bild.mimeType ?? "image/jpeg" } as unknown as Blob);
  return { uri: bild.uri, daten };
}
