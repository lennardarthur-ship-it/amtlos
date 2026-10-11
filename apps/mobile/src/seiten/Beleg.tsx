import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
import { Absatz, Hinweis, Knopf, Titel } from "../ui/bausteine";
import { useAmtlos } from "../zustand";
import { Seite } from "./gemeinsam";

/** Beleg fotografieren und hochladen (6.5). Fotos bleiben nicht in der App; das Original liegt unveränderlich bei den Belegen. */
export function Beleg() {
  const { t, klient, rolle } = useAmtlos();
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "fehler"; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const darf = rolle === "inhaber" || rolle === "admin" || rolle === "steuerberater";

  async function waehlen(kamera: boolean) {
    setMeldung(null);
    const erlaubt = kamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!erlaubt.granted) return setMeldung({ art: "fehler", text: t.mobil.kamera_verweigert });
    const opt: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, exif: false };
    const r = kamera ? await ImagePicker.launchCameraAsync(opt) : await ImagePicker.launchImageLibraryAsync(opt);
    const bild = r.canceled ? undefined : r.assets[0];
    if (!bild) return;
    setVorschau(bild.uri);
    setLaedt(true);
    try {
      const daten = new FormData();
      // React Native akzeptiert { uri, name, type } als Datei im FormData
      daten.append("datei", { uri: bild.uri, name: bild.fileName ?? "beleg.jpg", type: bild.mimeType ?? "image/jpeg" } as unknown as Blob);
      await klient.belegHochladen(daten);
      setMeldung({ art: "erfolg", text: t.mobil.beleg_hochgeladen });
    } catch (e) {
      setMeldung({ art: "fehler", text: e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e) });
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Seite>
      <Titel>{t.mobil.tabs.beleg}</Titel>
      <Absatz>{t.mobil.beleg_text}</Absatz>
      {!darf ? <Hinweis text={t.mobil.beleg_nur_inhaber} /> : null}
      {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
      <Knopf text={t.mobil.beleg_kamera} onPress={() => void waehlen(true)} deaktiviert={!darf} laedt={laedt} />
      <Knopf leise text={t.mobil.beleg_galerie} onPress={() => void waehlen(false)} deaktiviert={!darf || laedt} />
      {vorschau ? <Image source={{ uri: vorschau }} accessibilityIgnoresInvertColors style={{ width: "100%", height: 280, resizeMode: "contain", marginTop: 12 }} accessible={false} /> : null}
    </Seite>
  );
}
