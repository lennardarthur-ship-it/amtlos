import { View } from "react-native";
import { WebView } from "react-native-webview";
import { RADIUS, useFarben } from "./thema";
import { vorschauHtml } from "./vorschauHtml";

/** Vorschau des fertigen Dokuments. `hoehe` gesetzt: Ausschnitt der ersten Seite; sonst ganzseitig mit Scrollen und Zoom. */
export function Vorschau({ html, quer, hoehe }: { html: string; quer?: boolean; hoehe?: number }) {
  const f = useFarben();
  return (
    <View pointerEvents={hoehe ? "none" : "auto"} style={hoehe ? { height: hoehe, borderRadius: RADIUS.blatt, overflow: "hidden", borderWidth: 1, borderColor: f.linie, backgroundColor: "#ffffff" } : { flex: 1, backgroundColor: "#ffffff" }}>
      <WebView originWhitelist={["*"]} source={{ html: vorschauHtml(html, quer) }} scrollEnabled={!hoehe} scalesPageToFit setBuiltInZoomControls={false} style={{ flex: 1, backgroundColor: "#ffffff" }} accessibilityLabel="Vorschau des Dokuments" />
    </View>
  );
}
