import { Linking, View } from "react-native";
import { WebView } from "react-native-webview";
import { RADIUS, useFarben } from "./thema";
import { vorschauHtml } from "./vorschauHtml";

/** Vorschau des fertigen Dokuments (`papier`: ohne Rahmen, als Blatt auf der Bühne). `hoehe` gesetzt: Ausschnitt der ersten Seite; sonst ganzseitig mit Scrollen und Zoom. */
export function Vorschau({ html, quer, hoehe, papier }: { html: string; quer?: boolean; hoehe?: number; papier?: boolean }) {
  const f = useFarben();
  return (
    <View pointerEvents={hoehe ? "none" : "auto"} style={hoehe ? { height: hoehe, borderRadius: RADIUS.blatt, overflow: "hidden", borderWidth: papier ? 0 : 1, borderColor: f.linie, backgroundColor: "#ffffff" } : { flex: 1, backgroundColor: "#ffffff" }}>
      <WebView
        originWhitelist={["about:*", "data:*"]}
        source={{ html: vorschauHtml(html, quer) }}
        // das Dokument braucht kein JavaScript; Links öffnen sich im Browser statt in der Vorschau (E-143)
        javaScriptEnabled={false}
        onShouldStartLoadWithRequest={(r) => {
          if (/^(about:|data:)/.test(r.url)) return true;
          if (/^(https?|mailto|tel):/.test(r.url)) void Linking.openURL(r.url).catch(() => undefined);
          return false;
        }}
        scrollEnabled={!hoehe}
        scalesPageToFit
        setBuiltInZoomControls={false}
        style={{ flex: 1, backgroundColor: "#ffffff" }}
        accessibilityLabel="Vorschau des Dokuments"
      />
    </View>
  );
}
