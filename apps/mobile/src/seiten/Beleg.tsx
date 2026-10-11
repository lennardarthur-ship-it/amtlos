import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
import { Hinweis, Knopf, Symbol, T } from "../ui/bausteine";
import { RADIUS, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Seite } from "./gemeinsam";

/** Beleg fotografieren (6.5): eine große Kamerafläche, darunter die Galerie. Das Original liegt unveränderlich bei den Belegen. */
export function Beleg() {
  const { t, klient, rolle } = useAmtlos();
  const f = useFarben();
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "erfolg" | "fehler"; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [anzahl, setAnzahl] = useState(0);
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
      daten.append("datei", { uri: bild.uri, name: bild.fileName ?? "beleg.jpg", type: bild.mimeType ?? "image/jpeg" } as unknown as Blob);
      await klient.belegHochladen(daten);
      setAnzahl((n) => n + 1);
      setMeldung({ art: "erfolg", text: t.mobil.beleg_hochgeladen });
    } catch (e) {
      setMeldung({ art: "fehler", text: e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e) });
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Seite titel={t.mobil.tabs.beleg} unterzeile={anzahl ? `${anzahl} ${t.mobil.beleg_heute}` : undefined}>
      <T leise>{t.mobil.beleg_text}</T>
      {!darf ? <Hinweis text={t.mobil.beleg_nur_inhaber} /> : null}
      {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.mobil.beleg_kamera}
        disabled={!darf || laedt}
        onPress={() => void waehlen(true)}
        style={({ pressed }) => ({ marginTop: 20, minHeight: 220, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 1.5, borderStyle: vorschau ? "solid" : "dashed", borderColor: f.amt, alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: !darf ? 0.5 : pressed ? 0.85 : 1 })}
      >
        {vorschau ? (
          <Image source={{ uri: vorschau }} accessibilityIgnoresInvertColors style={{ width: "100%", height: 260, resizeMode: "cover" }} accessible={false} />
        ) : (
          <>
            <Symbol name="camera" groesse={44} farbe={f.amt} gewicht="light" />
            <T fett farbe={f.amt} stil={{ marginTop: 10 }}>{t.mobil.beleg_kamera}</T>
          </>
        )}
      </Pressable>
      <View style={{ marginTop: 12 }}>
        <Knopf leise text={t.mobil.beleg_galerie} symbol="photo.on.rectangle" onPress={() => void waehlen(false)} deaktiviert={!darf} laedt={laedt} />
      </View>
    </Seite>
  );
}
