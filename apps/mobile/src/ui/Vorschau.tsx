import { View } from "react-native";
import { WebView } from "react-native-webview";
import { RADIUS, useFarben } from "./thema";
import { vorschauHtml } from "./vorschauHtml";

/** Vorschau des fertigen Dokuments (`papier`: ohne Rahmen, als Blatt auf der Bühne). `hoehe` gesetzt: Ausschnitt der ersten Seite; sonst ganzseitig mit Scrollen und Zoom. */
export function Vorschau({ html, quer, hoehe, papier }: { html: string; quer?: boolean; hoehe?: number; papier?: boolean }) {
  const f = useFarben();
  return (
    <View pointerEvents={hoehe ? "none" : "auto"} style={hoehe ? { height: hoehe, borderRadius: RADIUS.blatt, overflow: "hidden", borderWidth: papier ? 0 : 1, borderColor: f.linie, backgroundColor: "#ffffff" } : { flex: 1, backgroundColor: "#ffffff" }}>
      <WebView originWhitelist={["*"]} source={{ html: vorschauHtml(html, quer) }} scrollEnabled={!hoehe} scalesPageToFit setBuiltInZoomControls={false} style={{ flex: 1, backgroundColor: "#ffffff" }} accessibilityLabel="Vorschau des Dokuments" />
    </View>
  );
}
